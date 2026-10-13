// Arranque comum das funções Deno: lê a configuração, monta os adaptadores e serve o handler puro.
// Se a configuração falhar, todas as respostas são 500 genéricas e os problemas (sem valores) vão para o log.
import { lerConfig, type Config, type Necessidade } from '../config.ts'
import { EmissorFalso, type EmissorFaturas } from '../faturacao/emissor.ts'
import type { Handler } from '../funcoes/comum.ts'
import { MENSAGENS, respostaErro } from '../http/respostas.ts'
import { MoloniEmissor } from '../moloni/cliente.ts'
import type { Registo } from '../portas.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

export function registoDe(funcao: string): Registo {
  const escrever = (nivel: 'info' | 'erro') => (evento: string, dados?: Record<string, unknown>) =>
    (nivel === 'erro' ? console.error : console.log)(JSON.stringify({ funcao, nivel, evento, ...dados }))
  return { info: escrever('info'), erro: escrever('erro') }
}

/** Trabalho depois da resposta (EdgeRuntime.waitUntil; fora do Supabase, só deixa a promessa correr). */
export function agendar(p: Promise<unknown>): void {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p)
  else p.catch(() => {})
}

export function criarEmissor(cfg: Config): EmissorFaturas {
  if (cfg.faturacao.emissor === 'moloni' && cfg.moloni) return new MoloniEmissor(cfg.moloni, (url, init) => fetch(url, init))
  return new EmissorFalso()
}

export function servir(funcao: string, necessidades: readonly Necessidade[], construir: (cfg: Config, registo: Registo) => Handler): void {
  const registo = registoDe(funcao)
  const r = lerConfig(Deno.env.toObject(), necessidades)
  if (!r.ok) {
    registo.erro('configuracao_invalida', { problemas: r.problemas })
    Deno.serve(() => respostaErro(500, 'configuracao', MENSAGENS.configuracao))
    return
  }
  const handler = construir(r.config, registo)
  Deno.serve((req) => handler(req))
}
