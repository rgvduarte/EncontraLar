import type { ReactNode } from 'react'
import { Reveal } from '@/components/ui/Reveal'
import { cn } from '@/lib/cn'

/**
 * Secção da ficha: etiqueta curta (igual à navegação), um título grande e, no máximo, uma frase de apoio.
 * O id serve a navegação interna (scrollIntoView) — nunca usar links '#id' por causa do HashRouter.
 */
export function Secao({
  id,
  rotulo,
  titulo,
  intro,
  children,
  className,
}: {
  id: string
  rotulo: string
  titulo: ReactNode
  intro?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} tabIndex={-1} className={cn('scroll-mt-36 outline-none', className)}>
      <Reveal as="header" className="mb-10 sm:mb-14">
        <p className="eyebrow">{rotulo}</p>
        <h2 id={`${id}-titulo`} className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
          {titulo}
        </h2>
        {intro && <p className="mt-4 max-w-2xl text-xl leading-relaxed text-ink-mute">{intro}</p>}
      </Reveal>
      <Reveal delay={60}>{children}</Reveal>
    </section>
  )
}

/** Subtítulo dentro de uma secção. */
export function Subtitulo({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-xl font-semibold tracking-tight text-ink sm:text-2xl', className)}>{children}</h3>
}

/** Número grande com legenda (estilo "ficha técnica" da Apple). */
export function Numero({ valor, unidade, rotulo, nota }: { valor: ReactNode; unidade?: ReactNode; rotulo: ReactNode; nota?: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="order-2 mt-2 text-base text-ink">{rotulo}</dt>
      <dd className="order-1 text-5xl font-semibold tracking-tight text-ink tabular sm:text-6xl">
        {valor}
        {unidade && <span className="ml-1 text-2xl tracking-tight sm:text-3xl">{unidade}</span>}
      </dd>
      {nota && <dd className="order-3 mt-1 text-sm text-ink-mute">{nota}</dd>}
    </div>
  )
}

/** Linha "termo — valor" com divisória fina. Usar dentro de <dl>. */
export function Linha({ termo, valor, nota, className }: { termo: ReactNode; valor: ReactNode; nota?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line py-4', className)}>
      <dt className="text-ink-soft">
        {termo}
        {nota && <span className="block text-sm text-ink-mute">{nota}</span>}
      </dt>
      <dd className="text-right font-medium text-ink">{valor}</dd>
    </div>
  )
}
