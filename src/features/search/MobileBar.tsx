import { forwardRef } from 'react'
import { List, Map as MapIcon, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CountBadge } from './Chips'
import { PlaceCombobox } from './PlaceCombobox'
import type { SearchModel } from './useSearch'
import type { GeoEstado } from './useGeolocation'
import { contarTodosFiltros } from './searchState'

interface Props {
  model: SearchModel
  geo: { estado: GeoEstado; localizar: () => void }
  onFiltros: () => void
}

/** Barra compacta do telemóvel: campo "Onde" + botão "Filtros (n)". */
export const MobileBar = forwardRef<HTMLDivElement, Props>(function MobileBar({ model, geo, onFiltros }, ref) {
  const { state, entradas, update } = model
  const n = contarTodosFiltros(state)
  return (
    <div ref={ref} className="sticky top-18 z-[900] border-b border-line bg-cream/96 px-3 py-2.5 backdrop-blur-md sm:px-4">
      <div className="flex items-center gap-2">
        <PlaceCombobox
          compact
          className="min-w-0 flex-1"
          local={state.local}
          entradas={entradas}
          geoEstado={geo.estado}
          onLocal={(local) => update({ local })}
          onGeo={geo.localizar}
          onTexto={(q) => update({ q })}
        />
        <button
          type="button"
          onClick={onFiltros}
          aria-haspopup="dialog"
          className={cn(
            'inline-flex min-h-13 shrink-0 items-center gap-2 rounded-2xl border-2 px-3.5 font-bold transition-colors',
            n > 0 ? 'border-pine-800 bg-pine-800 text-white' : 'border-line-strong bg-white text-ink hover:border-pine-500',
          )}
        >
          <SlidersHorizontal aria-hidden className="size-5" />
          Filtros
          {n > 0 && <CountBadge n={n} className="bg-terra-500" />}
          {n > 0 && <span className="sr-only">ativos</span>}
        </button>
      </div>
    </div>
  )
})

/** Pílula flutuante para alternar entre lista e mapa (telemóvel). */
export function ViewToggle({ vista, onChange, total }: { vista: 'lista' | 'mapa'; onChange: (v: 'lista' | 'mapa') => void; total: number }) {
  const paraMapa = vista === 'lista'
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-[1050] flex justify-center px-4 pb-[env(safe-area-inset-bottom)]">
      <button
        type="button"
        onClick={() => onChange(paraMapa ? 'mapa' : 'lista')}
        className="pointer-events-auto inline-flex min-h-14 items-center gap-2.5 rounded-full bg-ink px-6 text-base font-bold text-white shadow-lift ring-4 ring-cream/80 transition-transform active:scale-[0.97]"
      >
        {paraMapa ? <MapIcon aria-hidden className="size-5" /> : <List aria-hidden className="size-5" />}
        {paraMapa ? 'Ver no mapa' : `Ver lista (${total})`}
      </button>
    </div>
  )
}
