'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'
import { AlertTriangle } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return

    // TODO: Implement account deletion server action
    alert('Account deletion not yet implemented')
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          Settings
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mt-1">
          Manage your account settings
        </p>
      </div>

      {/* Account section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200 dark:border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
          Account
        </h2>

        <div className="space-y-4">
          <button
            onClick={() => signOut().then(() => router.push('/'))}
            className="px-4 py-2 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-neutral-700 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800"
          >
            Sign out
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-red-200 dark:border-red-900/50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">
            Danger Zone
          </h2>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              This action cannot be undone. All your API keys and usage data
              will be permanently deleted.
            </p>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Delete Account
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                }}
                className="px-4 py-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
