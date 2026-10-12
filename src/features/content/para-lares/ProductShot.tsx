/**
 * "Fotografia de produto" da página /para-lares: o painel verdadeiro, composto com componentes reais
 * e dados do store, em modo de ensaio (os botões funcionam, nada é gravado).
 */
import { useMemo } from 'react'
import { CircleCheck, Minus, Plus } from 'lucide-react'
import type { Lar, TipoQuarto } from '@/types'
import { useDB } from '@/lib/store'
import { previsaoMensal } from '@/lib/forecast'
import { euro, plural, tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { LogoMark } from '@/components/layout/Logo'
import { ForecastChart } from '@/components/lar/ForecastChart'
import { cn } from '@/lib/cn'
import { familiasAAvisar, type Ensaio } from './ensaio'

const quartoMin = (t: TipoQuarto) => QUARTO_LABEL[t].replace(' (partilhado)', '').toLowerCase()

export function Stepper({ tipo, n, max, onChange }: { tipo: TipoQuarto; n: number; max: number; onChange: (delta: number) => void }) {
  const nome = quartoMin(tipo)
  const btn =
    'flex size-12 items-center justify-center rounded-full bg-sand text-ink transition-colors duration-200 hover:bg-sand-deep active:bg-line-strong disabled:cursor-not-allowed disabled:text-pine-300 disabled:hover:bg-sand'
  return (
    <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Vagas em ${nome}`}>
      <button type="button" className={btn} onClick={() => onChange(-1)} disabled={n <= 0} aria-label={`Menos uma vaga em ${nome}`}>
        <Minus aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
      <output aria-live="polite" className={cn('w-11 text-center text-3xl font-semibold tabular transition-colors', n > 0 ? 'text-leaf-600' : 'text-ink-mute')}>
        {n}
      </output>
      <button type="button" className={btn} onClick={() => onChange(1)} disabled={n >= max} aria-label={`Mais uma vaga em ${nome}`}>
        <Plus aria-hidden className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  )
}

function Nota({ base, ensaio }: { base: Lar; ensaio: Ensaio }) {
  const db = useDB()
  const avisadas = useMemo(() => familiasAAvisar(db, base), [db, base])
  const e = ensaio.evento
  return (
    <div role="status" aria-live="polite" className="pointer-events-none">
      {e && (
        <div key={e.key} className="flex animate-fade-up items-start gap-3 rounded-2xl bg-ink/95 px-5 py-4 text-white shadow-lift backdrop-blur-md">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-leaf-500" />
          <p className="flex min-w-0 flex-col">
            {e.acao === 'abriu' ? (
              <>
                <span className="font-semibold">{avisadas > 0 ? plural(avisadas, 'família avisada', 'famílias avisadas') : 'Vaga publicada no mapa'}</span>
                <span className="text-sm text-white/70">
                  Vaga em {quartoMin(e.tipo)} · {tempoRelativo(e.quando)}
                </span>
              </>
            ) : (
              <>
                <span className="font-semibold">Mapa atualizado</span>
                <span className="text-sm text-white/70">
                  {QUARTO_CURTO[e.tipo]}: {plural(ensaio.livres[e.tipo] ?? 0, 'vaga', 'vagas')} · ninguém liga por engano
                </span>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  )
}

export function ProductShot({ base, ensaio }: { base: Lar; ensaio: Ensaio }) {
  const previsao = useMemo(() => previsaoMensal(base, 6), [base])

  return (
    <figure className="relative">
      <figcaption className="mb-4 text-center text-sm text-ink-mute">Experimente: é o painel verdadeiro, em modo de ensaio. Nada é gravado.</figcaption>
      <div className="rounded-[2rem] bg-sand p-2 sm:p-5 lg:p-8 lg:pb-28">
        <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-card">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <LogoMark className="size-8 shrink-0" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{base.nome}</p>
                <p className="text-sm text-ink-mute">Painel da instituição</p>
              </div>
            </div>
            <p className="hidden shrink-0 items-center gap-2 text-sm text-ink-mute sm:flex">
              <span aria-hidden className="size-2 rounded-full bg-leaf-500" />
              {ensaio.tocou ? 'Atualizado agora mesmo' : `Atualizado ${tempoRelativo(base.atualizadoEm)}`}
            </p>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div className="px-5 py-5 sm:px-7 sm:py-6 lg:border-r lg:border-line">
              <p className="text-sm font-semibold text-ink">Vagas agora</p>
              <ul className="mt-2 divide-y divide-line">
                {base.quartos.map((q) => (
                  <li key={q.tipo} className="flex items-center justify-between gap-3 py-3.5">
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{QUARTO_CURTO[q.tipo]}</p>
                      <p className="text-sm text-ink-mute tabular">
                        {plural(q.total, 'lugar', 'lugares')}
                        <span className="hidden sm:inline"> · {euro(q.precoMin)}</span>
                      </p>
                    </div>
                    <Stepper tipo={q.tipo} n={ensaio.livres[q.tipo] ?? 0} max={q.total} onChange={(d) => ensaio.mudar(q.tipo, d)} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-line px-5 py-5 sm:px-7 sm:py-6 lg:border-t-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <p className="text-sm font-semibold text-ink">Saídas previstas</p>
                <p className="text-sm text-ink-mute">próximos 6 meses</p>
              </div>
              <ForecastChart data={previsao} height={190} className="mt-3" caption={`Lugares que deverão libertar-se por mês em ${base.nome}`} />
            </div>
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto -mt-5 w-[min(24rem,calc(100%-1.5rem))] lg:absolute lg:bottom-7 lg:left-1/2 lg:mt-0 lg:-translate-x-1/2">
        <Nota base={base} ensaio={ensaio} />
      </div>
    </figure>
  )
}
