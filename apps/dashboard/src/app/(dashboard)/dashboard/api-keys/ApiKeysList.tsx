'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Plus, Copy, Trash2, ToggleLeft, ToggleRight, Check } from 'lucide-react'
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
    <div className="space-y-6">
      {/* Plan info */}
      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {plan.charAt(0).toUpperCase() + plan.slice(1)} Plan
            </span>
            <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
              {limits.maxApiKeys === -1
                ? 'Unlimited API keys'
                : `${keys.length} / ${limits.maxApiKeys} API keys`}
              {' | '}
              {limits.monthlyRequests === -1
                ? 'Unlimited requests'
                : `${limits.monthlyRequests.toLocaleString()} requests/month`}
            </p>
          </div>
        </div>
      </div>

      {/* New key modal */}
      {newKey && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 className="font-medium text-green-700 dark:text-green-300 mb-2">
            API Key Created!
          </h3>
          <p className="text-sm text-green-600 dark:text-green-400 mb-3">
            Copy your API key now. You won&apos;t be able to see it again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white dark:bg-neutral-800 px-3 py-2 rounded border border-green-200 dark:border-green-800 text-sm font-mono text-neutral-900 dark:text-white">
              {newKey}
            </code>
            <button
              onClick={handleCopy}
              className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <button
            onClick={() => {
              setNewKey(null)
              setShowCreate(false)
            }}
            className="mt-3 text-sm text-green-600 dark:text-green-400 hover:underline"
          >
            I&apos;ve copied the key
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && !newKey && (
        <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4">
          <form onSubmit={handleCreate} className="flex items-end gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Key Name (optional)
              </label>
              <input
                type="text"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production API Key"
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create'}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
            >
              Cancel
            </button>
          </form>
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>
          )}
        </div>
      )}

      {/* Create button */}
      {!showCreate && !newKey && canCreateMore && (
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700"
        >
          <Plus className="w-5 h-5" />
          Create API Key
        </button>
      )}

      {/* Keys list */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Name
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Key
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Usage
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Status
                </th>
                <th className="text-left px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Last Used
                </th>
                <th className="text-right px-6 py-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {keys.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-neutral-500 dark:text-neutral-500"
                  >
                    No API keys yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                keys.map((key) => (
                  <tr key={key.id}>
                    <td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-white">
                      {key.name}
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-sm text-neutral-600 dark:text-neutral-400 font-mono">
                        {key.keyPrefix}...
                      </code>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                      {key.currentUsage.toLocaleString()}
                      {key.monthlyQuota && (
                        <span className="text-neutral-400 dark:text-neutral-500">
                          {' '}
                          / {key.monthlyQuota.toLocaleString()}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          key.isActive
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {key.isActive ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
                      {key.lastUsedAt
                        ? new Date(key.lastUsedAt).toLocaleDateString()
                        : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggle(key.id, key.isActive)}
                          className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                          title={key.isActive ? 'Disable' : 'Enable'}
                        >
                          {key.isActive ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="p-2 text-neutral-400 hover:text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-5 h-5" />
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
