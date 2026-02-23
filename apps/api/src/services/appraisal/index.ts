/**
 * Appraisal Service
 *
 * Evaluates comparables using appraisal rules (filters and adjustments)
 * and calculates ARV based on enabled comparables.
 *
 * This is a data-only service - it does not fetch data, only processes it.
 * Use PropertyApi.getPropertyBundle() to fetch data, then pass to this service.
 *
 * Usage:
 *   import { createAppraisalService } from '../services/appraisal'
 *
 *   const appraisal = createAppraisalService()
 *
 *   // Evaluate comparables
 *   const result = appraisal.evaluate(property, comparables, {
 *     filters: [...],
 *     adjustments: [...]
 *   })
 */

import type { NormalizedProperty, NormalizedComparable } from '../property-api/types'
import { evaluateComparables, evaluateComparable } from './evaluator'
import type {
  AppraisalFilter,
  AppraisalAdjustment,
  AppraisalOptions,
  AppraisalResult,
  AppraisedComparable,
  ComparableEvaluation,
} from './types'
import { DEFAULT_FILTERS, DEFAULT_ADJUSTMENTS } from './types'

// Re-export types
export type {
  AppraisalFilter,
  AppraisalAdjustment,
  AppraisalOptions,
  AppraisalResult,
  AppraisedComparable,
  AppraisalRulePreset,
  FilterType,
  AdjustmentType,
} from './types'
export { DEFAULT_FILTERS, DEFAULT_ADJUSTMENTS } from './types'
export { evaluateComparable, evaluateComparables } from './evaluator'

// Note: FallbackOptions and AppraisalResultWithFallback are exported via interface definitions below

// ─── Fallback Options ─────────────────────────────────────────────────────────

export interface FallbackOptions {
  /** Minimum number of comps required before trying fallback */
  minComps?: number
  /** Maximum comps to use when falling back to nearest */
  maxNearestComps?: number
}

// ─── Service Interface ─────────────────────────────────────────────────────────

export interface AppraisalService {
  /**
   * Evaluate comparables against a subject property using appraisal rules.
   * This is the main method - takes already-fetched data and applies filters/adjustments.
   */
  evaluate(
    subject: NormalizedProperty,
    comparables: NormalizedComparable[],
    options?: AppraisalOptions
  ): AppraisalResult

  /**
   * Evaluate comparables with automatic fallback when no comps pass filters.
   *
   * Fallback strategy:
   * 1. Try with default filters (including subdivision match)
   * 2. If no comps pass, disable subdivision_match and retry
   * 3. If still no comps, use nearest comps by distance
   *
   * @returns AppraisalResult with fallbackUsed flag indicating which strategy was used
   */
  evaluateWithFallback(
    subject: NormalizedProperty,
    comparables: NormalizedComparable[],
    options?: AppraisalOptions & FallbackOptions
  ): AppraisalResultWithFallback

  /**
   * Calculate ARV from appraised comparables
   */
  calculateARV(comparables: AppraisedComparable[]): number

  /**
   * Get default filters
   */
  getDefaultFilters(): AppraisalFilter[]

  /**
   * Get default adjustments
   */
  getDefaultAdjustments(): AppraisalAdjustment[]
}

export interface AppraisalResultWithFallback extends AppraisalResult {
  /** Indicates which fallback strategy was used, if any */
  fallbackUsed: 'none' | 'no_subdivision' | 'nearest_comps'
  /** Message explaining the fallback */
  fallbackReason?: string
}

// ─── Implementation ────────────────────────────────────────────────────────────

class PropertyAppraisalService implements AppraisalService {
  evaluate(
    subject: NormalizedProperty,
    comparables: NormalizedComparable[],
    options?: AppraisalOptions
  ): AppraisalResult {
    const filters = options?.filters ?? DEFAULT_FILTERS
    const adjustments = options?.adjustments ?? DEFAULT_ADJUSTMENTS

    // Evaluate all comparables
    // Debug: Log salePrice values before evaluation
    console.log(`[Appraisal] Input comparables salePrice values:`, comparables.map(c => ({
      id: c.id.substring(0, 8),
      salePrice: c.salePrice,
      pricePerSqft: c.pricePerSqft,
      squareFeet: c.squareFeet,
    })))
    const evaluations = evaluateComparables(subject, comparables, filters, adjustments)

    // Build appraised comparables with enable/disable state based on rules
    const appraisedComps: AppraisedComparable[] = comparables.map((comp) => {
      const evaluation = evaluations.get(comp.id) as ComparableEvaluation

      return {
        ...comp,
        evaluation,
        isEnabled: !evaluation.shouldDisable,
        adjustedSalePrice: evaluation.adjustedPrice,
      }
    })

    // Calculate ARV from enabled comparables
    const enabledComps = appraisedComps.filter((c) => c.isEnabled)
    const arv = this.calculateARV(enabledComps)

    // Calculate statistics - use adjustedSalePrice if available, fall back to salePrice
    const enabledPrices = enabledComps
      .map((c) => c.adjustedSalePrice ?? c.salePrice)
      .filter((p): p is number => p != null && p > 0)

    const enabledSqfts = enabledComps
      .map((c) => c.squareFeet)
      .filter((s): s is number => s != null && s > 0)

    const avgPricePerSqft =
      enabledSqfts.length > 0 && arv > 0
        ? Math.round(arv / (enabledSqfts.reduce((a, b) => a + b, 0) / enabledSqfts.length))
        : null

    const medianSalePrice = enabledPrices.length > 0 ? calculateMedian(enabledPrices) : null

    return {
      subject,
      comparables: appraisedComps,
      enabledCount: enabledComps.length,
      disabledCount: appraisedComps.length - enabledComps.length,
      appliedFilters: filters,
      appliedAdjustments: adjustments,
      arv,
      avgPricePerSqft,
      medianSalePrice,
    }
  }

  evaluateWithFallback(
    subject: NormalizedProperty,
    comparables: NormalizedComparable[],
    options?: AppraisalOptions & FallbackOptions
  ): AppraisalResultWithFallback {
    const minComps = options?.minComps ?? 3
    const maxNearestComps = options?.maxNearestComps ?? 5
    const adjustments = options?.adjustments ?? DEFAULT_ADJUSTMENTS

    // Step 1: Try with default filters (including subdivision match)
    const defaultFilters = options?.filters ?? DEFAULT_FILTERS
    const result1 = this.evaluate(subject, comparables, { filters: defaultFilters, adjustments })

    if (result1.enabledCount >= minComps) {
      console.log(`Appraisal: ${result1.enabledCount} comps passed default filters`)
      return {
        ...result1,
        fallbackUsed: 'none',
      }
    }

    // Step 2: Disable subdivision_match filter and retry
    const filtersWithoutSubdivision = defaultFilters.map((f) =>
      f.type === 'subdivision_match' ? { ...f, enabled: false } : f
    )
    const result2 = this.evaluate(subject, comparables, { filters: filtersWithoutSubdivision, adjustments })

    if (result2.enabledCount >= minComps) {
      console.log(`Appraisal: ${result2.enabledCount} comps passed after disabling subdivision match`)
      return {
        ...result2,
        fallbackUsed: 'no_subdivision',
        fallbackReason: `No comps matched subdivision "${subject.subdivision || 'unknown'}". Using ${result2.enabledCount} comps from nearby areas.`,
      }
    }

    // Step 3: Use nearest comps by distance (disable most filters, keep only basic ones)
    console.log(`Appraisal: Only ${result2.enabledCount} comps passed. Falling back to nearest comps.`)

    // Sort comparables by distance
    const sortedByDistance = [...comparables].sort((a, b) => {
      const distA = a.distanceMiles ?? 999
      const distB = b.distanceMiles ?? 999
      return distA - distB
    })

    // Get IDs of nearest comps that will be used for ARV
    const nearestCompIds = new Set(
      sortedByDistance.slice(0, maxNearestComps).map((c) => c.id)
    )

    // Evaluate ALL comps with original filters to show why they failed
    // But mark only the nearest ones as enabled for ARV calculation
    const allCompsWithEvaluation: AppraisedComparable[] = result2.comparables.map((comp) => {
      const isNearestComp = nearestCompIds.has(comp.id)
      const hasValidSaleData = comp.salePrice != null && comp.salePrice > 0

      // For nearest comps with valid data: enable them (used for ARV)
      // For others: keep them disabled but show their original evaluation
      return {
        ...comp,
        isEnabled: isNearestComp && hasValidSaleData,
        // Add a note in evaluation about why it's disabled if not nearest
        evaluation: {
          ...comp.evaluation,
          // Append "not in nearest comps" reason if applicable
          disableReasons: !isNearestComp && hasValidSaleData
            ? [...comp.evaluation.disableReasons, `Not in ${maxNearestComps} nearest comps (fallback mode)`]
            : comp.evaluation.disableReasons,
        },
      }
    })

    // Sort all comps by distance for display
    allCompsWithEvaluation.sort((a, b) => {
      const distA = a.distanceMiles ?? 999
      const distB = b.distanceMiles ?? 999
      return distA - distB
    })

    const enabledComps = allCompsWithEvaluation.filter((c) => c.isEnabled)
    const arv = this.calculateARV(enabledComps)

    // Use adjustedSalePrice if available, fall back to salePrice
    const enabledPrices = enabledComps
      .map((c) => c.adjustedSalePrice ?? c.salePrice)
      .filter((p): p is number => p != null && p > 0)

    const enabledSqfts = enabledComps
      .map((c) => c.squareFeet)
      .filter((s): s is number => s != null && s > 0)

    const avgPricePerSqft =
      enabledSqfts.length > 0 && arv > 0
        ? Math.round(arv / (enabledSqfts.reduce((a, b) => a + b, 0) / enabledSqfts.length))
        : null

    const medianSalePrice = enabledPrices.length > 0 ? calculateMedian(enabledPrices) : null

    // Get the farthest enabled comp's distance for the reason message
    const farthestEnabledComp = enabledComps[enabledComps.length - 1]

    return {
      subject,
      comparables: allCompsWithEvaluation,
      enabledCount: enabledComps.length,
      disabledCount: allCompsWithEvaluation.length - enabledComps.length,
      appliedFilters: defaultFilters, // Show original filters (not minimal) so user sees why comps failed
      appliedAdjustments: adjustments,
      arv,
      avgPricePerSqft,
      medianSalePrice,
      fallbackUsed: 'nearest_comps',
      fallbackReason: `Insufficient matching comps. Using ${enabledComps.length} nearest comps within ${farthestEnabledComp?.distanceMiles?.toFixed(2) ?? '?'} miles.`,
    }
  }

  calculateARV(comparables: AppraisedComparable[]): number {
    // Use adjustedSalePrice if available, otherwise fall back to salePrice
    // This ensures ARV is calculated even if adjustments couldn't be applied
    const validPrices = comparables
      .filter((c) => c.isEnabled)
      .map((c) => c.adjustedSalePrice ?? c.salePrice)
      .filter((p): p is number => p != null && p > 0)

    if (validPrices.length === 0) return 0

    return Math.round(validPrices.reduce((sum, p) => sum + p, 0) / validPrices.length)
  }

  getDefaultFilters(): AppraisalFilter[] {
    return [...DEFAULT_FILTERS]
  }

  getDefaultAdjustments(): AppraisalAdjustment[] {
    return [...DEFAULT_ADJUSTMENTS]
  }
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0

  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  }

  return sorted[mid]
}

// ─── Factory Function ──────────────────────────────────────────────────────────

/**
 * Create a new appraisal service instance.
 * No dependencies required - this is a pure data processing service.
 */
export function createAppraisalService(): AppraisalService {
  return new PropertyAppraisalService()
}
