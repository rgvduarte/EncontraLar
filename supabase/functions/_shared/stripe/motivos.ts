/**
 * Motivos de falha normalizados. A mensagem do Stripe nunca chega ao utilizador (pode vir em inglês, ter
 * detalhes do banco ou do cartão): guarda-se o código normalizado e a interface mostra estes textos.
 */
import type { MotivoFalha } from '../portas.ts'

export const MOTIVOS_FALHA: Readonly<Record<MotivoFalha, string>> = {
  saldo_insuficiente: 'O banco recusou o débito por falta de saldo.',
  mandato_revogado: 'A autorização de débito direto já não está ativa.',
  cartao_recusado: 'O cartão foi recusado.',
  cartao_expirado: 'O cartão está expirado.',
  autenticacao_falhou: 'A confirmação do pagamento não foi concluída.',
  referencia_expirada: 'A referência Multibanco expirou sem pagamento.',
  pagamento_cancelado: 'O pagamento foi cancelado.',
  outro: 'O pagamento não foi concluído.',
}

const POR_CODIGO: Readonly<Record<string, MotivoFalha>> = {
  insufficient_funds: 'saldo_insuficiente',
  sepa_insufficient_funds: 'saldo_insuficiente',
  debit_not_authorized: 'mandato_revogado',
  revocation_of_authorization: 'mandato_revogado',
  revocation_of_partial_authorization: 'mandato_revogado',
  account_closed: 'mandato_revogado',
  bank_account_restricted: 'mandato_revogado',
  no_account: 'mandato_revogado',
  invalid_account_number: 'mandato_revogado',
  payment_method_microdeposit_verification_failed: 'mandato_revogado',
  expired_card: 'cartao_expirado',
  card_declined: 'cartao_recusado',
  incorrect_cvc: 'cartao_recusado',
  incorrect_number: 'cartao_recusado',
  processing_error: 'outro',
  authentication_required: 'autenticacao_falhou',
  payment_intent_authentication_failure: 'autenticacao_falhou',
  setup_intent_authentication_failure: 'autenticacao_falhou',
  payment_intent_payment_attempt_expired: 'referencia_expirada',
  payment_method_customer_decline: 'pagamento_cancelado',
  payment_intent_payment_attempt_failed: 'outro',
}

/** Normaliza um erro de pagamento do Stripe (last_payment_error / erro do SDK). */
export function normalizarMotivo(e: { codigo?: string | null; declineCode?: string | null; tipoMetodo?: string | null } | null | undefined): MotivoFalha {
  if (!e) return 'outro'
  for (const c of [e.declineCode, e.codigo]) {
    if (c && Object.prototype.hasOwnProperty.call(POR_CODIGO, c)) return POR_CODIGO[c]!
  }
  if (e.tipoMetodo === 'multibanco') return 'referencia_expirada'
  if (e.tipoMetodo === 'card') return 'cartao_recusado'
  return 'outro'
}

export const textoMotivo = (m: MotivoFalha): string => MOTIVOS_FALHA[m]
