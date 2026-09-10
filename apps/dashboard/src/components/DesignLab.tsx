'use client'

import { useState } from 'react'
import { Palette, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DESIGN_VARIANTS, useDesign } from '@/components/design-provider'

/**
 * Floating design-variant switcher. Lets reviewers flip between the three
 * UI skins live while evaluating the frontend-v5 redesign.
 */
export function DesignLab() {
  const { design, setDesign } = useDesign()
  const [open, setOpen] = useState(false)

  return (
    <div className="fixed bottom-4 right-4 z-[90] flex flex-col items-end gap-2">
      {open && (
        <div className="ui-panel p-2 w-52 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="hud-label">Design Variant</span>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close design switcher"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            {DESIGN_VARIANTS.map((v) => {
              const active = design === v.id
              return (
                <button
                  key={v.id}
                  onClick={() => setDesign(v.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
                    active
                      ? 'bg-primary/15 text-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      active ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.8)]' : 'bg-muted-foreground/40'
                    )}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{v.label}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">{v.hint}</span>
                  </span>
                  {active && (
                    <span className="hud-label text-primary">on</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-all',
          'bg-card border border-border text-foreground shadow-lg',
          'hover:border-primary/50 hover:shadow-xl'
        )}
        aria-label="Toggle design switcher"
      >
        <Palette className="w-4 h-4 text-primary" />
        <span className="hidden sm:inline">
          {DESIGN_VARIANTS.find((v) => v.id === design)?.label}
        </span>
      </button>
    </div>
  )
}
