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
      <As className={cn('font-display font-semibold text-ink', As === 'h1' ? 'text-4xl sm:text-5xl' : 'text-3xl sm:text-4xl')}>{title}</As>
      {subtitle && <p className="max-w-2xl text-lg text-ink-soft">{subtitle}</p>}
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
    <div className={cn('flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-line-strong bg-white/60 px-6 py-12 text-center', className)}>
      {icon && <div className="flex size-16 items-center justify-center rounded-2xl bg-pine-50 text-pine-700 [&_svg]:size-8">{icon}</div>}
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
      className={cn('inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-terra-100 font-bold text-terra-800', className)}
    >
      {iniciais(nome)}
    </span>
  )
}

/** Barra de progresso simples (0–1). */
export function Meter({ value, tone = 'pine', label, className }: { value: number; tone?: 'pine' | 'leaf' | 'sun' | 'terra' | 'dusk'; label?: string; className?: string }) {
  const color = { pine: 'bg-pine-600', leaf: 'bg-leaf-500', sun: 'bg-sun-500', terra: 'bg-terra-500', dusk: 'bg-dusk-500' }[tone]
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  return (
    <div
      className={cn('h-2.5 w-full overflow-hidden rounded-full bg-sand-deep', className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="A carregar"
      className={cn('inline-block size-8 animate-spin rounded-full border-4 border-pine-100 border-t-pine-600', className)}
    />
  )
}

/** Texto oculto visualmente mas lido por leitores de ecrã. */
export const VisuallyHidden = ({ children }: { children: ReactNode }) => <span className="sr-only">{children}</span>
