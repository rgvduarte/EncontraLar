/**
 * Regras de faturação das instituições privadas.
 *
 * 1. Estado de faturação de uma entrada (classificarEntrada). Ordem de avaliação — a mesma que
 *    private.entradas_faturacao(p_instituicao_id, p_agora) tem de seguir em SQL:
 *      por_confirmar (sem entrada) → isenta → incluida → faturada (linha ativa) → fora_janela →
 *      dispensada (contestação aceite) → contestada (aberta) → faturavel desde a confirmação do lar →
 *      faturavel desde a decisão (contestação rejeitada) → faturavel desde familia_em + 14 dias (se já passou)
 *      → a_aguardar até familia_em + 14 dias.
 *    `isenta` (IPSS/Misericórdia) e `incluida` (lar com mensalidade) NUNCA faturam, nem com uma linha
 *    (por isso vêm antes de `faturada`; uma linha numa entrada destas é um erro de dados para a equipa).
 * 2. Mudança de modalidade (decidirMudancaPlano): para a mensalidade sempre (com método de pagamento);
 *    de volta à taxa por entrada só no fim do compromisso — o mesmo que escolher_plano_instituicao() recusa
 *    na base de dados, com a mesma mensagem.
 */
import { compromissoAte, dataLonga, dentroDaJanela, fimContestacao } from './datas.ts'
import type { PlanoInstituicao } from './planos.ts'

export type TaxaEntrada = 'aplicavel' | 'incluida' | 'isenta'
export type EstadoContestacao = 'aberta' | 'aceite' | 'rejeitada' | 'retirada'

export interface EntradaFaturacao {
  candidaturaId: string
  /** ISO — quando o pedido foi criado (início da janela de atribuição) */
  pedidoCriadoEm: string
  /** 'AAAA-MM-DD' ou null se ainda não há entrada */
  entradaData: string | null
  confirmadaLarEm: string | null
  confirmadaFamiliaEm: string | null
  taxa: TaxaEntrada | null
  contestacao: { estado: EstadoContestacao; contestadaEm: string; resolvidaEm: string | null } | null
  /** linha de fatura ativa (não anulada) */
  linha: { faturaId: string | null; documentoNumero: string | null } | null
}

export type EstadoFaturacaoEntrada =
  | { estado: 'por_confirmar' }
  | { estado: 'isenta' }
  | { estado: 'incluida' }
  | { estado: 'faturada'; faturaId: string | null; documentoNumero: string | null }
  | { estado: 'fora_janela' }
  | { estado: 'dispensada' }
  | { estado: 'contestada'; desde: string }
  | { estado: 'faturavel'; desde: string }
  | { estado: 'a_aguardar'; ate: string }

export function classificarEntrada(e: EntradaFaturacao, agora: number): EstadoFaturacaoEntrada {
  if (!e.entradaData || !e.taxa || (!e.confirmadaLarEm && !e.confirmadaFamiliaEm)) return { estado: 'por_confirmar' }
  if (e.taxa === 'isenta') return { estado: 'isenta' }
  if (e.taxa === 'incluida') return { estado: 'incluida' }
  if (e.linha) return { estado: 'faturada', faturaId: e.linha.faturaId, documentoNumero: e.linha.documentoNumero }
  if (!dentroDaJanela(e.pedidoCriadoEm, e.entradaData)) return { estado: 'fora_janela' }
  const c = e.contestacao
  if (c?.estado === 'aceite') return { estado: 'dispensada' }
  if (c?.estado === 'aberta') return { estado: 'contestada', desde: c.contestadaEm }
  if (e.confirmadaLarEm) return { estado: 'faturavel', desde: e.confirmadaLarEm }
  if (c?.estado === 'rejeitada' && c.resolvidaEm) return { estado: 'faturavel', desde: c.resolvidaEm }
  const ate = fimContestacao(e.confirmadaFamiliaEm!)
  return agora >= Date.parse(ate) ? { estado: 'faturavel', desde: ate } : { estado: 'a_aguardar', ate }
}

/** Só `faturavel` gera uma linha nova. */
export const geraLinha = (e: EntradaFaturacao, agora: number): boolean => classificarEntrada(e, agora).estado === 'faturavel'

/** O lar ainda pode contestar? (só confirmada pela família, dentro dos 14 dias, sem contestação nem linha) */
export function podeContestar(e: EntradaFaturacao, agora: number): boolean {
  return (
    e.taxa === 'aplicavel' &&
    !!e.entradaData &&
    !!e.confirmadaFamiliaEm &&
    !e.confirmadaLarEm &&
    !e.contestacao &&
    !e.linha &&
    dentroDaJanela(e.pedidoCriadoEm, e.entradaData) &&
    agora < Date.parse(fimContestacao(e.confirmadaFamiliaEm))
  )
}

// ————————————————————————————————————————————————————————————— modalidade (por entrada / mensalidade)

export interface ContextoPlano {
  natureza: 'ipss' | 'misericordia' | 'privado'
  /** null = por entrada */
  plano: PlanoInstituicao | null
  planoDesde: string | null
  demonstracao: boolean
  temMetodo: boolean
  temClienteStripe: boolean
  /** subscrição no Stripe, se houver e não estiver cancelada */
  subscricaoAtiva: { stripeSubscriptionId: string } | null
}

export type DecisaoPlano =
  | { tipo: 'recusar'; estado: 403 | 409; codigo: 'isenta' | 'demonstracao' | 'metodo_em_falta' | 'compromisso'; mensagem: string }
  | { tipo: 'mudar'; depois: 'criar_subscricao' | 'cancelar_subscricao' | 'nada' }
  | { tipo: 'manter'; depois: 'criar_subscricao' | 'nada' }

/** Fim do compromisso em vigor (ISO) ou null — igual a compromissoAte() do protótipo e a private.compromisso_ate. */
export function fimCompromisso(c: Pick<ContextoPlano, 'natureza' | 'plano' | 'planoDesde'>): string | null {
  if (c.natureza !== 'privado' || c.plano !== 'mensal' || !c.planoDesde) return null
  return compromissoAte(c.planoDesde)
}

/** Mensagem igual à de escolher_plano_instituicao() (20261013100100_equipa_modalidade.sql). */
export const mensagemCompromisso = (ate: string) => `A mensalidade tem um compromisso de 12 meses: pode mudar a partir de ${dataLonga(ate)}.`

export function decidirMudancaPlano(c: ContextoPlano, alvo: PlanoInstituicao, agora: number, modoProducao: boolean): DecisaoPlano {
  if (c.natureza !== 'privado') return { tipo: 'recusar', estado: 409, codigo: 'isenta', mensagem: 'As IPSS e Misericórdias não têm custos.' }
  if (c.demonstracao && modoProducao) {
    return { tipo: 'recusar', estado: 403, codigo: 'demonstracao', mensagem: 'As instituições de demonstração não têm pagamentos reais.' }
  }
  const atual: PlanoInstituicao = c.plano ?? 'por_entrada'
  if (alvo === atual) {
    // repetir a escolha não muda nada; repara uma mensalidade sem subscrição (ex.: o Stripe falhou da última vez)
    return { tipo: 'manter', depois: alvo === 'mensal' && !c.subscricaoAtiva && c.temMetodo && c.temClienteStripe ? 'criar_subscricao' : 'nada' }
  }
  if (alvo === 'mensal') {
    if (!c.temMetodo || !c.temClienteStripe) {
      return {
        tipo: 'recusar',
        estado: 409,
        codigo: 'metodo_em_falta',
        mensagem: 'Para a mensalidade, configure primeiro o débito direto (ou um cartão) em Faturação.',
      }
    }
    return { tipo: 'mudar', depois: 'criar_subscricao' }
  }
  const ate = fimCompromisso(c)
  if (ate && Date.parse(ate) > agora) return { tipo: 'recusar', estado: 409, codigo: 'compromisso', mensagem: mensagemCompromisso(ate) }
  return { tipo: 'mudar', depois: c.subscricaoAtiva ? 'cancelar_subscricao' : 'nada' }
}
