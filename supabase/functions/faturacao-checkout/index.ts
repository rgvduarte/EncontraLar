// faturacao-checkout — mandato SEPA (ou cartão) do lar: Stripe Checkout em modo setup. JWT obrigatório.
import { servir } from '../_shared/deno/arranque.ts'
import { criarStripe, portaStripe } from '../_shared/deno/stripe.ts'
import { portaBD, portaUtilizadorDe } from '../_shared/deno/supabase.ts'
import { criarHandlerFaturacaoCheckout } from '../_shared/funcoes/faturacao.ts'

servir('faturacao-checkout', ['utilizador'], (config, registo) =>
  criarHandlerFaturacaoCheckout({
    config,
    registo,
    agora: Date.now,
    bd: portaBD(config),
    stripe: portaStripe(criarStripe(config)),
    utilizadorDe: portaUtilizadorDe(config),
  }),
)
