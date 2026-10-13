/**
 * Regras do modelo de negócio (docs/MODELO-NEGOCIO.md):
 * - só os lares privados pagam uma taxa fixa por cada pessoa que entra através da plataforma;
 * - a entrada conta quando o lar ou a família a confirma (verificada com as duas confirmações);
 * - antes de aceitar o pedido, o lar vê só um resumo sem identificação (RGPD art. 9.º).
 */
import type { Candidatura, Cuidado, GrauDependencia, Lar, ProcuraAnonima, TaxaEntrada, Urgencia } from '@/types'
import { dataLocal } from './format'

/** Uma entrada conta para a plataforma até 12 meses depois do primeiro contacto (o pedido). */
export const JANELA_ATRIBUICAO_DIAS = 365

export const taxaPara = (lar: Pick<Lar, 'natureza' | 'planoInstituicao'>): TaxaEntrada =>
  lar.natureza !== 'privado' ? 'isenta' : lar.planoInstituicao === 'mensal' ? 'incluida' : 'aplicavel'

/**
 * O lar já vê o contacto e o perfil completo? Só depois de aceitar o pedido (ou de o fazer avançar, que o aceita).
 * Recusar sem aceitar, ou a família cancelar, nunca revela os dados — tal como a base de dados (Supabase) impõe.
 */
export const contactoVisivel = (c: Pick<Candidatura, 'desbloqueadaEm'>) => !!c.desbloqueadaEm

export const origemDe = (c: Pick<Candidatura, 'origem'>) => c.origem ?? 'familia'

/** "80–84" — faixa etária sem a idade exata. */
export function faixaEtaria(idade: number): string {
  if (idade < 65) return 'menos de 65'
  if (idade >= 95) return '95 ou mais'
  const base = Math.floor(idade / 5) * 5
  return `${base}–${base + 4}`
}

export interface ResumoAnonimo {
  faixaEtaria: string
  grau: Candidatura['perfil']['grau']
  necessidades: Candidatura['perfil']['necessidades']
  /** só a zona (concelho / bairro), nunca a morada */
  zona: string
  orcamentoMax: number
  urgencia: Urgencia
  precisaAcordoSS: boolean
  quarto: Candidatura['perfil']['quarto']
  origem: 'familia' | 'profissional'
  organizacao?: string
  altaPrevista?: string
}

/** O que o lar vê antes de aceitar o pedido: sem nome, contacto, notas nem mensagem. */
export function resumoAnonimo(c: Candidatura): ResumoAnonimo {
  const p = c.perfil
  return {
    faixaEtaria: faixaEtaria(p.idade),
    grau: p.grau,
    necessidades: p.necessidades,
    zona: p.local.label,
    orcamentoMax: p.orcamentoMax,
    urgencia: p.urgencia,
    precisaAcordoSS: p.precisaAcordoSS,
    quarto: p.quarto,
    origem: origemDe(c),
    organizacao: c.encaminhamento?.organizacao,
    altaPrevista: c.encaminhamento?.altaPrevista,
  }
}

/** A entrada aconteceu dentro da janela de atribuição (conta para a taxa, se aplicável). */
export function entradaAtribuida(c: Pick<Candidatura, 'entrada' | 'criadaEm'>): boolean {
  if (!c.entrada) return false
  const dias = (dataLocal(c.entrada.data).getTime() - new Date(c.criadaEm).getTime()) / 86_400_000
  return dias <= JANELA_ATRIBUICAO_DIAS
}

/** Confirmada pelos dois lados. */
export const entradaVerificada = (c: Pick<Candidatura, 'entrada'>) => !!(c.entrada?.confirmadaLarEm && c.entrada?.confirmadaFamiliaEm)

/** Dias até à alta prevista (negativo = já passou). */
export function diasAteAlta(altaPrevista: string | undefined, agora = Date.now()): number | null {
  if (!altaPrevista) return null
  const hoje = new Date(agora)
  hoje.setHours(0, 0, 0, 0)
  return Math.round((dataLocal(altaPrevista).getTime() - hoje.getTime()) / 86_400_000)
}

/** Encaminhamentos com alta nos próximos 7 dias vêm primeiro na lista de pedidos do lar. */
export function prioridadePedido(c: Candidatura, agora = Date.now()): number {
  const d = diasAteAlta(c.encaminhamento?.altaPrevista, agora)
  if (d != null && d <= 7) return 0
  if (c.perfil.urgencia === 'imediata') return 1
  return 2
}

export interface NiveisVerificacao {
  /** licença de funcionamento confirmada (Carta Social / ISS) */
  licenca: boolean
  /** visitada pela equipa EncontraLar */
  visitado: boolean
  /** tem avaliações de famílias com entrada confirmada */
  avaliacoesVerificadas: boolean
}

export function niveisVerificacao(lar: Pick<Lar, 'verificacao' | 'reviews'>): NiveisVerificacao {
  return {
    licenca: lar.verificacao.estado !== 'nao_verificado' && !!lar.verificacao.licenca,
    visitado: lar.verificacao.estado === 'verificado' && !!lar.verificacao.data,
    avaliacoesVerificadas: lar.reviews.some((r) => r.verificada),
  }
}

/** Token de demonstração para o link de confirmação rápida (determinístico, para o seed). */
export function tokenConfirmacao(larId: string): string {
  let h = 2166136261
  for (let i = 0; i < larId.length; i++) {
    h ^= larId.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `c${(h >>> 0).toString(36)}${larId.length.toString(36)}`
}

/** Resumo da procura sem resposta (para o painel da instituição): o que mais se procura e não há. */
export function resumirProcuras(lista: ProcuraAnonima[]) {
  const cuidados = new Map<Cuidado, number>()
  const graus = new Map<GrauDependencia, number>()
  const orcamentos: number[] = []
  for (const p of lista) {
    for (const c of p.cuidados) cuidados.set(c, (cuidados.get(c) ?? 0) + 1)
    if (p.grau) graus.set(p.grau, (graus.get(p.grau) ?? 0) + 1)
    if (p.orcamentoMax) orcamentos.push(p.orcamentoMax)
  }
  orcamentos.sort((a, b) => a - b)
  const ordenar = <K,>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])
  return {
    total: lista.length,
    cuidados: ordenar(cuidados),
    graus: ordenar(graus),
    orcamentoMediano: orcamentos.length ? orcamentos[Math.floor(orcamentos.length / 2)]! : null,
  }
}
