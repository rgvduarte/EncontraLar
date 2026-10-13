// faturacao-documento — link do PDF de uma FT/FR/RC que o utilizador pode ler (RLS). JWT obrigatório.
import { criarEmissor, servir } from '../_shared/deno/arranque.ts'
import { portaBD, portaUtilizadorDe } from '../_shared/deno/supabase.ts'
import { criarHandlerFaturacaoDocumento } from '../_shared/funcoes/faturacao.ts'

servir('faturacao-documento', ['utilizador', 'emissor'], (config, registo) =>
  criarHandlerFaturacaoDocumento({
    config,
    registo,
    agora: Date.now,
    bd: portaBD(config),
    emissor: criarEmissor(config),
    utilizadorDe: portaUtilizadorDe(config),
  }),
)
