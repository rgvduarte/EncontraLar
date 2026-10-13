import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { useLocation, useNavigationType } from 'react-router'
import { AcessoNecessarioModal } from '@/components/acesso'
import { Reveal } from '@/components/motion/Reveal'
import { useLenis } from '@/components/motion/SmoothScroll'
import { prefersReducedMotion } from '@/lib/motion'
import { useDocumentTitle, useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { EmptyResults } from './EmptyResults'
import { FilterBar } from './FilterBar'
import { FiltersModal, type ModoFiltros, type Rascunho } from './FiltersModal'
import { refTitulo } from './focoTitulo'
import { filtrar, noLocal, passaFiltros } from './filtering'
import { MobileBar, ViewToggle } from './MobileBar'
import { procuraDaPesquisa, useRegistoProcura } from './procura'
import { cardDomId, NotaFinal, PAGINA, ResultsList } from './ResultsList'
import { ResultsSummary, tituloPesquisa } from './ResultsSummary'
import { SearchMap } from './SearchMap'
import { centroDe, toSearchParams, type Bounds, type Vista } from './searchState'
import { useGeolocation } from './useGeolocation'
import { useSearch } from './useSearch'
import './search.css'

/** Última pesquisa (caminho + query do hash): o cabeçalho e a barra de abas voltam a ela a partir de outras páginas. */
const CHAVE_ULTIMA = 'encontralar:ultima-pesquisa'
/** Quantos resultados estavam à vista ("Mostrar mais"), para os repor ao voltar de uma ficha. */
const CHAVE_PAGINAS = 'encontralar:pesquisa-n'

function lerPaginas(chave: string): number {
  try {
    const v = JSON.parse(sessionStorage.getItem(CHAVE_PAGINAS) ?? 'null') as { chave?: string; n?: number } | null
    if (v && v.chave === chave && typeof v.n === 'number' && v.n > PAGINA) return Math.ceil(v.n / PAGINA) * PAGINA
  } catch {
    /* armazenamento indisponível */
  }
  return PAGINA
}

function guardar(chave: string, valor: string) {
  try {
    sessionStorage.setItem(chave, valor)
  } catch {
    /* armazenamento indisponível (modo privado, bloqueado): a pesquisa funciona na mesma */
  }
}

/**
 * /pesquisa — mapa de vagas.
 * Desktop: barra fixa (pesquisa + filtros) · lista à esquerda · mapa fixo à direita, sincronizados.
 * Telemóvel: lista por defeito; mapa entre a barra e a barra de abas com a pílula "Mapa" (?vista=mapa);
 * filtros numa folha inferior.
 *
 * Movimento (funcional, subtil): a lista entra em cascata ao abrir e sempre que os filtros/ordem mudam
 * (e volta ao topo); contagens deslizam; lista ⇄ mapa faz cross-fade (View Transitions, com recurso a
 * uma entrada CSS); marcadores entram em "salpico"; a folha do marcador sobe do fundo e fecha a deslizar.
 *
 * Acesso Família (`useAcesso().completo`, via useSearch): sem ele a pesquisa é a versão grátis (gratis.ts) —
 * filtros e ordem por vaga à vista mas fechados (abrem o AcessoNecessarioModal), uma lista só, mapa neutro,
 * orçamento por faixas e só totais agregados. Com ele (e para profissionais) tudo fica como sempre foi.
 */
export default function SearchPage() {
  const model = useSearch()
  const { state, entradas, resultados, comVaga, update, completo, zona } = model
  const desktop = useMediaQuery('(min-width: 1024px)')
  const titulo = tituloPesquisa(state)
  useDocumentTitle(titulo)

  // a última pesquisa fica guardada sempre que o URL muda (para o cabeçalho e a barra de abas)
  const { pathname, search } = useLocation()
  useEffect(() => guardar(CHAVE_ULTIMA, pathname + search), [pathname, search])

  // procura sem vaga agora num lugar ou distrito escolhido: registo anónimo quando a pesquisa assenta (1,5 s sem mudar o URL)
  useRegistoProcura(procuraDaPesquisa(state, resultados.length, comVaga), search)

  // chave dos filtros (sem ordenação nem vista): reenquadra o mapa e repõe a paginação
  const fitKey = useMemo(() => toSearchParams({ ...state, ordem: 'relevancia', vista: 'lista' }).toString(), [state])

  // ——— realces lista ↔ mapa
  const [listHoverId, setListHoverId] = useState<string | null>(null)
  const [mapHoverId, setMapHoverId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // ao voltar atrás (ou recarregar) a lista reabre com as páginas de "Mostrar mais" que já tinha
  const navegacao = useNavigationType()
  const [visiveis, setVisiveis] = useState(() => (navegacao === 'POP' ? lerPaginas(fitKey) : PAGINA))
  const scrollPendente = useRef<string | null>(null)
  const lenis = useLenis()

  useEffect(() => guardar(CHAVE_PAGINAS, JSON.stringify({ chave: fitKey, n: visiveis })), [fitKey, visiveis])
  // só quando os filtros mudam de facto (não ao abrir a página, senão a paginação reposta perdia-se)
  const fitAnterior = useRef(fitKey)
  useEffect(() => {
    if (fitAnterior.current === fitKey) return
    fitAnterior.current = fitKey
    setVisiveis(PAGINA)
    setSelectedId(null)
  }, [fitKey])

  // "geração" da lista (filtros + ordem): a lista nova entra em cascata a partir do topo
  const geracao = `${fitKey}|${state.ordem}`
  const geracaoVista = useRef(geracao)
  useEffect(() => {
    if (geracaoVista.current === geracao) return
    geracaoVista.current = geracao
    // estava a meio da lista antiga → voltar ao início dos resultados novos
    if (window.scrollY < 4) return
    if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
    else window.scrollTo({ top: 0 })
  }, [geracao, lenis])

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
    // centrar o cartão (com o scroll suave do site, quando ativo)
    if (lenis) lenis.scrollTo(el, { offset: -Math.max(0, (window.innerHeight - el.offsetHeight) / 2) })
    else el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
  }, [selectedId, visiveis, lenis])

  // ——— geolocalização
  const onGeo = useCallback((lat: number, lng: number) => update({ local: { tipo: 'coords', lat, lng } }), [update])
  const geo = useGeolocation(onGeo)

  // ——— modal de filtros (contagem ao vivo com o rascunho)
  const [modal, setModal] = useState<ModoFiltros | null>(null)
  const contarRascunho = useCallback((r: Rascunho) => filtrar(entradas, { ...state, ...r }, completo).length, [entradas, state, completo])
  // mensalidades exatas na zona (histograma do orçamento): só na camada completa
  const precos = useMemo(
    () =>
      completo
        ? entradas.filter((e) => noLocal(e, state.local, state.raio) && passaFiltros(e, { ...state, max: null })).map((e) => e.lar.mensalidadeMin)
        : [],
    [entradas, state, completo],
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

  // ——— lista ⇄ mapa (telemóvel). Estado local espelhado no URL: a navegação do router corre numa
  // transição React (assíncrona) e a View Transition precisa de aplicar a troca de forma síncrona.
  const [vista, setVista] = useState<Vista>(state.vista)
  useEffect(() => setVista(state.vista), [state.vista])
  const [entrada, setEntrada] = useState<Vista | null>(null)
  const trocarVista = (v: Vista) => {
    const aplicar = () => {
      flushSync(() => setVista(v))
      if (lenis) lenis.scrollTo(0, { immediate: true, force: true })
      else window.scrollTo({ top: 0 })
      update({ vista: v })
    }
    if (prefersReducedMotion()) {
      setEntrada(null)
      aplicar()
      return
    }
    if (typeof document.startViewTransition === 'function') {
      const html = document.documentElement
      html.dataset.elVista = v
      setEntrada(null)
      const t = document.startViewTransition(aplicar)
      const limpar = () => {
        if (html.dataset.elVista === v) delete html.dataset.elVista
      }
      t.finished.then(limpar, limpar)
      return
    }
    // sem View Transitions: a vista nova entra com uma animação curta
    setEntrada(v)
    aplicar()
  }

  const vistaMapa = !desktop && vista === 'mapa'
  const destaqueLista = selectedId ?? mapHoverId
  const destaqueMapa = listHoverId ?? mapHoverId

  const lista = (
    <>
      {state.lugarDesconhecido && (
        <p role="status" className="el-in-up mx-5 mt-6 rounded-[1.25rem] bg-sand px-5 py-4 text-sm text-ink-soft sm:mx-6 xl:mx-8">
          Não encontrámos «{state.lugarDesconhecido}». A mostrar todo o país — escreva o concelho ou o código postal na pesquisa.
        </p>
      )}
      <ResultsSummary model={model} desktop={desktop} />
      {resultados.length > 0 ? (
        <ResultsList
          resultados={resultados}
          geracao={geracao}
          ordem={state.ordem}
          visiveis={visiveis}
          onMais={() => setVisiveis((v) => v + PAGINA)}
          destaqueId={destaqueLista}
          onHover={setListHoverId}
          mostrarDistancia={Boolean(centroDe(state.local))}
          completo={completo}
        />
      ) : (
        <EmptyResults key={geracao} model={model} />
      )}
      <Reveal variant="fade" duration={700}>
        <NotaFinal />
      </Reveal>
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
      completo={completo}
    />
  )

  const modalAberto = modal != null
  const estilo = { '--barra': `${barH}px` } as CSSProperties

  // versão grátis: tocar num filtro ou ordem por vaga abre o convite; ao ativar, volta à pesquisa com ele aplicado
  const acesso = (
    <AcessoNecessarioModal open={model.pedidoAcesso.aberto} onClose={model.fecharAcesso} acao="filtro" voltar={model.pedidoAcesso.voltar || undefined} />
  )

  if (desktop) {
    return (
      <div className="flex flex-1 flex-col" style={estilo}>
        <FilterBar ref={barRef} model={model} geo={geo} precos={precos} onMaisFiltros={() => setModal('mais')} />
        <div className="flex flex-1 items-stretch">
          <div className="w-[54%] shrink-0 xl:w-[44rem]">{lista}</div>
          <div className="relative min-w-0 flex-1">
            {/* margem direita = a da barra de filtros e do cabeçalho (px-6 / xl:px-8): tudo alinhado à direita */}
            <div className="sticky top-[calc(4rem+var(--barra))] h-[calc(100dvh-4rem-var(--barra))] py-4 pr-6 xl:pr-8">
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
          completo={completo}
          onBloqueado={model.pedirAcesso}
        />
        {!completo && acesso}
      </div>
    )
  }

  return (
    <div className={cn('flex flex-1 flex-col', !vistaMapa && 'pb-24')} style={estilo}>
      <MobileBar ref={barRef} model={model} geo={geo} onFiltros={() => setModal('todos')} recolhivel={!vistaMapa} />
      {vistaMapa ? (
        <>
          <h1 ref={refTitulo} tabIndex={-1} data-titulo-pesquisa className="sr-only">
            {titulo}
          </h1>
          <p className="sr-only" aria-live="polite">
            {resultados.length} instituições
            {completo ? `, ${comVaga} com vaga agora` : zona?.comVaga != null && `, ${zona.rotulo.toLowerCase()}: ${zona.comVaga} com vaga agora`}
          </p>
          {/* o mapa ocupa exatamente o espaço entre a barra de pesquisa e a barra de abas */}
          <div className={cn('relative min-h-[22rem] flex-1', entrada === 'mapa' && 'el-vista-mapa')} style={{ viewTransitionName: 'el-mapa' }}>
            {mapa('absolute inset-0')}
          </div>
        </>
      ) : (
        <div className={cn('flex flex-col', entrada === 'lista' && 'el-vista-lista')}>{lista}</div>
      )}
      {!modalAberto && <ViewToggle vista={vistaMapa ? 'mapa' : 'lista'} onChange={trocarVista} />}
      <FiltersModal
        open={modalAberto}
        onClose={() => setModal(null)}
        modo="todos"
        state={state}
        contar={contarRascunho}
        precos={precos}
        onApply={(r) => update(r)}
        completo={completo}
        onBloqueado={model.pedirAcesso}
      />
      {!completo && acesso}
    </div>
  )
}
