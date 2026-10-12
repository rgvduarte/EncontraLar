import { useEffect, useRef, useState, type ReactNode } from 'react'
import { measureProgress, prefersReducedMotion, subscribeScroll } from '@/lib/motion'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'

/**
 * Galeria horizontal guiada pelo scroll vertical (secção "presa"), como nas páginas da Apple.
 * Desktop: ao descer, a faixa desliza para a esquerda. Telemóvel / movimento reduzido: faixa
 * deslizável com o dedo (scroll-snap nativo) — sem sequestrar o scroll.
 */
export function HorizontalScroll({
  children,
  header,
  className,
  trackClassName,
  label,
}: {
  /** itens da faixa (cada filho = um cartão) */
  children: ReactNode
  /** título/intro fixo por cima da faixa */
  header?: ReactNode
  className?: string
  trackClassName?: string
  label?: string
}) {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [reduced] = useState(prefersReducedMotion)
  const pinned = desktop && !reduced
  const outer = useRef<HTMLElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [dist, setDist] = useState(0)

  useEffect(() => {
    if (!pinned) return
    const medir = () => {
      const t = track.current
      if (t) setDist(Math.max(0, t.scrollWidth - window.innerWidth + 80))
    }
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [pinned, children])

  useEffect(() => {
    if (!pinned) return
    return subscribeScroll(() => {
      const el = outer.current
      const t = track.current
      if (!el || !t) return
      const p = measureProgress(el, 'sticky', 64)
      t.style.transform = `translate3d(${-p * dist}px,0,0)`
    })
  }, [pinned, dist])

  if (!pinned) {
    return (
      <section aria-label={label} className={cn('py-4', className)}>
        {header}
        {/* overflow-y-hidden: sem ele a faixa (cartões com Reveal/hover) tem uns px de scroll vertical e "agarra" o gesto
            vertical — a página deixa de descer com o dedo ou a roda (com a regra global de index.css).
            tabIndex 0 + nome: com o teclado (setas) também se percorre a faixa, mesmo em browsers que não tornam
            os contentores com scroll focáveis (Safari); role="group" e não "region" para não duplicar o marco da secção.
            pt-2: espaço para o anel de foco dos cartões (a faixa corta o que passa dos seus limites). */}
        <div
          tabIndex={0}
          role="group"
          aria-label={label ? `${label}: deslize ou use as setas para ver mais` : 'Deslize ou use as setas para ver mais'}
          className={cn(
            'relative flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overflow-y-hidden px-5 pt-2 pb-4 [scrollbar-width:none] sm:px-8',
            // anel de foco por dentro: a faixa ocupa a largura toda e um anel por fora ficava cortado nas margens do ecrã
            'focus-visible:rounded-[1.75rem] focus-visible:outline-offset-[-3px]',
            trackClassName,
          )}
          data-lenis-prevent-horizontal
        >
          {children}
        </div>
      </section>
    )
  }

  return (
    <section ref={outer} aria-label={label} className={cn('relative', className)} style={{ height: `calc(100dvh + ${dist}px)` }}>
      <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col justify-center overflow-hidden">
        {header}
        <div ref={track} className={cn('flex gap-6 px-10 will-change-transform', trackClassName)}>
          {children}
        </div>
      </div>
    </section>
  )
}
