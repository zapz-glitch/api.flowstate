/**
 * Comp Selection Service
 *
 * LLM-based comparable property selection for ARV calculation.
 * Analyzes photos and descriptions to select the best comps.
 *
 * Flow:
 * 1. Receive subject property + comps with Zillow data
 * 2. Send to LLM for holistic analysis
 * 3. LLM compares each comp to subject
 * 4. Filter out comps worse than subject
 * 5. Select best comp and good comps for ARV
 * 6. Calculate recommended ARV from selected comps
 *
 * Usage:
 *   import { createCompSelectionService } from '../services/comp-selection'
 *
 *   const service = createCompSelectionService(env)
 *   const result = await service.selectBestComps(subject, comps, options)
 */

import type { Env } from '../../types'
import { createLLMProviderFromEnv, type LLMProvider } from '../llm'
import { PROMPTS } from '../../prompts'
import type {
  SubjectPropertyData,
  CompPropertyData,
  CompSelectionResult,
  CompAnalysisResult,
  BestCompResult,
  CompSelectionOptions,
  ComparisonRating,
} from './types'
import { DEFAULT_COMP_SELECTION_OPTIONS } from './types'

// Re-export types
export * from './types'

// ─── Service Interface ────────────────────────────────────────────────────────

export interface CompSelectionService {
  /**
   * Select the best comps for ARV calculation
   * Uses LLM to analyze photos and descriptions
   */
  selectBestComps(
    subject: SubjectPropertyData,
    comps: CompPropertyData[],
    options?: CompSelectionOptions
  ): Promise<CompSelectionResult>

  /**
   * Check if the service is available (LLM configured)
   */
  isAvailable(): boolean

  /**
   * Get the LLM provider name being used
   */
  getProviderName(): string | null
}

// ─── System Prompt (from centralized prompts) ─────────────────────────────────

// Use centralized prompt for comp selection system instructions
const SYSTEM_PROMPT = PROMPTS.COMP_SELECTION_SYSTEM

function buildAnalysisPrompt(
  subject: SubjectPropertyData,
  comps: CompPropertyData[],
  options: Required<CompSelectionOptions>
): string {
  const subjectInfo = formatPropertyInfo(subject.property, subject.description)
  const compsInfo = comps
    .map((c, i) => {
      const info = formatCompInfo(c.comparable, c.description)
      return `\n--- COMP ${i + 1} (ID: ${c.comparable.id}) ---\n${info}`
    })
    .join('\n')

  return `Analyze these comparable properties against the subject property for ARV (After Repair Value) calculation.

=== SUBJECT PROPERTY (This is the property being analyzed - assess its current condition) ===
${subjectInfo}
${subject.photos.length > 0 ? `Photos available: ${subject.photos.length} photos (examine these carefully)` : 'No photos available'}

=== COMPARABLE PROPERTIES (Compare each to subject - we need comps BETTER than subject) ===${compsInfo}

=== CRITICAL ANALYSIS REQUIREMENTS ===
IMPORTANT: For ARV calculation, we MUST select comps that are BETTER than or EQUAL to the subject.
Comps that are WORSE than the subject are NOT suitable for ARV and should be filtered out.

1. For each comp, carefully compare condition to the SUBJECT:
   - "better" = Comp is in BETTER condition than subject (updated finishes, renovated, higher quality)
   - "similar" = Comp is in SIMILAR condition to subject (comparable updates and quality)
   - "worse" = Comp is in WORSE condition than subject (more dated, needs more work) - FILTER OUT

2. Assessment factors (compare to SUBJECT):
   - Kitchen/bath quality and updates
   - Flooring, fixtures, appliances
   - Overall renovation level and finish quality
   - Curb appeal and exterior condition
   - Age and maintenance level

3. Only mark "isSuitable: true" if comp is BETTER or SIMILAR to subject
4. Mark "isSuitable: false" for any comp that is WORSE than subject
5. Minimum quality score to be suitable: ${options.minQualityScore}
6. ${options.requireBetterOrEqual ? 'STRICT MODE: Only comps BETTER than or EQUAL to subject are acceptable' : 'All comps can be considered'}

=== RESPONSE FORMAT ===
Respond with this exact JSON structure:
{
  "analyses": [
    {
      "compId": "<comp ID>",
      "comparisonToSubject": "better" | "similar" | "worse" | "unknown",
      "confidence": <0-100>,
      "isSuitable": <true if better/similar, false if worse>,
      "qualityScore": <0-100 relative quality score>,
      "reasoning": "<explain WHY this comp is better/similar/worse than the subject>",
      "keyFeatures": ["<positive feature vs subject>"],
      "concerns": ["<concerns or reasons worse than subject>"]
    }
  ],
  "bestComp": {
    "compId": "<comp ID of best match - must be from suitable comps only>",
    "selectionReason": "<why this comp best represents ARV target for subject>",
    "confidence": <0-100>,
    "keyFactors": ["<key reasons this represents subject's potential value>"]
  },
  "summary": "<overall analysis: how many comps are suitable for ARV calculation>"
}

Respond with ONLY valid JSON, no other text.`
}

function formatPropertyInfo(
  property: { address: string; city: string; state: string; zipCode: string; bedrooms?: number | null; bathrooms?: number | null; squareFeet?: number | null; yearBuilt?: number | null; propertyType?: string | null },
  description?: string
): string {
  const lines = [
    `Address: ${property.address}, ${property.city}, ${property.state} ${property.zipCode}`,
    `Type: ${property.propertyType ?? 'Unknown'}`,
    `Beds/Baths: ${property.bedrooms ?? '?'}/${property.bathrooms ?? '?'}`,
    `Sqft: ${property.squareFeet?.toLocaleString() ?? 'Unknown'}`,
    `Year Built: ${property.yearBuilt ?? 'Unknown'}`,
  ]

  if (description) {
    lines.push(`Description: ${description.substring(0, 500)}${description.length > 500 ? '...' : ''}`)
  }

  return lines.join('\n')
}

function formatCompInfo(
  comp: { id: string; address: string; city: string; state: string; zipCode: string; bedrooms?: number | null; bathrooms?: number | null; squareFeet?: number | null; yearBuilt?: number | null; propertyType?: string | null; salePrice?: number | null; saleDate?: string | null; distanceMiles?: number | null; adjustedSalePrice?: number | null },
  description?: string
): string {
  const lines = [
    `Address: ${comp.address}, ${comp.city}, ${comp.state} ${comp.zipCode}`,
    `Type: ${comp.propertyType ?? 'Unknown'}`,
    `Beds/Baths: ${comp.bedrooms ?? '?'}/${comp.bathrooms ?? '?'}`,
    `Sqft: ${comp.squareFeet?.toLocaleString() ?? 'Unknown'}`,
    `Year Built: ${comp.yearBuilt ?? 'Unknown'}`,
    `Sale Price: $${comp.salePrice?.toLocaleString() ?? 'Unknown'}`,
    `Sale Date: ${comp.saleDate ?? 'Unknown'}`,
    `Distance: ${comp.distanceMiles?.toFixed(2) ?? '?'} miles`,
    `Adjusted Price: $${comp.adjustedSalePrice?.toLocaleString() ?? 'N/A'}`,
  ]

  if (description) {
    lines.push(`Description: ${description.substring(0, 500)}${description.length > 500 ? '...' : ''}`)
  }

  return lines.join('\n')
}

// ─── Response Parsing ─────────────────────────────────────────────────────────

interface LLMAnalysisResponse {
  analyses: Array<{
    compId: string
    comparisonToSubject: string
    confidence: number
    isSuitable: boolean
    qualityScore: number
    reasoning: string
    keyFeatures: string[]
    concerns: string[]
  }>
  bestComp: {
    compId: string
    selectionReason: string
    confidence: number
    keyFactors: string[]
  } | null
  summary: string
}

function parseResponse(text: string): LLMAnalysisResponse | null {
  try {
    return JSON.parse(text) as LLMAnalysisResponse
  } catch {
    // Try extracting JSON from markdown code block
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (match) {
      try {
        return JSON.parse(match[1].trim()) as LLMAnalysisResponse
      } catch {
        return null
      }
    }
    // Try finding JSON object
    const objMatch = text.match(/\{[\s\S]*\}/)
    if (objMatch) {
      try {
        return JSON.parse(objMatch[0]) as LLMAnalysisResponse
      } catch {
        return null
      }
    }
    return null
  }
}

function normalizeComparison(value: string): ComparisonRating {
  const normalized = value.toLowerCase().trim()
  if (normalized === 'better') return 'better'
  if (normalized === 'similar') return 'similar'
  if (normalized === 'worse') return 'worse'
  return 'unknown'
}

// ─── Implementation ───────────────────────────────────────────────────────────

class PropertyCompSelectionService implements CompSelectionService {
  private llmProvider: LLMProvider | null

  constructor(env: Env) {
    this.llmProvider = createLLMProviderFromEnv(env as unknown as Record<string, string | undefined>)
  }

  isAvailable(): boolean {
    return this.llmProvider !== null
  }

  getProviderName(): string | null {
    return this.llmProvider?.name ?? null
  }

  async selectBestComps(
    subject: SubjectPropertyData,
    comps: CompPropertyData[],
    options?: CompSelectionOptions
  ): Promise<CompSelectionResult> {
    const startTime = Date.now()
    const opts = { ...DEFAULT_COMP_SELECTION_OPTIONS, ...options }

    // Limit comps to analyze
    const compsToAnalyze = comps.slice(0, opts.maxComps)

    if (!this.llmProvider) {
      // Fallback: use heuristic-based selection
      return this.selectBestCompsHeuristic(subject, compsToAnalyze, opts, startTime)
    }

    try {
      // Build prompt for LLM
      const prompt = buildAnalysisPrompt(subject, compsToAnalyze, opts)

      // Call LLM
      const result = await this.llmProvider.execute({
        prompt,
        systemPrompt: SYSTEM_PROMPT,
        responseFormat: 'json',
        maxTokens: 4096,
        temperature: 0.3,
      })

      if (!result.success || !result.data) {
        console.error('[CompSelection] LLM call failed:', result.error)
        return this.selectBestCompsHeuristic(subject, compsToAnalyze, opts, startTime)
      }

      // Parse response
      const parsed = parseResponse(result.data.content)
      if (!parsed) {
        console.error('[CompSelection] Failed to parse LLM response')
        return this.selectBestCompsHeuristic(subject, compsToAnalyze, opts, startTime)
      }

      // Build result
      const allAnalyses: CompAnalysisResult[] = parsed.analyses.map((a) => ({
        compId: a.compId,
        comparisonToSubject: normalizeComparison(a.comparisonToSubject),
        confidence: Math.min(100, Math.max(0, a.confidence)),
        isSuitable: a.isSuitable,
        qualityScore: Math.min(100, Math.max(0, a.qualityScore)),
        reasoning: a.reasoning,
        keyFeatures: a.keyFeatures || [],
        concerns: a.concerns || [],
      }))

      // Filter into suitable and filtered out
      const goodComps = allAnalyses.filter(
        (a) =>
          a.isSuitable &&
          a.qualityScore >= opts.minQualityScore &&
          (opts.requireBetterOrEqual
            ? a.comparisonToSubject === 'better' || a.comparisonToSubject === 'similar'
            : true)
      )

      const filteredOutComps = allAnalyses.filter((a) => !goodComps.includes(a))

      // Build best comp result
      let bestComp: BestCompResult | null = null
      if (parsed.bestComp && goodComps.some((c) => c.compId === parsed.bestComp?.compId)) {
        bestComp = {
          compId: parsed.bestComp.compId,
          selectionReason: parsed.bestComp.selectionReason,
          confidence: Math.min(100, Math.max(0, parsed.bestComp.confidence)),
          keyFactors: parsed.bestComp.keyFactors || [],
        }
      } else if (goodComps.length > 0) {
        // If LLM's best comp was filtered out, select the highest quality good comp
        const sorted = [...goodComps].sort((a, b) => b.qualityScore - a.qualityScore)
        const best = sorted[0]
        bestComp = {
          compId: best.compId,
          selectionReason: 'Selected based on highest quality score among suitable comps',
          confidence: best.confidence,
          keyFactors: best.keyFeatures.slice(0, 3),
        }
      }

      // Calculate recommended ARV from good comps
      const recommendedArv = this.calculateRecommendedArv(compsToAnalyze, goodComps, bestComp)

      // Calculate average quality score
      const avgQuality =
        goodComps.length > 0
          ? Math.round(goodComps.reduce((sum, c) => sum + c.qualityScore, 0) / goodComps.length)
          : 0

      return {
        bestComp,
        goodComps,
        filteredOutComps,
        allAnalyses,
        summary: {
          totalCompsAnalyzed: allAnalyses.length,
          compsPassedFilter: goodComps.length,
          compsFilteredOut: filteredOutComps.length,
          averageQualityScore: avgQuality,
          analysisMethod: opts.useVision ? 'hybrid' : 'text',
        },
        recommendedArv,
        usage: result.usage,
        timing: {
          startTime,
          endTime: Date.now(),
          durationMs: Date.now() - startTime,
        },
      }
    } catch (error) {
      console.error('[CompSelection] Error in LLM analysis:', error)
      return this.selectBestCompsHeuristic(subject, compsToAnalyze, opts, startTime)
    }
  }

  /**
   * Fallback heuristic-based comp selection when LLM is unavailable
   */
  private selectBestCompsHeuristic(
    subject: SubjectPropertyData,
    comps: CompPropertyData[],
    opts: Required<CompSelectionOptions>,
    startTime: number
  ): CompSelectionResult {
    const allAnalyses: CompAnalysisResult[] = comps.map((c) => {
      const comp = c.comparable
      const subj = subject.property

      // Calculate similarity score based on property attributes
      let score = 50 // Base score

      // Year built comparison
      if (comp.yearBuilt && subj.yearBuilt) {
        const yearDiff = comp.yearBuilt - subj.yearBuilt
        if (yearDiff > 5) score += 10 // Newer is better
        else if (yearDiff < -10) score -= 15 // Much older is worse
      }

      // Square footage comparison
      if (comp.squareFeet && subj.squareFeet) {
        const sqftRatio = comp.squareFeet / subj.squareFeet
        if (sqftRatio >= 0.9 && sqftRatio <= 1.1) score += 10 // Similar size
        else if (sqftRatio > 1.1) score += 5 // Larger
      }

      // Price per sqft comparison (higher often means better condition)
      if (comp.pricePerSqft && subj.pricePerSqft) {
        const ppsRatio = comp.pricePerSqft / subj.pricePerSqft
        if (ppsRatio > 1.1) score += 15 // Higher $/sqft suggests better condition
        else if (ppsRatio < 0.9) score -= 10
      }

      // Has description (more info = better)
      if (c.description && c.description.length > 100) score += 5

      // Has photos
      if (c.photos && c.photos.length > 5) score += 5

      // Distance penalty
      if (comp.distanceMiles && comp.distanceMiles > 0.5) {
        score -= Math.min(10, comp.distanceMiles * 5)
      }

      // Clamp score
      score = Math.min(100, Math.max(0, score))

      // Determine comparison based on score
      let comparison: ComparisonRating = 'similar'
      if (score >= 65) comparison = 'better'
      else if (score < 40) comparison = 'worse'

      const isSuitable =
        score >= opts.minQualityScore &&
        (opts.requireBetterOrEqual ? comparison !== 'worse' : true)

      return {
        compId: comp.id,
        comparisonToSubject: comparison,
        confidence: Math.round(score * 0.8), // Heuristic confidence is lower
        isSuitable,
        qualityScore: score,
        reasoning: `Heuristic analysis based on property attributes`,
        keyFeatures: this.extractKeyFeatures(comp),
        concerns: score < 50 ? ['Lower quality score based on attributes'] : [],
      }
    })

    const goodComps = allAnalyses.filter((a) => a.isSuitable)
    const filteredOutComps = allAnalyses.filter((a) => !a.isSuitable)

    // Select best comp
    let bestComp: BestCompResult | null = null
    if (goodComps.length > 0) {
      const sorted = [...goodComps].sort((a, b) => b.qualityScore - a.qualityScore)
      const best = sorted[0]
      bestComp = {
        compId: best.compId,
        selectionReason: 'Selected based on highest quality score (heuristic analysis)',
        confidence: best.confidence,
        keyFactors: best.keyFeatures.slice(0, 3),
      }
    }

    const recommendedArv = this.calculateRecommendedArv(comps, goodComps, bestComp)
    const avgQuality =
      goodComps.length > 0
        ? Math.round(goodComps.reduce((sum, c) => sum + c.qualityScore, 0) / goodComps.length)
        : 0

    return {
      bestComp,
      goodComps,
      filteredOutComps,
      allAnalyses,
      summary: {
        totalCompsAnalyzed: allAnalyses.length,
        compsPassedFilter: goodComps.length,
        compsFilteredOut: filteredOutComps.length,
        averageQualityScore: avgQuality,
        analysisMethod: 'text',
      },
      recommendedArv,
      timing: {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime,
      },
    }
  }

  /**
   * Calculate recommended ARV from selected comps
   */
  private calculateRecommendedArv(
    allComps: CompPropertyData[],
    goodComps: CompAnalysisResult[],
    bestComp: BestCompResult | null
  ): number | null {
    if (goodComps.length === 0) return null

    const goodCompIds = new Set(goodComps.map((c) => c.compId))
    const selectedComps = allComps.filter((c) => goodCompIds.has(c.comparable.id))

    if (selectedComps.length === 0) return null

    // Weight the best comp more heavily
    let totalWeight = 0
    let weightedSum = 0

    for (const comp of selectedComps) {
      const price = comp.comparable.adjustedSalePrice ?? comp.comparable.salePrice ?? 0
      if (price <= 0) continue

      const analysis = goodComps.find((a) => a.compId === comp.comparable.id)
      const qualityWeight = (analysis?.qualityScore ?? 50) / 100

      // Best comp gets 1.5x weight
      const isBest = bestComp?.compId === comp.comparable.id
      const weight = qualityWeight * (isBest ? 1.5 : 1.0)

      weightedSum += price * weight
      totalWeight += weight
    }

    if (totalWeight === 0) return null

    return Math.round(weightedSum / totalWeight)
  }

  /**
   * Extract key features from a comp for display
   */
  private extractKeyFeatures(comp: {
    bedrooms?: number | null
    bathrooms?: number | null
    squareFeet?: number | null
    yearBuilt?: number | null
    propertyType?: string | null
  }): string[] {
    const features: string[] = []

    if (comp.bedrooms && comp.bathrooms) {
      features.push(`${comp.bedrooms}bd/${comp.bathrooms}ba`)
    }
    if (comp.squareFeet) {
      features.push(`${comp.squareFeet.toLocaleString()} sqft`)
    }
    if (comp.yearBuilt) {
      features.push(`Built ${comp.yearBuilt}`)
    }
    if (comp.propertyType) {
      features.push(comp.propertyType)
    }

    return features
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────────

/**
 * Create a new comp selection service instance
 */
export function createCompSelectionService(env: Env): CompSelectionService {
  return new PropertyCompSelectionService(env)
}
