/**
 * Analysis Job Processor
 *
 * Core job processing logic extracted from analyze.ts route.
 * Processes jobs step-by-step with real-time updates via Durable Object.
 *
 * Uses shared analysis module for consistent behavior with sync endpoint.
 */

import type { Env } from '../types'
import type { AnalysisJobMessage, ProcessingResult } from './types'
import type { AnalysisStep, UpdateStepRequest } from '../durable-objects/types'

import { createPropertyApi, type PropertyBundle } from '../services/property-api'
import {
  createAppraisalService,
  DEFAULT_FILTERS,
  DEFAULT_ADJUSTMENTS,
  type AppraisedComparable,
} from '../services/appraisal'
import { filtersToApiParams } from '../services/appraisal/types'
import { createValuationService } from '../services/valuation'
import { createPhotoService, type PhotoBundle } from '../services/photo-provider'
import {
  createCompSelectionService,
  type SubjectPropertyData,
  type CompPropertyData,
  type CompSelectionResult,
} from '../services/comp-selection'
import {
  selectBestCompFromData,
  buildAnalysisResponse,
} from '../services/analysis'

/**
 * Update step status in the Durable Object
 */
async function updateStep(
  jobDO: DurableObjectStub,
  step: AnalysisStep,
  status: UpdateStepRequest['status'],
  options?: { message?: string; error?: string; fromCache?: boolean }
): Promise<void> {
  const request: UpdateStepRequest = {
    step,
    status,
    ...options,
  }

  await jobDO.fetch(
    new Request('http://internal/step', {
      method: 'POST',
      body: JSON.stringify(request),
    })
  )
}

/**
 * Process an analysis job
 */
export async function processAnalysisJob(
  job: AnalysisJobMessage,
  env: Env,
  jobDO: DurableObjectStub,
  rateLimitDO: DurableObjectStub
): Promise<ProcessingResult> {
  const { request } = job

  try {
    // Initialize services
    const propertyApi = createPropertyApi(env)
    const appraisalService = createAppraisalService()
    const valuationService = createValuationService()
    const photoService = createPhotoService(env)
    const compSelectionService = createCompSelectionService(env)

    const searchOpts = request.searchOptions ?? {}
    const enrichOpts = request.enrichment ?? { permits: true, floodZone: true }
    const photoOpts = request.photoAnalysis ?? {}

    // Get appraisal rules
    const rules = request.appraisalRules ?? {}
    const filters = rules.filters ?? DEFAULT_FILTERS
    const adjustments = rules.adjustments ?? DEFAULT_ADJUSTMENTS
    const apiFilterParams = filtersToApiParams(filters)

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Cache Check
    // ═══════════════════════════════════════════════════════════════════════════
    await updateStep(jobDO, 'cache_check', 'in_progress', {
      message: 'Checking cache for existing data',
    })

    // TODO: Implement full result cache check
    // For now, we rely on component-level caching in PropertyApi
    const hasCachedResult = false

    await updateStep(jobDO, 'cache_check', 'completed', {
      message: hasCachedResult ? 'Full result found in cache' : 'Cache check complete',
      fromCache: hasCachedResult,
    })

    if (hasCachedResult) {
      // Return cached result
      return { success: true, cached: true }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Property Fetch
    // ═══════════════════════════════════════════════════════════════════════════
    await updateStep(jobDO, 'property_fetch', 'in_progress', {
      message: 'Fetching subject property details',
    })

    // Note: PropertyApi.getPropertyBundle fetches property, comps, permits, flood in parallel
    // We'll update those steps as part of the bundle fetch
    const bundleResult = await propertyApi.getPropertyBundle({
      address: request.address,
      streetAddress: request.streetAddress,
      city: request.city,
      state: request.state,
      zipCode: request.zipCode,
      propertyId: request.propertyId,
      comparables: {
        radiusMiles: searchOpts.radiusMiles ?? apiFilterParams.radiusMiles ?? 1,
        maxComps: searchOpts.maxComps ?? 10,
        monthsBack: searchOpts.monthsBack ?? apiFilterParams.monthsBack ?? 12,
        sqftVariance: apiFilterParams.sqftVariance,
      },
      enrichment: {
        permits: enrichOpts.permits ?? true,
        floodZone: enrichOpts.floodZone ?? true,
        weatherRisk: enrichOpts.weatherRisk ?? false,
      },
      skipCache: request.skipCache,
    })

    if (!bundleResult.success) {
      await updateStep(jobDO, 'property_fetch', 'failed', {
        error: bundleResult.error,
      })

      // Set job error
      await jobDO.fetch(
        new Request('http://internal/error', {
          method: 'POST',
          body: JSON.stringify({
            error: {
              code: bundleResult.code || 'PROPERTY_FETCH_ERROR',
              message: bundleResult.error,
              step: 'property_fetch',
              retryable: bundleResult.code !== 'NOT_FOUND',
            },
          }),
        })
      )

      return {
        success: false,
        error: bundleResult.error,
        retryable: bundleResult.code !== 'NOT_FOUND',
      }
    }

    const bundle: PropertyBundle = bundleResult.data

    await updateStep(jobDO, 'property_fetch', 'completed', {
      message: `Property found: ${bundle.property.address}`,
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Comparables Fetch (already done in bundle, mark complete)
    // ═══════════════════════════════════════════════════════════════════════════
    await updateStep(jobDO, 'comparables_fetch', 'in_progress', {
      message: 'Processing comparable properties',
    })

    await updateStep(jobDO, 'comparables_fetch', 'completed', {
      message: `Found ${bundle.comparables.length} comparables`,
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: Permits Fetch (already done in bundle)
    // ═══════════════════════════════════════════════════════════════════════════
    if (enrichOpts.permits) {
      await updateStep(jobDO, 'permits_fetch', 'in_progress', {
        message: 'Processing building permits',
      })

      const permitCount = bundle.enrichment?.permits?.count ?? 0
      await updateStep(jobDO, 'permits_fetch', 'completed', {
        message: `Found ${permitCount} building permits`,
      })
    } else {
      await updateStep(jobDO, 'permits_fetch', 'skipped', {
        message: 'Permits fetch disabled',
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Flood Zone Fetch (already done in bundle)
    // ═══════════════════════════════════════════════════════════════════════════
    if (enrichOpts.floodZone) {
      await updateStep(jobDO, 'flood_fetch', 'in_progress', {
        message: 'Processing flood zone data',
      })

      const floodZone = bundle.enrichment?.floodZone?.floodZone ?? 'Unknown'
      await updateStep(jobDO, 'flood_fetch', 'completed', {
        message: `Flood zone: ${floodZone}`,
      })
    } else {
      await updateStep(jobDO, 'flood_fetch', 'skipped', {
        message: 'Flood zone fetch disabled',
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 6: Apply Appraisal Rules
    // ═══════════════════════════════════════════════════════════════════════════
    await updateStep(jobDO, 'appraisal_rules', 'in_progress', {
      message: 'Applying appraisal filters and adjustments',
    })

    const appraisalResult = appraisalService.evaluateWithFallback(
      bundle.property,
      bundle.comparables,
      {
        filters,
        adjustments,
        minComps: 3,
        maxNearestComps: 5,
      }
    )

    const enabledCount = appraisalResult.comparables.filter((c) => c.isEnabled).length
    await updateStep(jobDO, 'appraisal_rules', 'completed', {
      message: `${enabledCount} comps enabled, ARV: $${appraisalResult.arv.toLocaleString()}`,
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 7: Photo Fetch (if enabled)
    // ═══════════════════════════════════════════════════════════════════════════
    let photoBundle: PhotoBundle | null = null

    if (photoOpts.enabled && photoService.isAvailable()) {
      await updateStep(jobDO, 'photo_fetch', 'in_progress', {
        message: 'Fetching property photos from Zillow',
      })

      const maxPhotoComps = photoOpts.maxComps ?? 10
      const enabledComps = appraisalResult.comparables.filter((c) => c.isEnabled)
      const compsForPhotos = enabledComps.slice(0, maxPhotoComps)

      try {
        photoBundle = await photoService.fetchPhotoBundle(
          {
            propertyId: bundle.property.id,
            address: bundle.property.address,
            city: bundle.property.city,
            state: bundle.property.state,
            zipCode: bundle.property.zipCode,
          },
          compsForPhotos.map((comp) => ({
            propertyId: comp.id,
            address: comp.address,
            city: comp.city,
            state: comp.state,
            zipCode: comp.zipCode,
          })),
          { maxComps: maxPhotoComps }
        )

        const compPhotoCount = Object.keys(photoBundle.comps).length
        await updateStep(jobDO, 'photo_fetch', 'completed', {
          message: `Fetched photos: subject=${!!photoBundle.subject}, ${compPhotoCount} comps`,
        })
      } catch (photoError) {
        const errorMsg = photoError instanceof Error ? photoError.message : 'Unknown error'
        await updateStep(jobDO, 'photo_fetch', 'failed', {
          error: `Photo fetch failed: ${errorMsg}`,
        })
        // Continue without photos - not a critical failure
      }
    } else {
      await updateStep(jobDO, 'photo_fetch', 'skipped', {
        message: photoOpts.enabled ? 'Photo service not available' : 'Photo analysis disabled',
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 8: LLM Comp Selection (if photos available) or Data-Based Selection
    // ═══════════════════════════════════════════════════════════════════════════
    let compSelectionResult: CompSelectionResult | null = null
    let finalArv = appraisalResult.arv
    let arvSource: 'appraisal' | 'comp-selection' = 'appraisal'
    let bestCompId: string | null = null
    let selectedCompIds: string[] = []
    let dataBasedScores: Map<string, number> = new Map()

    if (photoOpts.enabled && photoBundle?.subject) {
      await updateStep(jobDO, 'comp_selection', 'in_progress', {
        message: 'Running LLM-based comp selection',
      })

      const maxComps = photoOpts.maxComps ?? 10
      const enabledComps = appraisalResult.comparables.filter((c) => c.isEnabled)
      const compsToAnalyze = enabledComps.slice(0, maxComps)

      try {
        const subjectData: SubjectPropertyData = {
          property: bundle.property,
          photos: photoBundle.subject.photos,
          description: photoBundle.subject.description,
        }

        const compsData: CompPropertyData[] = compsToAnalyze.map((comp) => {
          const compPhotos = photoBundle?.comps[comp.id]
          return {
            comparable: comp,
            photos: compPhotos?.photos ?? [],
            description: compPhotos?.description,
          }
        })

        compSelectionResult = await compSelectionService.selectBestComps(
          subjectData,
          compsData,
          {
            maxComps: maxComps,
            useVision: true,
            requireBetterOrEqual: photoOpts.requireBetterOrEqual ?? true,
          }
        )

        if (compSelectionResult.recommendedArv) {
          finalArv = compSelectionResult.recommendedArv
          arvSource = 'comp-selection'
        }

        if (compSelectionResult.bestComp) {
          bestCompId = compSelectionResult.bestComp.compId
        }
        selectedCompIds = compSelectionResult.goodComps.map((c) => c.compId)

        await updateStep(jobDO, 'comp_selection', 'completed', {
          message: `Selected ${compSelectionResult.summary.compsPassedFilter} suitable comps`,
        })
      } catch (selectionError) {
        const errorMsg = selectionError instanceof Error ? selectionError.message : 'Unknown error'
        await updateStep(jobDO, 'comp_selection', 'failed', {
          error: `Comp selection failed: ${errorMsg}`,
        })
        // Continue with appraisal-based ARV
      }
    } else {
      // No LLM selection - use data-based best comp selection
      const enabledComps = appraisalResult.comparables.filter((c) => c.isEnabled)
      const { bestCompId: dataBestCompId, scores } = selectBestCompFromData(
        enabledComps,
        bundle.property.squareFeet,
        bundle.property.yearBuilt
      )
      bestCompId = dataBestCompId
      dataBasedScores = scores

      await updateStep(jobDO, 'comp_selection', 'completed', {
        message: `Selected best comp from ${enabledComps.length} comps (data-based)`,
      })
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 9: Valuation Calculation
    // ═══════════════════════════════════════════════════════════════════════════
    await updateStep(jobDO, 'valuation', 'in_progress', {
      message: 'Calculating valuation metrics',
    })

    const buybox = request.buybox ?? {}
    const subjectSqft = bundle.property.squareFeet || 0

    let compsForSqft: AppraisedComparable[] = appraisalResult.comparables.filter((c) => c.isEnabled)
    if (selectedCompIds.length > 0) {
      const selectedSet = new Set(selectedCompIds)
      compsForSqft = appraisalResult.comparables.filter((c) => selectedSet.has(c.id))
    }

    const compAvgSqft =
      compsForSqft.length > 0
        ? compsForSqft.reduce((sum, c) => sum + (c.squareFeet || 0), 0) / compsForSqft.length
        : subjectSqft

    const valuation = valuationService.calculateValuation({
      arv: finalArv,
      subjectSqft,
      compAvgSqft,
      rehabLevelIndex: buybox.rehabLevelIndex ?? 2,
      majorItems: buybox.majorItems,
      additionPlay: buybox.additionPlay ?? 0,
      closingCostsPercent: buybox.closingCostsPercent ?? 10,
      carryingCostsPercent: buybox.carryingCostsPercent ?? 5,
      wholesaleFee: buybox.wholesaleFee ?? 10000,
      desiredProfit: buybox.desiredProfit,
    })

    await updateStep(jobDO, 'valuation', 'completed', {
      message: `ARV: $${finalArv.toLocaleString()}, Buy: $${valuation.buyPrice.toLocaleString()}`,
    })

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 10: Response Build (Simplified Underwriter Format)
    // ═══════════════════════════════════════════════════════════════════════════
    await updateStep(jobDO, 'response_build', 'in_progress', {
      message: 'Building analysis response',
    })

    // Build response using shared function (same as sync endpoint)
    const result = buildAnalysisResponse(
      bundle,
      appraisalResult,
      photoBundle,
      compSelectionResult,
      valuation,
      {
        arvSource,
        finalArv,
        bestCompId,
        selectedCompIds,
        dataBasedScores,
        analysisId: job.jobId,
      }
    )

    // Store result in DO (the result is the simplified underwriter format)
    await jobDO.fetch(
      new Request('http://internal/result', {
        method: 'POST',
        body: JSON.stringify({ result }),
      })
    )

    await updateStep(jobDO, 'response_build', 'completed', {
      message: 'Analysis complete',
    })

    return { success: true, cached: false }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[Processor] Job ${job.jobId} failed:`, errorMessage)

    // Set job error
    await jobDO.fetch(
      new Request('http://internal/error', {
        method: 'POST',
        body: JSON.stringify({
          error: {
            code: 'PROCESSING_ERROR',
            message: errorMessage,
            retryable: true,
          },
        }),
      })
    )

    return {
      success: false,
      error: errorMessage,
      retryable: true,
    }
  }
}
