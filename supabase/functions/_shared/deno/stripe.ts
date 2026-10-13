// Adaptador Deno do Stripe. ÚNICO sítio (com supabase.ts) que importa o SDK em runtime.
// A versão é a mesma do devDependency `stripe` do package.json (fronteira.test.ts confirma).
import Stripe from 'npm:stripe@23.0.0'
import type { Config } from '../config.ts'
import type { PortaStripe } from '../stripe/porta.ts'
import { STRIPE_API_VERSION } from '../stripe/versao.ts'
import type { VerificadorWebhook } from '../stripe/webhook.ts'

export function criarStripe(cfg: Config): Stripe {
  return new Stripe(cfg.stripe.chaveSecreta, {
    apiVersion: STRIPE_API_VERSION,
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: 'EncontraLar', url: 'https://encontralar.pt' },
  })
}

export function verificadorWebhook(stripe: Stripe): VerificadorWebhook {
  return { webhooks: stripe.webhooks, cripto: Stripe.createSubtleCryptoProvider() }
}

export function portaStripe(s: Stripe): PortaStripe {
  return {
    criarCliente: (p, o) => s.customers.create(p, o),
    atualizarCliente: (id, p, o) => s.customers.update(id, p, o),
    apagarCliente: async (id) => {
      await s.customers.del(id)
    },
    listarTaxIds: async (cliente) => (await s.customers.listTaxIds(cliente, { limit: 20 })).data.map((t) => ({ id: t.id, type: t.type, value: t.value })),
    criarTaxId: (cliente, p, o) => s.customers.createTaxId(cliente, p, o),
    apagarTaxId: async (cliente, id) => {
      await s.customers.deleteTaxId(cliente, id)
    },
    criarSessaoCheckout: (p, o) => s.checkout.sessions.create(p, o),
    criarSessaoPortal: (p, o) => s.billingPortal.sessions.create(p, o),
    criarSubscricao: (p, o) => s.subscriptions.create(p, o),
    atualizarSubscricao: (id, p, o) => s.subscriptions.update(id, p, o),
    cancelarSubscricao: (id, p, o) => s.subscriptions.cancel(id, p, o),
    criarFatura: (p, o) => s.invoices.create(p, o),
    criarItemFatura: (p, o) => s.invoiceItems.create(p, o),
    finalizarFatura: (id, p, o) => s.invoices.finalizeInvoice(id, p, o),
    enviarFatura: (id, o) => s.invoices.sendInvoice(id, {}, o),
    pagarFatura: (id, p, o) => s.invoices.pay(id, p, o),
    lerSetupIntent: (id) => s.setupIntents.retrieve(id, { expand: ['payment_method', 'mandate'] }),
    lerPaymentIntent: (id) => s.paymentIntents.retrieve(id, { expand: ['payment_method'] }),
    lerMetodoPagamento: (id) => s.paymentMethods.retrieve(id),
    lerFaturaComPagamentos: (id) => s.invoices.retrieve(id, { expand: ['payments.data.payment.payment_intent.payment_method'] }),
    faturaDoPaymentIntent: async (pi) => {
      const r = await s.invoicePayments.list({ payment: { type: 'payment_intent', payment_intent: pi }, limit: 1 })
      const inv = r.data[0]?.invoice
      return typeof inv === 'string' ? inv : inv?.id ?? null
    },
    lerCarga: (id) => s.charges.retrieve(id),
  }
}
