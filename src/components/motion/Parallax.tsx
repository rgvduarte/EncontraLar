import { useEffect, useRef, type ReactNode } from 'react'
import { measureProgress, prefersReducedMotion, subscribeScroll } from '@/lib/motion'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'

/**
 * Deslocação vertical subtil com o scroll (profundidade). speed em px.
 * Mede um invólucro que não se move e escreve `transform` diretamente no filho (sem re-render nem
 * variáveis herdadas). Desligada em ecrãs pequenos e com movimento reduzido.
 */
export function Parallax({ children, speed = 60, className }: { children: ReactNode; speed?: number; className?: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const desktop = useMediaQuery('(min-width: 768px)')
  useEffect(() => {
    const i = inner.current
    if (!desktop || prefersReducedMotion()) {
      if (i) i.style.transform = ''
      return
    }
    let last = -1
    return subscribeScroll(() => {
      const o = outer.current
      const el = inner.current
      if (!o || !el) return
      const p = measureProgress(o, 'through')
      if (Math.abs(p - last) < 0.001) return
      last = p
      el.style.transform = `translate3d(0, ${((0.5 - p) * speed * 2).toFixed(2)}px, 0)`
    })
  }, [desktop, speed])
  return (
    <div ref={outer} className={className}>
      <div ref={inner} className={cn(desktop && 'will-change-transform')}>
        {children}
      </div>
    </div>
  )
}
