/**
 * As chamadas ao Stripe que as funções fazem, e só essas. Os parâmetros são os tipos do SDK oficial
 * (importação só de tipos: apaga-se ao transpilar), por isso o `tsc` confirma cada parâmetro contra a versão
 * fixada. O adaptador Deno (_shared/deno/stripe.ts) liga cada método ao cliente `stripe`; os testes usam
 * StripeFalso (supabase/tests/funcoes/fakes.ts).
 *
 * Todas as escritas levam uma chave de idempotência.
 */
import type Stripe from 'stripe'

export interface OpcoesPedido {
  idempotencyKey: string
}

export interface PedidoStripe<P> {
  params: P
  opcoes: OpcoesPedido
}

export interface PortaStripe {
  // ——— clientes (lares)
  criarCliente(p: Stripe.CustomerCreateParams, o: OpcoesPedido): Promise<{ id: string }>
  atualizarCliente(id: string, p: Stripe.CustomerUpdateParams, o: OpcoesPedido): Promise<{ id: string }>
  apagarCliente(id: string): Promise<void>
  listarTaxIds(cliente: string): Promise<{ id: string; type: string; value: string }[]>
  criarTaxId(cliente: string, p: Stripe.CustomerCreateTaxIdParams, o: OpcoesPedido): Promise<{ id: string }>
  apagarTaxId(cliente: string, id: string): Promise<void>

  // ——— sessões
  criarSessaoCheckout(p: Stripe.Checkout.SessionCreateParams, o: OpcoesPedido): Promise<{ id: string; url: string | null }>
  criarSessaoPortal(p: Stripe.BillingPortal.SessionCreateParams, o: OpcoesPedido): Promise<{ url: string }>

  // ——— subscrições
  criarSubscricao(p: Stripe.SubscriptionCreateParams, o: OpcoesPedido): Promise<{ id: string; status: string; start_date: number }>
  atualizarSubscricao(id: string, p: Stripe.SubscriptionUpdateParams, o: OpcoesPedido): Promise<{ id: string; status: string }>
  cancelarSubscricao(id: string, p: Stripe.SubscriptionCancelParams, o: OpcoesPedido): Promise<{ id: string; status: string }>

  // ——— cobranças mensais por entrada (v1)
  criarFatura(p: Stripe.InvoiceCreateParams, o: OpcoesPedido): Promise<{ id: string }>
  criarItemFatura(p: Stripe.InvoiceItemCreateParams, o: OpcoesPedido): Promise<{ id: string }>
  finalizarFatura(id: string, p: Stripe.InvoiceFinalizeInvoiceParams, o: OpcoesPedido): Promise<{ id: string; number: string | null; hosted_invoice_url?: string | null; status: string | null }>
  enviarFatura(id: string, o: OpcoesPedido): Promise<{ id: string }>
  pagarFatura(id: string, p: Stripe.InvoicePayParams, o: OpcoesPedido): Promise<{ id: string; status: string | null }>

  // ——— leituras (webhook)
  /** expand: ['payment_method', 'mandate'] */
  lerSetupIntent(id: string): Promise<Stripe.SetupIntent>
  /** expand: ['payment_method'] */
  lerPaymentIntent(id: string): Promise<Stripe.PaymentIntent>
  lerMetodoPagamento(id: string): Promise<Stripe.PaymentMethod>
  /** expand: ['payments.data.payment.payment_intent.payment_method'] (verificar: payments na versão endive) */
  lerFaturaComPagamentos(id: string): Promise<Stripe.Invoice>
  /** invoicePayments.list({ payment: { type: 'payment_intent', payment_intent } }) → id da fatura, se houver */
  faturaDoPaymentIntent(paymentIntentId: string): Promise<string | null>
  lerCarga(id: string): Promise<Stripe.Charge>
}

/** O que extraímos de um erro do SDK (StripeCardError, StripeInvalidRequestError…), sem a mensagem. */
export interface ErroStripeResumo {
  tipo: string | null
  codigo: string | null
  declineCode: string | null
  estadoHttp: number | null
}

export function resumirErroStripe(e: unknown): ErroStripeResumo {
  const o = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>
  const s = (v: unknown) => (typeof v === 'string' ? v : null)
  return {
    tipo: s(o.type),
    codigo: s(o.code),
    declineCode: s(o.decline_code),
    estadoHttp: typeof o.statusCode === 'number' ? o.statusCode : null,
  }
}
