'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { Loader2 } from 'lucide-react'

export interface User {
  id: string
  name: string
  email: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

interface UserContextValue {
  user: User | null
  isLoading: boolean
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
})

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

interface UserProviderProps {
  children: React.ReactNode
  requireAuth?: boolean
}

export function UserProvider({ children, requireAuth = true }: UserProviderProps) {
  const router = useRouter()
  const session = useSession()
  const [isChecking, setIsChecking] = useState(true)

  useEffect(() => {
    // Wait for session to load
    if (session.isPending) return

    setIsChecking(false)

    // If auth required and no session, redirect to home (sign in)
    if (requireAuth && !session.data?.user) {
      router.replace('/')
    }
  }, [session.isPending, session.data, router, requireAuth])

  // Show loading while checking
  if (isChecking || session.isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // If auth required and no user after check, show nothing (redirect will happen)
  if (requireAuth && !session.data?.user) {
    return null
  }

  const user = session.data?.user as User | null

  return (
    <UserContext.Provider value={{ user, isLoading: false }}>
      {children}
    </UserContext.Provider>
  )
}
