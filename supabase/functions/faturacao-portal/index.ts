// faturacao-portal — Customer Portal do Stripe para o lar (trocar método, ver cobranças). JWT obrigatório.
import { servir } from '../_shared/deno/arranque.ts'
import { criarStripe, portaStripe } from '../_shared/deno/stripe.ts'
import { portaBD, portaUtilizadorDe } from '../_shared/deno/supabase.ts'
import { criarHandlerFaturacaoPortal } from '../_shared/funcoes/faturacao.ts'

servir('faturacao-portal', ['utilizador'], (config, registo) =>
  criarHandlerFaturacaoPortal({
    config,
    registo,
    agora: Date.now,
    bd: portaBD(config),
    stripe: portaStripe(criarStripe(config)),
    utilizadorDe: portaUtilizadorDe(config),
  }),
)
