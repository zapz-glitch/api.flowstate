import { getApiKeys, getUsageSummary, getUsageLogs } from '@/lib/api'
import { PLAN_LIMITS } from '@flowstate-api/db'

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
    return <div>Loading...</div>
  }

  const quotaPercent = data.accountQuota
    ? Math.min(100, Math.round((data.totalUsage / data.accountQuota) * 100))
    : 0

  // Get requests today from logs
  const today = new Date().toISOString().split('T')[0]
  const requestsToday = data.logs.filter((l) => l.createdAt.startsWith(today)).length

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">Usage</h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          Monitor your API usage and requests
        </p>
      </div>

      {/* Account Quota Progress */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Account Quota</h2>
          <span className="text-sm font-medium text-neutral-600 dark:text-neutral-400 capitalize">
            {data.plan} Plan
          </span>
        </div>
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-3xl font-bold text-neutral-900 dark:text-white">
            {data.totalUsage.toLocaleString()}
          </span>
          <span className="text-neutral-500">
            / {data.accountQuota ? data.accountQuota.toLocaleString() : 'Unlimited'} requests
          </span>
        </div>
        {data.accountQuota && (
          <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                quotaPercent >= 90
                  ? 'bg-red-500'
                  : quotaPercent >= 75
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>
        )}
        {data.accountQuota && (
          <p className="text-sm text-neutral-500 mt-2">
            {data.accountQuota - data.totalUsage > 0
              ? `${(data.accountQuota - data.totalUsage).toLocaleString()} requests remaining`
              : 'Quota exceeded'}
          </p>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Active Keys</p>
          <p className="text-3xl font-bold text-neutral-900 dark:text-white mt-1">
            {data.keys.filter((k) => k.isActive).length}
          </p>
          <p className="text-sm text-neutral-500 mt-1">
            of {data.planLimits.maxApiKeys === -1 ? '∞' : data.planLimits.maxApiKeys} allowed
          </p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Requests Today</p>
          <p className="text-3xl font-bold text-neutral-900 dark:text-white mt-1">{requestsToday}</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Success Rate</p>
          <p className="text-3xl font-bold text-neutral-900 dark:text-white mt-1">
            {data.successRate}%
          </p>
          <p className="text-sm text-neutral-500 mt-1">2xx responses</p>
        </div>

        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <p className="text-sm text-neutral-600 dark:text-neutral-400">Avg Response Time</p>
          <p className="text-3xl font-bold text-neutral-900 dark:text-white mt-1">
            {data.avgResponseTime}ms
          </p>
        </div>
      </div>

      {/* Per-Key Usage */}
      {data.keys.length > 0 && (
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            Usage per API Key
          </h2>
          <div className="space-y-4">
            {data.keys.map((key) => {
              const keyQuota = key.monthlyQuota || data.planLimits.monthlyRequests
              const keyPercent =
                keyQuota === -1
                  ? 0
                  : Math.min(100, Math.round((key.currentUsage / keyQuota) * 100))
              return (
                <div key={key.id}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-neutral-900 dark:text-white">{key.name}</span>
                      <code className="text-xs text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded">
                        {key.keyPrefix}...
                      </code>
                      {!key.isActive && (
                        <span className="text-xs text-red-500 bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded">
                          Disabled
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-neutral-600 dark:text-neutral-400">
                      {key.currentUsage.toLocaleString()}{' '}
                      {keyQuota !== -1 && `/ ${keyQuota.toLocaleString()}`}
                    </span>
                  </div>
                  {keyQuota !== -1 && (
                    <div className="w-full bg-neutral-200 dark:bg-neutral-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          keyPercent >= 90
                            ? 'bg-red-500'
                            : keyPercent >= 75
                              ? 'bg-yellow-500'
                              : 'bg-blue-500'
                        }`}
                        style={{ width: `${keyPercent}%` }}
                      />
                    </div>
                  )}
                  {key.lastUsedAt && (
                    <p className="text-xs text-neutral-500 mt-1">
                      Last used: {new Date(key.lastUsedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent requests */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Recent Requests</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Time
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Endpoint
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Response Time
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-neutral-500">
                    No requests yet
                  </td>
                </tr>
              ) : (
                data.logs.slice(0, 20).map((log) => (
                  <tr key={log.id}>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm text-neutral-600 dark:text-neutral-400 font-mono">
                        {log.endpoint}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : log.statusCode >= 400
                              ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        }`}
                      >
                        {log.statusCode}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                      {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
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
