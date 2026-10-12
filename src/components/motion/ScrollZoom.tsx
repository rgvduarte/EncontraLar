import { useEffect, useRef, type ReactNode } from 'react'
import { measureProgress, prefersReducedMotion, subscribeScroll } from '@/lib/motion'
import { cn } from '@/lib/cn'

/**
 * O elemento cresce à medida que entra no ecrã — o "zoom" de produto da Apple.
 * Escreve `transform` diretamente (sem variáveis CSS herdadas → sem recálculo de estilos da subárvore)
 * e mantém o raio fixo (animar border-radius obriga a repintar em cada frame).
 */
export function ScrollZoom({
  children,
  from = 0.88,
  radiusTo = 28,
  className,
}: {
  children: ReactNode
  /** escala inicial */
  from?: number
  /** @deprecated o raio já não é animado (desempenho); mantido por compatibilidade */
  radiusFrom?: number
  radiusTo?: number
  className?: string
}) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    let last = -1
    return subscribeScroll(() => {
      const o = outer.current
      const i = inner.current
      if (!o || !i) return
      const p = measureProgress(o, 'enter')
      if (Math.abs(p - last) < 0.001) return
      last = p
      i.style.transform = `scale(${(from + (1 - from) * p).toFixed(4)})`
    })
  }, [from])
  return (
    // o invólucro exterior só serve para medir (não se move); a classe do chamador vai para o bloco que escala
    <div ref={outer}>
      <div
        ref={inner}
        className={cn('overflow-hidden will-change-transform', className)}
        style={{ borderRadius: radiusTo, transformOrigin: '50% 30%', transform: prefersReducedMotion() ? undefined : `scale(${from})` }}
      >
        {children}
      </div>
    </div>
  )
}
