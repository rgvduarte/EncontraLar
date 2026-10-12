/**
 * Contas feitas sobre os dados reais do store para dar contexto às perguntas:
 * quantas instituições há no raio e quanto custam na zona.
 */
import type { Lar } from '@/types'
import { distanceKm } from '@/lib/geo'
import { precoReferencia } from '@/lib/matching'
import type { Local, Quarto } from './model'

/** O motor de recomendações só considera respostas residenciais (exclui centros de dia). */
export const residenciais = (lares: Lar[]) => lares.filter((l) => l.tipo !== 'centro_dia')

export interface LarPerto {
  lar: Lar
  d: number
}

export function comDistancia(lares: Lar[], local: Local): LarPerto[] {
  return lares.map((lar) => ({ lar, d: distanceKm(local, lar) })).sort((a, b) => a.d - b.d)
}

export function mediana(valores: number[]): number | null {
  if (!valores.length) return null
  const s = [...valores].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2
}

export interface PontoPreco {
  id: string
  preco: number
  privado: boolean
}

export interface ContextoPrecos {
  /** instituições usadas para o contexto */
  n: number
  /** true quando não havia nenhuma no raio e usamos as mais próximas */
  alargado: boolean
  /** distância máxima das instituições usadas (quando alargado) */
  ateKm: number
  pontos: PontoPreco[]
  medianaPrivados: number | null
  nPrivados: number
  ipss: { min: number; max: number; n: number } | null
  nAcordoSS: number
}

/** Preços de referência das instituições da zona (raio escolhido; se vazio, as 12 mais próximas). */
export function contextoPrecos(lares: Lar[], local: Local, raioKm: number, quarto: Quarto): ContextoPrecos {
  const todos = comDistancia(residenciais(lares), local)
  let area = todos.filter((x) => x.d <= raioKm)
  const alargado = area.length === 0
  if (alargado) area = todos.slice(0, 12)
  const pontos = area.map(({ lar }) => ({ id: lar.id, preco: precoReferencia(lar, quarto), privado: lar.natureza === 'privado' }))
  const privados = pontos.filter((p) => p.privado).map((p) => p.preco)
  const sociais = area.filter(({ lar }) => lar.natureza !== 'privado').map(({ lar }) => lar)
  return {
    n: area.length,
    alargado,
    ateKm: area.length ? area[area.length - 1]!.d : 0,
    pontos,
    medianaPrivados: mediana(privados),
    nPrivados: privados.length,
    ipss: sociais.length
      ? {
          min: Math.min(...sociais.map((l) => l.mensalidadeMin)),
          max: Math.max(...sociais.map((l) => l.mensalidadeMax)),
          n: sociais.length,
        }
      : null,
    nAcordoSS: area.filter(({ lar }) => lar.acordoSS).length,
  }
}
