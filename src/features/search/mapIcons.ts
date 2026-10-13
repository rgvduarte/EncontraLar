/**
 * Ícones do mapa (L.divIcon): pílulas brancas com ponto de estado + preço, e círculos de agrupamento.
 * Versão grátis: um ponto neutro a tinta (sem preço nem estado de vaga) e agrupamentos só com o total.
 * Estilos em search.css (o HTML dos marcadores é gerado fora do React).
 */
import L from 'leaflet'
import type { Disponibilidade, Lar } from '@/types'
import { faixaPreco } from '@/lib/acesso'
import { DISPONIBILIDADE_LABEL, TIPO_LABEL } from '@/lib/labels'
import { euro } from '@/lib/format'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Texto da pílula: preço nos privados; nas sociais a mensalidade depende dos rendimentos. */
export function rotuloMarcador(lar: Lar): string {
  if (lar.natureza === 'ipss') return 'IPSS'
  if (lar.natureza === 'misericordia') return 'Santa Casa'
  return euro(lar.mensalidadeMin)
}

/** `listaAFrente`: há lugar livre, mas já prometido a quem está na lista de espera. */
export function descricaoMarcador(lar: Lar, disp: Disponibilidade, listaAFrente = false): string {
  const preco = lar.natureza === 'privado' ? `desde ${euro(lar.mensalidadeMin)} por mês` : 'mensalidade conforme os rendimentos'
  const estado = listaAFrente ? 'Lugar livre, com lista de espera à frente' : DISPONIBILIDADE_LABEL[disp]
  return `${lar.nome}, ${lar.localidade}. ${estado}, ${preco}.`
}

const cache = new Map<string, L.DivIcon>()

/** Atraso de entrada estável por instituição (0–180 ms): os marcadores "salpicam" o mapa em vez de aparecerem todos de uma vez. */
function atraso(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return Math.abs(h) % 7 * 30
}

/**
 * Pílula do marcador. O realce (lista ↔ mapa, seleção) NÃO faz parte do ícone: é a classe `is-active`
 * aplicada ao elemento existente (ver PinMarker) — assim a pílula transita suavemente para preto
 * em vez de ser substituída (e a animação de entrada não se repete ao passar o rato).
 */
export function pinIcon(lar: Lar, disp: Disponibilidade, listaAFrente = false): L.DivIcon {
  const rotulo = rotuloMarcador(lar)
  const key = `${lar.id}|${rotulo}|${disp}|${listaAFrente ? 1 : 0}`
  const hit = cache.get(key)
  if (hit) return hit
  const html =
    `<span class="el-pin el-pin--${disp}" style="animation-delay:${atraso(lar.id)}ms">` +
    `<span class="el-pin__dot" aria-hidden="true"></span>` +
    `<span aria-hidden="true">${esc(rotulo)}</span>` +
    `<span class="el-sr">${esc(descricaoMarcador(lar, disp, listaAFrente))}</span>` +
    `</span>`
  const icon = L.divIcon({ html, className: `el-marker el-marker--${disp}`, iconSize: [0, 0], iconAnchor: [0, 0] })
  cache.set(key, icon)
  return icon
}

/** Versão grátis: o que qualquer pessoa vê — nome, localidade, tipo e faixa de preço (nunca o estado da vaga). */
export function descricaoGenerica(lar: Lar): string {
  return `${lar.nome}, ${lar.localidade}. ${TIPO_LABEL[lar.tipo]}. ${faixaPreco(lar)}.`
}

/**
 * Versão grátis: ponto neutro (o mesmo para todas as instituições). A classe do ícone também é neutra,
 * para que nem o HTML do mapa nem a ordem de sobreposição digam qual tem vaga.
 */
export function pontoIcon(lar: Lar): L.DivIcon {
  const descricao = descricaoGenerica(lar)
  const key = `ponto|${lar.id}|${descricao}`
  const hit = cache.get(key)
  if (hit) return hit
  const html = `<span class="el-dot" style="animation-delay:${atraso(lar.id)}ms"><span class="el-sr">${esc(descricao)}</span></span>`
  const icon = L.divIcon({ html, className: 'el-marker el-marker--neutro', iconSize: [0, 0], iconAnchor: [0, 0] })
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
      ? `<circle class="el-cluster__arc" style="--arco:${arco.toFixed(2)}" cx="${c}" cy="${c}" r="${r}" stroke-dasharray="${arco.toFixed(2)} ${perimetro.toFixed(2)}" transform="rotate(-90 ${c} ${c})" />`
      : '') +
    `</svg>` +
    `<span class="el-cluster__n" aria-hidden="true">${n}</span>` +
    `<span class="el-sr">${titulo}. Ampliar o mapa nesta zona.</span>` +
    `</span>`
  return L.divIcon({ html, className: 'el-cluster-icon', iconSize: [size, size] })
}

/** Versão grátis: círculo branco só com o total (sem o anel das vagas). */
export function clusterIconNeutro(cluster: ClusterLike): L.DivIcon {
  const n = cluster.getAllChildMarkers().length
  const size = n < 10 ? 40 : n < 30 ? 46 : 52
  const titulo = `${n} instituições`
  const html =
    `<span class="el-cluster el-cluster--neutro" style="width:${size}px;height:${size}px" title="${titulo}">` +
    `<span class="el-cluster__n" aria-hidden="true">${n}</span>` +
    `<span class="el-sr">${titulo}. Ampliar o mapa nesta zona.</span>` +
    `</span>`
  return L.divIcon({ html, className: 'el-cluster-icon', iconSize: [size, size] })
}
