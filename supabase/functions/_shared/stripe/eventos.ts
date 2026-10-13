/**
 * Evento do Stripe → operações (vocabulário de servico_evento_aplicar, portas.ts) + efeitos no Stripe.
 *
 * Em três passos, para o mapeamento ficar puro e testável:
 *   1. leituraDoEvento(evento): que objeto falta ler ao Stripe (no máximo um por evento), ou null;
 *   2. executarLeitura(leitura, stripe): a única parte com rede (adaptador);
 *   3. interpretarEvento(evento, lido): operações para a base de dados e efeitos idempotentes no Stripe.
 *
 * Eventos tratados (o resto: 200 sem operações) — a lista do endpoint no painel do Stripe:
 *   famílias:     checkout.session.completed (payment: paid | unpaid), checkout.session.async_payment_succeeded,
 *                 checkout.session.async_payment_failed, checkout.session.expired, charge.refunded
 *   mensalidade:  customer.subscription.created / updated / deleted; faturas com subscrição → origem 'subscricao'
 *   v1 (lares):   checkout.session.completed (setup), invoice.finalized, invoice.paid, invoice.payment_failed,
 *                 invoice.voided, payment_intent.processing, payment_method.detached, mandate.updated,
 *                 customer.updated, charge.dispute.created
 *
 * As mensagens do Stripe nunca passam: os erros viram MotivoFalha (motivos.ts).
 */
import type Stripe from 'stripe'
import { deSegundos, diaLisboa, somarDiasData } from '../faturacao/datas.ts'
import type { EstadoSubscricao, MetodoFamilia, MetodoPagamentoB2B, MetodoPago, OperacaoEvento, OrigemFatura } from '../portas.ts'
import { normalizarMotivo } from './motivos.ts'
import type { PortaStripe } from './porta.ts'

export const EVENTOS_TRATADOS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'checkout.session.expired',
  'charge.refunded',
  'charge.dispute.created',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.updated',
  'invoice.finalized',
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.voided',
  'payment_intent.processing',
  'payment_method.detached',
  'mandate.updated',
] as const

export type EventoTratado = (typeof EVENTOS_TRATADOS)[number]

export type Leitura =
  | { tipo: 'setup_intent'; id: string }
  | { tipo: 'payment_intent'; id: string }
  | { tipo: 'fatura_pagamentos'; invoiceId: string }
  | { tipo: 'fatura_do_payment_intent'; paymentIntentId: string }
  | { tipo: 'metodo_pagamento'; id: string }
  | { tipo: 'carga'; id: string }

export interface Lido {
  setupIntent?: Stripe.SetupIntent
  paymentIntent?: Stripe.PaymentIntent
  fatura?: Stripe.Invoice
  faturaDoPaymentIntent?: string | null
  metodoPagamento?: Stripe.PaymentMethod
  carga?: Stripe.Charge
}

/** Escritas idempotentes no Stripe, feitas antes de aplicar as operações (se falharem, o evento repete). */
export type Efeito = {
  tipo: 'metodo_predefinido'
  customerId: string
  paymentMethodId: string
  instituicaoId: string | null
  /** false quando o próprio cliente já o tem (mudança feita no portal) */
  atualizarCliente: boolean
}

export interface Interpretacao {
  operacoes: OperacaoEvento[]
  efeitos: Efeito[]
}

const nada = (): Interpretacao => ({ operacoes: [], efeitos: [] })

// ————————————————————————————————————————————————————————————— utilitários

const idDe = (v: string | { id: string } | null | undefined): string | null => (typeof v === 'string' ? v : v?.id ?? null)

const meta = (m: Stripe.Metadata | null | undefined, k: string): string | null => {
  const v = m?.[k]
  return typeof v === 'string' && v.length ? v : null
}

const quando = (evento: Stripe.Event): string => deSegundos(evento.created)!

export function metodoFamilia(tipo: string | null | undefined): MetodoFamilia | null {
  return tipo === 'card' || tipo === 'mb_way' || tipo === 'multibanco' ? tipo : null
}

function metodoPago(tipo: string | null | undefined): MetodoPago | null {
  return tipo === 'sepa_debit' || tipo === 'card' || tipo === 'customer_balance' ? tipo : null
}

export function estadoSubscricao(status: string, apagada = false): EstadoSubscricao {
  if (apagada) return 'cancelada'
  switch (status) {
    case 'active':
    case 'trialing':
      return 'ativa'
    case 'past_due':
    case 'unpaid':
    case 'paused':
      return 'em_atraso'
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelada'
    default:
      return 'incompleta'
  }
}

export function origemFatura(inv: Stripe.Invoice): { origem: OrigemFatura; subscriptionId: string | null; instituicaoId: string | null } {
  const det = inv.parent?.subscription_details
  if (inv.parent?.type === 'subscription_details' && det) {
    return { origem: 'subscricao', subscriptionId: idDe(det.subscription), instituicaoId: meta(det.metadata, 'instituicao_id') }
  }
  return { origem: 'entradas', subscriptionId: null, instituicaoId: meta(inv.metadata, 'instituicao_id') }
}

/** Período da mensalidade: [início, fim] inclusivo em dias de Lisboa (o fim do Stripe é exclusivo). */
export function periodoSubscricao(inv: Stripe.Invoice): { inicio: string; fim: string } {
  const linha = inv.lines?.data?.find((l) => l.period?.start && l.period?.end)
  const ini = linha?.period.start ?? inv.period_start
  const fim = linha?.period.end ?? inv.period_end
  return { inicio: diaLisboa(ini * 1000), fim: somarDiasData(diaLisboa(fim * 1000), -1) }
}

export interface ResumoMetodo {
  tipo: MetodoPagamentoB2B
  ultimos4: string
  banco: string | null
  validade: string | null
  mandatoRef: string | null
}

export function resumoMetodo(pm: Stripe.PaymentMethod, mandato?: Stripe.Mandate | string | null): ResumoMetodo | null {
  if (pm.type === 'sepa_debit' && pm.sepa_debit?.last4) {
    const ref = typeof mandato === 'object' && mandato ? mandato.payment_method_details?.sepa_debit?.reference ?? null : null
    return { tipo: 'sepa_debit', ultimos4: pm.sepa_debit.last4, banco: pm.sepa_debit.bank_code ?? null, validade: null, mandatoRef: ref }
  }
  if (pm.type === 'card' && pm.card?.last4) {
    const validade = pm.card.exp_month && pm.card.exp_year ? `${String(pm.card.exp_month).padStart(2, '0')}/${pm.card.exp_year}` : null
    return { tipo: 'card', ultimos4: pm.card.last4, banco: pm.card.brand ?? null, validade, mandatoRef: null }
  }
  return null
}

/** Método e erro do último pagamento de uma fatura (lida com payments expandidos). */
export function pagamentoDaFatura(inv: Stripe.Invoice | undefined): { metodo: MetodoPago | null; tipo: string | null; erro: { codigo: string | null; declineCode: string | null } | null } {
  const pagamentos = inv?.payments?.data ?? []
  const ultimo = [...pagamentos].sort((a, b) => (b.created ?? 0) - (a.created ?? 0))[0]
  const pi = ultimo?.payment?.payment_intent
  if (!pi || typeof pi === 'string') return { metodo: null, tipo: null, erro: null }
  const pm = pi.payment_method && typeof pi.payment_method === 'object' ? pi.payment_method : null
  const tipo = pm?.type ?? pi.last_payment_error?.payment_method?.type ?? null
  const e = pi.last_payment_error
  return {
    metodo: metodoPago(tipo),
    tipo,
    erro: e ? { codigo: e.code ?? null, declineCode: e.decline_code ?? null } : null,
  }
}

function tipoMetodoDoPI(pi: Stripe.PaymentIntent | undefined): string | null {
  if (!pi) return null
  if (pi.payment_method && typeof pi.payment_method === 'object') return pi.payment_method.type
  return pi.last_payment_error?.payment_method?.type ?? (pi.payment_method_types?.length === 1 ? pi.payment_method_types[0]! : null)
}

const eSessaoAcesso = (s: Stripe.Checkout.Session) => s.mode === 'payment' && !!meta(s.metadata, 'pagamento_id')

// ————————————————————————————————————————————————————————————— 1. que leitura falta

export function leituraDoEvento(evento: Stripe.Event): Leitura | null {
  switch (evento.type) {
    case 'checkout.session.completed': {
      const s = evento.data.object
      if (s.mode === 'setup') {
        const si = idDe(s.setup_intent)
        return si ? { tipo: 'setup_intent', id: si } : null
      }
      const pi = idDe(s.payment_intent)
      return eSessaoAcesso(s) && pi && s.payment_status !== 'no_payment_required' ? { tipo: 'payment_intent', id: pi } : null
    }
    case 'checkout.session.async_payment_succeeded':
    case 'checkout.session.async_payment_failed': {
      const s = evento.data.object
      const pi = idDe(s.payment_intent)
      return eSessaoAcesso(s) && pi ? { tipo: 'payment_intent', id: pi } : null
    }
    case 'invoice.paid':
    case 'invoice.payment_failed':
      return evento.data.object.id ? { tipo: 'fatura_pagamentos', invoiceId: evento.data.object.id } : null
    case 'payment_intent.processing': {
      const pi = evento.data.object
      return meta(pi.metadata, 'pagamento_id') ? null : { tipo: 'fatura_do_payment_intent', paymentIntentId: pi.id }
    }
    case 'customer.updated': {
      const c = evento.data.object
      const antes = evento.data.previous_attributes?.invoice_settings
      const novo = idDe(c.invoice_settings?.default_payment_method)
      return antes && 'default_payment_method' in antes && novo && novo !== idDe(antes.default_payment_method ?? null)
        ? { tipo: 'metodo_pagamento', id: novo }
        : null
    }
    case 'charge.dispute.created': {
      const ch = idDe(evento.data.object.charge)
      return ch ? { tipo: 'carga', id: ch } : null
    }
    default:
      return null
  }
}

// ————————————————————————————————————————————————————————————— 2. ler (rede)

export async function executarLeitura(l: Leitura, stripe: PortaStripe): Promise<Lido> {
  switch (l.tipo) {
    case 'setup_intent':
      return { setupIntent: await stripe.lerSetupIntent(l.id) }
    case 'payment_intent':
      return { paymentIntent: await stripe.lerPaymentIntent(l.id) }
    case 'fatura_pagamentos':
      return { fatura: await stripe.lerFaturaComPagamentos(l.invoiceId) }
    case 'fatura_do_payment_intent':
      return { faturaDoPaymentIntent: await stripe.faturaDoPaymentIntent(l.paymentIntentId) }
    case 'metodo_pagamento':
      return { metodoPagamento: await stripe.lerMetodoPagamento(l.id) }
    case 'carga':
      return { carga: await stripe.lerCarga(l.id) }
  }
}

// ————————————————————————————————————————————————————————————— 3. interpretar

export class ErroEvento extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroEvento'
  }
}

function exigir<T>(v: T | undefined | null, o: string): T {
  if (v === undefined || v === null) throw new ErroEvento(`Falta a leitura: ${o}.`)
  return v
}

function acessoPago(s: Stripe.Checkout.Session, pi: Stripe.PaymentIntent, em: string): OperacaoEvento {
  return {
    op: 'acesso_pago',
    session_id: s.id,
    pagamento_id: meta(s.metadata, 'pagamento_id'),
    payment_intent_id: pi.id,
    metodo: metodoFamilia(tipoMetodoDoPI(pi)),
    valor_centimos: s.amount_total ?? 0,
    pago_em: em,
  }
}

export function interpretarEvento(evento: Stripe.Event, lido: Lido = {}): Interpretacao {
  const em = quando(evento)
  switch (evento.type) {
    // ——— Checkout: famílias (payment) e mandato dos lares (setup)
    case 'checkout.session.completed': {
      const s = evento.data.object
      if (s.mode === 'setup') {
        const si = exigir(lido.setupIntent, 'setup_intent')
        const pm = si.payment_method && typeof si.payment_method === 'object' ? si.payment_method : null
        const customer = idDe(si.customer) ?? idDe(s.customer)
        const r = pm ? resumoMetodo(pm, si.mandate) : null
        if (!pm || !r || !customer) return nada()
        const instituicaoId = meta(s.metadata, 'instituicao_id') ?? meta(si.metadata, 'instituicao_id')
        return {
          operacoes: [
            {
              op: 'metodo_definido',
              stripe_customer_id: customer,
              instituicao_id: instituicaoId,
              payment_method_id: pm.id,
              tipo: r.tipo,
              ultimos4: r.ultimos4,
              banco: r.banco,
              validade: r.validade,
              mandato_ref: r.mandatoRef,
            },
          ],
          efeitos: [{ tipo: 'metodo_predefinido', customerId: customer, paymentMethodId: pm.id, instituicaoId, atualizarCliente: true }],
        }
      }
      if (!eSessaoAcesso(s) || s.payment_status === 'no_payment_required') return nada()
      const pi = exigir(lido.paymentIntent, 'payment_intent')
      if (s.payment_status === 'paid') return { operacoes: [acessoPago(s, pi, em)], efeitos: [] }
      const mb = pi.next_action?.multibanco_display_details
      return {
        operacoes: [
          {
            op: 'acesso_a_aguardar',
            session_id: s.id,
            pagamento_id: meta(s.metadata, 'pagamento_id'),
            payment_intent_id: pi.id,
            metodo: metodoFamilia(tipoMetodoDoPI(pi)) ?? (mb ? 'multibanco' : null),
            entidade: mb?.entity ?? null,
            referencia: mb?.reference ?? null,
            expira_em: deSegundos(mb?.expires_at),
          },
        ],
        efeitos: [],
      }
    }
    case 'checkout.session.async_payment_succeeded': {
      const s = evento.data.object
      if (!eSessaoAcesso(s)) return nada()
      return { operacoes: [acessoPago(s, exigir(lido.paymentIntent, 'payment_intent'), em)], efeitos: [] }
    }
    case 'checkout.session.async_payment_failed': {
      const s = evento.data.object
      if (!eSessaoAcesso(s)) return nada()
      const pi = lido.paymentIntent
      const e = pi?.last_payment_error
      const motivo = normalizarMotivo({ codigo: e?.code ?? null, declineCode: e?.decline_code ?? null, tipoMetodo: tipoMetodoDoPI(pi) })
      return { operacoes: [{ op: 'acesso_falhou', session_id: s.id, pagamento_id: meta(s.metadata, 'pagamento_id'), motivo }], efeitos: [] }
    }
    case 'checkout.session.expired': {
      const s = evento.data.object
      if (!eSessaoAcesso(s)) return nada()
      return { operacoes: [{ op: 'acesso_expirado', session_id: s.id, pagamento_id: meta(s.metadata, 'pagamento_id') }], efeitos: [] }
    }
    case 'charge.refunded': {
      const ch = evento.data.object
      const pi = idDe(ch.payment_intent)
      if (!pi) return nada()
      return {
        operacoes: [{ op: 'acesso_reembolsado', payment_intent_id: pi, valor_reembolsado_centimos: ch.amount_refunded, total: ch.refunded === true, em }],
        efeitos: [],
      }
    }

    // ——— mensalidade
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = evento.data.object
      return {
        operacoes: [
          {
            op: 'subscricao_estado',
            stripe_subscription_id: sub.id,
            stripe_customer_id: idDe(sub.customer),
            instituicao_id: meta(sub.metadata, 'instituicao_id'),
            estado: estadoSubscricao(sub.status, evento.type === 'customer.subscription.deleted'),
            inicio: deSegundos(sub.start_date),
            cancelada_em: deSegundos(sub.ended_at ?? sub.canceled_at ?? null),
          },
        ],
        efeitos: [],
      }
    }

    // ——— faturas (cobranças por entrada e mensalidades)
    case 'invoice.finalized':
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.voided': {
      const inv = evento.data.object
      if (!inv.id) return nada()
      const o = origemFatura(inv)
      const p = evento.type === 'invoice.paid' || evento.type === 'invoice.payment_failed' ? pagamentoDaFatura(lido.fatura) : null
      const estado =
        evento.type === 'invoice.finalized' ? 'emitida' : evento.type === 'invoice.paid' ? 'paga' : evento.type === 'invoice.payment_failed' ? 'falhou' : 'anulada'
      const t = inv.status_transitions
      const emEstado =
        deSegundos(evento.type === 'invoice.finalized' ? t?.finalized_at : evento.type === 'invoice.paid' ? t?.paid_at : evento.type === 'invoice.voided' ? t?.voided_at : null) ?? em
      const periodo = o.origem === 'subscricao' ? periodoSubscricao(inv) : null
      return {
        operacoes: [
          {
            op: 'fatura_estado',
            stripe_invoice_id: inv.id,
            fatura_id: meta(inv.metadata, 'fatura_id'),
            origem: o.origem,
            estado,
            em: emEstado,
            url: inv.hosted_invoice_url ?? null,
            numero: inv.number ?? null,
            motivo: estado === 'falhou' ? normalizarMotivo({ codigo: p?.erro?.codigo, declineCode: p?.erro?.declineCode, tipoMetodo: p?.tipo }) : null,
            metodo: estado === 'paga' ? p?.metodo ?? null : null,
            total_centimos: inv.total,
            subscricao:
              o.origem === 'subscricao' && o.subscriptionId && periodo
                ? { stripe_subscription_id: o.subscriptionId, instituicao_id: o.instituicaoId, periodo_inicio: periodo.inicio, periodo_fim: periodo.fim }
                : null,
          },
        ],
        efeitos: [],
      }
    }
    case 'payment_intent.processing': {
      const invoiceId = lido.faturaDoPaymentIntent
      if (!invoiceId) return nada()
      const pi = evento.data.object
      return {
        operacoes: [
          {
            op: 'fatura_estado',
            stripe_invoice_id: invoiceId,
            fatura_id: null,
            origem: 'entradas',
            estado: 'em_processamento',
            em,
            url: null,
            numero: null,
            motivo: null,
            metodo: metodoPago(pi.payment_method_types?.[0]),
            total_centimos: null,
            subscricao: null,
          },
        ],
        efeitos: [],
      }
    }

    // ——— método de pagamento dos lares
    case 'payment_method.detached': {
      const pm = evento.data.object
      const antes = evento.data.previous_attributes?.customer
      return { operacoes: [{ op: 'metodo_removido', stripe_customer_id: idDe(antes ?? null), payment_method_id: pm.id }], efeitos: [] }
    }
    case 'mandate.updated': {
      const m = evento.data.object
      const pm = idDe(m.payment_method)
      if (m.status !== 'inactive' || !pm) return nada()
      return { operacoes: [{ op: 'metodo_removido', stripe_customer_id: null, payment_method_id: pm }], efeitos: [] }
    }
    case 'customer.updated': {
      const pm = lido.metodoPagamento
      const c = evento.data.object
      const r = pm ? resumoMetodo(pm) : null
      if (!pm || !r) return nada()
      const instituicaoId = meta(c.metadata, 'instituicao_id')
      return {
        operacoes: [
          {
            op: 'metodo_definido',
            stripe_customer_id: c.id,
            instituicao_id: instituicaoId,
            payment_method_id: pm.id,
            tipo: r.tipo,
            ultimos4: r.ultimos4,
            banco: r.banco,
            validade: r.validade,
            mandato_ref: r.mandatoRef,
          },
        ],
        efeitos: [{ tipo: 'metodo_predefinido', customerId: c.id, paymentMethodId: pm.id, instituicaoId, atualizarCliente: false }],
      }
    }
    case 'charge.dispute.created': {
      const d = evento.data.object
      return {
        operacoes: [
          {
            op: 'disputa',
            stripe_customer_id: idDe(lido.carga?.customer ?? null),
            payment_intent_id: idDe(d.payment_intent),
            charge_id: idDe(d.charge) ?? '',
            motivo: d.reason,
            valor_centimos: d.amount,
          },
        ],
        efeitos: [],
      }
    }
    default:
      return nada()
  }
}

/** Atalho para os testes e para o webhook: ler (se preciso) e interpretar. */
export async function operacoesDoEvento(evento: Stripe.Event, stripe: PortaStripe): Promise<Interpretacao> {
  const l = leituraDoEvento(evento)
  return interpretarEvento(evento, l ? await executarLeitura(l, stripe) : {})
}
