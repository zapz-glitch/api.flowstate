'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Navbar } from '@/components/landing/Navbar'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { AuthModals } from '@/components/auth/AuthModals'
import { useSession } from '@/lib/auth-client'

export default function HomePage() {
  const router = useRouter()
  const session = useSession()
  const [isSignInOpen, setIsSignInOpen] = useState(false)
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)

  // If user is signed in, clicking Sign In redirects to dashboard
  const handleSignInClick = () => {
    if (session.data?.user) {
      router.push('/dashboard')
    } else {
      setIsSignInOpen(true)
    }
  }

  // If user is signed in, clicking Get Started redirects to dashboard
  const handleGetStartedClick = () => {
    if (session.data?.user) {
      router.push('/dashboard')
    } else {
      setIsSignUpOpen(true)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar
        onSignInClick={handleSignInClick}
        onSignUpClick={() => setIsSignUpOpen(true)}
        isSignedIn={!!session.data?.user}
      />

      <main>
        <Hero onGetStartedClick={handleGetStartedClick} />
        <Features />
      </main>

      <AuthModals
        isSignInOpen={isSignInOpen}
        isSignUpOpen={isSignUpOpen}
        onSignInOpenChange={setIsSignInOpen}
        onSignUpOpenChange={setIsSignUpOpen}
      />
    </div>
  )
}
