import { AlarmClock, CalendarClock, CalendarRange, Hospital, Sprout, type LucideIcon } from 'lucide-react'
import type { Comodidade, Urgencia } from '@/types'
import { ChoiceCard } from '@/components/ui/Field'
import { COMODIDADE_ICON } from '@/components/lar/icons'
import { COMODIDADE_LABEL, COMODIDADES_ORDEM, URGENCIA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { ToggleChip } from '../controls/Chips'
import { MAX_PREFERENCIAS } from '../model'
import type { StepProps } from './types'

const URGENCIAS: { v: Urgencia; desc: string; Icon: LucideIcon }[] = [
  {
    v: 'imediata',
    desc: 'Alta hospitalar marcada, uma queda recente, ou já não é seguro ficar em casa. Damos prioridade a lares com vaga agora.',
    Icon: AlarmClock,
  },
  { v: '1-3meses', desc: 'A situação está a ficar difícil e quer resolver em breve.', Icon: CalendarClock },
  { v: '3-6meses', desc: 'Há tempo para visitar com calma e inscrever-se em listas de espera.', Icon: CalendarRange },
  {
    v: 'planeamento',
    desc: 'Quer conhecer opções e inscrever-se cedo — nos lares mais procurados, a espera conta-se em meses.',
    Icon: Sprout,
  },
]

export function StepQuando({ r, patch, erros, p }: StepProps) {
  const cheio = r.preferencias.length >= MAX_PREFERENCIAS

  const alternar = (c: Comodidade) => {
    const tem = r.preferencias.includes(c)
    if (!tem && cheio) return
    patch({ preferencias: tem ? r.preferencias.filter((x) => x !== c) : [...r.preferencias, c] })
  }

  return (
    <div className="flex flex-col gap-12">
      <fieldset className="flex flex-col gap-4" aria-describedby={erros.urgencia ? 'urgencia-err' : undefined}>
        <legend className="sr-only">Urgência</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {URGENCIAS.map(({ v, desc, Icon }, i) => (
            <ChoiceCard
              key={v}
              name="urgencia"
              value={v}
              checked={r.urgencia === v}
              onChange={() => patch({ urgencia: v })}
              aria-invalid={erros.urgencia && i === 0 ? true : undefined}
              icon={<Icon aria-hidden />}
              label={URGENCIA_LABEL[v]}
              description={desc}
              className={cn('p-5', v === 'imediata' && 'has-[:checked]:border-terra-600 has-[:checked]:bg-terra-50')}
            />
          ))}
        </div>
        {erros.urgencia && (
          <p id="urgencia-err" role="alert" className="text-sm font-bold text-alert-700">
            {erros.urgencia}
          </p>
        )}
        {r.urgencia === 'imediata' && (
          <aside className="flex animate-fade-up items-start gap-4 rounded-3xl border border-terra-200 bg-terra-50 px-5 py-4 text-terra-900">
            <Hospital aria-hidden className="mt-0.5 size-6 shrink-0 text-terra-700" />
            <p className="text-base">
              <strong>Se {p.proprio ? 'está' : `${p.pronome} está`} internado(a)</strong>, fale já com a assistente social do hospital:
              pode pedir a referenciação para a Rede Nacional de Cuidados Continuados Integrados, que ajuda a fazer a ponte até
              haver vaga num lar.
            </p>
          </aside>
        )}
      </fieldset>

      <section aria-labelledby="prioridades-t" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="prioridades-t" className="font-display text-3xl font-semibold text-ink">
              O que mais importa {p.proprio ? 'para si' : `para ${p.pronome}`}?
            </h2>
            <p className="mt-1 text-base text-ink-soft">Escolha até {MAX_PREFERENCIAS}. Contam a favor, mas não excluem nenhum lar.</p>
          </div>
          <p className="text-sm font-bold text-ink-soft tabular" aria-live="polite">
            {r.preferencias.length} de {MAX_PREFERENCIAS}
            {cheio && <span className="font-normal"> — retire uma para escolher outra</span>}
          </p>
        </div>
        <ul className="flex flex-wrap gap-2.5">
          {COMODIDADES_ORDEM.map((c) => {
            const Icon = COMODIDADE_ICON[c]
            const on = r.preferencias.includes(c)
            return (
              <li key={c}>
                <ToggleChip pressed={on} onToggle={() => alternar(c)} disabled={!on && cheio} icon={<Icon aria-hidden />}>
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
