/**
 * Evento do Stripe → operações (stripe/eventos.ts), para cada evento das tabelas do v1, das famílias e da
 * mensalidade. As mensagens do Stripe nunca passam: só motivos normalizados.
 */
import type Stripe from 'stripe'
import { describe, expect, it } from 'vitest'
import { EVENTOS_TRATADOS, estadoSubscricao, interpretarEvento, leituraDoEvento, operacoesDoEvento, periodoSubscricao } from '../../functions/_shared/stripe/eventos.ts'
import { MOTIVOS_FALHA, normalizarMotivo } from '../../functions/_shared/stripe/motivos.ts'
import { evento, faturaComPagamento, faturaStripe, paymentIntent, sessaoCheckout, StripeFalso, T0 } from './fakes.ts'

const EM = new Date(T0).toISOString()
const MENSAGEM_STRIPE = 'Your card has insufficient funds. Please contact your bank (ref 4242).'

function stripeCom(f: (s: StripeFalso) => void = () => {}) {
  const s = new StripeFalso()
  f(s)
  return s
}

/** Eventos cobertos neste ficheiro (o último teste confirma que são todos os da lista). */
const cobertos = new Set<string>()
const mapear = async (e: Stripe.Event, s = stripeCom()) => {
  cobertos.add(e.type)
  return operacoesDoEvento(e, s)
}

describe('famílias (Checkout mode=payment)', () => {
  it('completed + paid com cartão → acesso_pago (lê o PaymentIntent para saber o método)', async () => {
    const s = stripeCom((x) => x.paymentIntents.set('pi_1', paymentIntent({ id: 'pi_1', tipo: 'card', pagamentoId: 'pag-1' })))
    const e = evento('checkout.session.completed', sessaoCheckout({ id: 'cs_1', pagamentoId: 'pag-1', payment_intent: 'pi_1', amount_total: 1490 }))
    expect(leituraDoEvento(e)).toEqual({ tipo: 'payment_intent', id: 'pi_1' })
    expect(await mapear(e, s)).toEqual({
      operacoes: [{ op: 'acesso_pago', session_id: 'cs_1', pagamento_id: 'pag-1', payment_intent_id: 'pi_1', metodo: 'card', valor_centimos: 1490, pago_em: EM }],
      efeitos: [],
    })
  })

  it('completed + paid com MB WAY → acesso_pago metodo mb_way', async () => {
    const s = stripeCom((x) => x.paymentIntents.set('pi_2', paymentIntent({ id: 'pi_2', tipo: 'mb_way' })))
    const r = await mapear(evento('checkout.session.completed', sessaoCheckout({ id: 'cs_2', pagamentoId: 'pag-2', plano: 'acesso_90', payment_intent: 'pi_2', amount_total: 2990 })), s)
    expect(r.operacoes).toEqual([{ op: 'acesso_pago', session_id: 'cs_2', pagamento_id: 'pag-2', payment_intent_id: 'pi_2', metodo: 'mb_way', valor_centimos: 2990, pago_em: EM }])
  })

  it('completed + unpaid (Multibanco) → acesso_a_aguardar com entidade, referência e validade', async () => {
    const expira = Math.floor(T0 / 1000) + 7 * 86400
    const s = stripeCom((x) => x.paymentIntents.set('pi_3', paymentIntent({ id: 'pi_3', tipo: 'multibanco', multibanco: { entity: '12345', reference: '123456789', expires_at: expira } })))
    const r = await mapear(evento('checkout.session.completed', sessaoCheckout({ id: 'cs_3', pagamentoId: 'pag-3', payment_status: 'unpaid', payment_intent: 'pi_3', amount_total: 1490 })), s)
    expect(r.operacoes).toEqual([
      {
        op: 'acesso_a_aguardar',
        session_id: 'cs_3',
        pagamento_id: 'pag-3',
        payment_intent_id: 'pi_3',
        metodo: 'multibanco',
        entidade: '12345',
        referencia: '123456789',
        expira_em: new Date(expira * 1000).toISOString(),
      },
    ])
  })

  it('async_payment_succeeded → acesso_pago (Multibanco pago)', async () => {
    const s = stripeCom((x) => x.paymentIntents.set('pi_3', paymentIntent({ id: 'pi_3', tipo: 'multibanco' })))
    const r = await mapear(evento('checkout.session.async_payment_succeeded', sessaoCheckout({ id: 'cs_3', pagamentoId: 'pag-3', payment_intent: 'pi_3', amount_total: 1490 })), s)
    expect(r.operacoes).toEqual([{ op: 'acesso_pago', session_id: 'cs_3', pagamento_id: 'pag-3', payment_intent_id: 'pi_3', metodo: 'multibanco', valor_centimos: 1490, pago_em: EM }])
  })

  it('async_payment_failed → acesso_falhou com motivo normalizado (nunca a mensagem do Stripe)', async () => {
    const pi = paymentIntent({ id: 'pi_4', tipo: 'multibanco', erro: { code: 'payment_intent_payment_attempt_expired' } })
    ;(pi.last_payment_error as unknown as Record<string, unknown>).message = MENSAGEM_STRIPE
    const s = stripeCom((x) => x.paymentIntents.set('pi_4', pi))
    const r = await mapear(evento('checkout.session.async_payment_failed', sessaoCheckout({ id: 'cs_4', pagamentoId: 'pag-4', payment_status: 'unpaid', payment_intent: 'pi_4' })), s)
    expect(r.operacoes).toEqual([{ op: 'acesso_falhou', session_id: 'cs_4', pagamento_id: 'pag-4', motivo: 'referencia_expirada' }])
    expect(JSON.stringify(r)).not.toContain('insufficient')
  })

  it('expired → acesso_expirado (sem ler nada); sessões de setup expiradas não interessam', async () => {
    const e = evento('checkout.session.expired', sessaoCheckout({ id: 'cs_5', pagamentoId: 'pag-5', payment_status: 'unpaid' }))
    expect(leituraDoEvento(e)).toBeNull()
    expect((await mapear(e)).operacoes).toEqual([{ op: 'acesso_expirado', session_id: 'cs_5', pagamento_id: 'pag-5' }])
    expect(interpretarEvento(evento('checkout.session.expired', sessaoCheckout({ id: 'cs_6', mode: 'setup' }))).operacoes).toEqual([])
  })

  it('sessões sem pagamento_id (de outra origem) e sem pagamento devido são ignoradas', async () => {
    const e = evento('checkout.session.completed', sessaoCheckout({ id: 'cs_7', pagamentoId: null, payment_intent: 'pi_7' }))
    expect(leituraDoEvento(e)).toBeNull()
    expect(interpretarEvento(e)).toEqual({ operacoes: [], efeitos: [] })
    const gratis = evento('checkout.session.completed', sessaoCheckout({ id: 'cs_8', pagamentoId: 'p', payment_status: 'no_payment_required' }))
    expect(interpretarEvento(gratis).operacoes).toEqual([])
  })

  it('charge.refunded → acesso_reembolsado (total ou parcial); sem payment intent → nada', async () => {
    const total = await mapear(evento('charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: 'pi_1', amount: 1490, amount_refunded: 1490, refunded: true }))
    expect(total.operacoes).toEqual([{ op: 'acesso_reembolsado', payment_intent_id: 'pi_1', valor_reembolsado_centimos: 1490, total: true, em: EM }])
    const parcial = interpretarEvento(evento('charge.refunded', { id: 'ch_2', object: 'charge', payment_intent: 'pi_2', amount: 2990, amount_refunded: 1000, refunded: false }))
    expect(parcial.operacoes).toMatchObject([{ op: 'acesso_reembolsado', total: false, valor_reembolsado_centimos: 1000 }])
    expect(interpretarEvento(evento('charge.refunded', { id: 'ch_3', object: 'charge', payment_intent: null, amount_refunded: 1 })).operacoes).toEqual([])
  })
})

describe('mensalidade (subscrições)', () => {
  const sub = (status: string, extra: Record<string, unknown> = {}) => ({
    id: 'sub_1',
    object: 'subscription',
    status,
    customer: 'cus_1',
    start_date: Math.floor(T0 / 1000),
    canceled_at: null,
    ended_at: null,
    metadata: { instituicao_id: 'lar-1' },
    ...extra,
  })

  it('created / updated / deleted → subscricao_estado', async () => {
    const criada = await mapear(evento('customer.subscription.created', sub('incomplete')))
    expect(criada.operacoes).toEqual([
      { op: 'subscricao_estado', stripe_subscription_id: 'sub_1', stripe_customer_id: 'cus_1', instituicao_id: 'lar-1', estado: 'incompleta', inicio: EM, cancelada_em: null },
    ])
    expect((await mapear(evento('customer.subscription.updated', sub('past_due')))).operacoes).toMatchObject([{ estado: 'em_atraso' }])
    const fim = Math.floor(T0 / 1000) + 400 * 86400
    expect((await mapear(evento('customer.subscription.deleted', sub('canceled', { ended_at: fim, canceled_at: fim })))).operacoes).toMatchObject([
      { estado: 'cancelada', cancelada_em: new Date(fim * 1000).toISOString() },
    ])
  })

  it('estados do Stripe → estado da subscrição', () => {
    expect(['active', 'trialing', 'past_due', 'unpaid', 'paused', 'canceled', 'incomplete_expired', 'incomplete'].map((s) => estadoSubscricao(s))).toEqual([
      'ativa',
      'ativa',
      'em_atraso',
      'em_atraso',
      'em_atraso',
      'cancelada',
      'cancelada',
      'incompleta',
    ])
    expect(estadoSubscricao('active', true)).toBe('cancelada')
  })

  it('fatura de subscrição: origem subscricao, período inclusivo em dias de Lisboa', async () => {
    const inicio = Date.parse('2026-10-12T23:00:00Z') / 1000 // 13/10 00:00 WEST
    const fim = Date.parse('2026-11-13T00:00:00Z') / 1000 // 13/11 00:00 WET
    const inv = faturaStripe({ id: 'in_sub1', total: 3567, subscricao: { id: 'sub_1', inicio, fim, instituicaoId: 'lar-1' } })
    expect(periodoSubscricao(inv as unknown as Stripe.Invoice)).toEqual({ inicio: '2026-10-13', fim: '2026-11-12' })
    const r = await mapear(evento('invoice.finalized', inv))
    expect(r.operacoes).toEqual([
      {
        op: 'fatura_estado',
        stripe_invoice_id: 'in_sub1',
        fatura_id: null,
        origem: 'subscricao',
        estado: 'emitida',
        em: EM,
        url: 'https://invoice.stripe.com/i/in_sub1',
        numero: 'EL-0001',
        motivo: null,
        metodo: null,
        total_centimos: 3567,
        subscricao: { stripe_subscription_id: 'sub_1', instituicao_id: 'lar-1', periodo_inicio: '2026-10-13', periodo_fim: '2026-11-12' },
      },
    ])
  })
})

describe('lares (v1)', () => {
  it('checkout.session.completed (setup, SEPA) → metodo_definido + método predefinido no cliente', async () => {
    const si = {
      id: 'seti_1',
      object: 'setup_intent',
      customer: 'cus_1',
      metadata: { instituicao_id: 'lar-1' },
      payment_method: { id: 'pm_sepa', object: 'payment_method', type: 'sepa_debit', sepa_debit: { last4: '3000', bank_code: '0002', country: 'PT' } },
      mandate: { id: 'mandate_1', object: 'mandate', status: 'active', payment_method_details: { type: 'sepa_debit', sepa_debit: { reference: 'MANDATO-7Q2K', url: 'https://x' } } },
    } as unknown as Stripe.SetupIntent
    const s = stripeCom((x) => x.setupIntents.set('seti_1', si))
    const e = evento('checkout.session.completed', sessaoCheckout({ id: 'cs_s', mode: 'setup', setup_intent: 'seti_1', customer: 'cus_1', instituicaoId: 'lar-1' }))
    expect(leituraDoEvento(e)).toEqual({ tipo: 'setup_intent', id: 'seti_1' })
    expect(await mapear(e, s)).toEqual({
      operacoes: [
        {
          op: 'metodo_definido',
          stripe_customer_id: 'cus_1',
          instituicao_id: 'lar-1',
          payment_method_id: 'pm_sepa',
          tipo: 'sepa_debit',
          ultimos4: '3000',
          banco: '0002',
          validade: null,
          mandato_ref: 'MANDATO-7Q2K',
        },
      ],
      efeitos: [{ tipo: 'metodo_predefinido', customerId: 'cus_1', paymentMethodId: 'pm_sepa', instituicaoId: 'lar-1', atualizarCliente: true }],
    })
  })

  it('setup com cartão: marca, últimos 4 e validade', () => {
    const si = { id: 'seti_2', customer: 'cus_1', metadata: {}, mandate: null, payment_method: { id: 'pm_card', type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 4, exp_year: 2030 } } } as unknown as Stripe.SetupIntent
    const r = interpretarEvento(evento('checkout.session.completed', sessaoCheckout({ id: 'cs_c', mode: 'setup', setup_intent: 'seti_2', instituicaoId: 'lar-1' })), { setupIntent: si })
    expect(r.operacoes).toMatchObject([{ op: 'metodo_definido', tipo: 'card', ultimos4: '4242', banco: 'visa', validade: '04/2030', mandato_ref: null }])
  })

  it('invoice.finalized (cobrança por entrada) → emitida, com fatura_id de metadata', async () => {
    const r = await mapear(evento('invoice.finalized', faturaStripe({ id: 'in_1', total: 36900, faturaId: 'fat-1', instituicaoId: 'lar-1' })))
    expect(r.operacoes).toMatchObject([{ op: 'fatura_estado', stripe_invoice_id: 'in_1', fatura_id: 'fat-1', origem: 'entradas', estado: 'emitida', total_centimos: 36900, subscricao: null }])
  })

  it('invoice.paid → paga + método efetivamente usado (lê os pagamentos da fatura)', async () => {
    const s = stripeCom((x) => x.faturasComPagamentos.set('in_1', faturaComPagamento('in_1', 'sepa_debit')))
    const e = evento('invoice.paid', faturaStripe({ id: 'in_1', total: 36900, faturaId: 'fat-1' }))
    expect(leituraDoEvento(e)).toEqual({ tipo: 'fatura_pagamentos', invoiceId: 'in_1' })
    expect((await mapear(e, s)).operacoes).toMatchObject([{ op: 'fatura_estado', estado: 'paga', metodo: 'sepa_debit', motivo: null }])
  })

  it('invoice.payment_failed → falhou + motivo normalizado; a mensagem do Stripe nunca passa', async () => {
    const inv = faturaComPagamento('in_2', 'sepa_debit', { code: 'insufficient_funds' })
    ;(inv.payments!.data[0]!.payment.payment_intent as unknown as { last_payment_error: Record<string, unknown> }).last_payment_error.message = MENSAGEM_STRIPE
    const s = stripeCom((x) => x.faturasComPagamentos.set('in_2', inv))
    const r = await mapear(evento('invoice.payment_failed', { ...faturaStripe({ id: 'in_2', total: 36900, faturaId: 'fat-2' }), last_finalization_error: { message: MENSAGEM_STRIPE } }), s)
    expect(r.operacoes).toMatchObject([{ op: 'fatura_estado', estado: 'falhou', motivo: 'saldo_insuficiente', metodo: null }])
    expect(JSON.stringify(r)).not.toMatch(/insufficient|contact your bank/i)
  })

  it('invoice.voided → anulada', async () => {
    expect((await mapear(evento('invoice.voided', faturaStripe({ id: 'in_3', total: 18450 })))).operacoes).toMatchObject([{ op: 'fatura_estado', estado: 'anulada' }])
  })

  it('payment_intent.processing (SEPA de uma fatura) → em_processamento; PI de uma família → nada', async () => {
    const s = stripeCom((x) => x.faturaDePI.set('pi_inv', 'in_1'))
    const e = evento('payment_intent.processing', { id: 'pi_inv', object: 'payment_intent', metadata: {}, payment_method_types: ['sepa_debit'] })
    expect(leituraDoEvento(e)).toEqual({ tipo: 'fatura_do_payment_intent', paymentIntentId: 'pi_inv' })
    expect((await mapear(e, s)).operacoes).toMatchObject([{ op: 'fatura_estado', stripe_invoice_id: 'in_1', estado: 'em_processamento', metodo: 'sepa_debit' }])
    const familia = evento('payment_intent.processing', { id: 'pi_fam', metadata: { pagamento_id: 'pag-1' }, payment_method_types: ['multibanco'] })
    expect(leituraDoEvento(familia)).toBeNull()
    expect(interpretarEvento(familia).operacoes).toEqual([])
    expect((await operacoesDoEvento(evento('payment_intent.processing', { id: 'pi_x', metadata: {} }), stripeCom())).operacoes).toEqual([])
  })

  it('payment_method.detached → metodo_removido (o cliente vem de previous_attributes)', async () => {
    const r = await mapear(evento('payment_method.detached', { id: 'pm_sepa', object: 'payment_method', customer: null }, { previous_attributes: { customer: 'cus_1' } }))
    expect(r.operacoes).toEqual([{ op: 'metodo_removido', stripe_customer_id: 'cus_1', payment_method_id: 'pm_sepa' }])
  })

  it('mandate.updated inativo → metodo_removido; ativo → nada', async () => {
    expect((await mapear(evento('mandate.updated', { id: 'mandate_1', status: 'inactive', payment_method: 'pm_sepa' }))).operacoes).toEqual([
      { op: 'metodo_removido', stripe_customer_id: null, payment_method_id: 'pm_sepa' },
    ])
    expect(interpretarEvento(evento('mandate.updated', { id: 'mandate_1', status: 'active', payment_method: 'pm_sepa' })).operacoes).toEqual([])
  })

  it('customer.updated com novo método predefinido (portal) → metodo_definido + subscrição; outras mudanças → nada', async () => {
    const s = stripeCom((x) => x.metodos.set('pm_novo', { id: 'pm_novo', type: 'sepa_debit', sepa_debit: { last4: '0154', bank_code: '0035' } } as unknown as Stripe.PaymentMethod))
    const c = { id: 'cus_1', object: 'customer', metadata: { instituicao_id: 'lar-1' }, invoice_settings: { default_payment_method: 'pm_novo' } }
    const e = evento('customer.updated', c, { previous_attributes: { invoice_settings: { default_payment_method: 'pm_velho' } } })
    expect(leituraDoEvento(e)).toEqual({ tipo: 'metodo_pagamento', id: 'pm_novo' })
    expect(await mapear(e, s)).toEqual({
      operacoes: [{ op: 'metodo_definido', stripe_customer_id: 'cus_1', instituicao_id: 'lar-1', payment_method_id: 'pm_novo', tipo: 'sepa_debit', ultimos4: '0154', banco: '0035', validade: null, mandato_ref: null }],
      efeitos: [{ tipo: 'metodo_predefinido', customerId: 'cus_1', paymentMethodId: 'pm_novo', instituicaoId: 'lar-1', atualizarCliente: false }],
    })
    expect(leituraDoEvento(evento('customer.updated', c, { previous_attributes: { email: 'antigo@lar.pt' } }))).toBeNull()
  })

  it('charge.dispute.created → disputa (o cliente lê-se da carga)', async () => {
    const s = stripeCom((x) => x.cargas.set('ch_9', { id: 'ch_9', customer: 'cus_1' } as unknown as Stripe.Charge))
    const r = await mapear(evento('charge.dispute.created', { id: 'dp_1', object: 'dispute', charge: 'ch_9', payment_intent: 'pi_9', reason: 'debit_not_authorized', amount: 18450 }), s)
    expect(r.operacoes).toEqual([{ op: 'disputa', stripe_customer_id: 'cus_1', payment_intent_id: 'pi_9', charge_id: 'ch_9', motivo: 'debit_not_authorized', valor_centimos: 18450 }])
  })

  it('eventos desconhecidos → sem operações nem leituras', async () => {
    const e = evento('customer.created', { id: 'cus_1' })
    expect(leituraDoEvento(e)).toBeNull()
    expect(await operacoesDoEvento(e, stripeCom())).toEqual({ operacoes: [], efeitos: [] })
  })

  it('todos os eventos da lista do endpoint foram mapeados neste ficheiro', () => {
    expect([...EVENTOS_TRATADOS].filter((t) => !cobertos.has(t))).toEqual([])
  })
})

describe('motivos normalizados', () => {
  it('códigos SEPA e cartão → motivo; desconhecido → outro; textos em PT-PT', () => {
    expect(normalizarMotivo({ codigo: 'insufficient_funds' })).toBe('saldo_insuficiente')
    expect(normalizarMotivo({ codigo: 'card_declined', declineCode: 'insufficient_funds' })).toBe('saldo_insuficiente')
    expect(normalizarMotivo({ codigo: 'card_declined', declineCode: 'do_not_honor' })).toBe('cartao_recusado')
    expect(normalizarMotivo({ codigo: 'expired_card' })).toBe('cartao_expirado')
    expect(normalizarMotivo({ codigo: 'debit_not_authorized' })).toBe('mandato_revogado')
    expect(normalizarMotivo({ codigo: 'authentication_required' })).toBe('autenticacao_falhou')
    expect(normalizarMotivo({ codigo: null, tipoMetodo: 'multibanco' })).toBe('referencia_expirada')
    expect(normalizarMotivo({ codigo: 'qualquer_coisa' })).toBe('outro')
    expect(normalizarMotivo(null)).toBe('outro')
    expect(normalizarMotivo({ codigo: '__proto__' })).toBe('outro')
    for (const t of Object.values(MOTIVOS_FALHA)) expect(t).toMatch(/^[A-ZÀ-Ú][^]*\.$/)
  })
})
