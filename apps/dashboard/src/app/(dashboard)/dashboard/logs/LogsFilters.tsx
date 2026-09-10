'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useCallback } from 'react'
import { Search, Filter, X } from 'lucide-react'

interface LogsFiltersProps {
  apiKeys: { id: string; name: string }[]
  initialParams: {
    endpoint?: string
    status?: string
    apiKeyId?: string
    startDate?: string
    endDate?: string
    search?: string
  }
}

const inputCls =
  'w-full px-3 py-2 text-sm bg-secondary/60 border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50'

export function LogsFilters({ apiKeys, initialParams }: LogsFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [endpoint, setEndpoint] = useState(initialParams.endpoint || '')
  const [status, setStatus] = useState(initialParams.status || '')
  const [apiKeyId, setApiKeyId] = useState(initialParams.apiKeyId || '')
  const [startDate, setStartDate] = useState(initialParams.startDate || '')
  const [endDate, setEndDate] = useState(initialParams.endDate || '')
  const [search, setSearch] = useState(initialParams.search || '')

  const applyFilters = useCallback(() => {
    const params = new URLSearchParams()
    if (endpoint) params.set('endpoint', endpoint)
    if (status) params.set('status', status)
    if (apiKeyId) params.set('apiKeyId', apiKeyId)
    if (startDate) params.set('startDate', startDate)
    if (endDate) params.set('endDate', endDate)
    if (search) params.set('search', search)
    router.push(`/dashboard/logs?${params.toString()}`)
  }, [router, endpoint, status, apiKeyId, startDate, endDate, search])

  const clearFilters = useCallback(() => {
    setEndpoint('')
    setStatus('')
    setApiKeyId('')
    setStartDate('')
    setEndDate('')
    setSearch('')
    router.push('/dashboard/logs')
  }, [router])

  const hasFilters = endpoint || status || apiKeyId || startDate || endDate || search

  return (
    <div className="ui-panel p-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <span className="hud-label">Filters</span>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-mono"
          >
            <X className="w-3 h-3" />
            clear all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search by address */}
        <div>
          <label className="hud-label block mb-1.5">Property Address</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              placeholder="Search address..."
              className={`${inputCls} pl-9`}
            />
          </div>
        </div>

        {/* Endpoint filter */}
        <div>
          <label className="hud-label block mb-1.5">Endpoint</label>
          <select
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className={inputCls}
          >
            <option value="">All endpoints</option>
            <option value="/v1/analyze">/v1/analyze</option>
            <option value="/v1/analyze/defaults">/v1/analyze/defaults</option>
            <option value="/v1/property">/v1/property</option>
            <option value="/v1/comparables">/v1/comparables</option>
            <option value="/v1/valuation">/v1/valuation</option>
          </select>
        </div>

        {/* Status filter */}
        <div>
          <label className="hud-label block mb-1.5">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={inputCls}
          >
            <option value="">All statuses</option>
            <option value="200">2xx Success</option>
            <option value="400">4xx Client Error</option>
            <option value="500">5xx Server Error</option>
          </select>
        </div>

        {/* API Key filter */}
        <div>
          <label className="hud-label block mb-1.5">API Key</label>
          <select
            value={apiKeyId}
            onChange={(e) => setApiKeyId(e.target.value)}
            className={inputCls}
          >
            <option value="">All keys</option>
            {apiKeys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name}
              </option>
            ))}
          </select>
        </div>

        {/* Date range */}
        <div>
          <label className="hud-label block mb-1.5">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputCls}
          />
        </div>

        <div>
          <label className="hud-label block mb-1.5">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Apply button */}
      <div className="mt-4 flex justify-end">
        <button
          onClick={applyFilters}
          className="px-5 py-2 text-sm font-medium text-primary-foreground bg-primary hover:opacity-90 rounded-md transition-all font-mono uppercase tracking-wider"
        >
          Apply
        </button>
      </div>
    </div>
  )
}
