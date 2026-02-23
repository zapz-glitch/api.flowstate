'use client'

import { cn } from '@/lib/utils'
import type { StepProgress, AnalysisStep } from '@/types/analysis'
import { STEP_CONFIGS, getStepConfig } from '@/types/analysis'
import { CheckCircle2, Circle, Loader2, XCircle, SkipForward } from 'lucide-react'

interface ProgressStepperProps {
  steps: StepProgress[]
  currentStep: AnalysisStep | null
  className?: string
  compact?: boolean
}

export function ProgressStepper({
  steps,
  currentStep,
  className,
  compact = false,
}: ProgressStepperProps) {
  const getStepIcon = (step: StepProgress) => {
    switch (step.status) {
      case 'completed':
        return (
          <CheckCircle2
            className={cn('h-5 w-5', step.fromCache ? 'text-blue-500' : 'text-emerald-500')}
          />
        )
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-primary animate-spin" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />
      case 'skipped':
        return <SkipForward className="h-5 w-5 text-muted-foreground" />
      default:
        return <Circle className="h-5 w-5 text-muted-foreground/50" />
    }
  }

  const getStepColor = (step: StepProgress) => {
    switch (step.status) {
      case 'completed':
        return step.fromCache ? 'border-blue-500 bg-blue-500/10' : 'border-emerald-500 bg-emerald-500/10'
      case 'in_progress':
        return 'border-primary bg-primary/10'
      case 'failed':
        return 'border-destructive bg-destructive/10'
      case 'skipped':
        return 'border-muted bg-muted/50'
      default:
        return 'border-border bg-background'
    }
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {steps.map((step, index) => {
          const config = getStepConfig(step.step)
          return (
            <div
              key={step.step}
              className={cn(
                'flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all',
                getStepColor(step),
                step.step === currentStep && 'ring-2 ring-primary ring-offset-2'
              )}
              title={`${config?.label || step.step}: ${step.status}${step.fromCache ? ' (cached)' : ''}`}
            >
              {getStepIcon(step)}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {steps.map((step, index) => {
        const config = getStepConfig(step.step)
        const isActive = step.step === currentStep

        return (
          <div
            key={step.step}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border transition-all',
              getStepColor(step),
              isActive && 'ring-2 ring-primary'
            )}
          >
            <div className="flex-shrink-0 mt-0.5">{getStepIcon(step)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">{config?.label || step.step}</h4>
                {step.durationMs !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {step.durationMs < 1000
                      ? `${step.durationMs}ms`
                      : `${(step.durationMs / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
              {step.message && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{step.message}</p>
              )}
              {step.error && (
                <p className="text-xs text-destructive mt-0.5 truncate">{step.error}</p>
              )}
              {step.fromCache && (
                <span className="inline-flex items-center text-xs text-blue-600 mt-0.5">
                  From cache
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

interface ProgressBarProps {
  steps: StepProgress[]
  className?: string
}

export function ProgressBar({ steps, className }: ProgressBarProps) {
  const completed = steps.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  ).length
  const total = steps.length
  const percent = Math.round((completed / total) * 100)

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Step {completed} of {total}
        </span>
        <span>{percent}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

// ─── Compact Step Indicator ───────────────────────────────────────────────────

interface StepIndicatorProps {
  steps: StepProgress[]
  currentStep: AnalysisStep | null
  className?: string
}

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  const currentConfig = currentStep ? getStepConfig(currentStep) : null
  const completedCount = steps.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  ).length
  const cacheHits = steps.filter((s) => s.fromCache).length

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-sm font-medium">{currentConfig?.label || 'Processing...'}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {completedCount}/{steps.length} steps
        </span>
        {cacheHits > 0 && (
          <span className="text-blue-600">{cacheHits} cached</span>
        )}
      </div>
    </div>
  )
}
