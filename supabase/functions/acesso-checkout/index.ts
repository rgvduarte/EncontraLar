// acesso-checkout — compra do Acesso Família (Stripe Checkout: cartão, MB WAY, Multibanco). JWT obrigatório.
import { servir } from '../_shared/deno/arranque.ts'
import { portaStripe, criarStripe } from '../_shared/deno/stripe.ts'
import { portaBD, portaUtilizadorDe } from '../_shared/deno/supabase.ts'
import { criarHandlerAcessoCheckout } from '../_shared/funcoes/acesso-checkout.ts'

servir('acesso-checkout', ['utilizador'], (config, registo) =>
  criarHandlerAcessoCheckout({
    config,
    registo,
    agora: Date.now,
    bd: portaBD(config),
    stripe: portaStripe(criarStripe(config)),
    utilizadorDe: portaUtilizadorDe(config),
  }),
)
