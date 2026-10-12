import { useMemo } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import L from 'leaflet'

/** Alfinete minimalista: círculo preto com anel branco e sombra suave. */
const PIN_HTML = `<span style="display:block;width:22px;height:22px;border-radius:9999px;background:var(--color-ink);border:4px solid #fff;box-shadow:0 2px 10px rgb(0 0 0 / 0.28)"></span>`

/** Mapa pequeno da localização (Leaflet). Isolado num stacking context para não passar por cima do cabeçalho fixo. */
export default function LocationMap({ lat, lng, nome }: { lat: number; lng: number; nome: string }) {
  const icon = useMemo(() => L.divIcon({ html: PIN_HTML, className: '', iconSize: [22, 22], iconAnchor: [11, 11] }), [])
  return (
    <div className="isolate h-full w-full" role="region" aria-label={`Mapa com a localização de ${nome}`}>
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />
        <Marker position={[lat, lng]} icon={icon} title={nome} alt={nome} keyboard={false} />
      </MapContainer>
    </div>
  )
}
