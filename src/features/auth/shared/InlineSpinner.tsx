import { cn } from '@/lib/cn'

/** Indicador de progresso decorativo para dentro de botões (o texto do botão já diz o que está a acontecer). */
export function InlineSpinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-5 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80', className)}
    />
  )
}
