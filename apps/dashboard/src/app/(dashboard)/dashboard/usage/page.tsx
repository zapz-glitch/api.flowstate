import { getApiKeys, getUsageSummary, getUsageLogs } from '@/lib/api'
import { PLAN_LIMITS } from '@flowstate-api/db'
import { BarChart3 } from 'lucide-react'

async function getUsageData() {
  try {
    const [keys, usage, logsResponse] = await Promise.all([
      getApiKeys(),
      getUsageSummary(),
      getUsageLogs(1, 100),
    ])

    const plan = usage.plan as keyof typeof PLAN_LIMITS
    const planLimits = PLAN_LIMITS[plan]

    // Calculate success rate from recent logs
    const successfulRequests = logsResponse.logs.filter(
      (l) => l.statusCode >= 200 && l.statusCode < 300
    ).length
    const successRate =
      logsResponse.logs.length > 0
        ? Math.round((successfulRequests / logsResponse.logs.length) * 100)
        : 100

    // Calculate average response time
    const responseTimes = logsResponse.logs
      .filter((l) => l.responseTimeMs)
      .map((l) => l.responseTimeMs!)
    const avgResponseTime =
      responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0

    return {
      keys,
      logs: logsResponse.logs,
      plan,
      planLimits,
      successRate,
      avgResponseTime,
      totalUsage: usage.currentUsage,
      accountQuota: usage.monthlyLimit === -1 ? null : usage.monthlyLimit,
    }
  } catch {
    return null
  }
}

export default async function UsagePage() {
  const data = await getUsageData()

  if (!data) {
    return <div className="hud-label p-6">Loading…</div>
  }

  const quotaPercent = data.accountQuota
    ? Math.min(100, Math.round((data.totalUsage / data.accountQuota) * 100))
    : 0

  // Get requests today from logs
  const today = new Date().toISOString().split('T')[0]
  const requestsToday = data.logs.filter((l) => l.createdAt.startsWith(today)).length

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <div className="hud-label mb-2 flex items-center gap-2">
          <BarChart3 className="w-3.5 h-3.5 text-primary" />
          Metering
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Usage</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Monitor your API usage and requests
        </p>
      </div>

      {/* Account Quota */}
      <div className="ui-panel p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold text-foreground">Account Quota</h2>
          <span className="hud-label capitalize">{data.plan} plan</span>
        </div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="hud-value text-4xl font-bold text-foreground">
            {data.totalUsage.toLocaleString()}
          </span>
          <span className="text-muted-foreground font-mono text-sm">
            / {data.accountQuota ? data.accountQuota.toLocaleString() : '∞'} requests
          </span>
        </div>
        {data.accountQuota && (
          <div className="w-full bg-secondary rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full transition-all ${
                quotaPercent >= 90
                  ? 'bg-destructive shadow-[0_0_10px_hsl(var(--destructive)/0.5)]'
                  : quotaPercent >= 75
                    ? 'bg-warning shadow-[0_0_10px_hsl(var(--warning)/0.5)]'
                    : 'bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.5)]'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        )}
        {data.accountQuota && (
          <p className="hud-label mt-2">
            {data.accountQuota - data.totalUsage > 0
              ? `${(data.accountQuota - data.totalUsage).toLocaleString()} requests remaining`
              : 'Quota exceeded'}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <UsageStat
          label="Active Keys"
          value={data.keys.filter((k) => k.isActive).length.toString()}
          sub={`of ${data.planLimits.maxApiKeys === -1 ? '∞' : data.planLimits.maxApiKeys} allowed`}
        />
        <UsageStat label="Requests Today" value={requestsToday.toString()} />
        <UsageStat label="Success Rate" value={`${data.successRate}%`} sub="2xx responses" />
        <UsageStat label="Avg Response" value={`${data.avgResponseTime}ms`} />
      </div>

      {/* Per-Key Usage */}
      {data.keys.length > 0 && (
        <div className="ui-panel p-6">
          <h2 className="text-base font-semibold text-foreground mb-5">
            Usage per API Key
          </h2>
          <div className="space-y-5">
            {data.keys.map((key) => {
              const keyQuota = key.monthlyQuota || data.planLimits.monthlyRequests
              const keyPercent =
                keyQuota === -1
                  ? 0
                  : Math.min(100, Math.round((key.currentUsage / keyQuota) * 100))
              return (
                <div key={key.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground text-sm">{key.name}</span>
                      <code className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded font-mono">
                        {key.keyPrefix}…
                      </code>
                      {!key.isActive && (
                        <span className="text-xs text-destructive bg-destructive/10 px-1.5 py-0.5 rounded font-mono">
                          DISABLED
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground font-mono">
                      {key.currentUsage.toLocaleString()}{' '}
                      {keyQuota !== -1 && `/ ${keyQuota.toLocaleString()}`}
                    </span>
                  </div>
                  {keyQuota !== -1 && (
                    <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          keyPercent >= 90
                            ? 'bg-destructive'
                            : keyPercent >= 75
                              ? 'bg-warning'
                              : 'bg-primary'
                        }`}
                        style={{ width: `${keyPercent}%` }}
                      />
                    </div>
                  )}
                  {key.lastUsedAt && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      last used {new Date(key.lastUsedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent requests */}
      <div className="ui-panel overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Recent Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-5 py-3 hud-label">Time</th>
                <th className="text-left px-5 py-3 hud-label">Endpoint</th>
                <th className="text-left px-5 py-3 hud-label">Status</th>
                <th className="text-left px-5 py-3 hud-label">Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground text-sm">
                    No requests yet
                  </td>
                </tr>
              ) : (
                data.logs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="text-sm text-muted-foreground font-mono">
                        {log.endpoint}
                      </code>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : log.statusCode >= 400
                              ? 'bg-red-500/10 text-red-500'
                              : 'bg-amber-500/10 text-amber-500'
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono">
                      {log.responseTimeMs ? `${log.responseTimeMs}ms` : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function UsageStat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="ui-panel px-4 py-3.5">
      <p className="hud-label mb-1.5">{label}</p>
      <p className="hud-value text-2xl font-semibold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  )
}
