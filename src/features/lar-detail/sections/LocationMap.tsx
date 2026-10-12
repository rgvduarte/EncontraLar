import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { Hand } from 'lucide-react'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { Basemap } from '@/components/map/Basemap'

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
 */
export default function LocationMap({ lat, lng, nome }: { lat: number; lng: number; nome: string }) {
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
    <div ref={raiz} className="relative isolate h-full w-full" role="region" aria-label={`Mapa com a localização de ${nome}`}>
      <MapContainer center={[lat, lng]} zoom={15} maxZoom={18} scrollWheelZoom={false} dragging={!toque} touchZoom={!toque} className="h-full w-full">
        <Basemap />
        <Marker position={[lat, lng]} icon={icon} title={nome} alt={nome} keyboard={false} />
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
