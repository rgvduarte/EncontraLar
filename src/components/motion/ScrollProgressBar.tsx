import { useEffect, useRef } from 'react'
import { prefersReducedMotion, subscribeScroll } from '@/lib/motion'

/** Barra fina de progresso de leitura, colada ao cabeçalho (páginas longas como o guia). */
export function ScrollProgressBar({ label = 'Progresso de leitura' }: { label?: string }) {
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    return subscribeScroll(() => {
      const h = document.documentElement.scrollHeight - window.innerHeight
      const p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0
      if (bar.current) bar.current.style.transform = `scaleX(${p})`
    })
  }, [])
  return (
    <div aria-hidden title={label} className="pointer-events-none fixed inset-x-0 top-16 z-[999] h-[2px]">
      <div ref={bar} className="h-full origin-left scale-x-0 bg-ink" />
    </div>
  )
}
