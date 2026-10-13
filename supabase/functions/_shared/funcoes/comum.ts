/**
 * Peças comuns aos handlers (puros: recebem Request, devolvem Response). Cada função Deno liga a
 * configuração, os adaptadores e um destes handlers (supabase/functions/<nome>/index.ts).
 */
import type { Config } from '../config.ts'
import { cabecalhosCors, origemRecusada, preflight } from '../http/cors.ts'
import { MENSAGENS, respostaErro } from '../http/respostas.ts'
import { ErroBD, type PortaUtilizador, type Registo } from '../portas.ts'
import { erroSeguro } from '../erros.ts'

export type Handler = (req: Request) => Promise<Response>

export interface DepsComuns {
  config: Config
  registo: Registo
  agora: () => number
}

export interface DepsUtilizador extends DepsComuns {
  /** cliente Supabase com o Authorization do pedido */
  utilizadorDe: (req: Request) => PortaUtilizador
}

/** Contexto de um pedido de utilizador: CORS já resolvido. */
export interface Pedido {
  req: Request
  cors: Record<string, string>
}

/**
 * Envolve um handler de utilizador: preflight, origem, só POST, e qualquer exceção → 500 genérico
 * (registado sem dados pessoais).
 */
export function handlerUtilizador(nome: string, d: DepsComuns, f: (p: Pedido) => Promise<Response>): Handler {
  return async (req) => {
    const origens = d.config.app.origens
    const pf = preflight(req, origens)
    if (pf) return pf
    const cors = cabecalhosCors(req.headers.get('origin'), origens)
    if (origemRecusada(req, origens)) return respostaErro(403, 'origem', MENSAGENS.origem, cors)
    if (req.method !== 'POST') return respostaErro(405, 'metodo', MENSAGENS.metodo, { ...cors, Allow: 'POST, OPTIONS' })
    try {
      return await f({ req, cors })
    } catch (e) {
      d.registo.erro(`${nome}_erro`, { erro: erroSeguro(e) })
      return respostaErro(500, 'interno', MENSAGENS.interno, cors)
    }
  }
}

/**
 * Erro de uma RPC → resposta. Só as mensagens das nossas exceções de regra de negócio (42501, 22023, P0002)
 * chegam ao utilizador; o resto é genérico.
 */
export function respostaDeErroBD(e: unknown, cors: Record<string, string>, registo: Registo, contexto: string): Response {
  if (e instanceof ErroBD) {
    if (e.codigo === '42501') return respostaErro(403, 'sem_permissao', e.message, cors)
    if (e.codigo === '22023') return respostaErro(409, 'regra', e.message, cors)
    if (e.codigo === 'P0002') return respostaErro(404, 'nao_encontrado', e.message, cors)
    if (e.codigo === 'PGRST301' || e.codigo === '401') return respostaErro(401, 'sessao', MENSAGENS.sessao, cors)
  }
  registo.erro(`${contexto}_bd`, { erro: erroSeguro(e) })
  return respostaErro(500, 'interno', MENSAGENS.interno, cors)
}

/** Corre uma chamada à BD e devolve o resultado ou a resposta de erro. */
export async function tentarBD<T>(f: () => Promise<T>, cors: Record<string, string>, registo: Registo, contexto: string): Promise<{ ok: true; valor: T } | { ok: false; resposta: Response }> {
  try {
    return { ok: true, valor: await f() }
  } catch (e) {
    return { ok: false, resposta: respostaDeErroBD(e, cors, registo, contexto) }
  }
}
