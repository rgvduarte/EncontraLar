import type { ReactNode } from 'react'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface FaqItem {
  q: string
  a: ReactNode
}

/** Perguntas frequentes com <details> nativo: teclado, leitor de ecrã e pesquisa do navegador funcionam sem JS extra. */
export function FaqList({ items, className, tone = 'light' }: { items: readonly FaqItem[]; className?: string; tone?: 'light' | 'sand' }) {
  return (
    <div className={cn('divide-y divide-line-strong border-y border-line-strong', className)}>
      {items.map((it) => (
        <details key={it.q} className="group">
          <summary
            className={cn(
              'flex min-h-16 cursor-pointer list-none items-center justify-between gap-5 py-4 text-left [&::-webkit-details-marker]:hidden',
              'rounded-lg focus-visible:outline-offset-4',
            )}
          >
            <span className="font-display text-xl leading-snug font-semibold text-ink group-open:text-pine-800 sm:text-2xl">{it.q}</span>
            <span
              aria-hidden
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-line-strong text-pine-800 transition-all group-open:rotate-45 group-open:border-pine-700 group-open:bg-pine-700 group-open:text-white',
                tone === 'sand' ? 'bg-cream' : 'bg-white',
              )}
            >
              <Plus className="size-5" />
            </span>
          </summary>
          <div className="max-w-[68ch] pb-7 text-lg leading-relaxed text-ink-soft [&_p+p]:mt-3 [&_strong]:text-ink">{it.a}</div>
        </details>
      ))}
    </div>
  )
}
