import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface FaqItem {
  q: string
  a: ReactNode
}

/**
 * Perguntas frequentes com <details> nativo: teclado, leitor de ecrã e pesquisa do navegador
 * funcionam sem JavaScript extra. Linhas finas, sem caixas.
 */
export function FaqList({ items, className }: { items: readonly FaqItem[]; className?: string }) {
  return (
    <div className={cn('border-b border-line', className)}>
      {items.map((it) => (
        <details key={it.q} className="group border-t border-line">
          <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-6 py-5 text-left [&::-webkit-details-marker]:hidden">
            <span className="text-lg leading-snug font-semibold text-ink sm:text-xl">{it.q}</span>
            <Plus
              aria-hidden
              strokeWidth={1.75}
              className="size-6 shrink-0 text-ink-mute transition-transform duration-300 ease-[cubic-bezier(.25,.1,.25,1)] group-open:rotate-45 group-open:text-ink"
            />
          </summary>
          <div className="max-w-[62ch] pb-7 text-lg leading-relaxed text-ink-soft [&_p+p]:mt-3">{it.a}</div>
        </details>
      ))}
    </div>
  )
}
