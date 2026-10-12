/**
 * Lógica da pesquisa da página inicial: sugestões de lugares e construção do URL de /pesquisa
 * (contrato em docs/DESIGN.md).
 */
import type { Distrito, Lar } from '@/types'
import { DISTRITOS, LUGARES, type LugarPesquisa } from '@/data/localidades'
import { distanceKm } from '@/lib/geo'
import { temVaga } from './homeData'

/** Raio usado em "Perto de mim" (um dos valores aceites pela pesquisa). */
export const RAIO_PERTO = 15

export type Destino =
  | { kind: 'lugar'; lugar: LugarPesquisa }
  | { kind: 'distrito'; distrito: Distrito }
  | { kind: 'geo'; lat: number; lng: number }

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
  /** linha secundária (tipo de sugestão), lida pelo leitor de ecrã */
  detalhe: string
  total: number
  comVaga: number
  lugar?: LugarPesquisa
  distrito?: Distrito
  larId?: string
}

function contar(lares: Lar[], pertence: (l: Lar) => boolean) {
  let total = 0
  let comVaga = 0
  for (const l of lares) {
    if (!pertence(l)) continue
    total++
    if (temVaga(l)) comVaga++
  }
  return { total, comVaga }
}

/** "do Porto", "da Guarda", "de Braga", "dos Açores" */
export const deDistrito = (d: Distrito) =>
  d === 'Porto' ? 'do Porto' : d === 'Guarda' ? 'da Guarda' : d === 'Madeira' ? 'da Madeira' : d === 'Açores' ? 'dos Açores' : `de ${d}`

const nomeDistrito = (d: Distrito) => (d === 'Madeira' || d === 'Açores' ? `Região Autónoma ${deDistrito(d)}` : `Distrito ${deDistrito(d)}`)

/** 0 = começa por · 1 = uma palavra começa por · 2 = contém · -1 = não corresponde */
function relevancia(label: string, q: string): number {
  const n = normalizar(label)
  if (n.startsWith(q)) return 0
  if (n.split(/[\s—-]+/).some((w) => w.startsWith(q))) return 1
  if (n.includes(q)) return 2
  return -1
}

export function sugerir(texto: string, lares: Lar[], limite = 7): Opcao[] {
  const q = normalizar(texto.trim())
  const lugarOpcao = (l: LugarPesquisa): Opcao => ({
    id: `lugar:${l.label}`,
    kind: 'lugar',
    label: l.label,
    detalhe: l.label.includes(' — ')
      ? 'Zona da cidade'
      : `Concelho · ${l.distrito === 'Madeira' || l.distrito === 'Açores' ? l.distrito : `distrito ${deDistrito(l.distrito)}`}`,
    lugar: l,
    ...contar(lares, (x) => distanceKm(l, x) <= l.raio),
  })

  if (!q) {
    // sem texto: os concelhos com mais instituições (contadas no próprio concelho, para que os vizinhos
    // de Lisboa e do Porto não ganhem só por o raio apanhar a cidade)
    const noConcelho = new Map<string, number>()
    for (const l of lares) noConcelho.set(l.concelho, (noConcelho.get(l.concelho) ?? 0) + 1)
    return LUGARES.filter((l) => !l.label.includes(' — ') && noConcelho.has(l.label))
      .sort((a, b) => noConcelho.get(b.label)! - noConcelho.get(a.label)! || a.label.localeCompare(b.label, 'pt'))
      .slice(0, 5)
      .map(lugarOpcao)
  }

  // mais relevantes primeiro; em empate, onde há mais instituições ("por" → Porto antes de Portalegre)
  const lugares = LUGARES.map((l) => ({ l, r: relevancia(l.label, q) }))
    .filter((x) => x.r >= 0)
    .map((x) => ({ r: x.r, o: lugarOpcao(x.l) }))
    .sort((a, b) => a.r - b.r || b.o.total - a.o.total || a.o.label.localeCompare(b.o.label, 'pt'))
    .slice(0, 5)
    .map((x) => x.o)

  const distritos = DISTRITOS.map((d) => ({ d, r: relevancia(d, q) }))
    .filter((x) => x.r >= 0 && x.r < 2)
    .slice(0, 2)
    .map<Opcao>(({ d }) => ({
      id: `distrito:${d}`,
      kind: 'distrito',
      label: nomeDistrito(d),
      detalhe: 'Todo o distrito',
      distrito: d,
      ...contar(lares, (x) => x.distrito === d),
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
            detalhe: `Instituição · ${l.localidade}`,
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
  const comeca = LUGARES.filter((l) => normalizar(l.label).startsWith(q))
  if (comeca.length === 1) return { kind: 'lugar', lugar: comeca[0]! }
  return null
}

/** Distância ao lugar conhecido mais próximo (para avisar quando a pessoa está fora da zona coberta). */
export function distanciaAoMaisProximo(lat: number, lng: number): number {
  let melhor = Infinity
  for (const l of LUGARES) melhor = Math.min(melhor, distanceKm({ lat, lng }, l))
  return melhor
}

// ————————————————————————————————————————— URL

export function urlPesquisa(destino: Destino | null, texto?: string): string {
  const p = new URLSearchParams()
  if (destino?.kind === 'lugar') p.set('lugar', destino.lugar.label)
  else if (destino?.kind === 'distrito') p.set('distrito', destino.distrito)
  else if (destino?.kind === 'geo') {
    p.set('lat', destino.lat.toFixed(5))
    p.set('lng', destino.lng.toFixed(5))
    p.set('raio', String(RAIO_PERTO))
  } else if (texto?.trim()) p.set('q', texto.trim())
  const qs = p.toString()
  return qs ? `/pesquisa?${qs}` : '/pesquisa'
}
