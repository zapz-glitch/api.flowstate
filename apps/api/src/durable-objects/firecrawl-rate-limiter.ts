/**
 * Firecrawl Rate Limiter Durable Object
 *
 * Coordinates Firecrawl API rate limiting across all workers globally.
 * Enforces the 50 concurrent request limit with fair queuing.
 *
 * Features:
 * - Global concurrency tracking (50 max)
 * - Fair request queuing with timeouts
 * - Automatic slot release on timeout
 * - Metrics for monitoring
 */

import { DurableObject } from 'cloudflare:workers'
import type { Env } from '../types'
import type {
  FirecrawlRateLimitState,
  AcquireSlotResult,
  ReleaseSlotRequest,
} from '../workflows/types'

// Firecrawl limits
const MAX_CONCURRENT_REQUESTS = 50
const SLOT_TIMEOUT_MS = 60 * 1000 // 60 seconds max per request
const ACQUIRE_TIMEOUT_MS = 30 * 1000 // 30 seconds max wait for slot
const CLEANUP_INTERVAL_MS = 10 * 1000 // Clean up stale slots every 10s

interface ActiveSlot {
  slotId: string
  acquiredAt: number
  expiresAt: number
}

interface WaitingRequest {
  requestId: string
  waitingSince: number
  timeoutAt: number
  resolve: (result: AcquireSlotResult) => void
}

interface RateLimiterState {
  activeSlots: ActiveSlot[]
  metrics: {
    totalAcquired: number
    totalReleased: number
    totalTimedOut: number
    totalRejected: number
  }
}

export class FirecrawlRateLimiterDO extends DurableObject<Env> {
  private state: RateLimiterState | null = null
  private waitingQueue: WaitingRequest[] = []
  private cleanupAlarm: boolean = false

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
  }

  /**
   * Load state from storage
   */
  private async loadState(): Promise<RateLimiterState> {
    if (this.state) return this.state

    const stored = await this.ctx.storage.get<RateLimiterState>('state')
    if (stored) {
      // Clean up any expired slots on load
      const now = Date.now()
      stored.activeSlots = stored.activeSlots.filter((slot) => slot.expiresAt > now)
      this.state = stored
    } else {
      this.state = {
        activeSlots: [],
        metrics: {
          totalAcquired: 0,
          totalReleased: 0,
          totalTimedOut: 0,
          totalRejected: 0,
        },
      }
    }

    return this.state
  }

  /**
   * Save state to storage
   */
  private async saveState(): Promise<void> {
    if (this.state) {
      await this.ctx.storage.put('state', this.state)
    }
  }

  /**
   * Schedule cleanup alarm if not already scheduled
   */
  private async scheduleCleanup(): Promise<void> {
    if (!this.cleanupAlarm) {
      this.cleanupAlarm = true
      await this.ctx.storage.setAlarm(Date.now() + CLEANUP_INTERVAL_MS)
    }
  }

  /**
   * Handle alarm for cleanup
   */
  async alarm(): Promise<void> {
    this.cleanupAlarm = false
    await this.cleanupExpiredSlots()

    // Reschedule if there are still active slots
    const state = await this.loadState()
    if (state.activeSlots.length > 0 || this.waitingQueue.length > 0) {
      await this.scheduleCleanup()
    }
  }

  /**
   * Clean up expired slots and process waiting queue
   */
  private async cleanupExpiredSlots(): Promise<void> {
    const state = await this.loadState()
    const now = Date.now()

    // Find and remove expired slots
    const expiredSlots = state.activeSlots.filter((slot) => slot.expiresAt <= now)
    if (expiredSlots.length > 0) {
      state.activeSlots = state.activeSlots.filter((slot) => slot.expiresAt > now)
      state.metrics.totalTimedOut += expiredSlots.length
      console.log(`[FirecrawlRateLimiter] Cleaned up ${expiredSlots.length} expired slots`)

      // Process waiting queue with freed slots
      await this.processWaitingQueue()
      await this.saveState()
    }

    // Clean up timed out waiting requests
    const timedOutWaiting = this.waitingQueue.filter((req) => req.timeoutAt <= now)
    for (const req of timedOutWaiting) {
      req.resolve({
        success: false,
        error: 'Timeout waiting for available slot',
        waitMs: now - req.waitingSince,
      })
    }
    this.waitingQueue = this.waitingQueue.filter((req) => req.timeoutAt > now)
  }

  /**
   * Process waiting queue - grant slots to waiting requests
   */
  private async processWaitingQueue(): Promise<void> {
    const state = await this.loadState()

    while (
      this.waitingQueue.length > 0 &&
      state.activeSlots.length < MAX_CONCURRENT_REQUESTS
    ) {
      const request = this.waitingQueue.shift()
      if (!request) break

      const now = Date.now()

      // Check if request has timed out
      if (request.timeoutAt <= now) {
        request.resolve({
          success: false,
          error: 'Timeout waiting for available slot',
          waitMs: now - request.waitingSince,
        })
        continue
      }

      // Grant slot
      const slotId = `slot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
      state.activeSlots.push({
        slotId,
        acquiredAt: now,
        expiresAt: now + SLOT_TIMEOUT_MS,
      })
      state.metrics.totalAcquired++

      request.resolve({
        success: true,
        slotId,
        waitMs: now - request.waitingSince,
      })
    }
  }

  /**
   * Generate unique slot ID
   */
  private generateSlotId(): string {
    return `slot_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  /**
   * Handle HTTP requests
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    try {
      switch (url.pathname) {
        case '/acquire':
          return this.handleAcquireSlot(request)
        case '/release':
          return this.handleReleaseSlot(request)
        case '/status':
          return this.handleGetStatus()
        case '/metrics':
          return this.handleGetMetrics()
        default:
          return new Response('Not Found', { status: 404 })
      }
    } catch (error) {
      console.error('[FirecrawlRateLimiterDO] Error:', error)
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Internal error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }
  }

  /**
   * Acquire a slot for making a Firecrawl request
   */
  private async handleAcquireSlot(request: Request): Promise<Response> {
    const body = (await request.json()) as { timeout?: number }
    const state = await this.loadState()
    const now = Date.now()

    // Clean up any expired slots first
    state.activeSlots = state.activeSlots.filter((slot) => slot.expiresAt > now)

    // Check if slot available immediately
    if (state.activeSlots.length < MAX_CONCURRENT_REQUESTS) {
      const slotId = this.generateSlotId()
      state.activeSlots.push({
        slotId,
        acquiredAt: now,
        expiresAt: now + SLOT_TIMEOUT_MS,
      })
      state.metrics.totalAcquired++

      await this.saveState()
      await this.scheduleCleanup()

      const result: AcquireSlotResult = {
        success: true,
        slotId,
        waitMs: 0,
      }

      return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // No slot available - queue the request
    const timeout = body.timeout ?? ACQUIRE_TIMEOUT_MS
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

    // Create a promise that will be resolved when slot becomes available
    const resultPromise = new Promise<AcquireSlotResult>((resolve) => {
      this.waitingQueue.push({
        requestId,
        waitingSince: now,
        timeoutAt: now + timeout,
        resolve,
      })
    })

    await this.scheduleCleanup()

    // Wait for slot or timeout
    const result = await resultPromise
    await this.saveState()

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * Release a slot after completing a Firecrawl request
   */
  private async handleReleaseSlot(request: Request): Promise<Response> {
    const body = (await request.json()) as ReleaseSlotRequest
    const state = await this.loadState()

    const slotIndex = state.activeSlots.findIndex((s) => s.slotId === body.slotId)
    if (slotIndex === -1) {
      // Slot already expired or doesn't exist - that's okay
      return new Response(JSON.stringify({ success: true, alreadyReleased: true }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Remove the slot
    state.activeSlots.splice(slotIndex, 1)
    state.metrics.totalReleased++

    // Process waiting queue
    await this.processWaitingQueue()
    await this.saveState()

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * Get current status
   */
  private async handleGetStatus(): Promise<Response> {
    const state = await this.loadState()
    const now = Date.now()

    // Clean up expired for accurate count
    state.activeSlots = state.activeSlots.filter((slot) => slot.expiresAt > now)

    const status: FirecrawlRateLimitState = {
      activeRequests: state.activeSlots.length,
      maxConcurrent: MAX_CONCURRENT_REQUESTS,
      waitingCount: this.waitingQueue.length,
      lastRequestAt:
        state.activeSlots.length > 0
          ? new Date(
              Math.max(...state.activeSlots.map((s) => s.acquiredAt))
            ).toISOString()
          : null,
    }

    return new Response(JSON.stringify(status), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  /**
   * Get metrics
   */
  private async handleGetMetrics(): Promise<Response> {
    const state = await this.loadState()

    return new Response(
      JSON.stringify({
        metrics: state.metrics,
        current: {
          activeSlots: state.activeSlots.length,
          waitingQueue: this.waitingQueue.length,
        },
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }
}
