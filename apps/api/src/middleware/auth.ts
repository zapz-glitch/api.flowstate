/**
 * API Key Authentication Middleware
 *
 * Handles:
 * - API key validation via SHA-256 hash lookup
 * - Session-based auth for dashboard users (X-Dashboard-User-Id header)
 * - Monthly quota checking with automatic reset
 * - Usage logging with response time tracking
 * - Request/response body capture for debugging
 * - Rate limit headers (X-RateLimit-*)
 */

import { Context, Next } from 'hono'
import type { Env } from '../types'

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Verify internal dashboard request
 * The dashboard sends X-Dashboard-User-Id and X-Dashboard-Secret headers
 */
async function verifyDashboardAuth(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  userId: string,
  secret: string
): Promise<{
  success: boolean
  user?: { id: string; plan: string }
  error?: string
}> {
  // Verify the secret matches a configured internal secret
  // This secret should be shared between dashboard and API via environment variables
  const expectedSecret = c.env.DASHBOARD_INTERNAL_SECRET
  if (!expectedSecret || secret !== expectedSecret) {
    return { success: false, error: 'Invalid dashboard secret' }
  }

  // Lookup user from database
  const result = await c.env.DB.prepare(`
    SELECT id, plan FROM user WHERE id = ?
  `)
    .bind(userId)
    .first<{ id: string; plan: string }>()

  if (!result) {
    return { success: false, error: 'User not found' }
  }

  return { success: true, user: result }
}

/**
 * Capture request body by cloning the request
 * Only captures for methods that typically have bodies
 */
async function captureRequestBody(c: Context): Promise<string | null> {
  if (!['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
    return null
  }
  try {
    const clonedRequest = c.req.raw.clone()
    const bodyText = await clonedRequest.text()
    return bodyText || null
  } catch {
    return null
  }
}

/**
 * Capture response body by cloning the response
 */
async function captureResponseBody(response: Response): Promise<string | null> {
  try {
    const clonedResponse = response.clone()
    const bodyText = await clonedResponse.text()
    return bodyText || null
  } catch {
    return null
  }
}

// Plan limits - matches PLAN_LIMITS in packages/db/src/schema.ts
const PLAN_LIMITS: Record<string, number> = {
  free: 100,
  pro: 5000,
  enterprise: -1, // unlimited
}

export interface AuthContext {
  apiKeyId: string
  userId: string
  plan: 'free' | 'pro' | 'enterprise'
  quota: {
    limit: number
    used: number
    remaining: number
    resetAt: string
  }
}

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { auth: AuthContext } }>,
  next: Next
) {
  const startTime = Date.now()
  const authHeader = c.req.header('Authorization')

  // Capture request body before it's consumed by route handler
  const requestBody = await captureRequestBody(c)
  const requestHeaders = JSON.stringify({
    'content-type': c.req.header('Content-Type') || '',
    'user-agent': c.req.header('User-Agent') || '',
    'accept': c.req.header('Accept') || '',
  })

  // Check for dashboard internal auth (X-Dashboard-User-Id + X-Dashboard-Secret)
  const dashboardUserId = c.req.header('X-Dashboard-User-Id')
  const dashboardSecret = c.req.header('X-Dashboard-Secret')

  if (dashboardUserId && dashboardSecret) {
    const dashboardAuth = await verifyDashboardAuth(c, dashboardUserId, dashboardSecret)

    if (!dashboardAuth.success || !dashboardAuth.user) {
      return c.json({ success: false, error: dashboardAuth.error || 'Dashboard auth failed' }, 401)
    }

    // Get plan limit for dashboard user
    const planLimit = PLAN_LIMITS[dashboardAuth.user.plan] ?? 100

    // Set auth context for dashboard user (no API key tracking)
    c.set('auth', {
      apiKeyId: 'dashboard',
      userId: dashboardAuth.user.id,
      plan: dashboardAuth.user.plan as 'free' | 'pro' | 'enterprise',
      quota: {
        limit: planLimit,
        used: 0,
        remaining: planLimit === -1 ? -1 : planLimit,
        resetAt: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
      },
    })

    // Set rate limit headers
    c.header('X-RateLimit-Limit', planLimit === -1 ? 'unlimited' : String(planLimit))
    c.header('X-RateLimit-Remaining', planLimit === -1 ? 'unlimited' : String(planLimit))

    await next()

    // Skip usage logging for dashboard requests
    // The api_usage_logs table has foreign key constraints that require
    // valid api_key_id and user_id which don't exist for dashboard auth
    // Dashboard usage is tracked separately in the dashboard's own database

    return
  }

  // Standard API key authentication
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: 'Missing or invalid Authorization header' },
      401
    )
  }

  const apiKey = authHeader.slice(7)
  const keyHash = await hashApiKey(apiKey)

  // Query API key from database (table is named 'user' in schema)
  const result = await c.env.DB.prepare(`
    SELECT
      ak.id as api_key_id,
      ak.user_id,
      ak.monthly_quota,
      ak.current_usage,
      ak.quota_reset_at,
      ak.is_active,
      u.plan
    FROM api_keys ak
    JOIN user u ON ak.user_id = u.id
    WHERE ak.key_hash = ?
  `)
    .bind(keyHash)
    .first<{
      api_key_id: string
      user_id: string
      monthly_quota: number | null
      current_usage: number
      quota_reset_at: string
      is_active: number
      plan: string
    }>()

  if (!result) {
    return c.json({ success: false, error: 'Invalid API key' }, 401)
  }

  if (!result.is_active) {
    return c.json({ success: false, error: 'API key is disabled' }, 403)
  }

  // Check if quota needs to be reset (monthly reset)
  const resetAt = new Date(result.quota_reset_at)
  const now = new Date()
  let currentUsage = result.current_usage
  let quotaResetAt = result.quota_reset_at

  if (now >= resetAt) {
    // Reset quota
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    quotaResetAt = nextReset.toISOString()
    await c.env.DB.prepare(`
      UPDATE api_keys
      SET current_usage = 0, quota_reset_at = ?
      WHERE id = ?
    `)
      .bind(quotaResetAt, result.api_key_id)
      .run()
    currentUsage = 0
  }

  // Get plan limit if no custom quota set
  const planLimit = PLAN_LIMITS[result.plan] ?? 100
  const quota = result.monthly_quota ?? planLimit

  // Check quota (-1 means unlimited)
  if (quota !== -1 && currentUsage >= quota) {
    // Set rate limit headers even on rejection
    c.header('X-RateLimit-Limit', String(quota))
    c.header('X-RateLimit-Remaining', '0')
    c.header('X-RateLimit-Reset', quotaResetAt)

    return c.json(
      {
        success: false,
        error: 'Monthly quota exceeded',
        quota: { used: currentUsage, limit: quota, resetAt: quotaResetAt },
      },
      429
    )
  }

  const remaining = quota === -1 ? -1 : Math.max(0, quota - currentUsage - 1)

  // Set auth context with quota info
  c.set('auth', {
    apiKeyId: result.api_key_id,
    userId: result.user_id,
    plan: result.plan as 'free' | 'pro' | 'enterprise',
    quota: {
      limit: quota,
      used: currentUsage,
      remaining,
      resetAt: quotaResetAt,
    },
  })

  // Set rate limit headers
  c.header('X-RateLimit-Limit', quota === -1 ? 'unlimited' : String(quota))
  c.header('X-RateLimit-Remaining', quota === -1 ? 'unlimited' : String(remaining))
  c.header('X-RateLimit-Reset', quotaResetAt)

  await next()

  // Calculate response time
  const responseTimeMs = Date.now() - startTime

  // Capture response body for logging
  const responseBody = await captureResponseBody(c.res)

  // Increment usage and update lastUsedAt after successful request
  await c.env.DB.prepare(`
    UPDATE api_keys
    SET current_usage = current_usage + 1, last_used_at = ?
    WHERE id = ?
  `)
    .bind(new Date().toISOString(), result.api_key_id)
    .run()

  // Log usage with request/response bodies
  const logId = crypto.randomUUID()
  await c.env.DB.prepare(`
    INSERT INTO api_usage_logs (
      id, api_key_id, user_id, endpoint, method, status_code, response_time_ms,
      ip_address, user_agent, request_body, response_body, request_headers, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
    .bind(
      logId,
      result.api_key_id,
      result.user_id,
      c.req.path,
      c.req.method,
      c.res.status,
      responseTimeMs,
      c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || null,
      c.req.header('User-Agent') || null,
      requestBody,
      responseBody,
      requestHeaders,
      new Date().toISOString()
    )
    .run()
}
