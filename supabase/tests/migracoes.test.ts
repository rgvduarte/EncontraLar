/**
 * As migrações aplicam numa base nova e cumprem a checklist de segurança do Supabase
 * (.claude/skills/supabase/SKILL.md) e as regras de esquema (.claude/skills/supabase-postgres-best-practices).
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSeed } from '@/data/seed'
import { AGORA_SEED } from '../../scripts/gerar-seed-sql'
import { admin, criarBase, MIGRACOES } from './helpers'

const TABELAS = [
  'avaliacoes', 'candidatura_eventos', 'candidaturas', 'favoritos', 'instituicoes', 'notificacoes',
  'perfis_cuidados', 'perfis_utilizador', 'quartos', 'saidas_mensais',
]

const RPC_PUBLICAS = [
  'atualizar_estado_candidatura', 'cancelar_candidatura', 'candidatar', 'confirmar_vagas_atualizadas',
  'confirmar_visita', 'definir_vagas', 'painel_instituicao', 'pedir_visita', 'registar_entrada',
  'registar_vaga_libertada', 'responder_vaga',
]

let db: PGlite
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)

beforeAll(async () => {
  db = await criarBase({ seed: true })
}, 120_000)

describe('migrações', () => {
  it('têm nomes YYYYMMDDHHMMSS_descricao.sql a partir de 20261012190000', () => {
    expect(MIGRACOES.length).toBeGreaterThanOrEqual(3)
    expect(MIGRACOES[0]).toBe('20261012190000_esquema_inicial.sql')
    for (const f of MIGRACOES) expect(Number(f.slice(0, 14))).toBeGreaterThanOrEqual(20261012190000)
  })

  it('criam todas as tabelas no schema public', async () => {
    const r = await adm<{ relname: string }>(
      "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' order by 1",
    )
    expect(r.map((x) => x.relname)).toEqual(TABELAS)
  })

  it('ativam RLS em TODAS as tabelas do schema public (exposto)', async () => {
    const r = await adm<{ relname: string }>(
      "select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity",
    )
    expect(r).toEqual([])
  })

  it('não têm funções SECURITY DEFINER no schema public', async () => {
    const r = await adm<{ proname: string }>("select proname from pg_proc where pronamespace = 'public'::regnamespace and prosecdef")
    expect(r).toEqual([])
  })

  it("todas as funções (public e private) fixam search_path = ''", async () => {
    const r = await adm<{ f: string }>(`
      select n.nspname || '.' || p.proname as f
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')
         and not coalesce(p.proconfig @> array['search_path=""'], false)`)
    expect(r).toEqual([])
  })

  it('as funções SECURITY DEFINER vivem só no schema private', async () => {
    const r = await adm<{ n: string }>(`
      select distinct n.nspname as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where p.prosecdef and n.nspname not in ('pg_catalog', 'information_schema', 'auth')`)
    expect(r.map((x) => x.n)).toEqual(['private'])
  })

  it('todas as chaves estrangeiras têm índice (coluna mais à esquerda)', async () => {
    const r = await adm<{ tabela: string; coluna: string }>(`
      select c.conrelid::regclass::text as tabela, a.attname as coluna
        from pg_constraint c
        join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
       where c.contype = 'f' and c.connamespace = 'public'::regnamespace
         and not exists (
           select 1 from pg_index i where i.indrelid = c.conrelid and i.indkey[0] = c.conkey[1]
         )`)
    expect(r).toEqual([])
  })

  it('usam timestamptz (nunca timestamp sem fuso)', async () => {
    const r = await adm<{ c: string }>(`
      select table_name || '.' || column_name as c from information_schema.columns
       where table_schema = 'public' and data_type = 'timestamp without time zone'`)
    expect(r).toEqual([])
  })

  it('as vistas do schema public são security_invoker', async () => {
    const r = await adm<{ relname: string; reloptions: string[] | null }>(
      "select relname, reloptions from pg_class where relnamespace = 'public'::regnamespace and relkind = 'v'",
    )
    expect(r.map((v) => v.relname)).toEqual(['instituicoes_publicas'])
    for (const v of r) expect(v.reloptions).toContain('security_invoker=true')
  })

  it('anon não tem privilégios em dados pessoais nem de saúde', async () => {
    for (const t of ['perfis_utilizador', 'perfis_cuidados', 'candidaturas', 'candidatura_eventos', 'favoritos', 'notificacoes']) {
      const [r] = await adm<{ s: boolean; i: boolean; u: boolean; d: boolean }>(
        `select has_table_privilege('anon', $1, 'select') s, has_table_privilege('anon', $1, 'insert') i,
                has_table_privilege('anon', $1, 'update') u, has_table_privilege('anon', $1, 'delete') d`,
        [`public.${t}`],
      )
      expect(r, t).toEqual({ s: false, i: false, u: false, d: false })
    }
  })

  it('clientes não escrevem candidaturas, eventos nem notificações (só funções de servidor)', async () => {
    for (const t of ['candidaturas', 'candidatura_eventos', 'notificacoes']) {
      const [r] = await adm<{ i: boolean; d: boolean }>(
        "select has_table_privilege('authenticated', $1, 'insert') i, has_table_privilege('authenticated', $1, 'delete') d",
        [`public.${t}`],
      )
      expect(r, t).toEqual({ i: false, d: false })
    }
    const [c] = await adm<{ u: boolean }>("select has_table_privilege('authenticated', 'public.candidaturas', 'update') u")
    expect(c!.u).toBe(false)
  })

  it('o papel do utilizador, a publicação e a verificação das fichas não são editáveis pelos clientes', async () => {
    const [r] = await adm<Record<string, boolean>>(`
      select has_column_privilege('authenticated', 'public.perfis_utilizador', 'role', 'update') as role,
             has_column_privilege('authenticated', 'public.perfis_utilizador', 'demonstracao', 'update') as conta_demo,
             has_column_privilege('authenticated', 'public.perfis_utilizador', 'nome', 'update') as nome,
             has_column_privilege('authenticated', 'public.instituicoes', 'verificacao_estado', 'update') as verificacao,
             has_column_privilege('authenticated', 'public.instituicoes', 'publicado', 'update') as publicar,
             has_column_privilege('authenticated', 'public.instituicoes', 'publicado', 'insert') as publicar_ao_criar,
             has_column_privilege('authenticated', 'public.instituicoes', 'demonstracao', 'update') as ficha_demo,
             has_column_privilege('authenticated', 'public.instituicoes', 'lista_espera_offline', 'update') as lista_offline,
             has_column_privilege('authenticated', 'public.instituicoes', 'owner_id', 'update') as dono,
             has_column_privilege('authenticated', 'public.instituicoes', 'atualizado_em', 'update') as frescura,
             has_column_privilege('authenticated', 'public.instituicoes', 'nome', 'update') as nome_ficha,
             has_column_privilege('authenticated', 'public.quartos', 'livres', 'update') as livres,
             has_column_privilege('anon', 'public.avaliacoes', 'user_id', 'select') as autor_avaliacao`)
    expect(r).toEqual({
      role: false, conta_demo: false, nome: true, verificacao: false, publicar: false, publicar_ao_criar: false, ficha_demo: false,
      lista_offline: false, dono: false, frescura: false, nome_ficha: true, livres: false, autor_avaliacao: false,
    })
  })

  it('colunas internas não são legíveis por anon nem authenticated (owner_id, visualizacoes_30d, autor_id)', async () => {
    const r = await adm<{ papel: string; coluna: string; pode: boolean }>(`
      select papel, coluna, has_column_privilege(papel, tabela, coluna, 'select') as pode
        from (values ('public.instituicoes', 'owner_id'), ('public.instituicoes', 'visualizacoes_30d'),
                     ('public.candidatura_eventos', 'autor_id'), ('public.avaliacoes', 'user_id')) as c (tabela, coluna)
        cross join (values ('anon'), ('authenticated')) as p (papel)`)
    expect(r.filter((x) => x.pode)).toEqual([])
    const vista = await adm<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'instituicoes_publicas'",
    )
    const colunas = vista.map((c) => c.column_name)
    for (const interna of ['owner_id', 'visualizacoes_30d', 'lista_espera_offline', 'lista_espera_online']) expect(colunas).not.toContain(interna)
    expect(colunas).toEqual(expect.arrayContaining(['lista_espera', 'publicado', 'demonstracao', 'vagas_livres', 'historico_saidas']))
  })

  it('anon e authenticated não têm privilégios em nenhuma sequência do schema public', async () => {
    const r = await adm<{ relname: string; anon: boolean; auth: boolean }>(`
      select c.relname,
             has_sequence_privilege('anon', c.oid, 'usage') or has_sequence_privilege('anon', c.oid, 'update')
               or has_sequence_privilege('anon', c.oid, 'select') as anon,
             has_sequence_privilege('authenticated', c.oid, 'usage') or has_sequence_privilege('authenticated', c.oid, 'update')
               or has_sequence_privilege('authenticated', c.oid, 'select') as auth
        from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'S'`)
    expect(r.length).toBeGreaterThanOrEqual(4)
    expect(r.filter((x) => x.anon || x.auth)).toEqual([])
    // e as sequências criadas no futuro também não (privilégios por omissão)
    await adm('create table public.teste_seq (id bigint generated always as identity primary key)')
    const [n] = await adm<{ pode: boolean }>("select has_sequence_privilege('anon', 'public.teste_seq_id_seq', 'update') as pode")
    await adm('drop table public.teste_seq')
    expect(n!.pode).toBe(false)
  })

  it('agendam no pg_cron a expiração das propostas e a minimização dos pedidos encerrados', async () => {
    const r = await adm<{ jobname: string; schedule: string; command: string }>('select jobname, schedule, command from cron.job order by jobname')
    expect(r).toEqual([
      { jobname: 'encontralar-expirar-propostas', schedule: '*/15 * * * *', command: 'select private.expirar_propostas()' },
      { jobname: 'encontralar-minimizar-pedidos', schedule: '17 3 * * *', command: 'select private.minimizar_candidaturas_encerradas(30)' },
    ])
    // os comandos agendados correm (como postgres, tal como o pg_cron)
    for (const j of r) await expect(adm(j.command)).resolves.toBeDefined()
  })

  it('anon não executa nenhuma função; authenticated só as RPC previstas e as auxiliares das políticas', async () => {
    const r = await adm<{ f: string; anon: boolean; auth: boolean }>(`
      select n.nspname || '.' || p.proname as f,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as auth
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')
       order by 1`)
    expect(r.filter((x) => x.anon).map((x) => x.f)).toEqual([])
    const permitidas = new Set([
      ...RPC_PUBLICAS.map((f) => `public.${f}`),
      ...RPC_PUBLICAS.map((f) => `private.${f}`),
      'private.tem_papel',
      'private.minha_instituicao',
    ])
    expect(r.filter((x) => x.auth).map((x) => x.f).sort()).toEqual([...permitidas].sort())
  })

  it('publicam notificacoes, candidaturas e quartos no Realtime', async () => {
    const r = await adm<{ tablename: string }>(
      "select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1",
    )
    expect(r.map((x) => x.tablename)).toEqual(['candidaturas', 'notificacoes', 'quartos'])
  })
})

describe('seed (supabase/seed.sql)', () => {
  const proto = createSeed(AGORA_SEED)

  it('carrega as instituições, quartos, saídas e avaliações do protótipo, todas marcadas como demonstração', async () => {
    const [r] = await adm<{ i: number; q: number; s: number; a: number; p: number; d: number }>(`
      select (select count(*)::int from public.instituicoes) i, (select count(*)::int from public.quartos) q,
             (select count(*)::int from public.saidas_mensais) s, (select count(*)::int from public.avaliacoes) a,
             (select count(*)::int from public.instituicoes where publicado and owner_id is null) p,
             (select count(*)::int from public.instituicoes where demonstracao) d`)
    expect(r).toEqual({
      i: proto.lares.length,
      q: proto.lares.reduce((n, l) => n + l.quartos.length, 0),
      s: proto.lares.length * 12,
      a: proto.lares.reduce((n, l) => n + l.reviews.length, 0),
      p: proto.lares.length,
      d: proto.lares.length,
    })
  })

  it('é idempotente (pode correr duas vezes sem duplicar)', async () => {
    const { lerSql } = await import('./helpers')
    await db.exec(lerSql('seed.sql'))
    const [r] = await adm<{ i: number; a: number }>(
      'select (select count(*)::int from public.instituicoes) i, (select count(*)::int from public.avaliacoes) a',
    )
    expect(r).toEqual({ i: proto.lares.length, a: proto.lares.reduce((n, l) => n + l.reviews.length, 0) })
  })
})
