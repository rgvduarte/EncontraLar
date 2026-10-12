import type { ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'

/** Título de bloco dentro do painel: h2 + uma frase de apoio + ação opcional à direita. */
export function SectionTitle({
  title,
  text,
  action,
  id,
  as: As = 'h2',
  className,
}: {
  title: ReactNode
  text?: ReactNode
  action?: ReactNode
  id?: string
  as?: 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-2', className)}>
      <div className="min-w-0 max-w-2xl">
        <As id={id} className={cn('font-semibold text-ink', As === 'h2' ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl')}>
          {title}
        </As>
        {text && <p className="mt-1.5 text-ink-mute">{text}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Ligação de texto estilo Apple: azul com chevron — "Ver lista ›". */
export function MoreLink({ className, children, ...rest }: LinkProps) {
  return (
    <Link className={cn('link inline-flex min-h-11 items-center gap-0.5', className)} {...rest}>
      {children}
      <ChevronRight aria-hidden className="size-[1.1em] translate-y-px" />
    </Link>
  )
}

/** Número grande sem caixa: etiqueta, valor e nota. Usar dentro de <dl> (entra com um Reveal suave). */
export function Stat({
  label,
  value,
  note,
  hero,
  delay = 0,
  children,
  className,
}: {
  label: ReactNode
  value: ReactNode
  note?: ReactNode
  /** o número principal da vista (maior) */
  hero?: boolean
  /** atraso da entrada, para escalonar uma fila de números */
  delay?: number
  children?: ReactNode
  className?: string
}) {
  return (
    <Reveal delay={delay} className={cn('flex min-w-0 flex-col', className)}>
      <dt className="text-sm text-ink-mute">{label}</dt>
      <dd className={cn('mt-1 leading-none font-semibold tracking-tight text-ink', hero ? 'text-5xl sm:text-6xl' : 'text-[2.25rem] min-[360px]:text-4xl sm:text-5xl')}>
        {value}
      </dd>
      {children}
      {note && <dd className="mt-2 text-sm text-ink-mute">{note}</dd>}
    </Reveal>
  )
}

/** 1,3 — uma casa decimal, formato pt-PT. */
export const dec1 = (v: number) => v.toLocaleString('pt-PT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
