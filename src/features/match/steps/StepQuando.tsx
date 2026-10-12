import type { Comodidade, Urgencia } from '@/types'
import { COMODIDADE_LABEL, COMODIDADES_ORDEM, URGENCIA_LABEL } from '@/lib/labels'
import { ToggleChip } from '../controls/Chips'
import { MAX_PREFERENCIAS } from '../model'
import { flex } from '../language'
import type { StepProps } from './types'
import { ChoiceTile } from '../controls/ChoiceTile'

const URGENCIAS: { v: Urgencia; desc: string }[] = [
  { v: 'imediata', desc: 'Alta hospitalar marcada, uma queda recente, ou já não é seguro ficar em casa.' },
  { v: '1-3meses', desc: 'A situação está a ficar difícil.' },
  { v: '3-6meses', desc: 'Há tempo para visitar com calma.' },
  { v: 'planeamento', desc: 'Para conhecer opções e inscrever-se cedo.' },
]

export function StepQuando({ r, patch, erros, p }: StepProps) {
  const cheio = r.preferencias.length >= MAX_PREFERENCIAS

  const alternar = (c: Comodidade) => {
    const tem = r.preferencias.includes(c)
    if (!tem && cheio) return
    patch({ preferencias: tem ? r.preferencias.filter((x) => x !== c) : [...r.preferencias, c] })
  }

  return (
    <div className="flex flex-col gap-16">
      <fieldset aria-describedby={erros.urgencia ? 'urgencia-err' : undefined}>
        <legend className="sr-only">Para quando precisa de vaga</legend>
        <div className="flex flex-col gap-3">
          {URGENCIAS.map(({ v, desc }, i) => (
            <ChoiceTile
              key={v}
              name="urgencia"
              value={v}
              checked={r.urgencia === v}
              onChange={() => patch({ urgencia: v })}
              aria-invalid={erros.urgencia && i === 0 ? true : undefined}
              label={URGENCIA_LABEL[v]}
              description={desc}
            />
          ))}
        </div>
        {erros.urgencia && (
          <p id="urgencia-err" role="alert" className="mt-4 text-sm font-medium text-alert-700">
            {erros.urgencia}
          </p>
        )}
        {r.urgencia === 'imediata' && (
          <p className="mt-5 animate-fade-in text-base text-ink-soft">
            Se {p.proprio ? '' : `${p.pronome} `}está {flex(p.fem, 'internado', 'internada')}, fale já com a assistente social do
            hospital: pode pedir a referenciação para a Rede Nacional de Cuidados Continuados, que faz a ponte até haver vaga num
            lar.
          </p>
        )}
      </fieldset>

      <section aria-labelledby="prioridades-t">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="prioridades-t" className="text-base font-medium tracking-normal text-ink">
            O que mais importa?
          </h2>
          <p className="text-sm text-ink-mute tabular" aria-live="polite">
            {r.preferencias.length} de {MAX_PREFERENCIAS}
          </p>
        </div>
        <p className="mt-0.5 text-sm text-ink-mute">
          {cheio
            ? 'Chegou ao máximo. Retire uma para escolher outra.'
            : `Escolha até ${MAX_PREFERENCIAS}. Contam a favor, mas não excluem nenhum lar.`}
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {COMODIDADES_ORDEM.map((c) => {
            const on = r.preferencias.includes(c)
            return (
              <li key={c}>
                <ToggleChip pressed={on} onToggle={() => alternar(c)} disabled={!on && cheio}>
                  {COMODIDADE_LABEL[c]}
                </ToggleChip>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
