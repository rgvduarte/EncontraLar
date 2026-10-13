/**
 * Faturação agendada (20261013120100_faturacao_agendamento.sql) e a migração da faturação sobre uma base já em uso.
 *
 * pg_cron → private.invocar_faturacao(fase) → pg_net → Edge Function faturar-mes, com o URL do projeto e o segredo
 * do cron lidos do Vault. bootstrap.sql imita o pg_net (net.http_post regista o pedido em net.pedidos_teste) e o
 * Vault (vault.decrypted_secrets) — só em testes.
 */
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { CABECALHO_CRON } from '../functions/_shared/funcoes/faturar-mes.ts'
import { BDPGlite } from './faturacao-bd'
import { admin, aplicarMigracoes, cenarioBase, criarBase, criarUtilizador, erro, q } from './helpers'

let db: PGlite
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)
const segredo = 'segredo-do-cron-com-mais-de-32-caracteres!'

beforeAll(async () => {
  db = await criarBase()
}, 120_000)

afterAll(async () => {
  await db.close()
})

describe('private.invocar_faturacao (pg_cron → pg_net → faturar-mes)', () => {
  it('sem segredos no Vault não faz nada (null, sem pedido); com eles chama faturar-mes com o segredo do cron, nunca a chave de serviço', async () => {
    expect(await adm("select private.invocar_faturacao('diario') r")).toEqual([{ r: null }])
    expect(await adm('select count(*)::int n from net.pedidos_teste')).toEqual([{ n: 0 }])

    await adm("select vault.create_secret('https://abcdefghijklmnop.supabase.co/', 'encontralar_url_projeto')")
    expect(await adm("select private.invocar_faturacao('diario') r")).toEqual([{ r: null }])
    await adm('select vault.create_secret($1, $2)', [segredo, 'encontralar_segredo_cron'])

    const [{ r: id }] = await adm<{ r: number }>("select private.invocar_faturacao('diario') r")
    expect(Number(id)).toBeGreaterThan(0)
    await adm("select private.invocar_faturacao('cobranca')")
    const pedidos = await adm<{ url: string; body: unknown; headers: Record<string, string>; timeout_milliseconds: number }>(
      'select url, body, headers, timeout_milliseconds from net.pedidos_teste order by id',
    )
    expect(pedidos).toEqual([
      { url: 'https://abcdefghijklmnop.supabase.co/functions/v1/faturar-mes', body: { fase: 'diario' }, headers: { 'Content-Type': 'application/json', [CABECALHO_CRON]: segredo }, timeout_milliseconds: 5000 },
      { url: 'https://abcdefghijklmnop.supabase.co/functions/v1/faturar-mes', body: { fase: 'cobranca' }, headers: { 'Content-Type': 'application/json', [CABECALHO_CRON]: segredo }, timeout_milliseconds: 5000 },
    ])
    expect(JSON.stringify(pedidos)).not.toMatch(/service_role|Authorization|apikey/i)
    // os trabalhos agendados correm o mesmo
    const jobs = await adm<{ command: string }>("select command from cron.job where jobname in ('encontralar-faturar-diario', 'encontralar-cobrar-mes') order by jobname")
    for (const j of jobs) await adm(j.command)
    expect(await adm('select count(*)::int n from net.pedidos_teste')).toEqual([{ n: 4 }])
  })

  it('recusa um URL que não seja https://<ref>.supabase.co (o segredo nunca vai para outro sítio) e uma fase desconhecida', async () => {
    for (const url of ['http://abcdefghijklmnop.supabase.co', 'https://atacante.example', 'https://abc.supabase.co.atacante.example', 'https://abc.supabase.co/functions/v1/outra']) {
      await adm("update vault.secrets set secret = $1 where name = 'encontralar_url_projeto'", [url])
      const antes = (await adm<{ n: number }>('select count(*)::int n from net.pedidos_teste'))[0]!.n
      await expect(adm("select private.invocar_faturacao('diario')"), url).rejects.toThrow(/URL do projeto inválido/)
      expect((await adm<{ n: number }>('select count(*)::int n from net.pedidos_teste'))[0]!.n).toBe(antes)
    }
    await adm("update vault.secrets set secret = 'https://abcdefghijklmnop.supabase.co' where name = 'encontralar_url_projeto'")
    await expect(adm("select private.invocar_faturacao('tudo')")).rejects.toThrow(/Fase desconhecida/)
  })

  it('sem pg_net ou sem Vault: não faz nada (avisa) — o projeto migra e o cron corre sem erro', async () => {
    await adm('alter function net.http_post(text, jsonb, jsonb, jsonb, integer) rename to http_post_desligado')
    try {
      expect(await adm("select private.invocar_faturacao('diario') r")).toEqual([{ r: null }])
    } finally {
      await adm('alter function net.http_post_desligado(text, jsonb, jsonb, jsonb, integer) rename to http_post')
    }
    await adm('alter view vault.decrypted_secrets rename to decrypted_secrets_desligado')
    try {
      expect(await adm("select private.invocar_faturacao('cobranca') r")).toEqual([{ r: null }])
    } finally {
      await adm('alter view vault.decrypted_secrets_desligado rename to decrypted_secrets')
    }
  })

  it('só postgres (pg_cron) a executa: nem anon, nem contas, nem a service_role', async () => {
    const u = await criarUtilizador(db, { email: 'cron@teste.pt' })
    for (const quem of ['anon', u, 'service_role'] as const) {
      expect(await erro(db, quem, "select private.invocar_faturacao('diario')"), String(quem)).toMatch(/permission denied/)
      expect(await erro(db, quem, 'select private.limpar_stripe_eventos(90)'), String(quem)).toMatch(/permission denied/)
    }
  })
})

describe('private.limpar_stripe_eventos (retenção de 90 dias)', () => {
  it('apaga os eventos aplicados há mais de 90 dias; os recentes e os que falharam ficam', async () => {
    await adm(`insert into public.stripe_eventos (id, tipo, livemode, criado_em, processado_em, erro) values
      ('evt_velho', 'x', false, now() - interval '100 days', now() - interval '91 days', null),
      ('evt_recente', 'x', false, now() - interval '10 days', now() - interval '10 days', null),
      ('evt_falhado', 'x', false, now() - interval '200 days', null, 'ErroBD: x')`)
    expect(await adm('select private.limpar_stripe_eventos(90) n')).toEqual([{ n: 1 }])
    expect((await adm<{ id: string }>("select id from public.stripe_eventos where id in ('evt_velho', 'evt_recente', 'evt_falhado') order by id")).map((x) => x.id)).toEqual(['evt_falhado', 'evt_recente'])
  })
})

describe('migração da faturação sobre uma base já em uso (com o seed de demonstração)', () => {
  it('os pedidos, entradas e passes existentes ficam; nada é faturado sozinho; acesso_estado e o resto funcionam já', async () => {
    const antiga = await criarBase({ ate: '20261013120000', seed: true })
    try {
      const b = await cenarioBase(antiga, { sufixo: 'mig', livres: { individual: 2 } })
      const [c] = await q<{ id: string }>(antiga, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, b.perfil])
      await q(antiga, b.lar, 'select public.aceitar_candidatura($1)', [c!.id])
      await q(antiga, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [c!.id])
      await q(antiga, b.familia, 'select public.responder_vaga($1, true)', [c!.id])
      await q(antiga, b.lar, 'select public.marcar_entrada($1, current_date)', [c!.id])
      const antes = await admin(antiga, 'select count(*)::int c, count(*) filter (where entrada_data is not null)::int e from public.candidaturas')

      await aplicarMigracoes(antiga, '20261013120000')

      expect(await admin(antiga, 'select count(*)::int c, count(*) filter (where entrada_data is not null)::int e from public.candidaturas')).toEqual(antes)
      for (const t of ['fatura_linhas', 'faturas', 'documentos_fiscais', 'pagamentos_familia', 'dados_faturacao', 'contratos']) {
        expect(await admin(antiga, `select count(*)::int n from public.${t}`), t).toEqual([{ n: 0 }])
      }
      expect((await q<{ e: { completo: boolean; pagamentos: unknown[] } }>(antiga, b.familia, 'select public.acesso_estado() e'))[0]!.e).toMatchObject({ completo: true, pagamentos: [] })
      const resumo = (await q<{ r: { entradas: { candidatura_id: string; estado: string }[]; dados: unknown } }>(antiga, b.lar, 'select public.faturacao_resumo() r'))[0]!.r
      expect(resumo.dados).toBeNull()
      expect(resumo.entradas).toEqual([expect.objectContaining({ candidatura_id: c!.id, estado: 'faturavel' })])
      // sem dados de faturação nada se reserva; as fichas de demonstração do seed nunca
      const bd = new BDPGlite(antiga)
      expect(await bd.rpc('servico_reservar_documentos', { p_modo: 'fatura_por_entrada', p_agora: new Date().toISOString(), p_limite: 500 })).toEqual({ reservados: 0 })
      // ARRANQUE: as entradas anteriores ao arranque que não se querem faturar ficam dispensadas (contestação aceite
      // registada pela equipa — playbook em docs/SUPABASE.md, secção 15)
      await admin(antiga, `insert into public.contestacoes_entrada (candidatura_id, instituicao_id, estado, motivo, contestada_em, resolvida_em, nota_resolucao)
        select c.id, c.instituicao_id, 'aceite', 'Entrada anterior ao início da faturação.', now(), now(), 'Arranque da faturação.'
          from public.candidaturas c where c.entrada_taxa = 'aplicavel' and c.entrada_data < current_date + 1`)
      await q(antiga, b.lar, "select public.guardar_dados_faturacao('Lar Real, Lda.', '599999993', 'Rua A, 1', '4000-001', 'Porto', 'f@lar.pt')")
      expect(await bd.rpc('servico_reservar_documentos', { p_modo: 'fatura_por_entrada', p_agora: new Date().toISOString(), p_limite: 500 })).toEqual({ reservados: 0 })
      expect((await q<{ r: { entradas: { estado: string }[] } }>(antiga, b.lar, 'select public.faturacao_resumo() r'))[0]!.r.entradas.map((e) => e.estado)).toEqual(['dispensada'])
    } finally {
      await antiga.close()
    }
  }, 180_000)
})
