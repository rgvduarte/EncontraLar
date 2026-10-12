import type { ReactNode } from 'react'
import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Resumo de erros no topo do formulário (padrão GOV.UK): anunciado por leitores de ecrã
 * e com atalhos que levam o foco ao campo a corrigir.
 */
export function ErrorSummary<K extends string>({
  errors,
  onSelect,
  title,
  extra,
  className,
}: {
  errors: { key: K; message: string }[]
  onSelect: (key: K) => void
  title?: string
  /** erro geral, não associado a um campo */
  extra?: ReactNode
  className?: string
}) {
  if (!errors.length && !extra) return null
  const n = errors.length
  return (
    <div
      role="alert"
      className={cn('animate-fade-in rounded-2xl border-2 border-alert-600/50 bg-alert-50 p-5 sm:p-6', className)}
    >
      <p className="flex items-center gap-2.5 text-lg font-bold text-alert-700">
        <TriangleAlert aria-hidden className="size-6 shrink-0" />
        {title ?? (n === 1 ? 'Há um campo por corrigir' : n > 1 ? `Há ${n} campos por corrigir` : 'Não foi possível continuar')}
      </p>
      {extra && <div className="mt-2 text-ink">{extra}</div>}
      {n > 0 && (
        <ul className="mt-3 flex flex-col gap-1 pl-8.5">
          {errors.map((e) => (
            <li key={e.key} className="list-disc marker:text-alert-600">
              <button
                type="button"
                onClick={() => onSelect(e.key)}
                className="min-h-10 text-left font-semibold text-alert-700 underline decoration-alert-600/50 decoration-2 underline-offset-4 hover:decoration-alert-700"
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
