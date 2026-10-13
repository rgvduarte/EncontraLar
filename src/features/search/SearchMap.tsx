import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, Popup, Rectangle, ZoomControl } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import type L from 'leaflet'
import { RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Basemap } from '@/components/map/Basemap'
import { DispDot } from './Chips'
import { dispVisivel, livreComLista, type Entrada } from './filtering'
import { MapController, REGIOES_MAPA } from './MapController'
import { MapPeekCard, MapPopupContent } from './MapCards'
import { clusterIcon, clusterIconNeutro, descricaoGenerica, descricaoMarcador, pinIcon, pontoIcon, type ClusterLike } from './mapIcons'
import { useSaida } from './motion'
import { centroDe, type Bounds, type Local } from './searchState'

interface Props {
  resultados: Entrada[]
  local: Local
  raio: number
  fitKey: string
  hoverId: string | null
  selectedId: string | null
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
  onZona: (b: Bounds) => void
  /** telemóvel: sem popups, cartão no fundo */
  mobile: boolean
  /**
   * Camada completa (Acesso Família). Na versão grátis: pontos neutros (sem cor de vaga nem preço),
   * agrupamentos só com o total, popup e cartão genéricos e sem legenda das vagas.
   */
  completo: boolean
  /** deve incluir o posicionamento (relative/absolute) e o tamanho */
  className?: string
}

interface PinProps {
  e: Entrada
  ativo: boolean
  popup: boolean
  completo: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
  registar: (id: string, m: L.Marker | null) => void
}

// margens do auto-pan do popup: deixar livres os controlos sobrepostos (região/legenda em cima, zoom à direita)
const PAN_TL: [number, number] = [24, 128]
const PAN_BR: [number, number] = [72, 24]

const PinMarker = memo(function PinMarker({ e, ativo, popup, completo, onHover, onSelect, registar }: PinProps) {
  const id = e.lar.id
  const { lat, lng } = e.lar
  // posição estável: um array novo a cada render faz o agrupamento retirar e repor o marcador (e fecha o popup)
  const position = useMemo<[number, number]>(() => [lat, lng], [lat, lng])
  // a cor segue o cartão: um lugar livre já prometido à lista de espera aparece a laranja.
  // Versão grátis: o estado nem chega ao marcador (ícone, título e ordem de sobreposição iguais para todos)
  const disp = completo ? dispVisivel(e) : null
  const listaAFrente = completo && livreComLista(e)
  const icon = useMemo(() => (disp ? pinIcon(e.lar, disp, listaAFrente) : pontoIcon(e.lar)), [e.lar, disp, listaAFrente])

  // realce por classe no elemento existente → a pílula transita para preto (sem trocar o ícone)
  const markerRef = useRef<L.Marker | null>(null)
  const ativoRef = useRef(ativo)
  ativoRef.current = ativo
  const pintar = useCallback(() => {
    markerRef.current?.getElement()?.querySelector('.el-pin, .el-dot')?.classList.toggle('is-active', ativoRef.current)
  }, [])
  useEffect(() => {
    pintar()
  }, [ativo, icon, pintar])
  const ref = useCallback(
    (m: L.Marker | null) => {
      markerRef.current = m
      registar(id, m)
    },
    [id, registar],
  )

  const handlers = useMemo<L.LeafletEventHandlerFnMap>(
    () => ({
      // o agrupamento recria o elemento quando o marcador volta a aparecer: repor o realce
      add: pintar,
      click: () => onSelect(id),
      mouseover: () => onHover(id),
      mouseout: () => onHover(null),
      keydown: (ev) => {
        const k = (ev as L.LeafletKeyboardEvent).originalEvent.key
        if (k === ' ' || k === 'Enter') {
          ;(ev as L.LeafletKeyboardEvent).originalEvent.preventDefault()
          onSelect(id)
        }
      },
      popupclose: () => onSelect(null),
    }),
    [id, onHover, onSelect, pintar],
  )
  return (
    <Marker
      ref={ref}
      position={position}
      icon={icon}
      title={disp ? descricaoMarcador(e.lar, disp, listaAFrente) : descricaoGenerica(e.lar)}
      alt={e.lar.nome}
      keyboard
      riseOnHover
      zIndexOffset={ativo ? 2000 : disp === 'disponivel' ? 300 : disp === 'breve' ? 150 : 0}
      eventHandlers={handlers}
    >
      {popup && (
        <Popup className="el-popup" minWidth={280} maxWidth={280} autoPanPaddingTopLeft={PAN_TL} autoPanPaddingBottomRight={PAN_BR}>
          <MapPopupContent e={e} completo={completo} />
        </Popup>
      )}
    </Marker>
  )
})

const ATALHOS: { id: keyof typeof REGIOES_MAPA; label: string }[] = [
  { id: 'continente', label: 'Continente' },
  { id: 'madeira', label: 'Madeira' },
  { id: 'acores', label: 'Açores' },
]

// os mesmos nomes da legenda do mapa da página inicial
const LEGENDA = [
  { d: 'disponivel', t: 'Vaga disponível' },
  { d: 'breve', t: 'Vaga em breve' },
  { d: 'espera', t: 'Lista de espera' },
] as const

/**
 * Raio de agrupamento ≈ largura de uma pílula de preço (84–110px): marcadores mais próximos do que isto
 * juntam-se num agrupamento em vez de se taparem uns aos outros. Mais perto (zoom ≥ 12) separa-os mais cedo.
 */
const raioAgrupamento = (zoom: number) => (zoom >= 12 ? 64 : 80)

const vidro = 'bg-white/90 shadow-card ring-1 ring-black/5 backdrop-blur-xl'

/** Mapa de resultados (Leaflet): pílulas de preço, agrupamentos, raio, "Pesquisar nesta zona". */
export function SearchMap({ resultados, local, raio, fitKey, hoverId, selectedId, onHover, onSelect, onZona, mobile, completo, className }: Props) {
  const [map, setMap] = useState<L.Map | null>(null)
  const [mexeu, setMexeu] = useState(false)
  const markers = useRef(new Map<string, L.Marker>())
  const clusterRef = useRef<L.FeatureGroup | null>(null)

  const registar = useCallback((id: string, m: L.Marker | null) => {
    if (m) markers.current.set(id, m)
    else markers.current.delete(id)
  }, [])

  // filtros mudaram → "Pesquisar nesta zona" deixa de fazer sentido
  useEffect(() => setMexeu(false), [fitKey])

  // realçar o agrupamento que contém a instituição sob o rato na lista
  useEffect(() => {
    if (!hoverId || !clusterRef.current) return
    const m = markers.current.get(hoverId)
    const grupo = clusterRef.current as unknown as { getVisibleParent?: (m: L.Marker) => L.Marker | null }
    const pai = m && grupo.getVisibleParent ? grupo.getVisibleParent(m) : null
    if (!pai || pai === m) return
    const el = pai.getElement()
    el?.classList.add('is-active')
    return () => el?.classList.remove('is-active')
  }, [hoverId])

  // abrir o popup quando a seleção vem de fora (teclado) — no desktop
  useEffect(() => {
    if (mobile || !selectedId) return
    const m = markers.current.get(selectedId)
    if (m && !m.isPopupOpen() && map?.hasLayer(m)) m.openPopup()
  }, [selectedId, mobile, map])

  const centro = centroDe(local)
  const cLat = centro?.lat
  const cLng = centro?.lng
  const centroLL = useMemo<[number, number] | null>(() => (cLat != null && cLng != null ? [cLat, cLng] : null), [cLat, cLng])
  const zona = local.tipo === 'zona' ? local.bounds : null
  const zonaLL = useMemo<[[number, number], [number, number]] | null>(() => (zona ? [[zona.s, zona.w], [zona.n, zona.e]] : null), [zona])
  const selecionado = mobile && selectedId ? resultados.find((e) => e.lar.id === selectedId) : undefined
  // telemóvel: o marcador escolhido fica à vista, acima da folha que sobe do fundo
  const fLat = selecionado?.lar.lat
  const fLng = selecionado?.lar.lng
  const foco = useMemo<[number, number] | null>(() => (fLat != null && fLng != null ? [fLat, fLng] : null), [fLat, fLng])
  const folhaRef = useRef<HTMLDivElement>(null)
  // altura da folha + a sua distância ao fundo (bottom-20) + meia pílula do marcador + folga
  const margemFundo = useCallback(() => (folhaRef.current?.offsetHeight ?? 260) + 80 + 17 + 16, [])
  const porRegiao = useMemo(() => {
    const c = { continente: 0, madeira: 0, acores: 0 }
    for (const e of resultados) {
      if (e.lar.regiao === 'Madeira') c.madeira++
      else if (e.lar.regiao === 'Açores') c.acores++
      else c.continente++
    }
    return c
  }, [resultados])

  // entradas/saídas animadas: "Pesquisar nesta zona" e a folha do marcador (telemóvel)
  const zonaBtn = useSaida(mexeu && !selecionado ? true : null, 200)
  const folha = useSaida(selecionado, 260)

  const pesquisarZona = () => {
    if (!map) return
    const b = map.getBounds()
    onZona({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() })
    setMexeu(false)
  }

  return (
    // data-lenis-prevent: a roda aproxima o mapa (e desloca a folha do marcador) em vez de mover a página
    <div
      className={cn('el-map isolate overflow-hidden bg-sand', selecionado && 'el-map--peek', className)}
      role="region"
      aria-label="Mapa das instituições"
      data-lenis-prevent
    >
      <p className="sr-only">O mapa repete a informação da lista. Cada marcador pode ser escolhido com a tecla Tab e aberto com Enter.</p>
      <MapContainer ref={setMap} center={[39.6, -8.0]} zoom={7} minZoom={5} maxZoom={18} zoomControl={false} className="h-full w-full bg-sand" attributionControl>
        <Basemap />
        <ZoomControl position={mobile ? 'bottomright' : 'topright'} zoomInTitle="Aproximar" zoomOutTitle="Afastar" />
        <MapController
          fitKey={fitKey}
          local={local}
          raio={raio}
          resultados={resultados}
          padding={mobile ? [32, 32] : [64, 64]}
          onUserMove={() => setMexeu(true)}
          onBackgroundClick={() => mobile && onSelect(null)}
          foco={foco}
          margemFundo={margemFundo}
        />

        {centroLL && (
          <>
            <Circle
              center={centroLL}
              radius={raio * 1000}
              interactive={false}
              pathOptions={{ className: 'el-raio', weight: 1.5, dashArray: '4 7', lineCap: 'round' }}
            />
            {/* versão grátis: as instituições já são pontos a tinta, por isso o centro da pesquisa passa a anel */}
            <CircleMarker
              key={`${local.tipo}-${completo}`}
              center={centroLL}
              radius={6}
              interactive={false}
              pathOptions={{
                className: cn('el-centro', local.tipo === 'coords' ? 'el-centro--gps' : !completo && 'el-centro--anel'),
                weight: 3,
                fillOpacity: 1,
              }}
            />
          </>
        )}
        {zonaLL && (
          <Rectangle
            bounds={zonaLL}
            interactive={false}
            pathOptions={{ className: 'el-raio', weight: 1.5, dashArray: '4 7', lineCap: 'round', fill: false }}
          />
        )}

        {/* a chave refaz os agrupamentos se o acesso mudar (o ícone do agrupamento é escolhido quando ele nasce) */}
        <MarkerClusterGroup
          key={completo ? 'completo' : 'gratis'}
          ref={clusterRef}
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          maxClusterRadius={raioAgrupamento}
          disableClusteringAtZoom={13}
          iconCreateFunction={(c: ClusterLike) => (completo ? clusterIcon(c) : clusterIconNeutro(c))}
        >
          {resultados.map((e) => (
            <PinMarker
              key={e.lar.id}
              e={e}
              ativo={e.lar.id === hoverId || e.lar.id === selectedId}
              popup={!mobile}
              completo={completo}
              onHover={onHover}
              onSelect={onSelect}
              registar={registar}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* sobreposições (fora do contentor Leaflet para não arrastarem o mapa) */}
      <div className="pointer-events-none absolute top-3 right-3 left-3 z-[1000] flex flex-col items-start gap-2 sm:top-4 sm:right-auto sm:left-4">
        <nav aria-label="Ir para região" className={cn('pointer-events-auto flex rounded-full p-0.5', vidro)}>
          {ATALHOS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => map?.flyToBounds(REGIOES_MAPA[a.id], { duration: 0.8, padding: [24, 24] })}
              className="inline-flex min-h-12 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink transition-[background-color,scale] duration-200 hover:bg-sand active:scale-[0.96] sm:px-3.5 lg:min-h-11"
            >
              {a.label}
              <span className="text-ink-mute tabular">{porRegiao[a.id]}</span>
            </button>
          ))}
        </nav>
        {/* no telemóvel a legenda ocupa duas linhas (grelha que se ajusta ao texto); cada estado fica inteiro.
            Versão grátis: os pontos não têm cor de vaga, por isso não há legenda */}
        {completo && (
          <ul
            aria-label="Legenda"
            className={cn(
              'pointer-events-auto grid grid-cols-[auto_auto] gap-x-3 gap-y-1 rounded-[1.125rem] px-3.5 py-2 text-xs text-ink-soft sm:flex sm:rounded-full',
              'transition-[opacity,visibility] duration-200',
              // com a folha do marcador aberta (telemóvel) o estado já está escrito no cartão: a legenda sai e o marcador tem espaço
              selecionado && 'invisible opacity-0',
              vidro,
            )}
          >
            {LEGENDA.map((l) => (
              <li key={l.d} className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <DispDot disp={l.d} className="size-2.5" />
                {l.t}
              </li>
            ))}
          </ul>
        )}
      </div>

      {zonaBtn.item && (
        <div className={cn('pointer-events-none absolute inset-x-0 z-[1000] flex justify-center px-4', mobile ? 'bottom-20' : 'bottom-8')}>
          <button
            type="button"
            onClick={pesquisarZona}
            data-saindo={zonaBtn.saindo || undefined}
            tabIndex={zonaBtn.saindo ? -1 : undefined}
            className="el-rise pointer-events-auto inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white shadow-lift transition-[background-color,scale] duration-200 hover:bg-pine-600 active:scale-[0.97]"
          >
            <RotateCw aria-hidden className="size-4" />
            Pesquisar nesta zona
          </button>
        </div>
      )}

      {resultados.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[999] flex items-center justify-center p-6">
          <p className={cn('rounded-full px-5 py-3 text-sm text-ink-soft', vidro)}>Sem instituições com estes filtros</p>
        </div>
      )}

      {folha.item && (
        <div ref={folhaRef} className="pointer-events-none absolute inset-x-3 bottom-20 z-[1001]">
          <MapPeekCard e={folha.item} saindo={folha.saindo} onClose={() => onSelect(null)} completo={completo} />
        </div>
      )}
    </div>
  )
}
