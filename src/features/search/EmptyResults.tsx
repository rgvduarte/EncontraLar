import { useMemo } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { num } from '@/lib/format'
import { calcularAlivios, noLocal } from './filtering'
import { contarTodosFiltros, FILTROS_VAZIOS } from './searchState'
import type { SearchModel } from './useSearch'

/** Estado vazio com saídas concretas de um clique, calculadas a partir dos dados. */
export function EmptyResults({ model }: { model: SearchModel }) {
  const { state, entradas, update } = model
  const alivios = useMemo(() => calcularAlivios(entradas, state), [entradas, state])
  const temFiltros = contarTodosFiltros(state) > 0 || Boolean(state.q)
  const naZona = useMemo(() => entradas.filter((e) => noLocal(e, state.local, state.raio)).length, [entradas, state.local, state.raio])

  return (
    <section aria-labelledby="vazio-titulo" className="animate-fade-in px-5 pt-10 sm:px-6 xl:px-8">
      <h2 id="vazio-titulo" className="text-2xl font-semibold tracking-tight text-ink">
        {temFiltros ? 'Nenhum resultado com estes filtros' : 'Nenhuma instituição nesta zona'}
      </h2>
      <p className="mt-2 max-w-[32rem] text-ink-mute">
        {naZona > 0
          ? `Há ${num(naZona)} ${naZona === 1 ? 'instituição' : 'instituições'} nesta zona, mas nenhuma cumpre todos os critérios.`
          : 'Ainda não há instituições registadas aqui. Alargar a procura costuma resolver.'}
      </p>

      {alivios.length > 0 && (
        <>
          <p className="mt-8 text-sm text-ink-mute">Experimente</p>
          <ul className="mt-2 flex flex-col gap-2">
            {alivios.map((a, i) => (
              <li key={a.id} className="el-in-up" style={{ ['--d' as string]: `${120 + i * 70}ms` }}>
                <button
                  type="button"
                  onClick={() => update(a.patch)}
                  className="group flex min-h-16 w-full items-center gap-4 rounded-[1.25rem] bg-sand px-5 py-3 text-left transition-[background-color,scale] duration-200 hover:bg-sand-deep active:scale-[0.985]"
                >
                  <span className="flex-1 font-medium text-ink">{a.acao}</span>
                  <span className="shrink-0 text-sm text-ink-mute tabular">
                    {num(a.n)} {a.n === 1 ? 'resultado' : 'resultados'}
                  </span>
                  <ChevronRight aria-hidden className="size-5 shrink-0 text-ink-mute transition-transform duration-200 group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {temFiltros && (
        <button
          type="button"
          onClick={() => update({ ...FILTROS_VAZIOS })}
          className="mt-4 inline-flex min-h-12 items-center text-base font-medium text-terra-600 hover:underline"
        >
          Limpar todos os filtros
        </button>
      )}

      <p className="mt-10 max-w-[32rem] text-sm text-ink-mute">
        Alta hospitalar à porta e sem vaga perto? Peça à assistente social do hospital que avalie a referenciação para a Rede Nacional de
        Cuidados Continuados Integrados.{' '}
        <Link to="/guia#apoios" className="inline-flex items-center font-medium text-terra-600 hover:underline">
          Ver alternativas
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </p>
    </section>
  )
}
