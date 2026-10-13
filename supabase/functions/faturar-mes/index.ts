// faturar-mes — tarefas agendadas (pg_cron → pg_net): 'diario' e 'cobranca'. Deploy com --no-verify-jwt;
// autenticação pelo cabeçalho x-encontralar-cron (comparação em tempo constante).
import { agendar, criarEmissor, servir } from '../_shared/deno/arranque.ts'
import { criarStripe, portaStripe } from '../_shared/deno/stripe.ts'
import { portaBD } from '../_shared/deno/supabase.ts'
import { criarHandlerFaturarMes } from '../_shared/funcoes/faturar-mes.ts'

servir('faturar-mes', ['cron', 'emissor'], (config, registo) =>
  criarHandlerFaturarMes({
    config,
    registo,
    agora: Date.now,
    bd: portaBD(config),
    stripe: portaStripe(criarStripe(config)),
    emissor: criarEmissor(config),
    agendar,
  }),
)
