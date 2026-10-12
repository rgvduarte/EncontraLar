import { useRef, type ReactNode } from 'react'
import { useScrollVar } from '@/lib/motion'
import { cn } from '@/lib/cn'

/**
 * O elemento cresce (e arredonda menos) à medida que entra no ecrã — o "zoom" de produto da Apple.
 * Usa a variável CSS --p (0→1) sem re-renders.
 */
export function ScrollZoom({
  children,
  from = 0.88,
  radiusFrom = 56,
  radiusTo = 28,
  className,
}: {
  children: ReactNode
  /** escala inicial */
  from?: number
  radiusFrom?: number
  radiusTo?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  useScrollVar(ref, 'enter')
  return (
    <div
      ref={ref}
      className={cn('overflow-hidden will-change-transform', className)}
      style={{
        transform: `scale(calc(${from} + (1 - ${from}) * var(--p, 1)))`,
        borderRadius: `calc(${radiusFrom}px - (${radiusFrom - radiusTo}px * var(--p, 1)))`,
        transformOrigin: '50% 30%',
      }}
    >
      {children}
    </div>
  )
}
