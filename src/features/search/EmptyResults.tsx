import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Hospital, RotateCcw } from 'lucide-react'
import { AzulejoBand } from '@/components/brand/patterns'
import { Button } from '@/components/ui/Button'
import { num } from '@/lib/format'
import { calcularAlivios, noLocal, type Entrada } from './filtering'
import { pilulasAtivas } from './ResultsToolbar'
import { FILTROS_VAZIOS, type SearchState } from './searchState'
import type { SearchModel } from './useSearch'

/** Estado vazio com saídas concretas, calculadas a partir dos dados (nunca só "Sem resultados"). */
export function EmptyResults({ model }: { model: SearchModel }) {
  const { state, entradas, update } = model
  const alivios = useMemo(() => calcularAlivios(entradas, state), [entradas, state])
  const naZona = useMemo(() => entradas.filter((e: Entrada) => noLocal(e, state.local, state.raio)).length, [entradas, state.local, state.raio])
  const criterios = pilulasAtivas(state).filter((p) => p.id !== 'local')

  return (
    <section aria-labelledby="vazio-titulo" className="px-4 py-8 sm:px-6">
      <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
        <AzulejoBand className="h-10 opacity-25" size={40} />
        <div className="flex flex-col gap-5 p-6 sm:p-7">
          <div>
            <h2 id="vazio-titulo" className="text-2xl font-semibold text-ink sm:text-3xl">
              Nenhuma instituição cumpre <em>tudo</em> ao mesmo tempo
            </h2>
            <p className="mt-2 text-ink-soft">
              {naZona > 0 ? (
                <>
                  Há <strong className="text-ink">{num(naZona)}</strong> {naZona === 1 ? 'instituição' : 'instituições'} nesta zona
                  {criterios.length > 0 && <>, mas nenhuma reúne {criterios.length === 1 ? 'o critério' : 'os critérios'}: {criterios.map((c) => c.texto).join(' · ')}</>}.
                </>
              ) : (
                <>Ainda não temos instituições registadas nesta zona. Alargar a procura costuma resolver.</>
              )}
            </p>
          </div>

          {alivios.length > 0 && (
            <div>
              <p className="eyebrow">Experimente</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {alivios.map((a) => (
                  <li key={a.id}>
                    <button
                      type="button"
                      onClick={() => update(a.patch)}
                      className="group flex min-h-14 w-full items-center gap-4 rounded-2xl border-2 border-line bg-cream px-4 py-3 text-left transition-colors hover:border-pine-500 hover:bg-pine-50"
                    >
                      <span className="flex-1 font-bold text-ink">{a.acao}</span>
                      <span className="shrink-0 text-sm text-ink-soft">
                        mostra <strong className="font-display text-xl text-pine-800 tabular">{num(a.n)}</strong>
                        <span className="sr-only"> {a.n === 1 ? 'instituição' : 'instituições'}</span>
                      </span>
                      <ArrowRight aria-hidden className="size-5 shrink-0 text-pine-700 transition-transform group-hover:translate-x-0.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" icon={<RotateCcw aria-hidden className="size-5" />} onClick={() => update(limparTudo(state))}>
              Limpar todos os filtros
            </Button>
          </div>
        </div>

        <aside className="flex gap-4 border-t border-line bg-sand/60 p-6 sm:p-7">
          <Hospital aria-hidden className="mt-0.5 size-7 shrink-0 text-terra-600" />
          <div>
            <p className="font-bold text-ink">Alta hospitalar à porta e sem vaga perto?</p>
            <p className="mt-1 text-sm text-ink-soft">
              Peça à assistente social do hospital a referenciação para a Rede Nacional de Cuidados Continuados Integrados (RNCCI). Enquanto espera por vaga, um
              centro de dia ou o serviço de apoio domiciliário de uma IPSS ou Misericórdia podem ajudar.
            </p>
            <Link to="/guia#apoios" className="link mt-2 inline-flex min-h-11 items-center text-sm">
              Ver apoios e alternativas
            </Link>
          </div>
        </aside>
      </div>
    </section>
  )
}

function limparTudo(s: SearchState): Partial<SearchState> {
  return { ...FILTROS_VAZIOS, raio: s.raio }
}
