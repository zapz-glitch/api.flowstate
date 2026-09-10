'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Copy, Trash2, ToggleLeft, ToggleRight, Check, ShieldCheck } from 'lucide-react'
import { createApiKey, deleteApiKey, toggleApiKey } from './actions'

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  monthlyQuota: number | null
  currentUsage: number
  quotaResetAt: string
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

interface ApiKeysListProps {
  keys: ApiKey[]
  plan: string
  limits: {
    monthlyRequests: number
    maxApiKeys: number
  }
  canCreateMore: boolean
}

export default function ApiKeysList({
  keys,
  plan,
  limits,
  canCreateMore,
}: ApiKeysListProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-open create form if ?create=true is in URL
  useEffect(() => {
    if (searchParams.get('create') === 'true' && canCreateMore) {
      setShowCreate(true)
      // Clean up the URL
      router.replace('/dashboard/api-keys', { scroll: false })
    }
  }, [searchParams, canCreateMore, router])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await createApiKey(newKeyName || 'Default Key')
      if (result.success && result.data) {
        setNewKey(result.data.key)
        setNewKeyName('')
        router.refresh()
      } else {
        setError(result.error || 'Failed to create API key')
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (newKey) {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    const result = await deleteApiKey(id)
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || 'Failed to delete API key')
    }
  }

  const handleToggle = async (id: string, currentState: boolean) => {
    const result = await toggleApiKey(id, !currentState)
    if (result.success) {
      router.refresh()
    } else {
      alert(result.error || 'Failed to toggle API key')
    }
  }

  return (
    <div className="space-y-5">
      {/* Plan info */}
      <div className="ui-panel px-5 py-4 flex items-center gap-4">
        <div className="w-9 h-9 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <span className="text-sm font-semibold text-foreground capitalize">
            {plan} Plan
          </span>
          <p className="text-sm text-muted-foreground font-mono text-xs mt-0.5">
            {limits.maxApiKeys === -1
              ? 'unlimited keys'
              : `${keys.length} / ${limits.maxApiKeys} keys`}
            {' · '}
            {limits.monthlyRequests === -1
              ? 'unlimited requests'
              : `${limits.monthlyRequests.toLocaleString()} req/mo`}
          </p>
        </div>
      </div>

      {/* New key modal */}
      {newKey && (
        <div className="ui-panel border-emerald-500/40 bg-emerald-500/5 p-5">
          <h3 className="font-medium text-emerald-500 mb-1 flex items-center gap-2">
            <Check className="w-4 h-4" />
            API Key Created
          </h3>
          <p className="text-sm text-muted-foreground mb-3">
            Copy your API key now. You won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-background/70 px-3 py-2.5 rounded-md border border-emerald-500/30 text-sm font-mono text-foreground overflow-x-auto">
              {newKey}
            </code>
            <button
              onClick={handleCopy}
              className="p-2.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-500 transition-colors flex-shrink-0"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <button
            onClick={() => {
              setNewKey(null)
              setShowCreate(false)
            }}
            className="mt-3 text-sm text-emerald-500 hover:underline"
          >
            I&apos;ve copied the key
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && !newKey && (
        <div className="ui-panel p-5">
          <form onSubmit={handleCreate} className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="hud-label block mb-1.5">
                Key Name (optional)
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production API Key"
                className="w-full px-3 py-2.5 border border-border rounded-md bg-secondary/60 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50 font-mono text-sm uppercase tracking-wider"
            >
              {loading ? 'Creating…' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancel
            </button>
          </form>
          {error && (
            <p className="text-sm text-destructive mt-2 font-mono">{error}</p>
          )}
        </div>
      )}

      {/* Create button */}
      {!showCreate && !newKey && canCreateMore && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 font-mono text-sm uppercase tracking-wider shadow-[0_0_20px_hsl(var(--primary)/0.3)] transition-all"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      )}

      {/* Keys list */}
      <div className="ui-panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left px-5 py-3 hud-label">Name</th>
                <th className="text-left px-5 py-3 hud-label">Key</th>
                <th className="text-left px-5 py-3 hud-label">Usage</th>
                <th className="text-left px-5 py-3 hud-label">Status</th>
                <th className="text-left px-5 py-3 hud-label">Last Used</th>
                <th className="text-right px-5 py-3 hud-label">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {keys.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-muted-foreground text-sm"
                  >
                    No API keys yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id} className="hover:bg-secondary/40 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-foreground">
                      {key.name}
                    </td>
                    <td className="px-5 py-4">
                      <code className="text-sm text-muted-foreground font-mono">
                        {key.keyPrefix}…
                      </code>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground font-mono">
                      {key.currentUsage.toLocaleString()}
                      {key.monthlyQuota && (
                        <span className="text-muted-foreground/50">
                          {' '}/ {key.monthlyQuota.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono ${
                          key.isActive
                            ? 'bg-emerald-500/10 text-emerald-500'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        <span className={`hud-dot ${key.isActive ? 'live' : ''}`} />
                        {key.isActive ? 'ACTIVE' : 'DISABLED'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-sm text-muted-foreground font-mono">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : 'never'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleToggle(key.id, key.isActive)}
                          className="p-2 text-muted-foreground hover:text-foreground transition-colors"
                          title={key.isActive ? 'Disable' : 'Enable'}
                        >
                          {key.isActive ? (
                            <ToggleRight className="w-5 h-5 text-emerald-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
