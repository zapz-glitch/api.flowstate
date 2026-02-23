/**
 * Vision Analysis Service Types
 *
 * Types for AI vision-based property photo analysis using OpenRouter.
 * Used to determine comp quality by analyzing property condition.
 */

// ─── Zillow URL Generation ────────────────────────────────────────────────────

export interface ZillowUrlParams {
  address: string
  city: string
  state: string
  zipCode: string
}

export interface ZillowUrl {
  searchUrl: string
  estimatedPropertyUrl: string | null
}

// ─── Property Condition Analysis ──────────────────────────────────────────────

export type ConditionRating = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

export interface PropertyConditionAnalysis {
  /** Overall condition rating */
  overallCondition: ConditionRating
  /** Confidence score 0-100 */
  confidence: number

  /** Exterior analysis */
  exterior: {
    condition: ConditionRating
    notes: string[]
  }

  /** Interior analysis (if photos available) */
  interior?: {
    condition: ConditionRating
    notes: string[]
  }

  /** Specific features assessed */
  features: {
    roofCondition?: ConditionRating
    landscaping?: ConditionRating
    driveway?: ConditionRating
    windows?: ConditionRating
    siding?: ConditionRating
    poolCondition?: ConditionRating
  }

  /** Estimated rehab needs based on photos */
  estimatedRehabNeeds: 'none' | 'cosmetic' | 'moderate' | 'significant' | 'full_renovation'

  /** Summary description */
  summary: string
}

// ─── Comp Comparison Analysis ─────────────────────────────────────────────────

export type ComparisonResult = 'better' | 'similar' | 'worse' | 'unknown'

export interface CompVsSubjectAnalysis {
  /** Comparable property ID */
  compId: string
  /** Subject property ID */
  subjectId: string

  /** Overall comparison result */
  comparison: ComparisonResult
  /** Confidence score 0-100 */
  confidence: number

  /** Detailed comparison */
  details: {
    exteriorComparison: ComparisonResult
    interiorComparison?: ComparisonResult
    conditionComparison: ComparisonResult
    updatesComparison: ComparisonResult
  }

  /** Quality adjustment factor (-1 to 1) */
  qualityAdjustmentFactor: number

  /** Reasoning for the comparison */
  reasoning: string
}

// ─── Vision Analysis Request/Response ─────────────────────────────────────────

export interface VisionAnalysisRequest {
  /** Property photo URLs to analyze */
  photoUrls: string[]
  /** Type of analysis to perform */
  analysisType: 'condition' | 'comparison'
  /** Subject property photos (for comparison) */
  subjectPhotoUrls?: string[]
  /** Property context */
  propertyContext?: {
    address: string
    squareFeet?: number
    yearBuilt?: number
    bedrooms?: number
    bathrooms?: number
  }
}

export interface VisionAnalysisResult {
  success: true
  data: PropertyConditionAnalysis
}

export interface VisionAnalysisError {
  success: false
  error: string
  code?: string
}

export type VisionAnalysisResponse = VisionAnalysisResult | VisionAnalysisError

// ─── Comp Quality Score ───────────────────────────────────────────────────────

export interface CompQualityScore {
  compId: string
  /** Overall quality score 0-100 */
  qualityScore: number
  /** Whether this comp should be weighted higher/lower */
  weightAdjustment: number
  /** Analysis details */
  analysis: PropertyConditionAnalysis | null
  /** Comparison to subject */
  comparison: CompVsSubjectAnalysis | null
  /** Source of analysis */
  analysisSource: 'vision' | 'inferred' | 'none'
}

// ─── Photo Fetching ──────────────────────────────────────────────────────────

export interface FetchedPhotos {
  propertyId: string
  zillowUrl: ZillowUrl
  photos: string[]
  streetViewUrl: string | null
  source: 'zillow' | 'streetview' | 'none'
  error?: string
}
