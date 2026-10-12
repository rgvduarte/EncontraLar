import { forwardRef, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { List, Map as MapIcon, SlidersHorizontal } from 'lucide-react'
import { Count, pillClasses } from './Chips'
import { VagaPills, type Geo } from './FilterBar'
import { PlaceCombobox } from './PlaceCombobox'
import type { SearchModel } from './useSearch'
import { contarTodosFiltros } from './searchState'

interface Props {
  model: SearchModel
  geo: Geo
  onFiltros: () => void
}

/** Barra do telemóvel: pílula de pesquisa + linha de pílulas (desliza na horizontal). */
export const MobileBar = forwardRef<HTMLDivElement, Props>(function MobileBar({ model, geo, onFiltros }, ref) {
  const { state, entradas, update } = model
  const n = contarTodosFiltros({ ...state, vaga: null })

  // a pílula ativa nunca fica escondida fora da linha deslizante
  const rowRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const row = rowRef.current
    const el = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!row || !el) return
    if (el.offsetLeft + el.offsetWidth > row.scrollLeft + row.clientWidth || el.offsetLeft < row.scrollLeft) {
      row.scrollTo({ left: el.offsetLeft - 16, behavior: 'smooth' })
    }
  }, [state.vaga])

  return (
    <div ref={ref} className="sticky top-16 z-[900] border-b border-black/[0.06] bg-white/95 pt-2.5 backdrop-blur-xl backdrop-saturate-150">
      <div className="px-4 sm:px-6">
        <PlaceCombobox
          compact
          local={state.local}
          entradas={entradas}
          geoEstado={geo.estado}
          onLocal={(local) => update({ local })}
          onGeo={geo.localizar}
          onTexto={(q) => update({ q })}
        />
      </div>
      <div ref={rowRef} role="group" aria-label="Filtros" className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={onFiltros} aria-haspopup="dialog" className={pillClasses(n > 0)}>
          <SlidersHorizontal aria-hidden className="size-4" />
          Filtros
          <Count n={n} onDark={n > 0} />
          {n > 0 && <span className="sr-only">ativos</span>}
        </button>
        <VagaPills model={model} />
      </div>
    </div>
  )
})

/**
 * Pílula preta flutuante: "Mapa" / "Lista".
 * Num portal para o <body>: um antepassado animado (transição de página) não pode servir de referência ao position: fixed.
 */
export function ViewToggle({ vista, onChange }: { vista: 'lista' | 'mapa'; onChange: (v: 'lista' | 'mapa') => void }) {
  const paraMapa = vista === 'lista'
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h,0px)+1rem)] z-[1050] flex justify-center px-4">
      <button
        type="button"
        onClick={() => onChange(paraMapa ? 'mapa' : 'lista')}
        className="pointer-events-auto inline-flex min-h-13 items-center gap-2 rounded-full bg-ink px-6 text-base font-medium text-white shadow-lift transition-transform duration-200 active:scale-[0.97]"
      >
        {paraMapa ? <MapIcon aria-hidden className="size-5" strokeWidth={1.75} /> : <List aria-hidden className="size-5" strokeWidth={1.75} />}
        {paraMapa ? 'Mapa' : 'Lista'}
      </button>
    </div>,
    document.body,
  )
}
