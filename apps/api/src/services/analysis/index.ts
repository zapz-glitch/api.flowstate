/**
 * Shared Analysis Service
 *
 * Common functions used by both sync and async analysis endpoints.
 * Ensures consistent behavior between /analyze (sync) and /analyze/async (queue-based).
 */

import type { PropertyBundle } from '../property-api'
import type { AppraisedComparable, AppraisalResultWithFallback } from '../appraisal'
import type { CompSelectionResult } from '../comp-selection'
import type { PhotoBundle } from '../photo-provider'
import type { MajorItem } from '../valuation'

// Re-export for convenience
export type { PropertyBundle } from '../property-api'
export type { AppraisedComparable, AppraisalResultWithFallback } from '../appraisal'
export type { CompSelectionResult } from '../comp-selection'
export type { PhotoBundle } from '../photo-provider'

// ─── Date Formatting ─────────────────────────────────────────────────────────

/**
 * Format date to ISO format (YYYY-MM-DD)
 * Handles both YYYYMMDD and ISO formats
 */
export function formatDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null

  // Already in ISO format
  if (dateStr.includes('-')) {
    return dateStr.split('T')[0]
  }

  // Parse YYYYMMDD format
  if (/^\d{8}$/.test(dateStr)) {
    const year = dateStr.substring(0, 4)
    const month = dateStr.substring(4, 6)
    const day = dateStr.substring(6, 8)
    return `${year}-${month}-${day}`
  }

  return dateStr
}

// ─── Comp Quality Scoring ────────────────────────────────────────────────────

/**
 * Calculate a quality score for a comp based on data similarity to subject
 * Higher score = better comp
 *
 * Scoring factors:
 * - Distance: 0-30 points penalty (closer is better)
 * - Square footage similarity: 0-25 points penalty
 * - Recency: 0-25 points bonus (more recent is better)
 * - Year built similarity: 0-20 points penalty
 */
export function calculateCompQualityScore(
  comp: AppraisedComparable,
  subjectSqft: number | null,
  subjectYearBuilt: number | null
): number {
  let score = 100

  // Distance penalty (0-30 points) - closer is better
  if (comp.distanceMiles !== null) {
    // 0 miles = 0 penalty, 1 mile = 30 penalty
    const distancePenalty = Math.min(30, comp.distanceMiles * 30)
    score -= distancePenalty
  }

  // Square footage similarity (0-25 points penalty)
  if (subjectSqft && comp.squareFeet) {
    const sqftDiff = Math.abs(comp.squareFeet - subjectSqft)
    const sqftPctDiff = sqftDiff / subjectSqft
    // 0% diff = 0 penalty, 20%+ diff = 25 penalty
    const sqftPenalty = Math.min(25, sqftPctDiff * 125)
    score -= sqftPenalty
  }

  // Recency bonus (0-25 points) - more recent is better
  if (comp.saleDate) {
    const saleDate = new Date(formatDate(comp.saleDate) || comp.saleDate)
    const daysSinceSale = Math.floor((Date.now() - saleDate.getTime()) / (1000 * 60 * 60 * 24))
    // 0 days = 25 bonus, 365 days = 0 bonus
    const recencyBonus = Math.max(0, 25 - (daysSinceSale / 365) * 25)
    score += recencyBonus - 25 // Normalize: recent sales don't get penalized
  } else {
    score -= 15 // No sale date = penalty
  }

  // Year built similarity (0-20 points penalty)
  if (subjectYearBuilt && comp.yearBuilt) {
    const yearDiff = Math.abs(comp.yearBuilt - subjectYearBuilt)
    // 0 years diff = 0 penalty, 20+ years = 20 penalty
    const yearPenalty = Math.min(20, yearDiff)
    score -= yearPenalty
  }

  return Math.max(0, Math.min(100, score))
}

/**
 * Select best comp based on data quality when LLM selection is not available
 */
export function selectBestCompFromData(
  comps: AppraisedComparable[],
  subjectSqft: number | null,
  subjectYearBuilt: number | null
): { bestCompId: string | null; scores: Map<string, number> } {
  if (comps.length === 0) {
    return { bestCompId: null, scores: new Map() }
  }

  const scores = new Map<string, number>()
  let bestCompId: string | null = null
  let bestScore = -1

  for (const comp of comps) {
    const score = calculateCompQualityScore(comp, subjectSqft, subjectYearBuilt)
    scores.set(comp.id, score)

    if (score > bestScore) {
      bestScore = score
      bestCompId = comp.id
    }
  }

  return { bestCompId, scores }
}

// ─── Response Building ───────────────────────────────────────────────────────

/**
 * Valuation result type (matches output from ValuationService.calculateValuation)
 */
export interface ValuationResult {
  buyPrice: number
  buyPricePercent: number
  pricePerSqft: number
  totalRehabCost: number
  rehabLevel: string
  rehabPerSqft: number
  closingCosts: number
  carryingCosts: number
  totalInvestment: number
  projectedProfit: number
  projectedROI: number
  wholesalePrice: number
  recommendation: string
  recommendationReason: string
}

/**
 * Context required for building analysis response
 */
export interface ResponseContext {
  arvSource: 'appraisal' | 'comp-selection'
  finalArv: number
  bestCompId: string | null
  selectedCompIds: string[]
  dataBasedScores: Map<string, number>
  zillowUrls?: Map<string, { searchUrl: string; directUrl?: string }>
  photoProvider?: string | null
  analysisId?: string
}

/**
 * Buybox parameters for valuation
 */
export interface BuyboxParams {
  rehabLevelIndex?: number
  majorItems?: MajorItem[]
  additionPlay?: number
  closingCostsPercent?: number
  carryingCostsPercent?: number
  wholesaleFee?: number
  desiredProfit?: number
}

/**
 * Analysis response structure (simplified underwriter format)
 */
export interface AnalysisResponse {
  subject: {
    address: string
    county: string | null
    bedsBaths: string
    squareFeet: number | null
    lotSizeAcres: number | null
    yearBuilt: number | null
    propertyType: string | null
    /** Subdivision name (if available) */
    subdivision: string | null
    lastSale: {
      price: number
      date: string | null
      pricePerSqft: number | null
    } | null
    taxAssessment: number | null
    photos: string[]
  }
  valuation: {
    arv: number
    arvSource: 'appraisal' | 'comp-selection'
    arvPerSqft: number
    buyPrice: number
    buyPricePercent: number
    rehabCost: number
    rehabLevel: string
    rehabPerSqft: number
    totalCosts: number
    totalInvestment: number
    projectedProfit: number
    projectedROI: number
    wholesalePrice: number
    recommendation: string
    recommendationReason: string
  }
  comps: {
    count: number
    avgPricePerSqft: number | null
    medianPrice: number | null
    items: Array<{
      address: string
      salePrice: number | null
      saleDate: string | null
      squareFeet: number | null
      pricePerSqft: number | null
      distanceMiles: number | null
      bedsBaths: string
      yearBuilt: number | null
      adjustedPrice: number | null
      qualityScore: number | null
      condition: string | null
      isBestComp: boolean
      photos: string[]
      /** Subdivision name (if available) */
      subdivision: string | null
      /** Reason this comp was selected/analyzed (LLM reasoning) */
      selectionReason: string | null
      /** Key features identified by LLM analysis */
      keyFeatures: string[] | null
      /** Appraisal rule evaluation details */
      appraisalRules: {
        /** Whether this comp passed all filters */
        passedFilters: boolean
        /** Total adjustment amount applied to price */
        totalAdjustment: number
        /** Filter results - which rules matched/failed */
        filters: Array<{
          type: string
          passed: boolean
          reason?: string
          actualValue?: number | string | null
          threshold?: number | string | null
        }>
        /** Adjustment results - what price adjustments were applied */
        adjustments: Array<{
          type: string
          applied: boolean
          amount: number
          reason?: string
        }>
      } | null
    }>
  }
  riskFlags: string[] | null
  permits: {
    count: number
    totalValue: number | null
    recentTypes: string[]
  } | null
  floodZone: {
    zone: string | null
    inFloodZone: boolean
    description: string | null
  } | null
  meta: {
    analysisId: string
    timestamp: string
    dataProvider: string | null
  }
}

/**
 * Build streamlined underwriter-focused response
 * Returns only essential data for investment decisions
 *
 * This is the single source of truth for response format.
 * Used by both sync and async endpoints.
 */
export function buildAnalysisResponse(
  bundle: PropertyBundle,
  appraisalResult: AppraisalResultWithFallback,
  photoBundle: PhotoBundle | null,
  compSelectionResult: CompSelectionResult | null,
  valuation: ValuationResult,
  ctx: ResponseContext
): AnalysisResponse {
  const { property, enrichment } = bundle
  const { arvSource, finalArv, bestCompId, selectedCompIds, dataBasedScores } = ctx

  // Get subject photos
  const subjectPhotos = photoBundle?.subject?.photos.slice(0, 5) ?? []

  // Build risk flags for underwriter attention
  const riskFlags: string[] = []
  if (enrichment.floodZone?.isInFloodZone) {
    riskFlags.push(`Flood Zone: ${enrichment.floodZone.floodZone}`)
  }
  if (property.transaction?.isForeclosure) riskFlags.push('Foreclosure')
  if (property.transaction?.isShortSale) riskFlags.push('Short Sale')
  if (property.yearBuilt && property.yearBuilt < 1978) riskFlags.push('Pre-1978 (Lead Paint)')
  if (enrichment.permits?.items.some((p) => p.jobValue && p.jobValue > 50000)) {
    riskFlags.push('Major Permits (>$50K)')
  }

  // Get enabled comps
  const enabledComps = appraisalResult.comparables.filter((c) => c.isEnabled)

  // Get best comp selection reason if this is the best comp
  const bestCompSelectionReason = compSelectionResult?.bestComp?.selectionReason ?? null

  // Get all enabled comps for ARV support (no limit - return all that passed filters)
  const topComps = enabledComps
    .filter((c) => selectedCompIds.length === 0 || selectedCompIds.includes(c.id))
    .map((comp) => {
      const analysis = compSelectionResult?.allAnalyses.find((a) => a.compId === comp.id)
      const compPhotos = photoBundle?.comps[comp.id]?.photos.slice(0, 3) ?? []

      // Use LLM analysis score if available, otherwise use data-based score
      const qualityScore = analysis?.qualityScore ?? dataBasedScores.get(comp.id) ?? null

      // For best comp, use the selection reason; for others, use the analysis reasoning
      const isBest = comp.id === bestCompId
      const selectionReason = isBest
        ? bestCompSelectionReason
        : analysis?.reasoning ?? null

      // Build appraisal rule details from evaluation
      const evaluation = comp.evaluation
      const appraisalRules = evaluation
        ? {
            passedFilters: !evaluation.shouldDisable,
            totalAdjustment: evaluation.totalAdjustment,
            filters: evaluation.filterResults.map((f) => ({
              type: f.type,
              passed: f.passed,
              reason: f.reason,
              actualValue: f.actualValue ?? null,
              threshold: f.threshold ?? null,
            })),
            adjustments: evaluation.adjustmentResults
              .filter((a) => a.applied) // Only show adjustments that were actually applied
              .map((a) => ({
                type: a.type,
                applied: a.applied,
                amount: a.amount,
                reason: a.reason,
              })),
          }
        : null

      return {
        address: `${comp.address}, ${comp.city}, ${comp.state}`,
        salePrice: comp.salePrice,
        saleDate: formatDate(comp.saleDate),
        squareFeet: comp.squareFeet,
        pricePerSqft: comp.pricePerSqft,
        distanceMiles: comp.distanceMiles,
        bedsBaths: `${comp.bedrooms ?? '?'}/${comp.bathrooms ?? '?'}`,
        yearBuilt: comp.yearBuilt,
        adjustedPrice: comp.adjustedSalePrice,
        qualityScore: qualityScore !== null ? Math.round(qualityScore) : null,
        condition: analysis?.comparisonToSubject ?? null,
        isBestComp: isBest,
        photos: compPhotos,
        subdivision: comp.subdivision ?? null,
        selectionReason,
        keyFeatures: analysis?.keyFeatures ?? null,
        appraisalRules,
      }
    })

  // Generate analysis ID if not provided
  const analysisId = ctx.analysisId || `analysis_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

  return {
    // ═══ SUBJECT PROPERTY ═══════════════════════════════════════════════════
    subject: {
      address: `${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
      county: property.county ?? null,
      bedsBaths: `${property.bedrooms ?? '?'}/${property.bathrooms ?? '?'}`,
      squareFeet: property.squareFeet ?? null,
      lotSizeAcres: property.lotSizeAcres ?? null,
      yearBuilt: property.yearBuilt ?? null,
      propertyType: property.propertyType ?? null,
      subdivision: property.subdivision ?? null,
      lastSale: property.lastSalePrice
        ? {
            price: property.lastSalePrice,
            date: property.lastSaleDate ?? null,
            pricePerSqft: property.pricePerSqft ?? null,
          }
        : null,
      taxAssessment: property.assessedValue ?? null,
      photos: subjectPhotos,
    },

    // ═══ VALUATION SUMMARY ══════════════════════════════════════════════════
    valuation: {
      arv: finalArv,
      arvSource: arvSource,
      arvPerSqft: valuation.pricePerSqft,
      buyPrice: valuation.buyPrice,
      buyPricePercent: valuation.buyPricePercent,
      rehabCost: valuation.totalRehabCost,
      rehabLevel: valuation.rehabLevel,
      rehabPerSqft: valuation.rehabPerSqft,
      totalCosts: valuation.closingCosts + valuation.carryingCosts,
      totalInvestment: valuation.totalInvestment,
      projectedProfit: valuation.projectedProfit,
      projectedROI: valuation.projectedROI,
      wholesalePrice: valuation.wholesalePrice,
      recommendation: valuation.recommendation,
      recommendationReason: valuation.recommendationReason,
    },

    // ═══ COMPARABLE SALES (Top 5) ═══════════════════════════════════════════
    comps: {
      count: enabledComps.length,
      avgPricePerSqft: appraisalResult.avgPricePerSqft,
      medianPrice: appraisalResult.medianSalePrice,
      items: topComps,
    },

    // ═══ RISK FLAGS ═════════════════════════════════════════════════════════
    riskFlags: riskFlags.length > 0 ? riskFlags : null,

    // ═══ PERMITS (if significant) ═══════════════════════════════════════════
    permits: enrichment.permits
      ? {
          count: enrichment.permits.count,
          totalValue: enrichment.permits.totalJobValue ?? null,
          recentTypes: (enrichment.permits.recentPermitTypes ?? []).slice(0, 5),
        }
      : null,

    // ═══ FLOOD ZONE ═════════════════════════════════════════════════════════
    floodZone: enrichment.floodZone
      ? {
          zone: enrichment.floodZone.floodZone,
          inFloodZone: enrichment.floodZone.isInFloodZone,
          description: enrichment.floodZone.floodZoneDescription,
        }
      : null,

    // ═══ METADATA ═══════════════════════════════════════════════════════════
    meta: {
      analysisId,
      timestamp: new Date().toISOString(),
      dataProvider: property.provider,
    },
  }
}
