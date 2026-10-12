/**
 * Cliente Supabase (opcional).
 *
 * Sem VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY a app continua em modo demonstração
 * (localStorage, src/lib/store.ts) e o supabase-js nunca é descarregado: o import é dinâmico,
 * por isso fica num chunk à parte que só é pedido quando getSupabase() é chamado.
 *
 * Só a chave PUBLICÁVEL pode chegar ao navegador. Uma chave secreta (sb_secret_… ou a JWT
 * legada service_role) é recusada aqui, por precaução — ignora o RLS e daria acesso total.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export type EncontraLarClient = SupabaseClient<Database>

/** true se a chave for secreta (nunca deve ser usada no front-end). */
export function eChaveSecreta(chave: string): boolean {
  if (chave.startsWith('sb_secret_')) return true
  // chaves legadas: JWT com a claim role
  const partes = chave.split('.')
  if (partes.length === 3) {
    try {
      const b64 = partes[1]!.replace(/-/g, '+').replace(/_/g, '/')
      const payload = JSON.parse(atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '='))) as { role?: unknown }
      return payload.role === 'service_role'
    } catch {
      return false
    }
  }
  return false
}

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim()
const chave = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '').trim()
const chaveRecusada = chave !== '' && eChaveSecreta(chave)

if (chaveRecusada) {
  console.error('[EncontraLar] VITE_SUPABASE_PUBLISHABLE_KEY contém uma chave SECRETA — ignorada. Use a chave publicável.')
}

/** Supabase ligado: URL e chave publicável definidas (caso contrário, modo demonstração). */
export const isSupabaseConfigured: boolean = url !== '' && chave !== '' && !chaveRecusada

let cliente: Promise<EncontraLarClient> | null = null

/** Devolve (criando na primeira chamada) o cliente Supabase tipado. */
export function getSupabase(): Promise<EncontraLarClient> {
  if (!isSupabaseConfigured) {
    return Promise.reject(
      new Error('Supabase não configurado: defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.'),
    )
  }
  cliente ??= import('@supabase/supabase-js')
    .then(({ createClient }) =>
      createClient<Database>(url, chave, {
        auth: {
          // PKCE: o retorno dos emails de confirmação/recuperação usa ?code= na query string,
          // compatível com o HashRouter (o fluxo implícito usaria o #fragmento da rota).
          flowType: 'pkce',
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storageKey: 'encontralar:auth',
        },
      }),
    )
    .catch((erro: unknown) => {
      cliente = null // permite tentar de novo (ex.: falha de rede ao carregar o chunk)
      throw erro
    })
  return cliente
}
