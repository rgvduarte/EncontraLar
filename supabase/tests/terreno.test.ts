/**
 * Equipa de terreno e modalidade das instituições privadas (decisões de 13/10/2026) na base de dados —
 * 20261013100000/0100. Espelha src/lib/visitas.test.ts (registarVisita, escolherPlanoInstituicao, taxa
 * 'incluida') pelos mappers e pelas RPC, e prova cada regra pelo lado de quem a tentaria contornar
 * (Data API: anon / authenticated).
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { cobrancaEntradaTexto, compromissoAte, planoDoLar, podeMudarPlano } from '@/lib/acesso'
import { niveisVerificacao, taxaPara } from '@/lib/negocio'
import {
  larDeLinha,
  painelDeLinha,
  painelEquipaDeLinha,
  planoDeLinha,
  visitaDeLinha,
  visitaParaRpc,
  type InstituicaoPublicaRow,
  type PainelEquipaRow,
  type PainelInstituicaoRow,
  type PlanoDaInstituicaoRow,
  type VisitaRow,
} from '@/lib/supabase-mappers'
import type { RegistoVisitaInput } from '@/lib/store'
import type { Lar, Visita } from '@/types'
import { admin, aplicarMigracoes, cenarioBase, codigoErro, criarBase, criarUtilizador, erro, json, q, rpc } from './helpers'

let db: PGlite
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)

const tudo: Visita['verificacao'] = { licencaConfirmada: true, instalacoesVistas: true, vagasConfirmadas: true, precosConfirmados: true }
const nada: Visita['verificacao'] = { licencaConfirmada: false, instalacoesVistas: false, vagasConfirmadas: false, precosConfirmados: false }
/** o formato de moeda pt-PT usa espaço não separável antes do € */
const semNbsp = (s: string) => s.replace(/ /g, ' ')

let nEquipa = 0
/** conta da equipa de terreno, como o administrador a cria (app_metadata.role = 'equipa') */
const contaEquipa = () => criarUtilizador(db, { email: `equipa${++nEquipa}@encontralar.pt`, nome: 'Sofia Ramos', roleAdmin: 'equipa' })

/** registarVisita(input) pelo mapper e pela RPC, como o supabase-js */
const registar = async (quem: string, input: RegistoVisitaInput) => (await rpc<VisitaRow>(db, quem, 'registar_visita', visitaParaRpc(input)))[0]!

/** ficha publicada do catálogo, sem gestor (como as importadas), com dois tipos de quarto */
async function fichaSemGestor(id: string, natureza: 'privado' | 'ipss' | 'misericordia' = 'privado', estado = 'nao_verificado') {
  await adm(
    `insert into public.instituicoes (id, nome, tipo, natureza, localidade, concelho, distrito, regiao, lat, lng, capacidade, licenca, publicado, verificacao_estado, atualizado_em)
     values ($1, $2, 'erpi', $3, 'Porto', 'Porto', 'Porto', 'Norte', 41.15, -8.61, 30, '100/2010', true, $4, now() - interval '20 days')`,
    [id, `Ficha ${id}`, natureza, estado],
  )
  await adm(
    `insert into public.quartos (instituicao_id, tipo, total, livres, preco_min, preco_max)
     values ($1, 'individual', 10, 2, 1500, 1800), ($1, 'duplo', 6, 0, 1200, 1400)`,
    [id],
  )
  return id
}

interface Ficha {
  verificacao_estado: string
  verificacao_data: string | null
  licenca_confirmada_em: string | null
  licenca: string
  cuidados: string[]
  plano: string | null
  plano_desde: string | null
  atualizado_em: string
  publicado: boolean
  owner_id: string | null
}
const ficha = async (id: string) => (await adm<Ficha>('select * from public.instituicoes where id = $1', [id]))[0]!
const quartos = (id: string) =>
  adm<{ tipo: string; total: number; livres: number; preco_min: number; preco_max: number }>(
    'select tipo, total, livres, preco_min::int, preco_max::int from public.quartos where instituicao_id = $1 order by tipo', [id],
  )
/** a ficha como a app a vê (vista pública + mappers) */
const larDaVista = async (id: string, dono?: Parameters<typeof larDeLinha>[2]) =>
  larDeLinha((await json<InstituicaoPublicaRow>(db, 'anon', 'select * from public.instituicoes_publicas where id = $1', [id]))[0]!, [], dono)
/** "agora" da base de dados */
const agoraBd = async () => Date.parse((await adm<{ t: string }>("select to_json(now())#>>'{}' t"))[0]!.t)

beforeAll(async () => {
  db = await criarBase()
}, 120_000)

// ————————————————————————————————————————————————————————————————— papel 'equipa'

describe("papel 'equipa': interno, só o administrador o atribui", () => {
  it("no registo, 'equipa' em user_metadata dá uma conta de família; por app_metadata dá a equipa (nunca numa conta anónima)", async () => {
    const intruso = await criarUtilizador(db, { email: 'quero-ser-equipa@x.pt', roleRegisto: 'equipa' })
    expect((await q<{ role: string }>(db, intruso, 'select role from public.perfis_utilizador'))[0]!.role).toBe('familia')

    const sofia = await contaEquipa()
    expect(await q(db, sofia, 'select role from public.perfis_utilizador')).toEqual([{ role: 'equipa' }])
    expect(await q(db, sofia, 'select titulo, link from public.notificacoes')).toEqual([{ titulo: 'Bem-vindo(a) ao EncontraLar', link: '/visitas' }])

    const anonima = await criarUtilizador(db, { email: null, anonimo: true, roleAdmin: 'equipa' })
    expect((await adm<{ role: string }>('select role from public.perfis_utilizador where id = $1', [anonima]))[0]!.role).toBe('familia')

    // o próprio utilizador nunca muda o papel (privilégio por coluna e trigger)
    expect(await erro(db, intruso, "update public.perfis_utilizador set role = 'equipa' where id = $1", [intruso])).toMatch(/permission denied/)
  })

  it('mudar o user_metadata não dá o papel; o app_metadata dá-o, e retirá-lo tira-o (saída da equipa)', async () => {
    const u = await criarUtilizador(db, { email: 'colega@x.pt', roleRegisto: 'familia' })
    const papel = async () => (await adm<{ role: string }>('select role from public.perfis_utilizador where id = $1', [u]))[0]!.role
    await adm(`update auth.users set raw_user_meta_data = '{"role":"equipa"}' where id = $1`, [u])
    expect(await papel()).toBe('familia')
    await adm(`update auth.users set raw_app_meta_data = '{"provider":"email","role":"equipa"}' where id = $1`, [u])
    expect(await papel()).toBe('equipa')
    // o administrador apaga o papel do app_metadata (sem pôr outro): a conta deixa de ser da equipa
    await adm(`update auth.users set raw_app_meta_data = '{"provider":"email"}' where id = $1`, [u])
    expect(await papel()).toBe('familia')
    await adm(`update auth.users set raw_app_meta_data = '{"role":"equipa"}' where id = $1`, [u])
    await adm(`update auth.users set raw_app_meta_data = '{"role":"lar"}' where id = $1`, [u])
    expect(await papel()).toBe('lar')
  })
})

// ————————————————————————————————————————————————————————————————— visitas: quem lê e quem escreve

describe('visitas: só a equipa regista e lê', () => {
  it('só a equipa regista visitas (famílias, instituições, profissionais, sessões anónimas e anon não)', async () => {
    const b = await cenarioBase(db, { sufixo: 'p1' })
    const pro = await criarUtilizador(db, { email: 'pro-p1@x.pt', roleAdmin: 'profissional', appExtra: { organizacao: { nome: 'Hospital X', tipo: 'hospital' } } })
    const alvo = await fichaSemGestor('lar-terreno-p1')
    const input: RegistoVisitaInput = { larId: alvo, resultado: 'aderiu', verificacao: tudo, plano: 'mensal' }
    for (const quem of [b.familia, b.lar, pro]) {
      expect(await codigoErro(db, quem, 'select public.registar_visita($1, $2)', [alvo, 'aderiu'])).toBe('42501')
      await expect(registar(quem, input)).rejects.toThrow(/Só a equipa de terreno regista visitas/)
    }
    expect(await erro(db, 'anon', 'select public.registar_visita($1, $2)', [alvo, 'aderiu'])).toMatch(/permission denied/)
    const sofia = await contaEquipa()
    expect(await erro(db, { sub: sofia, claims: { is_anonymous: true } }, 'select public.registar_visita($1, $2)', [alvo, 'aderiu'])).toMatch(/Só a equipa/)
    // nada mudou
    expect(await adm('select 1 from public.visitas where instituicao_id = $1', [alvo])).toEqual([])
    expect(await ficha(alvo)).toMatchObject({ verificacao_estado: 'nao_verificado', plano: null })
  })

  it('a equipa lê as visitas de toda a equipa; famílias, instituições (nem a visitada) e profissionais nunca; ninguém escreve na tabela', async () => {
    const b = await cenarioBase(db, { sufixo: 'p2' })
    const sofia = await contaEquipa()
    const tiago = await contaEquipa()
    const v = await registar(sofia, { larId: b.instituicao, resultado: 'interessado', verificacao: nada, proximoContacto: '2026-12-01', notas: 'Gestora de férias.' })
    expect((await q<{ id: string }>(db, tiago, 'select id from public.visitas')).map((x) => x.id)).toContain(v.id)
    const pro = await criarUtilizador(db, { email: 'pro-p2@x.pt', roleAdmin: 'profissional' })
    for (const quem of [b.familia, b.lar, pro]) {
      expect(await q(db, quem, 'select * from public.visitas')).toEqual([])
      expect(await q(db, quem, 'select count(*)::int n from public.visitas where instituicao_id = $1', [b.instituicao])).toEqual([{ n: 0 }])
    }
    expect(await erro(db, 'anon', 'select * from public.visitas')).toMatch(/permission denied/)
    // escrita só por registar_visita (nem a própria equipa insere, altera ou apaga)
    expect(await erro(db, sofia, "insert into public.visitas (instituicao_id, resultado) values ($1, 'aderiu')", [b.instituicao])).toMatch(/permission denied/)
    expect(await erro(db, sofia, "update public.visitas set resultado = 'aderiu' where id = $1", [v.id])).toMatch(/permission denied/)
    expect(await erro(db, sofia, 'delete from public.visitas where id = $1', [v.id])).toMatch(/permission denied/)
  })

  it('demonstração ↔ real: a conta de demonstração da equipa (palavra-passe pública) não vê nem visita fichas reais, e vice-versa', async () => {
    const real = await fichaSemGestor('lar-terreno-real')
    const demo = await fichaSemGestor('lar-terreno-demo')
    await adm('update public.instituicoes set demonstracao = true where id = $1', [demo])
    const sofia = await contaEquipa()
    const demoEquipa = await contaEquipa()
    await adm('update public.perfis_utilizador set demonstracao = true where id = $1', [demoEquipa])

    await expect(registar(demoEquipa, { larId: real, resultado: 'aderiu', verificacao: tudo })).rejects.toThrow(/não regista visitas a instituições reais/)
    await expect(registar(sofia, { larId: demo, resultado: 'aderiu', verificacao: tudo })).rejects.toThrow(/ficha é de demonstração/)
    expect(await ficha(real)).toMatchObject({ verificacao_estado: 'nao_verificado', plano: null })

    const vReal = await registar(sofia, { larId: real, resultado: 'recusou', verificacao: nada })
    const vDemo = await registar(demoEquipa, { larId: demo, resultado: 'recusou', verificacao: nada })
    expect(vDemo.demonstracao).toBe(true)
    const ids = async (quem: string) => (await q<{ id: string }>(db, quem, 'select id from public.visitas')).map((x) => x.id)
    expect(await ids(demoEquipa)).toEqual([vDemo.id])
    expect(await ids(sofia)).toContain(vReal.id)
    expect(await ids(sofia)).not.toContain(vDemo.id)
    // o painel da equipa também só mostra as fichas do seu "mundo"
    const doPainel = async (quem: string) => (await q<{ instituicao_id: string }>(db, quem, 'select instituicao_id from public.painel_equipa()')).map((x) => x.instituicao_id)
    expect(await doPainel(demoEquipa)).toEqual([demo])
    expect(await doPainel(sofia)).toContain(real)
    expect(await doPainel(sofia)).not.toContain(demo)
  })
})

// ————————————————————————————————————————————————————————————————— registar_visita (como registarVisita)

describe('registar_visita: selo, licença, vagas, preços, cuidados e modalidade', () => {
  it('adesão de um privado: selo da visita, vagas e preços atualizados, modalidade e aviso ao gestor', async () => {
    const b = await cenarioBase(db, { sufixo: 'v1' })
    await adm("update public.instituicoes set verificacao_estado = 'pendente', verificacao_data = null, atualizado_em = now() - interval '20 days' where id = $1", [b.instituicao])
    const sofia = await contaEquipa()
    const antes = await ficha(b.instituicao)
    const r = await registar(sofia, {
      larId: b.instituicao,
      resultado: 'aderiu',
      verificacao: tudo,
      licenca: '  999/2026 ',
      plano: 'mensal',
      quartos: [{ tipo: 'individual', livres: 25, precoMin: 1234, precoMax: 1100 }],
      responsavel: { nome: 'Joana Pires', cargo: 'Diretora técnica', email: ' Joana.Pires@Exemplo.pt ' },
      notas: '  Quer começar já.  ',
      proximoContacto: '2026-11-01',
      criarConta: true,
    })
    // a visita: notas aparadas, sem próximo contacto (só para quem fica a pensar), email em minúsculas
    const visita = visitaDeLinha(r)
    expect(visita).toMatchObject({
      larId: b.instituicao, equipaId: sofia, resultado: 'aderiu', verificacao: tudo, plano: 'mensal', notas: 'Quer começar já.',
      responsavel: { nome: 'Joana Pires', cargo: 'Diretora técnica', email: 'joana.pires@exemplo.pt' },
    })
    expect(visita.proximoContacto).toBeUndefined()
    // a conta do responsável não é criada por SQL (convite por email numa Edge Function)
    expect(visita.contaCriadaId).toBeUndefined()

    const depois = await ficha(b.instituicao)
    expect(depois).toMatchObject({ verificacao_estado: 'verificado', licenca: '999/2026', plano: 'mensal' })
    expect(Date.parse(depois.verificacao_data!)).toBeGreaterThan(Date.parse(antes.atualizado_em))
    expect(depois.licenca_confirmada_em).toEqual(depois.verificacao_data)
    expect(Date.parse(depois.atualizado_em)).toBeGreaterThan(Date.parse(antes.atualizado_em))
    // vagas limitadas ao total do quarto; o preço máximo nunca fica abaixo do mínimo; o duplo não foi tocado
    expect(await quartos(b.instituicao)).toEqual([
      { tipo: 'individual', total: 20, livres: 20, preco_min: 1234, preco_max: 1234 },
      { tipo: 'duplo', total: 20, livres: 0, preco_min: 1200, preco_max: 1400 },
    ])
    const lar = await larDaVista(b.instituicao)
    expect(niveisVerificacao(lar)).toMatchObject({ licenca: true, visitado: true })
    expect(lar.mensalidadeMin).toBe(Math.min(...lar.quartos.flatMap((x) => [x.precoMin, x.precoMax])))
    expect(lar.mensalidadeMax).toBe(Math.max(...lar.quartos.flatMap((x) => [x.precoMin, x.precoMax])))
    // a gestora é avisada e vê a modalidade no seu painel (não na vista pública)
    expect(await q(db, b.lar, "select tipo, texto, link from public.notificacoes where titulo = 'Visitada pela equipa'")).toEqual([{
      tipo: 'sistema', link: '/gestao/ficha',
      texto: 'A equipa do EncontraLar confirmou a licença e as instalações. A ficha tem agora o selo «Visitada pela equipa».',
    }])
    const [p] = await json<PainelInstituicaoRow>(db, b.lar, 'select * from public.painel_instituicao()')
    const doDono = await larDaVista(b.instituicao, painelDeLinha(p!, b.lar).dono)
    expect(planoDoLar(doDono)).toBe('mensal')
    expect(semNbsp(cobrancaEntradaTexto(doDono))).toBe('Incluída na mensalidade (29 € + IVA por mês)')
    expect(planoDoLar(lar)).toBe('por_entrada') // quem só tem a vista pública não sabe a modalidade
  })

  it('licença sem ver as instalações: 1.º nível (licença confirmada), sem selo nem aviso; nada confirmado: a ficha não muda', async () => {
    const sofia = await contaEquipa()
    const alvo = await fichaSemGestor('lar-terreno-v2')
    const r = await registar(sofia, { larId: alvo, resultado: 'interessado', verificacao: { ...nada, licencaConfirmada: true }, licenca: '123/2020', proximoContacto: '2026-11-15' })
    expect(visitaDeLinha(r)).toMatchObject({ proximoContacto: '2026-11-15', plano: undefined })
    // o estado da verificação não muda (como no protótipo); a licença fica confirmada, com a data
    const f = await ficha(alvo)
    expect(f).toMatchObject({ verificacao_estado: 'nao_verificado', verificacao_data: null, licenca: '123/2020' })
    expect(Math.abs(Date.parse(f.licenca_confirmada_em!) - (await agoraBd()))).toBeLessThan(60_000)
    const lar = await larDaVista(alvo)
    expect(lar.verificacao).toMatchObject({ estado: 'nao_verificado', licenca: '123/2020', licencaConfirmadaEm: expect.any(String) })
    expect(niveisVerificacao(lar)).toMatchObject({ licenca: true, visitado: false })

    // uma ficha já verificada fica verificada, sem renovar a data do selo (só a licença foi vista)
    const b = await cenarioBase(db, { sufixo: 'v2' })
    const { verificacao_data: data } = await ficha(b.instituicao)
    await registar(sofia, { larId: b.instituicao, resultado: 'voltar', verificacao: { ...nada, licencaConfirmada: true } })
    expect(await ficha(b.instituicao)).toMatchObject({ verificacao_estado: 'verificado', verificacao_data: data })
    expect(await q(db, b.lar, "select 1 from public.notificacoes where titulo = 'Visitada pela equipa'")).toEqual([])

    // nada confirmado: quartos e cuidados ignorados não mexem na ficha; próximo contacto só a acompanhar
    const outro = await fichaSemGestor('lar-terreno-v2b')
    const antes = JSON.stringify([await ficha(outro), await quartos(outro)])
    const r2 = await registar(sofia, { larId: outro, resultado: 'recusou', verificacao: nada, licenca: '1/1', quartos: [{ tipo: 'individual', livres: 9, precoMin: 1, precoMax: 2 }], proximoContacto: '2026-11-15' })
    expect(JSON.stringify([await ficha(outro), await quartos(outro)])).toBe(antes)
    expect(r2.proximo_contacto).toBeNull()
  })

  it('só as partes confirmadas: vagas sem preços, preços sem vagas; tipos que a ficha não tem são ignorados; o primeiro de cada tipo conta', async () => {
    const sofia = await contaEquipa()
    const alvo = await fichaSemGestor('lar-terreno-v3')
    await registar(sofia, {
      larId: alvo, resultado: 'voltar', verificacao: { ...nada, vagasConfirmadas: true },
      quartos: [{ tipo: 'individual', livres: 4, precoMin: 1, precoMax: 2 }, { tipo: 'individual', livres: 7, precoMin: 1, precoMax: 2 }, { tipo: 'casal', livres: 3, precoMin: 1, precoMax: 2 }],
    })
    expect(await quartos(alvo)).toEqual([
      { tipo: 'individual', total: 10, livres: 4, preco_min: 1500, preco_max: 1800 },
      { tipo: 'duplo', total: 6, livres: 0, preco_min: 1200, preco_max: 1400 },
    ])
    await registar(sofia, { larId: alvo, resultado: 'voltar', verificacao: { ...nada, precosConfirmados: true }, quartos: [{ tipo: 'duplo', livres: 5, precoMin: 1300.4, precoMax: 1500.6 }] })
    expect(await quartos(alvo)).toEqual([
      { tipo: 'individual', total: 10, livres: 4, preco_min: 1500, preco_max: 1800 },
      { tipo: 'duplo', total: 6, livres: 0, preco_min: 1300, preco_max: 1501 },
    ])
    expect(await adm('select tipo from public.quartos where instituicao_id = $1 and tipo = $2', [alvo, 'casal'])).toEqual([])
  })

  it('cuidados: a lista é substituída; valores fora da lista são recusados', async () => {
    const sofia = await contaEquipa()
    const alvo = await fichaSemGestor('lar-terreno-v4')
    await registar(sofia, { larId: alvo, resultado: 'interessado', verificacao: nada, cuidados: ['demencia', 'paliativos'] })
    expect((await ficha(alvo)).cuidados).toEqual(['demencia', 'paliativos'])
    await expect(registar(sofia, { larId: alvo, resultado: 'interessado', verificacao: nada, cuidados: ['inventado' as 'medico'] })).rejects.toThrow(/Cuidados inválidos/)
    expect((await ficha(alvo)).cuidados).toEqual(['demencia', 'paliativos'])
  })

  it('IPSS e Misericórdias que aderem: sem modalidade nem custos (e o gestor não tem modalidade a escolher)', async () => {
    const sofia = await contaEquipa()
    for (const natureza of ['ipss', 'misericordia'] as const) {
      const alvo = await fichaSemGestor(`lar-terreno-v5-${natureza}`, natureza)
      const r = await registar(sofia, { larId: alvo, resultado: 'aderiu', verificacao: tudo, plano: 'mensal', responsavel: { nome: 'Rui Matos', email: 'rui.matos@exemplo.pt' } })
      expect(visitaDeLinha(r).plano).toBeUndefined()
      expect(await ficha(alvo)).toMatchObject({ plano: null, plano_desde: null, verificacao_estado: 'verificado' })
      const lar = await larDaVista(alvo)
      expect(planoDoLar(lar)).toBeNull()
      expect(cobrancaEntradaTexto(lar)).toBe('Isenta — setor social')
    }
    const b = await cenarioBase(db, { sufixo: 'v5', natureza: 'ipss' })
    expect(await erro(db, b.lar, "select * from public.escolher_plano_instituicao('mensal')")).toMatch(/IPSS e Misericórdias não têm custos/)
  })

  it('a visita não publica a ficha (publicar é decisão do administrador)', async () => {
    const sofia = await contaEquipa()
    const alvo = await fichaSemGestor('lar-terreno-v6')
    await adm('update public.instituicoes set publicado = false where id = $1', [alvo])
    await registar(sofia, { larId: alvo, resultado: 'aderiu', verificacao: tudo })
    expect(await ficha(alvo)).toMatchObject({ publicado: false, verificacao_estado: 'verificado', plano: 'por_entrada' })
  })

  it('dados mal formados são recusados sem mexer em nada', async () => {
    const sofia = await contaEquipa()
    const alvo = await fichaSemGestor('lar-terreno-v7')
    const base = { p_instituicao_id: alvo, p_resultado: 'aderiu', p_verificacao: { licenca_confirmada: true, instalacoes_vistas: true } }
    const falha = (args: Record<string, unknown>) => rpc(db, sofia, 'registar_visita', { ...base, ...args }).then(() => '', (e: Error) => e.message)
    expect(await falha({ p_resultado: null })).toMatch(/Indique o resultado da visita/)
    expect(await falha({ p_verificacao: { licenca_confirmada: 'sim' } })).toBe('Verificação inválida.')
    expect(await falha({ p_verificacao: { selo: true } })).toBe('Verificação inválida.')
    expect(await falha({ p_quartos: { tipo: 'individual' } })).toBe('Quartos inválidos.')
    expect(await falha({ p_quartos: [{ tipo: 'individual', livres: 1, preco_min: 1000 }] })).toBe('Quartos inválidos.')
    expect(await falha({ p_quartos: [{ tipo: 'suite', livres: 1, preco_min: 1000, preco_max: 1200 }] })).toBe('Quartos inválidos.')
    expect(await falha({ p_quartos: [{ tipo: 'individual', livres: 1, preco_min: 1e9, preco_max: 1e9 }] })).toBe('Quartos inválidos.')
    expect(await falha({ p_responsavel: { nome: 'X', email: 'sem-arroba' } })).toBe('O email do responsável não é válido.')
    expect(await falha({ p_responsavel: { nome: 'X', idade: 40 } })).toBe('Dados do responsável inválidos.')
    expect(await falha({ p_licenca: 'L'.repeat(61) })).toMatch(/licença tem no máximo 60/)
    expect(await falha({ p_instituicao_id: 'lar-que-nao-existe' })).toBe('Instituição não encontrada.')
    expect(await adm('select 1 from public.visitas where instituicao_id = $1', [alvo])).toEqual([])
    expect(await ficha(alvo)).toMatchObject({ verificacao_estado: 'nao_verificado', plano: null })
  })

  it('na adesão, a modalidade respeita o compromisso: a mesma não o recomeça; por entrada só no fim dos 12 meses', async () => {
    const sofia = await contaEquipa()
    const alvo = await fichaSemGestor('lar-terreno-v8')
    await registar(sofia, { larId: alvo, resultado: 'aderiu', verificacao: tudo, plano: 'mensal' })
    const { plano_desde: desde } = await ficha(alvo)
    // nova visita, mesma modalidade: o compromisso não recomeça
    await registar(sofia, { larId: alvo, resultado: 'aderiu', verificacao: nada, plano: 'mensal' })
    expect(await ficha(alvo)).toMatchObject({ plano: 'mensal', plano_desde: desde })
    // por entrada (ou sem indicar, que é por entrada) dentro do compromisso: recusado, nada muda
    for (const plano of ['por_entrada', undefined] as const) {
      await expect(registar(sofia, { larId: alvo, resultado: 'aderiu', verificacao: tudo, plano })).rejects.toThrow(/compromisso de 12 meses: pode mudar a partir de/)
    }
    expect(await ficha(alvo)).toMatchObject({ plano: 'mensal', plano_desde: desde })
    expect((await q<{ n: number }>(db, sofia, 'select count(*)::int n from public.visitas where instituicao_id = $1', [alvo]))[0]!.n).toBe(2)
    // passados 12 meses, a visita pode registar a mudança
    await adm("update public.instituicoes set plano_desde = now() - interval '12 months 1 day' where id = $1", [alvo])
    await registar(sofia, { larId: alvo, resultado: 'aderiu', verificacao: nada, plano: 'por_entrada' })
    const f = await ficha(alvo)
    expect(f.plano).toBe('por_entrada')
    expect(Math.abs(Date.parse(f.plano_desde!) - (await agoraBd()))).toBeLessThan(60_000)
  })
})

// ————————————————————————————————————————————————————————————————— licença: declarada vs confirmada

describe('licença confirmada (nível público): declarar o número no registo não chega', () => {
  it('a ficha criada pelo lar nasce com a licença só declarada; só a equipa (ou o administrador) a confirma, e todos o veem', async () => {
    const gestora = await criarUtilizador(db, { email: 'nova-gestora@x.pt', roleRegisto: 'lar' })
    const novo = `insert into public.instituicoes (nome, tipo, natureza, localidade, concelho, distrito, regiao, lat, lng, capacidade, licenca)
      values ('Licença Declarada', 'erpi', 'privado', 'Porto', 'Porto', 'Porto', 'Norte', 41.15, -8.61, 20, '55/2021') returning id`
    // nem ao criar a ficha o cliente a pode dar como confirmada
    expect(await erro(db, gestora, `insert into public.instituicoes (nome, tipo, natureza, localidade, concelho, distrito, regiao, lat, lng, capacidade, licenca, licenca_confirmada_em)
      values ('Licença Forjada', 'erpi', 'privado', 'Porto', 'Porto', 'Porto', 'Norte', 41.15, -8.61, 20, '1/2020', now())`)).toMatch(/permission denied/)
    const [{ id }] = (await q<{ id: string }>(db, gestora, novo)) as [{ id: string }]
    await adm('update public.instituicoes set publicado = true where id = $1', [id]) // publicada pelo administrador, ainda por verificar
    expect(await ficha(id)).toMatchObject({ verificacao_estado: 'pendente', licenca: '55/2021', licenca_confirmada_em: null })
    expect(niveisVerificacao(await larDaVista(id)).licenca).toBe(false)
    expect(await erro(db, gestora, 'update public.instituicoes set licenca_confirmada_em = now() where id = $1', [id])).toMatch(/permission denied/)

    // a equipa confirma a licença (sem visitar as instalações): o nível aparece a toda a gente (anon incluído)
    const sofia = await contaEquipa()
    await registar(sofia, { larId: id, resultado: 'interessado', verificacao: { ...nada, licencaConfirmada: true } })
    const [publica] = await q<{ licenca_confirmada_em: string | null }>(db, 'anon', 'select licenca_confirmada_em from public.instituicoes where id = $1', [id])
    expect(publica!.licenca_confirmada_em).not.toBeNull()
    expect(niveisVerificacao(await larDaVista(id))).toMatchObject({ licenca: true, visitado: false })
    expect((await ficha(id)).verificacao_estado).toBe('pendente')
  })

  it('se o gestor muda a licença, o nome ou os contactos, a licença volta a ser só declarada (e a ficha verificada a "pendente")', async () => {
    const sofia = await contaEquipa()
    for (const [coluna, valor] of [['licenca', '77/2024'], ['nome', 'Outro Nome'], ['telefone', '912 345 678']] as const) {
      const b = await cenarioBase(db, { sufixo: `lc-${coluna}` })
      await adm("update public.instituicoes set verificacao_estado = 'pendente', verificacao_data = null where id = $1", [b.instituicao])
      await registar(sofia, { larId: b.instituicao, resultado: 'voltar', verificacao: { ...nada, licencaConfirmada: true } })
      expect(niveisVerificacao(await larDaVista(b.instituicao)).licenca, coluna).toBe(true)
      // mudar a descrição não toca na confirmação
      await q(db, b.lar, "update public.instituicoes set descricao = 'Nova descrição' where id = $1", [b.instituicao])
      expect((await ficha(b.instituicao)).licenca_confirmada_em, coluna).not.toBeNull()
      await q(db, b.lar, `update public.instituicoes set ${coluna} = $2 where id = $1`, [b.instituicao, valor])
      expect((await ficha(b.instituicao)).licenca_confirmada_em, coluna).toBeNull()
      expect(niveisVerificacao(await larDaVista(b.instituicao)).licenca, coluna).toBe(false)
    }
    // ficha com o selo: volta a "pendente" e perde também a licença confirmada
    const v = await cenarioBase(db, { sufixo: 'lc-selo' })
    await registar(sofia, { larId: v.instituicao, resultado: 'aderiu', verificacao: tudo })
    await q(db, v.lar, "update public.instituicoes set morada = 'Rua Nova, 1' where id = $1", [v.instituicao])
    expect(await ficha(v.instituicao)).toMatchObject({ verificacao_estado: 'pendente', verificacao_data: null, licenca_confirmada_em: null })
    expect(niveisVerificacao(await larDaVista(v.instituicao))).toMatchObject({ licenca: false, visitado: false })
  })

  it('defesa em profundidade: mesmo com o privilégio de coluna, um cliente não confirma a licença nem muda a modalidade (trigger)', async () => {
    const b = await cenarioBase(db, { sufixo: 'lc-dd' })
    await adm('grant update (licenca_confirmada_em, plano, plano_desde) on public.instituicoes to authenticated')
    try {
      expect(await codigoErro(db, b.lar, 'update public.instituicoes set licenca_confirmada_em = now() where id = $1', [b.instituicao])).toBe('42501')
      expect(await codigoErro(db, b.lar, "update public.instituicoes set plano = 'mensal', plano_desde = now() where id = $1", [b.instituicao])).toBe('42501')
    } finally {
      await adm('revoke update (licenca_confirmada_em, plano, plano_desde) on public.instituicoes from authenticated')
    }
  })
})

// ————————————————————————————————————————————————————————————————— modalidade dos lares privados

describe('modalidade dos lares privados (dado interno)', () => {
  it('ninguém a lê na tabela nem na vista (anon, famílias, outras instituições, o próprio dono); o dono lê-a no painel, a equipa em painel_equipa', async () => {
    const b = await cenarioBase(db, { sufixo: 'm1' })
    const outro = await cenarioBase(db, { sufixo: 'm1b' })
    const sofia = await contaEquipa()
    await q(db, b.lar, "select * from public.escolher_plano_instituicao('mensal')")

    for (const quem of ['anon', b.familia, outro.lar, b.lar, sofia]) {
      expect(await erro(db, quem, 'select plano from public.instituicoes where id = $1', [b.instituicao])).toMatch(/permission denied/)
      expect(await erro(db, quem, 'select plano_desde from public.instituicoes where id = $1', [b.instituicao])).toMatch(/permission denied/)
      const [v] = await q<Record<string, unknown>>(db, quem, 'select * from public.instituicoes_publicas where id = $1', [b.instituicao])
      expect(Object.keys(v!).filter((k) => k.startsWith('plano') || k.startsWith('compromisso'))).toEqual([])
    }
    // o painel de outra instituição só tem a dela
    expect(await q(db, outro.lar, 'select id, plano from public.painel_instituicao()')).toEqual([{ id: outro.instituicao, plano: null }])
    expect(await q(db, b.familia, 'select * from public.painel_instituicao()')).toEqual([])
    expect(await q(db, b.lar, 'select id, plano from public.painel_instituicao()')).toEqual([{ id: b.instituicao, plano: 'mensal' }])
    // a equipa vê a modalidade e se a ficha tem gestor; as outras contas não veem nada
    const linhas = (await json<PainelEquipaRow>(db, sofia, 'select * from public.painel_equipa()')).map(painelEquipaDeLinha)
    expect(linhas.find((l) => l.larId === b.instituicao)).toMatchObject({ temGestor: true, dono: { planoInstituicao: 'mensal' } })
    for (const quem of [b.familia, b.lar, outro.lar]) expect(await q(db, quem, 'select * from public.painel_equipa()')).toEqual([])
    expect(await erro(db, 'anon', 'select * from public.painel_equipa()')).toMatch(/permission denied/)
    // e ninguém a escreve diretamente (nem o dono)
    expect(await erro(db, b.lar, "update public.instituicoes set plano = 'por_entrada' where id = $1", [b.instituicao])).toMatch(/permission denied/)
  })

  it('escolher_plano_instituicao: só o dono de um lar privado; a mesma modalidade não muda nada', async () => {
    const b = await cenarioBase(db, { sufixo: 'm2' })
    const sofia = await contaEquipa()
    const pro = await criarUtilizador(db, { email: 'pro-m2@x.pt', roleAdmin: 'profissional' })
    for (const quem of [b.familia, sofia, pro]) {
      expect(await codigoErro(db, quem, "select * from public.escolher_plano_instituicao('mensal')")).toBe('42501')
      expect(await erro(db, quem, "select * from public.escolher_plano_instituicao('mensal')")).toMatch(/Só a instituição pode escolher a modalidade/)
    }
    expect(await erro(db, 'anon', "select * from public.escolher_plano_instituicao('mensal')")).toMatch(/permission denied/)
    expect(await erro(db, { sub: b.lar, claims: { is_anonymous: true } }, "select * from public.escolher_plano_instituicao('mensal')")).toMatch(/Só a instituição/)
    expect(await erro(db, b.lar, 'select * from public.escolher_plano_instituicao(null)')).toMatch(/Indique a modalidade/)

    // por omissão é por entrada: escolhê-la não muda nada (nem regista data)
    const [igual] = await json<PlanoDaInstituicaoRow>(db, b.lar, "select * from public.escolher_plano_instituicao('por_entrada')")
    expect(planoDeLinha(igual!)).toEqual({ larId: b.instituicao, planoInstituicao: undefined, planoDesde: undefined, compromissoAte: undefined })
    expect(await ficha(b.instituicao)).toMatchObject({ plano: null, plano_desde: null })

    const [m] = await json<PlanoDaInstituicaoRow>(db, b.lar, "select * from public.escolher_plano_instituicao('mensal')")
    const plano = planoDeLinha(m!)
    expect(plano.planoInstituicao).toBe('mensal')
    expect(Math.abs(Date.parse(plano.planoDesde!) - (await agoraBd()))).toBeLessThan(60_000)
    // o fim do compromisso é o de compromissoAte (protótipo): 12 meses depois (a hora de Lisboa pode diferir da do teste)
    const proto = compromissoAte({ natureza: 'privado', planoInstituicao: 'mensal', planoDesde: plano.planoDesde })!
    expect(Math.abs(Date.parse(plano.compromissoAte!) - Date.parse(proto))).toBeLessThanOrEqual(3_600_000)
    expect(Math.round((Date.parse(plano.compromissoAte!) - Date.parse(plano.planoDesde!)) / 86_400_000)).toBeGreaterThanOrEqual(365)
    // escolher outra vez a mensalidade: nada muda (o compromisso não recomeça)
    const [de_novo] = await json<PlanoDaInstituicaoRow>(db, b.lar, "select * from public.escolher_plano_instituicao('mensal')")
    expect(planoDeLinha(de_novo!)).toEqual(plano)
  })

  it('mensalidade: compromisso de 12 meses; voltar à taxa por entrada só no fim (o erro diz a data)', async () => {
    const b = await cenarioBase(db, { sufixo: 'm3' })
    await q(db, b.lar, "select * from public.escolher_plano_instituicao('mensal')")
    const [p] = await json<PainelInstituicaoRow>(db, b.lar, 'select * from public.painel_instituicao()')
    const { dono, compromissoAte: ate } = painelDeLinha(p!, b.lar)
    // a data por extenso no calendário de Lisboa ('13 de outubro de 2027'), como dataLonga no protótipo
    const [{ texto }] = (await adm<{ texto: string }>('select private.data_longa($1::timestamptz) as texto', [ate])) as [{ texto: string }]
    expect(texto).toMatch(/^\d{1,2} de [a-zç]+ de \d{4}$/)
    expect(podeMudarPlano({ natureza: 'privado', ...dono }, await agoraBd())).toBe(false)
    expect(podeMudarPlano({ natureza: 'privado', ...dono }, Date.parse(ate!) + 3_600_001)).toBe(true)

    const e = await erro(db, b.lar, "select * from public.escolher_plano_instituicao('por_entrada')")
    expect(e).toBe(`A mensalidade tem um compromisso de 12 meses: pode mudar a partir de ${texto}.`)
    expect(await ficha(b.instituicao)).toMatchObject({ plano: 'mensal' })
    expect(Date.parse(ate!)).toBeGreaterThan(await agoraBd())

    // no fim do compromisso já pode
    await adm("update public.instituicoes set plano_desde = now() - interval '12 months 1 day' where id = $1", [b.instituicao])
    const [r] = await json<PlanoDaInstituicaoRow>(db, b.lar, "select * from public.escolher_plano_instituicao('por_entrada')")
    expect(planoDeLinha(r!)).toMatchObject({ planoInstituicao: 'por_entrada', compromissoAte: undefined })
  })

  it('IPSS e Misericórdias nunca têm modalidade (nem pelo administrador); a ficha que deixa de ser privada perde-a', async () => {
    const ipss = await fichaSemGestor('lar-terreno-m4', 'ipss')
    expect(await erro(db, 'service_role', "update public.instituicoes set plano = 'mensal', plano_desde = now() where id = $1", [ipss])).toMatch(/instituicoes_plano_so_privados/)
    const b = await cenarioBase(db, { sufixo: 'm4' })
    expect(await erro(db, 'service_role', "update public.instituicoes set plano = 'mensal' where id = $1", [b.instituicao])).toMatch(/instituicoes_plano_com_data/)
    await q(db, b.lar, "select * from public.escolher_plano_instituicao('mensal')")
    // o dono corrige a natureza: sem modalidade (e a verificação volta a "pendente", como qualquer mudança de identidade)
    await q(db, b.lar, "update public.instituicoes set natureza = 'misericordia' where id = $1", [b.instituicao])
    expect(await ficha(b.instituicao)).toMatchObject({ plano: null, plano_desde: null, verificacao_estado: 'pendente' })
    expect(await erro(db, b.lar, "select * from public.escolher_plano_instituicao('mensal')")).toMatch(/não têm custos/)
  })
})

// ————————————————————————————————————————————————————————————————— taxa da entrada

describe("taxa da entrada: 'incluida' com a mensalidade", () => {
  /** pedido com a vaga aceite pela família (aceitar → vaga proposta → família aceita) */
  async function pedidoAceite(b: Awaited<ReturnType<typeof cenarioBase>>) {
    const [c] = await q<{ id: string }>(db, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, b.perfil])
    await q(db, b.lar, 'select public.aceitar_candidatura($1)', [c!.id])
    await q(db, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [c!.id])
    await q(db, b.familia, 'select public.responder_vaga($1, true)', [c!.id])
    return c!.id
  }

  const casos = [
    { natureza: 'privado', plano: null, taxa: 'aplicavel' },
    { natureza: 'privado', plano: 'mensal', taxa: 'incluida' },
    { natureza: 'ipss', plano: null, taxa: 'isenta' },
    { natureza: 'misericordia', plano: null, taxa: 'isenta' },
  ] as const
  for (const [i, k] of casos.entries()) {
    it(`${k.natureza}${k.plano ? ` com ${k.plano}` : ''}: a primeira confirmação fixa a taxa "${k.taxa}" (como taxaPara no protótipo)`, async () => {
      const b = await cenarioBase(db, { sufixo: `t${i}`, natureza: k.natureza })
      if (k.plano) await q(db, b.lar, 'select * from public.escolher_plano_instituicao($1)', [k.plano])
      const c = await pedidoAceite(b)
      const [e] = await q<{ entrada_taxa: string }>(db, b.lar, 'select entrada_taxa from public.marcar_entrada($1, current_date)', [c])
      expect(e!.entrada_taxa).toBe(k.taxa)
      expect(taxaPara({ natureza: k.natureza, planoInstituicao: k.plano ?? undefined } as Pick<Lar, 'natureza' | 'planoInstituicao'>)).toBe(k.taxa)
      expect(await q(db, b.lar, 'select entrada_taxa from public.pedidos_recebidos() where id = $1', [c])).toEqual([{ entrada_taxa: k.taxa }])
      expect(await q(db, b.familia, 'select entrada_taxa from public.candidaturas where id = $1', [c])).toEqual([{ entrada_taxa: k.taxa }])
    })
  }

  it('a taxa fica a da modalidade em vigor na primeira confirmação (mudar depois não a altera)', async () => {
    // confirmada pela família ainda por entrada; o lar muda para a mensalidade e marca depois: fica aplicável
    const b = await cenarioBase(db, { sufixo: 't5', livres: { individual: 2 } })
    const c = await pedidoAceite(b)
    await q(db, b.familia, 'select public.confirmar_entrada_familia($1, current_date)', [c])
    await q(db, b.lar, "select * from public.escolher_plano_instituicao('mensal')")
    const [l] = await q<{ entrada_taxa: string }>(db, b.lar, 'select entrada_taxa from public.marcar_entrada($1, current_date)', [c])
    expect(l!.entrada_taxa).toBe('aplicavel')
    // confirmada na mensalidade e, passado o compromisso, o lar volta à taxa por entrada: continua incluída
    const c2Perfil = (await q<{ id: string }>(db, b.familia, `insert into public.perfis_cuidados (nome, idade, grau, quarto, local_lat, local_lng)
      values ('Joaquim', 80, 'moderada', 'individual', 41.1, -8.6) returning id`))[0]!.id
    const [c2] = await q<{ id: string }>(db, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, c2Perfil])
    await q(db, b.lar, 'select public.aceitar_candidatura($1)', [c2!.id])
    await q(db, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [c2!.id])
    await q(db, b.familia, 'select public.responder_vaga($1, true)', [c2!.id])
    const [l2] = await q<{ entrada_taxa: string }>(db, b.lar, 'select entrada_taxa from public.marcar_entrada($1, current_date)', [c2!.id])
    expect(l2!.entrada_taxa).toBe('incluida')
    await adm("update public.instituicoes set plano_desde = now() - interval '13 months' where id = $1", [b.instituicao])
    await q(db, b.lar, "select * from public.escolher_plano_instituicao('por_entrada')")
    const [f2] = await q<{ entrada_taxa: string }>(db, b.familia, 'select entrada_taxa from public.confirmar_entrada_familia($1, current_date)', [c2!.id])
    expect(f2!.entrada_taxa).toBe('incluida')
  })
})

// ————————————————————————————————————————————————————————————————— migração sobre dados existentes

describe('migração sobre dados existentes (projeto já em uso antes da equipa e da modalidade)', () => {
  it('as entradas já registadas mantêm a taxa, as fichas ficam por entrada e o painel, os papéis e as RPC continuam a funcionar', async () => {
    const antiga = await criarBase({ ate: '20261013100000' })
    const b = await cenarioBase(antiga, { sufixo: 'x' })
    await cenarioBase(antiga, { sufixo: 'xi', natureza: 'ipss' })
    const [c] = await q<{ id: string }>(antiga, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, b.perfil])
    await q(antiga, b.lar, 'select public.aceitar_candidatura($1)', [c!.id])
    await q(antiga, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [c!.id])
    await q(antiga, b.familia, 'select public.responder_vaga($1, true)', [c!.id])
    await q(antiga, b.lar, 'select public.marcar_entrada($1, current_date)', [c!.id])
    // antes desta migração, 'equipa' no app_metadata não dava nenhum papel especial
    const antes = await criarUtilizador(antiga, { email: 'equipa-antes@x.pt', roleAdmin: 'equipa' })
    expect(await admin(antiga, 'select role from public.perfis_utilizador where id = $1', [antes])).toEqual([{ role: 'familia' }])

    await aplicarMigracoes(antiga, '20261013100000')

    expect(await admin(antiga, 'select entrada_taxa from public.candidaturas where id = $1', [c!.id])).toEqual([{ entrada_taxa: 'aplicavel' }])
    expect(await admin(antiga, 'select count(*)::int n from public.instituicoes where plano is not null or plano_desde is not null')).toEqual([{ n: 0 }])
    expect(await q(antiga, b.lar, 'select id, plano, compromisso_ate from public.painel_instituicao()')).toEqual([{ id: b.instituicao, plano: null, compromisso_ate: null }])
    // a confirmação da família depois da migração junta-se à entrada sem mudar a taxa
    expect(await q(antiga, b.familia, 'select entrada_taxa from public.confirmar_entrada_familia($1, current_date)', [c!.id])).toEqual([{ entrada_taxa: 'aplicavel' }])
    // a conta que o administrador já tinha marcado como equipa passa a sê-lo com a migração (e mais nenhuma)
    expect(await admin(antiga, 'select role from public.perfis_utilizador where id = $1', [antes])).toEqual([{ role: 'equipa' }])
    expect(await admin(antiga, "select count(*)::int n from public.perfis_utilizador where role = 'equipa'")).toEqual([{ n: 1 }])
    expect(await q(antiga, antes, "select resultado from public.registar_visita($1, 'interessado')", [b.instituicao])).toEqual([{ resultado: 'interessado' }])
    expect(await q(antiga, b.lar, "select plano from public.escolher_plano_instituicao('mensal')")).toEqual([{ plano: 'mensal' }])
    await antiga.close()
  }, 120_000) // cria uma segunda base (todas as migrações) dentro do teste
})
