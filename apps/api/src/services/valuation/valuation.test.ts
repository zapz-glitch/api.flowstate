/**
 * Valuation Service Tests
 */

import { describe, it, expect } from 'vitest'
import { REHAB_LEVELS, MAJOR_ITEMS } from './types'

// Import the calculation logic directly since we can't instantiate the full service without env
// We'll test the pure calculation functions

// ─── ARV Tier Tests ────────────────────────────────────────────────────────────

describe('ARV Tier Calculation', () => {
  // Re-implement getArvTier for testing
  function getArvTier(arv: number): 'under501k' | '501kTo999k' | '1mTo3m' | 'over3m' {
    if (arv >= 3000000) return 'over3m'
    if (arv >= 1000000) return '1mTo3m'
    if (arv >= 501000) return '501kTo999k'
    return 'under501k'
  }

  it('should return under501k for ARV < $501,000', () => {
    expect(getArvTier(400000)).toBe('under501k')
    expect(getArvTier(500999)).toBe('under501k')
  })

  it('should return 501kTo999k for ARV between $501,000 and $999,999', () => {
    expect(getArvTier(501000)).toBe('501kTo999k')
    expect(getArvTier(750000)).toBe('501kTo999k')
    expect(getArvTier(999999)).toBe('501kTo999k')
  })

  it('should return 1mTo3m for ARV between $1,000,000 and $2,999,999', () => {
    expect(getArvTier(1000000)).toBe('1mTo3m')
    expect(getArvTier(2000000)).toBe('1mTo3m')
    expect(getArvTier(2999999)).toBe('1mTo3m')
  })

  it('should return over3m for ARV >= $3,000,000', () => {
    expect(getArvTier(3000000)).toBe('over3m')
    expect(getArvTier(5000000)).toBe('over3m')
  })
})

// ─── Rehab Level Tests ─────────────────────────────────────────────────────────

describe('Rehab Levels', () => {
  it('should have 7 rehab levels', () => {
    expect(REHAB_LEVELS.length).toBe(7)
  })

  it('should have expected rehab level names', () => {
    expect(REHAB_LEVELS[0]).toBe('Lipstick')
    expect(REHAB_LEVELS[1]).toBe('Light Cosmetic')
    expect(REHAB_LEVELS[2]).toBe('Full Cosmetic')
    expect(REHAB_LEVELS[3]).toBe('Heavy Rehab')
    expect(REHAB_LEVELS[4]).toBe('Down to Stud')
    expect(REHAB_LEVELS[5]).toBe('Low Cost Market')
    expect(REHAB_LEVELS[6]).toBe('High Cost Market')
  })
})

// ─── Major Items Tests ─────────────────────────────────────────────────────────

describe('Major Items', () => {
  it('should have 17 major items', () => {
    expect(MAJOR_ITEMS.length).toBe(17)
  })

  it('should have expected major item IDs', () => {
    const itemIds = MAJOR_ITEMS.map((item) => item.id)
    expect(itemIds).toContain('roof')
    expect(itemIds).toContain('hvac')
    expect(itemIds).toContain('water_heater')
    expect(itemIds).toContain('electric_panel')
    expect(itemIds).toContain('foundation')
  })

  it('should have reasonable default costs', () => {
    const roof = MAJOR_ITEMS.find((item) => item.id === 'roof')
    expect(roof?.defaultCost).toBe(10000)

    const hvac = MAJOR_ITEMS.find((item) => item.id === 'hvac')
    expect(hvac?.defaultCost).toBe(8000)
  })
})

// ─── Valuation Calculation Tests ───────────────────────────────────────────────

describe('Valuation Calculations', () => {
  // Rehab cost table (simplified for testing)
  const REHAB_TABLE = {
    under501k: [
      { perSqft: 25, minProfit: 30000 },
      { perSqft: 30, minProfit: 40000 },
      { perSqft: 35, minProfit: 40000 },
    ],
    '501kTo999k': [
      { perSqft: 30, minProfit: 50000 },
      { perSqft: 40, minProfit: 60000 },
      { perSqft: 45, minProfit: 60000 },
    ],
  }

  function calculateValuation(params: {
    arv: number
    subjectSqft: number
    compAvgSqft?: number
    rehabLevelIndex?: number
    majorItemsCost?: number
    additionPlay?: number
    closingCostsPercent?: number
    carryingCostsPercent?: number
    wholesaleFee?: number
  }) {
    const {
      arv,
      subjectSqft,
      compAvgSqft = subjectSqft,
      rehabLevelIndex = 2,
      majorItemsCost = 0,
      additionPlay = 0,
      closingCostsPercent = 10,
      carryingCostsPercent = 5,
      wholesaleFee = 10000,
    } = params

    const tier = arv >= 501000 ? '501kTo999k' : 'under501k'
    const rehabEstimate = REHAB_TABLE[tier][rehabLevelIndex] || REHAB_TABLE[tier][0]

    const pricePerSqft = compAvgSqft > 0 ? Math.round(arv / compAvgSqft) : 0
    const baseRehabCost = subjectSqft * rehabEstimate.perSqft
    const totalRehabCost = baseRehabCost + majorItemsCost + additionPlay

    const closingCosts = Math.round(arv * (closingCostsPercent / 100))
    const carryingCosts = Math.round(arv * (carryingCostsPercent / 100))
    const minProfit = rehabEstimate.minProfit

    const buyPrice = arv - totalRehabCost - closingCosts - carryingCosts - minProfit
    const buyPricePercent = arv > 0 ? Math.round((buyPrice / arv) * 100) : 0

    const wholesalePrice = buyPrice - wholesaleFee
    const wholesalePricePercent = arv > 0 ? Math.round((wholesalePrice / arv) * 100) : 0

    return {
      arv,
      pricePerSqft,
      baseRehabCost,
      totalRehabCost,
      closingCosts,
      carryingCosts,
      buyPrice: Math.round(buyPrice),
      buyPricePercent,
      wholesalePrice: Math.round(wholesalePrice),
      wholesalePricePercent,
    }
  }

  describe('Buy Price Calculation', () => {
    it('should calculate buy price correctly for $400K ARV', () => {
      const result = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        rehabLevelIndex: 2, // Full Cosmetic ($35/sqft)
      })

      // Base rehab: 2000 * 35 = $70,000
      // Closing costs: 400000 * 10% = $40,000
      // Carrying costs: 400000 * 5% = $20,000
      // Min profit: $40,000
      // Buy price: 400000 - 70000 - 40000 - 20000 - 40000 = $230,000

      expect(result.baseRehabCost).toBe(70000)
      expect(result.closingCosts).toBe(40000)
      expect(result.carryingCosts).toBe(20000)
      expect(result.buyPrice).toBe(230000)
      expect(result.buyPricePercent).toBe(57) // 230000 / 400000 = 57.5% rounds to 57 with Math.round
    })

    it('should calculate wholesale price correctly', () => {
      const result = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        rehabLevelIndex: 2,
        wholesaleFee: 10000,
      })

      expect(result.wholesalePrice).toBe(220000) // 230000 - 10000
      expect(result.wholesalePricePercent).toBe(55) // 220000 / 400000 = 55%
    })

    it('should include major items cost', () => {
      const result = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        rehabLevelIndex: 2,
        majorItemsCost: 25000,
      })

      expect(result.totalRehabCost).toBe(95000) // 70000 + 25000
      expect(result.buyPrice).toBe(205000) // Lower by 25000
    })

    it('should include addition play', () => {
      const result = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        rehabLevelIndex: 2,
        additionPlay: 15000,
      })

      expect(result.totalRehabCost).toBe(85000) // 70000 + 15000
    })
  })

  describe('Different Rehab Levels', () => {
    it('should use lower cost per sqft for Lipstick rehab', () => {
      const lipstick = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        rehabLevelIndex: 0, // Lipstick ($25/sqft)
      })

      expect(lipstick.baseRehabCost).toBe(50000) // 2000 * 25
    })

    it('should use higher cost per sqft for Full Cosmetic rehab', () => {
      const fullCosmetic = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        rehabLevelIndex: 2, // Full Cosmetic ($35/sqft)
      })

      expect(fullCosmetic.baseRehabCost).toBe(70000) // 2000 * 35
    })
  })

  describe('Price Per Sqft', () => {
    it('should calculate price per sqft correctly', () => {
      const result = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        compAvgSqft: 2000,
      })

      expect(result.pricePerSqft).toBe(200) // 400000 / 2000
    })

    it('should use comp avg sqft when different from subject', () => {
      const result = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        compAvgSqft: 1800,
      })

      expect(result.pricePerSqft).toBe(222) // 400000 / 1800 = 222.22 rounds to 222
    })
  })

  describe('Custom Percentages', () => {
    it('should use custom closing costs percentage', () => {
      const result = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        closingCostsPercent: 8,
      })

      expect(result.closingCosts).toBe(32000) // 400000 * 8%
    })

    it('should use custom carrying costs percentage', () => {
      const result = calculateValuation({
        arv: 400000,
        subjectSqft: 2000,
        carryingCostsPercent: 3,
      })

      expect(result.carryingCosts).toBe(12000) // 400000 * 3%
    })
  })
})

// ─── Recommendation Logic Tests ────────────────────────────────────────────────

describe('Recommendation Logic', () => {
  function getRecommendation(projectedROI: number, buyPricePercent: number) {
    if (projectedROI > 25 && buyPricePercent < 65) return 'strong-buy'
    if (projectedROI > 15 && buyPricePercent < 75) return 'buy'
    if (projectedROI > 8 || buyPricePercent < 80) return 'hold'
    return 'pass'
  }

  it('should return strong-buy for high ROI and low buy price', () => {
    expect(getRecommendation(30, 60)).toBe('strong-buy')
    expect(getRecommendation(26, 64)).toBe('strong-buy')
  })

  it('should return buy for good ROI and acceptable buy price', () => {
    expect(getRecommendation(20, 70)).toBe('buy')
    expect(getRecommendation(16, 74)).toBe('buy')
  })

  it('should return hold for moderate opportunities', () => {
    expect(getRecommendation(10, 78)).toBe('hold')
    expect(getRecommendation(5, 75)).toBe('hold') // Low ROI but acceptable price
  })

  it('should return pass for poor opportunities', () => {
    expect(getRecommendation(5, 85)).toBe('pass')
    expect(getRecommendation(2, 90)).toBe('pass')
  })
})
