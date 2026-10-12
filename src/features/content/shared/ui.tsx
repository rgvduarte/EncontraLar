/**
 * Peças pequenas partilhadas pelas páginas de conteúdo (para lares, guia, sobre, privacidade, 404).
 * Minimalistas: texto, espaço e uma ligação azul — sem caixas nem ícones decorativos.
 */
import type { ReactNode } from 'react'
import { Link, type To } from 'react-router'
import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Ligação externa: abre noutro separador e di-lo ao leitor de ecrã. */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn('link inline-flex items-center gap-0.5', className)}>
      {children}
      <ArrowUpRight aria-hidden className="size-[0.9em] shrink-0" />
      <span className="sr-only"> (abre noutro separador)</span>
    </a>
  )
}

const MORE = 'inline-flex min-h-12 items-center gap-0.5 font-medium text-terra-600 transition-colors hover:text-terra-700 hover:underline underline-offset-4'

/** Ligação de texto estilo Apple: "Saber mais ›". Com `to` é uma rota; com `onClick` é um botão. */
export function MoreLink({
  to,
  onClick,
  children,
  className,
}: {
  to?: To
  onClick?: () => void
  children: ReactNode
  className?: string
}) {
  const inner = (
    <>
      {children}
      <ChevronRight aria-hidden className="size-[1.05em] shrink-0 translate-y-px" />
    </>
  )
  if (to)
    return (
      <Link
        to={to}
        onClick={
          onClick
            ? (e) => {
                e.preventDefault()
                onClick()
              }
            : undefined
        }
        className={cn(MORE, className)}
      >
        {inner}
      </Link>
    )
  return (
    <button type="button" onClick={onClick} className={cn(MORE, className)}>
      {inner}
    </button>
  )
}

/** Cabeçalho de página centrado (h1). */
export function PageHero({
  eyebrow,
  title,
  subtitle,
  children,
  className,
  titleWidth = 'max-w-[16ch]',
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  children?: ReactNode
  className?: string
  /** largura máxima do h1 (classe max-w-*) */
  titleWidth?: string
}) {
  return (
    <header className={cn('container-narrow flex flex-col items-center pt-16 pb-14 text-center sm:pt-24 sm:pb-20 lg:pt-28', className)}>
      {eyebrow && <p className="eyebrow mb-4 animate-fade-in">{eyebrow}</p>}
      <h1 className={cn(titleWidth, 'animate-fade-up text-[2.6rem] leading-[1.05] font-semibold text-ink sm:text-6xl lg:text-7xl')}>{title}</h1>
      {subtitle && (
        <p className="mt-6 max-w-[38ch] animate-fade-up text-xl leading-snug text-ink-mute [animation-delay:120ms] sm:text-2xl">{subtitle}</p>
      )}
      {children && <div className="mt-8 w-full animate-fade-up [animation-delay:220ms]">{children}</div>}
    </header>
  )
}

/** Título de secção (h2) com uma frase de apoio. */
export function SectionTitle({
  id,
  title,
  subtitle,
  align = 'center',
  size = 'lg',
  className,
}: {
  id?: string
  title: ReactNode
  subtitle?: ReactNode
  align?: 'center' | 'left'
  size?: 'lg' | 'md'
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-4', align === 'center' && 'mx-auto items-center text-center', className)}>
      <h2 id={id} className={cn('font-semibold text-ink', size === 'lg' ? 'headline max-w-[18ch]' : 'text-3xl sm:text-4xl')}>
        {title}
      </h2>
      {subtitle && (
        <p className={cn('text-ink-mute', size === 'lg' ? 'max-w-[40ch] text-xl sm:text-2xl' : 'max-w-[56ch] text-lg sm:text-xl')}>{subtitle}</p>
      )}
    </div>
  )
}

const FONTES = {
  ss: { href: 'https://www.seg-social.pt', label: 'seg-social.pt' },
  financas: { href: 'https://www.portaldasfinancas.gov.pt', label: 'portaldasfinancas.gov.pt' },
} as const

/** Lembrete discreto para confirmar valores e regras na fonte oficial. */
export function Confirme({ fonte, className }: { fonte: keyof typeof FONTES; className?: string }) {
  const f = FONTES[fonte]
  return (
    <p className={cn('text-sm text-ink-mute', className)}>
      Valores e condições mudam todos os anos. Confirme em <ExternalLink href={f.href}>{f.label}</ExternalLink>.
    </p>
  )
}
