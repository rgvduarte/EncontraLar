/**
 * Valores comerciais do lado do servidor. Espelham src/lib/acesso.ts e src/lib/negocio.ts, que o Deno não
 * consegue importar (alias `@/`, módulos da interface). O teste supabase/tests/funcoes/planos.test.ts prova
 * que os valores são iguais aos do protótipo; se um mudar, o teste falha.
 *
 * Só TypeScript puro: sem Deno.*, sem npm:/jsr:, importações relativas com ".ts".
 */

export type PlanoFamiliaId = 'acesso_30' | 'acesso_90'
export type PlanoInstituicao = 'por_entrada' | 'mensal'

export interface PlanoFamiliaServidor {
  id: PlanoFamiliaId
  dias: number
  /** IVA incluído */
  precoCentimos: number
  /** Nome do produto no Stripe Checkout e na Fatura-Recibo (sem dados pessoais). */
  produto: string
}

export const PLANOS_FAMILIA: Readonly<Record<PlanoFamiliaId, PlanoFamiliaServidor>> = {
  acesso_30: { id: 'acesso_30', dias: 30, precoCentimos: 1490, produto: 'Acesso Família — 30 dias' },
  acesso_90: { id: 'acesso_90', dias: 90, precoCentimos: 2990, produto: 'Acesso Família — 90 dias' },
}

export const planoFamilia = (id: unknown): PlanoFamiliaServidor | null =>
  typeof id === 'string' && Object.prototype.hasOwnProperty.call(PLANOS_FAMILIA, id) ? PLANOS_FAMILIA[id as PlanoFamiliaId] : null

/** IVA incluído nos preços às famílias (Continente). A taxa das famílias das ilhas é pergunta ao contabilista. */
export const IVA_FAMILIA_PERCENT = 23

/** Taxa por entrada de omissão (o contrato guarda o valor: contratos.taxa_entrada_centimos). + IVA. */
export const TAXA_ENTRADA_CENTIMOS = 15000

/** Mensalidade dos lares privados. + IVA. */
export const MENSALIDADE_CENTIMOS = 2900

/** A mensalidade tem compromisso mínimo de 12 meses. */
export const COMPROMISSO_MENSAL_MESES = 12

/** Uma entrada conta até 12 meses depois do pedido. */
export const JANELA_ATRIBUICAO_DIAS = 365

/** Uma entrada confirmada só pela família pode ser contestada pelo lar durante 14 dias. */
export const PRAZO_CONTESTACAO_DIAS = 14

/**
 * Consentimento de início imediato do conteúdo digital (perda do direito de livre resolução de 14 dias).
 * O texto mostrado em /acesso tem de ser este; a versão fica registada em consentimentos_acesso.
 * Mudar o texto = nova versão (e o /acesso passa a enviar a nova). Texto a validar pelo jurista.
 */
export const CONSENTIMENTO_ACESSO = {
  versao: 'acesso-familia-2026-10-13',
  texto:
    'Peço que o Acesso Família comece logo após o pagamento e aceito que, por se tratar de conteúdo digital, ' +
    'perco o direito de livre resolução de 14 dias.',
} as const

/** Produtos fixos no Stripe (criados uma vez, com estes ids: ver supabase/functions/README.md). */
export const PRODUTO_STRIPE_MENSALIDADE = 'el_mensalidade'
export const produtoStripeIva = (pct: number) => `el_iva_${pct}`
