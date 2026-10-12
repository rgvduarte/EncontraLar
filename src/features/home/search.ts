/**
 * Lógica do painel de pesquisa da página inicial: sugestões de lugares, construção do URL de /pesquisa
 * (contrato em docs/DESIGN.md) e a contagem em direto de resultados.
 */
import type { Distrito, Lar, TipoResposta } from '@/types'
import { DISTRITOS, LUGARES, type LugarPesquisa } from '@/data/localidades'
import { distanceKm } from '@/lib/geo'
import { temVaga } from './homeData'

export type TipoEscolha = TipoResposta | 'qualquer'

/** Raio usado em "Perto de mim" (um dos valores aceites pela pesquisa). */
export const RAIO_PERTO = 15

export type Destino =
  | { kind: 'lugar'; lugar: LugarPesquisa }
  | { kind: 'distrito'; distrito: Distrito }
  | { kind: 'geo'; lat: number; lng: number; perto?: LugarPesquisa; longe: boolean }

/** Sem acentos e em minúsculas. Mantém o comprimento das strings em NFC (útil para realçar). */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

// ————————————————————————————————————————— sugestões

export interface Opcao {
  id: string
  kind: 'lugar' | 'distrito' | 'lar'
  label: string
  /** tipo de sugestão, sempre visível e lido pelo leitor de ecrã */
  categoria: string
  total: number
  comVaga: number
  lugar?: LugarPesquisa
  distrito?: Distrito
  larId?: string
}

const POPULARES = ['Lisboa', 'Porto', 'Braga', 'Coimbra', 'Faro', 'Évora']

function contarLugar(lares: Lar[], lugar: LugarPesquisa) {
  let total = 0
  let comVaga = 0
  for (const l of lares) {
    if (distanceKm(lugar, l) <= lugar.raio) {
      total++
      if (temVaga(l)) comVaga++
    }
  }
  return { total, comVaga }
}

function contarDistrito(lares: Lar[], d: Distrito) {
  let total = 0
  let comVaga = 0
  for (const l of lares) {
    if (l.distrito === d) {
      total++
      if (temVaga(l)) comVaga++
    }
  }
  return { total, comVaga }
}

/** "do Porto", "da Guarda", "de Braga", "dos Açores" */
export const deDistrito = (d: Distrito) =>
  d === 'Porto' ? 'do Porto' : d === 'Guarda' ? 'da Guarda' : d === 'Madeira' ? 'da Madeira' : d === 'Açores' ? 'dos Açores' : `de ${d}`

export const nomeDistrito = (d: Distrito) =>
  d === 'Madeira' || d === 'Açores' ? `Região Autónoma ${deDistrito(d)}` : `Distrito ${deDistrito(d)}`

/** 0 = começa por · 1 = uma palavra começa por · 2 = contém · -1 = não corresponde */
function relevancia(label: string, q: string): number {
  const n = normalizar(label)
  if (n.startsWith(q)) return 0
  if (n.split(/[\s—-]+/).some((w) => w.startsWith(q))) return 1
  if (n.includes(q)) return 2
  return -1
}

export function sugerir(texto: string, lares: Lar[], limite = 8): Opcao[] {
  const q = normalizar(texto.trim())
  const lugarOpcao = (l: LugarPesquisa): Opcao => ({
    id: `lugar:${l.label}`,
    kind: 'lugar',
    label: l.label,
    categoria: l.label.includes(' — ') ? 'Zona da cidade' : l.distrito === 'Madeira' || l.distrito === 'Açores' ? `Concelho · ${l.distrito}` : `Concelho · distrito ${deDistrito(l.distrito)}`,
    lugar: l,
    ...contarLugar(lares, l),
  })

  if (!q) {
    return POPULARES.map((p) => LUGARES.find((l) => l.label === p))
      .filter((l): l is LugarPesquisa => Boolean(l))
      .map(lugarOpcao)
  }

  const lugares = LUGARES.map((l) => ({ l, r: relevancia(l.label, q) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.l.label.localeCompare(b.l.label, 'pt'))
    .slice(0, 6)
    .map((x) => lugarOpcao(x.l))

  const distritos = DISTRITOS.map((d) => ({ d, r: relevancia(d, q) }))
    .filter((x) => x.r >= 0 && x.r < 2)
    .slice(0, 2)
    .map<Opcao>(({ d }) => ({
      id: `distrito:${d}`,
      kind: 'distrito',
      label: nomeDistrito(d),
      categoria: 'Todo o distrito',
      distrito: d,
      ...contarDistrito(lares, d),
    }))

  const instituicoes =
    q.length >= 3
      ? lares
          .map((l) => ({ l, r: relevancia(l.nome, q) }))
          .filter((x) => x.r >= 0)
          .sort((a, b) => a.r - b.r || a.l.nome.localeCompare(b.l.nome, 'pt'))
          .slice(0, 3)
          .map<Opcao>(({ l }) => ({
            id: `lar:${l.id}`,
            kind: 'lar',
            label: l.nome,
            categoria: `Instituição · ${l.localidade}`,
            larId: l.id,
            total: 1,
            comVaga: temVaga(l) ? 1 : 0,
          }))
      : []

  return [...lugares, ...distritos, ...instituicoes].slice(0, limite)
}

/** Tenta transformar texto escrito à mão num destino (correspondência exata, sem acentos). */
export function resolverTexto(texto: string): Destino | null {
  const q = normalizar(texto.trim())
  if (!q) return null
  const lugar = LUGARES.find((l) => normalizar(l.label) === q)
  if (lugar) return { kind: 'lugar', lugar }
  const distrito = DISTRITOS.find((d) => normalizar(d) === q || normalizar(nomeDistrito(d)) === q)
  if (distrito) return { kind: 'distrito', distrito }
  // "Lisboa" escrito sem acento ou com espaço a mais já foi tratado; aceitar o primeiro lugar que começa pelo texto
  const comeca = LUGARES.filter((l) => normalizar(l.label).startsWith(q))
  if (comeca.length === 1) return { kind: 'lugar', lugar: comeca[0]! }
  return null
}

/** Lugar conhecido mais próximo de umas coordenadas (para dizer "perto de Matosinhos"). */
export function lugarMaisProximo(lat: number, lng: number): { lugar: LugarPesquisa; km: number } | null {
  let melhor: { lugar: LugarPesquisa; km: number } | null = null
  for (const l of LUGARES) {
    if (l.label.includes(' — ')) continue
    const km = distanceKm({ lat, lng }, l)
    if (!melhor || km < melhor.km) melhor = { lugar: l, km }
  }
  return melhor
}

// ————————————————————————————————————————— URL e contagem

export interface Escolhas {
  destino: Destino | null
  /** texto livre que não corresponde a nenhum lugar (pesquisa pelo nome) */
  texto?: string
  tipo: TipoEscolha
  soVaga: boolean
}

export function urlPesquisa({ destino, texto, tipo, soVaga }: Escolhas): string {
  const p = new URLSearchParams()
  if (destino?.kind === 'lugar') p.set('lugar', destino.lugar.label)
  else if (destino?.kind === 'distrito') p.set('distrito', destino.distrito)
  else if (destino?.kind === 'geo') {
    p.set('lat', destino.lat.toFixed(5))
    p.set('lng', destino.lng.toFixed(5))
    p.set('raio', String(RAIO_PERTO))
  } else if (texto?.trim()) p.set('q', texto.trim())
  if (tipo !== 'qualquer') p.set('tipo', tipo)
  if (soVaga) p.set('vaga', 'agora')
  const qs = p.toString()
  return qs ? `/pesquisa?${qs}` : '/pesquisa'
}

export function contarEscolhas(lares: Lar[], { destino, tipo }: Pick<Escolhas, 'destino' | 'tipo'>) {
  let total = 0
  let comVaga = 0
  for (const l of lares) {
    if (tipo !== 'qualquer' && l.tipo !== tipo) continue
    if (destino?.kind === 'lugar' && distanceKm(destino.lugar, l) > destino.lugar.raio) continue
    if (destino?.kind === 'distrito' && l.distrito !== destino.distrito) continue
    if (destino?.kind === 'geo' && distanceKm(destino, l) > RAIO_PERTO) continue
    total++
    if (temVaga(l)) comVaga++
  }
  return { total, comVaga }
}
