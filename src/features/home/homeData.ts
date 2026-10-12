/**
 * Cálculos da página inicial. Tudo o que aparece como número ou exemplo na página vem daqui,
 * a partir do store — nada de estatísticas escritas à mão.
 */
import type { Distrito, Lar, Regiao } from '@/types'
import { disponibilidade, estimarEspera, vagasLivres, type EstimativaEspera } from '@/lib/forecast'
import { avaliarLar, type MatchResult } from '@/lib/matching'
import { distanceKm } from '@/lib/geo'
import { LUGARES, type LugarPesquisa } from '@/data/localidades'
import { DEMO_LAR_ID } from '@/data/seed'

const HORA = 3_600_000

export const temVaga = (l: Lar) => vagasLivres(l) > 0

// ————————————————————————————————————————— números do topo

export interface HomeStats {
  total: number
  comVaga: number
  /** distritos e regiões autónomas com pelo menos uma instituição */
  distritos: number
  /** ISO da atualização de vagas mais recente */
  ultima: string | null
  /** fichas com vagas confirmadas nas últimas 48 horas */
  atualizadas48h: number
  verificadas: number
  /** pessoas inscritas em listas de espera (soma) */
  listaEspera: number
  /** visitas a fichas nos últimos 30 dias (soma) */
  visualizacoes: number
  /** mensalidade média de referência (média dos preços por tipo de quarto) */
  mensalidadeMedia: number
}

export function calcularStats(lares: Lar[], agora = Date.now()): HomeStats {
  let comVaga = 0
  let atualizadas48h = 0
  let verificadas = 0
  let listaEspera = 0
  let visualizacoes = 0
  let ultima: string | null = null
  let somaPreco = 0
  let nPreco = 0
  const distritos = new Set<Distrito>()
  for (const l of lares) {
    if (temVaga(l)) comVaga++
    if (agora - new Date(l.atualizadoEm).getTime() <= 48 * HORA) atualizadas48h++
    if (l.verificacao.estado === 'verificado') verificadas++
    listaEspera += l.listaEspera
    visualizacoes += l.visualizacoes30d
    distritos.add(l.distrito)
    if (!ultima || l.atualizadoEm > ultima) ultima = l.atualizadoEm
    if (l.tipo !== 'centro_dia') {
      for (const q of l.quartos) {
        somaPreco += (q.precoMin + q.precoMax) / 2
        nPreco++
      }
    }
  }
  return {
    total: lares.length,
    comVaga,
    distritos: distritos.size,
    ultima,
    atualizadas48h,
    verificadas,
    listaEspera,
    visualizacoes,
    mensalidadeMedia: nPreco ? somaPreco / nPreco : 0,
  }
}

/** "agora", "12 min", "3 h", "2 dias" — para numerais grandes. */
export function tempoCurto(iso: string | null, agora = Date.now()): string {
  if (!iso) return '—'
  const min = Math.max(0, Math.round((agora - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  const d = Math.round(h / 24)
  return d === 1 ? '1 dia' : `${d} dias`
}

// ————————————————————————————————————————— regiões e distritos

export type RegiaoTabId = 'norte' | 'centro' | 'lvt' | 'alentejo' | 'algarve' | 'ilhas'

export const REGIAO_TABS: { id: RegiaoTabId; label: string; curto: string; regioes: Regiao[] }[] = [
  { id: 'norte', label: 'Norte', curto: 'Norte', regioes: ['Norte'] },
  { id: 'centro', label: 'Centro', curto: 'Centro', regioes: ['Centro'] },
  { id: 'lvt', label: 'Lisboa e Vale do Tejo', curto: 'Lisboa e V. Tejo', regioes: ['Lisboa e Vale do Tejo'] },
  { id: 'alentejo', label: 'Alentejo', curto: 'Alentejo', regioes: ['Alentejo'] },
  { id: 'algarve', label: 'Algarve', curto: 'Algarve', regioes: ['Algarve'] },
  { id: 'ilhas', label: 'Ilhas', curto: 'Ilhas', regioes: ['Madeira', 'Açores'] },
]

/** Agrupamento de apresentação dos distritos (de norte para sul, ilhas no fim). */
export const GRUPOS_DISTRITO: { grupo: string; distritos: Distrito[] }[] = [
  { grupo: 'Norte', distritos: ['Viana do Castelo', 'Braga', 'Porto', 'Vila Real', 'Bragança'] },
  { grupo: 'Centro', distritos: ['Aveiro', 'Viseu', 'Guarda', 'Coimbra', 'Leiria', 'Castelo Branco'] },
  { grupo: 'Lisboa e Vale do Tejo', distritos: ['Santarém', 'Lisboa', 'Setúbal'] },
  { grupo: 'Alentejo', distritos: ['Portalegre', 'Évora', 'Beja'] },
  { grupo: 'Algarve', distritos: ['Faro'] },
  { grupo: 'Regiões autónomas', distritos: ['Madeira', 'Açores'] },
]

export interface ContagemDistrito {
  distrito: Distrito
  total: number
  comVaga: number
  /** mensalidade mais baixa entre as instituições do distrito */
  desde: number | null
}

export function contarPorDistrito(lares: Lar[]): Map<Distrito, ContagemDistrito> {
  const m = new Map<Distrito, ContagemDistrito>()
  for (const l of lares) {
    const c = m.get(l.distrito) ?? { distrito: l.distrito, total: 0, comVaga: 0, desde: null }
    c.total++
    if (temVaga(l)) c.comVaga++
    if (l.mensalidadeMin > 0) c.desde = c.desde == null ? l.mensalidadeMin : Math.min(c.desde, l.mensalidadeMin)
    m.set(l.distrito, c)
  }
  return m
}

/** Instituições com vaga numa região: verificadas primeiro, depois as atualizadas mais recentemente. */
export function comVagaNaRegiao(lares: Lar[], regioes: Regiao[]): Lar[] {
  return lares
    .filter((l) => regioes.includes(l.regiao) && l.tipo !== 'centro_dia' && temVaga(l))
    .sort(
      (a, b) =>
        Number(b.verificacao.estado === 'verificado') - Number(a.verificacao.estado === 'verificado') ||
        b.atualizadoEm.localeCompare(a.atualizadoEm),
    )
}

// ————————————————————————————————————————— previsão em destaque

export interface PrevisaoDestaque {
  lar: Lar
  est: EstimativaEspera
}

/**
 * Escolhe uma instituição real sem vaga hoje mas com vaga prevista em breve, cuja curva conta uma boa
 * história: começa incerta no primeiro mês e torna-se provável ao fim de alguns meses.
 */
export function escolherPrevisao(lares: Lar[]): PrevisaoDestaque | null {
  let melhor: PrevisaoDestaque | null = null
  let melhorScore = -Infinity
  for (const lar of lares) {
    if (lar.tipo === 'centro_dia' || temVaga(lar) || lar.listaEspera < 3) continue
    const est = estimarEspera(lar)
    if (est.imediata) continue
    const c = est.curva
    let s = disponibilidade(lar, est) === 'breve' ? 5 : 0
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

// ————————————————————————————————————————— ficha de exemplo (transparência)

/** Uma ficha verificada e completa — de preferência a instituição de demonstração. */
export function escolherFichaExemplo(lares: Lar[]): Lar | null {
  const completa = (l: Lar) =>
    l.verificacao.estado === 'verificado' &&
    l.tipo === 'erpi' &&
    l.quartos.length >= 2 &&
    Boolean(l.verificacao.ultimaInspecao) &&
    l.equipa.cuidadoresPor10 > 0
  const demo = lares.find((l) => l.id === DEMO_LAR_ID)
  if (demo && completa(demo)) return demo
  return lares.filter(completa).sort((a, b) => b.numAvaliacoes - a.numAvaliacoes)[0] ?? null
}

// ————————————————————————————————————————— "Como funciona": exemplos reais

export const lugarPorNome = (label: string): LugarPesquisa | undefined => LUGARES.find((l) => l.label === label)

export interface ResultadoPerto {
  lar: Lar
  distancia: number
}

/** As instituições mais próximas de um lugar, com as que têm vaga primeiro. */
export function pertoDe(lares: Lar[], lugar: LugarPesquisa, limite = 3): ResultadoPerto[] {
  return lares
    .filter((l) => l.tipo !== 'centro_dia')
    .map((lar) => ({ lar, distancia: distanceKm(lugar, lar) }))
    .filter((r) => r.distancia <= lugar.raio)
    .sort((a, b) => Number(temVaga(b.lar)) - Number(temVaga(a.lar)) || a.distancia - b.distancia)
    .slice(0, limite)
}

/** Perfil fictício usado para mostrar como funciona a compatibilidade (identificado como exemplo na página). */
export function perfilExemplo(lugar: LugarPesquisa) {
  return {
    grau: 'moderada' as const,
    necessidades: ['demencia' as const, 'fisioterapia' as const],
    preferencias: ['jardim' as const],
    quarto: 'individual' as const,
    local: { label: lugar.label, lat: lugar.lat, lng: lugar.lng },
    raioKm: 15,
    orcamentoMax: 1900,
    urgencia: '1-3meses' as const,
    precisaAcordoSS: false,
  }
}

/** Melhor correspondência compatível para o perfil de exemplo (com razões legíveis). */
export function exemploCompatibilidade(lares: Lar[], lugar: LugarPesquisa): { lar: Lar; match: MatchResult } | null {
  const perfil = perfilExemplo(lugar)
  let melhor: { lar: Lar; match: MatchResult } | null = null
  for (const lar of lares) {
    if (lar.tipo === 'centro_dia') continue
    if (distanceKm(lugar, lar) > perfil.raioKm * 1.5) continue
    const match = avaliarLar(lar, perfil)
    if (!match.compativel) continue
    // queremos um exemplo honesto: bom, mas com pelo menos uma ressalva
    const temRessalva = match.razoes.some((r) => r.tipo !== 'ok')
    const score = match.score + (temRessalva ? 6 : 0)
    if (!melhor || score > melhor.match.score + (melhor.match.razoes.some((r) => r.tipo !== 'ok') ? 6 : 0)) {
      melhor = { lar, match }
    }
  }
  return melhor
}
