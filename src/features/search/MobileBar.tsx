import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { List, Map as MapIcon, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/cn'
import { subscribeScroll } from '@/lib/motion'
import { Count, pillClasses } from './Chips'
import { VagaPills, type Geo } from './FilterBar'
import { PlaceCombobox } from './PlaceCombobox'
import type { SearchModel } from './useSearch'
import { contarTodosFiltros } from './searchState'

interface Props {
  model: SearchModel
  geo: Geo
  onFiltros: () => void
  /** lista: o campo de pesquisa recolhe ao descer (o mapa não tem scroll) */
  recolhivel?: boolean
}

/** a partir daqui (px de scroll) a descer, o campo recolhe; qualquer subida volta a mostrá-lo */
const RECOLHER_DEPOIS = 150
/** px de movimento contínuo no mesmo sentido antes de mudar (evita tremer com o dedo parado) */
const LIMIAR = 8

/**
 * Barra recolhível (ao estilo do Safari): a descer, o campo de pesquisa sobe para trás do cabeçalho e
 * só a linha de filtros fica presa; a subir, o campo volta. Nunca recolhe com o campo em uso.
 */
function useRecolher(ativo: boolean, barra: RefObject<HTMLDivElement | null>) {
  const [recolhida, setRecolhida] = useState(false)
  const estado = useRef(false)
  const acumulado = useRef(0)
  const definir = useCallback((v: boolean) => {
    if (v === estado.current) return
    estado.current = v
    setRecolhida(v)
  }, [])
  useEffect(() => {
    if (!ativo) {
      definir(false)
      return
    }
    let ultimo = window.scrollY
    return subscribeScroll(() => {
      const y = window.scrollY
      const dy = y - ultimo
      ultimo = y
      const emUso = Boolean(barra.current?.querySelector('[data-el-combo-aberto]')) || Boolean(barra.current?.contains(document.activeElement))
      if (y < RECOLHER_DEPOIS || emUso) {
        acumulado.current = 0
        definir(false)
        return
      }
      // acumula enquanto o sentido se mantém; uma inversão recomeça a contagem
      const a = acumulado.current
      acumulado.current = a === 0 || Math.sign(dy) === Math.sign(a) ? a + dy : dy
      if (acumulado.current > LIMIAR) definir(true)
      else if (acumulado.current < -LIMIAR) definir(false)
    })
  }, [ativo, barra, definir])
  // o campo recebeu o foco (Tab, lupa do cabeçalho): volta a aparecer de imediato
  const mostrar = useCallback(() => {
    acumulado.current = 0
    definir(false)
  }, [definir])
  return { recolhida, mostrar }
}

/** Barra do telemóvel: pílula de pesquisa + linha de pílulas (desliza na horizontal). */
export const MobileBar = forwardRef<HTMLDivElement, Props>(function MobileBar({ model, geo, onFiltros, recolhivel = false }, ref) {
  const { state, entradas, update } = model
  const n = contarTodosFiltros({ ...state, vaga: null })

  // ——— recolher o campo ao descer a lista
  const barra = useRef<HTMLDivElement | null>(null)
  const setRefs = useCallback(
    (el: HTMLDivElement | null) => {
      barra.current = el
      if (typeof ref === 'function') ref(el)
      else if (ref) ref.current = el
    },
    [ref],
  )
  const campoRef = useRef<HTMLDivElement>(null)
  const [campoH, setCampoH] = useState(58)
  useLayoutEffect(() => {
    const el = campoRef.current
    if (!el) return
    // o campo e o espaço acima dele (a barra é o offsetParent: sticky)
    const medir = () => setCampoH(el.offsetTop + el.offsetHeight)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const { recolhida, mostrar } = useRecolher(recolhivel, barra)

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
    <div
      ref={setRefs}
      data-recolhida={recolhida || undefined}
      style={{ '--campo-h': `${campoH}px` } as CSSProperties}
      className={cn(
        'sticky top-16 z-[900] border-b border-black/[0.06] bg-white/95 pt-2.5 backdrop-blur-xl backdrop-saturate-150',
        'transition-[translate] duration-300 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
        recolhida && '-translate-y-(--campo-h)',
      )}
    >
      <div
        ref={campoRef}
        onFocus={mostrar}
        className={cn(
          'px-4 transition-opacity duration-200 motion-reduce:transition-none sm:px-6',
          recolhida && 'pointer-events-none opacity-0',
        )}
      >
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
