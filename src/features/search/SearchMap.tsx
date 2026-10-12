import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Circle, CircleMarker, MapContainer, Marker, Popup, Rectangle, TileLayer, ZoomControl } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { Search } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DispGlyph } from './Chips'
import type { Entrada } from './filtering'
import { MapController, REGIOES_MAPA } from './MapController'
import { MapPeekCard, MapPopupContent } from './MapCards'
import { clusterIcon, descricaoMarcador, pinIcon, type ClusterLike } from './mapIcons'
import { centroDe, type Bounds, type Local } from './searchState'
import './search.css'

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
      position={[e.lar.lat, e.lar.lng]}
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

  // filtros mudaram → o botão "Pesquisar nesta zona" deixa de fazer sentido
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
  const selecionado = mobile && selectedId ? resultados.find((e) => e.lar.id === selectedId) : undefined
  const porRegiao = useMemo(() => {
    const c: Record<string, number> = { continente: 0, madeira: 0, acores: 0 }
    for (const e of resultados) {
      if (e.lar.regiao === 'Madeira') c.madeira!++
      else if (e.lar.regiao === 'Açores') c.acores!++
      else c.continente!++
    }
    return c
  }, [resultados])

  const pesquisarZona = () => {
    if (!map) return
    const b = map.getBounds()
    onZona({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast() })
    setMexeu(false)
  }

  const padding: [number, number] = mobile ? [28, 28] : [56, 56]

  return (
    <div className={cn('relative isolate overflow-hidden bg-[#e8efe9]', className)} role="region" aria-label="Mapa das instituições">
      <p className="sr-only">
        O mapa repete a informação da lista de resultados. Cada marcador pode ser escolhido com a tecla Tab e aberto com Enter.
      </p>
      <MapContainer
        ref={setMap}
        center={[39.6, -8.0]}
        zoom={7}
        minZoom={5}
        zoomControl={false}
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={TILES} subdomains="abcd" maxZoom={19} attribution={ATTRIBUTION} />
        <ZoomControl position="topright" zoomInTitle="Aproximar" zoomOutTitle="Afastar" />
        <MapController
          fitKey={fitKey}
          local={local}
          raio={raio}
          resultados={resultados}
          padding={padding}
          onUserMove={() => setMexeu(true)}
          onBackgroundClick={() => mobile && onSelect(null)}
        />

        {centro && (
          <>
            <Circle
              center={[centro.lat, centro.lng]}
              radius={raio * 1000}
              interactive={false}
              pathOptions={{ color: '#22695e', weight: 2, dashArray: '2 8', lineCap: 'round', fillColor: '#4f9b8c', fillOpacity: 0.07 }}
            />
            <CircleMarker
              center={[centro.lat, centro.lng]}
              radius={7}
              interactive={false}
              pathOptions={{ color: '#ffffff', weight: 3, fillColor: '#d25b3b', fillOpacity: 1 }}
            />
          </>
        )}
        {local.tipo === 'zona' && (
          <Rectangle
            bounds={[
              [local.bounds.s, local.bounds.w],
              [local.bounds.n, local.bounds.e],
            ]}
            interactive={false}
            pathOptions={{ color: '#22695e', weight: 2, dashArray: '2 8', lineCap: 'round', fill: false }}
          />
        )}

        <MarkerClusterGroup
          ref={clusterRef}
          chunkedLoading
          showCoverageOnHover={false}
          spiderfyOnMaxZoom
          maxClusterRadius={46}
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
      {mexeu && (
        <div className={cn('pointer-events-none absolute inset-x-0 z-[1000] flex justify-center px-4', mobile ? 'top-[7.25rem]' : 'bottom-16')}>
          <button
            type="button"
            onClick={pesquisarZona}
            className="pointer-events-auto inline-flex min-h-12 animate-fade-up items-center gap-2 rounded-full bg-pine-800 px-5 font-bold text-white shadow-lift ring-4 ring-white/70 hover:bg-pine-900"
          >
            <Search aria-hidden className="size-5" />
            Pesquisar nesta zona
          </button>
        </div>
      )}

      <div className={cn('pointer-events-none absolute z-[1000] flex flex-col gap-2', mobile ? 'top-3 left-3' : 'top-4 left-4')}>
        <ul className="pointer-events-auto flex flex-wrap gap-x-3 gap-y-1 rounded-2xl border border-line bg-white/95 px-3 py-2 text-xs font-semibold text-ink-soft shadow-soft backdrop-blur">
          <li className="inline-flex items-center gap-1.5">
            <DispGlyph disp="disponivel" className="size-3.5 [&_svg]:size-3.5" /> Vaga agora
          </li>
          <li className="inline-flex items-center gap-1.5">
            <DispGlyph disp="breve" className="size-3.5 [&_svg]:size-3.5" /> Em breve
          </li>
          <li className="inline-flex items-center gap-1.5">
            <DispGlyph disp="espera" className="size-3.5 [&_svg]:size-3.5" /> Lista de espera
          </li>
        </ul>
        <nav aria-label="Ir para região" className="pointer-events-auto inline-flex self-start overflow-hidden rounded-2xl border border-line bg-white/95 shadow-soft backdrop-blur">
          {ATALHOS.map((a, i) => (
            <button
              key={a.id}
              type="button"
              onClick={() => map?.flyToBounds(REGIOES_MAPA[a.id], { duration: 0.8, padding: [24, 24] })}
              className={cn('inline-flex min-h-12 items-center gap-1.5 px-3.5 text-sm font-bold text-ink hover:bg-pine-50 hover:text-pine-800', i > 0 && 'border-l border-line')}
            >
              {a.label}
              <span className="text-xs font-semibold text-ink-mute tabular">{porRegiao[a.id]}</span>
            </button>
          ))}
        </nav>
      </div>

      {resultados.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[999] flex items-center justify-center p-6">
          <p className="max-w-xs rounded-2xl border border-line bg-white/95 px-5 py-4 text-center text-sm text-ink-soft shadow-card">
            Sem instituições para mostrar com estes filtros. {mobile ? 'Veja as sugestões na lista.' : 'Veja as sugestões ao lado.'}
          </p>
        </div>
      )}

      {selecionado && (
        <div className="pointer-events-none absolute inset-x-3 bottom-24 z-[1001]">
          <MapPeekCard e={selecionado} onClose={() => onSelect(null)} />
        </div>
      )}
    </div>
  )
}
