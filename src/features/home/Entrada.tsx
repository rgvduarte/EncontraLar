import type { ComponentProps } from 'react'
import { Reveal as RevealBase } from '@/components/motion/Reveal'
import { cn } from '@/lib/cn'

/**
 * Reveal com a transição certa para o Tailwind v4: `translate-*` e `scale-*` usam as propriedades individuais
 * `translate`/`scale`, que o Reveal partilhado não inclui em transition-property (só opacity/transform/filter) —
 * sem isto o bloco só esbate e o movimento salta. (Proposto ao componente partilhado; aí isto passa a ser redundante.)
 */
export function Reveal({ className, ...props }: ComponentProps<typeof RevealBase>) {
  return <RevealBase {...props} className={cn('transition-[opacity,translate,scale,filter]', className)} />
}
