import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, Popup, Rectangle, TileLayer, ZoomControl } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import type L from 'leaflet'
import { RotateCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DispDot } from './Chips'
import type { Entrada } from './filtering'
import { MapController, REGIOES_MAPA } from './MapController'
import { MapPeekCard, MapPopupContent } from './MapCards'
import { clusterIcon, descricaoMarcador, pinIcon, type ClusterLike } from './mapIcons'
import { centroDe, type Bounds, type Local } from './searchState'

const TILES = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'

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
  /** deve incluir o posicionamento (relative/absolute) e o tamanho */
  className?: string
}

interface PinProps {
  e: Entrada
  ativo: boolean
  popup: boolean
  onHover: (id: string | null) => void
  onSelect: (id: string | null) => void
  registar: (id: string, m: L.Marker | null) => void
}

const PinMarker = memo(function PinMarker({ e, ativo, popup, onHover, onSelect, registar }: PinProps) {
  const id = e.lar.id
  const { lat, lng } = e.lar
  // posição estável: um array novo a cada render faz o agrupamento retirar e repor o marcador (e fecha o popup)
  const position = useMemo<[number, number]>(() => [lat, lng], [lat, lng])
  const icon = useMemo(() => pinIcon(e.lar, e.disp, ativo), [e.lar, e.disp, ativo])
  const handlers = useMemo<L.LeafletEventHandlerFnMap>(
    () => ({
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
    [id, onHover, onSelect],
  )
  return (
    <Marker
      ref={(m) => registar(id, m)}
      position={position}
      icon={icon}
      title={descricaoMarcador(e.lar, e.disp)}
      alt={e.lar.nome}
      keyboard
      riseOnHover
      zIndexOffset={ativo ? 2000 : e.disp === 'disponivel' ? 300 : e.disp === 'breve' ? 150 : 0}
      eventHandlers={handlers}
    >
      {popup && (
        <Popup className="el-popup" minWidth={280} maxWidth={280} autoPanPadding={[24, 24]}>
          <MapPopupContent e={e} />
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

const LEGENDA = [
  { d: 'disponivel', t: 'Vaga agora' },
  { d: 'breve', t: 'Em breve' },
  { d: 'espera', t: 'Lista de espera' },
] as const

const vidro = 'bg-white/90 shadow-card ring-1 ring-black/5 backdrop-blur-xl'

/** Mapa de resultados (Leaflet): pílulas de preço, agrupamentos, raio, "Pesquisar nesta zona". */
export function SearchMap({ resultados, local, raio, fitKey, hoverId, selectedId, onHover, onSelect, onZona, mobile, className }: Props) {
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
  const porRegiao = useMemo(() => {
    const c = { continente: 0, madeira: 0, acores: 0 }
    for (const e of resultados) {
      if (e.lar.regiao === 'Madeira') c.madeira++
      else if (e.lar.regiao === 'Açores') c.acores++
      else c.continente++
    }
    return c
  }, [resultados])

  const pesquisarZona = () => {
    if (!map) return
    const b = map.getBounds()
    onZona({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() })
    setMexeu(false)
  }

  return (
    <div className={cn('el-map isolate overflow-hidden bg-sand', selecionado && 'el-map--peek', className)} role="region" aria-label="Mapa das instituições">
      <p className="sr-only">O mapa repete a informação da lista. Cada marcador pode ser escolhido com a tecla Tab e aberto com Enter.</p>
      <MapContainer ref={setMap} center={[39.6, -8.0]} zoom={7} minZoom={5} zoomControl={false} className="h-full w-full bg-sand" attributionControl>
        <TileLayer url={TILES} subdomains="abcd" maxZoom={19} attribution={ATTRIBUTION} />
        <ZoomControl position={mobile ? 'bottomright' : 'topright'} zoomInTitle="Aproximar" zoomOutTitle="Afastar" />
        <MapController
          fitKey={fitKey}
          local={local}
          raio={raio}
          resultados={resultados}
          padding={mobile ? [32, 32] : [64, 64]}
          onUserMove={() => setMexeu(true)}
          onBackgroundClick={() => mobile && onSelect(null)}
        />

        {centroLL && (
          <>
            <Circle
              center={centroLL}
              radius={raio * 1000}
              interactive={false}
              pathOptions={{ className: 'el-raio', weight: 1.5, dashArray: '4 7', lineCap: 'round' }}
            />
            <CircleMarker
              key={local.tipo}
              center={centroLL}
              radius={6}
              interactive={false}
              pathOptions={{ className: cn('el-centro', local.tipo === 'coords' && 'el-centro--gps'), weight: 3, fillOpacity: 1 }}
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

        <MarkerClusterGroup
          ref={clusterRef}
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          maxClusterRadius={48}
          disableClusteringAtZoom={13}
          iconCreateFunction={(c: ClusterLike) => clusterIcon(c)}
        >
          {resultados.map((e) => (
            <PinMarker
              key={e.lar.id}
              e={e}
              ativo={e.lar.id === hoverId || e.lar.id === selectedId}
              popup={!mobile}
              onHover={onHover}
              onSelect={onSelect}
              registar={registar}
            />
          ))}
        </MarkerClusterGroup>
      </MapContainer>

      {/* sobreposições (fora do contentor Leaflet para não arrastarem o mapa) */}
      <div className="pointer-events-none absolute top-3 left-3 z-[1000] flex flex-col items-start gap-2 sm:top-4 sm:left-4">
        <nav aria-label="Ir para região" className={cn('pointer-events-auto flex rounded-full p-0.5', vidro)}>
          {ATALHOS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => map?.flyToBounds(REGIOES_MAPA[a.id], { duration: 0.8, padding: [24, 24] })}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink transition-colors hover:bg-sand sm:px-3.5"
            >
              {a.label}
              <span className="text-ink-mute tabular">{porRegiao[a.id]}</span>
            </button>
          ))}
        </nav>
        <ul aria-label="Legenda" className={cn('pointer-events-auto flex gap-3 rounded-full px-3.5 py-2 text-xs text-ink-soft', vidro)}>
          {LEGENDA.map((l) => (
            <li key={l.d} className="inline-flex items-center gap-1.5">
              <DispDot disp={l.d} className="size-2.5" />
              {l.t}
            </li>
          ))}
        </ul>
      </div>

      {mexeu && !selecionado && (
        <div className={cn('pointer-events-none absolute inset-x-0 z-[1000] flex justify-center px-4', mobile ? 'bottom-20' : 'bottom-8')}>
          <button
            type="button"
            onClick={pesquisarZona}
            className="pointer-events-auto inline-flex min-h-12 animate-pop-in items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-white shadow-lift transition-colors hover:bg-pine-600"
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

      {selecionado && (
        <div className="pointer-events-none absolute inset-x-3 bottom-20 z-[1001]">
          <MapPeekCard e={selecionado} onClose={() => onSelect(null)} />
        </div>
      )}
    </div>
  )
}
