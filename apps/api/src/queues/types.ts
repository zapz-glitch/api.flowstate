/**
 * Queue Types
 *
 * Types for the analysis job queue system.
 */

import type { AnalyzeRequest } from '../durable-objects/types'

// ─── Queue Message Types ──────────────────────────────────────────────────────

export interface AnalysisJobMessage {
  /** Unique job identifier */
  jobId: string

  /** User who initiated the request */
  userId: string

  /** API key used for the request */
  apiKeyId: string

  /** Normalized property identifier (address hash or property ID) */
  propertyKey: string

  /** The original analyze request */
  request: AnalyzeRequest

  /** Priority (lower = higher priority) */
  priority: number

  /** When the job was queued */
  queuedAt: string

  /** Current attempt number (starts at 1) */
  attemptNumber: number
}

// ─── Queue Priority ───────────────────────────────────────────────────────────

export const QueuePriority = {
  /** Expected cache hit - process quickly */
  HIGH: 1,
  /** Normal priority - fresh fetch needed */
  NORMAL: 2,
  /** Low priority - bulk or background jobs */
  LOW: 3,
} as const

export type QueuePriorityType = (typeof QueuePriority)[keyof typeof QueuePriority]

// ─── Dead Letter Queue Message ────────────────────────────────────────────────

export interface DeadLetterMessage extends AnalysisJobMessage {
  /** Error that caused the job to fail */
  error: string

  /** When the job was moved to DLQ */
  failedAt: string

  /** Total attempts made */
  totalAttempts: number
}

// ─── Queue Consumer Context ───────────────────────────────────────────────────

export interface QueueConsumerContext {
  /** Job message being processed */
  message: AnalysisJobMessage

  /** Durable Object stub for job state */
  jobDO: DurableObjectStub

  /** Durable Object stub for rate limiting */
  rateLimitDO: DurableObjectStub
}

// ─── Processing Result ────────────────────────────────────────────────────────

export type ProcessingResult =
  | { success: true; cached: boolean }
  | { success: false; error: string; retryable: boolean }
