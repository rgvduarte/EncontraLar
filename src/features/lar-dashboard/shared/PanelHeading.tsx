import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Cabeçalho de bloco dentro do painel: etiqueta + h2 em Fraunces + ação opcional à direita. */
export function PanelHeading({
  eyebrow,
  title,
  text,
  action,
  id,
  as: As = 'h2',
  className,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  id?: string
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <As id={id} className={cn('font-display font-semibold text-ink', As === 'h2' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl')}>
          {title}
        </As>
        {text && <p className="mt-1.5 text-ink-soft">{text}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
