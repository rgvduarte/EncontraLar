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
  email: string | null
  nome?: string
  telefone?: string
  /** papel definido por um administrador (app_metadata) */
  roleAdmin?: 'familia' | 'lar' | string
  /** papel escolhido no formulário de registo (user_metadata) */
  roleRegisto?: 'familia' | 'lar' | string
  /** conta anónima (signInAnonymously) */
  anonimo?: boolean
  /** e-mail confirmado (por omissão: sim, exceto contas anónimas) */
  confirmado?: boolean
}

export async function criarUtilizador(db: PGlite, u: NovoUtilizador): Promise<string> {
  const app = { provider: u.anonimo ? 'anonymous' : 'email', providers: [u.anonimo ? 'anonymous' : 'email'], ...(u.roleAdmin ? { role: u.roleAdmin } : {}) }
  const meta = { ...(u.nome ? { nome: u.nome } : {}), ...(u.telefone ? { telefone: u.telefone } : {}), ...(u.roleRegisto ? { role: u.roleRegisto } : {}) }
  const confirmado = u.confirmado ?? !u.anonimo
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_app_meta_data, raw_user_meta_data, is_anonymous, email_confirmed_at)
     values ($1, $2, $3, $4, case when $5 then now() end) returning id`,
    [u.email, JSON.stringify(app), JSON.stringify(meta), u.anonimo ?? false, confirmado],
  )
  return r.rows[0]!.id
}

// ————————————————————————————————————————— troca de papel (simula a Data API)

/** Sessão com claims extra no JWT (ex.: { sub, is_anonymous: true } de signInAnonymously). */
export interface Sessao {
  sub: string
  claims?: Record<string, unknown>
}

export type Quem = string | 'anon' | 'service_role' | Sessao

/**
 * Corre `fn` como se fosse um pedido da Data API:
 *   'anon' → papel anon, sem utilizador;  'service_role' → chave secreta (ignora RLS);
 *   uuid   → papel authenticated com auth.uid() = uuid;  { sub, claims } → idem, com claims extra.
 * As instruções correm em autocommit (o estado persiste), como pedidos HTTP sucessivos.
 */
export async function como<T>(db: PGlite, quem: Quem, fn: () => Promise<T>): Promise<T> {
  const sessao: Sessao | null = typeof quem === 'object' ? quem : quem === 'anon' || quem === 'service_role' ? null : { sub: quem }
  const papel = sessao ? 'authenticated' : (quem as 'anon' | 'service_role')
  const sub = sessao?.sub ?? ''
  const claims = JSON.stringify(sessao ? { sub, role: papel, ...sessao.claims } : { role: papel })
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

/** Mensagem de erro de uma instrução que deve falhar (ou '' se não falhar). */
export async function erro(db: PGlite, quem: Quem, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await q(db, quem, sql, params)
    return ''
  } catch (e) {
    return (e as Error).message
  }
}

/** Código SQLSTATE de uma instrução que deve falhar (ou '' se não falhar). */
export async function codigoErro(db: PGlite, quem: Quem, sql: string, params: unknown[] = []): Promise<string> {
  try {
    await q(db, quem, sql, params)
    return ''
  } catch (e) {
    return String((e as { code?: string }).code ?? '?')
  }
}

// ————————————————————————————————————————— cenário base (ficha real verificada, com gestor)

export interface Cenario {
  lar: string
  familia: string
  perfil: string
}

/**
 * Cria um lar verificado e publicado ('lar-real', gerido por `lar`), com quartos, e uma família com
 * um perfil de saúde. Publicar/verificar é feito como administrador (como o faria a equipa).
 */
export async function cenarioBase(
  db: PGlite,
  opcoes: { sufixo?: string; livres?: { individual?: number; duplo?: number } } = {},
): Promise<Cenario & { instituicao: string }> {
  const s = opcoes.sufixo ?? ''
  const lar = await criarUtilizador(db, { email: `lar${s}@teste.pt`, nome: `Gestora${s}`, roleAdmin: 'lar' })
  const familia = await criarUtilizador(db, { email: `fam${s}@teste.pt`, nome: `Família${s}`, telefone: '912 000 000', roleAdmin: 'familia' })
  // o id (slug) é gerado a partir do nome: 'Real' → 'lar-real', 'Real B' → 'lar-real-b'
  const [ins] = await q<{ id: string }>(
    db,
    lar,
    `insert into public.instituicoes (nome, tipo, natureza, localidade, concelho, distrito, regiao, lat, lng, capacidade, licenca, graus)
     values ($1, 'erpi', 'privado', 'Porto', 'Porto', 'Porto', 'Norte', 41.15, -8.61, 40, 'ALV-1', '{ligeira,moderada,grave}') returning id`,
    [`Real${s ? ` ${s.toUpperCase()}` : ''}`],
  )
  const instituicao = ins!.id
  await como(db, lar, () =>
    db.query(
      `insert into public.quartos (instituicao_id, tipo, total, preco_min, preco_max)
       values ($1, 'individual', 20, 1500, 1800), ($1, 'duplo', 20, 1200, 1400)`,
      [instituicao],
    ),
  )
  await admin(db, "update public.instituicoes set publicado = true, verificacao_estado = 'verificado', verificacao_data = now() where id = $1", [instituicao])
  await admin(db, "update public.quartos set livres = case tipo when 'individual' then $2::int else $3::int end where instituicao_id = $1", [
    instituicao,
    opcoes.livres?.individual ?? 1,
    opcoes.livres?.duplo ?? 0,
  ])
  const [p] = await q<{ id: string }>(
    db,
    familia,
    `insert into public.perfis_cuidados (nome, idade, relacao, genero, grau, necessidades, quarto, local_label, local_lat, local_lng, orcamento_max, precisa_acordo_ss, notas)
     values ('Maria', 84, 'Mãe', 'F', 'grave', '{demencia,diabetes,paliativos}', 'individual', 'Porto', 41.15790, -8.62910, 2000, true,
             'Alzheimer avançado; VIH+; historial psiquiátrico') returning id`,
  )
  return { lar, familia, perfil: p!.id, instituicao }
}
