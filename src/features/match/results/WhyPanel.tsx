import { useId, useState } from 'react'
import { ChevronDown, CircleCheck, CircleMinus, CircleX, type LucideIcon } from 'lucide-react'
import { PESOS, scoreLabel, type MatchResult, type TipoRazao } from '@/lib/matching'
import { cn } from '@/lib/cn'

const PARCELA_LABEL: Record<keyof typeof PESOS, string> = {
  cuidados: 'Cuidados de saúde',
  orcamento: 'Orçamento',
  distancia: 'Distância',
  disponibilidade: 'Vaga para o prazo',
  preferencias: 'Preferências e quarto',
}

const RAZAO: Record<TipoRazao, { sr: string; Icon: LucideIcon; cor: string }> = {
  ok: { sr: 'A favor', Icon: CircleCheck, cor: 'text-leaf-600' },
  parcial: { sr: 'A ponderar', Icon: CircleMinus, cor: 'text-sun-700' },
  falta: { sr: 'Em falta', Icon: CircleX, cor: 'text-alert-600' },
}

/** Quanto cada critério contribuiu, sobre o seu peso máximo. */
function Parcelas({ m }: { m: MatchResult }) {
  return (
    <ul className="flex flex-col gap-4">
      {(Object.keys(PESOS) as (keyof typeof PESOS)[]).map((k) => {
        const v = Math.round(m.parcelas[k])
        const peso = PESOS[k]
        return (
          <li key={k}>
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink">{PARCELA_LABEL[k]}</span>
              <span className="text-ink-mute tabular">
                <span className="font-medium text-ink">{v}</span> de {peso}
              </span>
            </p>
            <span aria-hidden className="mt-1.5 block h-1 rounded-full bg-black/[0.08]">
              <span className="block h-full rounded-full bg-ink" style={{ width: `${(m.parcelas[k] / peso) * 100}%` }} />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/** "Porque sugerimos": razões a favor / a ponderar / em falta e as parcelas da pontuação. */
export function WhyPanel({ m, nome }: { m: MatchResult; nome: string }) {
  const [aberto, setAberto] = useState(false)
  const id = useId()
  const nOk = m.razoes.filter((r) => r.tipo === 'ok').length
  const nFalta = m.razoes.filter((r) => r.tipo === 'falta').length

  return (
    <div className="px-3 sm:px-0">
      <div className="flex flex-wrap items-center gap-x-4">
        <button
          type="button"
          aria-expanded={aberto}
          aria-controls={id}
          onClick={() => setAberto((a) => !a)}
          className="link inline-flex min-h-12 items-center gap-1 rounded-lg text-base"
        >
          Porque sugerimos<span className="sr-only"> {nome}</span>
          <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-300', aberto && 'rotate-180')} />
        </button>
        <span className="text-sm text-ink-mute">
          {nOk} a favor{nFalta > 0 && ` · ${nFalta} em falta`}
        </span>
      </div>

      {aberto && (
        <div
          id={id}
          className="mt-2 grid animate-fade-in gap-10 rounded-[1.5rem] bg-sand p-6 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:p-8"
        >
          <ul className="flex flex-col gap-2.5">
            {m.razoes.map((r, i) => {
              const g = RAZAO[r.tipo]
              return (
                <li key={i} className="flex items-start gap-2.5 text-base leading-snug text-ink">
                  <g.Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', g.cor)} strokeWidth={1.8} />
                  <span>
                    <span className="sr-only">{g.sr}: </span>
                    {r.texto}
                  </span>
                </li>
              )
            })}
          </ul>
          <div>
            <p className="mb-4 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-ink">{scoreLabel(m.score)}</span>
              <span className="text-2xl font-semibold text-ink tabular">{m.score}%</span>
            </p>
            <Parcelas m={m} />
            {!m.compativel && (
              <p className="mt-4 text-sm text-ink-soft">
                Falha um requisito essencial, por isso a pontuação fica limitada a 35%.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
