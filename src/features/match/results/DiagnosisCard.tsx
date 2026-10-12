import { ArrowLeft, Compass, SlidersHorizontal } from 'lucide-react'
import { AzulejoBand } from '@/components/brand/patterns'
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
    <section
      aria-labelledby="diagnostico-t"
      className={cn(
        'relative overflow-hidden rounded-4xl border',
        vazio ? 'border-terra-200 bg-white shadow-card' : 'border-sun-200 bg-sun-50/60',
        className,
      )}
    >
      {vazio && <AzulejoBand className="h-3" color="#b9472f" opacity={0.45} size={24} />}
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:p-8">
        <span
          aria-hidden
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-2xl',
            vazio ? 'bg-terra-100 text-terra-700' : 'bg-sun-100 text-sun-800',
          )}
        >
          {vazio ? <Compass className="size-7" /> : <SlidersHorizontal className="size-7" />}
        </span>
        <div className="flex flex-col gap-3">
          <p className="eyebrow text-terra-700">{vazio ? 'O que está a limitar a pesquisa' : 'Poucas opções? Isto ajuda'}</p>
          <h2 id="diagnostico-t" className="font-display text-2xl font-semibold text-ink sm:text-3xl">
            {d.titulo}
          </h2>
          <p className="max-w-2xl text-lg text-ink-soft">{d.texto}</p>
          {d.ajustes.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-3">
              {d.ajustes.map((a, i) => (
                <Button
                  key={a.label}
                  variant={i === 0 ? (vazio ? 'primary' : 'secondary') : 'secondary'}
                  onClick={() => onAjuste(a)}
                  icon={a.passo != null ? <ArrowLeft aria-hidden className="size-5" /> : undefined}
                  className="whitespace-normal text-left"
                >
                  {a.label}
                </Button>
              ))}
            </div>
          )}
          {vazio && (
            <p className="mt-1 text-sm text-ink-mute">
              Os ajustes ficam visíveis na frase do perfil, acima — pode desfazê-los a qualquer momento.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
