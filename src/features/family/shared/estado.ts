import {
  Ban,
  BellRing,
  CircleCheckBig,
  CircleX,
  ListOrdered,
  ScanSearch,
  Send,
  type LucideIcon,
} from 'lucide-react'
import type { Candidatura, EstadoCandidatura, Lar, PerfilIdoso, RoomOffer } from '@/types'
import type { BadgeTone } from '@/components/ui/Badge'
import { estimarEspera, type EstimativaEspera } from '@/lib/forecast'
import { diaPorExtenso } from './text'

export const ESTADO_META: Record<EstadoCandidatura, { tone: BadgeTone; icon: LucideIcon; passo: number | null }> = {
  enviada: { tone: 'neutral', icon: Send, passo: 0 },
  em_analise: { tone: 'pine', icon: ScanSearch, passo: 1 },
  lista_espera: { tone: 'dusk', icon: ListOrdered, passo: 2 },
  vaga_proposta: { tone: 'terra', icon: BellRing, passo: 3 },
  aceite: { tone: 'leaf', icon: CircleCheckBig, passo: 4 },
  recusada: { tone: 'alert', icon: CircleX, passo: null },
  cancelada: { tone: 'neutral', icon: Ban, passo: null },
}

/** As "estações" de um pedido, da inscrição à entrada. */
export const PASSOS = ['Pedido enviado', 'Em análise', 'Lista de espera', 'Vaga proposta', 'Entrada'] as const

export const TERMINADOS: EstadoCandidatura[] = ['recusada', 'cancelada']
export const isAtiva = (c: Pick<Candidatura, 'estado'>) => !TERMINADOS.includes(c.estado)

const PRIORIDADE: Record<EstadoCandidatura, number> = {
  vaga_proposta: 0,
  aceite: 1,
  lista_espera: 2,
  em_analise: 3,
  enviada: 4,
  recusada: 5,
  cancelada: 6,
}

/** Vagas propostas primeiro; depois por atualização mais recente. */
export function ordenarPedidos(cs: Candidatura[]): Candidatura[] {
  return [...cs].sort((a, b) => PRIORIDADE[a.estado] - PRIORIDADE[b.estado] || b.atualizadaEm.localeCompare(a.atualizadaEm))
}

/** O que acontece a seguir, em linguagem simples. */
export function proximoPasso(c: Candidatura): string | null {
  switch (c.estado) {
    case 'enviada':
      return 'A equipa técnica vai analisar o perfil e pode telefonar-lhe para conhecer melhor a situação.'
    case 'em_analise':
      return 'A instituição decide se inscreve na lista de espera ou se propõe já uma vaga.'
    case 'lista_espera':
      return 'Quando chegar a vez, a instituição propõe a vaga e tem 48 horas para responder. Avisamos de imediato.'
    case 'vaga_proposta':
      return c.prazoResposta ? `Responda até ${diaPorExtenso(new Date(c.prazoResposta))}, às ${horaDe(c.prazoResposta)}.` : 'Responda à instituição o mais depressa possível.'
    case 'aceite':
      return 'Combine com a instituição a data de entrada e a documentação a entregar.'
    default:
      return null
  }
}

export const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

/** Quarto que a instituição provavelmente propõe (mesma lógica do store ao aceitar). */
export function quartoProposto(lar: Lar, perfil: PerfilIdoso): RoomOffer | undefined {
  const pref = perfil.quarto !== 'indiferente' ? perfil.quarto : null
  return lar.quartos.find((q) => q.tipo === pref && q.livres > 0) ?? lar.quartos.find((q) => q.livres > 0) ?? lar.quartos.find((q) => q.tipo === pref)
}

/** Intervalo otimista–prudente em linguagem simples: "até 1 mês", "3 a 6 meses", "8 meses a mais de 2 anos". */
export function intervalo(diasMin: number, diasMax: number): string {
  if (diasMax <= 21) return 'nas próximas semanas'
  const a = Math.round(diasMin / 30)
  const b = Math.max(a + 1, Math.round(diasMax / 30))
  if (b > 24) return a < 1 ? 'menos de 1 mês a mais de 2 anos' : `${a} ${a === 1 ? 'mês' : 'meses'} a mais de 2 anos`
  if (a < 1) return `até ${b} ${b === 1 ? 'mês' : 'meses'}`
  return `${a} a ${b} meses`
}

export interface EstimativaPessoal {
  est: EstimativaEspera
  /** "2 a 7 meses", "desde já", "mais de 2 anos" */
  texto: string
  /** true quando usa a posição real na lista */
  pessoal: boolean
}

/** Estimativa com a posição na lista (quando existe) ou como se entrasse hoje no fim da lista. */
export function estimativaPessoal(lar: Lar, posicao?: number): EstimativaPessoal {
  const est = estimarEspera(lar, posicao != null ? { posicao } : {})
  let texto: string
  if (est.imediata) texto = 'vaga possível desde já'
  else if (est.diasOtimista == null) texto = 'mais de 2 anos'
  else texto = intervalo(est.diasOtimista, est.diasPessimista ?? 800)
  return { est, texto, pessoal: posicao != null }
}
