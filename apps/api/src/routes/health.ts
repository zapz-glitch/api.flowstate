/**
 * Health Check Routes (no auth required)
 */

import { Hono } from 'hono'
import type { Env } from '../types'
import { createPropertyApi } from '../services/property-api'

const health = new Hono<{ Bindings: Env }>()

/**
 * GET /health
 * Health check endpoint
 */
health.get('/', async (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  })
})

/**
 * GET /health/db
 * Database health check
 */
health.get('/db', async (c) => {
  try {
    const result = await c.env.DB.prepare('SELECT 1 as ok').first<{ ok: number }>()
    return c.json({
      status: result?.ok === 1 ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return c.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Database check failed',
        timestamp: new Date().toISOString(),
      },
      500
    )
  }
})

/**
 * GET /health/keys
 * CoreLogic API key status - shows which keys are available vs in cooldown
 *
 * Useful for diagnosing "Rate limited on key X" errors.
 * Keys go into 60-second cooldown when rate limited (HTTP 429).
 */
health.get('/keys', async (c) => {
  try {
    const propertyApi = createPropertyApi(c.env)
    const keyStatus = propertyApi.getKeyStatus()

    // Diagnostic: check which key indices have non-empty values configured
    const MAX_KEYS = 9
    const configuredIndices: number[] = []
    const emptyIndices: number[] = []

    for (let i = 0; i < MAX_KEYS; i++) {
      const clientId = c.env[`CORELOGIC_CLIENT_ID_${i}` as keyof typeof c.env] as string | undefined
      const clientSecret = c.env[`CORELOGIC_CLIENT_SECRET_${i}` as keyof typeof c.env] as string | undefined

      if (clientId && clientSecret && clientId.trim() && clientSecret.trim()) {
        configuredIndices.push(i)
      } else if (clientId !== undefined || clientSecret !== undefined) {
        // Secret exists but is empty or only one of the pair is set
        emptyIndices.push(i)
      }
    }

    return c.json({
      status: keyStatus.available > 0 ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      provider: 'corelogic',
      keys: {
        total: keyStatus.total,
        available: keyStatus.available,
        inCooldown: keyStatus.inCooldown,
        cooldownDurationMs: 60000,
        details: keyStatus.keys.map((k) => ({
          index: k.index,
          status: k.status,
        })),
      },
      diagnostic: {
        configuredIndices,
        emptyOrPartialIndices: emptyIndices,
        note: emptyIndices.length > 0
          ? 'Some keys have empty values or only ID/Secret set. Re-add them with wrangler secret put.'
          : undefined,
      },
      message:
        keyStatus.available === 0
          ? 'All API keys are in cooldown. Wait 60 seconds or add more keys.'
          : keyStatus.inCooldown > 0
            ? `${keyStatus.inCooldown} key(s) in cooldown, ${keyStatus.available} available.`
            : 'All keys available.',
    })
  } catch (error) {
    return c.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to get key status',
        timestamp: new Date().toISOString(),
      },
      500
    )
  }
})

export default health
