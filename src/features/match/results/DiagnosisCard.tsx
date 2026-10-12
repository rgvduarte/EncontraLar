import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import type { Ajuste, Diagnostico } from '../diagnose'

/**
 * Explica o requisito que mais limita e oferece ajustes de um clique.
 * `variante="vazio"` quando não há nenhuma sugestão; `"poucas"` quando há uma ou duas.
 */
export function DiagnosisCard({
  d,
  variante,
  onAjuste,
  className,
}: {
  d: Diagnostico
  variante: 'vazio' | 'poucas'
  onAjuste: (a: Ajuste) => void
  className?: string
}) {
  const vazio = variante === 'vazio'
  return (
    <section aria-labelledby="diagnostico-t" className={cn('tile text-center', className)}>
      <p className="eyebrow">{vazio ? 'O que está a limitar' : 'Para ter mais opções'}</p>
      <h2
        id="diagnostico-t"
        className={cn('mx-auto mt-2 max-w-xl font-semibold text-ink', vazio ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl')}
      >
        {d.titulo}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-lg text-ink-mute">{d.texto}</p>
      {d.ajustes.length > 0 && (
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap">
          {d.ajustes.map((a, i) => (
            <Button
              key={a.label}
              variant={i === 0 ? 'primary' : 'secondary'}
              onClick={() => onAjuste(a)}
              className="w-full max-w-sm text-center whitespace-normal sm:w-auto sm:max-w-full"
            >
              {a.label}
            </Button>
          ))}
        </div>
      )}
    </section>
  )
}
