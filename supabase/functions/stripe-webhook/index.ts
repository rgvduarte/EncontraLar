// stripe-webhook — eventos do Stripe (assinatura verificada, idempotente). Deploy com --no-verify-jwt.
import { agendar, criarEmissor, servir } from '../_shared/deno/arranque.ts'
import { criarStripe, portaStripe, verificadorWebhook } from '../_shared/deno/stripe.ts'
import { portaBD } from '../_shared/deno/supabase.ts'
import { criarHandlerStripeWebhook } from '../_shared/funcoes/stripe-webhook.ts'

servir('stripe-webhook', ['webhook', 'emissor'], (config, registo) => {
  const stripe = criarStripe(config)
  return criarHandlerStripeWebhook({
    config,
    registo,
    agora: Date.now,
    bd: portaBD(config),
    stripe: portaStripe(stripe),
    emissor: criarEmissor(config),
    verificador: verificadorWebhook(stripe),
    agendar,
  })
})
