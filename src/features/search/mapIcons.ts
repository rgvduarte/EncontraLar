/**
 * Ícones do mapa (L.divIcon): pílulas brancas com ponto de estado + preço, e círculos de agrupamento.
 * Estilos em search.css (o HTML dos marcadores é gerado fora do React).
 */
import L from 'leaflet'
import type { Disponibilidade, Lar } from '@/types'
import { DISPONIBILIDADE_LABEL } from '@/lib/labels'
import { euro } from '@/lib/format'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Texto da pílula: preço nos privados; nas sociais a mensalidade depende dos rendimentos. */
export function rotuloMarcador(lar: Lar): string {
  if (lar.natureza === 'ipss') return 'IPSS'
  if (lar.natureza === 'misericordia') return 'Santa Casa'
  return euro(lar.mensalidadeMin)
}

export function descricaoMarcador(lar: Lar, disp: Disponibilidade): string {
  const preco = lar.natureza === 'privado' ? `desde ${euro(lar.mensalidadeMin)} por mês` : 'mensalidade conforme os rendimentos'
  return `${lar.nome}, ${lar.localidade}. ${DISPONIBILIDADE_LABEL[disp]}, ${preco}.`
}

const cache = new Map<string, L.DivIcon>()

export function pinIcon(lar: Lar, disp: Disponibilidade, ativo: boolean): L.DivIcon {
  const rotulo = rotuloMarcador(lar)
  const key = `${lar.id}|${rotulo}|${disp}|${ativo ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const html =
    `<span class="el-pin el-pin--${disp}${ativo ? ' is-active' : ''}">` +
    `<span class="el-pin__dot" aria-hidden="true"></span>` +
    `<span aria-hidden="true">${esc(rotulo)}</span>` +
    `<span class="el-sr">${esc(descricaoMarcador(lar, disp))}</span>` +
    `</span>`
  const icon = L.divIcon({ html, className: `el-marker el-marker--${disp}`, iconSize: [0, 0], iconAnchor: [0, 0] })
  cache.set(key, icon)
  return icon
}

/** Interface mínima do agrupamento (o leaflet.markercluster não tem tipos instalados). */
export interface ClusterLike {
  getAllChildMarkers(): L.Marker[]
}

/** Círculo branco com o total e um anel fino (verde) com a proporção de instituições com vaga agora. */
export function clusterIcon(cluster: ClusterLike): L.DivIcon {
  const filhos = cluster.getAllChildMarkers()
  const n = filhos.length
  const vagas = filhos.filter((m) => String(m.options.icon?.options.className ?? '').includes('el-marker--disponivel')).length
  const size = n < 10 ? 40 : n < 30 ? 46 : 52
  const c = size / 2
  const r = c - 2.5
  const perimetro = 2 * Math.PI * r
  const arco = n ? (vagas / n) * perimetro : 0
  const titulo = `${n} instituições, ${vagas} com vaga agora`
  const html =
    `<span class="el-cluster" style="width:${size}px;height:${size}px" title="${titulo}">` +
    `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
    `<circle class="el-cluster__track" cx="${c}" cy="${c}" r="${r}" />` +
    (arco > 0
      ? `<circle class="el-cluster__arc" cx="${c}" cy="${c}" r="${r}" stroke-dasharray="${arco.toFixed(2)} ${perimetro.toFixed(2)}" transform="rotate(-90 ${c} ${c})" />`
      : '') +
    `</svg>` +
    `<span class="el-cluster__n" aria-hidden="true">${n}</span>` +
    `<span class="el-sr">${titulo}. Ampliar o mapa nesta zona.</span>` +
    `</span>`
  return L.divIcon({ html, className: 'el-cluster-icon', iconSize: [size, size] })
}
