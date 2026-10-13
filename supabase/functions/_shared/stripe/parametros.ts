/**
 * Parâmetros dos pedidos ao Stripe, puros e determinísticos (os testes guardam o objeto exato).
 *
 * Decisão 9 do v1: SEM Stripe Tax. Os lares recebem linhas líquidas + uma linha explícita de IVA (uma por
 * taxa), para que o total cobrado, o documento do Moloni e a base de dados batam ao cêntimo. Às famílias o
 * preço já inclui IVA (o Stripe não calcula imposto nenhum).
 *
 * Nota de versão: no SDK 23 / API 2026-09-30.endive, `payment_method_types` deixou de existir nos parâmetros
 * do Checkout; o equivalente é `allowed_payment_method_types` (filtra os métodos ativos no painel). As
 * subscrições e faturas mantêm `payment_settings.payment_method_types`.
 *
 * Minimização: nada de nomes de residentes, notas, cuidados ou NIF de famílias. Metadata só com ids técnicos.
 */
import type Stripe from 'stripe'
import { centimosParaDecimal, ivaCentimos, totaisDocumento, linhaLiquida, type TaxaIva } from '../faturacao/dinheiro.ts'
import { descricaoEntrada } from '../faturacao/documentos.ts'
import { mesPorExtenso, paraSegundos, somarHoras } from '../faturacao/datas.ts'
import { MENSALIDADE_CENTIMOS, PLANOS_FAMILIA, PRODUTO_STRIPE_MENSALIDADE, produtoStripeIva, type PlanoFamiliaId } from '../faturacao/planos.ts'
import type { CobrancaPreparadaRpc, ContextoInstituicaoRpc, DadosFiscaisRpc } from '../portas.ts'
import type { PedidoStripe } from './porta.ts'

/** Placeholder que o Stripe substitui no success_url. */
export const ID_SESSAO = '{CHECKOUT_SESSION_ID}'

/** Validade da sessão do Checkout das famílias (o Stripe aceita 30 min a 24 h). */
export const VALIDADE_CHECKOUT_HORAS = 1

/**
 * URL de regresso: APP_URL + query (sem '#': o HashRouter da app converte ?acesso=… / ?faturacao=… na rota,
 * ver src/lib/retorno.ts no plano v1). `extra` vem já validado.
 */
export function urlRetorno(appUrl: string, query: Record<string, string>): string {
  const base = appUrl.replace(/[?#].*$/, '')
  const partes = Object.entries(query).map(([k, v]) => `${encodeURIComponent(k)}=${v === ID_SESSAO ? v : encodeURIComponent(v)}`)
  return `${base}?${partes.join('&')}`
}

/** Caminho interno para onde voltar depois de /acesso (só caminhos da app: '/…', sem '//' nem esquema). */
export function voltarSeguro(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 200) return null
  if (!/^\/[A-Za-z0-9\-._~/?=&%]*$/.test(v) || v.startsWith('//') || v.includes('/../')) return null
  return v
}

// ————————————————————————————————————————————————————————————— (a) Acesso Família: Checkout mode=payment

export interface EntradaCheckoutAcesso {
  pagamentoId: string
  plano: PlanoFamiliaId
  userId: string
  email: string | null
  appUrl: string
  agora: number
  voltar: string | null
}

export function parametrosCheckoutAcesso(e: EntradaCheckoutAcesso): PedidoStripe<Stripe.Checkout.SessionCreateParams> {
  const p = PLANOS_FAMILIA[e.plano]
  const retorno = (estado: string, comSessao: boolean) =>
    urlRetorno(e.appUrl, { acesso: estado, ...(comSessao ? { sessao: ID_SESSAO } : {}), ...(e.voltar ? { voltar: e.voltar } : {}) })
  const metadata = { pagamento_id: e.pagamentoId, plano: e.plano }
  return {
    params: {
      mode: 'payment',
      allowed_payment_method_types: ['card', 'mb_way', 'multibanco'],
      locale: 'pt',
      currency: 'eur',
      submit_type: 'pay',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'eur',
            unit_amount: p.precoCentimos,
            product_data: { name: p.produto, description: 'Passe sem renovação automática. IVA incluído.' },
          },
        },
      ],
      client_reference_id: e.userId,
      ...(e.email ? { customer_email: e.email } : {}),
      metadata,
      payment_intent_data: {
        description: `EncontraLar — ${p.produto}`,
        metadata,
      },
      custom_text: {
        submit: {
          message:
            'O acesso começa assim que o pagamento é confirmado (por Multibanco, quando a referência for paga). Não há renovação automática.',
        },
      },
      expires_at: paraSegundos(somarHoras(e.agora, VALIDADE_CHECKOUT_HORAS)),
      success_url: retorno('sucesso', true),
      cancel_url: retorno('cancelado', false),
    },
    opcoes: { idempotencyKey: `acesso-checkout:${e.pagamentoId}` },
  }
}

// ————————————————————————————————————————————————————————————— (b) lares: cliente e mandato SEPA/cartão (v1)

export function parametrosCliente(instituicaoId: string, d: DadosFiscaisRpc): PedidoStripe<Stripe.CustomerCreateParams> {
  return {
    params: {
      name: d.razao_social,
      email: d.email,
      address: { line1: d.morada, postal_code: d.codigo_postal, city: d.localidade, country: 'PT' },
      preferred_locales: ['pt'],
      tax_id_data: [{ type: 'eu_vat', value: `PT${d.nif}` }],
      metadata: { instituicao_id: instituicaoId },
    },
    opcoes: { idempotencyKey: `cliente:${instituicaoId}` },
  }
}

/** Atualiza nome/email/morada (o NIF troca-se à parte, como tax id). A chave inclui um resumo dos dados. */
export function parametrosAtualizarCliente(instituicaoId: string, d: DadosFiscaisRpc): PedidoStripe<Stripe.CustomerUpdateParams> {
  return {
    params: {
      name: d.razao_social,
      email: d.email,
      address: { line1: d.morada, postal_code: d.codigo_postal, city: d.localidade, country: 'PT' },
      preferred_locales: ['pt'],
      metadata: { instituicao_id: instituicaoId },
    },
    opcoes: { idempotencyKey: `cliente-atualizar:${instituicaoId}:${resumo([d.razao_social, d.email, d.morada, d.codigo_postal, d.localidade].join('|'))}` },
  }
}

export function parametrosTaxId(instituicaoId: string, nif: string): PedidoStripe<Stripe.CustomerCreateTaxIdParams> {
  return { params: { type: 'eu_vat', value: `PT${nif}` }, opcoes: { idempotencyKey: `taxid:${instituicaoId}:${nif}` } }
}

export interface EntradaMandato {
  instituicaoId: string
  customerId: string
  appUrl: string
  agora: number
}

export function parametrosCheckoutMandato(e: EntradaMandato): PedidoStripe<Stripe.Checkout.SessionCreateParams> {
  const metadata = { instituicao_id: e.instituicaoId }
  return {
    params: {
      mode: 'setup',
      customer: e.customerId,
      currency: 'eur',
      allowed_payment_method_types: ['sepa_debit', 'card'],
      locale: 'pt',
      success_url: urlRetorno(e.appUrl, { faturacao: 'metodo-ok', sessao: ID_SESSAO }),
      cancel_url: urlRetorno(e.appUrl, { faturacao: 'metodo-cancelado' }),
      metadata,
      setup_intent_data: { metadata, description: 'EncontraLar — autorização de débito das faturas' },
    },
    // um clique duplo no mesmo minuto devolve a mesma sessão
    opcoes: { idempotencyKey: `mandato:${e.instituicaoId}:${Math.floor(e.agora / 60_000)}` },
  }
}

export function parametrosPortal(customerId: string, appUrl: string, agora: number): PedidoStripe<Stripe.BillingPortal.SessionCreateParams> {
  return {
    params: { customer: customerId, return_url: urlRetorno(appUrl, { faturacao: 'portal' }), locale: 'pt' },
    opcoes: { idempotencyKey: `portal:${customerId}:${Math.floor(agora / 60_000)}` },
  }
}

// ————————————————————————————————————————————————————————————— (c) mensalidade: subscrição Stripe Billing

export interface EntradaSubscricao {
  instituicaoId: string
  customerId: string
  paymentMethodId: string
  ivaPercent: TaxaIva
  /** plano_desde da mensalidade (chave de idempotência: uma subscrição por adesão) */
  planoDesde: string
  compromissoAte: string
}

export interface ValoresMensalidade {
  liquidoCentimos: number
  ivaPercent: TaxaIva
  ivaCentimos: number
  totalCentimos: number
}

export const valoresMensalidade = (ivaPercent: TaxaIva): ValoresMensalidade => linhaLiquida(MENSALIDADE_CENTIMOS, ivaPercent)

export function parametrosSubscricao(e: EntradaSubscricao): PedidoStripe<Stripe.SubscriptionCreateParams> {
  const v = valoresMensalidade(e.ivaPercent)
  return {
    params: {
      customer: e.customerId,
      currency: 'eur',
      collection_method: 'charge_automatically',
      default_payment_method: e.paymentMethodId,
      off_session: true,
      payment_behavior: 'allow_incomplete',
      proration_behavior: 'none',
      items: [
        {
          quantity: 1,
          price_data: { currency: 'eur', product: PRODUTO_STRIPE_MENSALIDADE, recurring: { interval: 'month' }, unit_amount: v.liquidoCentimos },
          metadata: { linha: 'mensalidade' },
        },
        {
          quantity: 1,
          price_data: { currency: 'eur', product: produtoStripeIva(e.ivaPercent), recurring: { interval: 'month' }, unit_amount: v.ivaCentimos },
          metadata: { linha: 'iva', iva_percent: String(e.ivaPercent) },
        },
      ],
      payment_settings: { payment_method_types: ['sepa_debit', 'card'], save_default_payment_method: 'on_subscription' },
      description: 'Mensalidade EncontraLar (compromisso de 12 meses). Documento de cobrança: a fatura é emitida à parte.',
      metadata: { instituicao_id: e.instituicaoId, iva_percent: String(e.ivaPercent), compromisso_ate: e.compromissoAte },
    },
    opcoes: { idempotencyKey: `subscricao:${e.instituicaoId}:${e.planoDesde}` },
  }
}

/** Fim da mensalidade depois do compromisso: cancela já, sem rateio nem fatura final (o mês pago não é devolvido). */
export function parametrosCancelarSubscricao(subscriptionId: string): PedidoStripe<Stripe.SubscriptionCancelParams> {
  return {
    params: { prorate: false, invoice_now: false, cancellation_details: { comment: 'Mudança para a taxa por entrada depois do compromisso.' } },
    opcoes: { idempotencyKey: `subscricao-cancelar:${subscriptionId}` },
  }
}

/** Novo método predefinido numa subscrição ativa (o lar trocou o débito direto). */
export function parametrosMetodoSubscricao(subscriptionId: string, paymentMethodId: string): PedidoStripe<Stripe.SubscriptionUpdateParams> {
  return { params: { default_payment_method: paymentMethodId }, opcoes: { idempotencyKey: `subscricao-metodo:${subscriptionId}:${paymentMethodId}` } }
}

export function parametrosMetodoPredefinido(customerId: string, paymentMethodId: string): PedidoStripe<Stripe.CustomerUpdateParams> {
  return {
    params: { invoice_settings: { default_payment_method: paymentMethodId } },
    opcoes: { idempotencyKey: `metodo-predefinido:${customerId}:${paymentMethodId}` },
  }
}

// ————————————————————————————————————————————————————————————— (d) cobrança mensal por entrada (v1)

export interface ConfigCobranca {
  /** dias para pagar quando não há método (send_invoice) */
  diasPagamento: number
  /** país da conta virtual para transferências (customer_balance); null = sem transferência */
  paisTransferencia: string | null
}

export interface PlanoCobranca {
  fatura: PedidoStripe<Stripe.InvoiceCreateParams>
  /** uma linha por entrada + uma linha de IVA por taxa; `invoice` é preenchido depois de criar a fatura */
  itens: ((invoiceId: string) => PedidoStripe<Stripe.InvoiceItemCreateParams>)[]
  finalizar: PedidoStripe<Stripe.InvoiceFinalizeInvoiceParams>
  enviar: { opcoes: { idempotencyKey: string } } | null
  cobranca: 'debito_automatico' | 'pagamento_por_link'
  totalCentimos: number
}

export function planoCobrancaMensal(c: CobrancaPreparadaRpc, cfg: ConfigCobranca): PlanoCobranca {
  const automatica = !!c.stripe_payment_method_id
  const chave = (passo: string) => `cobranca:${c.fatura_id}:${passo}`
  const numeros = c.linhas.map((l) => l.documento_numero).filter((n): n is string => !!n)
  const metodos: Stripe.InvoiceCreateParams.PaymentSettings.PaymentMethodType[] = ['sepa_debit', 'card']
  if (cfg.paisTransferencia) metodos.push('customer_balance')
  const totais = totaisDocumento(c.linhas.map((l) => ({ liquidoCentimos: l.valor_centimos, ivaPercent: l.iva_percent, ivaCentimos: l.iva_centimos, totalCentimos: l.valor_centimos + l.iva_centimos })))
  if (totais.totalCentimos !== c.total_centimos || totais.ivaCentimos !== c.iva_centimos) throw new RangeError('Os totais da cobrança não batem com as linhas.')
  for (const l of c.linhas) if (ivaCentimos(l.valor_centimos, l.iva_percent) !== l.iva_centimos) throw new RangeError('IVA de linha incorreto.')

  const fatura: Stripe.InvoiceCreateParams = {
    customer: c.stripe_customer_id,
    currency: 'eur',
    auto_advance: false,
    collection_method: automatica ? 'charge_automatically' : 'send_invoice',
    ...(automatica ? {} : { days_until_due: cfg.diasPagamento }),
    pending_invoice_items_behavior: 'exclude',
    payment_settings: {
      payment_method_types: metodos,
      ...(cfg.paisTransferencia
        ? { payment_method_options: { customer_balance: { funding_type: 'bank_transfer', bank_transfer: { type: 'eu_bank_transfer', eu_bank_transfer: { country: cfg.paisTransferencia } } } } }
        : {}),
    },
    description: `Taxa por entrada — ${mesPorExtenso(c.periodo)}. Documento de cobrança: não substitui a fatura.`,
    footer: 'Faturas emitidas por software certificado pela AT (Moloni), disponíveis no painel da instituição.',
    ...(numeros.length ? { custom_fields: [{ name: 'Faturas', value: resumirNumeros(numeros) }] } : {}),
    metadata: { instituicao_id: c.instituicao_id, fatura_id: c.fatura_id, periodo: c.periodo },
  }

  const itens: PlanoCobranca['itens'] = c.linhas.map((l, i) => (invoice: string) => ({
    params: { customer: c.stripe_customer_id, invoice, currency: 'eur', amount: l.valor_centimos, description: descricaoEntrada(l.referencia, l.entrada_data) },
    opcoes: { idempotencyKey: chave(`linha:${i}`) },
  }))
  for (const t of totais.porTaxa) {
    itens.push((invoice: string) => ({
      params: { customer: c.stripe_customer_id, invoice, currency: 'eur', amount: t.ivaCentimos, description: `IVA ${t.ivaPercent} % sobre ${centimosParaDecimal(t.baseCentimos).replace('.', ',')} €` },
      opcoes: { idempotencyKey: chave(`iva:${t.ivaPercent}`) },
    }))
  }

  return {
    fatura: { params: fatura, opcoes: { idempotencyKey: chave('fatura') } },
    itens,
    finalizar: { params: { auto_advance: false }, opcoes: { idempotencyKey: chave('finalizar') } },
    enviar: automatica ? null : { opcoes: { idempotencyKey: chave('enviar') } },
    cobranca: automatica ? 'debito_automatico' : 'pagamento_por_link',
    totalCentimos: c.total_centimos,
  }
}

/** Débito de uma cobrança emitida na data do pré-aviso SEPA (uma tentativa por dia). */
export function parametrosPagarFatura(faturaId: string, diaLisboa: string): PedidoStripe<Stripe.InvoicePayParams> {
  return { params: { off_session: true }, opcoes: { idempotencyKey: `debito:${faturaId}:${diaLisboa}` } }
}

/** "FT F2026/1, FT F2026/2" — o Stripe limita o valor a 140 caracteres. */
function resumirNumeros(ns: string[]): string {
  const t = ns.join(', ')
  return t.length <= 140 ? t : `${ns[0]} … ${ns[ns.length - 1]} (${ns.length})`
}

/** Resumo estável (FNV-1a, 8 hex) para chaves de idempotência que dependem de dados. */
function resumo(t: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** Contexto mínimo para a subscrição (validado antes de chamar o Stripe). */
export function prontoParaSubscricao(c: Pick<ContextoInstituicaoRpc, 'stripe_customer_id' | 'stripe_payment_method_id'>): c is { stripe_customer_id: string; stripe_payment_method_id: string } {
  return !!c.stripe_customer_id && !!c.stripe_payment_method_id
}

