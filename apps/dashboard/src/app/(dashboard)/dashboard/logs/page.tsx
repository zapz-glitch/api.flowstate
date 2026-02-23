import Link from 'next/link'
import { getUsageLogs } from '@/lib/api'
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react'

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
    return <div>Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Logs</h1>
          <p className="text-muted-foreground mt-1">
            Browse and inspect your API request history
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {data.pagination.totalLogs.toLocaleString()} total logs
        </p>
      </div>

      {/* Logs table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                  Time
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                  Method
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                  Endpoint
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                  Response Time
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                  Address
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-muted-foreground">
                  Details
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No logs found</p>
                    <p className="text-sm mt-1">Make some API requests to see them here</p>
                  </td>
                </tr>
              ) : (
                data.logs.map((log) => (
                  <tr
                    key={log.id}
                    className="hover:bg-secondary/50 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
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
                    <td className="px-6 py-4">
                      <code className="text-sm text-muted-foreground font-mono">
                        {log.endpoint}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
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
                    <td className="px-6 py-4 text-sm text-muted-foreground">
                      {log.responseTimeMs ? `${log.responseTimeMs}ms` : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground max-w-[200px] truncate">
                      {log.propertyAddress || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <Link
                        href={`/dashboard/logs/${log.id}`}
                        className="text-sm text-purple-500 hover:text-purple-400"
                      >
                        View
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
          <div className="flex items-center justify-between px-6 py-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Page {data.pagination.page} of {data.pagination.totalPages}
            </p>
            <div className="flex items-center gap-2">
              {data.pagination.hasPrev ? (
                <Link
                  href={`/dashboard/logs?page=${data.pagination.page - 1}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground/50 cursor-not-allowed">
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </span>
              )}
              {data.pagination.hasNext ? (
                <Link
                  href={`/dashboard/logs?page=${data.pagination.page + 1}`}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </Link>
              ) : (
                <span className="flex items-center gap-1 px-3 py-1.5 text-sm text-muted-foreground/50 cursor-not-allowed">
                  Next
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
