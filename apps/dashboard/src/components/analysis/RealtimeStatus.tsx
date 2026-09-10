'use client'

import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { AnalysisState, StatusMessage, JobStatus } from '@/types/analysis'
import { getStepConfig } from '@/types/analysis'
import { ProgressStepper, ProgressBar, StepIndicator } from './ProgressStepper'
import { Button } from '@/components/ui/button'
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  Wifi,
  WifiOff,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

interface RealtimeStatusProps {
  state: AnalysisState
  isConnecting?: boolean
  className?: string
  onCancel?: () => void
  onSwitchToPolling?: () => void
  usePolling?: boolean
}

export function RealtimeStatus({
  state,
  isConnecting,
  className,
  onCancel,
  onSwitchToPolling,
  usePolling,
}: RealtimeStatusProps) {
  const { status, currentStep, steps, totalDurationMs, error, isConnected, messages } = state

  const getStatusBadge = (status: JobStatus | null) => {
    switch (status) {
      case 'queued':
        return (
          <Badge variant="secondary" className="gap-1 font-mono">
            <Clock className="h-3 w-3" />
            QUEUED
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="default" className="gap-1 bg-primary font-mono">
            <Loader2 className="h-3 w-3 animate-spin" />
            PROCESSING
          </Badge>
        )
      case 'completed':
        return (
          <Badge variant="default" className="gap-1 bg-emerald-500 font-mono">
            <CheckCircle2 className="h-3 w-3" />
            COMPLETE
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1 font-mono">
            <XCircle className="h-3 w-3" />
            FAILED
          </Badge>
        )
      default:
        return null
    }
  }

  // Calculate stats
  const completedSteps = steps.filter((s) => s.status === 'completed').length
  const skippedSteps = steps.filter((s) => s.status === 'skipped').length
  const cacheHits = steps.filter((s) => s.fromCache).length
  const failedSteps = steps.filter((s) => s.status === 'failed').length

  return (
    <Card className={cn('hud-frame overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Pipeline
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Connection status */}
            {usePolling ? (
              <Badge variant="outline" className="gap-1 text-blue-500 border-blue-500/50 font-mono">
                <RefreshCw className="h-3 w-3" />
                POLL
              </Badge>
            ) : isConnecting ? (
              <Badge variant="outline" className="gap-1 font-mono">
                <Loader2 className="h-3 w-3 animate-spin" />
                LINK…
              </Badge>
            ) : isConnected ? (
              <Badge variant="outline" className="gap-1 text-emerald-500 border-emerald-500/50 font-mono">
                <Wifi className="h-3 w-3" />
                LIVE
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground font-mono">
                <WifiOff className="h-3 w-3" />
                OFFLINE
              </Badge>
            )}
            {/* Job status */}
            {getStatusBadge(status)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Progress bar */}
        <ProgressBar steps={steps} />

        {/* Current step indicator (when processing) */}
        {status === 'processing' && currentStep && (
          <StepIndicator steps={steps} currentStep={currentStep} />
        )}

        {/* Step grid */}
        <ProgressStepper steps={steps} currentStep={currentStep} />

        {/* Live event feed */}
        {messages.length > 0 && (
          <div className="rounded-md border border-border bg-background/60 p-3 max-h-32 overflow-y-auto">
            <MessageLog messages={messages} maxMessages={8} />
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Analysis Failed</p>
              <p className="text-xs text-destructive/80 mt-0.5 font-mono">{error}</p>
            </div>
          </div>
        )}

        {/* Actions (when processing) */}
        {status === 'processing' && (onCancel || onSwitchToPolling) && (
          <div className="flex items-center gap-2 pt-1">
            {!isConnected && !usePolling && onSwitchToPolling && (
              <Button variant="outline" size="sm" onClick={onSwitchToPolling} className="font-mono text-xs">
                <RefreshCw className="h-3 w-3 mr-1" />
                Switch to Polling
              </Button>
            )}
          </div>
        )}

        {/* Summary stats (when completed) */}
        {status === 'completed' && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <StatCard
              label="Total Time"
              value={
                totalDurationMs
                  ? totalDurationMs < 1000
                    ? `${totalDurationMs}ms`
                    : `${(totalDurationMs / 1000).toFixed(1)}s`
                  : '-'
              }
              icon={<Clock className="h-3.5 w-3.5" />}
            />
            <StatCard
              label="Steps"
              value={`${completedSteps}/${steps.length}`}
              subtext={skippedSteps > 0 ? `${skippedSteps} skipped` : undefined}
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
            />
            <StatCard
              label="Cache Hits"
              value={cacheHits.toString()}
              className={cacheHits > 0 ? 'text-blue-500' : ''}
              icon={<Zap className="h-3.5 w-3.5" />}
            />
            {failedSteps > 0 && (
              <StatCard
                label="Failed"
                value={failedSteps.toString()}
                className="text-destructive"
                icon={<XCircle className="h-3.5 w-3.5" />}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string
  value: string
  subtext?: string
  icon?: React.ReactNode
  className?: string
}

function StatCard({ label, value, subtext, icon, className }: StatCardProps) {
  return (
    <div className={cn('p-3 rounded-md bg-secondary/50 border border-border', className)}>
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="hud-label">{label}</span>
      </div>
      <p className="text-lg font-semibold hud-value">{value}</p>
      {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
    </div>
  )
}

// ─── Compact Status ───────────────────────────────────────────────────────────

interface CompactStatusProps {
  state: AnalysisState
  className?: string
}

export function CompactStatus({ state, className }: CompactStatusProps) {
  const { status, currentStep, steps } = state
  const currentConfig = currentStep ? getStepConfig(currentStep) : null
  const completedCount = steps.filter(
    (s) => s.status === 'completed' || s.status === 'skipped'
  ).length

  if (!status || status === 'queued') {
    return (
      <div className={cn('flex items-center gap-2 text-muted-foreground', className)}>
        <Clock className="h-4 w-4" />
        <span className="text-sm">Waiting to start...</span>
      </div>
    )
  }

  if (status === 'processing') {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm font-medium">{currentConfig?.label || 'Processing'}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Step {completedCount + 1}/{steps.length}
        </span>
      </div>
    )
  }

  if (status === 'completed') {
    return (
      <div className={cn('flex items-center gap-2 text-emerald-500', className)}>
        <CheckCircle2 className="h-4 w-4" />
        <span className="text-sm font-medium">Analysis Complete</span>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className={cn('flex items-center gap-2 text-destructive', className)}>
        <XCircle className="h-4 w-4" />
        <span className="text-sm font-medium">Analysis Failed</span>
      </div>
    )
  }

  return null
}

// ─── Message Log ──────────────────────────────────────────────────────────────

interface MessageLogProps {
  messages: StatusMessage[]
  maxMessages?: number
  className?: string
}

export function MessageLog({ messages, maxMessages = 10, className }: MessageLogProps) {
  const displayMessages = messages.slice(-maxMessages)

  return (
    <div className={cn('space-y-1 font-mono text-[11px]', className)}>
      {displayMessages.map((msg, i) => (
        <div key={i} className="flex items-start gap-2 text-muted-foreground">
          <span className="text-muted-foreground/50 flex-shrink-0">
            {new Date(msg.timestamp).toLocaleTimeString()}
          </span>
          <span
            className={cn(
              msg.type === 'job_completed' && 'text-emerald-500',
              msg.type === 'job_failed' && 'text-destructive',
              msg.type === 'cache_hit' && 'text-blue-500',
              msg.type === 'step_failed' && 'text-amber-500'
            )}
          >
            [{msg.type}] {JSON.stringify(msg.data)}
          </span>
        </div>
      ))}
    </div>
  )
}
