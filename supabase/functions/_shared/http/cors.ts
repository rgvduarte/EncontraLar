/**
 * CORS das funções chamadas pela app (JWT do utilizador). Só as origens de APP_ORIGENS recebem
 * Access-Control-Allow-Origin; um pedido de browser vindo de outra origem é recusado (403). Pedidos sem
 * Origin (servidor a servidor, curl) não são de browser: seguem sem cabeçalhos CORS — a proteção é o JWT.
 */

export const METODOS_CORS = 'POST, OPTIONS'
export const CABECALHOS_CORS = 'authorization, x-client-info, apikey, content-type'

export const origemPermitida = (origem: string | null, origens: readonly string[]): boolean => !!origem && origens.includes(origem)

export function cabecalhosCors(origem: string | null, origens: readonly string[]): Record<string, string> {
  if (!origem || !origemPermitida(origem, origens)) return { Vary: 'Origin' }
  return {
    'Access-Control-Allow-Origin': origem,
    'Access-Control-Allow-Methods': METODOS_CORS,
    'Access-Control-Allow-Headers': CABECALHOS_CORS,
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

/** Resposta ao preflight (OPTIONS), ou null se não for um preflight. */
export function preflight(req: Request, origens: readonly string[]): Response | null {
  if (req.method !== 'OPTIONS') return null
  const origem = req.headers.get('origin')
  if (!origemPermitida(origem, origens)) return new Response(null, { status: 403, headers: { Vary: 'Origin' } })
  return new Response(null, { status: 204, headers: cabecalhosCors(origem, origens) })
}

/** Um browser de uma origem não autorizada? (tem Origin e não está na lista) */
export const origemRecusada = (req: Request, origens: readonly string[]): boolean => {
  const o = req.headers.get('origin')
  return !!o && !origemPermitida(o, origens)
}
