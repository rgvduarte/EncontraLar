/**
 * De ponta a ponta com as Edge Functions VERDADEIRAS (os handlers puros de supabase/functions/_shared/funcoes) a
 * falar com o SQL verdadeiro (PGlite) pelas portas do contrato: BDPGlite (chave de serviço) e UtilizadorPGlite
 * (JWT: RLS e auth.uid()). Stripe e emissor falsos (sem rede), eventos do webhook assinados com o pacote stripe.
 *
 * É a prova de que as funções funcionam contra a base de dados real: Acesso Família (cartão, Multibanco,
 * reembolso), lar por entrada (dados fiscais, mandato, entradas pelo fluxo real, contestação, FT, cobrança,
 * débito, RC) e lar com mensalidade (subscrição, FT e RC, compromisso). E que nada de saúde sai.
 */
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type Stripe from 'stripe'
import { CONSENTIMENTO_ACESSO } from '../functions/_shared/faturacao/planos.ts'
import { EmissorFalso } from '../functions/_shared/faturacao/emissor.ts'
import { proximoDiaUm } from '../functions/_shared/faturacao/datas.ts'
import { criarHandlerAcessoCheckout } from '../functions/_shared/funcoes/acesso-checkout.ts'
import { criarHandlerFaturacaoCheckout, criarHandlerFaturacaoDocumento } from '../functions/_shared/funcoes/faturacao.ts'
import { CABECALHO_CRON, criarHandlerFaturarMes } from '../functions/_shared/funcoes/faturar-mes.ts'
import { criarHandlerPlanoInstituicao } from '../functions/_shared/funcoes/plano-instituicao.ts'
import { criarHandlerStripeWebhook } from '../functions/_shared/funcoes/stripe-webhook.ts'
import type { UtilizadorSessao } from '../functions/_shared/portas.ts'
import { ORIGEM, SEGREDO_WEBHOOK, sdk, verificador } from './funcoes/cenario.ts'
import { AMBIENTE_TESTE, configTeste, DIA, evento, faturaComPagamento, faturaStripe, paymentIntent, RegistoMemoria, Relogio, sessaoCheckout, StripeFalso } from './funcoes/fakes.ts'
import { BDPGlite, limparBase, UtilizadorPGlite } from './faturacao-bd'
import { acessoDeLinha, faturacaoDeResumo } from '@/lib/supabase-mappers'
import type { Json } from '@/lib/database.types'
import { admin, cenarioBase, criarBase, criarUtilizador, q } from './helpers'

/** O que nunca pode sair para o Stripe ou para o emissor: o perfil de saúde de cenarioBase e o contacto. */
const SENSIVEIS = ['Alzheimer', 'VIH', 'psiquiátrico', 'demencia', 'paliativos', '912 000 000', 'fam@teste.pt']

function montar(db: PGlite) {
  const relogio = new Relogio(Date.now())
  const bd = new BDPGlite(db)
  const stripe = new StripeFalso()
  const emissor = new EmissorFalso({ agora: relogio.fn })
  const registo = new RegistoMemoria()
  const config = configTeste()
  const agendados: Promise<unknown>[] = []
  let sessao: UtilizadorSessao | null = null
  const utilizadorDe = () => new UtilizadorPGlite(db, sessao)
  const comuns = { config, registo, agora: relogio.fn }
  const agendar = (p: Promise<unknown>) => void agendados.push(p)
  const h = {
    acessoCheckout: criarHandlerAcessoCheckout({ ...comuns, bd, stripe, utilizadorDe }),
    faturacaoCheckout: criarHandlerFaturacaoCheckout({ ...comuns, bd, stripe, utilizadorDe }),
    faturacaoDocumento: criarHandlerFaturacaoDocumento({ ...comuns, bd, emissor, utilizadorDe }),
    planoInstituicao: criarHandlerPlanoInstituicao({ ...comuns, bd, stripe, utilizadorDe }),
    webhook: criarHandlerStripeWebhook({ ...comuns, bd, stripe, emissor, verificador, agendar }),
    faturarMes: criarHandlerFaturarMes({ ...comuns, bd, stripe, emissor, agendar }),
  }
  const esperar = async () => {
    while (agendados.length) await agendados.shift()
  }
  const pedidoApp = (corpo: unknown) =>
    new Request('https://abcdefghijklmnop.supabase.co/functions/v1/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGEM, authorization: 'Bearer jwt', 'x-forwarded-for': '203.0.113.57, 10.0.0.1' },
      body: JSON.stringify(corpo),
    })
  const como = (id: string | null) => {
    sessao = id ? { id, email: null, anonimo: false } : null
  }
  async function entregar(e: Stripe.Event) {
    const assinatura = sdk.webhooks.generateTestHeaderString({ payload: JSON.stringify(e), secret: SEGREDO_WEBHOOK, timestamp: Math.floor(relogio.agora / 1000) })
    const r = await h.webhook(new Request('https://x/functions/v1/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': assinatura }, body: JSON.stringify(e) }))
    await esperar()
    return r
  }
  async function cron(fase: 'diario' | 'cobranca') {
    const r = await h.faturarMes(new Request('https://x/functions/v1/faturar-mes', { method: 'POST', headers: { [CABECALHO_CRON]: AMBIENTE_TESTE.FATURACAO_CRON_SECRET! }, body: JSON.stringify({ fase }) }))
    await esperar()
    return r
  }
  /** Tudo o que saiu para o Stripe e para o emissor, serializado. */
  const saidas = () => JSON.stringify({ stripe: stripe.chamadas, emissor: emissor.documentos() })
  return { relogio, bd, stripe, emissor, registo, h, como, pedidoApp, entregar, cron, saidas }
}

const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { erro?: { codigo: string; mensagem: string } }

let db: PGlite

beforeAll(async () => {
  db = await criarBase()
}, 120_000)

// cada teste com a base vazia (o Stripe falso volta a numerar as sessões e os clientes em cada teste)
beforeEach(async () => {
  await limparBase(db)
})

afterAll(async () => {
  await db.close()
})

describe('Acesso Família de ponta a ponta (acesso-checkout → Stripe → stripe-webhook → SQL)', () => {
  it('cartão: acesso de 30 dias, um só aviso, Fatura-Recibo emitida e visível só à família', async () => {
    const c = montar(db)
    const fam = await criarUtilizador(db, { email: 'compra-cartao@teste.pt', roleAdmin: 'familia' })
    c.como(fam)
    const r = await c.h.acessoCheckout(c.pedidoApp({ plano: 'acesso_30', consentimento: { versao: CONSENTIMENTO_ACESSO.versao, aceite: true } }))
    expect(r.status).toBe(200)
    const { pagamento_id } = (await json(r)) as { pagamento_id: string }
    const sessao = [...c.stripe.sessoes.keys()].at(-1)!
    expect(await admin(db, 'select estado, stripe_checkout_session_id, valor_centimos from public.pagamentos_familia where id = $1', [pagamento_id])).toEqual([
      { estado: 'pendente', stripe_checkout_session_id: sessao, valor_centimos: 1490 },
    ])
    expect(await admin(db, 'select texto_versao, ip_truncado from public.consentimentos_acesso where pagamento_id = $1', [pagamento_id])).toEqual([
      { texto_versao: CONSENTIMENTO_ACESSO.versao, ip_truncado: '203.0.113.0' },
    ])

    c.stripe.paymentIntents.set('pi_ok', paymentIntent({ id: 'pi_ok', tipo: 'card', pagamentoId: pagamento_id }))
    const pago = evento('checkout.session.completed', sessaoCheckout({ id: sessao, pagamentoId: pagamento_id, payment_intent: 'pi_ok', amount_total: 1490 }), { created: Math.floor(c.relogio.agora / 1000) })
    expect((await c.entregar(pago)).status).toBe(200)
    // a repetição do Stripe não estende duas vezes
    expect(await json(await c.entregar(pago))).toMatchObject({ estado: 'repetido' })

    const [estado] = await q<{ e: Record<string, unknown> }>(db, fam, 'select public.acesso_estado() as e')
    const e = estado!.e as { completo: boolean; ativo: boolean; plano: string; ate: string; pagamentos: Record<string, unknown>[] }
    expect(e).toMatchObject({ completo: true, ativo: true, plano: 'acesso_30' })
    expect(Math.round((Date.parse(e.ate) - Date.now()) / DIA)).toBe(30)
    expect(e.pagamentos).toHaveLength(1)
    expect(e.pagamentos[0]).toMatchObject({ id: pagamento_id, estado: 'pago', metodo: 'card', valor_centimos: 1490, motivo_falha: null, documento: { numero: 'FR F2026/1' } })
    expect(e.pagamentos[0]).not.toHaveProperty('multibanco')
    expect(await admin(db, "select count(*)::int n from public.notificacoes where user_id = $1 and titulo = 'Acesso Família ativo'", [fam])).toEqual([{ n: 1 }])
    expect(c.emissor.documentos()[0]).toMatchObject({ tipo: 'FR', totalCentimos: 1490, ivaCentimos: 279 })
    // o mapper da app lê o que o SQL devolve
    expect(acessoDeLinha(e as unknown as Json).pagamentos[0]).toMatchObject({ estado: 'pago', metodo: 'card', valorCentimos: 1490, documento: { numero: 'FR F2026/1' } })

    // a família pede o PDF da sua FR (o RLS prova a posse); outra família não a vê
    const doc = (e.pagamentos[0]!.documento as { id: string }).id
    expect((await c.h.faturacaoDocumento(c.pedidoApp({ documento_id: doc }))).status).toBe(200)
    c.como(await criarUtilizador(db, { email: 'outra-familia@teste.pt', roleAdmin: 'familia' }))
    expect((await c.h.faturacaoDocumento(c.pedidoApp({ documento_id: doc }))).status).toBe(404)
  })

  it('Multibanco: referência na página, acesso só quando pago (soma aos dias em vigor); reembolso marca sem encurtar', async () => {
    const c = montar(db)
    const fam = await criarUtilizador(db, { email: 'compra-mb@teste.pt', roleAdmin: 'familia', acesso: true })
    const ateAntes = (await admin<{ ate: Date }>(db, 'select ate from public.acessos_familia where user_id = $1', [fam]))[0]!.ate.getTime()
    c.como(fam)
    const r = await c.h.acessoCheckout(c.pedidoApp({ plano: 'acesso_90', consentimento: { versao: CONSENTIMENTO_ACESSO.versao, aceite: true }, fatura: { nif: '123456789', nome: 'Ana Silva' } }))
    const { pagamento_id } = (await json(r)) as { pagamento_id: string }
    const sessao = [...c.stripe.sessoes.keys()].at(-1)!
    // o NIF vai para a Fatura-Recibo, nunca ao Stripe
    expect(c.saidas()).not.toContain('123456789')

    const expira = Math.floor(c.relogio.agora / 1000) + 3 * 86400
    c.stripe.paymentIntents.set('pi_mb', paymentIntent({ id: 'pi_mb', tipo: 'multibanco', pagamentoId: pagamento_id, multibanco: { entity: '11249', reference: '123456789', expires_at: expira } }))
    await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: sessao, pagamentoId: pagamento_id, payment_status: 'unpaid', payment_intent: 'pi_mb', amount_total: 2990 })))
    const estado = async () => (await q<{ e: { ate: string; pagamentos: Record<string, unknown>[] } }>(db, fam, 'select public.acesso_estado() as e'))[0]!.e
    expect((await estado()).pagamentos[0]).toMatchObject({ estado: 'a_aguardar_pagamento', metodo: 'multibanco', multibanco: { entidade: '11249', referencia: '123456789' } })
    expect(Date.parse((await estado()).ate)).toBe(ateAntes)

    c.relogio.avancar(2 * DIA)
    await c.entregar(evento('checkout.session.async_payment_succeeded', sessaoCheckout({ id: sessao, pagamentoId: pagamento_id, payment_intent: 'pi_mb', amount_total: 2990 }), { created: Math.floor(c.relogio.agora / 1000) }))
    const depois = await estado()
    expect(depois.pagamentos[0]).toMatchObject({ estado: 'pago', documento: { numero: 'FR F2026/1' } })
    // novoAte: soma ao fim em vigor (90 dias do passe que já tinha + 90)
    expect(Date.parse(depois.ate) - ateAntes).toBe(90 * DIA)
    expect(await admin(db, 'select cliente, pagamento from public.documentos_fiscais where pagamento_id = $1', [pagamento_id])).toEqual([
      { cliente: { tipo: 'particular', nif: '123456789', nome: 'Ana Silva' }, pagamento: { metodo: 'multibanco', data: expect.any(String), valor_centimos: 2990 } },
    ])

    await c.entregar(evento('charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: 'pi_mb', amount: 2990, amount_refunded: 2990, refunded: true }))
    expect((await estado()).pagamentos[0]).toMatchObject({ estado: 'reembolsado' })
    expect((await estado()).ate).toBe(depois.ate)
    expect(await admin(db, "select tipo, ref from private.alertas_faturacao where tipo = 'reembolso' and ref = $1", [pagamento_id])).toEqual([{ tipo: 'reembolso', ref: pagamento_id }])
  })

  it('uma conta de lar ou anónima não compra (403 com a mensagem da BD ou da função)', async () => {
    const c = montar(db)
    c.como(await criarUtilizador(db, { email: 'lar-que-compra@teste.pt', roleAdmin: 'lar' }))
    const r = await c.h.acessoCheckout(c.pedidoApp({ plano: 'acesso_30', consentimento: { versao: CONSENTIMENTO_ACESSO.versao, aceite: true } }))
    expect(r.status).toBe(403)
    expect((await json(r)).erro).toEqual({ codigo: 'sem_permissao', mensagem: 'O Acesso Família é para contas de família.' })
    expect(c.stripe.chamadas).toHaveLength(0)
  })
})

describe('lar privado por entrada de ponta a ponta (faturacao-checkout, entradas reais, contestação, faturar-mes, webhook)', () => {
  it('dados fiscais → mandato SEPA → entradas → FT → contestação → cobrança no dia 1 → débito → paga → RC; nada de saúde sai', async () => {
    const c = montar(db)
    const b = await cenarioBase(db, { sufixo: 'fat', livres: { individual: 3, duplo: 3 } })
    c.como(b.lar)
    // sem dados fiscais: 409
    expect((await json(await c.h.faturacaoCheckout(c.pedidoApp({})))).erro?.codigo).toBe('dados_em_falta')
    await q(db, b.lar, "select public.guardar_dados_faturacao('Lar Real, Lda.', 'PT 599 999 993', 'Rua das Camélias 128', '4200-187', 'Porto', 'faturas@lar-real.pt')")
    const r = await c.h.faturacaoCheckout(c.pedidoApp({}))
    expect(r.status).toBe(200)
    const [{ cus }] = await admin<{ cus: string }>(db, 'select stripe_customer_id as cus from public.dados_faturacao where instituicao_id = $1', [b.instituicao])
    expect(cus).toMatch(/^cus_/)
    c.stripe.setupIntents.set('seti_1', {
      id: 'seti_1', customer: cus, metadata: { instituicao_id: b.instituicao },
      payment_method: { id: 'pm_sepa', type: 'sepa_debit', sepa_debit: { last4: '3000', bank_code: '0002' } },
      mandate: { id: 'mandate_1', payment_method_details: { sepa_debit: { reference: 'MANDATO-1' } } },
    } as unknown as Stripe.SetupIntent)
    await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: 'cs_setup', mode: 'setup', setup_intent: 'seti_1', customer: cus, instituicaoId: b.instituicao })))
    const resumo = async () => (await q<{ r: Record<string, any> }>(db, b.lar, 'select public.faturacao_resumo() as r'))[0]!.r // eslint-disable-line @typescript-eslint/no-explicit-any
    expect((await resumo()).metodo).toMatchObject({ tipo: 'sepa_debit', ultimos4: '3000', mandato_ref: 'MANDATO-1' })

    // duas entradas pelo fluxo real: o lar marca a primeira; a segunda só a família confirma e o lar contesta-a
    const pedido = async (perfil: string) => {
      const [x] = await q<{ id: string }>(db, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, perfil])
      await q(db, b.lar, 'select public.aceitar_candidatura($1)', [x!.id])
      await q(db, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [x!.id])
      await q(db, b.familia, 'select public.responder_vaga($1, true)', [x!.id])
      return x!.id
    }
    const e1 = await pedido(b.perfil)
    await q(db, b.lar, 'select public.marcar_entrada($1, current_date)', [e1])
    const [p2] = await q<{ id: string }>(db, b.familia, `insert into public.perfis_cuidados (nome, idade, relacao, genero, grau, necessidades, quarto, local_label, local_lat, local_lng, notas)
      values ('Joaquim', 88, 'Pai', 'M', 'moderada', '{demencia}', 'duplo', 'Porto', 41.1, -8.6, 'Alzheimer inicial; VIH+') returning id`)
    const e2 = await pedido(p2!.id)
    await q(db, b.familia, 'select public.confirmar_entrada_familia($1, current_date)', [e2])
    await q(db, b.lar, "select public.contestar_entrada($1, 'A pessoa não chegou a entrar: desistiu à porta.')", [e2])

    // tarefa diária: só a entrada marcada pelo lar fatura (a contestada espera pela equipa)
    expect((await c.cron('diario')).status).toBe(202)
    expect(c.emissor.documentos().map((d) => [d.tipo, d.numero, d.totalCentimos])).toEqual([['FT', 'FT F2026/1', 18450]])
    expect((await resumo()).entradas.map((x: { candidatura_id: string; estado: string }) => [x.candidatura_id, x.estado]).sort()).toEqual(
      [[e1, 'faturada'], [e2, 'contestada']].sort(),
    )

    // a equipa rejeita a contestação: fatura-se desde a decisão
    expect(await c.bd.rpc('resolver_contestacao', { p_candidatura_id: e2, p_decisao: 'rejeitada', p_nota: 'A família enviou o comprovativo.' })).toMatchObject({ estado: 'rejeitada' })
    await c.cron('diario')
    expect(c.emissor.documentos().map((d) => d.numero)).toEqual(['FT F2026/1', 'FT F2026/2'])
    expect((await resumo()).proxima).toMatchObject({ total_centimos: 36900, linhas: [{ documento_numero: 'FT F2026/1' }, { documento_numero: 'FT F2026/2' }] })

    // dia 1, 07:07 UTC: a cobrança do mês (uma fatura Stripe, 2 linhas + IVA)
    const dia1 = Date.parse(proximoDiaUm(c.relogio.agora))
    c.relogio.agora = dia1 + 7 * 3_600_000 + 7 * 60_000
    expect((await c.cron('cobranca')).status).toBe(202)
    const inv = [...c.stripe.faturas.values()][0]!
    expect(inv.itens.map((i) => i.amount)).toEqual([15000, 15000, 6900])
    expect(inv.params).toMatchObject({ collection_method: 'charge_automatically', custom_fields: [{ name: 'Faturas', value: 'FT F2026/1, FT F2026/2' }] })
    const [fat] = await admin<{ id: string; estado: string; debito_em: Date }>(db, "select id, estado, debito_em from public.faturas where instituicao_id = $1 and origem = 'entradas'", [b.instituicao])
    expect(fat).toMatchObject({ estado: 'emitida' })

    // fim do pré-aviso: débito (SEPA fica em processamento); o banco confirma → RC das duas FT
    c.relogio.agora = fat!.debito_em.getTime() + 6 * 3_600_000
    await c.cron('diario')
    expect(c.stripe.chamadasDe('pagarFatura')).toHaveLength(1)
    expect((await admin(db, 'select estado from public.faturas where id = $1', [fat!.id]))[0]).toEqual({ estado: 'em_processamento' })
    c.stripe.faturasComPagamentos.set(inv.id, faturaComPagamento(inv.id, 'sepa_debit'))
    await c.entregar(evento('invoice.paid', faturaStripe({ id: inv.id, total: 36900, faturaId: fat!.id, instituicaoId: b.instituicao }), { created: Math.floor(c.relogio.agora / 1000) }))
    expect(c.emissor.documentos().at(-1)).toMatchObject({ tipo: 'RC', numero: 'RC F2026/1', totalCentimos: 36900 })

    const fim = await resumo()
    expect(fim.faturas).toHaveLength(1)
    expect(fim.faturas[0]).toMatchObject({ estado: 'paga', origem: 'entradas', total_centimos: 36900 })
    expect(fim.faturas[0].documentos.map((d: { tipo: string; numero: string }) => `${d.tipo} ${d.numero}`)).toEqual(['FT FT F2026/1', 'FT FT F2026/2', 'RC RC F2026/1'])
    expect(fim.proxima.linhas).toEqual([])
    const app = faturacaoDeResumo(fim)
    expect(app).toMatchObject({ larId: b.instituicao, isenta: false, porResolver: false, metodo: { tipo: 'sepa_debit', ultimos4: '3000' }, dados: { razaoSocial: 'Lar Real, Lda.', nif: '599999993' } })
    expect(app.faturas[0]!.documentos.map((d) => d.tipo)).toEqual(['FT', 'FT', 'RC'])
    expect(app.entradas.map((e) => e.estado)).toEqual(['faturada', 'faturada'])
    expect(app.entradas.find((e) => e.candidaturaId === e2)!.contestacao).toMatchObject({ estado: 'rejeitada', nota: 'A família enviou o comprovativo.' })
    // o lar pede o PDF do recibo; a família não o vê
    const rc = fim.faturas[0].documentos.at(-1).id
    expect((await c.h.faturacaoDocumento(c.pedidoApp({ documento_id: rc }))).status).toBe(200)
    c.como(b.familia)
    expect((await c.h.faturacaoDocumento(c.pedidoApp({ documento_id: rc }))).status).toBe(404)

    // minimização: nem o Stripe nem o emissor receberam dados de saúde, nomes ou contactos
    const saiu = c.saidas()
    for (const s of SENSIVEIS) expect(saiu, s).not.toContain(s)
    expect(saiu).not.toContain('Joaquim')
    expect(c.registo.linhas.filter((l) => l.nivel === 'erro')).toEqual([])
  })
})

describe('lar privado com mensalidade de ponta a ponta (plano-instituicao, subscrição, FT e RC)', () => {
  it('muda para a mensalidade, a subscrição gera FT e RC, as entradas ficam incluídas e o compromisso vem da BD', async () => {
    const c = montar(db)
    const b = await cenarioBase(db, { sufixo: 'men' })
    c.como(b.lar)
    await q(db, b.lar, "select public.guardar_dados_faturacao('Lar Mensal, S.A.', '599999993', 'Avenida da Boavista 1', '4100-111', 'Porto', 'contas@lar-mensal.pt')")
    await c.h.faturacaoCheckout(c.pedidoApp({}))
    const [{ cus }] = await admin<{ cus: string }>(db, 'select stripe_customer_id as cus from public.dados_faturacao where instituicao_id = $1', [b.instituicao])
    c.stripe.setupIntents.set('seti_m', {
      id: 'seti_m', customer: cus, metadata: { instituicao_id: b.instituicao },
      payment_method: { id: 'pm_m', type: 'sepa_debit', sepa_debit: { last4: '0154', bank_code: '0035' } },
      mandate: { id: 'mandate_m', payment_method_details: { sepa_debit: { reference: 'MANDATO-M' } } },
    } as unknown as Stripe.SetupIntent)
    await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: 'cs_setup_m', mode: 'setup', setup_intent: 'seti_m', customer: cus, instituicaoId: b.instituicao })))

    const r = await c.h.planoInstituicao(c.pedidoApp({ plano: 'mensal' }))
    expect(r.status).toBe(200)
    expect(await json(r)).toMatchObject({ plano: 'mensal', subscricao: { estado: 'ativa' }, sincronizacao: 'ok' })
    const [sub] = await admin<{ id: string; estado: string }>(db, 'select stripe_subscription_id as id, estado from public.subscricoes_instituicao where instituicao_id = $1', [b.instituicao])
    expect(sub).toMatchObject({ estado: 'ativa' })

    // uma entrada confirmada já na mensalidade é 'incluida' e nunca fatura
    const [x] = await q<{ id: string }>(db, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, b.perfil])
    await q(db, b.lar, 'select public.aceitar_candidatura($1)', [x!.id])
    await q(db, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [x!.id])
    await q(db, b.familia, 'select public.responder_vaga($1, true)', [x!.id])
    await q(db, b.lar, 'select public.marcar_entrada($1, current_date)', [x!.id])
    expect(await admin(db, 'select entrada_taxa from public.candidaturas where id = $1', [x!.id])).toEqual([{ entrada_taxa: 'incluida' }])

    const inicio = Math.floor(c.relogio.agora / 1000)
    const inv = faturaStripe({ id: 'in_sub_e2e', total: 3567, subscricao: { id: sub!.id, inicio, fim: inicio + 30 * 86400, instituicaoId: b.instituicao } })
    await c.entregar(evento('customer.subscription.created', { id: sub!.id, status: 'active', customer: cus, start_date: inicio, metadata: { instituicao_id: b.instituicao } }))
    await c.entregar(evento('invoice.finalized', inv))
    c.stripe.faturasComPagamentos.set('in_sub_e2e', faturaComPagamento('in_sub_e2e', 'sepa_debit'))
    c.relogio.avancar(4 * DIA)
    await c.entregar(evento('invoice.paid', inv, { created: Math.floor(c.relogio.agora / 1000) }))
    await c.cron('diario')
    expect(c.emissor.documentos().map((d) => [d.tipo, d.totalCentimos])).toEqual([['FT', 3567], ['RC', 3567]])

    const [{ r: resumo }] = await q<{ r: Record<string, any> }>(db, b.lar, 'select public.faturacao_resumo() as r') // eslint-disable-line @typescript-eslint/no-explicit-any
    expect(resumo).toMatchObject({ plano: 'mensal', subscricao: { estado: 'ativa' }, proxima: { linhas: [], total_centimos: 0 } })
    expect(resumo.entradas).toEqual([expect.objectContaining({ candidatura_id: x!.id, estado: 'incluida' })])
    expect(resumo.faturas).toEqual([expect.objectContaining({ origem: 'subscricao', estado: 'paga', total_centimos: 3567, documentos: [expect.objectContaining({ tipo: 'FT' }), expect.objectContaining({ tipo: 'RC' })] })])

    // voltar à taxa por entrada antes do fim do compromisso: 409 com a mensagem da BD
    const cedo = await c.h.planoInstituicao(c.pedidoApp({ plano: 'por_entrada' }))
    expect(cedo.status).toBe(409)
    expect((await json(cedo)).erro?.mensagem).toMatch(/^A mensalidade tem um compromisso de 12 meses: pode mudar a partir de \d+ de [a-zç]+ de \d{4}\.$/)
    expect(c.stripe.chamadasDe('cancelarSubscricao')).toHaveLength(0)
  })
})
