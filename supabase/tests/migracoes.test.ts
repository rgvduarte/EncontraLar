/**
 * As migrações aplicam numa base nova e cumprem a checklist de segurança do Supabase
 * (.claude/skills/supabase/SKILL.md) e as regras de esquema (.claude/skills/supabase-postgres-best-practices).
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSeed } from '@/data/seed'
import { AGORA_SEED, hashToken } from '../../scripts/gerar-seed-sql'
import { admin, criarBase, MIGRACOES } from './helpers'

const TABELAS = [
  'acessos_familia', 'avaliacoes', 'candidatura_eventos', 'candidaturas', 'casos', 'consentimentos_acesso', 'contestacoes_entrada',
  'contratos', 'dados_faturacao', 'documentos_fiscais', 'fatura_linhas', 'faturas', 'favoritos', 'instituicoes', 'notificacoes',
  'pagamentos_familia', 'perfis_cuidados', 'perfis_utilizador', 'procuras_anonimas', 'quartos', 'saidas_mensais', 'stripe_eventos',
  'subscricoes_instituicao', 'visitas',
]

/** Tabelas da faturação (20261013120000): RLS, só leitura do dono, nenhuma escrita de clientes. */
const TABELAS_FATURACAO = [
  'consentimentos_acesso', 'contestacoes_entrada', 'contratos', 'dados_faturacao', 'documentos_fiscais', 'fatura_linhas', 'faturas',
  'pagamentos_familia', 'stripe_eventos', 'subscricoes_instituicao',
]

const RPC_PUBLICAS = [
  'acesso_estado', 'aceitar_candidatura', 'atualizar_caso', 'atualizar_estado_candidatura', 'avaliar_lar', 'cancelar_candidatura',
  'candidatar', 'confirmar_entrada_familia', 'confirmar_vagas_atualizadas', 'confirmar_vagas_por_token', 'confirmar_visita',
  'criar_caso', 'definir_vagas', 'disponibilidade_agregada', 'enviar_caso', 'escolher_plano_instituicao', 'marcar_entrada', 'minhas_avaliacoes',
  'avaliacoes_instituicao', 'instituicoes_completas', 'painel_equipa', 'painel_instituicao', 'pedidos_recebidos', 'pedir_visita', 'procura_na_zona', 'registar_entrada',
  'registar_procura', 'registar_vaga_libertada', 'registar_visita', 'renovar_token_confirmacao', 'responder_vaga',
  'vagas_por_token',
  // faturação (dono de um lar)
  'contestar_entrada', 'faturacao_resumo', 'guardar_dados_faturacao',
]

/** RPC só do servidor (Edge Functions com a chave secreta): o contrato de supabase/functions/_shared/portas.ts. */
const RPC_SERVICO = [
  'resolver_contestacao', 'servico_acesso_iniciar', 'servico_acesso_sessao_criada', 'servico_cobranca_criada', 'servico_cobranca_debito_iniciado',
  'servico_cobrancas_a_debitar', 'servico_contexto_instituicao', 'servico_definir_cliente_stripe', 'servico_documento_emitido',
  'servico_documento_externo', 'servico_documento_falhou', 'servico_documentos_pendentes', 'servico_evento_aplicar', 'servico_evento_falhou',
  'servico_evento_iniciar', 'servico_iniciar_execucao', 'servico_preparar_cobrancas', 'servico_reservar_documentos', 'servico_subscricao_contexto',
  'servico_subscricao_registar', 'servico_subscricoes_a_sincronizar', 'servico_terminar_execucao',
]

/**
 * As únicas RPC sem sessão: a pesquisa anónima, o link de confirmação das vagas e a versão grátis do Acesso Família
 * (contagens agregadas e o excerto das avaliações).
 */
const RPC_ANON = ['avaliacoes_instituicao', 'confirmar_vagas_por_token', 'disponibilidade_agregada', 'registar_procura', 'vagas_por_token']

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

  it('anon não tem privilégios em dados pessoais nem de saúde (nem nas visitas da equipa, nem no Acesso Família)', async () => {
    for (const t of ['perfis_utilizador', 'perfis_cuidados', 'candidaturas', 'candidatura_eventos', 'favoritos', 'notificacoes', 'casos', 'procuras_anonimas', 'visitas', 'acessos_familia', ...TABELAS_FATURACAO]) {
      const [r] = await adm<{ s: boolean; i: boolean; u: boolean; d: boolean }>(
        `select has_table_privilege('anon', $1, 'select') s, has_table_privilege('anon', $1, 'insert') i,
                has_table_privilege('anon', $1, 'update') u, has_table_privilege('anon', $1, 'delete') d`,
        [`public.${t}`],
      )
      expect(r, t).toEqual({ s: false, i: false, u: false, d: false })
    }
  })

  it('clientes não escrevem candidaturas, eventos, notificações, casos, avaliações, procura, visitas nem o Acesso Família (só funções de servidor)', async () => {
    for (const t of ['candidaturas', 'candidatura_eventos', 'notificacoes', 'casos', 'procuras_anonimas', 'visitas', 'acessos_familia', ...TABELAS_FATURACAO]) {
      const [r] = await adm<{ i: boolean; u: boolean; d: boolean }>(
        `select has_table_privilege('authenticated', $1, 'insert') i, has_table_privilege('authenticated', $1, 'update') u,
                has_table_privilege('authenticated', $1, 'delete') d`,
        [`public.${t}`],
      )
      expect(r, t).toEqual({ i: false, u: false, d: false })
    }
    // avaliações: só por avaliar_lar (o autor pode apagar a sua)
    const [a] = await adm<{ i: boolean; d: boolean }>("select has_table_privilege('authenticated', 'public.avaliacoes', 'insert') i, has_table_privilege('authenticated', 'public.avaliacoes', 'delete') d")
    expect(a).toEqual({ i: false, d: true })
    // procura anónima: nem leitura
    const [p] = await adm<{ anon: boolean; auth: boolean }>("select has_table_privilege('anon', 'public.procuras_anonimas', 'select') anon, has_table_privilege('authenticated', 'public.procuras_anonimas', 'select') auth")
    expect(p).toEqual({ anon: false, auth: false })
    // Acesso Família: escrito só por private.estender_acesso (nem a service_role escreve na tabela)
    const [a2] = await adm<{ i: boolean; u: boolean; d: boolean }>(
      "select has_table_privilege('service_role', 'public.acessos_familia', 'insert') i, has_table_privilege('service_role', 'public.acessos_familia', 'update') u, has_table_privilege('service_role', 'public.acessos_familia', 'delete') d",
    )
    expect(a2).toEqual({ i: false, u: false, d: false })
    // faturação: nem a service_role escreve nas tabelas (só pelas funções servico_*, que validam e mantêm a coerência)
    for (const t of TABELAS_FATURACAO) {
      const [r] = await adm<{ s: boolean; i: boolean; u: boolean; d: boolean }>(
        `select has_table_privilege('service_role', $1, 'select') s, has_table_privilege('service_role', $1, 'insert') i,
                has_table_privilege('service_role', $1, 'update') u, has_table_privilege('service_role', $1, 'delete') d`,
        [`public.${t}`],
      )
      expect(r, t).toEqual({ s: true, i: false, u: false, d: false })
    }
  })

  it('faturação: o dono lê sem as colunas stripe_*/moloni_*/externo_id; stripe_eventos e as tabelas private sem acesso de clientes', async () => {
    const fechadas: [string, string][] = [
      ['dados_faturacao', 'stripe_customer_id'], ['dados_faturacao', 'stripe_payment_method_id'], ['dados_faturacao', 'moloni_cliente_id'],
      ['faturas', 'stripe_invoice_id'], ['faturas', 'stripe_subscription_id'], ['faturas', 'tentativas'], ['faturas', 'divergente'],
      ['pagamentos_familia', 'stripe_checkout_session_id'], ['pagamentos_familia', 'stripe_payment_intent_id'], ['pagamentos_familia', 'demonstracao'],
      ['subscricoes_instituicao', 'stripe_subscription_id'], ['documentos_fiscais', 'externo_id'], ['documentos_fiscais', 'emissor'],
      ['documentos_fiscais', 'cliente'], ['documentos_fiscais', 'chave'], ['documentos_fiscais', 'ultimo_erro'], ['contratos', 'notas'],
      ['consentimentos_acesso', 'ip_truncado'], ['consentimentos_acesso', 'user_id'],
    ]
    for (const [t, c] of fechadas) {
      const [r] = await adm<{ a: boolean; s: boolean; u: boolean }>(
        `select has_column_privilege('authenticated', $1, $2, 'select') a, has_column_privilege('anon', $1, $2, 'select') s,
                has_column_privilege('authenticated', $1, $2, 'update') u`,
        [`public.${t}`, c],
      )
      expect(r, `${t}.${c}`).toEqual({ a: false, s: false, u: false })
    }
    // as colunas que a página Faturação lê na tabela (o resto vem de faturacao_resumo)
    for (const [t, c] of [['documentos_fiscais', 'id'], ['documentos_fiscais', 'numero'], ['faturas', 'url_pagamento'], ['pagamentos_familia', 'estado'], ['dados_faturacao', 'metodo_ultimos4']]) {
      const [r] = await adm<{ a: boolean }>("select has_column_privilege('authenticated', $1, $2, 'select') a", [`public.${t}`, c])
      expect(r, `${t}.${c}`).toEqual({ a: true })
    }
    const [e] = await adm<{ a: boolean; s: boolean }>("select has_table_privilege('authenticated', 'public.stripe_eventos', 'select') a, has_any_column_privilege('authenticated', 'public.stripe_eventos', 'select') s")
    expect(e).toEqual({ a: false, s: false })
    for (const t of ['private.execucoes_faturacao', 'private.alertas_faturacao']) {
      const [r] = await adm<{ a: boolean; u: boolean; s: boolean }>(
        "select has_table_privilege('anon', $1, 'select') a, has_table_privilege('authenticated', $1, 'select') u, has_table_privilege('service_role', $1, 'select') s",
        [t],
      )
      expect(r, t).toEqual({ a: false, u: false, s: false })
    }
    // políticas: só leitura, só authenticated, sempre pelo dono (lar ou família) — stripe_eventos sem nenhuma
    const pol = await adm<{ tablename: string; policyname: string; cmd: string; roles: string[]; q: string }>(
      `select tablename, policyname, cmd, roles::text[] as roles, qual as q from pg_policies where tablename = any ($1) order by 1, 2`,
      [TABELAS_FATURACAO],
    )
    expect(pol.map((x) => `${x.tablename}.${x.policyname}`)).toEqual([
      'consentimentos_acesso.consentimentos_select_proprio', 'contestacoes_entrada.contestacoes_select_dono', 'contratos.contratos_select_dono',
      'dados_faturacao.dados_faturacao_select_dono', 'documentos_fiscais.documentos_select_familia', 'documentos_fiscais.documentos_select_instituicao',
      'fatura_linhas.fatura_linhas_select_dono', 'faturas.faturas_select_dono', 'pagamentos_familia.pagamentos_familia_select_proprio',
      'subscricoes_instituicao.subscricoes_select_dono',
    ])
    for (const x of pol) {
      expect(x.cmd, x.policyname).toBe('SELECT')
      expect(x.roles, x.policyname).toEqual(['authenticated'])
      expect(x.q, x.policyname).toMatch(/minha_instituicao|auth\.uid/)
    }
    for (const x of pol.filter((y) => y.tablename === 'documentos_fiscais')) expect(x.q).toMatch(/'emitido'/)
  })

  it('a camada do Acesso Família não chega a anon pela tabela: quartos, saídas e avaliações sem leitura; colunas da camada completa fechadas', async () => {
    for (const t of ['quartos', 'saidas_mensais', 'avaliacoes']) {
      const [r] = await adm<{ s: boolean }>("select has_table_privilege('anon', $1, 'select') s", [`public.${t}`])
      expect(r, t).toEqual({ s: false })
    }
    const fechadas = ['morada', 'codigo_postal', 'telefone', 'email', 'website', 'lista_espera_offline', 'lista_espera_online', 'estadia_media_meses', 'extras', 'atualizado_em', 'updated_at']
    const r = await adm<{ papel: string; coluna: string; pode: boolean }>(`
      select papel, coluna, has_column_privilege(papel, 'public.instituicoes', coluna, 'select') as pode
        from unnest($1::text[]) as c (coluna) cross join (values ('anon'), ('authenticated')) as p (papel)`, [fechadas])
    expect(r.filter((x) => x.pode)).toEqual([])
    // os nomes dos extras (sem valores) são públicos; as políticas de leitura dos quartos, saídas e avaliações exigem o acesso
    const [e] = await adm<{ s: boolean }>("select has_column_privilege('anon', 'public.instituicoes', 'extras_nomes', 'select') s")
    expect(e!.s).toBe(true)
    const pol = await adm<{ tablename: string; policyname: string; roles: string[]; q: string }>(
      "select tablename, policyname, roles::text[] as roles, qual as q from pg_policies where tablename in ('quartos', 'saidas_mensais', 'avaliacoes') and cmd = 'SELECT' order by 1, 2",
    )
    expect(pol.map((x) => `${x.tablename}.${x.policyname}`)).toEqual([
      'avaliacoes.avaliacoes_select_acesso_completo', 'avaliacoes.avaliacoes_select_autor', 'avaliacoes.avaliacoes_select_dono_instituicao',
      'quartos.quartos_select_acesso_completo', 'quartos.quartos_select_dono',
      'saidas_mensais.saidas_mensais_select_acesso_completo', 'saidas_mensais.saidas_mensais_select_dono',
    ])
    for (const x of pol) expect(x.roles, x.policyname).toEqual(['authenticated'])
    for (const x of pol.filter((y) => y.policyname.endsWith('acesso_completo'))) expect(x.q, x.policyname).toMatch(/tem_acesso_completo/)
  })

  it('o lar só lê na tabela os pedidos que aceitou (política com desbloqueada_em)', async () => {
    const [r] = await adm<{ q: string }>("select qual as q from pg_policies where tablename = 'candidaturas' and policyname = 'candidaturas_select_lar'")
    expect(r!.q).toMatch(/minha_instituicao/)
    expect(r!.q).toMatch(/desbloqueada_em IS NOT NULL/)
  })

  it('a equipa só lê as visitas do seu "mundo" (política com mundo_equipa) e ninguém as escreve diretamente', async () => {
    const r = await adm<{ policyname: string; cmd: string; roles: string[]; q: string }>(
      "select policyname, cmd, roles::text[] as roles, qual as q from pg_policies where tablename = 'visitas'",
    )
    expect(r.map(({ policyname, cmd, roles }) => ({ policyname, cmd, roles }))).toEqual([{ policyname: 'visitas_select_equipa', cmd: 'SELECT', roles: ['authenticated'] }])
    expect(r[0]!.q).toMatch(/mundo_equipa/)
  })

  it('o papel do utilizador, a publicação, a verificação e a modalidade das fichas não são editáveis pelos clientes', async () => {
    const [r] = await adm<Record<string, boolean>>(`
      select has_column_privilege('authenticated', 'public.perfis_utilizador', 'role', 'update') as role,
             has_column_privilege('authenticated', 'public.perfis_utilizador', 'demonstracao', 'update') as conta_demo,
             has_column_privilege('authenticated', 'public.perfis_utilizador', 'nome', 'update') as nome,
             has_column_privilege('authenticated', 'public.perfis_utilizador', 'organizacao', 'update') as organizacao,
             has_column_privilege('authenticated', 'public.instituicoes', 'verificacao_estado', 'update') as verificacao,
             has_column_privilege('authenticated', 'public.instituicoes', 'publicado', 'update') as publicar,
             has_column_privilege('authenticated', 'public.instituicoes', 'publicado', 'insert') as publicar_ao_criar,
             has_column_privilege('authenticated', 'public.instituicoes', 'demonstracao', 'update') as ficha_demo,
             has_column_privilege('authenticated', 'public.instituicoes', 'lista_espera_offline', 'update') as lista_offline,
             has_column_privilege('authenticated', 'public.instituicoes', 'owner_id', 'update') as dono,
             has_column_privilege('authenticated', 'public.instituicoes', 'atualizado_em', 'update') as frescura,
             has_column_privilege('authenticated', 'public.instituicoes', 'nome', 'update') as nome_ficha,
             has_column_privilege('authenticated', 'public.quartos', 'livres', 'update') as livres,
             has_column_privilege('anon', 'public.avaliacoes', 'user_id', 'select') as autor_avaliacao,
             has_column_privilege('authenticated', 'public.instituicoes', 'plano', 'update') as plano,
             has_column_privilege('authenticated', 'public.instituicoes', 'plano', 'insert') as plano_ao_criar,
             has_column_privilege('authenticated', 'public.instituicoes', 'plano_desde', 'update') as plano_desde,
             has_column_privilege('authenticated', 'public.instituicoes', 'licenca_confirmada_em', 'update') as licenca_confirmada,
             has_column_privilege('authenticated', 'public.instituicoes', 'licenca_confirmada_em', 'insert') as licenca_confirmada_ao_criar,
             has_column_privilege('anon', 'public.instituicoes', 'licenca_confirmada_em', 'select') as licenca_confirmada_publica`)
    expect(r).toEqual({
      role: false, conta_demo: false, nome: true, organizacao: false, verificacao: false, publicar: false, publicar_ao_criar: false, ficha_demo: false,
      lista_offline: false, dono: false, frescura: false, nome_ficha: true, livres: false, autor_avaliacao: false,
      plano: false, plano_ao_criar: false, plano_desde: false,
      // o nível «Licença confirmada» é público, mas só o servidor o escreve
      licenca_confirmada: false, licenca_confirmada_ao_criar: false, licenca_confirmada_publica: true,
    })
  })

  it('colunas internas não são legíveis por anon nem authenticated (owner_id, visualizacoes_30d, autor_id, token do link, modalidade)', async () => {
    const r = await adm<{ papel: string; coluna: string; pode: boolean }>(`
      select papel, coluna, has_column_privilege(papel, tabela, coluna, 'select') as pode
        from (values ('public.instituicoes', 'owner_id'), ('public.instituicoes', 'visualizacoes_30d'),
                     ('public.instituicoes', 'confirmacao_token_hash'), ('public.instituicoes', 'confirmacao_token_expira_em'),
                     ('public.instituicoes', 'plano'), ('public.instituicoes', 'plano_desde'),
                     ('public.candidatura_eventos', 'autor_id'), ('public.avaliacoes', 'user_id'),
                     ('public.avaliacoes', 'candidatura_id')) as c (tabela, coluna)
        cross join (values ('anon'), ('authenticated')) as p (papel)`)
    expect(r.filter((x) => x.pode)).toEqual([])
    const vista = await adm<{ column_name: string }>(
      "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'instituicoes_publicas'",
    )
    const colunas = vista.map((c) => c.column_name)
    for (const interna of ['owner_id', 'visualizacoes_30d', 'lista_espera_offline', 'lista_espera_online', 'confirmacao_token_hash', 'confirmacao_token_expira_em', 'plano', 'plano_desde']) {
      expect(colunas).not.toContain(interna)
    }
    // a camada do Acesso Família também não está na vista pública (vem de instituicoes_completas)
    for (const completa of ['lista_espera', 'vagas_livres', 'quartos', 'mensalidade_min', 'mensalidade_max', 'historico_saidas', 'estadia_media_meses', 'atualizado_em', 'morada', 'codigo_postal', 'telefone', 'email', 'website', 'extras']) {
      expect(colunas).not.toContain(completa)
    }
    expect(colunas).toEqual(expect.arrayContaining(['publicado', 'demonstracao', 'licenca_confirmada_em', 'faixa_preco', 'extras_nomes', 'avaliacoes_publicadas', 'avaliacoes_verificadas', 'lat', 'lng']))
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

  it('agendam no pg_cron a expiração das propostas, a minimização dos pedidos encerrados e a retenção da procura anónima', async () => {
    const r = await adm<{ jobname: string; schedule: string; command: string }>('select jobname, schedule, command from cron.job order by jobname')
    expect(r).toEqual([
      { jobname: 'encontralar-cobrar-mes', schedule: '7 7 1 * *', command: "select private.invocar_faturacao('cobranca')" },
      { jobname: 'encontralar-expirar-propostas', schedule: '*/15 * * * *', command: 'select private.expirar_propostas()' },
      { jobname: 'encontralar-faturar-diario', schedule: '13 6 * * *', command: "select private.invocar_faturacao('diario')" },
      { jobname: 'encontralar-limpar-eventos-stripe', schedule: '29 3 * * *', command: 'select private.limpar_stripe_eventos(90)' },
      { jobname: 'encontralar-limpar-procuras', schedule: '41 3 * * *', command: 'select private.limpar_procuras_anonimas(365)' },
      { jobname: 'encontralar-minimizar-pedidos', schedule: '17 3 * * *', command: 'select private.minimizar_candidaturas_encerradas(30)' },
    ])
    // os comandos agendados correm (como postgres, tal como o pg_cron); sem segredos no Vault a faturação não faz nada
    for (const j of r) await expect(adm(j.command)).resolves.toBeDefined()
    expect(await adm('select count(*)::int n from net.pedidos_teste')).toEqual([{ n: 0 }])
  })

  it('anon só executa a pesquisa anónima, o link de confirmação e a versão grátis; authenticated só as RPC previstas e as auxiliares das políticas', async () => {
    const r = await adm<{ f: string; anon: boolean; auth: boolean }>(`
      select n.nspname || '.' || p.proname as f,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as auth
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')
       order by 1`)
    expect(r.filter((x) => x.anon).map((x) => x.f).sort()).toEqual(
      // resumo_publico: a faixa de preço e as contagens de avaliações da vista pública
      [...RPC_ANON.map((f) => `private.${f}`), ...RPC_ANON.map((f) => `public.${f}`), 'private.resumo_publico'].sort(),
    )
    const permitidas = new Set([
      ...RPC_PUBLICAS.map((f) => `public.${f}`),
      ...RPC_PUBLICAS.map((f) => `private.${f}`),
      'private.tem_papel',
      'private.minha_instituicao',
      'private.mundo_equipa',
      // Acesso Família: políticas dos quartos/saídas/avaliações, trigger dos favoritos e a vista pública
      'private.tem_acesso_completo',
      'private.conta_demonstracao',
      'private.resumo_publico',
    ])
    expect(r.filter((x) => x.auth).map((x) => x.f).sort()).toEqual([...permitidas].sort())
  })

  it('service_role executa as RPC do servidor (contrato portas.ts) e as das contas; anon e authenticated nenhuma servico_*', async () => {
    const r = await adm<{ f: string; anon: boolean; auth: boolean; servico: boolean }>(`
      select n.nspname || '.' || p.proname as f,
             has_function_privilege('anon', p.oid, 'execute') as anon,
             has_function_privilege('authenticated', p.oid, 'execute') as auth,
             has_function_privilege('service_role', p.oid, 'execute') as servico
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname in ('public', 'private')
       order by 1`)
    const esperadas = new Set([
      ...[...RPC_PUBLICAS, ...RPC_ANON, ...RPC_SERVICO].flatMap((f) => [`public.${f}`, `private.${f}`]),
      'private.tem_papel', 'private.minha_instituicao', 'private.mundo_equipa', 'private.tem_acesso_completo', 'private.conta_demonstracao',
      'private.resumo_publico',
      // a faturação soma os dias do passe (Acesso Família)
      'private.estender_acesso',
    ])
    expect(r.filter((x) => x.servico).map((x) => x.f).sort()).toEqual([...esperadas].sort())
    const servico = new Set(RPC_SERVICO.flatMap((f) => [`public.${f}`, `private.${f}`]))
    expect(r.filter((x) => servico.has(x.f) && (x.anon || x.auth))).toEqual([])
    // o contrato: cada RPC de serviço em portas.ts existe em public
    const { readFileSync } = await import('node:fs')
    const portas = readFileSync(new URL('../functions/_shared/portas.ts', import.meta.url), 'utf8')
    const bloco = portas.slice(portas.indexOf('export interface RpcServico'), portas.indexOf('// ————', portas.indexOf('export interface RpcServico')))
    const nomes = [...bloco.matchAll(/^ {2}(\w+):\s*\{/gm)].map((m) => m[1]!).sort()
    expect(nomes).toEqual([...RPC_SERVICO].sort())
    // a tarefa agendada (pg_net) e a retenção dos eventos: só postgres
    for (const f of ['private.invocar_faturacao', 'private.limpar_stripe_eventos']) expect(r.find((x) => x.f === f), f).toMatchObject({ anon: false, auth: false, servico: false })
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

  it('carrega as instituições (com a modalidade dos privados), quartos, saídas, avaliações e procura do protótipo, todas marcadas como demonstração', async () => {
    const [r] = await adm<{ i: number; q: number; s: number; a: number; p: number; d: number; t: number; pa: number; m: string[] }>(`
      select (select count(*)::int from public.instituicoes) i, (select count(*)::int from public.quartos) q,
             (select count(*)::int from public.saidas_mensais) s, (select count(*)::int from public.avaliacoes) a,
             (select count(*)::int from public.instituicoes where publicado and owner_id is null) p,
             (select count(*)::int from public.instituicoes where demonstracao) d,
             (select count(*)::int from public.instituicoes where confirmacao_token_hash is not null) t,
             (select count(*)::int from public.procuras_anonimas) pa,
             (select array_agg(id || ':' || plano order by id) from public.instituicoes where plano is not null) m`)
    expect(r).toEqual({
      i: proto.lares.length,
      q: proto.lares.reduce((n, l) => n + l.quartos.length, 0),
      s: proto.lares.length * 12,
      a: proto.lares.reduce((n, l) => n + l.reviews.length, 0),
      p: proto.lares.length,
      d: proto.lares.length,
      t: proto.lares.length,
      pa: proto.procuras.length,
      m: proto.lares.filter((l) => l.planoInstituicao).map((l) => `${l.id}:${l.planoInstituicao}`).sort(),
    })
  })

  it('guarda só o hash dos links de confirmação (o token do protótipo continua a funcionar)', async () => {
    const lar = proto.lares[0]!
    const [r] = await adm<{ h: string }>("select encode(confirmacao_token_hash, 'hex') h from public.instituicoes where id = $1", [lar.id])
    expect(r!.h).toBe(hashToken(lar.confirmacaoToken!))
    const { lerSql } = await import('./helpers')
    expect(lerSql('seed.sql')).not.toContain(`'${lar.confirmacaoToken}'`)
  })

  it('é idempotente (pode correr duas vezes sem duplicar)', async () => {
    const { lerSql } = await import('./helpers')
    await db.exec(lerSql('seed.sql'))
    const [r] = await adm<{ i: number; a: number; pa: number }>(
      'select (select count(*)::int from public.instituicoes) i, (select count(*)::int from public.avaliacoes) a, (select count(*)::int from public.procuras_anonimas) pa',
    )
    expect(r).toEqual({ i: proto.lares.length, a: proto.lares.reduce((n, l) => n + l.reviews.length, 0), pa: proto.procuras.length })
  })
})
