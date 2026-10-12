import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { iniciais } from '@/lib/format'

/** Cabeçalho de secção: etiqueta + título + subtítulo. */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'left',
  as: As = 'h2',
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  align?: 'left' | 'center'
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3', align === 'center' && 'mx-auto max-w-3xl items-center text-center', className)}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <As className={cn('font-display font-semibold text-ink', As === 'h1' ? 'text-4xl sm:text-5xl lg:text-6xl' : 'text-3xl sm:text-4xl lg:text-5xl')}>{title}</As>
      {subtitle && <p className="max-w-2xl text-xl leading-relaxed text-ink-mute">{subtitle}</p>}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  text,
  action,
  className,
}: {
  icon?: ReactNode
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-[1.75rem] bg-sand px-6 py-14 text-center', className)}>
      {icon && <div className="flex size-14 items-center justify-center rounded-full bg-white text-ink-soft [&_svg]:size-7">{icon}</div>}
      <h3 className="text-xl font-semibold">{title}</h3>
      {text && <p className="max-w-md text-ink-soft">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Avatar({ nome, className }: { nome: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-pine-300 to-pine-500 font-semibold text-white', className)}
    >
      {iniciais(nome)}
    </span>
  )
}

/** Barra de progresso simples (0–1). */
export function Meter({ value, tone = 'pine', label, className }: { value: number; tone?: 'pine' | 'leaf' | 'sun' | 'terra' | 'dusk'; label?: string; className?: string }) {
  const color = { pine: 'bg-ink', leaf: 'bg-leaf-500', sun: 'bg-sun-500', terra: 'bg-terra-600', dusk: 'bg-dusk-500' }[tone]
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div
      className={cn('h-2 w-full overflow-hidden rounded-full bg-sand-deep', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className={cn('h-full origin-left rounded-full transition-[scale] duration-700 ease-[cubic-bezier(.16,1,.3,1)]', color)} style={{ scale: `${pct / 100} 1` }} />
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="A carregar"
      className={cn('inline-block size-7 animate-spin rounded-full border-[3px] border-sand-deep border-t-ink', className)}
    />
  )
}

/** Texto oculto visualmente mas lido por leitores de ecrã. */
export const VisuallyHidden = ({ children }: { children: ReactNode }) => <span className="sr-only">{children}</span>
