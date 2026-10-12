import { useEffect, useRef, useState } from 'react'
import { useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { CENTRO_DISTRITO } from '@/data/localidades'
import type { Entrada } from './filtering'
import { centroDe, type Local } from './searchState'

/** Enquadramentos rápidos. */
export const REGIOES_MAPA = {
  continente: L.latLngBounds([36.95, -9.55], [42.16, -6.18]),
  madeira: L.latLngBounds([32.6, -17.3], [32.88, -16.65]),
  acores: L.latLngBounds([36.9, -31.3], [39.75, -24.95]),
} as const

const ILHAS = new Set(['Madeira', 'Açores'])

/** Enquadramento para um conjunto de resultados no país: continente primeiro, ilhas só se forem as únicas. */
function limitesPais(resultados: Entrada[]): L.LatLngBounds {
  const cont = resultados.filter((e) => !ILHAS.has(e.lar.regiao))
  const base = cont.length ? cont : resultados
  if (!base.length) return REGIOES_MAPA.continente
  return L.latLngBounds(base.map((e) => [e.lar.lat, e.lar.lng] as [number, number]))
}

interface Props {
  /** muda quando os filtros mudam (não muda com hover/seleção) */
  fitKey: string
  local: Local
  raio: number
  resultados: Entrada[]
  padding: [number, number]
  onUserMove: () => void
  onBackgroundClick: () => void
}

/**
 * Enquadra o mapa quando os filtros mudam e distingue movimentos do utilizador
 * (para oferecer "Pesquisar nesta zona") dos movimentos programáticos.
 */
export function MapController({ fitKey, local, raio, resultados, padding, onUserMove, onBackgroundClick }: Props) {
  const map = useMap()
  const ignorarAte = useRef(0)
  const primeira = useRef(true)
  const latest = useRef({ local, raio, resultados, padding })
  latest.current = { local, raio, resultados, padding }

  /** movimentos nos próximos `ms` são nossos (enquadramentos), não do utilizador */
  const marcarProgramatico = (ms = 900) => {
    ignorarAte.current = Date.now() + ms
  }

  const [tamanho, setTamanho] = useState(0)
  const ultimoFit = useRef(0)
  const tamanhoVisto = useRef(0)

  // o contentor muda de altura (barra de filtros medida depois, rotação, barra do navegador):
  // avisar o Leaflet; se acabámos de enquadrar, voltar a enquadrar com o tamanho certo
  useEffect(() => {
    const el = map.getContainer()
    let raf = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        map.invalidateSize({ pan: false })
        if (Date.now() - ultimoFit.current < 1500) setTamanho((t) => t + 1)
      })
    })
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [map])

  useEffect(() => {
    const { local, raio, resultados, padding } = latest.current
    const porTamanho = tamanhoVisto.current !== tamanho
    tamanhoVisto.current = tamanho
    const opts: L.FitBoundsOptions = { padding, maxZoom: 14, animate: !primeira.current && !porTamanho }
    const pontos = resultados.map((e) => [e.lar.lat, e.lar.lng] as [number, number])

    if (local.tipo === 'zona') {
      // a zona vem do próprio mapa: só enquadrar quando a página abre com ela no URL
      if (primeira.current || porTamanho) {
        marcarProgramatico()
        map.fitBounds(L.latLngBounds([local.bounds.s, local.bounds.w], [local.bounds.n, local.bounds.e]), { animate: false })
      }
    } else {
      marcarProgramatico()
      const centro = centroDe(local)
      if (centro) {
        // a área da pesquisa (círculo) inteira à vista, mais algum resultado que fique na orla
        const b = L.latLng(centro.lat, centro.lng).toBounds(raio * 2000)
        for (const p of pontos) b.extend(p)
        map.fitBounds(b, opts)
      } else if (local.tipo === 'distrito') {
        const c = CENTRO_DISTRITO[local.distrito]
        map.setView([c.lat, c.lng], c.zoom, { animate: false })
        if (pontos.length) {
          const b = L.latLngBounds(pontos)
          if (!map.getBounds().contains(b)) map.fitBounds(b, opts)
        }
      } else {
        map.fitBounds(limitesPais(resultados), { ...opts, maxZoom: 12 })
      }
    }
    primeira.current = false
    ultimoFit.current = Date.now()
  }, [fitKey, map, tamanho])

  useMapEvents({
    moveend() {
      if (Date.now() < ignorarAte.current) return
      onUserMove()
    },
    // o painel do popup pode deslocar o mapa: não conta como "mexer no mapa"
    popupopen() {
      marcarProgramatico(700)
    },
    click() {
      onBackgroundClick()
    },
  })

  return null
}
