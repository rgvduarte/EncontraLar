import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link } from 'react-router'
import { CircleAlert } from 'lucide-react'
import { useDocumentTitle, useMediaQuery } from '@/lib/hooks'
import { EmptyResults } from './EmptyResults'
import { FilterBar } from './FilterBar'
import { FiltersModal, type ModoFiltros, type Rascunho } from './FiltersModal'
import { filtrar, noLocal, passaFiltros } from './filtering'
import { MobileBar, ViewToggle } from './MobileBar'
import { ResultsHeader, tituloPesquisa } from './ResultsHeader'
import { cardDomId, PAGINA, ResultsList } from './ResultsList'
import { ActivePills, QuickVaga, SortSelect } from './ResultsToolbar'
import { SearchMap } from './SearchMap'
import { centroDe, toSearchParams, type Bounds } from './searchState'
import { useGeolocation } from './useGeolocation'
import { useSearch } from './useSearch'

/**
 * /pesquisa — mapa de vagas.
 * Desktop: barra de filtros fixa + lista (fluxo normal da página) + mapa fixo à direita.
 * Telemóvel: lista por defeito, mapa em ecrã inteiro com a pílula "Ver no mapa" (?vista=mapa).
 */
export default function SearchPage() {
  const model = useSearch()
  const { state, entradas, resultados, comVaga, update } = model
  const desktop = useMediaQuery('(min-width: 1024px)')
  const titulo = tituloPesquisa(state)
  useDocumentTitle(titulo.texto)

  // ——— realces lista ↔ mapa
  const [listHoverId, setListHoverId] = useState<string | null>(null)
  const [mapHoverId, setMapHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [visiveis, setVisiveis] = useState(PAGINA)
  const scrollPendente = useRef<string | null>(null)

  // chave dos filtros (sem ordenação nem vista): muda o enquadramento do mapa e repõe a paginação
  const fitKey = useMemo(() => toSearchParams({ ...state, ordem: 'relevancia', vista: 'lista' }).toString(), [state])
  useEffect(() => {
    setVisiveis(PAGINA)
    setSelectedId(null)
  }, [fitKey])

  const resultadosRef = useRef(resultados)
  resultadosRef.current = resultados

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

  // ——— modal de filtros
  const [modal, setModal] = useState<ModoFiltros | null>(null)
  const contarRascunho = useCallback((r: Rascunho) => filtrar(entradas, { ...state, ...r }).length, [entradas, state])
  const precos = useMemo(
    () => entradas.filter((e) => noLocal(e, state.local, state.raio) && passaFiltros(e, { ...state, max: null })).map((e) => e.lar.mensalidadeMin),
    [entradas, state],
  )

  // ——— altura da barra de filtros (para o mapa fixo e o scroll-margin dos cartões)
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
        <div role="status" className="mx-4 mt-4 flex gap-3 rounded-2xl border border-sun-200 bg-sun-50 p-4 text-sun-800 sm:mx-6">
          <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <p className="text-sm">
            Não encontrámos «<strong>{state.lugarDesconhecido}</strong>». Mostramos todo o país — escreva o nome do concelho ou o código postal no campo «Onde procura».
          </p>
        </div>
      )}
      <ResultsHeader state={state} resultados={resultados} comVaga={comVaga} acao={desktop ? <SortSelect model={model} /> : undefined}>
        {!desktop && (
          <div className="relative mt-4 flex flex-wrap items-center gap-2">
            <QuickVaga model={model} />
            <SortSelect model={model} />
          </div>
        )}
        <ActivePills model={model} className="relative mt-4" />
      </ResultsHeader>
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
  return (
    <div className="flex flex-1 flex-col" style={{ '--barra': `${barH}px` } as CSSProperties}>
      {desktop ? (
        <>
          <FilterBar ref={barRef} model={model} geo={geo} precos={precos} onMaisFiltros={() => setModal('mais')} />
          <div className="flex flex-1 items-stretch">
            <div className="w-[56%] max-w-[46rem] shrink-0 border-r border-line xl:w-[44rem]">{lista}</div>
            <div className="relative min-w-0 flex-1">
              <div className="sticky top-[calc(4.5rem+var(--barra))] h-[calc(100dvh-4.5rem-var(--barra))]">{mapa('h-full w-full')}</div>
            </div>
          </div>
        </>
      ) : (
        <>
          <MobileBar ref={barRef} model={model} geo={geo} onFiltros={() => setModal('todos')} />
          {vistaMapa ? (
            <>
              <h1 className="sr-only">{titulo.h1}</h1>
              <p className="sr-only" aria-live="polite">
                {resultados.length} instituições, {comVaga} com vaga agora
              </p>
              {mapa('h-[calc(100dvh-4.5rem-var(--barra))] min-h-[22rem] w-full')}
            </>
          ) : (
            <div className="pb-28">{lista}</div>
          )}
          {!modalAberto && (
            <ViewToggle
              vista={vistaMapa ? 'mapa' : 'lista'}
              total={resultados.length}
              onChange={(vista) => {
                update({ vista })
                window.scrollTo({ top: 0 })
              }}
            />
          )}
        </>
      )}

      <FiltersModal
        open={modalAberto}
        onClose={() => setModal(null)}
        modo={desktop ? 'mais' : (modal ?? 'todos')}
        state={state}
        contar={contarRascunho}
        precos={precos}
        onApply={(r) => update(r)}
      />
    </div>
  )
}

function NotaFinal() {
  return (
    <footer className="mx-4 mt-2 mb-8 border-t border-line pt-6 text-sm text-ink-soft sm:mx-6">
      <p>
        As vagas são declaradas pelas instituições e a previsão é uma estimativa estatística — não é garantia de lugar. Confirme sempre por telefone antes de se
        deslocar.
      </p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
        <Link to="/sobre" className="link inline-flex min-h-11 items-center">
          Como estimamos as vagas
        </Link>
        <Link to="/guia" className="link inline-flex min-h-11 items-center">
          Guia e apoios
        </Link>
        <Link to="/para-lares" className="link inline-flex min-h-11 items-center">
          É uma instituição? Atualize as suas vagas
        </Link>
      </p>
    </footer>
  )
}
