import type { ReactNode } from 'react'
import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'

/**
 * Secção da ficha: etiqueta curta (igual à navegação), um título grande e, no máximo, uma frase de apoio.
 * Cada secção é uma "cena": o cabeçalho entra com desfoque (etiqueta → título → frase, escalonados) e o
 * conteúdo entra por blocos (cada secção decide os seus com <Reveal>/<Cascata>).
 * O id serve a navegação interna (scrollIntoView/Lenis) — nunca usar links '#id' por causa do HashRouter.
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
      <header className="mb-10 sm:mb-14">
        <Reveal variant="fade" duration={800}>
          <p className="eyebrow">{rotulo}</p>
        </Reveal>
        <Reveal variant="blur" delay={80}>
          <h2 id={`${id}-titulo`} className="mt-2 text-[2.125rem] leading-[1.08] font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl">
            {titulo}
          </h2>
        </Reveal>
        {intro && (
          <Reveal variant="up" delay={180}>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-mute sm:text-xl">{intro}</p>
          </Reveal>
        )}
      </header>
      {children}
    </section>
  )
}

/** Bloco de conteúdo que entra ao aparecer (parágrafos, tabelas, mapa…). */
export function Bloco({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal variant="up" delay={delay} className={className}>
      {children}
    </Reveal>
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
      <dd className="order-1 text-[3.25rem] leading-none font-semibold tracking-tight text-ink tabular sm:text-6xl">
        {valor}
        {unidade && <span className="ml-1 text-2xl tracking-tight sm:text-3xl">{unidade}</span>}
      </dd>
      {nota && <dd className="order-3 mt-1 text-sm text-ink-mute">{nota}</dd>}
    </div>
  )
}

/**
 * Linha "termo — valor" com divisória fina. Usar dentro de <dl>.
 * No telemóvel empilha (termo por cima, valor por baixo, alinhados à esquerda) — sem colunas apertadas.
 */
export function Linha({ termo, valor, nota, className }: { termo: ReactNode; valor: ReactNode; nota?: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 border-b border-line py-4 sm:flex-row sm:flex-wrap sm:items-baseline sm:justify-between sm:gap-x-6 sm:gap-y-1',
        className,
      )}
    >
      <dt className="text-ink-soft max-sm:text-sm max-sm:text-ink-mute">
        {termo}
        {nota && <span className="block text-sm text-ink-mute">{nota}</span>}
      </dt>
      <dd className="font-medium text-ink sm:text-right">{valor}</dd>
    </div>
  )
}
