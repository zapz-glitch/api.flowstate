'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { resetPassword } from '@/lib/auth-client'
import { LogoIcon } from '@/components/ui/Logo'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'
import Link from 'next/link'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  // Validate token exists
  useEffect(() => {
    if (!token) {
      setError('Invalid or missing reset token. Please request a new password reset link.')
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    // Validate passwords
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setIsLoading(false)
      return
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      setIsLoading(false)
      return
    }

    if (!token) {
      setError('Invalid reset token')
      setIsLoading(false)
      return
    }

    try {
      const result = await resetPassword({
        newPassword: password,
        token,
      })

      if (result.error) {
        setError(result.error.message || 'Failed to reset password. Please try again.')
        setIsLoading(false)
        return
      }

      setIsSuccess(true)
      setIsLoading(false)

      // Redirect to home after 3 seconds
      setTimeout(() => {
        router.push('/')
      }, 3000)
    } catch {
      setError('Failed to reset password. Please try again.')
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 px-4">
      <div className="w-full max-w-md">
        <div className="relative rounded-3xl shadow-2xl overflow-hidden">
          {/* Liquid Glass Background Layers */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-accent/10 to-accent-secondary/15" />
          <div className="absolute inset-0 backdrop-blur-xl bg-black/50" />
          <div className="absolute -top-20 -left-20 w-40 h-40 bg-gradient-radial from-white/10 via-white/5 to-transparent rounded-full blur-2xl" />
          <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-gradient-radial from-primary/15 via-primary/5 to-transparent rounded-full blur-2xl" />
          <div className="absolute inset-0 rounded-3xl border border-white/10" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Content */}
          <div className="relative z-10">
            {/* Header */}
            <div className="p-6 pb-4">
              <Link href="/" className="flex items-center gap-3 mb-4">
                <LogoIcon className="w-10 h-10" />
                <span className="text-xl font-semibold text-white">flowstate</span>
              </Link>

              {isSuccess ? (
                <>
                  <h2 className="text-2xl font-bold text-white mb-1">Password reset!</h2>
                  <p className="text-sm text-neutral-400">
                    Your password has been successfully updated
                  </p>
                </>
              ) : !token ? (
                <>
                  <h2 className="text-2xl font-bold text-white mb-1">Invalid link</h2>
                  <p className="text-sm text-neutral-400">
                    This reset link is invalid or has expired
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-2xl font-bold text-white mb-1">Set new password</h2>
                  <p className="text-sm text-neutral-400">
                    Enter your new password below
                  </p>
                </>
              )}
            </div>

            {/* Form */}
            <div className="px-6 pb-6">
              {isSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                    <CheckCircle className="w-8 h-8 text-green-400" />
                  </div>
                  <p className="text-neutral-300 mb-4">
                    You can now sign in with your new password.
                  </p>
                  <p className="text-sm text-neutral-500 mb-6">
                    Redirecting you to sign in...
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 text-primary hover:underline font-medium"
                  >
                    Go to sign in
                  </Link>
                </div>
              ) : !token ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                    <XCircle className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-neutral-300 mb-4">
                    The password reset link you clicked is invalid or has expired.
                  </p>
                  <p className="text-sm text-neutral-500 mb-6">
                    Please request a new password reset link.
                  </p>
                  <Link
                    href="/"
                    className="inline-flex items-center gap-2 py-2.5 px-6 bg-gradient-to-r from-primary to-accent text-white font-medium rounded-xl hover:opacity-90 transition-all shadow-lg shadow-[0_8px_30px_hsl(var(--primary)/0.3)]"
                  >
                    Go to sign in
                  </Link>
                </div>
              ) : (
                <>
                  {/* Error message */}
                  {error && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl mb-3 backdrop-blur-sm">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit}>
                    {/* Password field */}
                    <div className="mb-4">
                      <label htmlFor="reset-password" className="block text-sm font-medium text-white mb-1.5">
                        New Password
                      </label>
                      <input
                        id="reset-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors backdrop-blur-sm"
                        placeholder="••••••••"
                      />
                    </div>

                    {/* Confirm Password field */}
                    <div className="mb-4">
                      <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-white mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        id="reset-confirm-password"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={8}
                        className="w-full px-4 py-2.5 bg-white/10 border border-white/10 rounded-xl text-white placeholder:text-neutral-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-colors backdrop-blur-sm"
                        placeholder="••••••••"
                      />
                    </div>

                    <p className="text-xs text-neutral-500 mb-4">Password must be at least 8 characters</p>

                    {/* Submit button */}
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-2.5 px-4 bg-gradient-to-r from-primary to-accent text-white font-medium rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 shadow-lg shadow-[0_8px_30px_hsl(var(--primary)/0.3)]"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Resetting...</span>
                        </>
                      ) : (
                        <span>Reset Password</span>
                      )}
                    </button>
                  </form>

                  {/* Back to sign in */}
                  <p className="text-sm text-neutral-400 text-center mt-4">
                    <Link
                      href="/"
                      className="text-primary hover:underline font-medium"
                    >
                      Back to sign in
                    </Link>
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  )
}
