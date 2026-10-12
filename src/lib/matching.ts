/**
 * Motor de compatibilidade entre o perfil da pessoa idosa e cada instituição.
 * Pontuação 0–100 com pesos explícitos e razões legíveis (para transparência perante a família).
 */
import type { Disponibilidade, Lar, PerfilIdoso, TipoQuarto } from '@/types'
import { CUIDADOS_CRITICOS, CUIDADO_FRASE, CUIDADO_LABEL, COMODIDADE_FALTA, COMODIDADE_LABEL, GRAU_PESSOAS } from './labels'
import { distanceKm } from './geo'
import { estimarEspera, vagaParaNovos, vagasLivres, type EstimativaEspera } from './forecast'
import { euro, km } from './format'

export const PESOS = {
  cuidados: 35,
  orcamento: 20,
  distancia: 20,
  disponibilidade: 15,
  preferencias: 10,
} as const

const QUARTO_FRASE: Record<TipoQuarto, string> = {
  individual: 'quarto individual',
  duplo: 'quarto duplo',
  casal: 'quarto de casal',
}

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
    razoes.push({ tipo: 'falta', texto: `Não admite ${GRAU_PESSOAS[perfil.grau]}` })
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
        razoes.push({ tipo: 'falta', texto: `Sem ${CUIDADO_FRASE[n]}` })
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
    // muito acima do orçamento (> 50%) não é uma opção realista para a família
    if (excesso > 0.5) compativel = false
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
    razoes.push({ tipo: 'ok', texto: `A ${km(distanciaKm)} de distância` })
  } else {
    distanciaScore = Math.max(0, 0.6 * (1 - (distanciaKm - raio) / raio))
    razoes.push({ tipo: distanciaKm <= raio * 1.5 ? 'parcial' : 'falta', texto: `A ${km(distanciaKm)} (fora do raio de ${raio} km)` })
  }

  // 5. Disponibilidade vs. urgência — conta a vaga para quem pede hoje, não só os lugares livres:
  // um lugar livre que a lista de espera vai ocupar não serve a quem tem alta hospitalar amanhã.
  const espera = estimarEspera(lar)
  const imediata = vagaParaNovos(lar, espera)
  const dispEf: Disponibilidade = imediata ? 'disponivel' : espera.p90 >= 0.5 ? 'breve' : 'espera'
  const tabela: Record<Disponibilidade, Record<PerfilIdoso['urgencia'], number>> = {
    disponivel: { imediata: 1, '1-3meses': 1, '3-6meses': 1, planeamento: 1 },
    breve: { imediata: 0.45, '1-3meses': 0.8, '3-6meses': 0.95, planeamento: 1 },
    espera: { imediata: 0.1, '1-3meses': 0.3, '3-6meses': 0.55, planeamento: 0.85 },
  }
  const dispScore = tabela[dispEf][perfil.urgencia]
  const tipoEspera: TipoRazao = dispEf === 'breve' || perfil.urgencia === 'planeamento' ? 'parcial' : 'falta'
  if (imediata) razoes.push({ tipo: 'ok', texto: 'Tem vaga disponível agora' })
  else if (vagasLivres(lar) > 0) razoes.push({ tipo: tipoEspera, texto: 'Tem lugar livre, mas a lista de espera tem prioridade' })
  else if (dispEf === 'breve') razoes.push({ tipo: 'parcial', texto: 'Vaga prevista nos próximos meses' })
  else razoes.push({ tipo: tipoEspera, texto: 'Lista de espera longa' })

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
        razoes.push({ tipo: 'parcial', texto: COMODIDADE_FALTA[c] })
      }
    }
    if (querQuarto) {
      const q = perfil.quarto as TipoQuarto
      if (lar.quartos.some((r) => r.tipo === q)) {
        ok++
        razoes.push({ tipo: 'ok', texto: `Tem ${QUARTO_FRASE[q]}` })
      } else {
        razoes.push({ tipo: 'parcial', texto: `Sem ${QUARTO_FRASE[q]}` })
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
