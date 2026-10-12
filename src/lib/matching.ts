/**
 * Motor de compatibilidade entre o perfil da pessoa idosa e cada instituição.
 * Pontuação 0–100 com pesos explícitos e razões legíveis (para transparência perante a família).
 */
import type { Lar, PerfilIdoso, TipoQuarto } from '@/types'
import { CUIDADOS_CRITICOS, CUIDADO_LABEL, COMODIDADE_LABEL, GRAU_LABEL, QUARTO_CURTO } from './labels'
import { distanceKm } from './geo'
import { disponibilidade, estimarEspera, type EstimativaEspera } from './forecast'
import { euro, km } from './format'

export const PESOS = {
  cuidados: 35,
  orcamento: 20,
  distancia: 20,
  disponibilidade: 15,
  preferencias: 10,
} as const

export type TipoRazao = 'ok' | 'parcial' | 'falta'
export interface Razao {
  tipo: TipoRazao
  texto: string
}

export interface MatchResult {
  larId: string
  /** 0–100 */
  score: number
  /** falha um requisito essencial (grau de dependência ou cuidado crítico) */
  compativel: boolean
  distanciaKm: number
  /** preço de referência para o tipo de quarto pretendido */
  precoRef: number
  parcelas: Record<keyof typeof PESOS, number>
  razoes: Razao[]
  espera: EstimativaEspera
}

/** Menor mensalidade disponível para o tipo de quarto pretendido (ou geral). */
export function precoReferencia(lar: Lar, quarto: TipoQuarto | 'indiferente'): number {
  const ofertas = quarto === 'indiferente' ? lar.quartos : lar.quartos.filter((q) => q.tipo === quarto)
  const base = ofertas.length ? ofertas : lar.quartos
  return base.length ? Math.min(...base.map((q) => q.precoMin)) : lar.mensalidadeMin
}

type PerfilMatch = Pick<
  PerfilIdoso,
  'grau' | 'necessidades' | 'preferencias' | 'quarto' | 'local' | 'raioKm' | 'orcamentoMax' | 'urgencia' | 'precisaAcordoSS'
>

export function avaliarLar(lar: Lar, perfil: PerfilMatch): MatchResult {
  const razoes: Razao[] = []
  let compativel = true

  // 1. Grau de dependência (eliminatório)
  if (!lar.graus.includes(perfil.grau)) {
    compativel = false
    razoes.push({ tipo: 'falta', texto: `Não admite pessoas com ${GRAU_LABEL[perfil.grau].toLowerCase()}` })
  }

  // 2. Cuidados de saúde (críticos valem o dobro)
  let cuidadosScore = 1
  if (perfil.necessidades.length) {
    let peso = 0
    let ganho = 0
    for (const n of perfil.necessidades) {
      const critico = CUIDADOS_CRITICOS.includes(n)
      const w = critico ? 2 : 1
      peso += w
      if (lar.cuidados.includes(n)) {
        ganho += w
        razoes.push({ tipo: 'ok', texto: CUIDADO_LABEL[n] })
      } else {
        if (critico) compativel = false
        razoes.push({ tipo: 'falta', texto: `Sem ${CUIDADO_LABEL[n].toLowerCase()}` })
      }
    }
    cuidadosScore = ganho / peso
  }

  // 3. Orçamento
  const precoRef = precoReferencia(lar, perfil.quarto)
  let orcamentoScore: number
  if (precoRef <= perfil.orcamentoMax) {
    orcamentoScore = 1
    razoes.push({ tipo: 'ok', texto: `Dentro do orçamento (desde ${euro(precoRef)}/mês)` })
  } else {
    const excesso = (precoRef - perfil.orcamentoMax) / Math.max(1, perfil.orcamentoMax)
    orcamentoScore = Math.max(0, 1 - excesso / 0.3)
    razoes.push({
      tipo: excesso <= 0.15 ? 'parcial' : 'falta',
      texto: `Acima do orçamento: desde ${euro(precoRef)}/mês`,
    })
  }
  if (perfil.precisaAcordoSS) {
    if (lar.acordoSS) {
      razoes.push({ tipo: 'ok', texto: 'Tem vagas com acordo da Segurança Social' })
    } else {
      orcamentoScore *= 0.5
      razoes.push({ tipo: 'falta', texto: 'Sem acordo com a Segurança Social' })
    }
  }

  // 4. Distância
  const distanciaKm = distanceKm(perfil.local, lar)
  const raio = Math.max(1, perfil.raioKm)
  let distanciaScore: number
  if (distanciaKm <= raio) {
    distanciaScore = 1 - 0.4 * (distanciaKm / raio)
    razoes.push({ tipo: 'ok', texto: `A ${km(distanciaKm)} de ${perfil.local.label}` })
  } else {
    distanciaScore = Math.max(0, 0.6 * (1 - (distanciaKm - raio) / raio))
    razoes.push({ tipo: distanciaKm <= raio * 1.5 ? 'parcial' : 'falta', texto: `A ${km(distanciaKm)} (fora do raio de ${raio} km)` })
  }

  // 5. Disponibilidade vs. urgência
  const espera = estimarEspera(lar)
  const disp = disponibilidade(lar, espera)
  const tabela: Record<typeof disp, Record<PerfilIdoso['urgencia'], number>> = {
    disponivel: { imediata: 1, '1-3meses': 1, '3-6meses': 1, planeamento: 1 },
    breve: { imediata: 0.45, '1-3meses': 0.8, '3-6meses': 0.95, planeamento: 1 },
    espera: { imediata: 0.1, '1-3meses': 0.3, '3-6meses': 0.55, planeamento: 0.85 },
  }
  const dispScore = tabela[disp][perfil.urgencia]
  if (disp === 'disponivel') razoes.push({ tipo: 'ok', texto: 'Tem vaga disponível agora' })
  else if (disp === 'breve') razoes.push({ tipo: 'parcial', texto: 'Vaga prevista nos próximos meses' })
  else razoes.push({ tipo: perfil.urgencia === 'planeamento' ? 'parcial' : 'falta', texto: 'Lista de espera longa' })

  // 6. Preferências (comodidades + tipo de quarto)
  let prefScore = 1
  const prefs = perfil.preferencias
  const querQuarto = perfil.quarto !== 'indiferente'
  const total = prefs.length + (querQuarto ? 1 : 0)
  if (total > 0) {
    let ok = 0
    for (const c of prefs) {
      if (lar.comodidades.includes(c)) {
        ok++
        razoes.push({ tipo: 'ok', texto: COMODIDADE_LABEL[c] })
      } else {
        razoes.push({ tipo: 'parcial', texto: `Sem ${COMODIDADE_LABEL[c].toLowerCase()}` })
      }
    }
    if (querQuarto) {
      const q = perfil.quarto as TipoQuarto
      if (lar.quartos.some((r) => r.tipo === q)) {
        ok++
        razoes.push({ tipo: 'ok', texto: `Tem quarto ${QUARTO_CURTO[q].toLowerCase()}` })
      } else {
        razoes.push({ tipo: 'parcial', texto: `Sem quarto ${QUARTO_CURTO[q].toLowerCase()}` })
      }
    }
    prefScore = ok / total
  }

  const parcelas = {
    cuidados: cuidadosScore * PESOS.cuidados,
    orcamento: orcamentoScore * PESOS.orcamento,
    distancia: distanciaScore * PESOS.distancia,
    disponibilidade: dispScore * PESOS.disponibilidade,
    preferencias: prefScore * PESOS.preferencias,
  }
  let score = Object.values(parcelas).reduce((a, b) => a + b, 0)
  if (!compativel) score = Math.min(score, 35)

  // ordenar razões: ok primeiro, depois parcial, depois falta
  const ordem: Record<TipoRazao, number> = { ok: 0, parcial: 1, falta: 2 }
  razoes.sort((a, b) => ordem[a.tipo] - ordem[b.tipo])

  return {
    larId: lar.id,
    score: Math.round(score),
    compativel,
    distanciaKm,
    precoRef,
    parcelas,
    razoes,
    espera,
  }
}

/** Avalia e ordena todas as instituições; descarta as muito longe (> 3× raio). */
export function recomendar(lares: Lar[], perfil: PerfilMatch, limite = 30): MatchResult[] {
  return lares
    .filter((l) => l.tipo !== 'centro_dia')
    .map((l) => avaliarLar(l, perfil))
    .filter((m) => m.distanciaKm <= Math.max(perfil.raioKm * 3, 25))
    .sort((a, b) => Number(b.compativel) - Number(a.compativel) || b.score - a.score)
    .slice(0, limite)
}

export const scoreLabel = (s: number) =>
  s >= 85 ? 'Excelente compatibilidade' : s >= 70 ? 'Boa compatibilidade' : s >= 50 ? 'Compatibilidade razoável' : 'Pouco compatível'
