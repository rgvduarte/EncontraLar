/**
 * Faturação dos lares na base de dados (20261013120000_faturacao.sql): dados fiscais e página Faturação
 * (faturacao_resumo, com o contrato e o IVA da região), contestações (as regras, a decisão da equipa, a retirada
 * quando o lar marca a entrada) e cobranças (retoma, FT por emitir, modos fatura_mensal e fatura_recibo_mensal).
 * Contexto partilhado em faturacao-contexto.ts (a base é esvaziada antes de cada teste).
 */
import { describe, expect, it } from 'vitest'
import { dataLonga, fimContestacao } from '../functions/_shared/faturacao/datas.ts'
import { DIA } from './funcoes/fakes.ts'
import { criarConta, DADOS_LAR, PERFIL_SENSIVEL } from './faturacao-bd'
import { adm, aplicar, bd, cand, db, em, emitir, entradaFamilia, entradaLar, falha, H, LAR_SEPA, m, pendentes, reservar, rpc, usarBaseLimpa } from './faturacao-contexto'
import { q, type Quem } from './helpers'

usarBaseLimpa()

// ————————————————————————————————————————————————————————————— dono do lar: dados fiscais e resumo

describe('guardar_dados_faturacao e faturacao_resumo (dono do lar)', () => {
  it('o dono guarda os dados (NIF normalizado) e o resumo devolve-os; as referências do Stripe ficam do servidor', async () => {
    const dono = await m.lar('lar-dados', { dados: null })
    const dados = await rpc(dono, 'guardar_dados_faturacao', {
      p_razao_social: '  Cuidados Exemplo, Lda. ', p_nif: 'PT 599.999.993', p_morada: 'Rua das Camélias 128', p_codigo_postal: '4200-187',
      p_localidade: 'Porto', p_email: 'faturacao@lar.exemplo.pt',
    })
    expect(dados).toEqual({ ...DADOS_LAR, atualizado_em: expect.any(String) })
    await bd.rpc('servico_definir_cliente_stripe', { p_instituicao_id: 'lar-dados', p_customer_id: 'cus_d1' })
    // mudar os dados mantém o cliente Stripe
    await rpc(dono, 'guardar_dados_faturacao', { ...Object.fromEntries(Object.entries(DADOS_LAR).map(([k, v]) => [`p_${k}`, v])), p_email: 'novo@lar.exemplo.pt' })
    expect(await adm('select email, stripe_customer_id from public.dados_faturacao')).toEqual([{ email: 'novo@lar.exemplo.pt', stripe_customer_id: 'cus_d1' }])
    const r = await rpc(dono, 'faturacao_resumo')
    expect(r).toMatchObject({ instituicao_id: 'lar-dados', isenta: false, plano: null, contrato: null, metodo: null, subscricao: null, dados: { email: 'novo@lar.exemplo.pt', nif: '599999993' } })
    expect(JSON.stringify(r)).not.toContain('cus_d1')
  })

  it('validações com mensagens em português (22023); IPSS → sem custos; outra conta, anónima ou anon → recusa', async () => {
    const dono = await m.lar('lar-validar', { dados: null })
    const base = { p_razao_social: 'Cuidados, Lda.', p_nif: '599999993', p_morada: 'Rua A, 1', p_codigo_postal: '4200-187', p_localidade: 'Porto', p_email: 'f@lar.pt' }
    const casos: [Partial<typeof base>, string][] = [
      [{ p_razao_social: 'X' }, 'Indique a razão social (2 a 200 carateres).'],
      [{ p_nif: '12345' }, 'O NIF tem 9 algarismos.'],
      [{ p_nif: '123456788' }, 'Este NIF não é válido. Confirme os algarismos.'],
      [{ p_nif: '999999990' }, 'Indique o NIF da entidade: o NIF de consumidor final não serve para faturas a empresas.'],
      [{ p_morada: 'R' }, 'Indique a morada fiscal (3 a 200 carateres).'],
      [{ p_codigo_postal: '4200187' }, 'O código postal tem o formato 0000-000.'],
      [{ p_localidade: ' ' }, 'Indique a localidade.'],
      [{ p_email: 'sem-arroba' }, 'Indique um email válido para as faturas.'],
    ]
    for (const [mudanca, mensagem] of casos) expect(await falha(() => rpc(dono, 'guardar_dados_faturacao', { ...base, ...mudanca }))).toEqual({ codigo: '22023', mensagem })
    const ipss = await m.lar('ipss-dados', { natureza: 'ipss', dados: null })
    expect(await falha(() => rpc(ipss, 'guardar_dados_faturacao', base))).toEqual({ codigo: '22023', mensagem: 'As IPSS e Misericórdias não têm custos.' })
    const outra = await criarConta(db, null, 'familia', false)
    expect(await falha(() => rpc(outra, 'guardar_dados_faturacao', base))).toEqual({ codigo: '42501', mensagem: 'Só a instituição pode alterar os dados de faturação.' })
    expect(await falha(() => rpc({ sub: dono, claims: { is_anonymous: true } }, 'guardar_dados_faturacao', base))).toMatchObject({ codigo: '42501' })
    expect((await falha(() => rpc('anon', 'guardar_dados_faturacao', base)))?.mensagem).toMatch(/permission denied/)
    expect(await falha(() => rpc(outra, 'faturacao_resumo'))).toEqual({ codigo: '42501', mensagem: 'Só a instituição pode ver a faturação.' })
    expect(await adm('select count(*)::int n from public.dados_faturacao')).toEqual([{ n: 0 }])
  })

  it('IPSS/Misericórdia: isenta e o resto vazio', async () => {
    const dono = await m.lar('misericordia-x', { natureza: 'misericordia' })
    await entradaLar('misericordia-x', 5, { taxa: 'isenta' })
    const r = await rpc(dono, 'faturacao_resumo')
    expect(r).toMatchObject({ isenta: true, plano: null, contrato: null, dados: null, metodo: null, entradas: [], faturas: [], proxima: { linhas: [], total_centimos: 0, debito_em: null } })
    expect(r.proxima.data).toMatch(/^\d{4}-\d{2}-01$/)
  })

  it('próxima cobrança com a taxa e o IVA do contrato (Madeira, 22 %), entradas por estado e faturas sem rascunhos', async () => {
    const dono = await m.lar('lar-madeira', { ...LAR_SEPA, dados: { ...DADOS_LAR, codigo_postal: '9000-100', localidade: 'Funchal' } })
    await adm(`insert into public.contratos (instituicao_id, referencia, taxa_entrada_centimos, iva_percent, regiao_fiscal, inicio, notas)
               values ('lar-madeira', 'CT-M2026-001', 20000, 22, 'madeira', current_date - 400, 'Desconto de lançamento')`)
    const e1 = await entradaLar('lar-madeira', 10)
    const e2 = await entradaFamilia('lar-madeira', 3)
    const r = await rpc(dono, 'faturacao_resumo')
    expect(r.contrato).toEqual({ referencia: 'CT-M2026-001', taxa_entrada_centimos: 20000, iva_percent: 22, regiao_fiscal: 'madeira', inicio: expect.any(String), fim: null })
    expect(r.contrato).not.toHaveProperty('notas')
    expect(r.metodo).toMatchObject({ tipo: 'sepa_debit', ultimos4: '3000', mandato_ref: 'M-1' })
    expect(r.proxima).toMatchObject({ subtotal_centimos: 20000, iva_centimos: 4400, total_centimos: 24400, linhas: [{ candidatura_id: e1, valor_centimos: 20000, iva_percent: 22, iva_centimos: 4400, total_centimos: 24400, documento_numero: null }] })
    expect(r.proxima.debito_em).toMatch(/^\d{4}-\d{2}-04$/)
    const porId = Object.fromEntries(r.entradas.map((e: { candidatura_id: string }) => [e.candidatura_id, e]))
    expect(porId[e1]).toMatchObject({ estado: 'faturavel', contestavel_ate: null, contestacao: null })
    expect(porId[e2]).toMatchObject({ estado: 'a_aguardar', faturavel_desde: null })
    expect(Date.parse(porId[e2].contestavel_ate)).toBe(Date.parse(fimContestacao(em(-3 * DIA))))
    // a linha reservada usa o contrato; um rascunho de cobrança não aparece
    await reservar()
    expect(await adm('select valor_centimos, iva_percent, iva_centimos, total_centimos from public.fatura_linhas')).toEqual([{ valor_centimos: 20000, iva_percent: 22, iva_centimos: 4400, total_centimos: 24400 }])
    const [d] = await pendentes()
    await emitir(d!, 'FT F2026/1')
    await bd.rpc('servico_preparar_cobrancas', { p_modo: 'fatura_por_entrada', p_agora: em(30 * DIA), p_limite: 50 })
    expect((await rpc(dono, 'faturacao_resumo')).faturas).toEqual([])
    expect((await adm<{ ctx: { contrato: unknown; iva_percent: number } }>("select public.servico_contexto_instituicao('lar-madeira') ctx"))[0]!.ctx).toMatchObject({
      contrato: { referencia: 'CT-M2026-001', taxa_entrada_centimos: 20000, iva_percent: 22, regiao_fiscal: 'madeira' }, iva_percent: 22,
    })
  })

  it('contratos: sem períodos sobrepostos no mesmo lar; IVA coerente com a região', async () => {
    await m.lar('lar-contratos')
    await adm("insert into public.contratos (instituicao_id, referencia, inicio, fim) values ('lar-contratos', 'CT-1', '2026-01-01', '2026-06-30')")
    await expect(adm("insert into public.contratos (instituicao_id, referencia, inicio) values ('lar-contratos', 'CT-2', '2026-06-30')")).rejects.toThrow(/Já há um contrato/)
    await adm("insert into public.contratos (instituicao_id, referencia, inicio) values ('lar-contratos', 'CT-3', '2026-07-01')")
    await expect(adm("insert into public.contratos (instituicao_id, referencia, inicio, fim, iva_percent, regiao_fiscal) values ('lar-contratos', 'CT-4', '2020-01-01', '2020-12-31', 23, 'acores')")).rejects.toThrow(/contratos_iva_da_regiao/)
  })
})

// ————————————————————————————————————————————————————————————— contestações

describe('contestar_entrada, resolver_contestacao e marcar_entrada', () => {
  it('regras da contestação, cada uma com a sua mensagem', async () => {
    const dono = await m.lar('lar-contesta')
    const outro = await m.lar('lar-outro')
    const ok = await entradaFamilia('lar-contesta', 3)
    const doLar = await entradaLar('lar-contesta', 3)
    const fora = await entradaFamilia('lar-contesta', 15)
    const incluida = cand()
    await m.entrada({ candidatura_id: incluida, instituicao_id: 'lar-contesta', pedido_criado_em: em(-30 * DIA), entrada_data: '2026-01-02', lar_em: null, familia_em: em(-DIA), taxa: 'incluida' })
    const motivo = 'A pessoa não chegou a entrar no lar.'
    const tentar = (quem: Quem, id: string, mot = motivo) => falha(() => rpc(quem, 'contestar_entrada', { p_candidatura_id: id, p_motivo: mot }))
    expect(await tentar(outro, ok)).toEqual({ codigo: '42501', mensagem: 'Sem permissão para gerir esta instituição.' })
    expect(await tentar(dono, cand())).toEqual({ codigo: 'P0002', mensagem: 'Pedido não encontrado.' })
    expect(await tentar(dono, doLar)).toEqual({ codigo: '22023', mensagem: 'A instituição já registou esta entrada: não pode ser contestada.' })
    expect(await tentar(dono, incluida)).toEqual({ codigo: '22023', mensagem: 'Só se contestam entradas com taxa por entrada.' })
    expect(await tentar(dono, fora)).toEqual({ codigo: '22023', mensagem: `O prazo para contestar terminou a ${dataLonga(fimContestacao(em(-15 * DIA)))}.` })
    expect(await tentar(dono, ok, 'curto')).toEqual({ codigo: '22023', mensagem: 'Explique o motivo (entre 10 e 1000 carateres).' })
    expect(await tentar({ sub: dono, claims: { is_anonymous: true } }, ok)).toMatchObject({ codigo: '42501' })
    expect((await tentar('anon', ok))?.mensagem).toMatch(/permission denied/)
    const r = await rpc(dono, 'contestar_entrada', { p_candidatura_id: ok, p_motivo: motivo })
    expect(r).toEqual({ candidatura_id: ok, estado: 'aberta', contestada_em: expect.any(String) })
    expect(await tentar(dono, ok)).toEqual({ codigo: '22023', mensagem: 'Esta entrada já foi contestada.' })
    // avisa o lar (sem dados pessoais) e não deixa rasto no histórico que a família lê
    const [n] = await adm<{ titulo: string; texto: string; link: string }>("select titulo, texto, link from public.notificacoes where user_id = $1 and titulo = 'Contestação recebida'", [dono])
    expect(n).toMatchObject({ link: '/gestao/faturacao', texto: expect.stringMatching(/pedido EL-C\d{7}/) })
    expect(n!.texto).not.toContain(PERFIL_SENSIVEL.nome)
    expect(await adm('select count(*)::int n from public.candidatura_eventos where candidatura_id = $1', [ok])).toEqual([{ n: 0 }])
    // a família não lê a contestação; o lar lê a sua; outro lar não
    expect(await q(db, dono, 'select estado, motivo from public.contestacoes_entrada')).toEqual([{ estado: 'aberta', motivo }])
    expect(await q(db, outro, 'select 1 from public.contestacoes_entrada')).toEqual([])
    // já faturada: não se contesta
    const faturada = await entradaFamilia('lar-contesta', 2)
    await adm(`insert into public.fatura_linhas (instituicao_id, candidatura_id, referencia, entrada_data, faturavel_desde, valor_centimos, iva_percent, iva_centimos)
               values ('lar-contesta', $1, 'EL-AAAAAAAA', current_date, now(), 15000, 23, 3450)`, [faturada])
    expect(await tentar(dono, faturada)).toEqual({ codigo: '22023', mensagem: 'Esta entrada já foi faturada.' })
  })

  it('aberta → não se fatura; aceite → dispensada (nunca); rejeitada → faturável desde a decisão; retirada quando o lar marca a entrada', async () => {
    const dono = await m.lar('lar-decide', LAR_SEPA)
    const [a, b, c] = [await entradaFamilia('lar-decide', 3), await entradaFamilia('lar-decide', 3), await entradaFamilia('lar-decide', 3)]
    for (const x of [a, b, c]) await rpc(dono, 'contestar_entrada', { p_candidatura_id: x, p_motivo: 'Entrou por outro contacto anterior ao pedido.' })
    // nem depois dos 14 dias uma contestação aberta fatura
    expect(await reservar(30 * DIA)).toEqual({ reservados: 0 })
    // a equipa decide (service_role ou postgres); um cliente não pode
    expect((await falha(() => rpc(dono, 'resolver_contestacao', { p_candidatura_id: a, p_decisao: 'aceite', p_nota: null })))?.mensagem).toMatch(/permission denied/)
    expect(await bd.rpc('resolver_contestacao', { p_candidatura_id: a, p_decisao: 'aceite', p_nota: 'Confirmado com a família.' })).toEqual({ candidatura_id: a, estado: 'aceite', resolvida_em: expect.any(String) })
    expect(await bd.rpc('resolver_contestacao', { p_candidatura_id: a, p_decisao: 'aceite', p_nota: null })).toMatchObject({ estado: 'aceite' })
    expect(await falha(() => bd.rpc('resolver_contestacao', { p_candidatura_id: a, p_decisao: 'rejeitada', p_nota: null }))).toEqual({ codigo: '22023', mensagem: 'A contestação já foi resolvida.' })
    expect(await falha(() => bd.rpc('resolver_contestacao', { p_candidatura_id: a, p_decisao: 'retirada' as 'aceite', p_nota: null }))).toEqual({ codigo: '22023', mensagem: 'Decisão inválida: aceite ou rejeitada.' })
    expect(await falha(() => bd.rpc('resolver_contestacao', { p_candidatura_id: cand(), p_decisao: 'aceite', p_nota: null }))).toEqual({ codigo: 'P0002', mensagem: 'Contestação não encontrada.' })
    await bd.rpc('resolver_contestacao', { p_candidatura_id: b, p_decisao: 'rejeitada', p_nota: 'A família enviou o comprovativo.' })
    // o lar marca "Entrou" na terceira: a contestação fica retirada e a entrada fatura desde a marcação
    await adm("update public.candidaturas set entrada_data = current_date where id = $1", [c])
    await q(db, dono, 'select public.marcar_entrada($1, current_date)', [c])
    expect(await adm('select candidatura_id, estado, nota_resolucao from public.contestacoes_entrada order by contestada_em, candidatura_id')).toEqual(
      expect.arrayContaining([{ candidatura_id: c, estado: 'retirada', nota_resolucao: 'A instituição registou a entrada.' }]),
    )
    const estados = Object.fromEntries((await rpc(dono, 'faturacao_resumo')).entradas.map((e: { candidatura_id: string; estado: string }) => [e.candidatura_id, e.estado]))
    expect(estados).toEqual({ [a]: 'dispensada', [b]: 'faturavel', [c]: 'faturavel' })
    expect(await reservar()).toEqual({ reservados: 2 })
    expect((await adm<{ c: string }>('select candidatura_id c from public.fatura_linhas order by ordem')).map((x) => x.c).sort()).toEqual([b, c].sort())
    // avisos ao lar
    expect((await adm<{ titulo: string }>('select titulo from public.notificacoes where user_id = $1 order by id', [dono])).map((x) => x.titulo)).toEqual(
      expect.arrayContaining(['Contestação aceite', 'Contestação recusada']),
    )
  })
})

// ————————————————————————————————————————————————————————————— cobranças

describe('cobranças das entradas (dia 1)', () => {
  it('só entram linhas com a FT já emitida; uma cobrança que ficou em rascunho é devolvida outra vez (retoma)', async () => {
    await m.lar('lar-retoma', LAR_SEPA)
    await entradaLar('lar-retoma', 10)
    await entradaLar('lar-retoma', 9)
    await reservar()
    const [a] = await pendentes()
    await emitir(a!, 'FT F2026/1')
    const preparar = () => bd.rpc('servico_preparar_cobrancas', { p_modo: 'fatura_por_entrada', p_agora: em(25 * DIA), p_limite: 50 })
    const c1 = await preparar()
    expect(c1).toHaveLength(1)
    expect(c1[0]!.linhas.map((l) => l.documento_numero)).toEqual(['FT F2026/1'])
    // a função caiu antes de servico_cobranca_criada: no dia seguinte a mesma fatura volta (e só ela)
    const c2 = await preparar()
    expect(c2.map((x) => x.fatura_id)).toEqual([c1[0]!.fatura_id])
    // a segunda FT emitida mais tarde não entra numa segunda cobrança do mesmo mês (fica para o mês seguinte)
    const [b] = await pendentes(H)
    await emitir(b!, 'FT F2026/2')
    await bd.rpc('servico_cobranca_criada', { p_fatura_id: c1[0]!.fatura_id, p_stripe_invoice_id: 'in_r1', p_numero: 'EL-1', p_url: 'https://invoice.stripe.com/i/in_r1', p_cobranca: 'debito_automatico', p_debito_em: em(28 * DIA) })
    expect(await preparar()).toEqual([])
    expect(await bd.rpc('servico_preparar_cobrancas', { p_modo: 'fatura_por_entrada', p_agora: em(60 * DIA), p_limite: 50 })).toEqual([
      expect.objectContaining({ linhas: [expect.objectContaining({ documento_numero: 'FT F2026/2' })] }),
    ])
    // ligar a outra fatura do Stripe é recusado; o finalized de um duplicado (metadata.fatura_id) alerta
    expect(await falha(() => bd.rpc('servico_cobranca_criada', { p_fatura_id: c1[0]!.fatura_id, p_stripe_invoice_id: 'in_r2', p_numero: null, p_url: null, p_cobranca: 'debito_automatico', p_debito_em: null }))).toEqual({
      codigo: '22023', mensagem: 'A fatura já está ligada a outra cobrança do Stripe.',
    })
    await aplicar([{ op: 'fatura_estado', stripe_invoice_id: 'in_r2', fatura_id: c1[0]!.fatura_id, origem: 'entradas', estado: 'emitida', em: em(0), url: null, numero: null, motivo: null, metodo: null, total_centimos: null, subscricao: null }])
    expect(await adm("select tipo, ref from private.alertas_faturacao where tipo = 'fatura_duplicada'")).toEqual([{ tipo: 'fatura_duplicada', ref: 'in_r2' }])
    // o dono é avisado da cobrança (com o valor e o dia do débito)
    expect(await adm("select texto from public.notificacoes where titulo like 'Cobrança de %'")).toEqual([{ texto: expect.stringMatching(/^184,50 € por débito direto a \d+ de [a-zç]+ de \d{4}\. As faturas estão em Faturação\.$/) }])
  })

  it('modo fatura_mensal: linhas nascem na cobrança, uma FT global na fila e o RC quando paga', async () => {
    await m.lar('lar-mensal-ft', LAR_SEPA)
    await entradaLar('lar-mensal-ft', 10)
    await entradaLar('lar-mensal-ft', 9)
    expect(await bd.rpc('servico_reservar_documentos', { p_modo: 'fatura_mensal', p_agora: em(0), p_limite: 50 })).toEqual({ reservados: 0 })
    const [c] = await bd.rpc('servico_preparar_cobrancas', { p_modo: 'fatura_mensal', p_agora: em(25 * DIA), p_limite: 50 })
    expect(c).toMatchObject({ subtotal_centimos: 30000, iva_centimos: 6900, total_centimos: 36900, linhas: [{ documento_numero: null }, { documento_numero: null }] })
    const [ft] = await pendentes(25 * DIA)
    expect(ft).toMatchObject({ tipo: 'FT', chave: `FT:${c!.fatura_id}`, fatura_id: c!.fatura_id, total_centimos: 36900, iva_centimos: 6900 })
    expect(ft!.linhas).toHaveLength(2)
    await emitir(ft!, 'FT F2026/1')
    await bd.rpc('servico_cobranca_criada', { p_fatura_id: c!.fatura_id, p_stripe_invoice_id: 'in_g1', p_numero: 'EL-9', p_url: null, p_cobranca: 'debito_automatico', p_debito_em: em(28 * DIA) })
    await aplicar([{ op: 'fatura_estado', stripe_invoice_id: 'in_g1', fatura_id: null, origem: 'entradas', estado: 'paga', em: em(30 * DIA), url: null, numero: null, motivo: null, metodo: 'sepa_debit', total_centimos: 36900, subscricao: null }])
    const [rc] = await pendentes(30 * DIA)
    expect(rc).toMatchObject({ tipo: 'RC', total_centimos: 36900, documentos_associados: [{ documento_id: ft!.id, numero: 'FT F2026/1', total_centimos: 36900 }], pagamento: { metodo: 'sepa_debit', valor_centimos: 36900 } })
  })

  it('modo fatura_recibo_mensal: uma FR com as linhas quando a cobrança é paga', async () => {
    await m.lar('lar-fr', LAR_SEPA)
    await entradaLar('lar-fr', 10)
    const [c] = await bd.rpc('servico_preparar_cobrancas', { p_modo: 'fatura_recibo_mensal', p_agora: em(25 * DIA), p_limite: 50 })
    expect(await pendentes(25 * DIA)).toEqual([])
    await bd.rpc('servico_cobranca_criada', { p_fatura_id: c!.fatura_id, p_stripe_invoice_id: 'in_fr1', p_numero: null, p_url: null, p_cobranca: 'debito_automatico', p_debito_em: em(28 * DIA) })
    await bd.rpc('servico_cobranca_debito_iniciado', { p_fatura_id: c!.fatura_id, p_estado: 'paga', p_motivo: null, p_em: em(28 * DIA) })
    const [fr] = await pendentes(28 * DIA)
    expect(fr).toMatchObject({ tipo: 'FR', origem: 'entradas', chave: `FR:${c!.fatura_id}`, total_centimos: 18450, iva_centimos: 3450, pagamento: { metodo: 'sepa_debit', valor_centimos: 18450 } })
    expect(fr!.linhas).toEqual([{ tipo: 'entrada', referencia: expect.stringMatching(/^EL-/), entrada_data: expect.any(String), valor_centimos: 15000, iva_percent: 23 }])
  })

  it('modo desconhecido, fase desconhecida e débito inválido: 22023', async () => {
    expect((await falha(() => bd.rpc('servico_reservar_documentos', { p_modo: 'tudo' as 'fatura_mensal', p_agora: em(0), p_limite: 1 })))?.codigo).toBe('22023')
    expect((await falha(() => bd.rpc('servico_preparar_cobrancas', { p_modo: 'tudo' as 'fatura_mensal', p_agora: em(0), p_limite: 1 })))?.codigo).toBe('22023')
    expect((await falha(() => bd.rpc('servico_iniciar_execucao', { p_fase: 'tudo' as 'diario', p_duracao_segundos: 1 })))?.codigo).toBe('22023')
    expect((await falha(() => bd.rpc('servico_cobranca_debito_iniciado', { p_fatura_id: cand(), p_estado: 'anulada' as 'paga', p_motivo: null, p_em: em(0) })))?.codigo).toBe('22023')
  })
})

