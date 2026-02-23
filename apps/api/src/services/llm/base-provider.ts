/**
 * Base LLM Provider
 *
 * Abstract base class for all LLM providers.
 * Handles common functionality like timing, error handling, and usage tracking.
 */

import type {
  LLMProvider,
  LLMProviderType,
  LLMRequest,
  LLMResponse,
  ProviderResult,
  UsageMetrics,
  TimingMetrics,
  ProviderError,
} from './types'
import {
  success,
  failure,
  createError,
  calculateEstimatedCost,
} from './types'

// ─── Base Provider Config ────────────────────────────────────────────────────

export interface BaseLLMProviderConfig {
  apiKey: string
  model: string
  maxTokens?: number
  baseUrl?: string
  timeout?: number
}

// ─── Abstract Base Class ─────────────────────────────────────────────────────

export abstract class BaseLLMProvider implements LLMProvider {
  abstract readonly name: LLMProviderType
  readonly model: string
  protected readonly apiKey: string
  protected readonly maxTokens: number
  protected readonly baseUrl: string
  protected readonly timeout: number

  constructor(config: BaseLLMProviderConfig) {
    this.apiKey = config.apiKey
    this.model = config.model
    this.maxTokens = config.maxTokens ?? 1024
    this.baseUrl = config.baseUrl ?? ''
    this.timeout = config.timeout ?? 60000 // 60 seconds default
  }

  isConfigured(): boolean {
    return !!this.apiKey
  }

  /**
   * Main entry point - handles timing and error wrapping
   */
  async execute(request: LLMRequest): Promise<ProviderResult<LLMResponse>> {
    const startTime = Date.now()

    try {
      const result = await this.doExecute(request)

      const timing: TimingMetrics = {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime,
      }

      if (result.success && result.data) {
        // Calculate cost if we have usage data
        let usage = result.usage
        if (usage?.promptTokens !== undefined && usage?.completionTokens !== undefined) {
          usage = {
            ...usage,
            estimatedCostUsd: calculateEstimatedCost(
              this.model,
              usage.promptTokens,
              usage.completionTokens
            ),
          }
        }

        return {
          success: true,
          data: result.data,
          usage,
          timing,
        }
      }

      return {
        ...result,
        timing,
      }
    } catch (error) {
      const timing: TimingMetrics = {
        startTime,
        endTime: Date.now(),
        durationMs: Date.now() - startTime,
      }

      return failure(
        this.normalizeError(error),
        timing
      )
    }
  }

  /**
   * Provider-specific execution - implemented by subclasses
   */
  protected abstract doExecute(request: LLMRequest): Promise<ProviderResult<LLMResponse>>

  /**
   * Normalize errors to standard format
   */
  protected normalizeError(error: unknown): ProviderError {
    if (error instanceof Error) {
      // Check for timeout
      if (error.name === 'AbortError') {
        return createError(this.name, 'TIMEOUT', 'Request timed out', {
          retryable: true,
        })
      }

      // Check for network errors
      if (error.message.includes('fetch') || error.message.includes('network')) {
        return createError(this.name, 'NETWORK_ERROR', error.message, {
          retryable: true,
        })
      }

      return createError(this.name, 'PROVIDER_ERROR', error.message, {
        retryable: false,
        details: error,
      })
    }

    return createError(this.name, 'UNKNOWN_ERROR', String(error), {
      retryable: false,
    })
  }

  /**
   * Parse HTTP error response
   */
  protected parseHttpError(status: number, body: string): ProviderError {
    const isRetryable = status >= 500 || status === 429

    return createError(
      this.name,
      `HTTP_${status}`,
      `API error: ${status} - ${body}`,
      {
        retryable: isRetryable,
        statusCode: status,
        details: body,
      }
    )
  }

  /**
   * Create fetch options with timeout
   */
  protected createFetchOptions(
    method: string,
    headers: Record<string, string>,
    body: unknown
  ): RequestInit & { signal: AbortSignal } {
    const controller = new AbortController()
    setTimeout(() => controller.abort(), this.timeout)

    return {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }
  }
}
