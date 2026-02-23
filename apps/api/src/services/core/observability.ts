/**
 * Observability Service
 *
 * Provides structured logging, metrics tracking, and token usage monitoring.
 * Designed for Cloudflare Workers environment.
 */

import type {
  UsageMetrics,
  TimingMetrics,
  RequestContext,
  LLMProviderType,
} from './types'
import { calculateEstimatedCost } from './types'

// ─── Types ───────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  requestId?: string
  userId?: string
  context?: Record<string, unknown>
}

export interface TokenUsageEntry {
  requestId: string
  provider: LLMProviderType
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
  latencyMs?: number
  endpoint?: string
  timestamp: string
}

export interface UsageSummary {
  totalTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  tokensByProvider: Record<string, number>
  estimatedTotalCostUsd: number
  requestCount: number
  entries: TokenUsageEntry[]
}

export interface LatencyEntry {
  operation: string
  durationMs: number
  timestamp: string
  requestId?: string
}

export interface ErrorEntry {
  provider: string
  code: string
  message: string
  retryable: boolean
  timestamp: string
  requestId?: string
}

// ─── Observability Service ───────────────────────────────────────────────────

export interface ObservabilityService {
  // Logging
  debug(message: string, context?: Record<string, unknown>): void
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void

  // Token usage tracking
  trackTokenUsage(
    provider: LLMProviderType,
    model: string,
    usage: UsageMetrics,
    latencyMs?: number
  ): void

  // Latency tracking
  trackLatency(operation: string, durationMs: number): void
  startTimer(operation: string): () => number

  // Error tracking
  trackError(provider: string, code: string, message: string, retryable: boolean): void

  // Request context
  withRequestContext(requestId: string, userId?: string, apiKeyId?: string): ObservabilityService

  // Aggregation
  getUsageSummary(): UsageSummary
  getTokenUsageEntries(): TokenUsageEntry[]
  getLogs(): LogEntry[]
  getLatencyEntries(): LatencyEntry[]
  getErrors(): ErrorEntry[]

  // Get current request context
  getRequestContext(): RequestContext | null
}

// ─── Implementation ──────────────────────────────────────────────────────────

class ObservabilityServiceImpl implements ObservabilityService {
  private context: RequestContext | null = null
  private logs: LogEntry[] = []
  private tokenUsage: TokenUsageEntry[] = []
  private latencyEntries: LatencyEntry[] = []
  private errors: ErrorEntry[] = []
  private logLevel: LogLevel

  constructor(options?: { logLevel?: LogLevel }) {
    this.logLevel = options?.logLevel ?? 'info'
  }

  // ─── Logging ─────────────────────────────────────────────────────────────────

  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    return levels.indexOf(level) >= levels.indexOf(this.logLevel)
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      requestId: this.context?.requestId,
      userId: this.context?.userId,
      context,
    }

    this.logs.push(entry)

    if (this.shouldLog(level)) {
      const prefix = this.context?.requestId ? `[${this.context.requestId}] ` : ''
      const contextStr = context ? ` ${JSON.stringify(context)}` : ''

      switch (level) {
        case 'debug':
          console.debug(`${prefix}${message}${contextStr}`)
          break
        case 'info':
          console.info(`${prefix}${message}${contextStr}`)
          break
        case 'warn':
          console.warn(`${prefix}${message}${contextStr}`)
          break
        case 'error':
          console.error(`${prefix}${message}${contextStr}`)
          break
      }
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context)
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context)
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context)
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context)
  }

  // ─── Token Usage Tracking ────────────────────────────────────────────────────

  trackTokenUsage(
    provider: LLMProviderType,
    model: string,
    usage: UsageMetrics,
    latencyMs?: number
  ): void {
    const promptTokens = usage.promptTokens ?? 0
    const completionTokens = usage.completionTokens ?? 0
    const totalTokens = usage.totalTokens ?? promptTokens + completionTokens
    const estimatedCostUsd = usage.estimatedCostUsd ?? calculateEstimatedCost(model, promptTokens, completionTokens)

    const entry: TokenUsageEntry = {
      requestId: this.context?.requestId ?? 'unknown',
      provider,
      model,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUsd,
      latencyMs,
      endpoint: this.context?.endpoint,
      timestamp: new Date().toISOString(),
    }

    this.tokenUsage.push(entry)

    this.info('Token usage tracked', {
      provider,
      model,
      totalTokens,
      estimatedCostUsd: estimatedCostUsd.toFixed(6),
      latencyMs,
    })
  }

  // ─── Latency Tracking ────────────────────────────────────────────────────────

  trackLatency(operation: string, durationMs: number): void {
    this.latencyEntries.push({
      operation,
      durationMs,
      timestamp: new Date().toISOString(),
      requestId: this.context?.requestId,
    })

    this.debug(`Latency: ${operation}`, { durationMs })
  }

  startTimer(operation: string): () => number {
    const startTime = Date.now()
    return () => {
      const durationMs = Date.now() - startTime
      this.trackLatency(operation, durationMs)
      return durationMs
    }
  }

  // ─── Error Tracking ──────────────────────────────────────────────────────────

  trackError(provider: string, code: string, message: string, retryable: boolean): void {
    this.errors.push({
      provider,
      code,
      message,
      retryable,
      timestamp: new Date().toISOString(),
      requestId: this.context?.requestId,
    })

    this.error(`Provider error: ${provider}`, { code, message, retryable })
  }

  // ─── Request Context ─────────────────────────────────────────────────────────

  withRequestContext(
    requestId: string,
    userId?: string,
    apiKeyId?: string
  ): ObservabilityService {
    // Create a new instance with the context set
    const child = new ObservabilityServiceImpl({ logLevel: this.logLevel })
    child.context = {
      requestId,
      userId,
      apiKeyId,
      startTime: Date.now(),
    }
    // Share the same storage arrays for aggregation
    child.logs = this.logs
    child.tokenUsage = this.tokenUsage
    child.latencyEntries = this.latencyEntries
    child.errors = this.errors
    return child
  }

  getRequestContext(): RequestContext | null {
    return this.context
  }

  // ─── Aggregation ─────────────────────────────────────────────────────────────

  getUsageSummary(): UsageSummary {
    const tokensByProvider: Record<string, number> = {}
    let totalTokens = 0
    let totalPromptTokens = 0
    let totalCompletionTokens = 0
    let estimatedTotalCostUsd = 0

    for (const entry of this.tokenUsage) {
      totalTokens += entry.totalTokens
      totalPromptTokens += entry.promptTokens
      totalCompletionTokens += entry.completionTokens
      estimatedTotalCostUsd += entry.estimatedCostUsd

      tokensByProvider[entry.provider] = (tokensByProvider[entry.provider] ?? 0) + entry.totalTokens
    }

    return {
      totalTokens,
      totalPromptTokens,
      totalCompletionTokens,
      tokensByProvider,
      estimatedTotalCostUsd,
      requestCount: this.tokenUsage.length,
      entries: [...this.tokenUsage],
    }
  }

  getTokenUsageEntries(): TokenUsageEntry[] {
    return [...this.tokenUsage]
  }

  getLogs(): LogEntry[] {
    return [...this.logs]
  }

  getLatencyEntries(): LatencyEntry[] {
    return [...this.latencyEntries]
  }

  getErrors(): ErrorEntry[] {
    return [...this.errors]
  }
}

// ─── Factory ─────────────────────────────────────────────────────────────────

/**
 * Create a new observability service instance
 */
export function createObservabilityService(options?: {
  logLevel?: LogLevel
}): ObservabilityService {
  return new ObservabilityServiceImpl(options)
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return crypto.randomUUID()
}

// ─── Database Persistence Types ──────────────────────────────────────────────

/**
 * Data structure for persisting token usage to database
 */
export interface TokenUsageRecord {
  id: string
  apiKeyId: string | null
  userId: string
  requestId: string
  endpoint: string
  provider: string
  model: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  estimatedCostUsd: number
  latencyMs: number | null
  createdAt: string
}

/**
 * Convert token usage entries to database records
 */
export function toTokenUsageRecords(
  entries: TokenUsageEntry[],
  userId: string,
  apiKeyId?: string
): TokenUsageRecord[] {
  return entries.map((entry) => ({
    id: crypto.randomUUID(),
    apiKeyId: apiKeyId ?? null,
    userId,
    requestId: entry.requestId,
    endpoint: entry.endpoint ?? 'unknown',
    provider: entry.provider,
    model: entry.model,
    promptTokens: entry.promptTokens,
    completionTokens: entry.completionTokens,
    totalTokens: entry.totalTokens,
    estimatedCostUsd: entry.estimatedCostUsd,
    latencyMs: entry.latencyMs ?? null,
    createdAt: entry.timestamp,
  }))
}
