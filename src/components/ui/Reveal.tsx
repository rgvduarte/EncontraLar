import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Entrada suave quando o bloco entra no ecrã (estilo Apple).
 * Respeita prefers-reduced-motion (aparece logo).
 */
export function Reveal({
  children,
  as: As = 'div',
  delay = 0,
  className,
}: {
  children: ReactNode
  as?: ElementType
  /** atraso em ms (para escalonar elementos irmãos) */
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <As
      ref={ref}
      style={{ transitionDelay: visible ? `${delay}ms` : undefined }}
      className={cn(
        'transition-[opacity,transform] duration-[900ms] ease-[cubic-bezier(.2,.7,.2,1)] motion-reduce:transition-none',
        visible ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
        className,
      )}
    >
      {children}
    </As>
  )
}
