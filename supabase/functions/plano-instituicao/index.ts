// plano-instituicao — mudança de modalidade do lar privado e subscrição mensal no Stripe. JWT obrigatório.
import { servir } from '../_shared/deno/arranque.ts'
import { criarStripe, portaStripe } from '../_shared/deno/stripe.ts'
import { portaBD, portaUtilizadorDe } from '../_shared/deno/supabase.ts'
import { criarHandlerPlanoInstituicao } from '../_shared/funcoes/plano-instituicao.ts'

servir('plano-instituicao', ['utilizador'], (config, registo) =>
  criarHandlerPlanoInstituicao({
    config,
    registo,
    agora: Date.now,
    bd: portaBD(config),
    stripe: portaStripe(criarStripe(config)),
    utilizadorDe: portaUtilizadorDe(config),
  }),
)
