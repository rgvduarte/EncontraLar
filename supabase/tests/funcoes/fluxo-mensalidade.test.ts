/**
 * Lares privados: dados de faturação → cliente Stripe e mandato (faturacao-checkout + webhook setup),
 * portal, mudança de modalidade (plano-instituicao) e um mês da mensalidade (subscrição Stripe → FT + RC).
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { compromissoAte, dataLonga } from '../../functions/_shared/faturacao/datas.ts'
import { criarCenario, json, type Cenario } from './cenario.ts'
import { DIA, evento, faturaComPagamento, faturaStripe, sessaoCheckout, T0 } from './fakes.ts'
import type Stripe from 'stripe'

let c: Cenario
const LAR = 'jardins-do-douro'

beforeEach(() => {
  c = criarCenario()
  c.bd.lar(LAR)
  c.comSessao({ sessao: { id: 'u-lar', email: 'gestor@lar.pt', anonimo: false }, instituicaoId: LAR })
})

/** O lar configura o débito direto: faturacao-checkout + o Stripe completa o setup (SEPA). */
async function configurarMandato() {
  const r = await c.handlers.faturacaoCheckout(c.pedidoApp({}))
  expect(r.status).toBe(200)
  const customer = c.bd.instituicoes.get(LAR)!.stripe_customer_id!
  c.stripe.setupIntents.set('seti_1', {
    id: 'seti_1',
    customer,
    metadata: { instituicao_id: LAR },
    payment_method: { id: 'pm_sepa', type: 'sepa_debit', sepa_debit: { last4: '3000', bank_code: '0002' } },
    mandate: { id: 'mandate_1', payment_method_details: { sepa_debit: { reference: 'MANDATO-1' } } },
  } as unknown as Stripe.SetupIntent)
  await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: 'cs_setup', mode: 'setup', setup_intent: 'seti_1', customer, instituicaoId: LAR })))
  return customer
}

describe('faturacao-checkout e portal', () => {
  it('cria o cliente Stripe uma vez e abre o Checkout em modo setup', async () => {
    const r = await c.handlers.faturacaoCheckout(c.pedidoApp({ instituicao_id: 'outro-lar' }))
    expect(r.status).toBe(200)
    expect((await json(r)).url).toMatch(/^https:\/\/checkout\.stripe\.com\//)
    const cus = c.bd.instituicoes.get(LAR)!.stripe_customer_id
    expect(cus).toMatch(/^cus_/)
    expect(c.stripe.chamadasDe('criarCliente')).toHaveLength(1)
    expect(c.stripe.chamadasDe('criarSessaoCheckout')[0]!.params).toMatchObject({ mode: 'setup', customer: cus, metadata: { instituicao_id: LAR } })
    // o id do corpo é ignorado: a posse vem de faturacao_resumo() do próprio utilizador
    expect(JSON.stringify(c.stripe.chamadas)).not.toContain('outro-lar')
  })

  it('segunda vez: atualiza o cliente e troca o tax id só se o NIF mudou', async () => {
    await c.handlers.faturacaoCheckout(c.pedidoApp({}))
    c.relogio.avancar(120_000)
    await c.handlers.faturacaoCheckout(c.pedidoApp({}))
    expect(c.stripe.chamadasDe('criarCliente')).toHaveLength(1)
    expect(c.stripe.chamadasDe('atualizarCliente')).toHaveLength(1)
    expect(c.stripe.chamadasDe('criarTaxId')).toHaveLength(0)
    c.bd.instituicoes.get(LAR)!.dados!.nif = '123456789'
    c.relogio.avancar(120_000)
    await c.handlers.faturacaoCheckout(c.pedidoApp({}))
    expect(c.stripe.chamadasDe('apagarTaxId')).toHaveLength(1)
    expect(c.stripe.chamadasDe('criarTaxId')[0]!.params).toEqual({ type: 'eu_vat', value: 'PT123456789' })
  })

  it('corrida: se outro pedido já guardou um cliente, apaga o duplicado e usa o guardado', async () => {
    const original = c.bd.impl.servico_definir_cliente_stripe
    c.bd.impl.servico_definir_cliente_stripe = (a) => {
      c.bd.instituicoes.get(LAR)!.stripe_customer_id ??= 'cus_primeiro'
      return original(a)
    }
    await c.handlers.faturacaoCheckout(c.pedidoApp({}))
    expect(c.stripe.chamadasDe('apagarCliente')).toHaveLength(1)
    expect(c.stripe.chamadasDe('criarSessaoCheckout')[0]!.params).toMatchObject({ customer: 'cus_primeiro' })
  })

  it('não é dono → 403; IPSS → 409; sem dados de faturação → 409; sem cliente no portal → 409', async () => {
    c.comSessao({ sessao: { id: 'u-familia', email: null, anonimo: false } })
    expect((await c.handlers.faturacaoCheckout(c.pedidoApp({}))).status).toBe(403)
    c.bd.lar('ipss-1', { natureza: 'ipss' })
    c.comSessao({ sessao: { id: 'u-ipss', email: null, anonimo: false }, instituicaoId: 'ipss-1' })
    expect((await json(await c.handlers.faturacaoCheckout(c.pedidoApp({})))).erro?.codigo).toBe('isenta')
    c.bd.lar('sem-dados', { dados: null })
    c.comSessao({ sessao: { id: 'u-2', email: null, anonimo: false }, instituicaoId: 'sem-dados' })
    expect((await json(await c.handlers.faturacaoCheckout(c.pedidoApp({})))).erro?.codigo).toBe('dados_em_falta')
    expect((await json(await c.handlers.faturacaoPortal(c.pedidoApp({})))).erro?.codigo).toBe('sem_cliente')
  })

  it('webhook do setup: guarda o método (SEPA, mandato) e torna-o o predefinido do cliente', async () => {
    const customer = await configurarMandato()
    expect(c.bd.instituicoes.get(LAR)).toMatchObject({ stripe_payment_method_id: 'pm_sepa', metodo: { tipo: 'sepa_debit', ultimos4: '3000', mandato_ref: 'MANDATO-1' } })
    expect(c.stripe.chamadasDe('atualizarCliente').at(-1)).toMatchObject({ id: customer, params: { invoice_settings: { default_payment_method: 'pm_sepa' } } })
    const r = await c.handlers.faturacaoPortal(c.pedidoApp({}))
    expect((await json(r)).url).toMatch(/^https:\/\/billing\.stripe\.com\//)
    expect(c.stripe.chamadasDe('criarSessaoPortal')[0]!.params).toEqual({ customer, return_url: 'https://encontralar.example/app/?faturacao=portal', locale: 'pt' })
  })
})

describe('plano-instituicao (modalidade)', () => {
  const mudar = async (plano: string) => {
    const r = await c.handlers.planoInstituicao(c.pedidoApp({ plano }))
    return { r, corpo: await json(r) }
  }

  it('para a mensalidade sem método → 409 e a modalidade não muda', async () => {
    const { r, corpo } = await mudar('mensal')
    expect(r.status).toBe(409)
    expect(corpo.erro?.codigo).toBe('metodo_em_falta')
    expect(c.bd.instituicoes.get(LAR)!.plano).toBeNull()
    expect(c.stripe.chamadasDe('criarSubscricao')).toHaveLength(0)
  })

  it('para a mensalidade com mandato → muda na BD, cria a subscrição (29 € + IVA 23 %) e regista-a', async () => {
    await configurarMandato()
    const { r, corpo } = await mudar('mensal')
    expect(r.status).toBe(200)
    const desde = new Date(T0).toISOString()
    expect(corpo).toEqual({ plano: 'mensal', plano_desde: desde, compromisso_ate: compromissoAte(desde), subscricao: { estado: 'ativa' }, sincronizacao: 'ok' })
    const sub = c.stripe.chamadasDe('criarSubscricao')[0]!
    expect(sub.opcoes).toEqual({ idempotencyKey: `subscricao:${LAR}:${desde}` })
    expect(sub.params).toMatchObject({ default_payment_method: 'pm_sepa', collection_method: 'charge_automatically', metadata: { instituicao_id: LAR } })
    expect(c.bd.subscricoes.get(LAR)).toMatchObject({ estado: 'ativa', compromisso_ate: compromissoAte(desde) })
    // repetir não cria outra
    await mudar('mensal')
    expect(c.stripe.chamadasDe('criarSubscricao')).toHaveLength(1)
  })

  it('voltar à taxa por entrada antes do fim do compromisso → 409 com a mensagem da BD; depois → cancela a subscrição', async () => {
    await configurarMandato()
    await mudar('mensal')
    c.relogio.avancar(200 * DIA)
    const cedo = await mudar('por_entrada')
    expect(cedo.r.status).toBe(409)
    expect(cedo.corpo.erro).toEqual({ codigo: 'compromisso', mensagem: `A mensalidade tem um compromisso de 12 meses: pode mudar a partir de ${dataLonga(compromissoAte(new Date(T0).toISOString()))}.` })
    expect(cedo.corpo.erro?.mensagem).toBe('A mensalidade tem um compromisso de 12 meses: pode mudar a partir de 13 de outubro de 2027.')
    expect(c.bd.instituicoes.get(LAR)!.plano).toBe('mensal')
    expect(c.stripe.chamadasDe('cancelarSubscricao')).toHaveLength(0)

    c.relogio.agora = Date.parse(compromissoAte(new Date(T0).toISOString()))
    const depois = await mudar('por_entrada')
    expect(depois.r.status).toBe(200)
    expect(depois.corpo).toMatchObject({ plano: 'por_entrada', subscricao: { estado: 'cancelada' }, sincronizacao: 'ok' })
    expect(c.stripe.chamadasDe('cancelarSubscricao')[0]!.params).toMatchObject({ prorate: false, invoice_now: false })
    expect(c.bd.subscricoes.get(LAR)?.estado).toBe('cancelada')
  })

  it('a BD é a autoridade: se ela recusar, a função devolve 409 e não mexe no Stripe', async () => {
    await configurarMandato()
    await mudar('mensal')
    c.relogio.agora = Date.parse(compromissoAte(new Date(T0).toISOString()))
    // a BD (falsa) ainda acha que o compromisso não acabou
    c.bd.instituicoes.get(LAR)!.plano_desde = new Date(c.relogio.agora - DIA).toISOString()
    const ctx = c.bd.impl.servico_subscricao_contexto
    c.bd.impl.servico_subscricao_contexto = (a) => ({ ...ctx(a)!, plano_desde: new Date(T0).toISOString() })
    const r = await mudar('por_entrada')
    expect(r.r.status).toBe(409)
    expect(r.corpo.erro?.mensagem).toMatch(/compromisso de 12 meses/)
    expect(c.stripe.chamadasDe('cancelarSubscricao')).toHaveLength(0)
  })

  it('o Stripe falha ao criar → a modalidade muda, sincronizacao pendente, e a tarefa diária reconcilia', async () => {
    await configurarMandato()
    c.stripe.falhar.set('criarSubscricao', Object.assign(new Error('rate limit'), { type: 'StripeRateLimitError' }))
    const { r, corpo } = await mudar('mensal')
    expect(r.status).toBe(200)
    expect(corpo).toMatchObject({ plano: 'mensal', sincronizacao: 'pendente', aviso: 'A modalidade mudou. A cobrança mensal fica ativa nas próximas horas.' })
    expect(c.bd.subscricoes.get(LAR)).toBeUndefined()
    await c.cron('diario')
    expect(c.bd.subscricoes.get(LAR)?.estado).toBe('ativa')
    expect(c.stripe.chamadasDe('criarSubscricao').length).toBe(2)
  })

  it('IPSS → 409; não é dono → 403; plano inválido → 400', async () => {
    expect((await mudar('anual')).r.status).toBe(400)
    c.comSessao({ sessao: { id: 'u-x', email: null, anonimo: false } })
    expect((await mudar('mensal')).r.status).toBe(403)
    c.bd.lar('ipss-1', { natureza: 'misericordia' })
    c.comSessao({ sessao: { id: 'u-ipss', email: null, anonimo: false }, instituicaoId: 'ipss-1' })
    expect((await mudar('mensal')).corpo.erro?.codigo).toBe('isenta')
  })
})

describe('um mês da mensalidade', () => {
  it('subscrição ativa → fatura do Stripe emitida (FT da mensalidade) → paga (RC); entradas ficam incluídas', async () => {
    await configurarMandato()
    await c.handlers.planoInstituicao(c.pedidoApp({ plano: 'mensal' }))
    const subId = c.bd.subscricoes.get(LAR)!.stripe_subscription_id
    // uma entrada confirmada já na mensalidade fica 'incluida' e nunca fatura
    c.bd.entrada(LAR, { taxa: 'incluida' })

    await c.entregar(evento('customer.subscription.created', { id: subId, status: 'active', customer: 'cus_x', start_date: Math.floor(T0 / 1000), metadata: { instituicao_id: LAR } }))
    const inicio = Math.floor(T0 / 1000)
    const fim = Math.floor(Date.parse('2026-11-13T09:00:00Z') / 1000)
    const inv = faturaStripe({ id: 'in_sub_1', total: 3567, subscricao: { id: subId, inicio, fim, instituicaoId: LAR } })
    await c.entregar(evento('invoice.finalized', inv))

    const ft = c.bd.documentosDe({ tipo: 'FT', origem: 'subscricao' })
    expect(ft).toHaveLength(1)
    expect(ft[0]).toMatchObject({ chave: 'FT:sub:in_sub_1', estado: 'emitido', numero: 'FT F2026/1', total_centimos: 3567, iva_centimos: 667 })
    expect(c.emissor.documentos()[0]!.linhas).toEqual([
      { produto: 'mensalidade', descricao: 'Mensalidade EncontraLar · 13/10/2026 a 12/11/2026', quantidade: 1, liquidoCentimos: 2900, ivaPercent: 23, ivaCentimos: 667, totalCentimos: 3567 },
    ])
    const fatura = [...c.bd.faturas.values()].find((f) => f.origem === 'subscricao')!
    expect(fatura).toMatchObject({ estado: 'emitida', periodo: '2026-10-01', total_centimos: 3567 })

    c.stripe.faturasComPagamentos.set('in_sub_1', faturaComPagamento('in_sub_1', 'sepa_debit'))
    c.relogio.avancar(4 * DIA)
    await c.entregar(evento('invoice.paid', inv, { created: Math.floor(c.relogio.agora / 1000) }))
    expect(fatura.id && c.bd.faturas.get(fatura.id)).toMatchObject({ estado: 'paga', metodo: 'sepa_debit' })
    const rc = c.bd.documentosDe({ tipo: 'RC' })
    expect(rc).toHaveLength(1)
    expect(rc[0]).toMatchObject({ estado: 'emitido', numero: 'RC F2026/1', total_centimos: 3567 })
    expect(c.emissor.documentos().at(-1)!.documentos).toEqual([{ externoId: 'falso:FT:sub:in_sub_1', numero: 'FT F2026/1', valorCentimos: 3567 }])

    // a tarefa diária não fatura a entrada incluída
    await c.cron('diario')
    expect(c.bd.linhas.size).toBe(0)
    expect(c.bd.documentosDe({ tipo: 'FT', origem: 'entradas' })).toHaveLength(0)
  })

  it('pago antes de emitido (eventos fora de ordem): cria a fatura, a FT e o RC na mesma', async () => {
    await configurarMandato()
    await c.handlers.planoInstituicao(c.pedidoApp({ plano: 'mensal' }))
    const subId = c.bd.subscricoes.get(LAR)!.stripe_subscription_id
    const inv = faturaStripe({ id: 'in_sub_2', total: 3567, subscricao: { id: subId, inicio: Math.floor(T0 / 1000), fim: Math.floor(T0 / 1000) + 31 * 86400 } })
    c.stripe.faturasComPagamentos.set('in_sub_2', faturaComPagamento('in_sub_2', 'card'))
    await c.entregar(evento('invoice.paid', inv))
    await c.entregar(evento('invoice.finalized', inv))
    expect([...c.bd.faturas.values()].map((f) => f.estado)).toEqual(['paga'])
    expect(c.bd.documentosDe({}).map((d) => [d.tipo, d.estado])).toEqual([
      ['FT', 'emitido'],
      ['RC', 'emitido'],
    ])
  })

  it('primeira fatura antes de a subscrição estar registada: liga-a pelo metadata (sem esperar pela repetição)', async () => {
    await configurarMandato()
    c.bd.instituicoes.get(LAR)!.plano = 'mensal'
    c.bd.instituicoes.get(LAR)!.plano_desde = new Date(T0).toISOString()
    const inv = faturaStripe({ id: 'in_sub_0', total: 3567, subscricao: { id: 'sub_novo', inicio: Math.floor(T0 / 1000), fim: Math.floor(T0 / 1000) + 31 * 86400, instituicaoId: LAR } })
    expect((await c.entregar(evento('invoice.finalized', inv))).status).toBe(200)
    expect(c.bd.subscricoes.get(LAR)).toMatchObject({ stripe_subscription_id: 'sub_novo', estado: 'incompleta' })
    expect(c.bd.documentosDe({ tipo: 'FT', origem: 'subscricao' })[0]?.estado).toBe('emitido')
    await c.entregar(evento('customer.subscription.created', { id: 'sub_novo', status: 'active', customer: 'cus_x', start_date: Math.floor(T0 / 1000), metadata: { instituicao_id: LAR } }))
    expect(c.bd.subscricoes.get(LAR)?.estado).toBe('ativa')
  })

  it('total diferente do esperado (ex.: rateio) → sem FT, alerta para a equipa', async () => {
    await configurarMandato()
    await c.handlers.planoInstituicao(c.pedidoApp({ plano: 'mensal' }))
    const subId = c.bd.subscricoes.get(LAR)!.stripe_subscription_id
    await c.entregar(evento('invoice.finalized', faturaStripe({ id: 'in_sub_3', total: 1200, subscricao: { id: subId, inicio: 1, fim: 2 } })))
    expect(c.bd.documentos.size).toBe(0)
    expect(c.bd.alertas.map((a) => a.tipo)).toContain('subscricao_divergente')
  })

  it('débito da mensalidade falhou → fatura falhou com motivo normalizado e aviso ao lar', async () => {
    await configurarMandato()
    await c.handlers.planoInstituicao(c.pedidoApp({ plano: 'mensal' }))
    const subId = c.bd.subscricoes.get(LAR)!.stripe_subscription_id
    const inv = faturaStripe({ id: 'in_sub_4', total: 3567, subscricao: { id: subId, inicio: Math.floor(T0 / 1000), fim: Math.floor(T0 / 1000) + 31 * 86400 } })
    await c.entregar(evento('invoice.finalized', inv))
    c.stripe.faturasComPagamentos.set('in_sub_4', faturaComPagamento('in_sub_4', 'sepa_debit', { code: 'insufficient_funds' }))
    await c.entregar(evento('invoice.payment_failed', inv))
    expect([...c.bd.faturas.values()][0]).toMatchObject({ estado: 'falhou', motivo: 'saldo_insuficiente' })
    expect(c.bd.alertas.map((a) => a.tipo)).toContain('pagamento_falhou')
    await c.entregar(evento('customer.subscription.updated', { id: subId, status: 'past_due', customer: 'cus_x', start_date: 1, metadata: { instituicao_id: LAR } }))
    expect(c.bd.subscricoes.get(LAR)?.estado).toBe('em_atraso')
  })

  it('novo mandato no portal: o webhook atualiza também a subscrição ativa', async () => {
    const customer = await configurarMandato()
    await c.handlers.planoInstituicao(c.pedidoApp({ plano: 'mensal' }))
    const subId = c.bd.subscricoes.get(LAR)!.stripe_subscription_id
    c.stripe.metodos.set('pm_novo', { id: 'pm_novo', type: 'sepa_debit', sepa_debit: { last4: '0154', bank_code: '0035' } } as unknown as Stripe.PaymentMethod)
    await c.entregar(
      evento('customer.updated', { id: customer, metadata: { instituicao_id: LAR }, invoice_settings: { default_payment_method: 'pm_novo' } }, { previous_attributes: { invoice_settings: { default_payment_method: 'pm_sepa' } } }),
    )
    expect(c.bd.instituicoes.get(LAR)!.stripe_payment_method_id).toBe('pm_novo')
    expect(c.stripe.chamadasDe('atualizarSubscricao')).toEqual([
      { metodo: 'atualizarSubscricao', id: subId, params: { default_payment_method: 'pm_novo' }, opcoes: { idempotencyKey: `subscricao-metodo:${subId}:pm_novo` } },
    ])
  })
})
