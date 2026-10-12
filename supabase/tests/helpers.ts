/**
 * Utilitários dos testes da base de dados (PGlite — Postgres compilado para WASM, sem rede).
 *
 * Cada ficheiro de teste cria a sua base: stubs do Supabase (bootstrap.sql, SÓ para testes) +
 * todas as migrações por ordem (+ seed opcional). Para simular pedidos da Data API trocamos de
 * papel com SET ROLE (anon / authenticated / service_role) e colocamos as claims do JWT em
 * request.jwt.claims — exatamente o que o PostgREST faz em cada pedido.
 */
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const DIR_SUPABASE = fileURLToPath(new URL('..', import.meta.url))

export const MIGRACOES = readdirSync(join(DIR_SUPABASE, 'migrations'))
  .filter((f) => /^\d{14}_[a-z0-9_]+\.sql$/.test(f))
  .sort()

const ler = (relativo: string) => readFileSync(join(DIR_SUPABASE, relativo), 'utf8')

export interface OpcoesBase {
  /** carrega supabase/seed.sql (162 instituições de demonstração) */
  seed?: boolean
}

export async function criarBase(opcoes: OpcoesBase = {}): Promise<PGlite> {
  const db = new PGlite()
  await db.exec(ler('tests/bootstrap.sql'))
  for (const f of MIGRACOES) {
    try {
      await db.exec(ler(`migrations/${f}`))
    } catch (e) {
      throw new Error(`A migração ${f} falhou: ${(e as Error).message}`)
    }
  }
  if (opcoes.seed) await db.exec(ler('seed.sql'))
  return db
}

export const lerSql = ler

// ————————————————————————————————————————— utilizadores (auth.users, como o GoTrue faria)

export interface NovoUtilizador {
  email: string
  nome?: string
  telefone?: string
  /** papel definido por um administrador (app_metadata) */
  roleAdmin?: 'familia' | 'lar' | string
  /** papel escolhido no formulário de registo (user_metadata) */
  roleRegisto?: 'familia' | 'lar' | string
}

export async function criarUtilizador(db: PGlite, u: NovoUtilizador): Promise<string> {
  const app = { provider: 'email', providers: ['email'], ...(u.roleAdmin ? { role: u.roleAdmin } : {}) }
  const meta = { ...(u.nome ? { nome: u.nome } : {}), ...(u.telefone ? { telefone: u.telefone } : {}), ...(u.roleRegisto ? { role: u.roleRegisto } : {}) }
  const r = await db.query<{ id: string }>(
    'insert into auth.users (email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3) returning id',
    [u.email, JSON.stringify(app), JSON.stringify(meta)],
  )
  return r.rows[0]!.id
}

// ————————————————————————————————————————— troca de papel (simula a Data API)

export type Quem = string | 'anon' | 'service_role'

/**
 * Corre `fn` como se fosse um pedido da Data API:
 *   'anon' → papel anon, sem utilizador;  'service_role' → chave secreta (ignora RLS);
 *   uuid   → papel authenticated com auth.uid() = uuid.
 * As instruções correm em autocommit (o estado persiste), como pedidos HTTP sucessivos.
 */
export async function como<T>(db: PGlite, quem: Quem, fn: () => Promise<T>): Promise<T> {
  const papel = quem === 'anon' || quem === 'service_role' ? quem : 'authenticated'
  const sub = papel === 'authenticated' ? quem : ''
  const claims = JSON.stringify(sub ? { sub, role: papel } : { role: papel })
  await db.query(
    "select set_config('request.jwt.claims', $1, false), set_config('request.jwt.claim.sub', $2, false)",
    [claims, sub],
  )
  await db.exec(`set role ${papel}`)
  try {
    return await fn()
  } finally {
    await db.exec('reset role')
    await db.query("select set_config('request.jwt.claims', '', false), set_config('request.jwt.claim.sub', '', false)")
  }
}

/** Consulta como `quem` e devolve as linhas. */
export async function q<T = Record<string, unknown>>(db: PGlite, quem: Quem, sql: string, params: unknown[] = []): Promise<T[]> {
  return como(db, quem, async () => (await db.query<T>(sql, params)).rows)
}

/** Número de linhas afetadas por uma instrução de escrita, como `quem`. */
export async function afetadas(db: PGlite, quem: Quem, sql: string, params: unknown[] = []): Promise<number> {
  return como(db, quem, async () => (await db.query(sql, params)).affectedRows ?? 0)
}

/**
 * Resultado em JSON tal como o PostgREST o devolve (o PostgREST serializa com as funções JSON do
 * próprio Postgres: numeric → número, timestamptz → texto ISO com fuso, jsonb → objeto).
 */
export async function json<T = Record<string, unknown>>(db: PGlite, quem: Quem, sql: string, params: unknown[] = []): Promise<T[]> {
  const linhas = await q<{ j: T[] | string }>(db, quem, `select coalesce(json_agg(t), '[]'::json) as j from (${sql}) t`, params)
  const j = linhas[0]!.j
  return typeof j === 'string' ? (JSON.parse(j) as T[]) : j
}

/** Executa como administrador (postgres — equivalente ao SQL Editor / MCP execute_sql). */
export async function admin<T = Record<string, unknown>>(db: PGlite, sql: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows
}
