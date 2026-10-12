import { useRef, type ReactNode } from 'react'
import { useScrollVar } from '@/lib/motion'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'

/**
 * Deslocação vertical subtil com o scroll (profundidade). speed em px.
 * Desligada em ecrãs pequenos (paralaxe em telemóvel tende a "engasgar" e distrair).
 */
export function Parallax({ children, speed = 60, className }: { children: ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const desktop = useMediaQuery('(min-width: 768px)')
  useScrollVar(ref, 'through')
  const s = desktop ? speed : 0
  return (
    <div ref={ref} className={cn('will-change-transform', className)} style={{ transform: `translate3d(0, calc((0.5 - var(--p, 0.5)) * ${s * 2}px), 0)` }}>
      {children}
    </div>
  )
}
