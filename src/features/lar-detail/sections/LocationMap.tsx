import { useMemo } from 'react'
import { MapContainer, Marker, TileLayer } from 'react-leaflet'
import L from 'leaflet'

const PIN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 52" width="40" height="52" aria-hidden="true">
  <path d="M20 1.5C9.8 1.5 1.5 9.6 1.5 19.6c0 12.4 14.6 27.6 17.3 30.3a1.7 1.7 0 0 0 2.4 0c2.7-2.7 17.3-17.9 17.3-30.3C38.5 9.6 30.2 1.5 20 1.5Z" fill="#1d564e" stroke="#fbf8f3" stroke-width="2.5"/>
  <path d="M11.5 19.6 20 12.4l8.5 7.2v8.3a1.5 1.5 0 0 1-1.5 1.5H13a1.5 1.5 0 0 1-1.5-1.5v-8.3Z" fill="#fbf8f3"/>
  <path d="M20 26.8s-4.2-2.6-4.2-5.3c0-1.3 1-2.3 2.2-2.3.9 0 1.6.5 2 1.2.4-.7 1.1-1.2 2-1.2 1.2 0 2.2 1 2.2 2.3 0 2.7-4.2 5.3-4.2 5.3Z" fill="#d25b3b"/>
</svg>`

/** Mapa pequeno da localização (Leaflet). Isolado num stacking context para não passar por cima do cabeçalho fixo. */
export default function LocationMap({ lat, lng, nome }: { lat: number; lng: number; nome: string }) {
  const icon = useMemo(
    () =>
      L.divIcon({
        html: PIN_SVG,
        className: 'encontralar-pin',
        iconSize: [40, 52],
        iconAnchor: [20, 50],
      }),
    [],
  )
  return (
    <div className="isolate h-full w-full" role="region" aria-label={`Mapa com a localização de ${nome}`}>
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />
        <Marker position={[lat, lng]} icon={icon} title={nome} keyboard={false} />
      </MapContainer>
    </div>
  )
}
