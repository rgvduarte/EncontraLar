import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Secção da ficha com cabeçalho editorial: filete duplo, número em itálico e título com ênfase.
 * O id é usado pela navegação interna (scrollIntoView) — não usar links '#id' por causa do HashRouter.
 */
export function Secao({
  id,
  numero,
  rotulo,
  titulo,
  intro,
  children,
  className,
}: {
  id: string
  numero: number
  rotulo: string
  titulo: ReactNode
  intro?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-titulo`} tabIndex={-1} className={cn('scroll-mt-36 outline-none', className)}>
      <header className="mb-8 sm:mb-10">
        <div aria-hidden className="border-t-2 border-ink" />
        <div aria-hidden className="mt-[3px] border-t border-ink" />
        <p className="mt-4 flex items-baseline gap-3">
          <span aria-hidden className="font-display text-xl text-terra-600 italic tabular">
            {String(numero).padStart(2, '0')}
          </span>
          <span className="eyebrow">{rotulo}</span>
        </p>
        <h2 id={`${id}-titulo`} className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
          {titulo}
        </h2>
        {intro && <p className="mt-3 max-w-2xl text-lg text-ink-soft">{intro}</p>}
      </header>
      {children}
    </section>
  )
}

/** Subtítulo dentro de uma secção. */
export function Subtitulo({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-xl font-semibold text-ink sm:text-2xl', className)}>{children}</h3>
}

/** Linha "nome ........ valor" (estilo ementa / registo), com pontos de ligação. */
export function LinhaPontilhada({ termo, valor, className }: { termo: ReactNode; valor: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-baseline gap-3 py-2.5', className)}>
      <dt className="flex min-w-0 flex-1 items-baseline gap-3 text-ink-soft">
        <span className="min-w-0">{termo}</span>
        <span aria-hidden className="min-w-6 flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-line-strong" />
      </dt>
      <dd className="max-w-[60%] text-right font-semibold text-ink">{valor}</dd>
    </div>
  )
}

/** Nota de rodapé discreta (fontes, ressalvas). */
export function Nota({ children, className, icon }: { children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <p className={cn('flex gap-2.5 text-sm text-ink-soft [&_svg]:mt-0.5 [&_svg]:size-4.5 [&_svg]:shrink-0', className)}>
      {icon}
      <span>{children}</span>
    </p>
  )
}
