import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from '@/components/ui/Toast'

export type GeoEstado = 'parado' | 'a-localizar'

const MENSAGEM: Record<number, string> = {
  1: 'O navegador não deu autorização para usar a localização. Pode autorizar nas definições do navegador ou escrever a localidade.',
  2: 'Não foi possível determinar a localização neste momento. Escreva a localidade ou o código postal.',
  3: 'A localização demorou demasiado. Tente de novo ou escreva a localidade.',
}

/** "Perto de mim": pede a localização uma vez e devolve as coordenadas arredondadas (~100 m). */
export function useGeolocation(onFound: (lat: number, lng: number) => void) {
  const [estado, setEstado] = useState<GeoEstado>('parado')
  const cb = useRef(onFound)
  useEffect(() => {
    cb.current = onFound
  }, [onFound])

  const localizar = useCallback(() => {
    if (!('geolocation' in navigator)) {
      toast.error('Localização indisponível', 'Este navegador não permite partilhar a localização. Escreva a localidade.')
      return
    }
    setEstado('a-localizar')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setEstado('parado')
        const lat = Math.round(pos.coords.latitude * 1000) / 1000
        const lng = Math.round(pos.coords.longitude * 1000) / 1000
        cb.current(lat, lng)
      },
      (err) => {
        setEstado('parado')
        toast.error('Não conseguimos saber onde está', MENSAGEM[err.code] ?? MENSAGEM[2])
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    )
  }, [])

  return { estado, localizar }
}
