import Link from 'next/link'
import { getUsageLogs } from '@/lib/api'
import { FileText, ChevronLeft, ChevronRight, ScrollText } from 'lucide-react'

const LOGS_PER_PAGE = 50

interface SearchParams {
  page?: string
}

async function getLogsData(searchParams: SearchParams) {
  try {
    const page = parseInt(searchParams.page || '1', 10)
    const logsResponse = await getUsageLogs(page, LOGS_PER_PAGE)

    return {
      logs: logsResponse.logs,
      pagination: {
        page: logsResponse.pagination.page,
        totalPages: logsResponse.pagination.totalPages,
        totalLogs: logsResponse.pagination.total,
        hasNext: logsResponse.pagination.page < logsResponse.pagination.totalPages,
        hasPrev: logsResponse.pagination.page > 1,
      },
    }
  } catch {
    return null
  }
}

export default async function LogsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const data = await getLogsData(params)

  if (!data) {
    return <div className="hud-label p-6">Loading…</div>
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <div className="hud-label mb-2 flex items-center gap-2">
            <ScrollText className="w-3.5 h-3.5 text-primary" />
            Request History
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">API Logs</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Browse and inspect your API request history
          </p>
        </div>
        <p className="hud-label">
          {data.pagination.totalLogs.toLocaleString()} total
        </p>
      </div>

      {/* Logs table */}
      <div className="ui-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-5 py-3 hud-label">Time</th>
                <th className="text-left px-5 py-3 hud-label">Method</th>
                <th className="text-left px-5 py-3 hud-label">Endpoint</th>
                <th className="text-left px-5 py-3 hud-label">Status</th>
                <th className="text-left px-5 py-3 hud-label">Latency</th>
                <th className="text-left px-5 py-3 hud-label">Address</th>
                <th className="text-left px-5 py-3 hud-label"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No logs found</p>
                    <p className="text-xs mt-1 font-mono">make some API requests to see them here</p>
                  </td>
                </tr>
              ) : (
                data.logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-secondary/40 transition-colors group"
                  >
                    <td className="px-5 py-3.5 text-sm text-muted-foreground font-mono whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono ${
                          log.method === 'GET'
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : log.method === 'POST'
                              ? 'bg-blue-500/10 text-blue-500'
                              : log.method === 'PUT'
                                ? 'bg-amber-500/10 text-amber-500'
                                : log.method === 'DELETE'
                                  ? 'bg-red-500/10 text-red-500'
                                  : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {log.method}
                      </span>
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
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[200px] truncate">
                      {log.propertyAddress || '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/dashboard/logs/${log.id}`}
                        className="text-sm text-primary hover:opacity-80 font-mono opacity-60 group-hover:opacity-100 transition-opacity"
                      >
                        inspect →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {data.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-border">
            <p className="hud-label">
              page {data.pagination.page} / {data.pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              {data.pagination.hasPrev ? (
                <Link
                  href={`/dashboard/logs?page=${data.pagination.page - 1}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors font-mono"
                >
                  <ChevronLeft className="w-4 h-4" />
                  prev
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground/50 cursor-not-allowed font-mono">
                  <ChevronLeft className="w-4 h-4" />
                  prev
                </span>
              )}
              {data.pagination.hasNext ? (
                <Link
                  href={`/dashboard/logs?page=${data.pagination.page + 1}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors font-mono"
                >
                  next
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground/50 cursor-not-allowed font-mono">
                  next
                  <ChevronRight className="w-4 h-4" />
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
