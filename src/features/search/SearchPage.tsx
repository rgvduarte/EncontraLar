import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useDocumentTitle, useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { EmptyResults } from './EmptyResults'
import { FilterBar } from './FilterBar'
import { FiltersModal, type ModoFiltros, type Rascunho } from './FiltersModal'
import { filtrar, noLocal, passaFiltros } from './filtering'
import { MobileBar, ViewToggle } from './MobileBar'
import { cardDomId, NotaFinal, PAGINA, ResultsList } from './ResultsList'
import { ResultsSummary, tituloPesquisa } from './ResultsSummary'
import { SearchMap } from './SearchMap'
import { centroDe, toSearchParams, type Bounds } from './searchState'
import { useGeolocation } from './useGeolocation'
import { useSearch } from './useSearch'
import './search.css'

/**
 * /pesquisa — mapa de vagas.
 * Desktop: barra fixa (pesquisa + filtros) · lista à esquerda · mapa fixo à direita, sincronizados.
 * Telemóvel: lista por defeito; mapa em ecrã inteiro com a pílula "Mapa" (?vista=mapa); filtros em ecrã inteiro.
 */
export default function SearchPage() {
  const model = useSearch()
  const { state, entradas, resultados, comVaga, update } = model
  const desktop = useMediaQuery('(min-width: 1024px)')
  const titulo = tituloPesquisa(state)
  useDocumentTitle(titulo)

  // ——— realces lista ↔ mapa
  const [listHoverId, setListHoverId] = useState<string | null>(null)
  const [mapHoverId, setMapHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [visiveis, setVisiveis] = useState(PAGINA)
  const scrollPendente = useRef<string | null>(null)

  // chave dos filtros (sem ordenação nem vista): reenquadra o mapa e repõe a paginação
  const fitKey = useMemo(() => toSearchParams({ ...state, ordem: 'relevancia', vista: 'lista' }).toString(), [state])
  useEffect(() => {
    setVisiveis(PAGINA)
    setSelectedId(null)
  }, [fitKey])

  const resultadosRef = useRef(resultados)
  resultadosRef.current = resultados

  // escolher um marcador no desktop leva o cartão correspondente para o centro da lista
  const onSelect = useCallback(
    (id: string | null) => {
      setSelectedId(id)
      if (!id || !desktop) return
      const idx = resultadosRef.current.findIndex((e) => e.lar.id === id)
      if (idx >= 0) {
        setVisiveis((v) => (idx >= v ? Math.ceil((idx + 1) / PAGINA) * PAGINA : v))
        scrollPendente.current = id
      }
    },
    [desktop],
  )

  useEffect(() => {
    const id = scrollPendente.current
    if (!id || id !== selectedId) return
    const el = document.getElementById(cardDomId(id))
    if (!el) return
    scrollPendente.current = null
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollIntoView({ behavior: reduzir ? 'auto' : 'smooth', block: 'center' })
  }, [selectedId, visiveis])

  // ——— geolocalização
  const onGeo = useCallback((lat: number, lng: number) => update({ local: { tipo: 'coords', lat, lng } }), [update])
  const geo = useGeolocation(onGeo)

  // ——— modal de filtros (contagem ao vivo com o rascunho)
  const [modal, setModal] = useState<ModoFiltros | null>(null)
  const contarRascunho = useCallback((r: Rascunho) => filtrar(entradas, { ...state, ...r }).length, [entradas, state])
  const precos = useMemo(
    () => entradas.filter((e) => noLocal(e, state.local, state.raio) && passaFiltros(e, { ...state, max: null })).map((e) => e.lar.mensalidadeMin),
    [entradas, state],
  )

  // ——— altura da barra fixa (para o mapa fixo e o scroll-margin dos cartões)
  const barRef = useRef<HTMLDivElement>(null)
  const [barH, setBarH] = useState(0)
  useLayoutEffect(() => {
    const el = barRef.current
    if (!el) return
    const medir = () => setBarH(el.offsetHeight)
    medir()
    const ro = new ResizeObserver(medir)
    ro.observe(el)
    return () => ro.disconnect()
  }, [desktop])

  const onZona = useCallback((b: Bounds) => update({ local: { tipo: 'zona', bounds: b } }), [update])
  const vistaMapa = !desktop && state.vista === 'mapa'
  const destaqueLista = selectedId ?? mapHoverId
  const destaqueMapa = listHoverId ?? mapHoverId

  const lista = (
    <>
      {state.lugarDesconhecido && (
        <p role="status" className="mx-5 mt-6 rounded-[1.25rem] bg-sand px-5 py-4 text-sm text-ink-soft sm:mx-6 lg:mx-8">
          Não encontrámos «{state.lugarDesconhecido}». A mostrar todo o país — escreva o concelho ou o código postal na pesquisa.
        </p>
      )}
      <ResultsSummary model={model} desktop={desktop} />
      {resultados.length > 0 ? (
        <ResultsList
          resultados={resultados}
          ordem={state.ordem}
          visiveis={visiveis}
          onMais={() => setVisiveis((v) => v + PAGINA)}
          destaqueId={destaqueLista}
          onHover={setListHoverId}
          mostrarDistancia={Boolean(centroDe(state.local))}
        />
      ) : (
        <EmptyResults model={model} />
      )}
      <NotaFinal />
    </>
  )

  const mapa = (className: string) => (
    <SearchMap
      className={className}
      resultados={resultados}
      local={state.local}
      raio={state.raio}
      fitKey={fitKey}
      hoverId={destaqueMapa}
      selectedId={selectedId}
      onHover={setMapHoverId}
      onSelect={onSelect}
      onZona={onZona}
      mobile={!desktop}
    />
  )

  const modalAberto = modal != null
  const estilo = { '--barra': `${barH}px` } as CSSProperties

  if (desktop) {
    return (
      <div className="flex flex-1 flex-col" style={estilo}>
        <FilterBar ref={barRef} model={model} geo={geo} precos={precos} onMaisFiltros={() => setModal('mais')} />
        <div className="flex flex-1 items-stretch">
          <div className="w-[46%] max-w-[46rem] shrink-0 xl:w-[44rem]">{lista}</div>
          <div className="relative min-w-0 flex-1">
            <div className="sticky top-[calc(4rem+var(--barra))] h-[calc(100dvh-4rem-var(--barra))] py-4 pr-4">
              {mapa('relative h-full w-full rounded-[1.75rem]')}
            </div>
          </div>
        </div>
        <FiltersModal
          open={modalAberto}
          onClose={() => setModal(null)}
          modo="mais"
          state={state}
          contar={contarRascunho}
          precos={precos}
          onApply={(r) => update(r)}
        />
      </div>
    )
  }

  return (
    <div className={cn('flex flex-1 flex-col', !vistaMapa && 'pb-24')} style={estilo}>
      <MobileBar ref={barRef} model={model} geo={geo} onFiltros={() => setModal('todos')} />
      {vistaMapa ? (
        <>
          <h1 className="sr-only">{titulo}</h1>
          <p className="sr-only" aria-live="polite">
            {resultados.length} instituições, {comVaga} com vaga agora
          </p>
          <div className="relative min-h-[22rem] flex-1">{mapa('absolute inset-0')}</div>
        </>
      ) : (
        lista
      )}
      {!modalAberto && (
        <ViewToggle
          vista={vistaMapa ? 'mapa' : 'lista'}
          onChange={(vista) => {
            update({ vista })
            window.scrollTo({ top: 0 })
          }}
        />
      )}
      <FiltersModal
        open={modalAberto}
        onClose={() => setModal(null)}
        modo="todos"
        state={state}
        contar={contarRascunho}
        precos={precos}
        onApply={(r) => update(r)}
      />
    </div>
  )
}
