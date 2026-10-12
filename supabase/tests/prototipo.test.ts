/**
 * A base de demonstração (seed.sql + demo/utilizadores-demo.sql) reproduz o modo demonstração
 * (createSeed) através da vista pública e dos mappers — e as salvaguardas do script de demonstração.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSeed, DEMO_FAMILIA_ID, DEMO_LAR_ID, DEMO_LAR_USER_ID } from '@/data/seed'
import { candidaturaDeLinha, eCandidaturaMinimizada, larDeLinha, painelDeLinha, reviewDeLinha } from '@/lib/supabase-mappers'
import type { AvaliacaoPublicaRow, CandidaturaEventoRow, CandidaturaRow, InstituicaoPublicaRow, PainelInstituicaoRow } from '@/lib/supabase-mappers'
import type { Candidatura, Lar } from '@/types'
import { AGORA_SEED, contasDemo } from '../../scripts/gerar-seed-sql'
import { admin, criarBase, criarUtilizador, erro, json, lerSql, q } from './helpers'

let db: PGlite
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)
const proto = createSeed(AGORA_SEED)
const contas = contasDemo(proto)
/** uuid de cada conta do protótipo (preenchido quando as contas são criadas) */
const uuid = new Map<string, string>()
/** desfasamento entre o momento em que o seed (e o script demo) correu e AGORA_SEED (as datas são relativas a now()) */
let desvio = 0
let desvioDemo = 0

type LinhaComEventos = CandidaturaRow & { candidatura_eventos: Pick<CandidaturaEventoRow, 'estado' | 'nota' | 'created_at'>[] }

const demoSql = () => lerSql('demo/utilizadores-demo.sql')
const desloca = (isoProto: string | undefined, d = desvio) => (isoProto ? new Date(Date.parse(isoProto) + d).toISOString() : undefined)

beforeAll(async () => {
  db = await criarBase({ seed: true })
  const lar = proto.lares.find((l) => l.id === DEMO_LAR_ID)!
  const [r] = await adm<{ t: string }>('select atualizado_em::text t from public.instituicoes where id = $1', [DEMO_LAR_ID])
  desvio = Date.parse(r!.t) - Date.parse(lar.atualizadoEm)
}, 120_000)

describe('script das contas de demonstração (utilizadores-demo.sql)', () => {
  it('recusa contas registadas por terceiros só com o e-mail (sem app_metadata.role) ou por confirmar', async () => {
    // alguém registou-se primeiro com o e-mail da gestora de demonstração, a pedir o papel 'lar'
    const intruso = await criarUtilizador(db, { email: 'lar@exemplo.pt', roleRegisto: 'lar' })
    await expect(db.exec(demoSql())).rejects.toThrow(/Contas de demonstração em falta ou inválidas.*lar@exemplo\.pt/)
    const [f] = await adm<{ owner_id: string | null }>('select owner_id from public.instituicoes where id = $1', [DEMO_LAR_ID])
    expect(f!.owner_id).toBeNull()
    await adm('delete from auth.users where id = $1', [intruso])

    // contas criadas como a Auth Admin API (scripts/criar-contas-demo.mjs) faria, mas uma por confirmar
    for (const c of contas) {
      uuid.set(
        proto.users.find((u) => u.email.toLowerCase() === c.email)!.id,
        await criarUtilizador(db, { email: c.email, roleAdmin: c.role, nome: c.nome, confirmado: c.email !== 'rui.sousa@exemplo.pt' }),
      )
    }
    await expect(db.exec(demoSql())).rejects.toThrow(/rui\.sousa@exemplo\.pt/)
    await adm("update auth.users set email_confirmed_at = now() where email = 'rui.sousa@exemplo.pt'")
  })

  it('liga as 8 contas: a gestora fica dona do lar de demonstração, com os 7 pedidos do protótipo', async () => {
    await db.exec(demoSql())
    await db.exec(demoSql()) // segunda vez: não faz nada
    const [t] = await adm<{ t: string }>("select created_at::text t from public.candidaturas where id = md5('encontralar:c-ana-1')::uuid")
    desvioDemo = Date.parse(t!.t) - Date.parse(proto.candidaturas.find((c) => c.id === 'c-ana-1')!.criadaEm)
    const lar = uuid.get(DEMO_LAR_USER_ID)!
    const [p] = await q<PainelInstituicaoRow>(db, lar, 'select * from public.painel_instituicao()')
    expect(painelDeLinha(p!, lar)).toMatchObject({ larId: DEMO_LAR_ID, listaEsperaOffline: 10, listaEsperaOnline: 4 })
    const cands = await q<{ estado: string; posicao: number | null }>(db, lar, 'select estado, posicao from public.candidaturas order by posicao nulls last')
    expect(cands).toHaveLength(proto.candidaturas.filter((c) => c.larId === DEMO_LAR_ID).length)
    expect(cands.filter((c) => c.posicao != null).map((c) => c.posicao)).toEqual([2, 3, 4, 6])
    expect(cands.filter((c) => c.estado === 'aceite')).toHaveLength(1)
    const [v] = await q<{ lista_espera: number }>(db, 'anon', 'select lista_espera from public.instituicoes_publicas where id = $1', [DEMO_LAR_ID])
    expect(v!.lista_espera).toBe(proto.lares.find((l) => l.id === DEMO_LAR_ID)!.listaEspera)
    // todas as contas ficam marcadas como demonstração
    const [d] = await adm<{ n: number }>('select count(*)::int n from public.perfis_utilizador where demonstracao')
    expect(d!.n).toBe(contas.length)
  })

  it('as notificações do protótipo chegam à família e à gestora (incluindo as dos pedidos de outras famílias)', async () => {
    for (const id of [DEMO_FAMILIA_ID, DEMO_LAR_USER_ID]) {
      const r = await q<{ titulo: string }>(db, uuid.get(id)!, "select titulo from public.notificacoes where titulo <> 'Bem-vindo(a) ao EncontraLar' order by titulo")
      expect(r.map((x) => x.titulo)).toEqual(proto.notificacoes.filter((n) => n.userId === id).map((n) => n.titulo).sort())
    }
  })
})

describe('isolamento demonstração ↔ real', () => {
  it('uma família real não envia dados de saúde a fichas de demonstração; a família de demonstração só ao lar com gestora', async () => {
    const real = await criarUtilizador(db, { email: 'real@familia.pt', roleAdmin: 'familia' })
    const [p] = await q<{ id: string }>(db, real, `insert into public.perfis_cuidados (nome, idade, grau, local_lat, local_lng, notas)
      values ('Pessoa real', 90, 'grave', 41, -8, 'Dados reais') returning id`)
    expect(await erro(db, real, 'select public.candidatar($1, $2, true)', [DEMO_LAR_ID, p!.id])).toMatch(/ficha é de demonstração/)

    // fichas do seed sem gestor (101 com selo "verificado") não recebem pedidos
    const ana = uuid.get(DEMO_FAMILIA_ID)!
    const [semDono] = await adm<{ id: string }>(
      "select id from public.instituicoes where owner_id is null and verificacao_estado = 'verificado' and publicado limit 1",
    )
    const [perfilAna] = await q<{ id: string }>(db, ana, 'select id from public.perfis_cuidados limit 1')
    expect(await erro(db, ana, 'select public.candidatar($1, $2, true)', [semDono!.id, perfilAna!.id])).toMatch(/ainda não recebe pedidos/)
  })
})

describe('ida e volta: base de demonstração → mappers = createSeed', () => {
  it('as 162 fichas da vista pública coincidem com o protótipo (exceto dados internos do dono)', async () => {
    const linhas = await json<InstituicaoPublicaRow>(db, 'anon', 'select * from public.instituicoes_publicas order by id')
    const avaliacoes = await json<AvaliacaoPublicaRow>(db, 'anon',
      'select id, instituicao_id, autor, relacao, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes, aspeto_comunicacao, texto, verificada, created_at from public.avaliacoes')
    const porLar = new Map<string, AvaliacaoPublicaRow[]>()
    for (const a of avaliacoes) porLar.set(a.instituicao_id, [...(porLar.get(a.instituicao_id) ?? []), a])
    expect(linhas).toHaveLength(proto.lares.length)
    const semInternos = (l: Lar) => {
      const { ownerId: _o, visualizacoes30d: _v, reviews, atualizadoEm, verificacao, ...resto } = l
      return { ...resto, atualizadoEm: Date.parse(atualizadoEm), verificacao: { ...verificacao, data: verificacao.data && Date.parse(verificacao.data), ultimaInspecao: verificacao.ultimaInspecao && Date.parse(verificacao.ultimaInspecao) }, reviews: reviews.map(({ id: _i, data, ...r }) => ({ ...r, data: Date.parse(data) })) }
    }
    for (const l of proto.lares) {
      const r = linhas.find((x) => x.id === l.id)
      expect(r, l.id).toBeDefined()
      const daBd = larDeLinha(r!, (porLar.get(l.id) ?? []).map(reviewDeLinha))
      const esperado = semInternos({
        ...l,
        atualizadoEm: desloca(l.atualizadoEm)!,
        verificacao: { ...l.verificacao, data: desloca(l.verificacao.data), ultimaInspecao: desloca(l.verificacao.ultimaInspecao) },
        reviews: l.reviews.map((rv) => ({ ...rv, data: desloca(rv.data)! })),
      })
      expect(semInternos(daBd), l.id).toEqual(esperado)
    }
  })

  it('os pedidos do protótipo voltam iguais pelo candidaturaDeLinha (cópia do perfil reduzida ao necessário)', async () => {
    const lar = uuid.get(DEMO_LAR_USER_ID)!
    const ana = uuid.get(DEMO_FAMILIA_ID)!
    const linhas = [
      ...(await json<LinhaComEventos>(db, ana,
        'select c.*, (select json_agg(e) from (select estado, nota, created_at from public.candidatura_eventos e where e.candidatura_id = c.id) e) as candidatura_eventos from public.candidaturas c')),
      ...(await json<LinhaComEventos>(db, lar,
        "select c.*, (select json_agg(e) from (select estado, nota, created_at from public.candidatura_eventos e where e.candidatura_id = c.id) e) as candidatura_eventos from public.candidaturas c where c.user_id <> $1", [ana])),
    ]
    const resumo = (c: Candidatura) => ({
      larId: c.larId,
      estado: c.estado,
      posicao: c.posicao,
      mensagem: c.mensagem,
      visita: c.visita && { hora: c.visita.hora, estado: c.visita.estado },
      contacto: c.contacto,
      perfil: (({ nome, idade, relacao, genero, grau, necessidades, preferencias, quarto, orcamentoMax, urgencia, precisaAcordoSS, notas }) =>
        ({ nome, idade, relacao, genero, grau, necessidades, preferencias, quarto, orcamentoMax, urgencia, precisaAcordoSS, notas }))(c.perfil),
      local: c.perfil.local.label,
      historico: c.historico.map((h) => ({ estado: h.estado, nota: h.nota })),
    })
    for (const c of proto.candidaturas) {
      const linha = linhas.find((r) => (r.contacto as { nome: string }).nome === c.contacto.nome && r.instituicao_id === c.larId)
      expect(linha, c.id).toBeDefined()
      const daBd = candidaturaDeLinha(linha!)
      if (eCandidaturaMinimizada(daBd)) throw new Error(`${c.id} não devia estar minimizada`)
      expect(resumo(daBd), c.id).toEqual(resumo(c))
      expect(daBd.historico.map((h) => h.data), c.id).toEqual(c.historico.map((h) => desloca(h.data, desvioDemo)))
      expect(daBd.criadaEm, c.id).toBe(desloca(c.criadaEm, desvioDemo))
      expect(Number.isNaN(daBd.perfil.local.lat), 'coordenadas não são partilhadas').toBe(true)
    }
  })
})

describe('a base de demonstração continua a funcionar pelas RPC', () => {
  it('a lista continua a seguir o protótipo: o próximo inscrito fica na posição 15', async () => {
    const lar = uuid.get(DEMO_LAR_USER_ID)!
    const sandra = proto.candidaturas.find((c) => c.id === 'c-fam-1')!
    const [row] = await q<{ id: string }>(db, lar, `select id from public.candidaturas where contacto ->> 'nome' = $1`, [sandra.contacto.nome])
    const [r] = await q<{ posicao: number }>(db, lar, "select posicao from public.atualizar_estado_candidatura($1, 'lista_espera')", [row!.id])
    expect(r!.posicao).toBe(15)
  })
})
