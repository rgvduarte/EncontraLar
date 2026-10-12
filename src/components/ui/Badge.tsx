import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'pine' | 'terra' | 'leaf' | 'sun' | 'dusk' | 'alert' | 'white'

const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-sand text-ink-soft',
  pine: 'bg-sand text-ink',
  terra: 'bg-terra-50 text-terra-700',
  leaf: 'bg-leaf-50 text-leaf-700',
  sun: 'bg-sun-50 text-sun-800',
  dusk: 'bg-dusk-50 text-dusk-700',
  alert: 'bg-alert-50 text-alert-700',
  white: 'bg-white/90 text-ink shadow-soft backdrop-blur-md',
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
        'inline-flex items-center gap-1.5 rounded-full font-medium whitespace-nowrap [&_svg]:shrink-0',
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
