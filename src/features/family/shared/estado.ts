/**
 * Regras de apresentação dos pedidos de vaga (candidaturas) no painel da família.
 */
import type { Candidatura, EstadoCandidatura, Lar, PerfilIdoso, RoomOffer } from '@/types'
import { estimarEspera, type EstimativaEspera } from '@/lib/forecast'
import { dataLocal } from '@/lib/format'
import { diaPorExtenso } from './text'

/** Cor do ponto de estado — sempre acompanhado do texto do estado. Só os momentos-chave têm cor. */
export const ESTADO_DOT: Record<EstadoCandidatura, string> = {
  enviada: 'bg-dusk-500',
  em_analise: 'bg-dusk-500',
  lista_espera: 'bg-dusk-500',
  vaga_proposta: 'bg-terra-600',
  aceite: 'bg-leaf-500',
  admitida: 'bg-leaf-500',
  recusada: 'bg-line-strong',
  cancelada: 'bg-line-strong',
}

export const TERMINADOS: EstadoCandidatura[] = ['recusada', 'cancelada']
/** Não terminado: inclui "admitida" (fim feliz), que não vai para "Terminados". */
export const isAtiva = (c: Pick<Candidatura, 'estado'>) => !TERMINADOS.includes(c.estado)
/** Ainda à procura: ativo e sem entrada. */
export const emCurso = (c: Pick<Candidatura, 'estado'>) => isAtiva(c) && c.estado !== 'admitida'

/** A família já confirmou a entrada ("Já entrou"). */
export const familiaConfirmou = (c: Pick<Candidatura, 'entrada'>) => Boolean(c.entrada?.confirmadaFamiliaEm)
/** A instituição registou a entrada e falta a confirmação da família. */
export const entradaPorConfirmar = (c: Pick<Candidatura, 'estado' | 'entrada'>) =>
  c.estado === 'admitida' && Boolean(c.entrada?.confirmadaLarEm) && !c.entrada?.confirmadaFamiliaEm

/**
 * Ordem no painel: o que pede resposta primeiro (vaga proposta, entrada registada por confirmar),
 * depois a vaga aceite e os pedidos à espera. A entrada já confirmada é um fim feliz: fica no fim
 * dos ativos, sem insistir; os terminados vêm por último.
 */
function prioridade(c: Candidatura): number {
  switch (c.estado) {
    case 'vaga_proposta':
      return 0
    case 'admitida':
      return entradaPorConfirmar(c) ? 1 : 6
    case 'aceite':
      return 2
    case 'lista_espera':
      return 3
    case 'em_analise':
      return 4
    case 'enviada':
      return 5
    case 'recusada':
      return 7
    case 'cancelada':
      return 8
  }
}

/** Primeiro o que pede resposta; depois por atualização mais recente. */
export function ordenarPedidos(cs: Candidatura[]): Candidatura[] {
  return [...cs].sort((a, b) => prioridade(a) - prioridade(b) || b.atualizadaEm.localeCompare(a.atualizadaEm))
}

/** "9 de outubro" (com o ano quando não é o atual) a partir de "AAAA-MM-DD". */
export function diaMes(ymd: string, agora = new Date()): string {
  const d = dataLocal(ymd)
  return d.toLocaleDateString('pt-PT', d.getFullYear() === agora.getFullYear() ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' })
}

export const horaDe = (iso: string) => new Date(iso).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

/** O que acontece a seguir, numa frase. */
export function proximoPasso(c: Candidatura): string | null {
  switch (c.estado) {
    case 'enviada':
      return 'Se a instituição aceitar o pedido, passa a ver os seus contactos e pode telefonar-lhe.'
    case 'em_analise':
      return 'A instituição decide se inscreve na lista de espera ou se propõe já uma vaga.'
    case 'lista_espera':
      return 'Quando chegar a vez, recebe a proposta de vaga e tem 48 horas para responder.'
    case 'vaga_proposta':
      return c.prazoResposta
        ? `Responder até ${diaPorExtenso(new Date(c.prazoResposta))}, às ${horaDe(c.prazoResposta)}.`
        : 'Responder à instituição o mais depressa possível.'
    case 'aceite':
      return 'Combinar com a instituição o dia de entrada e a documentação.'
    case 'admitida':
      return entradaPorConfirmar(c) ? 'Confirmar a entrada aqui no painel.' : null
    default:
      return null
  }
}

/** Quarto que a instituição provavelmente propõe (mesma lógica do store ao aceitar). */
export function quartoProposto(lar: Lar, perfil: PerfilIdoso): RoomOffer | undefined {
  const pref = perfil.quarto !== 'indiferente' ? perfil.quarto : null
  return (
    lar.quartos.find((q) => q.tipo === pref && q.livres > 0) ??
    lar.quartos.find((q) => q.livres > 0) ??
    lar.quartos.find((q) => q.tipo === pref)
  )
}

/** Intervalo otimista–prudente: "nas próximas semanas", "até 2 meses", "3 a 6 meses", "8 meses a mais de 2 anos". */
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
  /** "até 2 meses", "3 a 6 meses", "já há lugar", "mais de 2 anos" */
  texto: string
  /** true quando usa a posição real na lista */
  pessoal: boolean
}

/** Estimativa com a posição na lista (quando existe) ou como se entrasse hoje no fim da lista. */
export function estimativaPessoal(lar: Lar, posicao?: number): EstimativaPessoal {
  const est = estimarEspera(lar, posicao != null ? { posicao } : {})
  let texto: string
  if (est.imediata) texto = 'já há lugar'
  else if (est.diasOtimista == null) texto = 'mais de 2 anos'
  else texto = intervalo(est.diasOtimista, est.diasPessimista ?? 800)
  return { est, texto, pessoal: posicao != null }
}

/** Género e número do nome de uma instituição: "as Residências…", "a Casa…", "o Lar…" (masculino por omissão). */
function generoLar(nome: string): 'f' | 'fp' | 'm' {
  if (/^Residências\b/.test(nome)) return 'fp'
  if (/^(Casa|Residência|Quinta|Santa Casa|Fundação|Associação|Instituição|Misericórdia|Unidade|Vila)\b/.test(nome)) return 'f'
  return 'm'
}

const contrair = (formas: Record<'f' | 'fp' | 'm', string>) => (nome: string) => `${formas[generoLar(nome)]} ${nome}`

/** Contração "em" + artigo para nomes de instituições: "na Casa…", "no Lar…", "nas Residências…". */
export const emLar = contrair({ fp: 'nas', f: 'na', m: 'no' })
/** "a" + artigo: "ao Lar…", "à Casa…", "às Residências…". */
export const aoLar = contrair({ fp: 'às', f: 'à', m: 'ao' })
/** "de" + artigo: "do Lar…", "da Casa…", "das Residências…". */
export const doLar = contrair({ fp: 'das', f: 'da', m: 'do' })
/** Só o artigo: "o Lar…", "a Casa…", "as Residências…". */
export const oLar = contrair({ fp: 'as', f: 'a', m: 'o' })
