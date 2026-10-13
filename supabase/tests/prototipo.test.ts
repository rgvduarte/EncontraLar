/**
 * A base de demonstração (seed.sql + demo/utilizadores-demo.sql) reproduz o modo demonstração
 * (createSeed) através da vista pública, das RPC e dos mappers — e as salvaguardas do script de
 * demonstração. Inclui o modelo de negócio: profissional e casos, encaminhamentos, entradas, a
 * avaliação verificada, a procura sem resposta e os links de confirmação das vagas.
 */
import type { PGlite } from '@electric-sql/pglite'
import { createHash } from 'node:crypto'
import { beforeAll, describe, expect, it } from 'vitest'
import { createSeed, DEMO_FAMILIA_ID, DEMO_LAR_ID, DEMO_LAR_USER_ID, DEMO_PRO_ID } from '@/data/seed'
import { origemDe, resumirProcuras, resumoAnonimo } from '@/lib/negocio'
import {
  candidaturaDeLinha,
  casoDeLinha,
  eCandidaturaMinimizada,
  larDeLinha,
  painelDeLinha,
  pedidoRecebidoDeLinha,
  procuraNaZonaDeLinha,
  reviewDeLinha,
  vagasPorTokenDeLinha,
} from '@/lib/supabase-mappers'
import type {
  AvaliacaoPublicaRow,
  CandidaturaEventoRow,
  CandidaturaRow,
  CasoRow,
  InstituicaoPublicaRow,
  PainelInstituicaoRow,
  PedidoRecebidoRow,
  ProcuraNaZonaRow,
  VagasPorTokenRow,
} from '@/lib/supabase-mappers'
import type { Candidatura, Lar } from '@/types'
import { AGORA_SEED, contasDemo, desbloqueioDe } from '../../scripts/gerar-seed-sql'
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
/** current_date da base (as datas AAAA-MM-DD do script demo são current_date ± N) */
let hojeBd = ''

type LinhaComEventos = CandidaturaRow & { candidatura_eventos: Pick<CandidaturaEventoRow, 'estado' | 'nota' | 'created_at'>[] }

const demoSql = () => lerSql('demo/utilizadores-demo.sql')
const desloca = (isoProto: string | undefined, d = desvio) => (isoProto ? new Date(Date.parse(isoProto) + d).toISOString() : undefined)
/** uuid de um registo do protótipo na BD de demonstração (md5('encontralar:<id>')::uuid, como o gerador) */
const uuidDemo = (id: string) => createHash('md5').update(`encontralar:${id}`).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
/** Dia AAAA-MM-DD → nº de dias em relação ao "hoje" de quem o gerou (protótipo: AGORA_SEED; BD: current_date) */
const diasProto = (ymd: string | undefined) => (ymd ? Math.round((Date.parse(ymd) - AGORA_SEED) / 86_400_000) : undefined)
const diasBd = (ymd: string | undefined) => (ymd ? Math.round((Date.parse(ymd) - Date.parse(hojeBd)) / 86_400_000) : undefined)

const doLarDemo = proto.candidaturas.filter((c) => c.larId === DEMO_LAR_ID)

beforeAll(async () => {
  db = await criarBase({ seed: true })
  const lar = proto.lares.find((l) => l.id === DEMO_LAR_ID)!
  const [r] = await adm<{ t: string; d: string }>('select atualizado_em::text t, current_date::text d from public.instituicoes where id = $1', [DEMO_LAR_ID])
  desvio = Date.parse(r!.t) - Date.parse(lar.atualizadoEm)
  hojeBd = r!.d
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
        await criarUtilizador(db, {
          email: c.email, roleAdmin: c.role, nome: c.nome, confirmado: c.email !== 'rui.sousa@exemplo.pt',
          appExtra: c.organizacao ? { organizacao: c.organizacao } : undefined,
        }),
      )
    }
    await expect(db.exec(demoSql())).rejects.toThrow(/rui\.sousa@exemplo\.pt/)
    await adm("update auth.users set email_confirmed_at = now() where email = 'rui.sousa@exemplo.pt'")
  })

  it('liga as contas (famílias, gestora e assistente social): a gestora fica dona do lar de demonstração', async () => {
    // a equipa de terreno é interna (só no protótipo): não tem conta na base
    expect(contas).toHaveLength(proto.users.filter((u) => u.role !== 'equipa').length)
    expect(contas.find((c) => c.role === 'profissional')).toMatchObject({ email: 'social@exemplo.pt', organizacao: { tipo: 'hospital' } })
    await db.exec(demoSql())
    await db.exec(demoSql()) // segunda vez: não faz nada
    const [t] = await adm<{ t: string }>("select created_at::text t from public.candidaturas where id = md5('encontralar:c-ana-1')::uuid")
    desvioDemo = Date.parse(t!.t) - Date.parse(proto.candidaturas.find((c) => c.id === 'c-ana-1')!.criadaEm)
    const lar = uuid.get(DEMO_LAR_USER_ID)!
    const [p] = await q<PainelInstituicaoRow>(db, lar, 'select * from public.painel_instituicao()')
    expect(painelDeLinha(p!, lar)).toMatchObject({ larId: DEMO_LAR_ID, listaEsperaOffline: 10, listaEsperaOnline: 4 })

    // duas fases: na tabela a gestora só lê os pedidos que já aceitou; o painel (pedidos_recebidos) tem todos
    const naTabela = await q<{ id: string }>(db, lar, 'select id from public.candidaturas')
    expect(naTabela.map((x) => x.id).sort()).toEqual(doLarDemo.filter((c) => desbloqueioDe(c)).map((c) => uuidDemo(c.id)).sort())
    expect(naTabela.length).toBeLessThan(doLarDemo.length)
    const painel = await q<{ estado: string; posicao: number | null }>(db, lar, 'select estado, posicao from public.pedidos_recebidos() order by posicao nulls last')
    expect(painel).toHaveLength(doLarDemo.length)
    expect(painel.filter((c) => c.posicao != null).map((c) => c.posicao)).toEqual([2, 3, 4, 6])
    expect(painel.filter((c) => c.estado === 'aceite')).toHaveLength(doLarDemo.filter((c) => c.estado === 'aceite').length)
    expect(painel.filter((c) => c.estado === 'admitida')).toHaveLength(doLarDemo.filter((c) => c.estado === 'admitida').length)
    const [v] = await q<{ lista_espera: number }>(db, 'anon', 'select lista_espera from public.instituicoes_publicas where id = $1', [DEMO_LAR_ID])
    expect(v!.lista_espera).toBe(proto.lares.find((l) => l.id === DEMO_LAR_ID)!.listaEspera)
    // todas as contas ficam marcadas como demonstração; a assistente social com a organização
    const [d] = await adm<{ n: number }>('select count(*)::int n from public.perfis_utilizador where demonstracao')
    expect(d!.n).toBe(contas.length)
    const [pro] = await q<{ role: string; organizacao: unknown }>(db, uuid.get(DEMO_PRO_ID)!, 'select role, organizacao from public.perfis_utilizador')
    expect(pro).toEqual({ role: 'profissional', organizacao: proto.users.find((u) => u.id === DEMO_PRO_ID)!.organizacao })
  })

  it('as notificações do protótipo chegam às contas de demonstração e as rotas apontam para registos que existem', async () => {
    for (const id of [DEMO_FAMILIA_ID, DEMO_LAR_USER_ID, DEMO_PRO_ID]) {
      const r = await q<{ titulo: string }>(db, uuid.get(id)!, "select titulo from public.notificacoes where titulo <> 'Bem-vindo(a) ao EncontraLar' order by titulo")
      expect(r.map((x) => x.titulo), id).toEqual(proto.notificacoes.filter((n) => n.userId === id).map((n) => n.titulo).sort())
    }
    const links = await adm<{ link: string }>("select link from public.notificacoes where link like '/gestao/pedidos?pedido=%' or link like '/casos/%'")
    expect(links.length).toBeGreaterThanOrEqual(4)
    for (const { link } of links) {
      const id = link.split(/[=/]/).pop()!
      const [e] = await adm<{ n: number }>('select (select count(*) from public.candidaturas where id::text = $1) + (select count(*) from public.casos where id::text = $1) as n', [id])
      expect(Number(e!.n), link).toBe(1)
    }
    // o aviso do encaminhamento ao lar não identifica a pessoa
    const [enc] = await adm<{ texto: string }>("select texto from public.notificacoes where titulo = 'Novo encaminhamento'")
    expect(enc!.texto).not.toMatch(/Albano|Marta/)
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
    // nem os casos da assistente social de demonstração
    const pro = uuid.get(DEMO_PRO_ID)!
    expect(await q(db, pro, 'select * from public.enviar_caso($1, $2)', [uuidDemo('caso-3'), [semDono!.id]])).toEqual([])
  })
})

describe('ida e volta: base de demonstração → mappers = createSeed', () => {
  it('as 162 fichas da vista pública coincidem com o protótipo (exceto dados internos do dono e o token do link)', async () => {
    const linhas = await json<InstituicaoPublicaRow>(db, 'anon', 'select * from public.instituicoes_publicas order by id')
    const avaliacoes = await json<AvaliacaoPublicaRow>(db, 'anon',
      'select id, instituicao_id, autor, relacao, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes, aspeto_comunicacao, texto, verificada, created_at from public.avaliacoes')
    const porLar = new Map<string, AvaliacaoPublicaRow[]>()
    for (const a of avaliacoes) porLar.set(a.instituicao_id, [...(porLar.get(a.instituicao_id) ?? []), a])
    expect(linhas).toHaveLength(proto.lares.length)
    const semInternos = (l: Lar) => {
      // planoInstituicao: modalidade comercial (contrato) — fica fora da vista pública
      const { ownerId: _o, visualizacoes30d: _v, confirmacaoToken: _t, planoInstituicao: _p, planoDesde: _pd, reviews, atualizadoEm, verificacao, ...resto } = l
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

  /** O que tem de coincidir entre o protótipo e a BD (datas AAAA-MM-DD em dias relativos; ids de casos em uuid). */
  const resumo = (c: Candidatura, dias: (ymd: string | undefined) => number | undefined, casoId: (id: string) => string) => ({
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
    origem: origemDe(c),
    encaminhamento: c.encaminhamento && { casoId: casoId(c.encaminhamento.casoId), organizacao: c.encaminhamento.organizacao, altaPrevista: dias(c.encaminhamento.altaPrevista) },
    entrada: c.entrada && { data: dias(c.entrada.data), taxa: c.entrada.taxa, lar: !!c.entrada.confirmadaLarEm, familia: !!c.entrada.confirmadaFamiliaEm },
  })

  it('os pedidos do protótipo voltam iguais pelo candidaturaDeLinha (lidos por quem os fez)', async () => {
    const SQL = `select c.*, (select json_agg(e) from (select estado, nota, created_at from public.candidatura_eventos e where e.candidatura_id = c.id) e) as candidatura_eventos
                   from public.candidaturas c where c.id = $1`
    for (const c of proto.candidaturas) {
      const [linha] = await json<LinhaComEventos>(db, uuid.get(c.userId)!, SQL, [uuidDemo(c.id)])
      expect(linha, c.id).toBeDefined()
      const daBd = candidaturaDeLinha(linha!)
      if (eCandidaturaMinimizada(daBd)) throw new Error(`${c.id} não devia estar minimizada`)
      expect(resumo(daBd, diasBd, (id) => id), c.id).toEqual(resumo(c, diasProto, uuidDemo))
      expect(daBd.historico.map((h) => h.data), c.id).toEqual(c.historico.map((h) => desloca(h.data, desvioDemo)))
      expect(daBd.criadaEm, c.id).toBe(desloca(c.criadaEm, desvioDemo))
      expect(daBd.desbloqueadaEm, c.id).toBe(desloca(desbloqueioDe(c), desvioDemo))
      expect(daBd.entrada && [daBd.entrada.confirmadaLarEm, daBd.entrada.confirmadaFamiliaEm], c.id)
        .toEqual(c.entrada && [desloca(c.entrada.confirmadaLarEm, desvioDemo), desloca(c.entrada.confirmadaFamiliaEm, desvioDemo)])
      if (c.encaminhamento) expect(daBd.encaminhamento!.profissionalId).toBe(uuid.get(c.encaminhamento.profissionalId))
      expect(Number.isNaN(daBd.perfil.local.lat), 'coordenadas não são partilhadas').toBe(true)
    }
  })

  it('o painel do lar (pedidos_recebidos): resumo igual ao do protótipo; o que não foi aceite não traz nome nem contacto', async () => {
    const pedidos = await json<PedidoRecebidoRow>(db, uuid.get(DEMO_LAR_USER_ID)!, 'select * from public.pedidos_recebidos()')
    const semData = (r: ReturnType<typeof resumoAnonimo>, dias: (ymd: string | undefined) => number | undefined) => ({ ...r, altaPrevista: dias(r.altaPrevista) })
    for (const c of doLarDemo) {
      const p = pedidos.find((x) => x.id === uuidDemo(c.id))
      expect(p, c.id).toBeDefined()
      const daBd = pedidoRecebidoDeLinha(p!)
      if (eCandidaturaMinimizada(daBd)) throw new Error(`${c.id} não devia estar minimizada`)
      expect(semData(resumoAnonimo(daBd), diasBd), c.id).toEqual(semData(resumoAnonimo(c), diasProto))
      if (desbloqueioDe(c)) {
        expect(daBd.contacto, c.id).toEqual(c.contacto)
        expect(daBd.perfil.nome, c.id).toBe(c.perfil.nome)
        expect(daBd.historico.map((h) => h.estado), c.id).toEqual(c.historico.map((h) => h.estado))
      } else {
        expect([p!.contacto, p!.perfil_snapshot, p!.mensagem, p!.user_id, p!.historico], c.id).toEqual([null, null, null, null, null])
        const texto = JSON.stringify(p)
        for (const segredo of [c.perfil.nome, c.contacto.nome, c.contacto.email, c.mensagem, c.perfil.notas]) if (segredo) expect(texto, c.id).not.toContain(segredo)
      }
    }
  })

  it('os casos da assistente social voltam iguais pelo casoDeLinha (e ninguém mais os vê)', async () => {
    const pro = uuid.get(DEMO_PRO_ID)!
    const linhas = await json<CasoRow>(db, pro, 'select * from public.casos')
    expect(linhas).toHaveLength(proto.casos.length)
    for (const k of proto.casos) {
      const daBd = casoDeLinha(linhas.find((x) => x.id === uuidDemo(k.id))!)
      expect({ ...daBd, altaPrevista: diasBd(daBd.altaPrevista) }, k.id).toEqual({
        ...k, id: uuidDemo(k.id), perfilId: uuidDemo(k.perfilId), profissionalId: pro, altaPrevista: diasProto(k.altaPrevista),
        criadoEm: desloca(k.criadoEm, desvioDemo), atualizadoEm: desloca(k.atualizadoEm, desvioDemo),
      })
    }
    for (const outro of [DEMO_FAMILIA_ID, DEMO_LAR_USER_ID]) expect(await q(db, uuid.get(outro)!, 'select id from public.casos')).toEqual([])
  })

  it('a procura sem resposta do distrito do lar (procura_na_zona) é a do protótipo (resumirProcuras)', async () => {
    const [r] = await json<ProcuraNaZonaRow>(db, uuid.get(DEMO_LAR_USER_ID)!, 'select * from public.procura_na_zona(31)')
    const daBd = procuraNaZonaDeLinha(r)
    const esperado = resumirProcuras(proto.procuras.filter((p) => p.distrito === 'Porto'))
    expect(daBd.total).toBe(esperado.total)
    expect(daBd.total).toBeGreaterThan(10)
    expect(Object.fromEntries(daBd.cuidados)).toEqual(Object.fromEntries(esperado.cuidados))
    expect(Object.fromEntries(daBd.graus)).toEqual(Object.fromEntries(esperado.graus))
    expect(daBd.orcamentoMediano).toBe(esperado.orcamentoMediano)
  })

  it('o link de confirmação do protótipo (/confirmar/:token) encontra a mesma instituição', async () => {
    const lar = proto.lares.find((l) => l.id === DEMO_LAR_ID)!
    const [r] = await json<VagasPorTokenRow>(db, 'anon', 'select * from public.vagas_por_token($1)', [lar.confirmacaoToken])
    expect(vagasPorTokenDeLinha(r!)).toMatchObject({ larId: lar.id, nome: lar.nome, quartos: lar.quartos.map(({ tipo, total, livres }) => ({ tipo, total, livres })) })
  })
})

describe('a base de demonstração continua a funcionar pelas RPC', () => {
  it('a lista continua a seguir o protótipo: o próximo inscrito fica na posição 15', async () => {
    const lar = uuid.get(DEMO_LAR_USER_ID)!
    const [r] = await q<{ posicao: number }>(db, lar, "select posicao from public.atualizar_estado_candidatura($1, 'lista_espera')", [uuidDemo('c-fam-1')])
    expect(r!.posicao).toBe(15)
  })

  it('a gestora aceita o encaminhamento pendente e passa a ver o contacto da assistente social', async () => {
    const lar = uuid.get(DEMO_LAR_USER_ID)!
    const c = proto.candidaturas.find((x) => x.id === 'c-pro-1')!
    expect(await q(db, lar, 'select id from public.candidaturas where id = $1', [uuidDemo(c.id)])).toEqual([])
    await q(db, lar, 'select public.aceitar_candidatura($1)', [uuidDemo(c.id)])
    const [r] = await q<{ contacto: unknown; mensagem: string }>(db, lar, 'select contacto, mensagem from public.candidaturas where id = $1', [uuidDemo(c.id)])
    expect(r).toEqual({ contacto: c.contacto, mensagem: c.mensagem })
  })

  it('avaliação verificada: quem confirmou a entrada já avaliou (uma por pedido); quem ainda não confirmou só depois', async () => {
    const teresa = uuid.get('u-fam-6')!
    expect(await q(db, teresa, 'select candidatura_id, verificada from public.minhas_avaliacoes()')).toEqual([{ candidatura_id: uuidDemo('c-fam-6'), verificada: true }])
    const aspetos = '{"cuidados":4,"alimentacao":4,"instalacoes":4,"comunicacao":4}'
    expect(await erro(db, teresa, 'select public.avaliar_lar($1, 4, $2, $3)', [uuidDemo('c-fam-6'), 'Segunda avaliação do mesmo pedido.', aspetos])).toMatch(/Já avaliou/)
    const luis = uuid.get('u-fam-7')!
    expect(await erro(db, luis, 'select public.avaliar_lar($1, 4, $2, $3)', [uuidDemo('c-fam-7'), 'Ainda não confirmei a entrada.', aspetos])).toMatch(/depois de confirmar a entrada/)
    await q(db, luis, 'select public.confirmar_entrada_familia($1, current_date)', [uuidDemo('c-fam-7')])
    const [av] = await q<{ verificada: boolean }>(db, luis, 'select verificada from public.avaliar_lar($1, 4, $2, $3)', [uuidDemo('c-fam-7'), 'A minha mãe está bem cuidada.', aspetos])
    expect(av!.verificada).toBe(true)
  })
})
