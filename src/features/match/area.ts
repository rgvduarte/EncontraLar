/**
 * Contas feitas sobre os dados reais do store para dar contexto às perguntas:
 * quantas instituições há no raio, preços da zona, e o "funil" do retrato.
 */
import type { Disponibilidade, GrauDependencia, Lar } from '@/types'
import { distanceKm } from '@/lib/geo'
import { disponibilidade } from '@/lib/forecast'
import { precoReferencia } from '@/lib/matching'
import { CUIDADOS_CRITICOS, GRAU_LABEL } from '@/lib/labels'
import type { Local, Quarto, Rascunho } from './model'

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

export interface EtapaFunil {
  chave: 'grau' | 'cuidados' | 'local' | 'orcamento' | 'ss'
  label: string
  n: number
}

export interface Funil {
  total: number
  etapas: EtapaFunil[]
  final: number
}

/**
 * Quantas instituições passam pelos requisitos já respondidos, um a um.
 * Grau e cuidados essenciais são eliminatórios no motor; distância e orçamento aqui são lidos à letra.
 */
export function funil(lares: Lar[], r: Rascunho): Funil {
  let atual = residenciais(lares)
  const total = atual.length
  const etapas: EtapaFunil[] = []
  if (r.grau) {
    const g = r.grau
    atual = atual.filter((l) => l.graus.includes(g))
    etapas.push({ chave: 'grau', label: `Admitem ${GRAU_LABEL[g].toLowerCase()}`, n: atual.length })
  }
  const criticos = r.semNecessidades ? [] : r.necessidades.filter((n) => CUIDADOS_CRITICOS.includes(n))
  if (criticos.length) {
    atual = atual.filter((l) => criticos.every((c) => l.cuidados.includes(c)))
    etapas.push({ chave: 'cuidados', label: 'Asseguram os cuidados essenciais', n: atual.length })
  }
  if (r.local) {
    const loc = r.local
    atual = atual.filter((l) => distanceKm(loc, l) <= r.raioKm)
    etapas.push({ chave: 'local', label: `A menos de ${r.raioKm} km`, n: atual.length })
  }
  if (r.orcamentoMax != null) {
    const max = r.orcamentoMax
    atual = atual.filter((l) => precoReferencia(l, r.quarto) <= max)
    etapas.push({ chave: 'orcamento', label: 'Dentro do orçamento', n: atual.length })
    if (r.precisaAcordoSS) {
      atual = atual.filter((l) => l.acordoSS)
      etapas.push({ chave: 'ss', label: 'Com acordo da Segurança Social', n: atual.length })
    }
  }
  return { total, etapas, final: atual.length }
}

/** Nº de instituições (residenciais) em todo o país que admitem cada grau. */
export function contagemPorGrau(lares: Lar[]): Record<GrauDependencia, number> {
  const res = residenciais(lares)
  return {
    autonomo: res.filter((l) => l.graus.includes('autonomo')).length,
    ligeira: res.filter((l) => l.graus.includes('ligeira')).length,
    moderada: res.filter((l) => l.graus.includes('moderada')).length,
    grave: res.filter((l) => l.graus.includes('grave')).length,
  }
}

export interface PontoRadar {
  id: string
  lat: number
  lng: number
  disp: Disponibilidade
  nome: string
  /** número no ranking (resultados) */
  rank?: number
  /** desenhar esbatido (fora do raio, pouco compatível…) */
  esbatido?: boolean
}

export const pontoRadar = (lar: Lar, extra: Partial<PontoRadar> = {}): PontoRadar => ({
  id: lar.id,
  lat: lar.lat,
  lng: lar.lng,
  disp: disponibilidade(lar),
  nome: lar.nome,
  ...extra,
})
