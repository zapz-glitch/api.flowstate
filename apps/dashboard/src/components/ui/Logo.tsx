'use client'

import { cn } from '@/lib/utils'

interface LogoProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function Logo({ className, showText = true, size = 'md' }: LogoProps) {
  const sizes = {
    sm: { icon: 'w-7 h-7', text: 'text-base', svg: 'w-4 h-4' },
    md: { icon: 'w-8 h-8', text: 'text-lg', svg: 'w-5 h-5' },
    lg: { icon: 'w-10 h-10', text: 'text-xl', svg: 'w-6 h-6' },
  }

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className={cn(
        'rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-[0_0_16px_hsl(var(--primary)/0.35)]',
        sizes[size].icon
      )}>
        <svg className={cn('text-primary-foreground', sizes[size].svg)} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      {showText && (
        <span className={cn('font-semibold tracking-tight text-foreground', sizes[size].text)}>
          <span className="text-primary">api</span>.flowstate
        </span>
      )}
    </div>
  )
}

export function LogoIcon({ className }: { className?: string }) {
  return (
    <div className={cn(
      'w-8 h-8 rounded-md bg-gradient-to-br from-primary to-accent flex items-center justify-center',
      className
    )}>
      <svg className="w-5 h-5 text-primary-foreground" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    </div>
  )
}
