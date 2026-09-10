'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'
import { AlertTriangle, Settings2 } from 'lucide-react'

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
        <div className="hud-label mb-2 flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5 text-primary" />
          Config
        </div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your account settings
        </p>
      </div>

      {/* Account section */}
      <div className="ui-panel p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">
          Account
        </h2>

        <div className="space-y-4">
          <button
            onClick={() => signOut().then(() => router.push('/'))}
            className="px-4 py-2.5 text-sm text-muted-foreground border border-border rounded-md hover:bg-secondary hover:text-foreground transition-colors font-mono"
          >
            sign out
          </button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="ui-panel border-destructive/30 p-6">
        <div className="flex items-center gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-destructive" />
          <h2 className="text-base font-semibold text-destructive">
            Danger Zone
          </h2>
        </div>

        {!showDeleteConfirm ? (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-4 py-2.5 text-sm bg-destructive/10 text-destructive border border-destructive/30 rounded-md hover:bg-destructive/20 transition-colors font-mono"
          >
            delete account
          </button>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This action cannot be undone. All your API keys and usage data
              will be permanently deleted.
            </p>
            <div>
              <label className="hud-label block mb-1.5">
                Type <strong>DELETE</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-md bg-secondary/60 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-destructive/50 focus:border-destructive/50"
                placeholder="DELETE"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE'}
                className="px-4 py-2.5 bg-destructive text-destructive-foreground rounded-md hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-sm uppercase tracking-wider"
              >
                Delete Account
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                }}
                className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
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
