import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

// Dev-only credentials for the local API's seeded admin account.
const DEV_EMAIL = 'admin@flowstate.homes'
const DEV_PASSWORD = 'admin123'

/**
 * Dev-only auto-login. Signs in against the LOCAL API server-side and
 * forwards the session cookies onto this origin, so both client-side
 * fetches and server components/actions share the session.
 *
 * Disabled unless NEXT_PUBLIC_API_URL points at localhost.
 */
export async function GET(request: NextRequest) {
  const isLocalApi = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/.test(API_URL)
  if (!isLocalApi) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const origin = `${request.nextUrl.protocol}//${request.nextUrl.host}`

  const signInRes = await fetch(`${API_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: origin,
    },
    body: JSON.stringify({ email: DEV_EMAIL, password: DEV_PASSWORD }),
  }).catch(() => null)

  const redirect = NextResponse.redirect(new URL('/dashboard', request.url))

  if (!signInRes?.ok) {
    return NextResponse.redirect(new URL('/?dev-login=failed', request.url))
  }

  // Forward the API's Set-Cookie headers to this origin.
  for (const cookie of signInRes.headers.getSetCookie()) {
    redirect.headers.append('set-cookie', cookie)
  }

  return redirect
}
