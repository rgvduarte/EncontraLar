/**
 * Cálculos da página inicial. Todos os números e exemplos da página vêm daqui, a partir do store —
 * nada de estatísticas escritas à mão.
 */
import type { Distrito, Lar } from '@/types'
import { disponibilidade, estimarEspera, vagaParaNovos, type EstimativaEspera } from '@/lib/forecast'
import { avaliarLar, type MatchResult, type Razao } from '@/lib/matching'
import { resumoDisponibilidade } from '@/lib/acesso'
import { COMODIDADE_FALTA, COMODIDADE_LABEL, CUIDADO_FRASE, CUIDADO_LABEL } from '@/lib/labels'
import { distanceKm } from '@/lib/geo'
import { LUGARES, type LugarPesquisa } from '@/data/localidades'
import { DEMO_LAR_ID } from '@/data/seed'
import { MIN_AGREGADO } from '@/lib/acesso'

/** Vaga para quem pede hoje (um lugar livre que a lista de espera vai ocupar não conta). */
export const temVaga = (l: Lar) => vagaParaNovos(l)

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

// ————————————————————————————————————————— versão grátis (só agregados: o "quantas", nunca o "quais")

/** O limite das contagens agregadas é um só, em @/lib/acesso (aqui reexportado para a página inicial). */
export { MIN_AGREGADO }

/** Quantos lares e residências têm vaga agora (sem dizer quais). */
export function contarComVaga(lares: Lar[]): number {
  return resumoDisponibilidade(lares.filter(residencial)).comVaga
}

export interface VagasDistrito {
  distrito: Distrito
  /** lares e residências do distrito com vaga para quem pede hoje */
  comVaga: number
  total: number
  /** latitude média das instituições do distrito (para ordenar as etiquetas de norte para sul) */
  lat: number
}

/**
 * Os `n` distritos com mais lares e residências com vaga agora (em empate, onde há mais instituições).
 * Para as etiquetas do mapa na versão grátis: devolve só contagens, nenhuma instituição. Ficam de fora os
 * distritos com menos de `MIN_AGREGADO` casas e aqueles em que todas têm vaga (aí a contagem diria quais).
 */
export function vagasPorDistrito(lares: Lar[], n = 3): VagasDistrito[] {
  const grupos = new Map<Distrito, Lar[]>()
  for (const l of lares) {
    if (!residencial(l)) continue
    const g = grupos.get(l.distrito)
    if (g) g.push(l)
    else grupos.set(l.distrito, [l])
  }
  return [...grupos]
    .map(([distrito, ls]) => {
      const { comVaga, total } = resumoDisponibilidade(ls)
      return { distrito, comVaga, total, lat: ls.reduce((s, l) => s + l.lat, 0) / ls.length }
    })
    .filter((d) => d.total >= MIN_AGREGADO && d.comVaga > 0 && d.comVaga < d.total)
    .sort((a, b) => b.comVaga - a.comVaga || b.total - a.total || a.distrito.localeCompare(b.distrito, 'pt'))
    .slice(0, n)
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

/**
 * A instituição da história "Como funciona" na versão grátis. Escolhida sem olhar para as vagas (ao contrário de
 * `escolherPrevisao`, que procura uma sem vaga hoje): a escolha em si não diz nada sobre a disponibilidade.
 */
export function escolherHistoriaGratis(lares: Lar[]): Lar | null {
  return escolherFichaPrecos(lares) ?? lares.find(residencial) ?? null
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

/**
 * Razões do exemplo que a versão grátis pode mostrar: só os cuidados e as comodidades pedidos no perfil
 * (o que a ficha grátis também mostra). Ficam de fora o preço, a distância e a disponibilidade.
 */
export function razoesGratis({ match, lugar }: ExemploMatch): Razao[] {
  const perfil = perfilExemplo(lugar)
  const permitidas = new Set<string>([
    ...perfil.necessidades.flatMap((n) => [CUIDADO_LABEL[n], `Sem ${CUIDADO_FRASE[n]}`]),
    ...perfil.preferencias.flatMap((c) => [COMODIDADE_LABEL[c], COMODIDADE_FALTA[c]]),
  ])
  return match.razoes.filter((r) => permitidas.has(r.texto))
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
