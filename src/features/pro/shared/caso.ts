/**
 * Regras de apresentação dos casos do profissional (assistente social): nomes abreviados, contagem até à alta,
 * resumo das respostas das instituições e a frase do perfil de cuidados.
 */
import type { Candidatura, Caso, EstadoCandidatura, EstadoCaso, PerfilIdoso, Urgencia } from '@/types'
import { diasAteAlta } from '@/lib/negocio'
import { dataLocal, euro, MESES_CURTOS, pertoDe } from '@/lib/format'
import { CUIDADO_FRASE, GRAU_LABEL, QUARTO_LABEL } from '@/lib/labels'

export const ESTADO_CASO_LABEL: Record<EstadoCaso, string> = {
  aberto: 'Aberto',
  colocado: 'Colocado',
  fechado: 'Fechado',
}

/** Pedidos que ainda ocupam a instituição (contam como "já enviado"; não se pode reenviar). */
export const ATIVOS: EstadoCandidatura[] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite', 'admitida']
/** Pedidos que o profissional pode cancelar a partir da linha da resposta. */
export const CANCELAVEIS: EstadoCandidatura[] = ['enviada', 'em_analise', 'lista_espera', 'aceite']
/** Ao colocar ou fechar o caso, estes pedidos deixam de fazer sentido: liberta-se a instituição. */
export const POR_LIBERTAR: EstadoCandidatura[] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta']

const PARTICULAS = new Set(['de', 'do', 'da', 'dos', 'das', 'e'])

/**
 * "José Barbosa" → "José B."; "Maria do Carmo Ferreira" → "Maria F."; "Albano" → "Albano".
 * Iniciais ("J. B.", "JB") ficam como estão.
 */
export function nomeAbreviado(nome: string): string {
  const limpo = nome.trim().replace(/\s+/g, ' ')
  if (!limpo) return 'Sem nome'
  const partes = limpo.split(' ').filter((p) => !PARTICULAS.has(p.toLowerCase()))
  // iniciais: tudo com 1–2 letras (com ou sem ponto)
  if (partes.every((p) => p.replace(/\./g, '').length <= 2)) return limpo
  const primeiro = partes[0]!
  if (partes.length < 2) return primeiro
  const ultimo = partes[partes.length - 1]!
  return `${primeiro} ${ultimo.charAt(0).toUpperCase()}.`
}

/** "José B., 90 anos" */
export const pessoaCurta = (p: Pick<PerfilIdoso, 'nome' | 'idade'>) => `${nomeAbreviado(p.nome)}, ${p.idade} anos`

/** "16 out." (data local AAAA-MM-DD) */
export function diaCurto(ymd: string): string {
  const d = dataLocal(ymd)
  return `${d.getDate()} ${MESES_CURTOS[d.getMonth()]}.`
}

/** "sexta-feira, 16 de outubro" a partir de AAAA-MM-DD (data local). */
export const diaLongo = (ymd: string) => dataLocal(ymd).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

/** "sexta-feira, 16 de outubro, às 14:00" a partir de um ISO. */
export function prazoTexto(iso: string): string {
  const d = new Date(iso)
  const dia = d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
  const hora = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
  return `${dia}, às ${hora}`
}

export interface Alta {
  /** "Alta em 4 dias", "Alta amanhã", "Alta prevista: 16 out.", "Sem data de alta" */
  texto: string
  /** "sexta-feira, 16 de outubro" (vazio sem data) */
  extenso: string
  dias: number | null
  /** caso aberto com alta daqui a 2 dias ou menos (ou já passada) */
  urgente: boolean
  passou: boolean
}

/** Contagem até à alta prevista, no vocabulário comum ('Alta em N dias' / 'Alta prevista: <dia>'). */
export function contagemAlta(altaPrevista: string | undefined, estado: EstadoCaso = 'aberto', agora = Date.now()): Alta {
  const dias = diasAteAlta(altaPrevista, agora)
  if (dias == null || !altaPrevista) return { texto: 'Sem data de alta', extenso: '', dias: null, urgente: false, passou: false }
  const extenso = diaLongo(altaPrevista)
  let texto: string
  if (dias < 0 || dias > 14) texto = `Alta prevista: ${diaCurto(altaPrevista)}`
  else if (dias === 0) texto = 'Alta hoje'
  else if (dias === 1) texto = 'Alta amanhã'
  else texto = `Alta em ${dias} dias`
  return { texto, extenso, dias, urgente: estado === 'aberto' && dias <= 2, passou: dias < 0 }
}

/** Urgência do perfil a partir da alta: quem tem alta próxima precisa de vaga já. */
export function urgenciaDaAlta(altaPrevista: string | undefined, agora = Date.now()): Urgencia {
  const d = diasAteAlta(altaPrevista, agora)
  if (d == null || d <= 30) return 'imediata'
  if (d <= 90) return '1-3meses'
  return '3-6meses'
}

const PARTES: { estado: EstadoCandidatura; um: string; varios: string }[] = [
  { estado: 'enviada', um: 'por abrir', varios: 'por abrir' },
  { estado: 'em_analise', um: 'em análise', varios: 'em análise' },
  { estado: 'lista_espera', um: 'em lista de espera', varios: 'em lista de espera' },
  { estado: 'aceite', um: 'vaga aceite', varios: 'vagas aceites' },
  { estado: 'admitida', um: 'entrou', varios: 'entraram' },
  { estado: 'recusada', um: 'recusou', varios: 'recusaram' },
]

export interface ResumoRespostas {
  /** "3 instituições · 1 em análise · 1 recusou" (ou "Ainda não enviado") */
  texto: string
  enviados: number
  /** pedidos com vaga proposta, prazo mais curto primeiro */
  propostas: Candidatura[]
}

/** Resumo das respostas de um caso, numa linha. */
export function resumirRespostas(cs: Candidatura[]): ResumoRespostas {
  const validos = cs.filter((c) => c.estado !== 'cancelada')
  const propostas = validos
    .filter((c) => c.estado === 'vaga_proposta')
    .sort((a, b) => (a.prazoResposta ?? '9').localeCompare(b.prazoResposta ?? '9'))
  if (!validos.length) return { texto: 'Ainda não enviado', enviados: 0, propostas }
  const contar = (e: EstadoCandidatura) => validos.filter((c) => c.estado === e).length
  const partes = [`${validos.length} ${validos.length === 1 ? 'instituição' : 'instituições'}`]
  for (const p of PARTES) {
    const n = contar(p.estado)
    // "por abrir" só quando é o único estado (senão a linha fica longa e diz pouco)
    if (!n || (p.estado === 'enviada' && n !== validos.length)) continue
    partes.push(`${n} ${n === 1 ? p.um : p.varios}`)
  }
  return { texto: partes.join(' · '), enviados: validos.length, propostas }
}

/** Abertos primeiro (alta mais próxima primeiro; sem data no fim); depois colocados e fechados, mais recentes primeiro. */
export function ordenarCasos<T extends Pick<Caso, 'estado' | 'altaPrevista' | 'atualizadoEm'>>(casos: T[]): T[] {
  return [...casos].sort((a, b) => {
    const ab = Number(a.estado !== 'aberto') - Number(b.estado !== 'aberto')
    if (ab) return ab
    if (a.estado === 'aberto') {
      const da = a.altaPrevista ?? '9999-99-99'
      const db = b.altaPrevista ?? '9999-99-99'
      if (da !== db) return da.localeCompare(db)
    }
    return b.atualizadoEm.localeCompare(a.atualizadoEm)
  })
}

const lista = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/**
 * O perfil numa frase (sem nome):
 * "Dependência grave. Precisa de enfermagem 24 horas e cuidados de pessoa acamada. Perto de Paranhos, no Porto, até 20 km, até 1800 €/mês."
 */
export function frasePerfil(p: Pick<PerfilIdoso, 'grau' | 'necessidades' | 'local' | 'raioKm' | 'orcamentoMax' | 'precisaAcordoSS' | 'quarto'>): string {
  const frases = [`${GRAU_LABEL[p.grau]}.`]
  if (p.necessidades.length) frases.push(`Precisa de ${lista(p.necessidades.map((n) => CUIDADO_FRASE[n]))}.`)
  const onde = pertoDe(p.local.label)
  const extra = [
    `${onde.charAt(0).toUpperCase()}${onde.slice(1)}, até ${p.raioKm} km`,
    `até ${euro(p.orcamentoMax)}/mês`,
    p.quarto !== 'indiferente' ? QUARTO_LABEL[p.quarto].toLowerCase() : '',
    p.precisaAcordoSS ? 'com acordo da Segurança Social' : '',
  ].filter(Boolean)
  frases.push(`${extra.join(', ')}.`)
  return frases.join(' ')
}

/** Ordem das respostas: o que pede ação primeiro. */
const ORDEM_RESPOSTA: Record<EstadoCandidatura, number> = {
  vaga_proposta: 0,
  aceite: 1,
  admitida: 2,
  em_analise: 3,
  lista_espera: 4,
  enviada: 5,
  recusada: 6,
  cancelada: 7,
}

export function ordenarRespostas(cs: Candidatura[]): Candidatura[] {
  return [...cs].sort((a, b) => ORDEM_RESPOSTA[a.estado] - ORDEM_RESPOSTA[b.estado] || b.atualizadaEm.localeCompare(a.atualizadaEm))
}

/** Notas escritas do lado de quem fez o pedido (não são "da instituição"). */
const NOTA_NOSSA = /^Encaminhado por|pela família|^A família|^Vaga aceite/

/** Última nota escrita pela instituição no histórico do pedido. */
export function ultimaNotaDoLar(c: Pick<Candidatura, 'historico'>): { nota: string; data: string } | null {
  for (let i = c.historico.length - 1; i >= 0; i--) {
    const h = c.historico[i]!
    if (h.nota && !NOTA_NOSSA.test(h.nota)) return { nota: h.nota, data: h.data }
  }
  return null
}

/** O que cada estado quer dizer, visto por quem encaminhou. */
export function descricaoEstado(c: Pick<Candidatura, 'estado' | 'posicao'>): string {
  switch (c.estado) {
    case 'enviada':
      return 'Ainda não abriu o pedido. Por agora vê só o perfil sem nome.'
    case 'em_analise':
      return 'Aceitou o pedido e já tem o seu contacto.'
    case 'lista_espera':
      return c.posicao ? `Inscreveu a pessoa na lista de espera, em ${c.posicao}.º lugar.` : 'Inscreveu a pessoa na lista de espera.'
    case 'vaga_proposta':
      return 'Tem uma vaga para esta pessoa.'
    case 'aceite':
      return 'Vaga aceite. Falta combinar o dia de entrada.'
    case 'admitida':
      return 'A entrada está registada.'
    case 'recusada':
      return 'Não tem condições para este perfil neste momento.'
    case 'cancelada':
      return 'Pedido cancelado.'
  }
}
