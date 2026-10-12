import { CircleAlert, CircleCheck, CircleX } from 'lucide-react'
import type { Lar, PerfilIdoso } from '@/types'
import { cn } from '@/lib/cn'
import { verificarCompatibilidade } from '../lib/derive'

/** Verificação automática do pedido contra a ficha desta instituição — "ok" ou "falta", sempre com texto. */
export function CompatChecklist({ lar, perfil, compact, className }: { lar: Lar; perfil: PerfilIdoso; compact?: boolean; className?: string }) {
  const checks = verificarCompatibilidade(lar, perfil)
  const faltas = checks.filter((c) => c.estado === 'falta').length
  return (
    <div className={className}>
      <p className={cn('flex items-center gap-2 font-bold', faltas ? 'text-alert-700' : 'text-leaf-700')}>
        {faltas ? <CircleAlert aria-hidden className="size-5 shrink-0" /> : <CircleCheck aria-hidden className="size-5 shrink-0" />}
        {faltas ? `${faltas} ${faltas === 1 ? 'ponto a verificar' : 'pontos a verificar'}` : 'Compatível com a sua ficha'}
      </p>
      <ul className={cn('mt-3 flex flex-col', compact ? 'gap-2' : 'gap-3')}>
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2.5">
            {c.estado === 'ok' ? (
              <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-leaf-600" />
            ) : (
              <CircleX aria-hidden className="mt-0.5 size-5 shrink-0 text-alert-600" />
            )}
            <span className="text-sm leading-snug">
              <span className="sr-only">{c.estado === 'ok' ? 'Cumpre: ' : 'Falta: '}</span>
              <span className="block font-bold text-ink">{c.titulo}</span>
              <span className="text-ink-soft">{c.texto}</span>
            </span>
          </li>
        ))}
      </ul>
      {!compact && <p className="mt-3 text-xs text-ink-mute">Verificação automática com base na sua ficha. Confirme sempre com a família.</p>}
    </div>
  )
}
