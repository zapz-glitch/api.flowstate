/**
 * Classification Keywords
 *
 * Keywords used to identify As-Is vs After-Renovation properties
 * from property descriptions.
 */

/**
 * Keywords indicating an As-Is / Investment property
 * These suggest the property needs work or is being sold to investors
 */
export const AS_IS_KEYWORDS = [
  // Investment-focused
  'investor special',
  'handyman special',
  'fixer upper',
  'fixer-upper',
  'investment opportunity',
  'investor opportunity',
  'cash only',
  'cash buyers',
  'no fha',
  'no va',
  'no financing',

  // Sale conditions
  'as-is',
  'as is',
  'sold as-is',
  'where is',
  'estate sale',
  'probate',
  'foreclosure',
  'reo',
  'bank owned',
  'short sale',
  'distressed',

  // Condition indicators
  'needs work',
  'needs updating',
  'needs renovation',
  'needs tlc',
  'needs repairs',
  'needs rehab',
  'needs some love',
  'fixer',

  // Marketing language
  'motivated seller',
  'must sell',
  'priced to sell',
  'potential',
  'bring your vision',
  'make it your own',
  'diamond in the rough',
  'great bones',
  'good bones',
  'solid bones',

  // Age/condition descriptors
  'original',
  'vintage',
  'retro',
  'classic',
  'cosmetic',
  'dated',
  'older home',
]

/**
 * Keywords indicating an After-Renovation / Turnkey property
 * These suggest the property has been recently updated and is retail-ready
 */
export const AFTER_RENOVATION_KEYWORDS = [
  // Renovation indicators
  'renovated',
  'remodeled',
  'updated',
  'upgraded',
  'restored',
  'refreshed',
  'newly renovated',
  'completely renovated',
  'fully renovated',
  'gut renovation',
  'gut rehab',

  // Retail-ready indicators
  'turnkey',
  'turn key',
  'turn-key',
  'move-in ready',
  'move in ready',
  'nothing to do',
  'just move in',

  // Specific updates
  'new kitchen',
  'new bath',
  'new bathroom',
  'new bathrooms',
  'new roof',
  'new hvac',
  'new a/c',
  'new ac',
  'new flooring',
  'new floors',
  'new appliances',
  'new windows',
  'new plumbing',
  'new electrical',
  'new water heater',

  // Quality descriptors
  'modern',
  'contemporary',
  'designer',
  'custom',
  'luxury',
  'upscale',
  'high-end',
  'premium',
  'showroom',

  // Finish indicators
  'freshly painted',
  'fresh paint',
  'new paint',
  'stainless steel',
  'granite',
  'quartz',
  'marble',
  'hardwood',
  'lvp',
  'luxury vinyl',
  'tile floors',

  // Layout/design
  'open concept',
  'open floor plan',
  'open layout',

  // Technology/efficiency
  'smart home',
  'energy efficient',
  'solar',
  'tankless',

  // Condition descriptors
  'like new',
  'better than new',
  'mint condition',
  'pristine',
  'immaculate',
  'spotless',
]

/**
 * Analyze description for classification keywords
 * Returns a score from -100 (strong as-is) to +100 (strong after-renovation)
 */
export function analyzeDescriptionKeywords(description: string): {
  score: number
  asIsKeywords: string[]
  afterRenovationKeywords: string[]
  investmentIndicators: boolean
  retailReadyIndicators: boolean
} {
  const lowerDesc = description.toLowerCase()

  // Find matching keywords
  const asIsKeywords: string[] = []
  const afterRenovationKeywords: string[] = []

  for (const keyword of AS_IS_KEYWORDS) {
    if (lowerDesc.includes(keyword)) {
      asIsKeywords.push(keyword)
    }
  }

  for (const keyword of AFTER_RENOVATION_KEYWORDS) {
    if (lowerDesc.includes(keyword)) {
      afterRenovationKeywords.push(keyword)
    }
  }

  // Calculate score
  // Weight certain keywords more heavily
  const asIsScore = asIsKeywords.length * 15
  const afterRenoScore = afterRenovationKeywords.length * 15

  // Strong indicators get extra weight
  const strongAsIsIndicators = ['investor special', 'handyman special', 'as-is', 'fixer', 'needs work']
  const strongAfterRenoIndicators = ['renovated', 'remodeled', 'turnkey', 'move-in ready']

  let bonusAsIs = 0
  let bonusAfterReno = 0

  for (const keyword of strongAsIsIndicators) {
    if (asIsKeywords.includes(keyword)) {
      bonusAsIs += 20
    }
  }

  for (const keyword of strongAfterRenoIndicators) {
    if (afterRenovationKeywords.includes(keyword)) {
      bonusAfterReno += 20
    }
  }

  // Calculate final score (-100 to +100)
  const rawScore = (afterRenoScore + bonusAfterReno) - (asIsScore + bonusAsIs)
  const score = Math.max(-100, Math.min(100, rawScore))

  return {
    score,
    asIsKeywords,
    afterRenovationKeywords,
    investmentIndicators: asIsKeywords.length > 0,
    retailReadyIndicators: afterRenovationKeywords.length > 0,
  }
}
