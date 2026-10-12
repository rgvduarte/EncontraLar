import { forwardRef, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { List, Map as MapIcon, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
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
      {/* linha deslizante com encaixe (snap) e esbatimento nas pontas: percebe-se que há mais à direita */}
      <div
        ref={rowRef}
        role="group"
        aria-label="Filtros"
        data-lenis-prevent
        className="flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto overscroll-x-contain px-4 py-2.5 [mask-image:linear-gradient(to_right,transparent,#000_1rem,#000_calc(100%-2rem),transparent)] [scrollbar-width:none] sm:scroll-px-6 sm:px-6 [&::-webkit-scrollbar]:hidden [&>*]:snap-start"
      >
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
 * Pílula preta flutuante: "Mapa" / "Lista", acima da barra de abas (--tabbar-h), ao alcance do polegar.
 * Num portal para o <body>: um antepassado animado (transição de página) não pode servir de referência ao position: fixed.
 * Sobe do fundo ao abrir a página; na troca de vista a pílula "transforma-se" (view-transition-name próprio).
 */
export function ViewToggle({ vista, onChange }: { vista: 'lista' | 'mapa'; onChange: (v: 'lista' | 'mapa') => void }) {
  const paraMapa = vista === 'lista'
  return createPortal(
    // z-[999]: acima da página, abaixo do cabeçalho/menu móvel (z-1001) e da barra de abas (z-1000).
    // Sai do caminho (desce e desvanece) enquanto as sugestões da pesquisa estão abertas.
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-h,0px)+1rem)] z-[999] flex justify-center px-4',
        'transition-[opacity,translate] duration-300 ease-[cubic-bezier(.16,1,.3,1)]',
        '[body:has([data-el-combo-aberto])_&]:translate-y-6 [body:has([data-el-combo-aberto])_&]:opacity-0 [body:has([data-el-combo-aberto])_&_button]:pointer-events-none',
      )}
    >
      <button
        type="button"
        onClick={() => onChange(paraMapa ? 'mapa' : 'lista')}
        style={{ viewTransitionName: 'el-vista-toggle', ['--d' as string]: '350ms' }}
        className="el-rise pointer-events-auto inline-flex min-h-13 items-center gap-2 rounded-full bg-ink px-6 text-base font-medium text-white shadow-lift transition-[scale,background-color] duration-200 hover:bg-pine-600 active:scale-[0.96]"
      >
        {paraMapa ? <MapIcon aria-hidden className="size-5" strokeWidth={1.75} /> : <List aria-hidden className="size-5" strokeWidth={1.75} />}
        {paraMapa ? 'Mapa' : 'Lista'}
      </button>
    </div>,
    document.body,
  )
}
