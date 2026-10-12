export interface LatLng { lat: number; lng: number }

/** Distância em km (fórmula de haversine). */
export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Centro e zoom para enquadrar Portugal continental no mapa. */
export const PORTUGAL_CENTER: LatLng = { lat: 39.55, lng: -8.1 }
export const PORTUGAL_ZOOM = 7
