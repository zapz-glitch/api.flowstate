'use client'

import { useEffect, useState } from 'react'
import { getApiKeys, getUsageSummary } from '@/lib/client-api'
import {
  Key,
  Activity,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Plus,
  Loader2,
  Copy,
  Check,
  Gauge,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface DashboardStats {
  apiKeysCount: number
  totalUsage: number
  totalQuota: number
  usageThisMonth: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadData() {
      try {
        const [keys, usage] = await Promise.all([getApiKeys(), getUsageSummary()])

        const totalUsage = keys.reduce((sum, key) => sum + key.currentUsage, 0)
        const totalQuota = keys.reduce((sum, key) => sum + (key.monthlyQuota || 0), 0)

        setStats({
          apiKeysCount: keys.length,
          totalUsage,
          totalQuota,
          usageThisMonth: usage.currentUsage,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const copyCode = async () => {
    const code = `curl -X POST https://api.flowstate.homes/v1/valuation/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "streetAddress": "123 Main St",
    "city": "Austin",
    "state": "TX"
  }'`
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="hud-label">Loading telemetry…</p>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-md bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-destructive" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load data</h3>
          <p className="text-sm text-muted-foreground mb-4">{error || 'An unexpected error occurred'}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const usagePercent =
    stats.totalQuota > 0 ? Math.round((stats.totalUsage / stats.totalQuota) * 100) : 0

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="hud-label mb-2 flex items-center gap-2">
            <Gauge className="w-3.5 h-3.5 text-primary" />
            Telemetry
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Overview</h1>
          <p className="text-muted-foreground mt-1 text-sm">API usage, quota, and account activity at a glance</p>
        </div>
        <Link
          href="/dashboard/api-keys?create=true"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-primary text-primary-foreground font-medium text-sm shadow-[0_0_20px_hsl(var(--primary)/0.3)] hover:opacity-90 transition-all duration-200 font-mono uppercase tracking-wider"
        >
          <Plus className="w-4 h-4" />
          New Key
        </Link>
      </div>

      {/* Telemetry grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <TelemetryCard
          label="API Keys"
          value={stats.apiKeysCount.toString()}
          icon={Key}
          href="/dashboard/api-keys"
        />
        <TelemetryCard
          label="This Month"
          value={stats.usageThisMonth.toLocaleString()}
          icon={Activity}
          href="/dashboard/usage"
        />
        <TelemetryCard
          label="Total Usage"
          value={stats.totalUsage.toLocaleString()}
          icon={TrendingUp}
          href="/dashboard/usage"
        />
        <TelemetryCard
          label="Quota Used"
          value={`${usagePercent}%`}
          icon={AlertTriangle}
          alert={usagePercent > 80}
        />
      </div>

      {/* Quick Start */}
      <div className="ui-panel overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Quick Start</h2>
            <p className="hud-label mt-1">First request in under a minute</p>
          </div>
          <span className="hud-label opacity-60 hidden sm:block">00:INIT</span>
        </div>

        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-md border border-primary/50 bg-primary/10 text-primary flex items-center justify-center text-sm font-bold font-mono">
                01
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Create an API Key</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Generate your first API key to authenticate requests.
                </p>
                <Link
                  href="/dashboard/api-keys?create=true"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-colors"
                >
                  Create Key
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-md border border-emerald-500/50 bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-sm font-bold font-mono">
                02
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Make Your First Request</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Use your API key to analyze property valuations.
                </p>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:opacity-80 transition-colors"
                >
                  View Documentation
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Terminal block */}
          <div className="rounded-md border border-border overflow-hidden hud-frame">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-400/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400/80" />
                </div>
                <span className="hud-label ml-2">bash — example</span>
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors font-mono"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    copy
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-sm text-foreground/90 overflow-x-auto font-mono bg-background/60">
              <code>{`curl -X POST https://api.flowstate.homes/v1/valuation/analyze \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "streetAddress": "123 Main St",
    "city": "Austin",
    "state": "TX"
  }'`}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

function TelemetryCard({
  label,
  value,
  icon: Icon,
  href,
  alert = false,
}: {
  label: string
  value: string
  icon: React.ElementType
  href?: string
  alert?: boolean
}) {
  const content = (
    <div
      className={cn(
        'ui-panel hud-frame px-4 py-3.5',
        href && 'cursor-pointer',
        alert && 'border-warning/50'
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="hud-label">{label}</span>
        <Icon className={cn('w-4 h-4', alert ? 'text-warning' : 'text-primary')} />
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn('hud-value text-2xl font-semibold', alert && 'text-warning')}>{value}</p>
        {href && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
