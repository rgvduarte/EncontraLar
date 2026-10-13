/**
 * Acesso Família no servidor (20261013110000): a divisão entre a versão grátis e a camada completa é imposta pela
 * base de dados, não pela interface. Espelha src/lib/acesso.ts (temAcessoCompleto, novoAte, faixaPreco,
 * resumoDisponibilidade, MIN_AGREGADO), src/lib/forecast.ts (vagaParaNovos, disponibilidade, poissonAtLeast,
 * SAZONALIDADE) e o que a ficha grátis mostra (src/features/lar-detail). Cada regra é provada do lado de quem a
 * tentaria contornar (Data API: anon / authenticated), por todos os caminhos: vista, RPC e tabelas.
 */
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createSeed } from '@/data/seed'
import { MIN_AGREGADO, novoAte, planoFamilia, resumoDisponibilidade } from '@/lib/acesso'
import { disponibilidade, estimarEspera, poissonAtLeast, SAZONALIDADE, vagaParaNovos, vagasLivres } from '@/lib/forecast'
import { acessoDeLinha, avaliacaoInstituicaoDeLinha, excertoAvaliacao, type AvaliacaoInstituicaoRow } from '@/lib/supabase-mappers'
import type { Json } from '@/lib/database.types'
import type { Lar } from '@/types'
import { AGORA_SEED } from '../../scripts/gerar-seed-sql'
import { admin, aplicarMigracoes, cenarioBase, como, criarBase, criarUtilizador, darAcesso, erro, json, q } from './helpers'

// a previsão do protótipo conta os dias a partir da data local; a BD usa a data de Lisboa
const TZ_ANTES = process.env.TZ
process.env.TZ = 'Europe/Lisbon'

let db: PGlite
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)
const proto = createSeed(AGORA_SEED)

/** Erro completo (mensagem, código e hint) de uma instrução que deve falhar. */
async function falha(quem: Parameters<typeof q>[1], sql: string, params: unknown[] = []): Promise<{ message: string; code?: string; hint?: string }> {
  try {
    await q(db, quem, sql, params)
  } catch (e) {
    const x = e as { message: string; code?: string; hint?: string }
    return { message: x.message, code: x.code, hint: x.hint }
  }
  throw new Error(`devia falhar: ${sql}`)
}

const PERFIL = `insert into public.perfis_cuidados (nome, idade, grau, local_lat, local_lng) values ('Rosa', 82, 'moderada', 41.15, -8.6) returning id`

beforeAll(async () => {
  db = await criarBase({ seed: true })
}, 120_000)

afterAll(() => {
  if (TZ_ANTES === undefined) delete process.env.TZ
  else process.env.TZ = TZ_ANTES
})

// ————————————————————————————————————————————————————————————————— agregados

/** Estado de cada ficha como resumoDisponibilidade a conta (vagaParaNovos; senão disponibilidade 'breve'). */
function estadoProto(l: Lar): string {
  const est = estimarEspera(l)
  if (vagaParaNovos(l, est)) return 'com_vaga'
  if (vagasLivres(l) > 0) return 'livre_com_lista'
  return disponibilidade(l, est) === 'breve' ? 'breve' : 'espera'
}

/** O que a versão grátis pode mostrar de um conjunto (MIN_AGREGADO). */
function agregadoProto(lares: Lar[]) {
  const r = resumoDisponibilidade(lares)
  return r.total >= MIN_AGREGADO ? { total: r.total, com_vaga: r.comVaga, breve: r.breve } : { total: r.total, com_vaga: null, breve: null }
}

describe('disponibilidade_agregada: quantas, nunca quais (base de demonstração = protótipo)', () => {
  it('as constantes da previsão são as de src/lib/forecast.ts (sazonalidade exata, Poisson termo a termo)', async () => {
    const saz = await adm<{ v: number }>('select private.sazonalidade(m) as v from generate_series(1, 12) m order by m')
    expect(saz.map((x) => x.v)).toEqual(SAZONALIDADE)
    for (const [k, l] of [[1, 0.3], [3, 2.5], [8, 6.2], [25, 9.9], [40, 61], [5, 1e-6], [400, 0.01], [3, 800], [1, 0], [0, 4]] as const) {
      const [r] = await adm<{ p: number }>('select private.poisson_pelo_menos($1, $2) as p', [k, l])
      expect(Math.abs(r!.p - poissonAtLeast(k, l)), `k=${k} λ=${l}`).toBeLessThanOrEqual(1e-12)
    }
    // Λ(90) por unidade de taxa: a soma de intensidadeAcumulada (dia a dia, a partir de hoje)
    const hoje = new Date()
    let soma = 0
    for (let i = 0; i < 90; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i)
      soma += SAZONALIDADE[d.getMonth()]! / new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    }
    const [f] = await adm<{ f: number }>("select private.intensidade_sazonal((now() at time zone 'Europe/Lisbon')::date, 90) as f")
    expect(Math.abs(f!.f - soma) / soma).toBeLessThan(1e-12)
  })

  it('cada ficha do seed tem o estado de vagaParaNovos/disponibilidade do protótipo (lista efetiva, Poisson, sazonalidade)', async () => {
    const r = await adm<{ id: string; estado: string }>(`
      select i.id, private.estado_disponibilidade(
          coalesce((select sum(q.livres) from public.quartos q where q.instituicao_id = i.id), 0)::integer,
          i.lista_espera_offline + i.lista_espera_online, i.capacidade, i.estadia_media_meses,
          case when exists (select 1 from public.saidas_mensais x where x.instituicao_id = i.id) then
            coalesce((select sum(s.saidas) from public.saidas_mensais s where s.instituicao_id = i.id
                       and s.mes between (date_trunc('month', now() at time zone 'Europe/Lisbon') - interval '11 months')::date
                                     and date_trunc('month', now() at time zone 'Europe/Lisbon')::date), 0)::double precision / 12
          end,
          private.intensidade_sazonal((now() at time zone 'Europe/Lisbon')::date, 90)) as estado
        from public.instituicoes i where i.publicado`)
    expect(r).toHaveLength(proto.lares.length)
    const porId = new Map(r.map((x) => [x.id, x.estado]))
    for (const l of proto.lares) expect(porId.get(l.id), l.id).toBe(estadoProto(l))
    // o seed tem os quatro casos (senão o teste não provava nada)
    expect(new Set(proto.lares.map(estadoProto))).toEqual(new Set(['com_vaga', 'livre_com_lista', 'breve', 'espera']))
  })

  it('por distrito, por concelho e no país: os números de resumoDisponibilidade, só a partir de 5 fichas (MIN_AGREGADO)', async () => {
    expect(MIN_AGREGADO).toBe(5)
    const zonas = new Map<string, Lar[]>()
    const juntar = (k: string, l: Lar) => zonas.set(k, [...(zonas.get(k) ?? []), l])
    for (const l of proto.lares) {
      juntar(`${l.distrito}|`, l)
      juntar(`${l.distrito}|${l.concelho}`, l)
    }
    let pequenas = 0
    for (const [zona, lares] of zonas) {
      const [d, c] = zona.split('|')
      const [r] = await q<Record<string, unknown>>(db, 'anon', 'select * from public.disponibilidade_agregada($1, $2)', [d, c || null])
      expect(r, zona).toEqual(agregadoProto(lares))
      if (lares.length < MIN_AGREGADO) pequenas++
    }
    expect(pequenas).toBeGreaterThan(0)
    const [pais] = await q<Record<string, unknown>>(db, 'anon', 'select * from public.disponibilidade_agregada(null)')
    expect(pais).toEqual(agregadoProto(proto.lares))
    expect((pais as { com_vaga: number }).com_vaga).toBeGreaterThan(0)
  })

  it('zona sem fichas, distrito inválido e concelho sem distrito', async () => {
    expect(await q(db, 'anon', "select * from public.disponibilidade_agregada('Porto', 'Concelho Que Não Existe')")).toEqual([{ total: 0, com_vaga: null, breve: null }])
    expect(await erro(db, 'anon', "select * from public.disponibilidade_agregada('Atlântida')")).toBe('Distrito inválido.')
    expect(await erro(db, 'anon', "select * from public.disponibilidade_agregada(null, 'Calheta')")).toBe('Indique o distrito do concelho.')
  })
})

// ————————————————————————————————————————————————————————————————— cenário: quem vê o quê

interface Contas {
  anon: 'anon'
  semPasse: string
  expirado: string
  comPasse: string
  demoComPasse: string
  profissional: string
  equipa: string
  /** gestora de outra ficha (versão grátis para as fichas dos outros) */
  outroLar: string
}

let b: Awaited<ReturnType<typeof cenarioBase>>
let c: Contas
/** valores da camada completa da ficha b.instituicao, únicos, para procurar fugas */
const SEGREDOS = ['229 990 001', 'segredo@lar-real.pt', 'Rua do Segredo, 7', '4000-777', 'segredo.example.pt', '17,77', '1537', '1789', '1213', '1414']
const segredosEm = (v: unknown) => SEGREDOS.filter((s) => JSON.stringify(v).includes(s))
const DEMO = proto.lares[0]!.id

describe('quem vê o quê (vista, RPC e tabelas)', () => {
  beforeAll(async () => {
    b = await cenarioBase(db, { sufixo: 'ac' })
    // camada completa com valores únicos (o administrador; o dono escreveria o mesmo pela sua ficha)
    await adm(
      `update public.instituicoes set telefone = '229 990 001', email = 'segredo@lar-real.pt', morada = 'Rua do Segredo, 7',
         codigo_postal = '4000-777', website = 'https://segredo.example.pt', lista_espera_offline = 7, estadia_media_meses = 41,
         extras = '[{"nome": "Cabeleireiro", "preco": "17,77 €"}]'
       where id = $1`,
      [b.instituicao],
    )
    await adm(`update public.quartos set preco_min = case tipo when 'individual' then 1537 else 1213 end,
                 preco_max = case tipo when 'individual' then 1789 else 1414 end where instituicao_id = $1`, [b.instituicao])
    await adm(`insert into public.saidas_mensais (instituicao_id, mes, saidas) values ($1, date_trunc('month', now() at time zone 'Europe/Lisbon')::date, 3)`, [b.instituicao])
    await adm(`insert into public.avaliacoes (instituicao_id, autor, relacao, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes, aspeto_comunicacao, texto, verificada, created_at)
               values ($1, 'Rui P.', 'Filho de residente', 4, 4, 3, 4, 5, $2, false, now() - interval '1 day'),
                      ($1, 'Inês L.', 'Neta de residente', 5, 5, 5, 4, 5, $3, true, now() - interval '30 days'),
                      ($1, 'Carla S.', 'Filha de residente', 3, 3, 3, 3, 3, 'Comunicação podia ser melhor, mas a equipa é dedicada.', false, now() - interval '3 days')`,
      [b.instituicao, `Recente e sem verificação. ${'Um texto comprido sobre a casa. '.repeat(10)}`, `A melhor decisão que tomámos para a minha avó, que está feliz e bem tratada. ${'Detalhe longo da experiência, com muitas palavras seguidas, '.repeat(8)}FIM-DO-TEXTO-COMPLETO`],
    )
    const outra = await cenarioBase(db, { sufixo: 'ac2' })
    c = {
      anon: 'anon',
      semPasse: await criarUtilizador(db, { email: 'sem-passe@x.pt', roleAdmin: 'familia' }),
      expirado: await criarUtilizador(db, { email: 'expirado@x.pt', roleAdmin: 'familia' }),
      comPasse: await criarUtilizador(db, { email: 'com-passe@x.pt', roleAdmin: 'familia', acesso: true }),
      demoComPasse: await criarUtilizador(db, { email: 'demo-com-passe@x.pt', roleAdmin: 'familia', acesso: true }),
      profissional: await criarUtilizador(db, { email: 'as@hospital.pt', roleAdmin: 'profissional', appExtra: { organizacao: { nome: 'Hospital Teste', tipo: 'hospital' } } }),
      equipa: await criarUtilizador(db, { email: 'equipa-ac@encontralar.pt', roleAdmin: 'equipa' }),
      outroLar: outra.lar,
    }
    await darAcesso(db, c.expirado, -1)
    await adm('update public.perfis_utilizador set demonstracao = true where id = $1', [c.demoComPasse])
  }, 60_000)

  const semAcesso = () => [c.anon, c.semPasse, c.expirado, c.outroLar] as const
  const comAcesso = () => [c.comPasse, c.profissional, c.equipa] as const

  it('sem acesso (anon, família sem passe ou com o passe terminado, outra instituição): nenhuma coluna da camada completa na tabela', async () => {
    for (const quem of semAcesso()) {
      for (const col of ['morada', 'codigo_postal', 'telefone', 'email', 'website', 'lista_espera_offline', 'lista_espera_online', 'estadia_media_meses', 'extras', 'atualizado_em', 'updated_at', '*']) {
        expect(await erro(db, quem, `select ${col} from public.instituicoes where id = $1`, [b.instituicao]), `${quem} ${col}`).toMatch(/permission denied/)
      }
      // as colunas públicas continuam legíveis (incluindo os nomes dos extras, sem os valores)
      expect(await q(db, quem, 'select nome, extras_nomes from public.instituicoes where id = $1', [b.instituicao])).toEqual([{ nome: 'Real AC', extras_nomes: ['Cabeleireiro'] }])
    }
  })

  it('sem acesso: quartos, saídas mensais e avaliações não se leem na tabela (anon: sem permissão; contas: zero linhas)', async () => {
    for (const t of ['quartos', 'saidas_mensais', 'avaliacoes']) {
      expect(await erro(db, 'anon', `select * from public.${t}`), t).toMatch(/permission denied/)
      for (const quem of [c.semPasse, c.expirado]) expect(await q(db, quem, `select instituicao_id from public.${t}`), `${quem} ${t}`).toEqual([])
      // a outra instituição só lê as linhas da sua ficha
      const daOutra = await q<{ instituicao_id: string }>(db, c.outroLar, `select distinct instituicao_id from public.${t}`)
      expect(daOutra.every((x) => x.instituicao_id !== b.instituicao), t).toBe(true)
    }
  })

  it('sem acesso: a vista pública não traz nenhum valor da camada completa (só a faixa, a avaliação e os nomes dos extras)', async () => {
    for (const quem of semAcesso()) {
      const [v] = await q<Record<string, unknown>>(db, quem, 'select * from public.instituicoes_publicas where id = $1', [b.instituicao])
      expect(segredosEm(v), quem).toEqual([])
      expect(v).toMatchObject({ faixa_preco: '1000_2000', extras_nomes: ['Cabeleireiro'], avaliacoes_publicadas: 3, avaliacoes_verificadas: 1, lat: '41.15000', lng: '-8.61000' })
      for (const k of ['quartos', 'vagas_livres', 'lista_espera', 'mensalidade_min', 'mensalidade_max', 'historico_saidas', 'atualizado_em', 'telefone', 'morada', 'extras']) {
        expect(v, k).not.toHaveProperty(k)
      }
    }
    // e em nenhuma linha da vista: a pesquisa grátis inteira
    expect(segredosEm(await q(db, 'anon', 'select * from public.instituicoes_publicas'))).toEqual([])
  })

  it('sem acesso: instituicoes_completas recusa (anon nem a executa; famílias sem passe: 42501 com hint) e a instituição só recebe a sua ficha', async () => {
    expect(await erro(db, 'anon', 'select * from public.instituicoes_completas()')).toMatch(/permission denied/)
    for (const quem of [c.semPasse, c.expirado]) {
      const e = await falha(quem, 'select * from public.instituicoes_completas()')
      expect(e).toEqual({ message: 'As vagas, os preços por quarto, a previsão de espera e os contactos fazem parte do Acesso Família.', code: '42501', hint: 'acesso_familia' })
      expect((await falha(quem, 'select * from public.instituicoes_completas(array[$1])', [b.instituicao])).code).toBe('42501')
    }
    // a outra instituição: a sua ficha inteira (é dela), nunca as dos outros
    const daOutra = await q<{ id: string }>(db, c.outroLar, 'select id from public.instituicoes_completas()')
    expect(daOutra.map((x) => x.id)).toEqual(['lar-real-ac2'])
    expect(await q(db, c.outroLar, 'select id from public.instituicoes_completas(array[$1])', [b.instituicao])).toEqual([])
  })

  it('sem acesso: as avaliações chegam como UM excerto (a verificada, mesmo mais antiga), sem notas por aspeto nem o texto inteiro', async () => {
    const [completa] = await adm<{ texto: string }>("select texto from public.avaliacoes where instituicao_id = $1 and verificada", [b.instituicao])
    for (const quem of semAcesso()) {
      const r = await json<AvaliacaoInstituicaoRow>(db, quem, 'select * from public.avaliacoes_instituicao($1)', [b.instituicao])
      expect(r, quem).toHaveLength(1)
      expect(r[0]).toMatchObject({ autor: 'Inês L.', verificada: true, excerto: true, aspeto_cuidados: null, aspeto_comunicacao: null })
      expect(r[0]!.texto).toBe(excertoAvaliacao(completa!.texto))
      expect(r[0]!.texto.length).toBeLessThanOrEqual(241)
      expect(JSON.stringify(r)).not.toContain('FIM-DO-TEXTO-COMPLETO')
      expect(avaliacaoInstituicaoDeLinha(r[0]!)).not.toHaveProperty('aspetos')
    }
    // sem nenhuma verificada, a mais recente
    const o = await q<{ autor: string }>(db, 'anon', 'select autor from public.avaliacoes_instituicao($1)', [DEMO])
    expect(o.length).toBeLessThanOrEqual(1)
    const l = proto.lares[0]!
    if (l.reviews.length) expect(o[0]!.autor).toBe((l.reviews.find((x) => x.verificada) ?? l.reviews[0])!.autor)
    // ficha sem avaliações e ficha que não existe: nada
    expect(await q(db, 'anon', 'select * from public.avaliacoes_instituicao($1)', ['lar-real-ac2'])).toEqual([])
    expect(await q(db, 'anon', 'select * from public.avaliacoes_instituicao($1)', ['lar-que-nao-existe'])).toEqual([])
  })

  it('o excerto da BD é o da ficha grátis (excertoAvaliacao): corte numa palavra, sem pontuação solta, "…"', async () => {
    const textos = [
      'curto',
      'x'.repeat(240),
      'x'.repeat(241),
      `${'palavra '.repeat(29)}fim, e mais; texto: que passa do limite — e continua sem parar até bem depois do corte final.`,
      `${'a'.repeat(150)} ${'b'.repeat(120)}`,
      `${'a'.repeat(100)} ${'b'.repeat(200)}`,
      `${'Frase com pontuação, '.repeat(11)}e fim.`,
      `${'Com travessão — '.repeat(16)}`,
    ]
    for (const t of textos) {
      const [r] = await adm<{ e: string }>('select private.excerto_avaliacao($1) as e', [t])
      expect(r!.e, t.slice(0, 30)).toBe(excertoAvaliacao(t))
    }
  })

  it('com acesso (família com passe, profissional, equipa): a ficha inteira por instituicoes_completas, quartos, saídas e avaliações completas', async () => {
    for (const quem of comAcesso()) {
      const [f] = await q<Record<string, unknown>>(db, quem, 'select * from public.instituicoes_completas(array[$1])', [b.instituicao])
      expect(f, quem).toMatchObject({
        telefone: '229 990 001', email: 'segredo@lar-real.pt', morada: 'Rua do Segredo, 7', codigo_postal: '4000-777', lista_espera: 7,
        estadia_media_meses: 41, vagas_livres: 1, extras: [{ nome: 'Cabeleireiro', preco: '17,77 €' }],
      })
      expect((f!.quartos as { preco_min: number }[]).map((x) => x.preco_min)).toEqual([1537, 1213])
      expect((f!.historico_saidas as number[]).at(-1)).toBe(3)
      expect(await q(db, quem, 'select tipo, livres, preco_min::int from public.quartos where instituicao_id = $1 order by tipo', [b.instituicao])).toEqual([
        { tipo: 'individual', livres: 1, preco_min: 1537 }, { tipo: 'duplo', livres: 0, preco_min: 1213 },
      ])
      expect(await q(db, quem, 'select saidas from public.saidas_mensais where instituicao_id = $1', [b.instituicao])).toEqual([{ saidas: 3 }])
      const av = await json<AvaliacaoInstituicaoRow>(db, quem, 'select * from public.avaliacoes_instituicao($1)', [b.instituicao])
      expect(av.map((x) => [x.autor, x.excerto])).toEqual([['Rui P.', false], ['Carla S.', false], ['Inês L.', false]])
      expect(av[2]!.texto).toMatch(/FIM-DO-TEXTO-COMPLETO$/)
      expect(await q(db, quem, 'select count(*)::int n from public.avaliacoes where instituicao_id = $1', [b.instituicao])).toEqual([{ n: 3 }])
      // todas as fichas publicadas (as reais e as de demonstração)
      const [n] = await q<{ n: number }>(db, quem, 'select count(*)::int n from public.instituicoes_completas()')
      expect(n!.n).toBe(proto.lares.length + 2)
    }
  })

  it('a conta de demonstração com passe (palavra-passe pública) só vê a camada completa das fichas de demonstração', async () => {
    const ids = await q<{ id: string }>(db, c.demoComPasse, 'select id from public.instituicoes_completas()')
    expect(ids).toHaveLength(proto.lares.length)
    expect(ids.map((x) => x.id)).not.toContain(b.instituicao)
    expect(await q(db, c.demoComPasse, 'select id from public.quartos where instituicao_id = $1', [b.instituicao])).toEqual([])
    expect(await q(db, c.demoComPasse, 'select count(*)::int n from public.quartos where instituicao_id = $1', [DEMO])).toEqual([{ n: proto.lares[0]!.quartos.length }])
    // as reais, na versão grátis
    expect(await q(db, c.demoComPasse, 'select excerto from public.avaliacoes_instituicao($1)', [b.instituicao])).toEqual([{ excerto: true }])
  })

  it('o dono vê sempre a sua ficha inteira (também por publicar), as suas avaliações e quartos; os outros não veem a ficha por publicar', async () => {
    await adm('update public.instituicoes set publicado = false where id = $1', [b.instituicao])
    try {
      const [f] = await q<Record<string, unknown>>(db, b.lar, 'select telefone, publicado, lista_espera from public.instituicoes_completas()')
      expect(f).toEqual({ telefone: '229 990 001', publicado: false, lista_espera: 7 })
      expect(await q(db, b.lar, 'select excerto from public.avaliacoes_instituicao($1)', [b.instituicao])).toHaveLength(3)
      expect(await q(db, b.lar, 'select count(*)::int n from public.avaliacoes')).toEqual([{ n: 3 }])
      expect(await q(db, b.lar, 'select count(*)::int n from public.quartos')).toEqual([{ n: 2 }])
      expect(await q(db, b.lar, 'select id from public.instituicoes_publicas where id = $1', [b.instituicao])).toEqual([{ id: b.instituicao }])
      for (const quem of [c.comPasse, c.profissional]) expect(await q(db, quem, 'select id from public.instituicoes_completas(array[$1])', [b.instituicao])).toEqual([])
      expect(await q(db, 'anon', 'select * from public.avaliacoes_instituicao($1)', [b.instituicao])).toEqual([])
      expect(await q(db, 'anon', 'select id from public.instituicoes_publicas where id = $1', [b.instituicao])).toEqual([])
      // o painel do dono continua igual
      expect(await q(db, b.lar, 'select id, publicado from public.painel_instituicao()')).toEqual([{ id: b.instituicao, publicado: false }])
    } finally {
      await adm('update public.instituicoes set publicado = true where id = $1', [b.instituicao])
    }
  })

  it('a faixa de preço é a de faixaPreco: o limite fica na faixa de cima; sem quartos conta 0; IPSS/Misericórdia conforme os rendimentos', async () => {
    const faixa = async () => (await q<{ f: string }>(db, 'anon', 'select faixa_preco f from public.instituicoes_publicas where id = $1', [b.instituicao]))[0]!.f
    const individual = (v: number) => adm("update public.quartos set preco_min = $2, preco_max = greatest(preco_max, $2) where instituicao_id = $1", [b.instituicao, v])
    for (const [v, f] of [[999, 'ate_1000'], [1000, '1000_2000'], [1999, '1000_2000'], [2000, 'mais_2000']] as const) {
      await individual(v)
      expect(await faixa(), String(v)).toBe(f)
    }
    await adm("update public.instituicoes set natureza = 'misericordia' where id = $1", [b.instituicao])
    expect(await faixa()).toBe('conforme_rendimentos')
    await adm("update public.instituicoes set natureza = 'privado' where id = $1", [b.instituicao])
    const [semQuartos] = await q<{ f: string }>(db, 'anon', "select faixa_preco f from public.instituicoes_publicas where id = 'lar-real-ac2'")
    await adm("delete from public.quartos where instituicao_id = 'lar-real-ac2'")
    expect([semQuartos!.f, (await q<{ f: string }>(db, 'anon', "select faixa_preco f from public.instituicoes_publicas where id = 'lar-real-ac2'"))[0]!.f]).toEqual(['1000_2000', 'ate_1000'])
  })
})

// ————————————————————————————————————————————————————————————————— direito de acesso

describe('direito de acesso (acessos_familia, tem_acesso_completo, estender_acesso, acesso_estado)', () => {
  const tem = async (uid: string) => (await adm<{ t: boolean }>('select private.tem_acesso_completo($1) as t', [uid]))[0]!.t

  it('profissional e equipa sempre; família só com o passe em vigor; instituição, anon e conta inexistente nunca', async () => {
    expect(await tem(c.profissional)).toBe(true)
    expect(await tem(c.equipa)).toBe(true)
    expect(await tem(c.comPasse)).toBe(true)
    expect(await tem(c.semPasse)).toBe(false)
    expect(await tem(c.expirado)).toBe(false)
    expect(await tem(b.lar)).toBe(false)
    // uma instituição com uma linha de acesso (ex.: comprou antes de mudar de papel) continua sem acesso
    await darAcesso(db, c.outroLar, 30)
    expect(await tem(c.outroLar)).toBe(false)
    expect((await adm<{ t: boolean }>('select private.tem_acesso_completo(null) as t'))[0]!.t).toBe(false)
    expect((await adm<{ t: boolean }>("select private.tem_acesso_completo('00000000-0000-0000-0000-000000000000') as t"))[0]!.t).toBe(false)
    // sem sessão (auth.uid() null), pelo valor por omissão
    expect(await como(db, 'anon', async () => (await db.query<{ t: boolean }>('select private.tem_acesso_completo() as t')).rows[0]!.t).catch((e: Error) => e.message)).toMatch(/permission denied/)
  })

  it('o passe termina no instante "ate": um passe terminado perde o acesso em todos os caminhos', async () => {
    const f = await criarUtilizador(db, { email: 'a-terminar@x.pt', roleAdmin: 'familia', acesso: true })
    const [p] = await q<{ id: string }>(db, f, PERFIL)
    expect(await q(db, f, 'select count(*)::int > 0 as ok from public.instituicoes_completas()')).toEqual([{ ok: true }])
    await adm("update public.acessos_familia set ate = now() - interval '1 second' where user_id = $1", [f])
    expect((await falha(f, 'select * from public.instituicoes_completas()')).hint).toBe('acesso_familia')
    expect(await q(db, f, 'select id from public.quartos')).toEqual([])
    expect(await q(db, f, 'select id from public.avaliacoes')).toEqual([])
    expect((await falha(f, 'select public.candidatar($1, $2, true)', [b.instituicao, p!.id])).hint).toBe('acesso_familia')
    expect(await q(db, f, 'select excerto from public.avaliacoes_instituicao($1)', [b.instituicao])).toEqual([{ excerto: true }])
    const [e] = await q<{ e: Json }>(db, f, 'select public.acesso_estado() as e')
    expect(acessoDeLinha(e!.e)).toMatchObject({ completo: false, ativo: false, plano: 'acesso_90', diasRestantes: 0, pagamentos: [] })
  })

  it('estender_acesso soma os dias como novoAte: a partir do fim em vigor, ou de agora se não houver/terminou; dias de 24 h; avisa a família', async () => {
    const f = await criarUtilizador(db, { email: 'compra@x.pt', nome: 'Rita Compra', roleAdmin: 'familia' })
    const estender = (plano: string) =>
      db.transaction(async (tx) => {
        const antes = (await tx.query<{ ate: Date | null }>('select (select ate from public.acessos_familia where user_id = $1) as ate', [f])).rows[0]!.ate
        const agora = (await tx.query<{ t: Date }>('select now() as t')).rows[0]!.t
        const r = (await tx.query<{ ate: Date; plano: string }>('select ate, plano from private.estender_acesso($1, $2)', [f, plano])).rows[0]!
        return { antes, agora, depois: r.ate, plano: r.plano }
      })
    const confere = (x: Awaited<ReturnType<typeof estender>>, plano: 'acesso_30' | 'acesso_90') => {
      const atual = x.antes ? { plano, compradoEm: '', ate: x.antes.toISOString(), origem: 'compra' as const } : undefined
      expect(x.depois.toISOString()).toBe(novoAte(atual, planoFamilia(plano), x.agora.getTime()))
      expect(x.plano).toBe(plano)
    }
    // primeira compra: 30 dias a partir de agora
    const a = await estender('acesso_30')
    confere(a, 'acesso_30')
    expect(a.depois.getTime() - a.agora.getTime()).toBe(30 * 86_400_000)
    // nova compra com o passe em vigor: soma ao fim (nunca se perdem dias pagos)
    const b2 = await estender('acesso_90')
    confere(b2, 'acesso_90')
    expect(b2.depois.getTime() - a.depois.getTime()).toBe(90 * 86_400_000)
    // passe terminado: conta a partir de agora
    await adm("update public.acessos_familia set ate = now() - interval '5 days' where user_id = $1", [f])
    const c2 = await estender('acesso_30')
    confere(c2, 'acesso_30')
    expect(c2.depois.getTime() - c2.agora.getTime()).toBe(30 * 86_400_000)
    // um aviso por compra, sem renovação automática
    const avisos = await q<{ titulo: string; texto: string; link: string }>(db, f, "select titulo, texto, link from public.notificacoes where tipo = 'sistema' and titulo <> 'Bem-vindo(a) ao EncontraLar'")
    expect(avisos).toHaveLength(3)
    for (const n of avisos) expect(n).toMatchObject({ titulo: 'Acesso Família ativo', link: '/familia', texto: expect.stringMatching(/^Tem acesso completo até [a-zçá-]+, \d{1,2} de [a-zç]+\. Não há renovação automática\.$/) })
    expect(await tem(f)).toBe(true)
  })

  it('estender_acesso é só do servidor: nem anon nem contas a executam; a service_role sim; conta inexistente e plano em falta dão erro', async () => {
    const f = await criarUtilizador(db, { email: 'servidor@x.pt', roleAdmin: 'familia' })
    for (const quem of ['anon', f, c.profissional]) {
      expect(await erro(db, quem, "select private.estender_acesso($1, 'acesso_30')", [f]), quem).toMatch(/permission denied/)
    }
    expect(await q(db, 'service_role', "select plano from private.estender_acesso($1, 'acesso_30')", [f])).toEqual([{ plano: 'acesso_30' }])
    expect(await erro(db, 'service_role', "select private.estender_acesso('00000000-0000-0000-0000-000000000000', 'acesso_30')")).toBe('Conta não encontrada.')
    expect(await erro(db, 'service_role', 'select private.estender_acesso($1, null)', [f])).toBe('Indique a conta e o passe do Acesso Família.')
    expect(await erro(db, 'service_role', "select private.estender_acesso($1, 'acesso_365')", [f])).toMatch(/invalid input value for enum/)
  })

  it('acessos_familia: o próprio lê a sua linha; ninguém escreve diretamente (nem a service_role); outras contas não a veem', async () => {
    expect(await q(db, c.comPasse, 'select user_id, plano from public.acessos_familia')).toEqual([{ user_id: c.comPasse, plano: 'acesso_90' }])
    expect(await q(db, c.semPasse, 'select user_id from public.acessos_familia')).toEqual([])
    expect(await erro(db, 'anon', 'select * from public.acessos_familia')).toMatch(/permission denied/)
    for (const quem of [c.semPasse, c.comPasse, 'service_role']) {
      expect(await erro(db, quem, "insert into public.acessos_familia (user_id, plano, ate) values ($1, 'acesso_90', now() + interval '1 year')", [c.semPasse]), quem).toMatch(/permission denied/)
      expect(await erro(db, quem, "update public.acessos_familia set ate = now() + interval '10 years'"), quem).toMatch(/permission denied/)
      expect(await erro(db, quem, 'delete from public.acessos_familia'), quem).toMatch(/permission denied/)
    }
  })

  it('acesso_estado: {completo, ativo, ate, plano, pagamentos: []} da conta com sessão; anon não a chama', async () => {
    const estado = async (quem: string) => (await q<{ e: Record<string, unknown> }>(db, quem, 'select public.acesso_estado() as e'))[0]!.e
    expect(await estado(c.semPasse)).toEqual({ completo: false, ativo: false, ate: null, plano: null, pagamentos: [] })
    expect(await estado(c.profissional)).toEqual({ completo: true, ativo: false, ate: null, plano: null, pagamentos: [] })
    expect(await estado(c.comPasse)).toMatchObject({ completo: true, ativo: true, plano: 'acesso_90', pagamentos: [] })
    expect(acessoDeLinha((await estado(c.comPasse)) as Json).diasRestantes).toBe(90)
    expect(await estado(b.lar)).toMatchObject({ completo: false })
    expect(await erro(db, 'anon', 'select public.acesso_estado()')).toMatch(/permission denied/)
  })
})

// ————————————————————————————————————————————————————————————————— ações pagas

describe('ações pagas: pedidos, visitas e alertas de vaga', () => {
  it('sem acesso não há pedidos (42501, hint acesso_familia); com o passe, sim', async () => {
    const [p] = await q<{ id: string }>(db, c.semPasse, PERFIL)
    const e = await falha(c.semPasse, 'select public.candidatar($1, $2, true)', [b.instituicao, p!.id])
    expect(e).toEqual({ message: 'Os pedidos de vaga e as visitas fazem parte do Acesso Família.', code: '42501', hint: 'acesso_familia' })
    // também com a visita pedida no mesmo pedido
    expect((await falha(c.semPasse, "select public.candidatar($1, $2, true, null, current_date + 3, '10:00')", [b.instituicao, p!.id])).hint).toBe('acesso_familia')
    expect(await q(db, c.semPasse, 'select id from public.candidaturas')).toEqual([])
    await darAcesso(db, c.semPasse, 30)
    try {
      expect(await q(db, c.semPasse, 'select estado from public.candidatar($1, $2, true)', [b.instituicao, p!.id])).toEqual([{ estado: 'enviada' }])
    } finally {
      await adm('delete from public.acessos_familia where user_id = $1', [c.semPasse])
    }
  })

  it('com o passe terminado: pedir uma visita é recusado; cancelar, responder a uma vaga e confirmar a entrada continuam livres', async () => {
    const f = await criarUtilizador(db, { email: 'pedido-antigo@x.pt', roleAdmin: 'familia', acesso: true })
    const [p1] = await q<{ id: string }>(db, f, PERFIL)
    const [p2] = await q<{ id: string }>(db, f, PERFIL)
    const [a] = await q<{ id: string }>(db, f, 'select id from public.candidatar($1, $2, true)', [b.instituicao, p1!.id])
    const [d] = await q<{ id: string }>(db, f, 'select id from public.candidatar($1, $2, true)', [b.instituicao, p2!.id])
    await darAcesso(db, f, -1)
    expect((await falha(f, "select public.pedir_visita($1, current_date + 2, '11:00')", [a!.id])).hint).toBe('acesso_familia')
    // o pedido de outra pessoa continua "não encontrado" (sem revelar nada)
    expect(await erro(db, c.semPasse, "select public.pedir_visita($1, current_date + 2, '11:00')", [a!.id])).toBe('Pedido não encontrado.')
    // a vaga proposta e a entrada são do pedido que já existe
    await q(db, b.lar, 'select public.aceitar_candidatura($1)', [a!.id])
    await q(db, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [a!.id])
    expect(await q(db, f, 'select estado from public.responder_vaga($1, true)', [a!.id])).toEqual([{ estado: 'aceite' }])
    await q(db, b.lar, 'select public.marcar_entrada($1, current_date)', [a!.id])
    expect(await q(db, f, 'select estado from public.confirmar_entrada_familia($1, current_date)', [a!.id])).toEqual([{ estado: 'admitida' }])
    expect(await q(db, f, 'select estado from public.cancelar_candidatura($1)', [d!.id])).toEqual([{ estado: 'cancelada' }])
    // com um passe novo, a visita volta a poder ser pedida
    await darAcesso(db, f, 30)
    const [p3] = await q<{ id: string }>(db, f, PERFIL)
    const [n] = await q<{ id: string }>(db, f, 'select id from public.candidatar($1, $2, true)', [b.instituicao, p3!.id])
    expect(await q(db, f, "select visita_estado from public.pedir_visita($1, current_date + 2, '11:00')", [n!.id])).toEqual([{ visita_estado: 'pedida' }])
  })

  it('os profissionais continuam a enviar casos (acesso completo, sem passe)', async () => {
    const [k] = await q<{ id: string }>(db, c.profissional, `select id from public.criar_caso('{"nome": "Albano", "idade": 88, "grau": "grave", "local_lat": 41.15, "local_lng": -8.6}'::jsonb, null, null, true)`)
    expect(await q(db, c.profissional, 'select origem, estado from public.enviar_caso($1, array[$2])', [k!.id, b.instituicao])).toEqual([{ origem: 'profissional', estado: 'enviada' }])
  })

  it('favoritos: guardar é livre (sem acesso o alerta fica desligado); ligar o alerta exige o acesso; desligar e apagar, sempre', async () => {
    const f = await criarUtilizador(db, { email: 'guarda@x.pt', roleAdmin: 'familia' })
    expect(await q(db, f, 'insert into public.favoritos (instituicao_id) values ($1) returning alerta', [b.instituicao])).toEqual([{ alerta: false }])
    expect(await q(db, f, 'insert into public.favoritos (instituicao_id, alerta) values ($1, true) returning alerta', ['lar-real-ac2'])).toEqual([{ alerta: false }])
    const e = await falha(f, 'update public.favoritos set alerta = true where instituicao_id = $1', [b.instituicao])
    expect(e).toEqual({ message: 'Os alertas de vaga fazem parte do Acesso Família.', code: '42501', hint: 'acesso_familia' })
    // um "upsert" (setAlerta pelo supabase-js) também não o liga
    await q(db, f, 'insert into public.favoritos (instituicao_id, alerta) values ($1, true) on conflict (user_id, instituicao_id) do update set alerta = excluded.alerta', [b.instituicao])
    expect(await q(db, f, 'select alerta from public.favoritos where instituicao_id = $1', [b.instituicao])).toEqual([{ alerta: false }])
    expect(await q(db, f, 'update public.favoritos set alerta = false where instituicao_id = $1 returning alerta', [b.instituicao])).toEqual([{ alerta: false }])
    expect(await q(db, f, 'delete from public.favoritos where instituicao_id = $1 returning instituicao_id', ['lar-real-ac2'])).toEqual([{ instituicao_id: 'lar-real-ac2' }])
    // com o passe: o alerta nasce ligado (valor por omissão) e liga-se e desliga-se
    await darAcesso(db, f, 30)
    expect(await q(db, f, 'insert into public.favoritos (instituicao_id) values ($1) returning alerta', ['lar-real-ac2'])).toEqual([{ alerta: true }])
    expect(await q(db, f, 'update public.favoritos set alerta = true where instituicao_id = $1 returning alerta', [b.instituicao])).toEqual([{ alerta: true }])
  })

  it('avisos de vaga: quem segue a ficha só com o acesso; quem está na lista de espera é sempre avisado', async () => {
    const v = await cenarioBase(db, { sufixo: 'av', livres: { individual: 0, duplo: 0 } })
    const comPasse = await criarUtilizador(db, { email: 'segue-com@x.pt', roleAdmin: 'familia', acesso: true })
    const terminou = await criarUtilizador(db, { email: 'segue-terminou@x.pt', roleAdmin: 'familia', acesso: true })
    const naLista = await criarUtilizador(db, { email: 'na-lista@x.pt', roleAdmin: 'familia', acesso: true })
    // a conta de demonstração com passe (palavra-passe pública) não recebe avisos de fichas reais
    const demo = await criarUtilizador(db, { email: 'segue-demo@x.pt', roleAdmin: 'familia', acesso: true })
    await adm('update public.perfis_utilizador set demonstracao = true where id = $1', [demo])
    for (const f of [comPasse, terminou, demo]) await q(db, f, 'insert into public.favoritos (instituicao_id) values ($1)', [v.instituicao])
    const [p] = await q<{ id: string }>(db, naLista, PERFIL)
    const [cand] = await q<{ id: string }>(db, naLista, 'select id from public.candidatar($1, $2, true)', [v.instituicao, p!.id])
    await q(db, v.lar, "select public.atualizar_estado_candidatura($1, 'lista_espera')", [cand!.id])
    // os passes de quem segue com alerta e de quem está na lista terminam
    await darAcesso(db, terminou, -1)
    await darAcesso(db, naLista, -1)
    const [n] = await q<{ n: number }>(db, v.lar, "select public.definir_vagas($1, 'individual', 2) as n", [v.instituicao])
    expect(n!.n).toBe(2)
    const avisos = await adm<{ user_id: string; titulo: string }>("select user_id, titulo from public.notificacoes where tipo = 'vaga' and instituicao_id = $1 order by titulo", [v.instituicao])
    expect(avisos).toEqual([
      { user_id: naLista, titulo: 'Abriu uma vaga onde está inscrito(a)' },
      { user_id: comPasse, titulo: 'Nova vaga disponível' },
    ])
  })
})

// ————————————————————————————————————————————————————————————————— migração sobre dados existentes

describe('migração sobre dados existentes (projeto já em uso antes do Acesso Família)', () => {
  it('os pedidos e favoritos existentes ficam; ninguém ganha acesso; a vista pública e os extras funcionam já', async () => {
    const antiga = await criarBase({ ate: '20261013110000' })
    try {
      const v = await cenarioBase(antiga, { sufixo: 'mg' })
      await admin(antiga, `update public.instituicoes set extras = '[{"nome": "Fraldas", "preco": "30 €"}]' where id = $1`, [v.instituicao])
      const [cand] = await q<{ id: string }>(antiga, v.familia, 'select id from public.candidatar($1, $2, true)', [v.instituicao, v.perfil])
      await q(antiga, v.familia, 'insert into public.favoritos (instituicao_id) values ($1)', [v.instituicao])

      await aplicarMigracoes(antiga, '20261013110000')

      expect(await admin(antiga, 'select count(*)::int n from public.acessos_familia')).toEqual([{ n: 0 }])
      expect(await q(antiga, v.familia, 'select id from public.candidaturas')).toEqual([{ id: cand!.id }])
      expect(await q(antiga, v.familia, 'select alerta from public.favoritos')).toEqual([{ alerta: true }])
      expect(await q(antiga, 'anon', 'select extras_nomes, faixa_preco from public.instituicoes_publicas where id = $1', [v.instituicao])).toEqual([{ extras_nomes: ['Fraldas'], faixa_preco: '1000_2000' }])
      // sem passe: o pedido continua (cancelar é livre), uma visita nova não
      const e = await como(antiga, v.familia, () => antiga.query("select public.pedir_visita($1, current_date + 2, '10:00')", [cand!.id]).then(() => null, (x: { hint?: string }) => x.hint))
      expect(e).toBe('acesso_familia')
      expect(await q(antiga, v.familia, 'select estado from public.cancelar_candidatura($1)', [cand!.id])).toEqual([{ estado: 'cancelada' }])
    } finally {
      await antiga.close()
    }
  }, 120_000)
})
