/**
 * Estado da pesquisa ⇄ URL (contrato em docs/DESIGN.md §5).
 *
 * Contrato: lugar, lat, lng, raio, distrito, tipo, vaga, max, grau, cuidados, ss, q, ordem, vista=mapa.
 * Extensões locais:
 *   - `natureza` (ipss, misericordia, privado — vírgulas), do painel "Mais filtros";
 *   - `zona` (s,w,n,e) — "Pesquisar nesta zona" no mapa.
 */
import type { Cuidado, Distrito, GrauDependencia, Natureza, TipoResposta } from '@/types'
import { DISTRITOS, LUGARES, type LugarPesquisa } from '@/data/localidades'
import { CUIDADOS_ORDEM, GRAUS_ORDEM } from '@/lib/labels'
import type { LatLng } from '@/lib/geo'

export type Ordem = 'relevancia' | 'distancia' | 'preco' | 'disponibilidade' | 'avaliacao'
export type VagaFiltro = 'agora' | 'breve'
export type Vista = 'lista' | 'mapa'

export interface Bounds {
  s: number
  w: number
  n: number
  e: number
}

export type Local =
  | { tipo: 'pais' }
  | { tipo: 'lugar'; lugar: LugarPesquisa }
  | { tipo: 'coords'; lat: number; lng: number }
  | { tipo: 'distrito'; distrito: Distrito }
  | { tipo: 'zona'; bounds: Bounds }

export interface Filtros {
  tipos: TipoResposta[]
  vaga: VagaFiltro | null
  max: number | null
  grau: GrauDependencia | null
  cuidados: Cuidado[]
  ss: boolean
  naturezas: Natureza[]
  q: string
}

export interface SearchState extends Filtros {
  local: Local
  /** raio efetivo (km) — só conta quando há centro (lugar ou coordenadas) */
  raio: number
  ordem: Ordem
  vista: Vista
  /** valor de `lugar` no URL que não corresponde a nenhum lugar conhecido */
  lugarDesconhecido: string | null
}

export const TIPOS: TipoResposta[] = ['erpi', 'residencia', 'centro_dia']
export const NATUREZAS: Natureza[] = ['ipss', 'misericordia', 'privado']
export const ORDENS: Ordem[] = ['relevancia', 'distancia', 'disponibilidade', 'preco', 'avaliacao']
export const RAIOS_BASE = [5, 10, 15, 25, 50] as const
export const RAIO_COORDS = 15

export const ORDEM_LABEL: Record<Ordem, string> = {
  relevancia: 'Relevância',
  distancia: 'Mais perto',
  disponibilidade: 'Vaga mais cedo',
  preco: 'Preço mais baixo',
  avaliacao: 'Mais bem avaliados',
}

/** Rótulos curtos dos tipos para os botões de filtro. */
export const TIPO_CURTO: Record<TipoResposta, string> = {
  erpi: 'Lar',
  residencia: 'Residência',
  centro_dia: 'Centro de dia',
}

export const FILTROS_VAZIOS: Filtros = {
  tipos: [],
  vaga: null,
  max: null,
  grau: null,
  cuidados: [],
  ss: false,
  naturezas: [],
  q: '',
}

// ————————————————————————————————————————— texto

/** Minúsculas e sem acentos — para comparar "evora" com "Évora". */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

export function encontrarLugar(valor: string): LugarPesquisa | undefined {
  const exato = LUGARES.find((l) => l.label === valor)
  if (exato) return exato
  const n = normalizar(valor).replace(/\s*[-—–]\s*/g, ' — ')
  return LUGARES.find((l) => normalizar(l.label) === n)
}

export function encontrarDistrito(valor: string): Distrito | undefined {
  const n = normalizar(valor)
  return DISTRITOS.find((d) => normalizar(d) === n)
}

// ————————————————————————————————————————— geometria

export function centroDe(local: Local): LatLng | null {
  if (local.tipo === 'lugar') return { lat: local.lugar.lat, lng: local.lugar.lng }
  if (local.tipo === 'coords') return { lat: local.lat, lng: local.lng }
  return null
}

export function raioPadrao(local: Local): number {
  if (local.tipo === 'lugar') return local.lugar.raio
  return RAIO_COORDS
}

/** Opções de raio: as do contrato + o raio sugerido do lugar (ex.: 12 km no Porto). */
export function opcoesRaio(local: Local): number[] {
  return [...new Set<number>([...RAIOS_BASE, raioPadrao(local)])].sort((a, b) => a - b)
}

export function dentroDe(b: Bounds, p: LatLng) {
  return p.lat >= b.s && p.lat <= b.n && p.lng >= b.w && p.lng <= b.e
}

// ————————————————————————————————————————— URL → estado

const lista = <T extends string>(v: string | null, validos: readonly T[]): T[] => {
  if (!v) return []
  const set = new Set(v.split(',').map((x) => x.trim()))
  return validos.filter((x) => set.has(x))
}

const numero = (v: string | null): number | null => {
  if (v == null || v.trim() === '') return null
  const n = Number(v.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

function parseZona(v: string | null): Bounds | null {
  if (!v) return null
  const p = v.split(',').map((x) => Number(x))
  if (p.length !== 4 || p.some((x) => !Number.isFinite(x))) return null
  const [s, w, n, e] = p as [number, number, number, number]
  if (s >= n || w >= e || Math.abs(s) > 90 || Math.abs(n) > 90) return null
  return { s, w, n, e }
}

function maisProximo(valor: number, opcoes: number[]) {
  return opcoes.reduce((best, o) => (Math.abs(o - valor) < Math.abs(best - valor) ? o : best), opcoes[0]!)
}

export function parseSearch(params: URLSearchParams): SearchState {
  let local: Local = { tipo: 'pais' }
  let lugarDesconhecido: string | null = null

  const lat = numero(params.get('lat'))
  const lng = numero(params.get('lng'))
  const lugarParam = params.get('lugar')
  const distritoParam = params.get('distrito')
  const zona = parseZona(params.get('zona'))

  if (lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
    local = { tipo: 'coords', lat, lng }
  } else if (lugarParam) {
    const lugar = encontrarLugar(lugarParam)
    if (lugar) local = { tipo: 'lugar', lugar }
    else {
      // "lugar=Faro" pode também ser um distrito escrito à mão
      const d = encontrarDistrito(lugarParam)
      if (d) local = { tipo: 'distrito', distrito: d }
      else lugarDesconhecido = lugarParam
    }
  }
  if (local.tipo === 'pais' && distritoParam) {
    const d = encontrarDistrito(distritoParam)
    if (d) local = { tipo: 'distrito', distrito: d }
  }
  if (local.tipo === 'pais' && zona) local = { tipo: 'zona', bounds: zona }

  const raioParam = numero(params.get('raio'))
  const opcoes = opcoesRaio(local)
  const raio = raioParam != null && raioParam > 0 ? maisProximo(raioParam, opcoes) : raioPadrao(local)

  const vagaP = params.get('vaga')
  const vaga: VagaFiltro | null = vagaP === 'agora' || vagaP === 'breve' ? vagaP : null

  const maxP = numero(params.get('max'))
  const max = maxP != null && maxP > 0 ? Math.round(maxP) : null

  const grauP = params.get('grau')
  const grau = GRAUS_ORDEM.find((g) => g === grauP) ?? null

  const ordemP = params.get('ordem') as Ordem | null
  let ordem: Ordem = ordemP && ORDENS.includes(ordemP) ? ordemP : 'relevancia'
  if (ordem === 'distancia' && !centroDe(local)) ordem = 'relevancia'

  return {
    local,
    raio,
    tipos: lista(params.get('tipo'), TIPOS),
    vaga,
    max,
    grau,
    cuidados: lista(params.get('cuidados'), CUIDADOS_ORDEM),
    ss: params.get('ss') === '1',
    naturezas: lista(params.get('natureza'), NATUREZAS),
    q: (params.get('q') ?? '').trim().slice(0, 80),
    ordem,
    vista: params.get('vista') === 'mapa' ? 'mapa' : 'lista',
    lugarDesconhecido,
  }
}

// ————————————————————————————————————————— estado → URL

const r4 = (n: number) => String(Math.round(n * 10000) / 10000)
const r3 = (n: number) => String(Math.round(n * 1000) / 1000)

export function toSearchParams(s: SearchState): URLSearchParams {
  const p = new URLSearchParams()
  const { local } = s
  if (local.tipo === 'lugar') p.set('lugar', local.lugar.label)
  if (local.tipo === 'coords') {
    p.set('lat', r3(local.lat))
    p.set('lng', r3(local.lng))
  }
  if (local.tipo === 'distrito') p.set('distrito', local.distrito)
  if (local.tipo === 'zona') p.set('zona', [local.bounds.s, local.bounds.w, local.bounds.n, local.bounds.e].map(r4).join(','))
  if (centroDe(local) && s.raio !== raioPadrao(local)) p.set('raio', String(s.raio))
  if (s.tipos.length) p.set('tipo', TIPOS.filter((t) => s.tipos.includes(t)).join(','))
  if (s.vaga) p.set('vaga', s.vaga)
  if (s.max != null) p.set('max', String(s.max))
  if (s.grau) p.set('grau', s.grau)
  if (s.cuidados.length) p.set('cuidados', CUIDADOS_ORDEM.filter((c) => s.cuidados.includes(c)).join(','))
  if (s.ss) p.set('ss', '1')
  if (s.naturezas.length) p.set('natureza', NATUREZAS.filter((n) => s.naturezas.includes(n)).join(','))
  if (s.q) p.set('q', s.q)
  if (s.ordem !== 'relevancia') p.set('ordem', s.ordem)
  if (s.vista === 'mapa') p.set('vista', 'mapa')
  return p
}

/** Aplica alterações; mudar o local repõe o raio sugerido e ajusta a ordenação. */
export function withPatch(s: SearchState, patch: Partial<SearchState>): SearchState {
  const next: SearchState = { ...s, ...patch, lugarDesconhecido: null }
  if (patch.local && !('raio' in patch)) next.raio = raioPadrao(patch.local)
  if (next.ordem === 'distancia' && !centroDe(next.local)) next.ordem = 'relevancia'
  return next
}

// ————————————————————————————————————————— contagens e rótulos

/** Nº de filtros escolhidos no modal "Mais filtros" (desktop). */
export function contarMaisFiltros(f: Filtros): number {
  return (f.grau ? 1 : 0) + f.cuidados.length + (f.ss ? 1 : 0) + f.naturezas.length
}

/** Nº de filtros no modal completo do telemóvel. */
export function contarTodosFiltros(f: Filtros): number {
  return contarMaisFiltros(f) + (f.vaga ? 1 : 0) + f.tipos.length + (f.max != null ? 1 : 0)
}

export function filtrosDe(s: SearchState): Filtros {
  return {
    tipos: s.tipos,
    vaga: s.vaga,
    max: s.max,
    grau: s.grau,
    cuidados: s.cuidados,
    ss: s.ss,
    naturezas: s.naturezas,
    q: s.q,
  }
}

/** Texto do campo de lugar para o local atual. */
export function rotuloLocal(local: Local): string {
  switch (local.tipo) {
    case 'lugar':
      return local.lugar.label
    case 'coords':
      return 'A minha localização'
    case 'distrito':
      return `Distrito de ${local.distrito}`
    case 'zona':
      return 'Zona escolhida no mapa'
    default:
      return ''
  }
}
