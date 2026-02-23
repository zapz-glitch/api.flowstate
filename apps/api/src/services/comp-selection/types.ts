/**
 * Comp Selection Types
 *
 * Types for LLM-based comparable property selection and analysis.
 * Used to identify the best comps for ARV calculation.
 */

import type { NormalizedProperty, NormalizedComparable } from '../property-api/types'
import type { ZillowListingData } from '../photo-provider'
import type { AppraisedComparable } from '../appraisal/types'

// ─── Input Types ──────────────────────────────────────────────────────────────

/**
 * Subject property data for comp selection analysis
 */
export interface SubjectPropertyData {
  property: NormalizedProperty
  /** Zillow listing data with photos and description */
  zillowData?: ZillowListingData
  /** Photo URLs (from Zillow or other source) */
  photos: string[]
  /** Property description */
  description?: string
}

/**
 * Comparable property data for selection analysis
 */
export interface CompPropertyData {
  /** The appraised comparable with evaluation results */
  comparable: AppraisedComparable
  /** Zillow listing data with photos and description */
  zillowData?: ZillowListingData
  /** Photo URLs (from Zillow or other source) */
  photos: string[]
  /** Property description */
  description?: string
}

// ─── Output Types ─────────────────────────────────────────────────────────────

/**
 * Comparison result between a comp and the subject property
 */
export type ComparisonRating = 'better' | 'similar' | 'worse' | 'unknown'

/**
 * Individual comp analysis result from LLM
 */
export interface CompAnalysisResult {
  compId: string
  /**
   * How this comp compares to the subject property
   * - 'better': Comp is in better condition than subject (higher quality)
   * - 'similar': Comp is in similar condition to subject
   * - 'worse': Comp is in worse condition than subject (lower quality)
   * - 'unknown': Unable to determine comparison
   */
  comparisonToSubject: ComparisonRating
  /** Confidence score 0-100 */
  confidence: number
  /** Whether this comp is suitable for ARV calculation */
  isSuitable: boolean
  /** Quality score 0-100 based on photos and description */
  qualityScore: number
  /** Reasoning for the analysis */
  reasoning: string
  /** Key features noted */
  keyFeatures: string[]
  /** Concerns or issues identified */
  concerns: string[]
}

/**
 * Best comp selection result
 */
export interface BestCompResult {
  /** The comp ID of the best comparable */
  compId: string
  /** Why this comp was selected as best */
  selectionReason: string
  /** Confidence in the selection 0-100 */
  confidence: number
  /** Key factors that made this the best comp */
  keyFactors: string[]
}

/**
 * Complete comp selection result from LLM analysis
 */
export interface CompSelectionResult {
  /** The single best comparable for this subject */
  bestComp: BestCompResult | null
  /** Other good comps suitable for ARV calculation (sorted by suitability) */
  goodComps: CompAnalysisResult[]
  /** Comps that were filtered out (worse than subject or not suitable) */
  filteredOutComps: CompAnalysisResult[]
  /** All comp analyses */
  allAnalyses: CompAnalysisResult[]
  /** Summary of the analysis */
  summary: {
    totalCompsAnalyzed: number
    compsPassedFilter: number
    compsFilteredOut: number
    averageQualityScore: number
    analysisMethod: 'vision' | 'text' | 'hybrid'
  }
  /** Recommended ARV based on selected comps */
  recommendedArv: number | null
  /** Usage metrics from LLM */
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
  /** Timing information */
  timing?: {
    startTime: number
    endTime: number
    durationMs: number
  }
}

// ─── Service Options ──────────────────────────────────────────────────────────

/**
 * Options for comp selection analysis
 */
export interface CompSelectionOptions {
  /** Maximum number of comps to analyze (default: 10) */
  maxComps?: number
  /** Whether to use vision analysis for photos (default: true) */
  useVision?: boolean
  /** Minimum confidence threshold for best comp selection (default: 60) */
  minConfidence?: number
  /** Minimum quality score to be considered suitable (default: 40) */
  minQualityScore?: number
  /** Whether comps must be better than or equal to subject (default: true) */
  requireBetterOrEqual?: boolean
}

/**
 * Default options for comp selection
 */
export const DEFAULT_COMP_SELECTION_OPTIONS: Required<CompSelectionOptions> = {
  maxComps: 10,
  useVision: true,
  minConfidence: 60,
  minQualityScore: 40,
  requireBetterOrEqual: true,
}
