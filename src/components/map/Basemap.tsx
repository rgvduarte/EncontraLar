import { useEffect, useState } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import type { Map as GLMap, StyleSpecification, LayerSpecification } from 'maplibre-gl'

/**
 * Mapa de base sem chave de API: estilo vetorial "Positron" da OpenFreeMap (gratuito, sem registo,
 * sem limites), desenhado com MapLibre dentro do Leaflet e afinado para a paleta do site
 * (cinzentos neutros, água azul suave, nomes em português, sem pontos de interesse).
 *
 * Se o estilo ou os mosaicos não carregarem (sem rede, WebGL indisponível, bloqueio), cai para um
 * contorno local da Península Ibérica — o mapa nunca fica vazio nem mostra marcas de erro.
 */

const ESTILO = 'https://tiles.openfreemap.org/styles/positron'
const ATRIBUICAO =
  '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · dados © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
const ATRIBUICAO_LOCAL = 'Contornos © <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'
/** sem mosaicos ao fim deste tempo → contorno local */
const PRAZO_MS = 12000

const COR = {
  terra: '#f5f5f7',
  agua: '#d6e3ee',
  rio: '#cddcea',
  parque: '#e5eee0',
  textoAgua: '#6f8aa3',
  // contorno local
  portugal: '#ffffff',
  vizinhos: '#ececf0',
  fronteira: '#d2d2d7',
  mar: '#dfe8f1',
} as const

/** Afina o estilo Positron: nomes em português, cores do site, sem pontos de interesse. */
function afinar(estilo: StyleSpecification): StyleSpecification {
  const nome = ['coalesce', ['get', 'name:pt'], ['get', 'name:latin'], ['get', 'name']]
  const layers = estilo.layers
    .filter((l) => !('source-layer' in l && l['source-layer'] === 'poi'))
    .map((l): LayerSpecification => {
      const paint: Record<string, unknown> = { ...(l.paint ?? {}) }
      const layout: Record<string, unknown> = { ...(l.layout ?? {}) }
      const fonte = 'source-layer' in l ? l['source-layer'] : undefined
      if (l.type === 'background') paint['background-color'] = COR.terra
      if (l.type === 'fill' && fonte === 'water') paint['fill-color'] = COR.agua
      if (l.type === 'fill' && fonte === 'park') paint['fill-color'] = COR.parque
      if (l.type === 'line' && fonte === 'waterway') paint['line-color'] = COR.rio
      if (l.type === 'symbol') {
        const campo = layout['text-field']
        if (campo !== undefined && JSON.stringify(campo).includes('name')) layout['text-field'] = nome
        if (fonte === 'water_name') paint['text-color'] = COR.textoAgua
      }
      return { ...l, paint, layout } as LayerSpecification
    })
  return { ...estilo, layers }
}

/** Contorno local (Portugal em destaque, vizinhos em cinzento) — usado quando a rede falha. */
function useContornoLocal(map: L.Map, ativo: boolean) {
  useEffect(() => {
    if (!ativo) return
    let cancelado = false
    let camada: L.GeoJSON | undefined
    const pane = map.getPane('tilePane')
    const container = map.getContainer()
    const fundoAnterior = container.style.background
    container.style.background = COR.mar
    map.attributionControl?.addAttribution(ATRIBUICAO_LOCAL)
    void import('@/data/iberia.geo.json').then(({ default: dados }) => {
      if (cancelado) return
      camada = L.geoJSON(dados as GeoJSON.FeatureCollection, {
        pane: pane ? 'tilePane' : undefined,
        interactive: false,
        style: (f) => ({
          stroke: true,
          color: COR.fronteira,
          weight: 1,
          fillOpacity: 1,
          fillColor: f?.properties?.name === 'Portugal' ? COR.portugal : COR.vizinhos,
        }),
      }).addTo(map)
    })
    return () => {
      cancelado = true
      camada?.remove()
      container.style.background = fundoAnterior
      map.attributionControl?.removeAttribution(ATRIBUICAO_LOCAL)
    }
  }, [map, ativo])
}

export function Basemap() {
  const map = useMap()
  const [falhou, setFalhou] = useState(false)

  useContornoLocal(map, falhou)

  useEffect(() => {
    let cancelado = false
    let camada: L.Layer | undefined
    let glMap: GLMap | undefined
    let prazo: number | undefined

    const desistir = () => {
      if (cancelado) return
      cancelado = true
      window.clearTimeout(prazo)
      camada?.remove()
      camada = undefined
      map.attributionControl?.removeAttribution(ATRIBUICAO)
      setFalhou(true)
    }

    prazo = window.setTimeout(desistir, PRAZO_MS)

    void (async () => {
      try {
        const [{ maplibreGL }, resposta] = await Promise.all([
          import('@maplibre/maplibre-gl-leaflet'),
          fetch(ESTILO),
          import('maplibre-gl/dist/maplibre-gl.css'),
        ])
        if (!resposta.ok) throw new Error(`estilo: ${resposta.status}`)
        const estilo = afinar((await resposta.json()) as StyleSpecification)
        if (cancelado) return

        const gl = maplibreGL({ style: estilo, attributionControl: false, interactive: false })
        gl.addTo(map) // lança se não houver WebGL
        camada = gl
        glMap = gl.getMaplibreMap()
        map.attributionControl?.addAttribution(ATRIBUICAO)

        let carregou = false
        glMap.on('sourcedata', (e) => {
          if (carregou || !('tile' in e) || !e.tile) return
          carregou = true
          window.clearTimeout(prazo)
        })
        glMap.on('error', () => {
          if (!carregou) desistir()
        })
      } catch {
        desistir()
      }
    })()

    return () => {
      cancelado = true
      window.clearTimeout(prazo)
      camada?.remove()
      map.attributionControl?.removeAttribution(ATRIBUICAO)
    }
  }, [map])

  return null
}
