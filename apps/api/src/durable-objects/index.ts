/**
 * Durable Objects Exports
 *
 * Export all Durable Object classes for use in the worker.
 */

export { AnalysisJobDO } from './analysis-job'
export { RateLimitCoordinatorDO } from './rate-limit-coordinator'
export { FirecrawlRateLimiterDO } from './firecrawl-rate-limiter'

// Re-export types
export type {
  // Request types
  AnalyzeRequest,
  AnalysisResponse,

  // Job types
  JobStatus,
  AnalysisStep,
  StepStatus,
  StepProgress,
  AnalysisJobState,
  JobError,

  // Step configuration
  StepConfig,

  // Status messages
  StatusMessageType,
  StatusMessage,
  StatusMessageData,
  JobCreatedData,
  JobStartedData,
  StepStartedData,
  StepProgressData,
  StepCompletedData,
  StepFailedData,
  StepSkippedData,
  JobCompletedData,
  JobFailedData,
  CacheHitData,

  // Rate limit types
  KeyState,
  DailyUsage,
  RateLimitState,
  AcquireKeyResult,
  ReleaseKeyResult,

  // API response types
  QueueJobResponse,
  JobStatusResponse,

  // DO request types
  InitJobRequest,
  UpdateStepRequest,
  SetResultRequest,
  SetErrorRequest,
} from './types'

export {
  STEP_CONFIGS,
  TOTAL_STEPS,
  getStepConfig,
  getStepNumber,
} from './types'
