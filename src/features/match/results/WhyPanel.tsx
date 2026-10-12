import { useId, useState } from 'react'
import { ChevronDown, CircleCheck, CircleMinus, CircleX, type LucideIcon } from 'lucide-react'
import { PESOS, scoreLabel, type MatchResult, type TipoRazao } from '@/lib/matching'
import { cn } from '@/lib/cn'

export const PARCELA_LABEL: Record<keyof typeof PESOS, string> = {
  cuidados: 'Cuidados de saúde',
  orcamento: 'Orçamento',
  distancia: 'Distância',
  disponibilidade: 'Vaga para o prazo',
  preferencias: 'Preferências e quarto',
}

const GRUPO: Record<TipoRazao, { titulo: string; Icon: LucideIcon; cor: string }> = {
  ok: { titulo: 'A favor', Icon: CircleCheck, cor: 'text-leaf-600' },
  parcial: { titulo: 'A ponderar', Icon: CircleMinus, cor: 'text-sun-700' },
  falta: { titulo: 'Em falta', Icon: CircleX, cor: 'text-alert-600' },
}

const MAX_PESO = Math.max(...Object.values(PESOS))

/** Barras: quanto cada critério contribuiu, sobre o seu peso máximo (larguras proporcionais aos pesos). */
export function Parcelas({ m, className }: { m: MatchResult; className?: string }) {
  return (
    <div className={className}>
      <ul className="flex flex-col gap-3">
        {(Object.keys(PESOS) as (keyof typeof PESOS)[]).map((k) => {
          const v = m.parcelas[k]
          const peso = PESOS[k]
          const frac = v / peso
          return (
            <li key={k} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-ink">{PARCELA_LABEL[k]}</span>
              <span className="text-sm text-ink-soft tabular">
                <span className="font-bold text-ink">{Math.round(v)}</span> de {peso}
              </span>
              <span aria-hidden className="col-span-2 block h-2.5 rounded-full bg-sand-deep" style={{ width: `${(peso / MAX_PESO) * 100}%` }}>
                <span
                  className={cn('block h-full rounded-full', frac >= 0.8 ? 'bg-pine-600' : frac >= 0.45 ? 'bg-sun-400' : 'bg-terra-500')}
                  style={{ width: `${Math.max(frac > 0 ? 4 : 0, frac * 100)}%` }}
                />
              </span>
            </li>
          )
        })}
      </ul>
      <p className="mt-4 flex items-baseline justify-between border-t border-dashed border-line-strong pt-3">
        <span className="text-sm font-bold text-ink">{scoreLabel(m.score)}</span>
        <span className="font-display text-2xl font-semibold text-pine-800 tabular">{m.score}%</span>
      </p>
      {!m.compativel && (
        <p className="mt-2 text-sm text-alert-700">Falha um requisito essencial — por isso a pontuação fica limitada a 35%.</p>
      )}
    </div>
  )
}

/** Gaveta "Porque sugerimos" por baixo do cartão de cada lar. */
export function WhyPanel({ m, nome, defaultOpen = false }: { m: MatchResult; nome: string; defaultOpen?: boolean }) {
  const [aberto, setAberto] = useState(defaultOpen)
  const id = useId()
  const conta = (t: TipoRazao) => m.razoes.filter((r) => r.tipo === t).length
  const nOk = conta('ok')
  const nParcial = conta('parcial')
  const nFalta = conta('falta')

  return (
    <div className="relative z-0 -mt-7 rounded-b-3xl border border-t-0 border-line bg-sand px-4 pt-9 pb-2 sm:px-6">
      <button
        type="button"
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
        className="flex min-h-12 w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl text-left"
      >
        <span className="font-display text-lg font-semibold text-ink">
          Porque sugerimos<span className="sr-only"> {nome}</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-soft">
          <span className="inline-flex items-center gap-1">
            <CircleCheck aria-hidden className="size-4 text-leaf-600" />
            {nOk} a favor
          </span>
          {nParcial > 0 && (
            <span className="inline-flex items-center gap-1">
              <CircleMinus aria-hidden className="size-4 text-sun-700" />
              {nParcial} a ponderar
            </span>
          )}
          {nFalta > 0 && (
            <span className="inline-flex items-center gap-1">
              <CircleX aria-hidden className="size-4 text-alert-600" />
              {nFalta} em falta
            </span>
          )}
        </span>
        <ChevronDown aria-hidden className={cn('ml-auto size-5 text-pine-700 transition-transform', aberto && 'rotate-180')} />
      </button>

      {aberto && (
        <div id={id} className="grid animate-fade-in gap-6 pt-3 pb-4 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8">
          <div className="flex flex-col gap-4">
            {(['ok', 'parcial', 'falta'] as const).map((t) => {
              const lista = m.razoes.filter((r) => r.tipo === t)
              if (!lista.length) return null
              const g = GRUPO[t]
              return (
                <div key={t}>
                  <p className="text-xs font-bold tracking-[0.1em] text-ink-soft uppercase">{g.titulo}</p>
                  <ul className="mt-1.5 flex flex-col gap-1.5">
                    {lista.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-base leading-snug text-ink">
                        <g.Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', g.cor)} />
                        <span>
                          <span className="sr-only">{g.titulo}: </span>
                          {r.texto}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
          <div className="rounded-2xl bg-white/70 p-4">
            <p className="mb-3 text-xs font-bold tracking-[0.1em] text-ink-soft uppercase">Como chegámos aos {m.score}%</p>
            <Parcelas m={m} />
          </div>
        </div>
      )}
    </div>
  )
}
