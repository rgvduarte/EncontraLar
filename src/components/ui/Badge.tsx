import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'pine' | 'terra' | 'leaf' | 'sun' | 'dusk' | 'alert' | 'white'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sand text-ink-soft border-line',
  pine: 'bg-pine-50 text-pine-800 border-pine-200',
  terra: 'bg-terra-50 text-terra-800 border-terra-200',
  leaf: 'bg-leaf-50 text-leaf-700 border-leaf-200',
  sun: 'bg-sun-50 text-sun-800 border-sun-200',
  dusk: 'bg-dusk-50 text-dusk-700 border-dusk-200',
  alert: 'bg-alert-50 text-alert-700 border-alert-600/30',
  white: 'bg-white/95 text-ink border-white shadow-soft',
}

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone
  size?: 'sm' | 'md'
  icon?: ReactNode
}

export function Badge({ tone = 'neutral', size = 'sm', icon, className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-bold whitespace-nowrap [&_svg]:shrink-0',
        size === 'sm' ? 'px-2.5 py-0.5 text-xs [&_svg]:size-3.5' : 'px-3.5 py-1 text-sm [&_svg]:size-4',
        TONES[tone],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </span>
  )
}
