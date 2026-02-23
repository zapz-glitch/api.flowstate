/**
 * Analysis Queue Consumer
 *
 * Processes analysis jobs from the queue.
 * Updates job state via Durable Object and handles retries.
 */

import type { Env } from '../types'
import type { AnalysisJobMessage, DeadLetterMessage } from './types'
import { processAnalysisJob } from './analysis-processor'

export interface AnalysisQueueConsumer {
  queue(
    batch: MessageBatch<AnalysisJobMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void>
}

/**
 * Queue consumer handler for analysis jobs
 */
export const analysisQueueConsumer: AnalysisQueueConsumer = {
  async queue(
    batch: MessageBatch<AnalysisJobMessage>,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`[Queue] ========== CONSUMER TRIGGERED ==========`)
    console.log(`[Queue] Received batch of ${batch.messages.length} messages`)

    // Process jobs one at a time for isolation
    for (const message of batch.messages) {
      const job = message.body
      const { jobId, userId, propertyKey } = job

      console.log(`[Queue] Processing job ${jobId} (attempt ${job.attemptNumber}), propertyKey: ${propertyKey}`)

      // Get the job's Durable Object
      const doId = env.ANALYSIS_JOB.idFromName(`${userId}:${propertyKey}`)
      const jobDO = env.ANALYSIS_JOB.get(doId)

      // Get the rate limit coordinator
      const rateLimitId = env.RATE_LIMIT_COORDINATOR.idFromName('corelogic:coordinator')
      const rateLimitDO = env.RATE_LIMIT_COORDINATOR.get(rateLimitId)

      try {
        // Process the job
        const result = await processAnalysisJob(job, env, jobDO, rateLimitDO)

        if (result.success) {
          console.log(`[Queue] Job ${jobId} completed successfully (cached: ${result.cached})`)
          message.ack()
        } else {
          // Check if we should retry
          if (result.retryable && job.attemptNumber < 3) {
            console.log(`[Queue] Job ${jobId} failed (retryable), will retry: ${result.error}`)

            // Update job message with incremented attempt
            const retryMessage: AnalysisJobMessage = {
              ...job,
              attemptNumber: job.attemptNumber + 1,
            }

            // Exponential backoff: 30s, 60s, 120s
            const delaySeconds = 30 * Math.pow(2, job.attemptNumber - 1)
            message.retry({ delaySeconds })
          } else {
            console.error(`[Queue] Job ${jobId} failed permanently: ${result.error}`)

            // Send to DLQ
            if (env.ANALYSIS_DLQ) {
              const dlqMessage: DeadLetterMessage = {
                ...job,
                error: result.error,
                failedAt: new Date().toISOString(),
                totalAttempts: job.attemptNumber,
              }
              await env.ANALYSIS_DLQ.send(dlqMessage)
            }

            message.ack()
          }
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`[Queue] Job ${jobId} threw error:`, errorMessage)

        // Update DO with error state
        try {
          await jobDO.fetch(
            new Request('http://internal/error', {
              method: 'POST',
              body: JSON.stringify({
                error: {
                  code: 'PROCESSING_ERROR',
                  message: errorMessage,
                  retryable: job.attemptNumber < 3,
                },
              }),
            })
          )
        } catch {
          // Ignore DO update errors
        }

        // Retry if under limit
        if (job.attemptNumber < 3) {
          const delaySeconds = 30 * Math.pow(2, job.attemptNumber - 1)
          message.retry({ delaySeconds })
        } else {
          // Send to DLQ
          if (env.ANALYSIS_DLQ) {
            const dlqMessage: DeadLetterMessage = {
              ...job,
              error: errorMessage,
              failedAt: new Date().toISOString(),
              totalAttempts: job.attemptNumber,
            }
            await env.ANALYSIS_DLQ.send(dlqMessage)
          }
          message.ack()
        }
      }
    }
  },
}

export default analysisQueueConsumer
