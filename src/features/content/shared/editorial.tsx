/**
 * Peças editoriais partilhadas pelas páginas de conteúdo (guia, sobre, privacidade, para lares).
 */
import type { ReactNode } from 'react'
import { ArrowUpRight, Info, Lightbulb, TriangleAlert } from 'lucide-react'
import { azulejoBg } from '@/components/brand/patterns'
import { cn } from '@/lib/cn'

/** Ligação para um site externo — abre noutro separador e di-lo ao leitor de ecrã. */
export function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cn('link inline-flex items-baseline gap-0.5', className)}>
      {children}
      <ArrowUpRight aria-hidden className="size-4 shrink-0 self-center" />
      <span className="sr-only"> (abre noutro separador)</span>
    </a>
  )
}

/** Azulejo com o número da secção — como as placas de número das casas portuguesas. */
export function AzulejoNumber({ n, className, tone = 'pine' }: { n: number | string; className?: string; tone?: 'pine' | 'terra' }) {
  const color = tone === 'pine' ? '#1d564e' : '#993827'
  return (
    <span
      aria-hidden
      className={cn('relative inline-flex size-16 shrink-0 items-center justify-center rounded-xl bg-white shadow-soft ring-1 ring-line', className)}
      style={azulejoBg(color, 0.85, 32)}
    >
      <span className={cn('font-display flex size-10 items-center justify-center rounded-md bg-white text-xl font-semibold tabular shadow-[0_0_0_3px_white]', tone === 'pine' ? 'text-pine-800' : 'text-terra-700')}>
        {typeof n === 'number' ? String(n).padStart(2, '0') : n}
      </span>
    </span>
  )
}

/** Cabeçalho de secção longa: azulejo numerado + etiqueta + título + entrada. */
export function SectionMark({
  n,
  eyebrow,
  title,
  lead,
  className,
  tone,
  titleId,
}: {
  n: number | string
  eyebrow: ReactNode
  title: ReactNode
  lead?: ReactNode
  className?: string
  tone?: 'pine' | 'terra'
  /** id do h2 (para aria-labelledby da secção) */
  titleId?: string
}) {
  return (
    <header className={cn('flex flex-col gap-5', className)}>
      <div className="flex items-center gap-4">
        <AzulejoNumber n={n} tone={tone} />
        <span aria-hidden className="h-px flex-1 bg-line-strong" />
      </div>
      <div className="flex flex-col gap-3">
        <p className="eyebrow">{eyebrow}</p>
        <h2 id={titleId} className="text-3xl font-semibold text-ink sm:text-4xl">
          {title}
        </h2>
        {lead && <p className="max-w-[62ch] text-lg text-ink-soft">{lead}</p>}
      </div>
    </header>
  )
}

/** Tipografia de leitura longa (~70 caracteres por linha). */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'max-w-[70ch] text-lg leading-[1.7] text-ink-soft',
        '[&_p]:mt-5 [&_p:first-child]:mt-0 [&_strong]:font-bold [&_strong]:text-ink',
        '[&_h3]:mt-10 [&_h3]:mb-3 [&_h3]:text-2xl [&_h3]:font-semibold [&_h3]:text-ink',
        '[&_ul]:mt-4 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2 [&_ul>li]:relative [&_ul>li]:pl-6',
        "[&_ul>li]:before:absolute [&_ul>li]:before:top-[0.7em] [&_ul>li]:before:left-1 [&_ul>li]:before:size-2 [&_ul>li]:before:rotate-45 [&_ul>li]:before:bg-terra-400 [&_ul>li]:before:content-['']",
        className,
      )}
    >
      {children}
    </div>
  )
}

const CALLOUT = {
  dica: { Icon: Lightbulb, box: 'border-pine-600 bg-pine-50', ico: 'text-pine-700', label: 'Dica' },
  atencao: { Icon: TriangleAlert, box: 'border-terra-500 bg-terra-50', ico: 'text-terra-700', label: 'Atenção' },
  nota: { Icon: Info, box: 'border-line-strong bg-sand', ico: 'text-ink-soft', label: 'Nota' },
} as const

/** Caixa de destaque com barra lateral. O rótulo nunca depende só da cor. */
export function Callout({
  tone = 'dica',
  title,
  children,
  className,
}: {
  tone?: keyof typeof CALLOUT
  title?: ReactNode
  children: ReactNode
  className?: string
}) {
  const c = CALLOUT[tone]
  return (
    <aside className={cn('flex gap-4 rounded-r-2xl border-l-4 px-5 py-5 sm:px-6', c.box, className)}>
      <c.Icon aria-hidden className={cn('mt-1 size-6 shrink-0', c.ico)} />
      <div className="flex min-w-0 flex-col gap-1.5 text-base text-ink-soft">
        <p className="font-bold text-ink">
          <span className="sr-only">{c.label}: </span>
          {title ?? c.label}
        </p>
        <div className="flex flex-col gap-2">{children}</div>
      </div>
    </aside>
  )
}

/** Citação de destaque, retirada do próprio texto (não é um testemunho). */
export function PullQuote({ children, note, className }: { children: ReactNode; note?: ReactNode; className?: string }) {
  return (
    <figure className={cn('relative my-4 border-y border-line-strong py-8 pl-2 sm:pl-10', className)}>
      <span aria-hidden className="font-display absolute top-3 left-0 text-7xl leading-none text-terra-300 sm:-left-1">
        “
      </span>
      <blockquote className="font-display pl-8 text-2xl leading-snug font-medium text-pine-900 italic sm:pl-4 sm:text-3xl">{children}</blockquote>
      {note && <figcaption className="mt-4 pl-8 text-sm text-ink-mute sm:pl-4">{note}</figcaption>}
    </figure>
  )
}

const FONTES = {
  ss: { href: 'https://www.seg-social.pt', label: 'seg-social.pt' },
  financas: { href: 'https://www.portaldasfinancas.gov.pt', label: 'portaldasfinancas.gov.pt' },
  sns: { href: 'https://www.sns.gov.pt', label: 'sns.gov.pt' },
} as const

/** Lembrete para confirmar valores e regras na fonte oficial. */
export function Confirme({ fonte, children, className }: { fonte: keyof typeof FONTES; children?: ReactNode; className?: string }) {
  const f = FONTES[fonte]
  return (
    <p className={cn('flex items-start gap-2 text-sm text-ink-mute', className)}>
      <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>
        {children ?? 'Valores e condições mudam todos os anos.'} Confirme os valores atuais em <ExternalLink href={f.href}>{f.label}</ExternalLink>.
      </span>
    </p>
  )
}

/** Secção com âncora: margem de scroll para o cabeçalho fixo (e as pílulas no telemóvel). */
export function AnchorSection({ id, children, className }: { id: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} tabIndex={-1} className={cn('scroll-mt-40 outline-none lg:scroll-mt-28', className)}>
      {children}
    </section>
  )
}
