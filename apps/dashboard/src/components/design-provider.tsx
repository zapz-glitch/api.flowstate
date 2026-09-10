'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type DesignVariant = 'command' | 'aurora' | 'editorial'

export const DESIGN_VARIANTS: { id: DesignVariant; label: string; hint: string }[] = [
  { id: 'command', label: 'Command Center', hint: 'Phosphor console' },
  { id: 'aurora', label: 'Aurora', hint: 'Glass + gradient mesh' },
  { id: 'editorial', label: 'Editorial', hint: 'Clean typography' },
]

interface DesignContextType {
  design: DesignVariant
  setDesign: (design: DesignVariant) => void
}

const DesignContext = createContext<DesignContextType>({
  design: 'command',
  setDesign: () => {},
})

export function DesignProvider({ children }: { children: React.ReactNode }) {
  const [design, setDesignState] = useState<DesignVariant>('command')

  useEffect(() => {
    const stored = localStorage.getItem('design-variant') as DesignVariant | null
    if (stored && DESIGN_VARIANTS.some((v) => v.id === stored)) {
      setDesignState(stored)
      document.documentElement.dataset.design = stored
    }
  }, [])

  const setDesign = (next: DesignVariant) => {
    setDesignState(next)
    document.documentElement.dataset.design = next
    localStorage.setItem('design-variant', next)
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
