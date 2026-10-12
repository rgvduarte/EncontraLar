import { Children, isValidElement, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { useInView } from '@/lib/motion'
import { cn } from '@/lib/cn'

export type RevealVariant = 'up' | 'fade' | 'scale' | 'blur' | 'left' | 'right'

const HIDDEN: Record<RevealVariant, string> = {
  up: 'translate-y-8 opacity-0',
  fade: 'opacity-0',
  scale: 'scale-[0.94] opacity-0',
  blur: 'translate-y-4 opacity-0 blur-[10px]',
  left: '-translate-x-8 opacity-0',
  right: 'translate-x-8 opacity-0',
}

/**
 * Entrada suave quando o bloco entra no ecrã (estilo Apple). Respeita prefers-reduced-motion.
 * Ex.: <Reveal variant="blur" delay={120}>…</Reveal>
 */
export function Reveal({
  children,
  as: As = 'div',
  delay = 0,
  variant = 'up',
  duration = 1000,
  className,
  style,
}: {
  children: ReactNode
  as?: ElementType
  /** atraso em ms */
  delay?: number
  variant?: RevealVariant
  duration?: number
  className?: string
  style?: CSSProperties
}) {
  const [ref, inView] = useInView<HTMLElement>()
  return (
    <As
      ref={ref}
      style={{ transitionDelay: inView ? `${delay}ms` : '0ms', transitionDuration: `${duration}ms`, ...style }}
      className={cn(
        'transition-[opacity,transform,filter] ease-[cubic-bezier(.16,1,.3,1)] will-change-transform motion-reduce:transition-none',
        inView ? 'translate-x-0 translate-y-0 scale-100 opacity-100 blur-0' : HIDDEN[variant],
        className,
      )}
    >
      {children}
    </As>
  )
}

/** Revela os filhos um a um (escalonado). Cada filho direto é envolvido num <Reveal>. */
export function Stagger({
  children,
  step = 90,
  initialDelay = 0,
  variant = 'up',
  className,
  itemClassName,
  as: As = 'div',
}: {
  children: ReactNode
  step?: number
  initialDelay?: number
  variant?: RevealVariant
  className?: string
  itemClassName?: string
  as?: ElementType
}) {
  const items = Children.toArray(children).filter(isValidElement)
  return (
    <As className={className}>
      {items.map((child, i) => (
        <Reveal key={(child.key as string) ?? i} delay={initialDelay + i * step} variant={variant} className={itemClassName}>
          {child}
        </Reveal>
      ))}
    </As>
  )
}
