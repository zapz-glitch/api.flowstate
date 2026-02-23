/**
 * Health Check Routes (no auth required)
 */

import { Hono } from 'hono'
import type { Env } from '../types'

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

export default health
