'use client'

import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'theme-v2'

interface ThemeContextType {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

function readInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
  if (stored === 'dark' || stored === 'light') return stored
  // Atlas is light-first; other variants default dark
  if (document.documentElement.dataset.design === 'atlas') return 'light'
  if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light'
  return 'dark'
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTheme(readInitialTheme())

    // Re-sync when another provider (e.g. DesignProvider) changes the theme
    const onSync = () => {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
      if (stored === 'dark' || stored === 'light') setTheme(stored)
    }
    window.addEventListener('fs-theme-sync', onSync)
    return () => window.removeEventListener('fs-theme-sync', onSync)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const root = document.documentElement
    if (theme === 'dark') {
      root.classList.add('dark')
      root.classList.remove('light')
    } else {
      root.classList.remove('dark')
      root.classList.add('light')
    }
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme, mounted])

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}
