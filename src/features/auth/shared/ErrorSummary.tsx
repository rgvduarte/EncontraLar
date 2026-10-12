import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Resumo de erros no topo do formulário: anunciado por leitores de ecrã,
 * com atalhos que levam o foco ao campo a corrigir. Entra com um deslize suave (sem abanar).
 */
export function ErrorSummary<K extends string>({
  errors,
  onSelect,
  extra,
  className,
}: {
  errors: { key: K; message: string }[]
  onSelect: (key: K) => void
  /** erro geral, não associado a um campo */
  extra?: ReactNode
  className?: string
}) {
  if (!errors.length && !extra) return null
  const n = errors.length
  return (
    <div
      role="alert"
      className={cn(
        'animate-[pop-in_.38s_cubic-bezier(.16,1,.3,1)_both] rounded-2xl bg-alert-50 px-5 py-4 motion-reduce:animate-none',
        className,
      )}
    >
      <p className="flex items-center gap-2 font-semibold text-alert-700">
        <AlertCircle aria-hidden className="size-5 shrink-0" />
        {n === 1 ? 'Falta corrigir um campo' : n > 1 ? `Falta corrigir ${n} campos` : 'Não foi possível continuar'}
      </p>
      {extra && <p className="mt-1 text-sm text-ink">{extra}</p>}
      {n > 0 && (
        <ul className="mt-1 flex flex-col">
          {errors.map((e) => (
            <li key={e.key}>
              <button
                type="button"
                onClick={() => onSelect(e.key)}
                className="min-h-12 py-2 text-left text-sm text-alert-700 underline decoration-alert-600/40 underline-offset-4 hover:decoration-alert-700"
              >
                {e.message}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
