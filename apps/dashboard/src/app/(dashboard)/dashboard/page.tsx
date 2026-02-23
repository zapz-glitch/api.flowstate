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
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">Failed to load data</h3>
          <p className="text-sm text-muted-foreground mb-4">{error || 'An unexpected error occurred'}</p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
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
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your API usage and activity</p>
        </div>
        <Link
          href="/dashboard/api-keys?create=true"
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-purple-600 text-white font-medium text-sm shadow-lg shadow-purple-600/20 hover:bg-purple-700 hover:shadow-purple-600/30 transition-all duration-200"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="API Keys"
          value={stats.apiKeysCount.toString()}
          icon={Key}
          color="purple"
          href="/dashboard/api-keys"
        />
        <StatCard
          title="This Month"
          value={stats.usageThisMonth.toLocaleString()}
          icon={Activity}
          color="emerald"
          href="/dashboard/usage"
        />
        <StatCard
          title="Total Usage"
          value={stats.totalUsage.toLocaleString()}
          icon={TrendingUp}
          color="blue"
          href="/dashboard/usage"
        />
        <StatCard
          title="Quota Used"
          value={`${usagePercent}%`}
          icon={AlertTriangle}
          color={usagePercent > 80 ? 'amber' : 'slate'}
        />
      </div>

      {/* Quick Start Section */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Quick Start</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Get started with the Flowstate API in minutes</p>
        </div>

        <div className="p-6">
          <div className="grid gap-6 md:grid-cols-2 mb-6">
            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center text-sm font-bold">
                1
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Create an API Key</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Generate your first API key to authenticate requests.
                </p>
                <Link
                  href="/dashboard/api-keys?create=true"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                  Create Key
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-bold">
                2
              </div>
              <div>
                <h3 className="font-medium text-foreground mb-1">Make Your First Request</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Use your API key to analyze property valuations.
                </p>
                <Link
                  href="/docs"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                  View Documentation
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>

          {/* Code Example */}
          <div className="rounded-lg border border-border overflow-hidden bg-secondary/30">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/50">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                  <div className="w-3 h-3 rounded-full bg-green-400/80" />
                </div>
                <span className="text-xs text-muted-foreground font-medium ml-2">terminal</span>
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-green-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-sm text-foreground/90 overflow-x-auto font-mono">
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

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  href,
}: {
  title: string
  value: string
  icon: React.ElementType
  color: 'purple' | 'emerald' | 'blue' | 'amber' | 'slate'
  href?: string
}) {
  const colorStyles = {
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-500' },
    emerald: { bg: 'bg-emerald-500/10', icon: 'text-emerald-500' },
    blue: { bg: 'bg-blue-500/10', icon: 'text-blue-500' },
    amber: { bg: 'bg-amber-500/10', icon: 'text-amber-500' },
    slate: { bg: 'bg-slate-500/10', icon: 'text-slate-500' },
  }

  const styles = colorStyles[color]

  const content = (
    <div
      className={cn(
        'rounded-lg border border-border bg-card px-3 py-2.5 transition-all duration-200',
        href && 'hover:border-border/80 hover:shadow-sm cursor-pointer'
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0', styles.bg)}>
          <Icon className={cn('w-4 h-4', styles.icon)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-muted-foreground leading-none mb-0.5">{title}</p>
          <p className="text-lg font-semibold text-foreground leading-tight">{value}</p>
        </div>
        {href && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{content}</Link>
  }

  return content
}
