'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type DesignVariant = 'atlas' | 'command' | 'aurora' | 'editorial'

export const DEFAULT_DESIGN: DesignVariant = 'atlas'
const STORAGE_KEY = 'design-variant-v3'

// Variants that read best in a specific color scheme
const PREFERRED_THEME: Partial<Record<DesignVariant, 'light' | 'dark'>> = {
  atlas: 'light',
}

export const DESIGN_VARIANTS: { id: DesignVariant; label: string; hint: string }[] = [
  { id: 'atlas', label: 'Atlas', hint: 'Devin-style precision' },
  { id: 'command', label: 'Command Center', hint: 'Phosphor console' },
  { id: 'aurora', label: 'Aurora', hint: 'Glass + gradient mesh' },
  { id: 'editorial', label: 'Editorial', hint: 'Clean typography' },
]

interface DesignContextType {
  design: DesignVariant
  setDesign: (design: DesignVariant) => void
}

const DesignContext = createContext<DesignContextType>({
  design: DEFAULT_DESIGN,
  setDesign: () => {},
})

function applyTheme(theme: 'light' | 'dark') {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  root.classList.toggle('light', theme === 'light')
  localStorage.setItem('theme-v2', theme)
  // Let ThemeProvider re-sync its internal state
  window.dispatchEvent(new Event('fs-theme-sync'))
}

export function DesignProvider({ children }: { children: React.ReactNode }) {
  const [design, setDesignState] = useState<DesignVariant>(DEFAULT_DESIGN)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as DesignVariant | null
    if (stored && DESIGN_VARIANTS.some((v) => v.id === stored)) {
      setDesignState(stored)
      document.documentElement.dataset.design = stored
    }
  }, [])

  const setDesign = (next: DesignVariant) => {
    setDesignState(next)
    document.documentElement.dataset.design = next
    localStorage.setItem(STORAGE_KEY, next)

    const preferred = PREFERRED_THEME[next]
    if (preferred) applyTheme(preferred)
  }

  return (
    <DesignContext.Provider value={{ design, setDesign }}>
      {children}
    </DesignContext.Provider>
  )
}

export function useDesign() {
  return useContext(DesignContext)
}
