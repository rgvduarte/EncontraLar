/**
 * Cálculos da página inicial. Todos os números e exemplos da página vêm daqui, a partir do store —
 * nada de estatísticas escritas à mão.
 */
import type { Distrito, Lar } from '@/types'
import { disponibilidade, estimarEspera, vagasLivres, type EstimativaEspera } from '@/lib/forecast'
import { avaliarLar, type MatchResult } from '@/lib/matching'
import { distanceKm } from '@/lib/geo'
import { LUGARES, type LugarPesquisa } from '@/data/localidades'
import { DEMO_LAR_ID } from '@/data/seed'

export const temVaga = (l: Lar) => vagasLivres(l) > 0

/** Lares e residências (os centros de dia não têm "vaga" no mesmo sentido). */
const residencial = (l: Lar) => l.tipo !== 'centro_dia'

const maisRecente = (a: Lar, b: Lar) => b.atualizadoEm.localeCompare(a.atualizadoEm)

// ————————————————————————————————————————— números

export interface HomeStats {
  total: number
  comVaga: number
  /** distritos e regiões autónomas com pelo menos uma instituição */
  distritos: number
  verificadas: number
}

export function calcularStats(lares: Lar[]): HomeStats {
  const distritos = new Set<Distrito>()
  let comVaga = 0
  let verificadas = 0
  for (const l of lares) {
    distritos.add(l.distrito)
    if (temVaga(l)) comVaga++
    if (l.verificacao.estado === 'verificado') verificadas++
  }
  return { total: lares.length, comVaga, distritos: distritos.size, verificadas }
}

/** "agora", "há 12 min", "há 3 h", "há 2 dias" — versão curta para etiquetas pequenas. */
export function tempoCurto(iso: string, agora = Date.now()): string {
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? 'ontem' : `há ${d} dias`
}

// ————————————————————————————————————————— vagas

/** As vagas atualizadas mais recentemente (para as etiquetas à volta do mapa). */
export function ultimasVagas(lares: Lar[], n = 3): Lar[] {
  return lares.filter((l) => residencial(l) && temVaga(l)).sort(maisRecente).slice(0, n)
}

/** "Com vaga agora": verificadas primeiro, depois as que atualizaram as vagas há menos tempo. */
export function comVagaAgora(lares: Lar[], limite = 12): Lar[] {
  return lares
    .filter((l) => residencial(l) && temVaga(l))
    .sort(
      (a, b) =>
        Number(b.verificacao.estado === 'verificado') - Number(a.verificacao.estado === 'verificado') || maisRecente(a, b),
    )
    .slice(0, limite)
}

// ————————————————————————————————————————— exemplos reais para a grelha

export interface PrevisaoDestaque {
  lar: Lar
  est: EstimativaEspera
}

/**
 * Uma instituição real sem vaga hoje mas com vaga prevista em breve, cuja curva conta uma boa história:
 * incerta no primeiro mês e provável ao fim de alguns meses.
 */
export function escolherPrevisao(lares: Lar[]): PrevisaoDestaque | null {
  let melhor: PrevisaoDestaque | null = null
  let melhorScore = -Infinity
  for (const lar of lares) {
    if (!residencial(lar) || temVaga(lar) || lar.listaEspera < 3) continue
    const est = estimarEspera(lar)
    if (est.imediata || disponibilidade(lar, est) !== 'breve') continue
    const c = est.curva
    let s = 0
    if (lar.verificacao.estado === 'verificado') s += 2
    if (lar.tipo === 'erpi') s += 1
    s -= Math.abs((c[0] ?? 0) - 0.3) * 4
    s -= Math.abs((c[2] ?? 0) - 0.7) * 3
    s -= Math.max(0, 0.9 - (c[5] ?? 0)) * 5
    s += Math.min(lar.numAvaliacoes, 40) / 40
    if (s > melhorScore) {
      melhorScore = s
      melhor = { lar, est }
    }
  }
  return melhor
}

/** Uma ficha verificada com vários tipos de quarto — de preferência a instituição de demonstração. */
export function escolherFichaPrecos(lares: Lar[]): Lar | null {
  const serve = (l: Lar) => residencial(l) && l.verificacao.estado === 'verificado' && l.quartos.length >= 2
  const demo = lares.find((l) => l.id === DEMO_LAR_ID)
  if (demo && serve(demo)) return demo
  return lares.filter(serve).sort((a, b) => b.numAvaliacoes - a.numAvaliacoes)[0] ?? null
}

/** Perfil fictício usado para mostrar a compatibilidade (identificado como exemplo na página). */
function perfilExemplo(lugar: LugarPesquisa) {
  return {
    grau: 'moderada' as const,
    necessidades: ['demencia' as const, 'fisioterapia' as const],
    preferencias: ['jardim' as const],
    quarto: 'individual' as const,
    local: { label: lugar.label, lat: lugar.lat, lng: lugar.lng },
    raioKm: 15,
    orcamentoMax: 2000,
    urgencia: '1-3meses' as const,
    precisaAcordoSS: false,
  }
}

export interface ExemploMatch {
  lar: Lar
  match: MatchResult
  lugar: LugarPesquisa
}

/** A melhor correspondência compatível para o perfil de exemplo, perto da primeira cidade que tenha uma. */
export function exemploCompatibilidade(lares: Lar[]): ExemploMatch | null {
  for (const nome of ['Porto', 'Lisboa', 'Braga', 'Coimbra']) {
    const lugar = LUGARES.find((l) => l.label === nome)
    if (!lugar) continue
    const perfil = perfilExemplo(lugar)
    let melhor: ExemploMatch | null = null
    for (const lar of lares) {
      if (!residencial(lar) || distanceKm(lugar, lar) > perfil.raioKm) continue
      const match = avaliarLar(lar, perfil)
      if (match.compativel && (!melhor || match.score > melhor.match.score)) melhor = { lar, match, lugar }
    }
    if (melhor && melhor.match.score >= 70) return melhor
  }
  return null
}
