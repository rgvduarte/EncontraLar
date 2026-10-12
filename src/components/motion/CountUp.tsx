import { useEffect, useState } from 'react'
import { prefersReducedMotion, useInView, easeOut } from '@/lib/motion'

/** Número que conta até ao valor quando entra no ecrã. */
export function CountUp({
  value,
  duration = 1400,
  format = (n: number) => Math.round(n).toLocaleString('pt-PT'),
  className,
}: {
  value: number
  duration?: number
  format?: (n: number) => string
  className?: string
}) {
  const [ref, inView] = useInView<HTMLSpanElement>()
  const [n, setN] = useState(() => (prefersReducedMotion() ? value : 0))
  useEffect(() => {
    if (!inView) return
    if (prefersReducedMotion()) {
      setN(value)
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration)
      setN(value * easeOut(k))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden>{format(n)}</span>
    </span>
  )
}
