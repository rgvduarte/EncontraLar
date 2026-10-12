import { cn } from '@/lib/cn'

/** Aviso honesto e discreto: no protótipo as contas vivem só no navegador. */
export function PrototypeNote({ className }: { className?: string }) {
  return (
    <p className={cn('text-center text-xs text-ink-mute', className)}>
      Protótipo: os dados ficam só neste navegador e não enviamos emails.
    </p>
  )
}
