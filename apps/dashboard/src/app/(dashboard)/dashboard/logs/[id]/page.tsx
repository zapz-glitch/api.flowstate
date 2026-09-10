import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getUsageLogDetail } from '@/lib/api'
import { ArrowLeft, Clock, Globe, Monitor, Key } from 'lucide-react'
import { JsonViewer } from '@/components/JsonViewer'

async function getLogDetail(logId: string) {
  try {
    return await getUsageLogDetail(logId)
  } catch {
    return null
  }
}

export default async function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const log = await getLogDetail(id)

  if (!log) {
    notFound()
  }

  const statusColor =
    log.statusCode >= 200 && log.statusCode < 300
      ? 'bg-emerald-500/10 text-emerald-500'
      : log.statusCode >= 400
        ? 'bg-red-500/10 text-red-500'
        : 'bg-amber-500/10 text-amber-500'

  const methodColor =
    log.method === 'GET'
      ? 'bg-emerald-500/10 text-emerald-500'
      : log.method === 'POST'
        ? 'bg-blue-500/10 text-blue-500'
        : log.method === 'PUT'
          ? 'bg-amber-500/10 text-amber-500'
          : log.method === 'DELETE'
            ? 'bg-red-500/10 text-red-500'
            : 'bg-secondary text-muted-foreground'

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/logs"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-mono"
        >
          <ArrowLeft className="w-4 h-4" />
          back to logs
        </Link>
      </div>

      <div>
        <div className="hud-label mb-2">Request Inspection</div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">Request Details</h1>
        <p className="text-muted-foreground mt-1 text-sm font-mono">
          {new Date(log.createdAt).toLocaleString()}
        </p>
      </div>

      {/* Summary card */}
      <div className="ui-panel p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="hud-label mb-1.5">Method</p>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-mono ${methodColor}`}
            >
              {log.method}
            </span>
          </div>
          <div>
            <p className="hud-label mb-1.5">Status</p>
            <span
              className={`inline-flex items-center px-2.5 py-1 rounded text-sm font-mono ${statusColor}`}
            >
              {log.statusCode}
            </span>
          </div>
          <div>
            <p className="hud-label mb-1.5">Latency</p>
            <p className="hud-value text-lg font-semibold text-foreground">
              {log.responseTimeMs ? `${log.responseTimeMs}ms` : '—'}
            </p>
          </div>
          <div>
            <p className="hud-label mb-1.5">Endpoint</p>
            <code className="text-sm text-foreground/80 font-mono">
              {log.endpoint}
            </code>
          </div>
        </div>
      </div>

      {/* Metadata */}
      <div className="ui-panel p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Request Metadata
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <Key className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">API Key ID</p>
              <p className="text-sm text-muted-foreground font-mono">
                {log.apiKeyId}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Timestamp</p>
              <p className="text-sm text-muted-foreground font-mono">
                {new Date(log.createdAt).toISOString()}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">IP Address</p>
              <p className="text-sm text-muted-foreground font-mono">
                {log.ipAddress || 'Unknown'}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Monitor className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">User Agent</p>
              <p className="text-sm text-muted-foreground break-all">
                {log.userAgent || 'Unknown'}
              </p>
            </div>
          </div>
        </div>

        {/* Property info if available */}
        {log.propertyAddress && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="hud-label mb-1">Property</p>
            <p className="text-sm text-muted-foreground">
              {log.propertyAddress}
              {log.propertyCity && `, ${log.propertyCity}`}
              {log.propertyState && `, ${log.propertyState}`}
            </p>
          </div>
        )}

        {/* Error message if available */}
        {log.errorMessage && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="hud-label text-destructive mb-1">Error Message</p>
            <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-md font-mono">
              {log.errorMessage}
            </p>
          </div>
        )}
      </div>

      {/* Request Headers */}
      <JsonViewer title="Request Headers" data={log.requestHeaders} defaultCollapsed={true} />

      {/* Request Body */}
      <JsonViewer title="Request Body" data={log.requestBody} defaultCollapsed={false} />

      {/* Response Body */}
      <JsonViewer
        title="Response Body"
        data={log.responseBody}
        defaultCollapsed={false}
        maxHeight="600px"
      />
    </div>
  )
}
