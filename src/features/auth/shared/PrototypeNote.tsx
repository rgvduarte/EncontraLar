import type { ReactNode } from 'react'
import { MonitorSmartphone } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Aviso honesto: no protótipo as contas vivem só no navegador. */
export function PrototypeNote({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <p className={cn('flex items-start gap-3 text-sm text-ink-soft', className)}>
      <MonitorSmartphone aria-hidden className="mt-0.5 size-5 shrink-0 text-terra-600" />
      <span>
        <strong className="font-bold text-ink">Protótipo:</strong>{' '}
        {children ?? 'os dados ficam apenas neste navegador. Nada é enviado para um servidor e nenhum email é enviado.'}
      </span>
    </p>
  )
}
