/**
 * RLS, privilégios e triggers de proteção — regressões da revisão de segurança (2026-10-12).
 * Cada teste reproduz o ataque/abuso descrito e prova que deixou de ser possível.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { admin, afetadas, cenarioBase, codigoErro, como, criarBase, criarUtilizador, erro, q } from './helpers'

let db: PGlite
let base: Awaited<ReturnType<typeof cenarioBase>>
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)

const NOVA_FICHA = `insert into public.instituicoes (nome, tipo, natureza, localidade, concelho, distrito, regiao, lat, lng, capacidade)
  values ($1, 'erpi', 'privado', 'Porto', 'Porto', 'Porto', 'Norte', 41.15, -8.61, 30) returning id`

beforeAll(async () => {
  db = await criarBase()
  base = await cenarioBase(db)
}, 120_000)

describe('registo e papéis', () => {
  it("'lar' escolhido no registo dá só um rascunho: não publica, anon não o vê e não recebe pedidos", async () => {
    const mal = await criarUtilizador(db, { email: 'mal@x.pt', roleRegisto: 'lar' })
    expect((await adm<{ role: string }>('select role from public.perfis_utilizador where id = $1', [mal]))[0]!.role).toBe('lar')

    // publicar ao criar: sem privilégio na coluna
    expect(await erro(db, mal, `insert into public.instituicoes (publicado, nome, tipo, natureza, localidade, concelho, distrito, regiao, lat, lng, capacidade)
      values (true, 'Santa Casa da Misericórdia do Porto', 'erpi', 'misericordia', 'Porto', 'Porto', 'Porto', 'Norte', 41.15, -8.61, 30)`)).toMatch(/permission denied/)

    const [f] = await q<{ id: string }>(db, mal, NOVA_FICHA, ['Santa Casa da Misericórdia do Porto'])
    const [estado] = await adm<{ publicado: boolean; verificacao_estado: string }>('select publicado, verificacao_estado from public.instituicoes where id = $1', [f!.id])
    expect(estado).toEqual({ publicado: false, verificacao_estado: 'pendente' })
    expect(await erro(db, mal, 'update public.instituicoes set publicado = true where id = $1', [f!.id])).toMatch(/permission denied/)
    expect(await q(db, 'anon', 'select id from public.instituicoes_publicas where id = $1', [f!.id])).toEqual([])

    // mesmo publicada por engano como "pendente", não recebe dados de saúde
    await adm('update public.instituicoes set publicado = true where id = $1', [f!.id])
    expect(await erro(db, base.familia, 'select public.candidatar($1, $2, true)', [f!.id, base.perfil])).toMatch(/ainda não recebe pedidos/)
    expect(await q(db, mal, 'select id from public.candidaturas')).toEqual([])
  })

  it('defesa em profundidade: mesmo com o privilégio de coluna, um cliente não publica (trigger)', async () => {
    await adm('grant update (publicado) on public.instituicoes to authenticated')
    try {
      expect(await codigoErro(db, base.lar, 'update public.instituicoes set publicado = false where id = $1', [base.instituicao])).toBe('42501')
    } finally {
      await adm('revoke update (publicado) on public.instituicoes from authenticated')
    }
  })

  it('contas anónimas são sempre família e não criam fichas, perfis de saúde, avaliações nem pedidos', async () => {
    const anonima = await criarUtilizador(db, { email: null, anonimo: true, roleRegisto: 'lar' })
    expect((await adm<{ role: string }>('select role from public.perfis_utilizador where id = $1', [anonima]))[0]!.role).toBe('familia')
    const sessao = { sub: anonima, claims: { is_anonymous: true } }
    expect(await erro(db, sessao, `insert into public.perfis_cuidados (nome, idade, grau, local_lat, local_lng) values ('X', 80, 'ligeira', 41, -8)`)).toMatch(/row-level security/)
    // avaliações: nunca diretamente na tabela (só avaliar_lar, que exige um pedido com entrada confirmada)
    expect(await erro(db, sessao, `insert into public.avaliacoes (instituicao_id, autor, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes, aspeto_comunicacao, texto)
      values ($1, 'Anónimo', 1, 1, 1, 1, 1, 'Texto da avaliação anónima')`, [base.instituicao])).toMatch(/permission denied/)
    // uma conta 'lar' com sessão anónima (ex.: papel dado por app_metadata) também não cria fichas
    const larAnonimo = await criarUtilizador(db, { email: null, anonimo: true, roleAdmin: 'lar' })
    expect(await erro(db, { sub: larAnonimo, claims: { is_anonymous: true } }, NOVA_FICHA, ['Lar Anónimo'])).toMatch(/row-level security/)
    // pedido: mesmo com um perfil (criado por outra via), a sessão anónima é recusada
    expect(await erro(db, { sub: base.familia, claims: { is_anonymous: true } }, 'select public.candidatar($1, $2, true)', [base.instituicao, base.perfil])).toMatch(/Crie uma conta com email/)
  })

  it('mudar o user_metadata depois do registo não muda o papel; o app_metadata (administrador) muda', async () => {
    const u = await criarUtilizador(db, { email: 'troca@x.pt', roleRegisto: 'familia' })
    await adm(`update auth.users set raw_user_meta_data = '{"role":"lar"}' where id = $1`, [u])
    expect((await adm<{ role: string }>('select role from public.perfis_utilizador where id = $1', [u]))[0]!.role).toBe('familia')
    await adm(`update auth.users set raw_app_meta_data = '{"role":"lar"}' where id = $1`, [u])
    expect((await adm<{ role: string }>('select role from public.perfis_utilizador where id = $1', [u]))[0]!.role).toBe('lar')
  })
})

describe('selo de verificação', () => {
  it('mudar nome, morada ou contactos de uma ficha verificada volta a "pendente"; a descrição não', async () => {
    const { lar, instituicao } = await cenarioBase(db, { sufixo: 'v' })
    expect(await afetadas(db, lar, "update public.instituicoes set descricao = 'Nova descrição' where id = $1", [instituicao])).toBe(1)
    expect((await adm<{ v: string }>('select verificacao_estado v from public.instituicoes where id = $1', [instituicao]))[0]!.v).toBe('verificado')

    for (const [coluna, valor] of [
      ['nome', 'URGENTE: pague sinal 500€ MBWay 912345678 para garantir vaga'],
      ['telefone', '912 345 678'],
      ['morada', 'Rua Falsa, 1'],
      ['acordo_ss', true],
    ] as const) {
      await adm("update public.instituicoes set verificacao_estado = 'verificado', verificacao_data = now() where id = $1", [instituicao])
      expect(await afetadas(db, lar, `update public.instituicoes set ${coluna} = $2 where id = $1`, [instituicao, valor])).toBe(1)
      const [r] = await q<{ verificacao_estado: string; verificacao_data: string | null }>(
        db, 'anon', 'select verificacao_estado, verificacao_data from public.instituicoes_publicas where id = $1', [instituicao],
      )
      expect(r, coluna).toEqual({ verificacao_estado: 'pendente', verificacao_data: null })
    }
  })
})

describe('fichas sem gestor', () => {
  it('apagar a conta do gestor despublica a ficha (ON DELETE SET NULL)', async () => {
    const { lar, instituicao } = await cenarioBase(db, { sufixo: 'g' })
    await adm('delete from auth.users where id = $1', [lar])
    const [r] = await adm<{ owner_id: string | null; publicado: boolean }>('select owner_id, publicado from public.instituicoes where id = $1', [instituicao])
    expect(r).toEqual({ owner_id: null, publicado: false })
    expect(await q(db, 'anon', 'select id from public.instituicoes_publicas where id = $1', [instituicao])).toEqual([])
  })
})

describe('dados internos', () => {
  it('anon e authenticated não leem owner_id nem visualizacoes_30d; o dono usa painel_instituicao()', async () => {
    expect(await erro(db, 'anon', 'select id, owner_id from public.instituicoes')).toMatch(/permission denied/)
    expect(await erro(db, base.familia, 'select visualizacoes_30d from public.instituicoes')).toMatch(/permission denied/)
    expect(await erro(db, base.lar, 'select owner_id from public.instituicoes where id = $1', [base.instituicao])).toMatch(/permission denied/)
    // a vista e select de colunas públicas continuam a funcionar para anon
    expect(await q(db, 'anon', 'select id, nome, faixa_preco from public.instituicoes_publicas where id = $1', [base.instituicao])).toHaveLength(1)

    const painel = await q<Record<string, unknown>>(db, base.lar, 'select * from public.painel_instituicao()')
    expect(painel).toEqual([{
      id: base.instituicao, publicado: true, verificacao_estado: 'verificado', visualizacoes_30d: 0, lista_espera_offline: 0, lista_espera_online: 0,
      plano: null, plano_desde: null, compromisso_ate: null,
    }])
    expect(await q(db, base.familia, 'select * from public.painel_instituicao()')).toEqual([])
    expect(await erro(db, 'anon', 'select * from public.painel_instituicao()')).toMatch(/permission denied/)
  })

  it('o histórico de um pedido não expõe autor_id', async () => {
    expect(await erro(db, base.familia, 'select autor_id from public.candidatura_eventos')).toMatch(/permission denied/)
    await expect(q(db, base.familia, 'select estado, nota, autor, created_at from public.candidatura_eventos')).resolves.toBeDefined()
  })
})

describe('favoritos', () => {
  it('não se seguem fichas não publicadas e o erro é igual ao de um id inexistente (sem oráculo)', async () => {
    const dono = await criarUtilizador(db, { email: 'secreto@x.pt', roleAdmin: 'lar' })
    const [f] = await q<{ id: string }>(db, dono, NOVA_FICHA, ['Secreto Ainda Nao Publicado'])
    const naoPublicada = await erro(db, base.familia, 'insert into public.favoritos (instituicao_id) values ($1)', [f!.id])
    const inexistente = await erro(db, base.familia, 'insert into public.favoritos (instituicao_id) values ($1)', ['lar-nao-existe'])
    expect(naoPublicada).toMatch(/row-level security/)
    expect(inexistente).toBe(naoPublicada)
    expect(await afetadas(db, base.familia, 'insert into public.favoritos (instituicao_id) values ($1)', [base.instituicao])).toBe(1)
  })

  it('quem segue uma ficha que deixou de estar publicada não recebe avisos de vaga dela', async () => {
    const { lar, instituicao } = await cenarioBase(db, { sufixo: 'f', livres: { individual: 0 } })
    // com o Acesso Família (sem ele, o alerta nem fica ligado — acesso.test.ts)
    const seguidor = await criarUtilizador(db, { email: 'seguidor@x.pt', roleAdmin: 'familia', acesso: true })
    await q(db, seguidor, 'insert into public.favoritos (instituicao_id) values ($1)', [instituicao])
    await adm('update public.instituicoes set publicado = false where id = $1', [instituicao])
    expect((await q<{ n: number }>(db, lar, "select public.definir_vagas($1, 'individual', 5) as n", [instituicao]))[0]!.n).toBe(0)
    expect(await adm('select 1 from public.notificacoes where user_id = $1 and tipo = $2', [seguidor, 'vaga'])).toEqual([])
  })
})

describe('sequências', () => {
  it('anon não consegue setval/nextval; inserções com identity continuam a funcionar', async () => {
    expect(await erro(db, 'anon', "select setval('public.notificacoes_id_seq', 1)")).toMatch(/permission denied/)
    expect(await erro(db, base.familia, "select nextval('public.avaliacoes_id_seq')")).toMatch(/permission denied/)
    expect(await afetadas(db, base.lar, `insert into public.quartos (instituicao_id, tipo, total, preco_min, preco_max) values ($1, 'casal', 2, 2000, 2200)`, [base.instituicao])).toBe(1)
    // e o registo continua a funcionar (o trigger cria a notificação de boas-vindas)
    await expect(criarUtilizador(db, { email: 'depois-do-setval@x.pt' })).resolves.toMatch(/-/)
  })
})

describe('avaliações', () => {
  /** pedido com a vaga aceite e a entrada confirmada pelos dois lados (única via para avaliar) */
  async function entradaConfirmada(b: Awaited<ReturnType<typeof cenarioBase>>) {
    const [c] = await q<{ id: string }>(db, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, b.perfil])
    await q(db, b.lar, 'select public.aceitar_candidatura($1)', [c!.id])
    await q(db, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [c!.id])
    await q(db, b.familia, 'select public.responder_vaga($1, true)', [c!.id])
    await q(db, b.lar, 'select public.marcar_entrada($1, current_date)', [c!.id])
    await q(db, b.familia, 'select public.confirmar_entrada_familia($1, current_date)', [c!.id])
    return c!.id
  }

  it('o autor apaga a sua avaliação (e os agregados acompanham); outra família não', async () => {
    const b = await cenarioBase(db, { sufixo: 'a' })
    const outra = await criarUtilizador(db, { email: 'outra-av@x.pt', roleAdmin: 'familia' })
    const c = await entradaConfirmada(b)
    const [av] = await q<{ id: number }>(db, b.familia, `select id from public.avaliar_lar($1, 2, 'Pouca comunicação com as famílias.', '{"cuidados":2,"alimentacao":2,"instalacoes":2,"comunicacao":2}')`, [c])
    expect((await adm<{ n: number }>('select num_avaliacoes n from public.instituicoes where id = $1', [b.instituicao]))[0]!.n).toBe(1)
    expect(await afetadas(db, outra, 'delete from public.avaliacoes where id = $1', [av!.id])).toBe(0)
    expect(await afetadas(db, b.familia, 'delete from public.avaliacoes where id = $1', [av!.id])).toBe(1)
    expect((await adm<{ n: number; m: string }>('select num_avaliacoes n, avaliacao_media::text m from public.instituicoes where id = $1', [b.instituicao]))[0]).toEqual({ n: 0, m: '0.00' })
  })

  it('contas de demonstração não avaliam fichas reais (nem diretamente, nem sem um pedido com entrada confirmada)', async () => {
    const demo = await criarUtilizador(db, { email: 'demo-av@x.pt', roleAdmin: 'familia', acesso: true })
    await adm('update public.perfis_utilizador set demonstracao = true where id = $1', [demo])
    expect(await erro(db, demo, `insert into public.avaliacoes (instituicao_id, autor, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes, aspeto_comunicacao, texto)
      values ($1, 'Demo', 1, 1, 1, 1, 1, 'Avaliação vinda da conta pública')`, [base.instituicao])).toMatch(/permission denied/)
    const [p] = await q<{ id: string }>(db, demo, `insert into public.perfis_cuidados (nome, idade, grau, local_lat, local_lng) values ('X', 80, 'ligeira', 41, -8) returning id`)
    expect(await erro(db, demo, 'select public.candidatar($1, $2, true)', [base.instituicao, p!.id])).toMatch(/contas de demonstração não enviam/)
  })
})

describe('limites de tamanho (dados servidos a anon em todas as pesquisas)', () => {
  const tentar = (set: string) => erro(db, base.lar, `update public.instituicoes set ${set} where id = $1`, [base.instituicao])

  it('recusa extras, incluido, capa e graus enormes ou mal formados', async () => {
    expect(await tentar("extras = (select jsonb_agg(jsonb_build_object('nome', repeat('x', 1000), 'preco', '1')) from generate_series(1, 8000))")).toMatch(/instituicoes_extras_limite/)
    expect(await tentar(`extras = '["texto solto"]'`)).toMatch(/instituicoes_extras_limite/)
    expect(await tentar(`extras = '[{"nome": "Cabeleireiro"}]'`)).toMatch(/instituicoes_extras_limite/)
    expect(await tentar("incluido = (select array_agg(repeat('y', 1000)) from generate_series(1, 2000))")).toMatch(/instituicoes_incluido_limite/)
    expect(await tentar("incluido = array['ok', null]")).toMatch(/instituicoes_incluido_limite/)
    expect(await tentar(`capa = '{"hue": 10, "variante": 1, "lixo": "x"}'`)).toMatch(/instituicoes_capa_formato/)
    expect(await tentar(`capa = '{"hue": "10", "variante": 1}'`)).toMatch(/instituicoes_capa_formato/)
    expect(await tentar("graus = array['ligeira','ligeira','ligeira','ligeira','ligeira']::public.grau_dependencia[]")).toMatch(/instituicoes_graus_limite/)
    expect(await tentar("cuidados = (select array_agg('medico'::text) from generate_series(1, 1000))")).toMatch(/lista_cuidados_tamanho/)
  })

  it('aceita os valores normais do formulário da ficha (incluindo horas de médico com décimas)', async () => {
    expect(await afetadas(db, base.lar, `update public.instituicoes set
        extras = '[{"nome": "Cabeleireiro", "preco": "15 €"}, {"nome": "Fisioterapia extra", "preco": "40 €/sessão"}]',
        incluido = array['Alojamento e todas as refeições', 'Tratamento de roupa'],
        capa = '{"hue": 200, "variante": 2}', graus = '{ligeira,moderada}',
        equipa_medico_horas_semana = 7.5, equipa_cuidadores_por_10 = 4.5
      where id = $1`, [base.instituicao])).toBe(1)
    // como o PostgREST converte o JSON do pedido (json_populate_record): 7.5 já não falha
    const [r] = await q<{ h: string }>(db, base.lar, `select (json_populate_record(null::public.instituicoes, '{"equipa_medico_horas_semana": 7.5}')).equipa_medico_horas_semana::text as h`)
    expect(r!.h).toBe('7.5')
  })
})

describe('quartos', () => {
  it('a capacidade acompanha a soma dos lugares quando o dono acrescenta quartos', async () => {
    const { lar, instituicao } = await cenarioBase(db, { sufixo: 'c' })
    await q(db, lar, "insert into public.quartos (instituicao_id, tipo, total, preco_min, preco_max) values ($1, 'casal', 10, 2000, 2400)", [instituicao])
    expect((await adm<{ c: number }>('select capacidade c from public.instituicoes where id = $1', [instituicao]))[0]!.c).toBe(50)
    await q(db, lar, "update public.quartos set total = 5 where instituicao_id = $1 and tipo = 'casal'", [instituicao])
    expect((await adm<{ c: number }>('select capacidade c from public.instituicoes where id = $1', [instituicao]))[0]!.c).toBe(50)
  })
})

describe('papéis e sessões em como()', () => {
  it('auth.jwt() devolve as claims da sessão (is_anonymous)', async () => {
    const r = await como(db, { sub: base.familia, claims: { is_anonymous: true } }, async () =>
      (await db.query<{ a: string }>("select auth.jwt() ->> 'is_anonymous' as a")).rows,
    )
    expect(r[0]!.a).toBe('true')
  })
})

describe('faturação: quem lê o quê (RLS e privilégios por coluna)', () => {
  it('o lar lê as suas linhas sem stripe_*/moloni_*; a família as suas compras e FR; ninguém mais; só documentos emitidos', async () => {
    const { BDPGlite, MontagemSql, criarConta } = await import('./faturacao-bd')
    const bd = new BDPGlite(db)
    const m = new MontagemSql(db)
    const agora = Date.now()
    const em = (ms: number) => new Date(agora + ms).toISOString()
    const dono = await m.lar('lar-rls-fat', { stripe_customer_id: 'cus_rls', metodo: { tipo: 'sepa_debit', ultimos4: '3000', mandato_ref: 'M-R', pm: 'pm_rls' } })
    const outroDono = await m.lar('lar-rls-outro')
    await adm("insert into public.contratos (instituicao_id, referencia, inicio, notas) values ('lar-rls-fat', 'CT-RLS-1', current_date - 10, 'interno')")
    await m.entrada({ candidatura_id: 'cafe0001-0000-4000-8000-000000000001', instituicao_id: 'lar-rls-fat', pedido_criado_em: em(-30 * 86_400_000), entrada_data: em(-6 * 86_400_000).slice(0, 10), lar_em: em(-5 * 86_400_000), familia_em: null, taxa: 'aplicavel' })
    await bd.rpc('servico_reservar_documentos', { p_modo: 'fatura_por_entrada', p_agora: em(0), p_limite: 10 })
    const fam = await criarConta(db, null, 'familia', false)
    const outraFam = await criarConta(db, null, 'familia', false)
    const ini = await bd.rpc('servico_acesso_iniciar', { p_user_id: fam, p_plano: 'acesso_30', p_texto_versao: 'v', p_ip: null, p_nif: null, p_nome_fiscal: null })
    await bd.rpc('servico_evento_iniciar', { p_id: 'evt_rls', p_tipo: 'x', p_livemode: false, p_criado_em: em(0) })
    await bd.rpc('servico_evento_aplicar', { p_id: 'evt_rls', p_operacoes: [{ op: 'acesso_pago', session_id: 'cs_test_rls', pagamento_id: ini.pagamento_id, payment_intent_id: 'pi_rls', metodo: 'card', valor_centimos: 1490, pago_em: em(0) }] })

    // pendentes: ninguém os vê (nem o dono, nem a família)
    const docs = await adm<{ id: string; tipo: string }>('select id, tipo from public.documentos_fiscais order by ordem')
    expect(docs.map((d) => d.tipo)).toEqual(['FT', 'FR'])
    expect(await q(db, dono, 'select id from public.documentos_fiscais')).toEqual([])
    expect(await q(db, fam, 'select id from public.documentos_fiscais')).toEqual([])
    for (const d of await bd.rpc('servico_documentos_pendentes', { p_agora: em(0), p_limite: 10 })) {
      await bd.rpc('servico_documento_emitido', { p_id: d.id, p_externo_id: `falso:${d.chave}`, p_numero: `${d.tipo} F/1`, p_total_centimos: d.total_centimos, p_iva_centimos: d.iva_centimos, p_emitido_em: em(0), p_emissor: 'falso' })
    }
    const [ft, fr] = docs
    // emitidos: o lar a sua FT, a família a sua FR (é o que faturacao-documento usa para provar a posse)
    expect(await q(db, dono, 'select id, tipo, numero from public.documentos_fiscais')).toEqual([{ id: ft!.id, tipo: 'FT', numero: 'FT F/1' }])
    expect(await q(db, fam, 'select id, tipo from public.documentos_fiscais')).toEqual([{ id: fr!.id, tipo: 'FR' }])
    for (const quem of [outroDono, outraFam]) expect(await q(db, quem, 'select id from public.documentos_fiscais where id = any($1)', [[ft!.id, fr!.id]])).toEqual([])
    expect(await erro(db, dono, 'select externo_id from public.documentos_fiscais')).toMatch(/permission denied/)
    expect(await erro(db, fam, 'select cliente from public.documentos_fiscais')).toMatch(/permission denied/)

    // dados fiscais e método: o dono sem as referências do Stripe/Moloni; mais ninguém
    expect(await q(db, dono, 'select nif, metodo_ultimos4 from public.dados_faturacao')).toEqual([{ nif: '599999993', metodo_ultimos4: '3000' }])
    expect(await erro(db, dono, 'select stripe_customer_id from public.dados_faturacao')).toMatch(/permission denied/)
    expect(await erro(db, dono, 'select * from public.dados_faturacao')).toMatch(/permission denied/)
    for (const quem of [outroDono, fam]) expect(await q(db, quem, "select instituicao_id from public.dados_faturacao where instituicao_id = 'lar-rls-fat'")).toEqual([])
    expect(await q(db, outroDono, 'select instituicao_id from public.dados_faturacao')).toEqual([{ instituicao_id: 'lar-rls-outro' }])
    // contrato sem as notas; linhas do próprio
    expect(await q(db, dono, 'select referencia, taxa_entrada_centimos from public.contratos')).toEqual([{ referencia: 'CT-RLS-1', taxa_entrada_centimos: 15000 }])
    expect(await erro(db, dono, 'select notas from public.contratos')).toMatch(/permission denied/)
    expect(await q(db, dono, 'select valor_centimos from public.fatura_linhas')).toEqual([{ valor_centimos: 15000 }])
    expect(await q(db, outroDono, 'select 1 from public.fatura_linhas')).toEqual([])
    expect(await q(db, fam, 'select 1 from public.contratos')).toEqual([])

    // a família: as suas compras sem stripe_*; o lar não as vê
    expect(await q(db, fam, 'select estado, metodo from public.pagamentos_familia')).toEqual([{ estado: 'pago', metodo: 'card' }])
    expect(await erro(db, fam, 'select stripe_payment_intent_id from public.pagamentos_familia')).toMatch(/permission denied/)
    expect(await q(db, dono, 'select 1 from public.pagamentos_familia')).toEqual([])
    expect(await q(db, outraFam, 'select 1 from public.consentimentos_acesso')).toEqual([])

    // stripe_eventos: nenhum cliente; anon nem a tabela
    expect(await erro(db, dono, 'select id from public.stripe_eventos')).toMatch(/permission denied/)
    for (const t of ['dados_faturacao', 'faturas', 'documentos_fiscais', 'pagamentos_familia', 'stripe_eventos', 'subscricoes_instituicao']) {
      expect(await erro(db, 'anon', `select 1 from public.${t}`), t).toMatch(/permission denied/)
    }
  })
})
