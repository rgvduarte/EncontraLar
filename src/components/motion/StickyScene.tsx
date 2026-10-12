import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { measureProgress, prefersReducedMotion, subscribeScroll } from '@/lib/motion'
import { cn } from '@/lib/cn'

const SceneContext = createContext(0)

/** Progresso (0–1) da cena sticky envolvente. */
export const useSceneProgress = () => useContext(SceneContext)

/**
 * Cena "presa" ao ecrã enquanto se faz scroll (como as páginas de produto da Apple):
 * o contentor tem altura `length` (ex.: 300vh) e o conteúdo fica fixo no ecrã; os filhos
 * leem o progresso com useSceneProgress() ou a variável CSS --p do contentor fixo.
 * Com movimento reduzido: sem fixação, progresso = 1 (estado final), altura natural.
 */
export function StickyScene({
  length = '250vh',
  children,
  className,
  innerClassName,
  label,
}: {
  /** altura total da cena (quanto maior, mais lento) */
  length?: string
  children: ReactNode | ((progress: number) => ReactNode)
  className?: string
  innerClassName?: string
  /** rótulo acessível da secção */
  label?: string
}) {
  const outer = useRef<HTMLElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const [p, setP] = useState(0)
  const [reduced] = useState(prefersReducedMotion)

  useEffect(() => {
    if (reduced) {
      setP(1)
      return
    }
    return subscribeScroll(() => {
      const el = outer.current
      if (!el) return
      const v = measureProgress(el, 'sticky', 64)
      inner.current?.style.setProperty('--p', v.toFixed(4))
      setP((prev) => (Math.abs(prev - v) < 0.002 ? prev : v))
    })
  }, [reduced])

  return (
    <section ref={outer} aria-label={label} className={cn('relative', className)} style={reduced ? undefined : { height: length }}>
      <div
        ref={inner}
        className={cn(
          reduced ? 'relative' : 'sticky top-16 h-[calc(100dvh-4rem)] overflow-hidden',
          innerClassName,
        )}
      >
        <SceneContext.Provider value={p}>{typeof children === 'function' ? children(p) : children}</SceneContext.Provider>
      </div>
    </section>
  )
}
