'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Play,
  MapPin,
  Home,
  Star,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Code,
  RefreshCw,
  StopCircle,
  TerminalSquare,
  Crosshair,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  queueAnalysis,
  getJobStatus,
  type AnalyzeData,
  type CompItem,
  type SubjectData,
  type ValuationData,
  type CompsData,
  type ClassificationSummary,
} from './actions'
import { useAnalysisWebSocket, useAnalysisPolling } from '@/hooks/use-analysis-websocket'
import { RealtimeStatus } from '@/components/analysis/RealtimeStatus'
import type { AnalysisState } from '@/types/analysis'

// ─── Helper Functions for Formatting ─────────────────────────────────────────

const FILTER_TYPE_LABELS: Record<string, string> = {
  subdivision_match: 'Subdivision Match',
  sale_age: 'Sale Age',
  sqft_diff: 'Sqft Difference',
  year_built_diff: 'Year Built Diff',
  distance: 'Distance',
}

const ADJUSTMENT_TYPE_LABELS: Record<string, string> = {
  old_comp_discount: 'Old Comp Discount',
  bedroom: 'Bedroom Adjustment',
  bathroom: 'Bathroom Adjustment',
  pool: 'Pool Adjustment',
  garage: 'Garage Adjustment',
  carport: 'Carport Adjustment',
}

function formatFilterType(type: string): string {
  return FILTER_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatAdjustmentType(type: string): string {
  return ADJUSTMENT_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// ─── Classification Badge Component ─────────────────────────────────────────

function ClassificationBadge({ classification, showConfidence = true }: { classification: ClassificationSummary | null | undefined; showConfidence?: boolean }) {
  if (!classification) return null

  const getClassificationStyle = (type: string) => {
    switch (type) {
      case 'as_is':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
      case 'after_renovation':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
      case 'transitional':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
      default:
        return 'bg-secondary text-muted-foreground border-border'
    }
  }

  const getClassificationLabel = (type: string) => {
    switch (type) {
      case 'as_is':
        return 'As-Is'
      case 'after_renovation':
        return 'Renovated'
      case 'transitional':
        return 'Transitional'
      default:
        return type
    }
  }

  return (
    <Badge variant="outline" className={cn('font-medium', getClassificationStyle(classification.type))}>
      {getClassificationLabel(classification.type)}
      {showConfidence && classification.confidence > 0 && (
        <span className="ml-1 opacity-70">({classification.confidence}%)</span>
      )}
    </Badge>
  )
}

export default function AnalyzePage() {
  const [address, setAddress] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [skipCache, setSkipCache] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    data?: AnalyzeData
    error?: string
    timing?: { durationMs: number }
  } | null>(null)
  const [showRawJson, setShowRawJson] = useState(false)

  // Real-time analysis state
  const [streamUrl, setStreamUrl] = useState<string | null>(null)
  const [pollUrl, setPollUrl] = useState<string | null>(null)
  const [propertyKey, setPropertyKey] = useState<string | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [usePolling, setUsePolling] = useState(false)

  // Handle real-time completion
  const handleRealtimeComplete = useCallback(async (completionData: unknown) => {
    // Fetch full result via polling endpoint
    if (jobId && propertyKey) {
      const statusResult = await getJobStatus(jobId, propertyKey)
      if (statusResult.success && statusResult.data?.result) {
        setResult({
          success: true,
          data: statusResult.data.result,
          timing: { durationMs: statusResult.data.totalDurationMs || 0 },
        })
      }
    }
    setIsRunning(false)
  }, [jobId, propertyKey])

  // Handle real-time error
  const handleRealtimeError = useCallback((error: string) => {
    setResult({ success: false, error })
    setIsRunning(false)
  }, [])

  // WebSocket hook
  const {
    state: wsState,
    connect: wsConnect,
    disconnect: wsDisconnect,
    reset: wsReset,
    isConnecting,
  } = useAnalysisWebSocket({
    url: streamUrl,
    propertyKey,
    onComplete: handleRealtimeComplete,
    onError: handleRealtimeError,
    autoReconnect: false,
  })

  // Polling hook (fallback)
  const { state: pollState, isPolling, reset: pollReset } = useAnalysisPolling({
    url: pollUrl,
    propertyKey,
    enabled: usePolling && isRunning,
    onComplete: handleRealtimeComplete,
  })

  // Use WebSocket state or polling state
  const analysisState: AnalysisState = usePolling ? pollState : wsState

  // Connect to WebSocket when streamUrl is available
  useEffect(() => {
    if (streamUrl && propertyKey && !usePolling) {
      wsConnect()
    }
  }, [streamUrl, propertyKey, usePolling, wsConnect])

  // Analysis handler (async with real-time updates)
  const handleAnalyze = async () => {
    if (!address.trim()) return

    setIsRunning(true)
    setResult(null)
    setStreamUrl(null)
    setPollUrl(null)
    setPropertyKey(null)
    setJobId(null)
    setUsePolling(false)
    wsReset()
    pollReset()

    try {
      const response = await queueAnalysis({
        address: address.trim(),
        photoAnalysis: { enabled: true, maxComps: 10, requireBetterOrEqual: true },
        searchOptions: {
          radiusMiles: 1,
          maxComps: 10,
          monthsBack: 12,
        },
        skipCache,
      })

      if (response.success && response.streamUrl && response.propertyKey) {
        setJobId(response.jobId || null)
        setStreamUrl(response.streamUrl)
        setPollUrl(response.pollUrl || null)
        setPropertyKey(response.propertyKey)
        // WebSocket will connect via useEffect
      } else {
        setResult({ success: false, error: response.error || 'Failed to queue analysis' })
        setIsRunning(false)
      }
    } catch (error) {
      setResult({ success: false, error: error instanceof Error ? error.message : 'Failed to start analysis' })
      setIsRunning(false)
    }
  }

  // Cancel running analysis
  const handleCancel = () => {
    wsDisconnect()
    setIsRunning(false)
    setStreamUrl(null)
    setPollUrl(null)
    setPropertyKey(null)
    setJobId(null)
  }

  // Switch to polling fallback
  const handleSwitchToPolling = () => {
    wsDisconnect()
    setUsePolling(true)
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="hud-label mb-2 flex items-center gap-2">
            <TerminalSquare className="w-3.5 h-3.5 text-primary" />
            POST /v1/analyze
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
            Analysis Console
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Submit a target address — the engine returns valuation, comps, and a verdict.
          </p>
        </div>
        {result?.success && result.timing && (
          <div className="hud-label flex items-center gap-2">
            <span className="hud-dot live" />
            completed in {result.timing.durationMs}ms
          </div>
        )}
      </div>

      {/* Command input */}
      <div className={cn('ui-panel hud-frame overflow-hidden', isRunning && 'border-primary/40')}>
        {isRunning && <div className="scan-sweep" />}
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="hud-dot busy" />
            <span className="hud-label">Target Input</span>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="skip-cache"
              checked={skipCache}
              onCheckedChange={setSkipCache}
            />
            <label htmlFor="skip-cache" className="hud-label flex items-center gap-1.5 cursor-pointer">
              <RefreshCw className="w-3 h-3" />
              skip-cache
            </label>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-3 rounded-md border border-border bg-secondary/60 px-4 focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/30 transition-all">
              <span className="font-mono text-primary text-sm select-none">❯</span>
              <input
                type="text"
                placeholder="123 Main St, Tampa, FL 33607"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isRunning) {
                    handleAnalyze()
                  }
                }}
                className="flex-1 h-12 bg-transparent font-mono text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
              {address && <Crosshair className="w-4 h-4 text-muted-foreground" />}
            </div>
            {isRunning ? (
              <Button variant="destructive" onClick={handleCancel} className="h-12 px-6 font-mono uppercase tracking-wider">
                <StopCircle className="w-4 h-4 mr-2" />
                Abort
              </Button>
            ) : (
              <Button
                onClick={handleAnalyze}
                disabled={isRunning || !address.trim()}
                className="h-12 px-6 font-mono uppercase tracking-wider shadow-[0_0_20px_hsl(var(--primary)/0.35)]"
              >
                <Play className="w-4 h-4 mr-2" />
                Execute
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Real-time pipeline */}
      {isRunning && (
        <RealtimeStatus
          state={analysisState}
          isConnecting={isConnecting}
          onCancel={handleCancel}
          onSwitchToPolling={handleSwitchToPolling}
          usePolling={usePolling}
        />
      )}

      {/* Results */}
      {result && (
        <>
          {result.success && result.data ? (
            <div className="space-y-6 animate-in fade-in duration-500">
              {/* Verdict banner */}
              {result.data.valuation && <VerdictBanner valuation={result.data.valuation} />}

              {/* Subject + Valuation side by side */}
              <div className="grid lg:grid-cols-2 gap-6">
                {result.data.subject && <SubjectPropertyCard subject={result.data.subject} />}
                {result.data.valuation && <ValuationCard valuation={result.data.valuation} />}
              </div>

              {/* Risk Flags */}
              {result.data.riskFlags && result.data.riskFlags.length > 0 && (
                <RiskFlagsCard riskFlags={result.data.riskFlags} />
              )}

              {/* Comparables */}
              {result.data.comps && <ComparablesSection comps={result.data.comps} />}

              {/* Raw JSON Toggle */}
              <Card>
                <CardHeader className="cursor-pointer" onClick={() => setShowRawJson(!showRawJson)}>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {showRawJson ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    <Code className="w-4 h-4" />
                    Raw JSON Response
                  </CardTitle>
                </CardHeader>
                {showRawJson && (
                  <CardContent>
                    <pre className="bg-zinc-950 text-zinc-100 rounded-lg p-4 overflow-auto max-h-[600px] text-xs font-mono">
                      {JSON.stringify(result.data, null, 2)}
                    </pre>
                  </CardContent>
                )}
              </Card>
            </div>
          ) : (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardContent className="py-6">
                <div className="flex items-center gap-2 text-destructive font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  Analysis Error
                </div>
                <div className="text-muted-foreground mt-1 text-sm font-mono">{result.error}</div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}

// ─── Verdict Banner ───────────────────────────────────────────────────────────

function VerdictBanner({ valuation }: { valuation: ValuationData }) {
  const rec = valuation.recommendation?.toUpperCase() || ''
  const isPursue = rec.includes('PURSUE') || rec.includes('BUY')
  const isPass = rec.includes('PASS') || rec.includes('AVOID')

  return (
    <div
      className={cn(
        'ui-panel relative overflow-hidden p-5 sm:p-6',
        isPursue && 'border-emerald-500/40',
        isPass && 'border-destructive/40',
        !isPursue && !isPass && 'border-warning/40'
      )}
    >
      <div
        className={cn(
          'absolute inset-0 opacity-[0.07] pointer-events-none',
          isPursue && 'bg-gradient-to-r from-emerald-500 to-transparent',
          isPass && 'bg-gradient-to-r from-red-500 to-transparent',
          !isPursue && !isPass && 'bg-gradient-to-r from-amber-500 to-transparent'
        )}
      />
      <div className="relative flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
        <div>
          <div className="hud-label mb-1.5">Verdict</div>
          <div
            className={cn(
              'flex items-center gap-2 text-xl sm:text-2xl font-bold tracking-tight',
              isPursue && 'text-emerald-500',
              isPass && 'text-destructive',
              !isPursue && !isPass && 'text-warning'
            )}
          >
            {isPursue ? <TrendingUp className="w-6 h-6" /> : isPass ? <TrendingDown className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            {valuation.recommendation || 'PENDING'}
          </div>
          {valuation.recommendationReason && (
            <p className="text-sm text-muted-foreground mt-1 max-w-md">{valuation.recommendationReason}</p>
          )}
        </div>
        <div className="flex gap-6 sm:gap-10 sm:ml-auto">
          <div>
            <div className="hud-label mb-1">ARV</div>
            <div className="hud-value text-2xl sm:text-3xl font-bold text-primary glow-text">
              {valuation.arv ? formatCurrency(valuation.arv) : '—'}
            </div>
          </div>
          <div>
            <div className="hud-label mb-1">Max Buy</div>
            <div className="hud-value text-2xl sm:text-3xl font-bold">
              {valuation.buyPrice ? formatCurrency(valuation.buyPrice) : '—'}
            </div>
          </div>
          <div>
            <div className="hud-label mb-1">Proj. Profit</div>
            <div
              className={cn(
                'hud-value text-2xl sm:text-3xl font-bold',
                (valuation.projectedProfit ?? 0) > 0 ? 'text-emerald-500' : 'text-destructive'
              )}
            >
              {valuation.projectedProfit ? formatCurrency(valuation.projectedProfit) : '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Subject Property Card ────────────────────────────────────────────────────

function SubjectPropertyCard({ subject }: { subject: SubjectData }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Subject Property
          </CardTitle>
          {subject.classification && (
            <ClassificationBadge classification={subject.classification} />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <div className="col-span-2">
            <div className="hud-label mb-1">Address</div>
            <div className="font-medium">{subject.address || 'Unknown'}</div>
            {subject.subdivision && <div className="text-sm text-muted-foreground">{subject.subdivision}</div>}
            {subject.county && <div className="text-sm text-muted-foreground">{subject.county} County</div>}
          </div>
          <DataCell label="Beds / Baths" value={subject.bedsBaths || '?'} />
          <DataCell label="Square Feet" value={subject.squareFeet ? `${subject.squareFeet.toLocaleString()} sqft` : '?'} />
          <DataCell label="Year Built" value={subject.yearBuilt?.toString() || '?'} />
          <DataCell label="Lot Size" value={subject.lotSizeAcres ? `${subject.lotSizeAcres} ac` : '?'} />
          {subject.lastSale && (
            <>
              <DataCell
                label="Last Sale"
                value={subject.lastSale.price ? formatCurrency(subject.lastSale.price) : '?'}
                sub={subject.lastSale.date || undefined}
              />
              {subject.lastSale.pricePerSqft && (
                <DataCell label="$/SqFt" value={`$${subject.lastSale.pricePerSqft.toFixed(0)}`} />
              )}
            </>
          )}
        </div>

        {/* Subject Photos */}
        {subject.photos && subject.photos.length > 0 && (
          <div className="mt-5">
            <div className="hud-label mb-2">Photos ({subject.photos.length})</div>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {subject.photos.slice(0, 6).map((photo, i) => (
                <img
                  key={i}
                  src={photo}
                  alt={`Subject photo ${i + 1}`}
                  className="w-28 h-20 object-cover rounded border border-border flex-shrink-0"
                  onError={(e) => {
                    ;(e.target as HTMLImageElement).style.display = 'none'
                  }}
                />
              ))}
              {subject.photos.length > 6 && (
                <div className="w-28 h-20 bg-secondary rounded border border-border flex items-center justify-center text-sm text-muted-foreground flex-shrink-0">
                  +{subject.photos.length - 6} more
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function DataCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="hud-label mb-1">{label}</div>
      <div className="font-medium hud-value">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  )
}

// ─── Risk Flags Card ──────────────────────────────────────────────────────────

function RiskFlagsCard({ riskFlags }: { riskFlags: string[] }) {
  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning">
          <AlertTriangle className="w-5 h-5" />
          Risk Flags
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {riskFlags.map((flag, i) => (
            <Badge key={i} variant="outline" className="bg-warning/10 text-warning border-warning/30 font-mono text-xs">
              {flag}
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Valuation Card ───────────────────────────────────────────────────────────

function ValuationCard({ valuation }: { valuation: ValuationData }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Underwriter Valuation
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-x-4 gap-y-5">
          <DataCell
            label="ARV"
            value={valuation.arv ? formatCurrency(valuation.arv) : '?'}
            sub={valuation.arvPerSqft ? `$${valuation.arvPerSqft.toFixed(0)}/sqft` : valuation.arvSource}
          />
          <DataCell
            label="Max Buy Price"
            value={valuation.buyPrice ? formatCurrency(valuation.buyPrice) : '?'}
            sub={valuation.buyPricePercent ? `${valuation.buyPricePercent}% of ARV` : undefined}
          />
          <DataCell
            label="Rehab Cost"
            value={valuation.rehabCost ? formatCurrency(valuation.rehabCost) : '?'}
            sub={valuation.rehabLevel ? `${valuation.rehabLevel}${valuation.rehabPerSqft ? ` · $${valuation.rehabPerSqft}/sqft` : ''}` : undefined}
          />
          <DataCell
            label="Projected ROI"
            value={valuation.projectedROI ? `${valuation.projectedROI.toFixed(1)}%` : '?'}
            sub={valuation.projectedProfit ? formatCurrency(valuation.projectedProfit) : undefined}
          />
        </div>

        {/* Investment Summary Row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-border">
          {valuation.totalCosts !== undefined && (
            <DataCell label="Total Costs" value={formatCurrency(valuation.totalCosts)} />
          )}
          {valuation.totalInvestment !== undefined && (
            <DataCell label="Total Investment" value={formatCurrency(valuation.totalInvestment)} />
          )}
          {valuation.wholesalePrice !== undefined && (
            <DataCell label="Wholesale" value={formatCurrency(valuation.wholesalePrice)} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Comparables Section ──────────────────────────────────────────────────────

function ComparablesSection({ comps }: { comps: CompsData }) {
  const [expandedComps, setExpandedComps] = useState<Set<number>>(new Set())

  const toggleComp = (index: number) => {
    const newExpanded = new Set(expandedComps)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedComps(newExpanded)
  }

  const compItems = comps.items || []

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="flex items-center gap-2">
            <Home className="w-5 h-5 text-primary" />
            Comparables
            <span className="hud-value text-muted-foreground font-normal">
              ({comps.count || compItems.length})
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {comps.medianPrice && (
              <Badge variant="outline" className="font-mono">med {formatCurrency(comps.medianPrice)}</Badge>
            )}
            {comps.avgPricePerSqft && (
              <Badge variant="outline" className="font-mono">avg ${comps.avgPricePerSqft.toFixed(0)}/sqft</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {compItems.map((comp, index) => {
          const isExpanded = expandedComps.has(index)

          return (
            <CompCard key={index} comp={comp} index={index} isExpanded={isExpanded} onToggle={() => toggleComp(index)} />
          )
        })}
      </CardContent>
    </Card>
  )
}

// ─── Individual Comp Card ─────────────────────────────────────────────────────

function CompCard({
  comp,
  index,
  isExpanded,
  onToggle,
}: {
  comp: CompItem
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const weightPct = comp.weightInArv !== null && comp.weightInArv !== undefined
    ? Math.round(comp.weightInArv * 100)
    : null

  return (
    <div
      className={cn(
        'border rounded-md transition-all overflow-hidden',
        comp.isBestComp
          ? 'border-amber-500/50 bg-amber-500/5 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
          : 'border-border bg-secondary/30 hover:border-primary/30'
      )}
    >
      {/* Comp Header */}
      <div className="p-4 cursor-pointer" onClick={onToggle}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="mt-0.5 w-7 h-7 rounded border border-border bg-background flex items-center justify-center text-xs font-mono font-medium text-primary flex-shrink-0">
              {String(index + 1).padStart(2, '0')}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{comp.address || 'Unknown Address'}</span>
                {comp.isBestComp && (
                  <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">
                    <Star className="w-3 h-3 mr-1" />
                    Best Comp
                  </Badge>
                )}
                {comp.condition && (
                  <Badge
                    variant="outline"
                    className={cn(
                      comp.condition === 'better' && 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
                      comp.condition === 'similar' && 'bg-blue-500/10 text-blue-600 border-blue-500/30',
                      comp.condition === 'worse' && 'bg-red-500/10 text-red-600 border-red-500/30'
                    )}
                  >
                    {comp.condition}
                  </Badge>
                )}
                {comp.classification && (
                  <ClassificationBadge classification={comp.classification} showConfidence={false} />
                )}
              </div>
              <div className="flex gap-3 mt-1.5 text-xs text-muted-foreground font-mono flex-wrap">
                <span>{comp.bedsBaths || '?'}</span>
                <span>{comp.squareFeet?.toLocaleString() || '?'} sqft</span>
                <span>blt {comp.yearBuilt || '?'}</span>
                {comp.distanceMiles !== undefined && comp.distanceMiles !== null && (
                  <span>{comp.distanceMiles.toFixed(2)} mi</span>
                )}
                {comp.saleDate && <span>{new Date(comp.saleDate).toLocaleDateString()}</span>}
                {comp.qualityScore !== undefined && comp.qualityScore !== null && (
                  <span className="text-primary">Q{comp.qualityScore}</span>
                )}
              </div>
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="hud-value font-bold text-lg">
              {comp.salePrice ? formatCurrency(comp.salePrice) : '?'}
            </div>
            {comp.pricePerSqft && (
              <div className="text-xs text-muted-foreground font-mono">${comp.pricePerSqft.toFixed(0)}/sf</div>
            )}
            {comp.adjustedPrice && comp.salePrice !== comp.adjustedPrice && (
              <div className="text-xs text-emerald-500 font-mono">adj {formatCurrency(comp.adjustedPrice)}</div>
            )}
            <div className="flex items-center justify-end mt-1 text-muted-foreground">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </div>
          </div>
        </div>

        {/* ARV weight bar */}
        {weightPct !== null && (
          <div className="mt-3 flex items-center gap-3">
            <div className="hud-label w-16 flex-shrink-0">ARV wt.</div>
            <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(100, weightPct)}%` }}
              />
            </div>
            <span className="text-xs font-mono text-primary w-10 text-right">{weightPct}%</span>
          </div>
        )}
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t border-border px-4 py-4 bg-background/40 space-y-4">
          {/* Subdivision */}
          {comp.subdivision && (
            <div>
              <div className="hud-label mb-1">Subdivision</div>
              <div className="text-sm">{comp.subdivision}</div>
            </div>
          )}

          {/* Classification Details */}
          {comp.classification && (
            <div>
              <div className="hud-label mb-1 flex items-center gap-2">
                Classification
                <ClassificationBadge classification={comp.classification} />
              </div>
              <div className="text-sm text-foreground/80 mt-1">{comp.classification.reasoning}</div>
            </div>
          )}

          {/* Selection Reason / Analysis */}
          {comp.selectionReason && (
            <div>
              <div className="hud-label mb-1">
                {comp.isBestComp ? 'Why Best Comp' : 'Analysis'}
              </div>
              <div className="text-sm text-foreground/80">{comp.selectionReason}</div>
            </div>
          )}

          {/* Key Features */}
          {comp.keyFeatures && comp.keyFeatures.length > 0 && (
            <div>
              <div className="hud-label mb-1.5">Key Features</div>
              <div className="flex flex-wrap gap-1.5">
                {comp.keyFeatures.map((feature, i) => (
                  <Badge key={i} variant="outline" className="text-xs font-mono">
                    {feature}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Appraisal Rules */}
          {comp.appraisalRules && (
            <div className="space-y-2.5">
              <div className="hud-label">Appraisal Rules</div>

              {/* Filters */}
              <div className="grid gap-1">
                {comp.appraisalRules.filters.map((filter, i) => (
                  <div
                    key={i}
                    className={cn(
                      'text-xs px-2.5 py-1.5 rounded flex items-center justify-between font-mono',
                      filter.passed ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-500/10 text-red-600 dark:text-red-400'
                    )}
                  >
                    <span>{formatFilterType(filter.type)}</span>
                    <span>
                      {filter.passed ? '✓' : '✗'}
                      {filter.actualValue !== null && filter.actualValue !== undefined && (
                        <span className="ml-1 opacity-70">
                          ({String(filter.actualValue)}{filter.threshold ? ` / ${filter.threshold}` : ''})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>

              {/* Adjustments */}
              {comp.appraisalRules.adjustments.length > 0 && (
                <div className="space-y-1">
                  <div className="hud-label">Price Adjustments</div>
                  <div className="grid gap-1">
                    {comp.appraisalRules.adjustments.map((adj, i) => (
                      <div
                        key={i}
                        className="text-xs px-2.5 py-1.5 rounded bg-secondary text-foreground/80 flex items-center justify-between font-mono"
                      >
                        <span>{formatAdjustmentType(adj.type)}</span>
                        <span className={adj.amount >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                          {adj.amount >= 0 ? '+' : ''}{formatCurrency(adj.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="text-xs text-right text-muted-foreground font-mono">
                    Total Adjustment:{' '}
                    <span className={comp.appraisalRules.totalAdjustment >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                      {comp.appraisalRules.totalAdjustment >= 0 ? '+' : ''}
                      {formatCurrency(comp.appraisalRules.totalAdjustment)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Photos */}
          {comp.photos && comp.photos.length > 0 && (
            <div>
              <div className="hud-label mb-2">Photos</div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {comp.photos.slice(0, 5).map((photo, i) => (
                  <img
                    key={i}
                    src={photo}
                    alt={`Comp photo ${i + 1}`}
                    className="w-24 h-16 object-cover rounded border border-border flex-shrink-0"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ))}
                {comp.photos.length > 5 && (
                  <div className="w-24 h-16 bg-secondary rounded border border-border flex items-center justify-center text-sm text-muted-foreground flex-shrink-0">
                    +{comp.photos.length - 5} more
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
