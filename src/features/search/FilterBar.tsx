import { forwardRef } from 'react'
import { LoaderCircle, Navigation, SlidersHorizontal } from 'lucide-react'
import { Checkbox } from '@/components/ui/Field'
import { TIPO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { BudgetPill } from './BudgetControl'
import { Count, DispDot, pillClasses, QuietSelect, TogglePill } from './Chips'
import { PillPopover } from './PillPopover'
import { PlaceCombobox } from './PlaceCombobox'
import type { SearchModel } from './useSearch'
import type { GeoEstado } from './useGeolocation'
import { centroDe, contarMaisFiltros, opcoesRaio, TIPO_CURTO, TIPOS, type VagaFiltro } from './searchState'

export interface Geo {
  estado: GeoEstado
  localizar: () => void
}

const TIPO_RESUMO = {
  erpi: 'Alojamento permanente, com cuidados diários.',
  residencia: 'Para quem ainda é autónomo.',
  centro_dia: 'Passa o dia e regressa a casa.',
} as const

/** "Com vaga agora" e "Vaga em breve" — usados na barra do desktop e do telemóvel. */
export function VagaPills({ model }: { model: SearchModel }) {
  const { state, update } = model
  const setVaga = (v: VagaFiltro) => update({ vaga: state.vaga === v ? null : v })
  return (
    <>
      <TogglePill pressed={state.vaga === 'agora'} onClick={() => setVaga('agora')}>
        <DispDot disp="disponivel" />
        Com vaga agora
      </TogglePill>
      <TogglePill pressed={state.vaga === 'breve'} onClick={() => setVaga('breve')} title="Com vaga agora ou vaga provável nos próximos 3 meses">
        <DispDot disp="breve" />
        Vaga em breve
      </TogglePill>
    </>
  )
}

function TipoPill({ model }: { model: SearchModel }) {
  const { state, update } = model
  const n = state.tipos.length
  const label = n === 0 ? 'Tipo' : n === 1 ? TIPO_CURTO[state.tipos[0]!] : `${n} tipos`
  return (
    <PillPopover active={n > 0} label={label} panelLabel="Tipo de resposta">
      <fieldset>
        <legend className="mb-2 text-sm text-ink-mute">Tipo de resposta</legend>
        {TIPOS.map((t) => (
          <Checkbox
            key={t}
            checked={state.tipos.includes(t)}
            onChange={() => update({ tipos: state.tipos.includes(t) ? state.tipos.filter((x) => x !== t) : [...state.tipos, t] })}
            label={TIPO_LABEL[t]}
            description={TIPO_RESUMO[t]}
          />
        ))}
      </fieldset>
    </PillPopover>
  )
}

/** Raio + "Perto de mim", dentro da pílula de pesquisa. */
function PesquisaExtras({ model, geo }: { model: SearchModel; geo: Geo }) {
  const { state, update } = model
  const centro = centroDe(state.local)
  const perto = state.local.tipo === 'coords'
  const aLocalizar = geo.estado === 'a-localizar'
  return (
    <>
      {centro && (
        <>
          <span aria-hidden className="mx-1 h-6 w-px shrink-0 bg-line-strong" />
          <QuietSelect label="Raio" onSand value={state.raio} onChange={(e) => update({ raio: Number(e.target.value) })} className="tabular">
            {opcoesRaio(state.local).map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
          </QuietSelect>
        </>
      )}
      <button
        type="button"
        onClick={geo.localizar}
        disabled={aLocalizar}
        aria-pressed={perto}
        className={cn(
          'ml-1 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors duration-200 disabled:opacity-70',
          perto ? 'bg-ink text-white' : 'text-ink hover:bg-white',
        )}
      >
        {aLocalizar ? (
          <LoaderCircle aria-hidden className="size-4 animate-spin" />
        ) : (
          <Navigation aria-hidden className={cn('size-4', !perto && 'text-terra-600')} strokeWidth={2} />
        )}
        {aLocalizar ? 'A localizar…' : 'Perto de mim'}
      </button>
    </>
  )
}

interface Props {
  model: SearchModel
  geo: Geo
  precos: number[]
  onMaisFiltros: () => void
}

/** Barra fixa do desktop: uma pílula de pesquisa e uma linha discreta de filtros. */
export const FilterBar = forwardRef<HTMLDivElement, Props>(function FilterBar({ model, geo, precos, onMaisFiltros }, ref) {
  const { state, entradas, update } = model
  const nMais = contarMaisFiltros(state)
  return (
    <div ref={ref} className="sticky top-16 z-[900] border-b border-black/[0.06] bg-white/95 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3 xl:px-8">
        <PlaceCombobox
          className="min-w-[26rem] max-w-[38rem] flex-1"
          local={state.local}
          entradas={entradas}
          geoEstado={geo.estado}
          onLocal={(local) => update({ local })}
          onGeo={geo.localizar}
          onTexto={(q) => update({ q })}
          trailing={<PesquisaExtras model={model} geo={geo} />}
        />
        <div role="group" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
          <VagaPills model={model} />
          <TipoPill model={model} />
          <BudgetPill value={state.max} onChange={(max) => update({ max })} precos={precos} />
          <button type="button" onClick={onMaisFiltros} aria-haspopup="dialog" className={pillClasses(nMais > 0)}>
            <SlidersHorizontal aria-hidden className="size-4" />
            Mais filtros
            <Count n={nMais} onDark={nMais > 0} />
            {nMais > 0 && <span className="sr-only">ativos</span>}
          </button>
        </div>
      </div>
    </div>
  )
})
