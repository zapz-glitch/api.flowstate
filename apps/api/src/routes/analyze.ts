/**
 * Property Analysis Route
 *
 * Single endpoint for complete property analysis including:
 * - Property lookup with enrichment (CoreLogic + permits + flood)
 * - Comparables with appraisal rules (filters & adjustments)
 * - Photo fetching via modular PhotoProvider (Zillow, MLS, etc.)
 * - LLM-based comp selection (identifies best comps for ARV)
 * - ARV calculation from selected comps
 * - Valuation with rehab costs and buy price analysis
 *
 * Modular Flow:
 * 1. PropertyApi.getPropertyBundle() - fetches property, comps, enrichment
 * 2. PhotoProvider.fetchPhotoBundle() - fetches photos from any source
 * 3. AppraisalService.evaluate() - applies filters & adjustments to comps
 * 4. CompSelectionService.selectBestComps() - LLM analyzes comps to select best matches
 * 5. ValuationService.calculate() - computes buy price and investment metrics
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import type { AuthContext } from '../middleware/auth'
import { createPropertyApi, type PropertyBundle } from '../services/property-api'
import {
  createAppraisalService,
  DEFAULT_FILTERS,
  DEFAULT_ADJUSTMENTS,
  type AppraisalFilter,
  type AppraisalAdjustment,
  type AppraisedComparable,
} from '../services/appraisal'
import { filtersToApiParams } from '../services/appraisal/types'
import {
  createValuationService,
  REHAB_LEVELS,
  MAJOR_ITEMS,
  type MajorItem,
} from '../services/valuation'
import { createVisionService } from '../services/vision'
import {
  createPhotoService,
  type PhotoBundle,
} from '../services/photo-provider'
import {
  createCompSelectionService,
  type SubjectPropertyData,
  type CompPropertyData,
  type CompSelectionResult,
} from '../services/comp-selection'
import type { AnalysisJobMessage } from '../queues/types'
import { QueuePriority } from '../queues/types'
import type { QueueJobResponse, JobStatusResponse } from '../durable-objects/types'
import { generateWsToken } from '../utils/ws-token'
import {
  selectBestCompFromData,
  buildAnalysisResponse,
} from '../services/analysis'

type Variables = { auth: AuthContext }

// ─── Helper Functions ─────────────────────────────────────────────────────────

/**
 * Generate a unique job ID
 */
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`
}

/**
 * Normalize property key for DO identification
 */
function normalizePropertyKey(request: AnalyzeRequest): string {
  if (request.propertyId) {
    return `pid:${request.propertyId}`
  }

  // Create a hash of the address components
  const addressParts = [
    request.address || request.streetAddress || '',
    request.city || '',
    request.state || '',
    request.zipCode || '',
  ]
    .map((s) => s.toLowerCase().trim())
    .join('|')

  // Use a simple hash for the key
  let hash = 0
  for (let i = 0; i < addressParts.length; i++) {
    const char = addressParts.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `addr:${Math.abs(hash).toString(36)}`
}

const analyze = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─── Request Types ─────────────────────────────────────────────────────────────

interface AnalyzeRequest {
  // Property identification (one of these required)
  address?: string
  streetAddress?: string
  city?: string
  state?: string
  zipCode?: string
  propertyId?: string

  // Comparable search options
  searchOptions?: {
    radiusMiles?: number
    maxComps?: number
    monthsBack?: number
  }

  // Appraisal rules preset
  appraisalRules?: {
    filters?: AppraisalFilter[]
    adjustments?: AppraisalAdjustment[]
  }

  // Buybox parameters
  buybox?: {
    rehabLevelIndex?: number
    majorItems?: MajorItem[]
    additionPlay?: number
    closingCostsPercent?: number
    carryingCostsPercent?: number
    wholesaleFee?: number
    desiredProfit?: number
  }

  // Enrichment options
  enrichment?: {
    permits?: boolean
    floodZone?: boolean
    weatherRisk?: boolean
  }

  // Photo analysis options
  photoAnalysis?: {
    /** Enable photo fetching and AI vision analysis */
    enabled?: boolean
    /** Photo provider to use (auto-detected if not specified) */
    provider?: 'zillow' | 'mls' | 'redfin'
    /** Max comps to fetch photos for (default: 10) */
    maxComps?: number
    /** Require comps to be better than or equal to subject (default: true) */
    requireBetterOrEqual?: boolean
  }

  /**
   * Zillow URL Context options (via Gemini URL Context tool)
   *
   * When enabled, fetches property data from Zillow using Gemini's URL context
   * capability. This provides photos, description, price history, and features.
   *
   * Note: This uses Gemini for web page understanding, NOT for vision analysis.
   * Vision analysis (photo comparison) uses OpenRouter.
   */
  zillowContext?: {
    /** Enable Zillow URL context fetching via Gemini */
    enabled?: boolean
    /** Skip cache and fetch fresh data from Gemini */
    skipCache?: boolean
    /** Max comps to fetch Zillow data for (default: 10) */
    maxComps?: number
  }

  /** Skip cache and fetch fresh data from APIs */
  skipCache?: boolean
}

// ─── Main Endpoint ─────────────────────────────────────────────────────────────

/**
 * POST /analyze
 *
 * Complete property analysis endpoint with LLM-based comp selection
 */
analyze.post('/', async (c) => {
  try {
    const body = await c.req.json<AnalyzeRequest>()

    // Validate input
    if (!body.address && !body.streetAddress && !body.propertyId) {
      return c.json(
        { success: false, error: 'address, streetAddress, or propertyId is required' },
        400
      )
    }

    // Initialize services
    const propertyApi = createPropertyApi(c.env)
    const appraisalService = createAppraisalService()
    const valuationService = createValuationService()
    const visionService = createVisionService(c.env)
    const photoService = createPhotoService(c.env)
    const compSelectionService = createCompSelectionService(c.env)

    const searchOpts = body.searchOptions ?? {}
    const enrichOpts = body.enrichment ?? { permits: true, floodZone: true }
    const photoOpts = body.photoAnalysis ?? {}
    const zillowOpts = body.zillowContext ?? {}

    // Get appraisal rules early so we can extract API-level filter params
    const rules = body.appraisalRules ?? {}
    const filters = rules.filters ?? DEFAULT_FILTERS
    const adjustments = rules.adjustments ?? DEFAULT_ADJUSTMENTS

    // Extract API-level filter params from appraisal rules
    // This passes sqftVariance, radiusMiles, monthsBack to the API query
    // so we get pre-filtered comps instead of filtering everything post-fetch
    const apiFilterParams = filtersToApiParams(filters)

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 1: Get property data via PropertyApi.getPropertyBundle()
    // ═══════════════════════════════════════════════════════════════════════════
    const bundleResult = await propertyApi.getPropertyBundle({
      address: body.address,
      streetAddress: body.streetAddress,
      city: body.city,
      state: body.state,
      zipCode: body.zipCode,
      propertyId: body.propertyId,
      comparables: {
        // Use explicit searchOptions if provided, otherwise fall back to appraisal filter values
        radiusMiles: searchOpts.radiusMiles ?? apiFilterParams.radiusMiles ?? 1,
        maxComps: searchOpts.maxComps ?? 10,
        monthsBack: searchOpts.monthsBack ?? apiFilterParams.monthsBack ?? 12,
        // Pass sqftVariance from appraisal filters to pre-filter comps at API level
        sqftVariance: apiFilterParams.sqftVariance,
      },
      enrichment: {
        permits: enrichOpts.permits ?? true,
        floodZone: enrichOpts.floodZone ?? true,
        weatherRisk: enrichOpts.weatherRisk ?? false,
      },
      // Skip cache if requested (forces fresh data from APIs)
      skipCache: body.skipCache,
    })

    if (!bundleResult.success) {
      console.error('Property bundle fetch failed:', {
        error: bundleResult.error,
        code: bundleResult.code,
        address: body.address,
        propertyId: body.propertyId,
      })
      return c.json(
        { success: false, error: bundleResult.error, code: bundleResult.code },
        bundleResult.code === 'NOT_FOUND' ? 404 : 500
      )
    }

    const bundle: PropertyBundle = bundleResult.data
    const property = bundle.property
    const comparables = bundle.comparables

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 2: Apply appraisal rules (pure data evaluation)
    // ═══════════════════════════════════════════════════════════════════════════
    // Note: rules, filters, and adjustments are already defined above for API params

    const appraisalResult = appraisalService.evaluateWithFallback(property, comparables, {
      filters,
      adjustments,
      minComps: 3,
      maxNearestComps: 5,
    })

    // Generate Zillow URLs for all comps (for reference links)
    const zillowUrls = visionService.getCompZillowUrls(appraisalResult.comparables)

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 3: Fetch Zillow data via Gemini URL Context (if enabled)
    //
    // Note: This uses Gemini's URL context tool for web page understanding,
    // NOT vision analysis. Vision analysis (photo comparison) uses OpenRouter.
    // ═══════════════════════════════════════════════════════════════════════════
    let photoBundle: PhotoBundle | null = null

    // Zillow data fetching is controlled by zillowContext.enabled
    // (photoOpts.enabled is deprecated but still supported for backwards compatibility)
    const shouldFetchZillow = zillowOpts.enabled ?? photoOpts.enabled

    if (shouldFetchZillow && photoService.isAvailable()) {
      const maxPhotoComps = zillowOpts.maxComps ?? photoOpts.maxComps ?? 10
      const enabledComps = appraisalResult.comparables.filter((c) => c.isEnabled)
      const compsForPhotos = enabledComps.slice(0, maxPhotoComps)

      try {
        photoBundle = await photoService.fetchPhotoBundle(
          {
            propertyId: property.id,
            address: property.address,
            city: property.city,
            state: property.state,
            zipCode: property.zipCode,
          },
          compsForPhotos.map((comp) => ({
            propertyId: comp.id,
            address: comp.address,
            city: comp.city,
            state: comp.state,
            zipCode: comp.zipCode,
          })),
          {
            maxComps: maxPhotoComps,
            // Pass skipCache from zillowContext options
            skipCache: zillowOpts.skipCache,
          }
        )

        console.log(`[Analyze] Zillow data fetched via Gemini URL Context: subject=${!!photoBundle.subject}, comps=${Object.keys(photoBundle.comps).length}`)
      } catch (photoError) {
        // Fail gracefully - continue analysis without Zillow data
        console.error('[Analyze] Zillow data fetching failed, continuing without:', {
          error: photoError instanceof Error ? photoError.message : 'Unknown error',
          stack: photoError instanceof Error ? photoError.stack : undefined,
        })
        photoBundle = null
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 4: LLM-based comp selection (if photos available) or Data-Based Selection
    // ═══════════════════════════════════════════════════════════════════════════
    let compSelectionResult: CompSelectionResult | null = null
    let finalArv = appraisalResult.arv
    let arvSource: 'appraisal' | 'comp-selection' = 'appraisal'
    let bestCompId: string | null = null
    let selectedCompIds: string[] = []
    let dataBasedScores: Map<string, number> = new Map()

    if (photoOpts.enabled && photoBundle?.subject) {
      const maxComps = photoOpts.maxComps ?? 10
      const enabledComps = appraisalResult.comparables.filter((c) => c.isEnabled)
      const compsToAnalyze = enabledComps.slice(0, maxComps)

      console.log(`[Analyze] Running LLM comp selection for ${compsToAnalyze.length} comps`)

      try {
        // Build data for LLM comp selection
        const subjectData: SubjectPropertyData = {
          property,
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

        // Run LLM-based comp selection
        compSelectionResult = await compSelectionService.selectBestComps(subjectData, compsData, {
          maxComps: maxComps,
          useVision: true,
          requireBetterOrEqual: photoOpts.requireBetterOrEqual ?? true,
        })

        console.log(`[Analyze] Comp selection complete: ${compSelectionResult.summary.compsPassedFilter} suitable comps found`)

        // Use the LLM-selected ARV if available
        if (compSelectionResult.recommendedArv) {
          finalArv = compSelectionResult.recommendedArv
          arvSource = 'comp-selection'
        }

        // Track selected comps
        if (compSelectionResult.bestComp) {
          bestCompId = compSelectionResult.bestComp.compId
        }
        selectedCompIds = compSelectionResult.goodComps.map((c) => c.compId)
      } catch (compSelectionError) {
        // Fail gracefully - continue analysis without LLM comp selection
        console.error('[Analyze] LLM comp selection failed, continuing with data-based selection:', {
          error: compSelectionError instanceof Error ? compSelectionError.message : 'Unknown error',
          stack: compSelectionError instanceof Error ? compSelectionError.stack : undefined,
        })
        // Use data-based selection as fallback
        const enabledComps = appraisalResult.comparables.filter((c) => c.isEnabled)
        const { bestCompId: dataBestCompId, scores } = selectBestCompFromData(
          enabledComps,
          property.squareFeet,
          property.yearBuilt
        )
        bestCompId = dataBestCompId
        dataBasedScores = scores
      }
    } else {
      // No LLM selection - use data-based best comp selection
      const enabledComps = appraisalResult.comparables.filter((c) => c.isEnabled)
      const { bestCompId: dataBestCompId, scores } = selectBestCompFromData(
        enabledComps,
        property.squareFeet,
        property.yearBuilt
      )
      bestCompId = dataBestCompId
      dataBasedScores = scores
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 5: Calculate valuation with buybox parameters
    // ═══════════════════════════════════════════════════════════════════════════
    const buybox = body.buybox ?? {}
    const subjectSqft = property.squareFeet || 0

    // Use selected comps for sqft average if available, otherwise all enabled
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

    // ═══════════════════════════════════════════════════════════════════════════
    // STEP 6: Build response
    // ═══════════════════════════════════════════════════════════════════════════
    return c.json({
      success: true,
      data: buildAnalysisResponse(
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
          zillowUrls,
          photoProvider: photoService.getProviderName(),
        }
      ),
    })
  } catch (error) {
    console.error('Analysis error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      error,
    })
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Analysis failed',
        details: error instanceof Error ? error.stack : undefined,
      },
      500
    )
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC JOB ENDPOINTS (Queue-based with real-time updates)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * POST /analyze/async
 *
 * Queue an analysis job for async processing with real-time updates.
 * Returns immediately with job ID and URLs for status/streaming.
 */
analyze.post('/async', async (c) => {
  try {
    const body = await c.req.json<AnalyzeRequest>()
    const auth = c.get('auth')

    // Validate input
    if (!body.address && !body.streetAddress && !body.propertyId) {
      return c.json(
        { success: false, error: 'address, streetAddress, or propertyId is required' },
        400
      )
    }

    // Generate job ID and property key
    const jobId = generateJobId()
    const propertyKey = normalizePropertyKey(body)

    // Get or create the AnalysisJob DO
    const doId = c.env.ANALYSIS_JOB.idFromName(`${auth.userId}:${propertyKey}`)
    const jobDO = c.env.ANALYSIS_JOB.get(doId)

    // Initialize job state in DO
    const initResponse = await jobDO.fetch(
      new Request('http://internal/init', {
        method: 'POST',
        body: JSON.stringify({
          jobId,
          userId: auth.userId,
          apiKeyId: auth.apiKeyId,
          propertyKey,
          request: body,
        }),
      })
    )

    if (!initResponse.ok) {
      const error = await initResponse.json() as { error?: string }
      return c.json(
        { success: false, error: error.error || 'Failed to initialize job' },
        500
      )
    }

    // Queue the job for processing
    const message: AnalysisJobMessage = {
      jobId,
      userId: auth.userId,
      apiKeyId: auth.apiKeyId,
      propertyKey,
      request: body,
      priority: body.skipCache ? QueuePriority.NORMAL : QueuePriority.HIGH,
      queuedAt: new Date().toISOString(),
      attemptNumber: 1,
    }

    await c.env.ANALYSIS_QUEUE.send(message)

    // Build response URLs
    const baseUrl = new URL(c.req.url).origin
    const response: QueueJobResponse = {
      success: true,
      data: {
        jobId,
        propertyKey, // Include propertyKey so client uses the same key for WebSocket
        status: 'queued',
        streamUrl: `${baseUrl}/v1/analyze/jobs/${jobId}/stream`,
        pollUrl: `${baseUrl}/v1/analyze/jobs/${jobId}`,
        estimatedDurationMs: body.photoAnalysis?.enabled ? 25000 : 10000,
      },
    }

    return c.json(response, 202)
  } catch (error) {
    console.error('[Analyze Async] Error queuing job:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to queue analysis job',
      },
      500
    )
  }
})

/**
 * GET /analyze/jobs/:jobId
 *
 * Get the current status of an analysis job.
 * Returns job state, progress, and result (if completed).
 */
analyze.get('/jobs/:jobId', async (c) => {
  try {
    const jobId = c.req.param('jobId')
    const auth = c.get('auth')

    // Parse job ID to get property key
    // Job IDs contain timestamp and random suffix, we need to find the DO
    // For now, we'll search through possible DOs or require the property key

    // Get all job DOs for this user (this is a simplified approach)
    // In production, you might want to store job ID -> DO name mapping in KV

    // Try to find the job by iterating or use a stored mapping
    // For simplicity, we'll return a not found for now if we can't locate it
    // A better approach would be to store jobId -> propertyKey mapping in KV

    // Check if jobId includes property key hint (could be passed as query param)
    const propertyKey = c.req.query('propertyKey')

    if (!propertyKey) {
      return c.json(
        { success: false, error: 'propertyKey query parameter required to locate job' },
        400
      )
    }

    const doId = c.env.ANALYSIS_JOB.idFromName(`${auth.userId}:${propertyKey}`)
    const jobDO = c.env.ANALYSIS_JOB.get(doId)

    const stateResponse = await jobDO.fetch(new Request('http://internal/state'))

    if (!stateResponse.ok) {
      if (stateResponse.status === 404) {
        return c.json({ success: false, error: 'Job not found' }, 404)
      }
      return c.json({ success: false, error: 'Failed to get job status' }, 500)
    }

    const state = await stateResponse.json() as JobStatusResponse

    // Verify job ID matches
    if (state.data.jobId !== jobId) {
      return c.json({ success: false, error: 'Job not found' }, 404)
    }

    return c.json(state)
  } catch (error) {
    console.error('[Analyze Job Status] Error:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get job status',
      },
      500
    )
  }
})

/**
 * POST /analyze/ws-token
 *
 * Generate a short-lived signed token for WebSocket authentication.
 * This endpoint requires authentication (via auth middleware).
 *
 * The token is HMAC-SHA256 signed and contains:
 * - userId: The authenticated user's ID
 * - jobId: The job to connect to
 * - propertyKey: The property key for DO lookup
 * - exp: Expiry timestamp (5 minutes from now)
 *
 * Security:
 * - Tokens expire after 5 minutes
 * - Tokens are scoped to specific job and property
 * - Signature prevents tampering
 */
analyze.post('/ws-token', async (c) => {
  try {
    const auth = c.get('auth')
    const body = await c.req.json<{ jobId: string; propertyKey: string }>()

    if (!body.jobId || !body.propertyKey) {
      return c.json(
        { success: false, error: 'jobId and propertyKey are required' },
        400
      )
    }

    const secret = c.env.DASHBOARD_INTERNAL_SECRET
    if (!secret) {
      console.error('[WS Token] DASHBOARD_INTERNAL_SECRET not configured')
      return c.json(
        { success: false, error: 'Server configuration error' },
        500
      )
    }

    // Generate signed token
    const token = await generateWsToken(
      auth.userId,
      body.jobId,
      body.propertyKey,
      secret
    )

    // Build WebSocket URL
    const baseUrl = new URL(c.req.url)
    const wsProtocol = baseUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${wsProtocol}//${baseUrl.host}/ws/analyze/${body.jobId}?token=${encodeURIComponent(token)}`

    console.log(`[WS Token] Generated WS URL: ${wsUrl}`)

    return c.json({
      success: true,
      data: {
        token,
        wsUrl,
        expiresIn: 300, // 5 minutes in seconds
      },
    })
  } catch (error) {
    console.error('[WS Token] Error:', error)
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate token',
      },
      500
    )
  }
})

/**
 * GET /analyze/defaults
 *
 * Get default values for appraisal rules and buybox parameters
 */
analyze.get('/defaults', async (c) => {
  return c.json({
    success: true,
    data: {
      searchOptions: {
        radiusMiles: 1,
        maxComps: 10,
        monthsBack: 12,
      },
      appraisalRules: {
        filters: DEFAULT_FILTERS,
        adjustments: DEFAULT_ADJUSTMENTS,
      },
      buybox: {
        rehabLevelIndex: 2,
        closingCostsPercent: 10,
        carryingCostsPercent: 5,
        wholesaleFee: 10000,
      },
      enrichment: {
        permits: true,
        floodZone: true,
        weatherRisk: false,
      },
      photoAnalysis: {
        enabled: false,
        maxComps: 10,
        requireBetterOrEqual: true,
      },
      zillowContext: {
        enabled: false,
        skipCache: false,
        maxComps: 10,
      },
      rehabLevels: REHAB_LEVELS.map((name, index) => ({ index, name })),
      majorItems: MAJOR_ITEMS,
    },
  })
})

export default analyze
