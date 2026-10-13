import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Hand } from 'lucide-react'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { Basemap } from '@/components/map/Basemap'
import { doLar } from '../helpers'

/** Alfinete minimalista: círculo preto com anel branco e sombra suave. */
const PIN_HTML = `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:var(--color-ink);border:4px solid #fff;box-shadow:0 2px 10px rgb(0 0 0 / 0.28)"></span>`

/** Liga/desliga os gestos do mapa (arrastar, pinçar, toque duplo) sem o recriar. */
function Gestos({ ativos }: { ativos: boolean }) {
  const map = useMap()
  useEffect(() => {
    const handlers = [map.dragging, map.touchZoom, map.doubleClickZoom]
    for (const h of handlers) {
      if (ativos) h?.enable()
      else h?.disable()
    }
  }, [map, ativos])
  return null
}

/**
 * Mapa pequeno da localização (Leaflet). Isolado num stacking context para não passar por cima do cabeçalho fixo.
 * Em ecrãs de toque não é uma "armadilha" de scroll: os gestos só ficam ativos depois de tocar no mapa,
 * e voltam a bloquear quando o mapa sai do ecrã.
 *
 * Sem `marcador` (versão grátis da ficha) é só a zona: o centro que recebe já é o do concelho, nunca o da
 * instituição, e não há alfinete — a localização exata não vai para o DOM.
 */
export default function LocationMap({
  lat,
  lng,
  nome,
  rotulo,
  zoom = 15,
  marcador = true,
}: {
  lat: number
  lng: number
  /** nome da instituição (alfinete e nome acessível do mapa) */
  nome: string
  /** nome acessível da região do mapa; por omissão "Mapa com a localização do Lar X" */
  rotulo?: string
  zoom?: number
  /** alfinete no centro (a localização exata); falso para mostrar só a zona */
  marcador?: boolean
}) {
  const icon = useMemo(() => L.divIcon({ html: PIN_HTML, className: '', iconSize: [22, 22], iconAnchor: [11, 11] }), [])
  const toque = useMediaQuery('(pointer: coarse)')
  const [desbloqueado, setDesbloqueado] = useState(false)
  const raiz = useRef<HTMLDivElement>(null)
  const bloqueado = toque && !desbloqueado

  // volta a bloquear quando o mapa sai do ecrã
  useEffect(() => {
    const el = raiz.current
    if (!el || !desbloqueado || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => {
      if (e && !e.isIntersecting) setDesbloqueado(false)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [desbloqueado])

  return (
    <div ref={raiz} className="relative isolate h-full w-full" role="region" aria-label={rotulo ?? `Mapa com a localização ${doLar(nome)}`}>
      <MapContainer center={[lat, lng]} zoom={zoom} maxZoom={18} scrollWheelZoom={false} dragging={!toque} touchZoom={!toque} className="h-full w-full">
        <Basemap />
        {marcador && <Marker position={[lat, lng]} icon={icon} title={nome} alt={nome} keyboard={false} />}
        {toque && <Gestos ativos={desbloqueado} />}
      </MapContainer>

      {toque && (
        <button
          type="button"
          onClick={() => setDesbloqueado(true)}
          aria-hidden={!bloqueado}
          tabIndex={bloqueado ? 0 : -1}
          className={cn(
            'absolute inset-0 z-[1001] flex items-end justify-center pb-11 transition-opacity duration-300',
            bloqueado ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white/90 px-5 text-sm font-medium text-ink shadow-soft ring-1 ring-black/5 backdrop-blur-md">
            <Hand aria-hidden className="size-4" />
            Tocar para mover o mapa
          </span>
        </button>
      )}
    </div>
  )
}
