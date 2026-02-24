/**
 * Better Auth Client
 *
 * Points to the API which owns all auth. The API handles sessions,
 * cookies, and user management.
 *
 * In development: http://localhost:8787/auth
 * In production: https://api.flowstate.homes/auth
 */

import { createAuthClient } from 'better-auth/react'

// API URL - inlined at build time via next.config.js
const API_URL = process.env.NEXT_PUBLIC_API_URL!

export const authClient = createAuthClient({
  baseURL: `${API_URL}/auth`,
  fetchOptions: {
    credentials: 'include', // Send cookies cross-origin
  },
})

export const { signIn, signUp, signOut, useSession } = authClient

// Password reset functions - cast to the expected types
// These are dynamically added by Better Auth
export const forgetPassword = (authClient as unknown as {
  forgetPassword: (params: { email: string; redirectTo?: string }) => Promise<{ data: unknown; error: { message: string } | null }>
}).forgetPassword

export const resetPassword = (authClient as unknown as {
  resetPassword: (params: { newPassword: string; token: string }) => Promise<{ data: unknown; error: { message: string } | null }>
}).resetPassword

// Export API URL for other dashboard API calls
export const apiUrl = API_URL
