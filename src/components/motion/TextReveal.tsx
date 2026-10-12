import { useRef, type ElementType } from 'react'
import { useScrollProgress, range } from '@/lib/motion'
import { cn } from '@/lib/cn'

/**
 * Texto que "se acende" palavra a palavra à medida que se faz scroll (efeito das páginas da Apple).
 * Acessível: o texto completo é lido normalmente (as palavras são texto real).
 */
export function TextReveal({
  text,
  as: As = 'p',
  className,
  dim = 0.18,
}: {
  text: string
  as?: ElementType
  className?: string
  /** opacidade das palavras ainda por revelar */
  dim?: number
}) {
  const ref = useRef<HTMLElement>(null)
  const p = useScrollProgress(ref, 'through')
  // revela entre 15% e 55% do percurso do bloco pelo ecrã
  const t = range(p, 0.15, 0.55)
  const words = text.split(/\s+/)
  return (
    <As ref={ref} className={cn('text-balance', className)}>
      {words.map((w, i) => {
        const local = range(t * words.length - i, 0, 1)
        return (
          <span key={i} style={{ opacity: dim + (1 - dim) * local, transition: 'opacity 120ms linear' }}>
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </span>
        )
      })}
    </As>
  )
}
