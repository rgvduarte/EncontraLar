// Adaptador Deno do Supabase: PortaBD (chave de serviço) e PortaUtilizador (JWT do pedido).
// A versão é a mesma da dependência @supabase/supabase-js do package.json (fronteira.test.ts confirma).
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.117.3'
import type { Config } from '../config.ts'
import { ErroBD, type PortaBD, type PortaUtilizador } from '../portas.ts'

const SEM_SESSAO = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

async function rpc(cliente: SupabaseClient, nome: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await cliente.rpc(nome, args)
  if (error) throw new ErroBD(error.code ?? null, error.message ?? 'Erro na base de dados.')
  return data
}

export function portaBD(cfg: Config): PortaBD {
  const cliente = createClient(cfg.supabase.url, cfg.supabase.chaveServico, SEM_SESSAO)
  return { rpc: (nome, args) => rpc(cliente, nome, args as Record<string, unknown>) as never }
}

export function portaUtilizadorDe(cfg: Config): (req: Request) => PortaUtilizador {
  return (req) => {
    const autorizacao = req.headers.get('authorization') ?? ''
    const jwt = /^Bearer\s+(.+)$/i.exec(autorizacao)?.[1] ?? null
    const cliente = createClient(cfg.supabase.url, cfg.supabase.chaveAnonima ?? '', {
      ...SEM_SESSAO,
      global: { headers: jwt ? { Authorization: `Bearer ${jwt}` } : {} },
    })
    return {
      utilizador: async () => {
        if (!jwt) return null
        const { data, error } = await cliente.auth.getUser(jwt)
        if (error || !data.user) return null
        return { id: data.user.id, email: data.user.email ?? null, anonimo: data.user.is_anonymous === true }
      },
      rpc: (nome, args) => rpc(cliente, nome, args as Record<string, unknown>) as never,
      documentoVisivel: async (id) => {
        const { data, error } = await cliente.from('documentos_fiscais').select('id').eq('id', id).maybeSingle()
        return !error && !!data
      },
    }
  }
}
