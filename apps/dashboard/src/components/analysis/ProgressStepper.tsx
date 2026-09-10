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
            className={cn('h-4 w-4', step.fromCache ? 'text-blue-500' : 'text-emerald-500')}
          />
        )
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-primary animate-spin" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />
      case 'skipped':
        return <SkipForward className="h-4 w-4 text-muted-foreground" />
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/40" />
    }
  }

  const getStepColor = (step: StepProgress) => {
    switch (step.status) {
      case 'completed':
        return step.fromCache ? 'border-blue-500/60 bg-blue-500/10 text-blue-600' : 'border-emerald-500/60 bg-emerald-500/10 text-emerald-600'
      case 'in_progress':
        return 'border-primary bg-primary/10 text-primary'
      case 'failed':
        return 'border-destructive/60 bg-destructive/10 text-destructive'
      case 'skipped':
        return 'border-border bg-secondary/50 text-muted-foreground'
      default:
        return 'border-border bg-secondary/30 text-muted-foreground/60'
    }
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {steps.map((step) => {
          const config = getStepConfig(step.step)
          return (
            <div
              key={step.step}
              className={cn(
                'pipe-node flex items-center justify-center w-8 h-8 rounded-full border transition-all',
                getStepColor(step),
                step.step === currentStep && 'active'
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
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2', className)}>
      {steps.map((step, index) => {
        const config = getStepConfig(step.step)
        const isActive = step.step === currentStep

        return (
          <div
            key={step.step}
            className={cn(
              'pipe-node relative flex items-center gap-3 px-3 py-2.5 rounded border transition-all',
              getStepColor(step),
              isActive && 'active'
            )}
          >
            <div className="flex-shrink-0">{getStepIcon(step)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-medium truncate">
                  <span className="font-mono opacity-50 mr-1.5">{String(index + 1).padStart(2, '0')}</span>
                  {config?.label || step.step}
                </h4>
                {step.durationMs !== undefined && (
                  <span className="text-[10px] font-mono text-muted-foreground flex-shrink-0">
                    {step.durationMs < 1000
                      ? `${step.durationMs}ms`
                      : `${(step.durationMs / 1000).toFixed(1)}s`}
                  </span>
                )}
              </div>
              {(step.message || step.error || step.fromCache) && (
                <p className={cn('text-[11px] mt-0.5 truncate', step.error ? 'text-destructive' : 'text-muted-foreground')}>
                  {step.error || step.message}
                  {step.fromCache && <span className="text-blue-500"> · cached</span>}
                </p>
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
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between hud-label">
        <span>
          step {completed}/{total}
        </span>
        <span className="text-primary">{percent}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary shadow-[0_0_12px_hsl(var(--primary)/0.6)] transition-all duration-300 ease-out"
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
        <span className="text-sm font-medium font-mono">{currentConfig?.label || 'Processing...'}</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
        <span>
          {completedCount}/{steps.length} steps
        </span>
        {cacheHits > 0 && (
          <span className="text-blue-500">{cacheHits} cached</span>
        )}
      </div>
    </div>
  )
}
