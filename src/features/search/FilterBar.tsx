import { forwardRef, useMemo } from 'react'
import { Crosshair, LoaderCircle, Ruler, SlidersHorizontal, X } from 'lucide-react'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { BudgetChip } from './BudgetControl'
import { chipClasses, CountBadge, DispGlyph, PillSelect, ToggleChip } from './Chips'
import { PlaceCombobox } from './PlaceCombobox'
import type { SearchModel } from './useSearch'
import type { GeoEstado } from './useGeolocation'
import { centroDe, contarTodosFiltros, contarMaisFiltros, FILTROS_VAZIOS, opcoesRaio, TIPO_CURTO, TIPOS, type VagaFiltro } from './searchState'

interface Props {
  model: SearchModel
  geo: { estado: GeoEstado; localizar: () => void }
  precos: number[]
  onMaisFiltros: () => void
}

/** Barra de filtros fixa sob o cabeçalho (desktop ≥ 1024px). */
export const FilterBar = forwardRef<HTMLDivElement, Props>(function FilterBar({ model, geo, precos, onMaisFiltros }, ref) {
  const { state, entradas, update } = model
  const centro = centroDe(state.local)
  const nMais = contarMaisFiltros(state)
  const nTodos = contarTodosFiltros(state)
  const ultima = useMemo(() => entradas.reduce((m, e) => (e.lar.atualizadoEm > m ? e.lar.atualizadoEm : m), ''), [entradas])

  const setVaga = (v: VagaFiltro) => update({ vaga: state.vaga === v ? null : v })

  return (
    <div ref={ref} className="sticky top-18 z-[900] border-b border-line bg-cream/96 backdrop-blur-md">
      <div className="flex flex-col gap-2.5 px-6 py-3 xl:px-8">
        <div className="flex items-center gap-3">
          <div className="flex items-stretch gap-2 rounded-[1.25rem]">
            <PlaceCombobox
              className="w-[26rem] xl:w-[30rem]"
              local={state.local}
              entradas={entradas}
              geoEstado={geo.estado}
              onLocal={(local) => update({ local })}
              onGeo={geo.localizar}
              onTexto={(q) => update({ q })}
            />
            {centro && (
              <PillSelect
                label="Raio"
                icon={<Ruler aria-hidden />}
                value={state.raio}
                onChange={(e) => update({ raio: Number(e.target.value) })}
                wrapperClassName="self-center"
              >
                {opcoesRaio(state.local).map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </PillSelect>
            )}
            <button
              type="button"
              onClick={geo.localizar}
              disabled={geo.estado === 'a-localizar'}
              aria-pressed={state.local.tipo === 'coords'}
              className={chipClasses(state.local.tipo === 'coords', 'self-center disabled:opacity-70')}
            >
              {geo.estado === 'a-localizar' ? <LoaderCircle aria-hidden className="animate-spin" /> : <Crosshair aria-hidden />}
              {geo.estado === 'a-localizar' ? 'A localizar…' : 'Perto de mim'}
            </button>
          </div>

          {ultima && (
            <p className="ml-auto hidden items-center gap-2.5 text-sm text-ink-soft xl:flex">
              <DispGlyph disp="disponivel" />
              <span>
                <strong className="text-ink">Vagas em direto</strong> · última atualização {tempoRelativo(ultima)}
              </span>
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Disponibilidade" className="flex gap-2">
            <ToggleChip pressed={state.vaga === 'agora'} onClick={() => setVaga('agora')} icon={<DispGlyph disp="disponivel" onDark={state.vaga === 'agora'} />}>
              Com vaga agora
            </ToggleChip>
            <ToggleChip
              pressed={state.vaga === 'breve'}
              onClick={() => setVaga('breve')}
              icon={<DispGlyph disp="breve" onDark={state.vaga === 'breve'} />}
              title="Com vaga agora ou com vaga provável nos próximos 3 meses"
            >
              Vaga em breve
            </ToggleChip>
          </div>
          <span aria-hidden className="mx-1 h-7 w-px bg-line-strong" />
          <div role="group" aria-label="Tipo de resposta" className="flex gap-2">
            {TIPOS.map((t) => (
              <ToggleChip
                key={t}
                pressed={state.tipos.includes(t)}
                onClick={() => update({ tipos: state.tipos.includes(t) ? state.tipos.filter((x) => x !== t) : [...state.tipos, t] })}
              >
                {TIPO_CURTO[t]}
              </ToggleChip>
            ))}
          </div>
          <span aria-hidden className="mx-1 h-7 w-px bg-line-strong" />
          <BudgetChip value={state.max} onChange={(max) => update({ max })} precos={precos} />
          <button type="button" onClick={onMaisFiltros} className={chipClasses(nMais > 0)} aria-haspopup="dialog">
            <SlidersHorizontal aria-hidden />
            Mais filtros
            {nMais > 0 && <CountBadge n={nMais} className={cn(nMais > 0 && 'bg-terra-500')} />}
            {nMais > 0 && <span className="sr-only">ativos</span>}
          </button>

          {nTodos > 0 && (
            <button
              type="button"
              onClick={() => update({ ...FILTROS_VAZIOS, q: state.q })}
              className="ml-auto inline-flex min-h-12 items-center gap-1.5 rounded-full px-3 text-sm font-bold text-terra-700 hover:bg-terra-50"
            >
              <X aria-hidden className="size-4.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  )
})
