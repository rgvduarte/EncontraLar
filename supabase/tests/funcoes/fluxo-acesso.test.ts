/**
 * Acesso Família (B2C) de ponta a ponta, com a BD, o Stripe e o emissor falsos:
 * acesso-checkout → Stripe Checkout → stripe-webhook → acesso estendido + Fatura-Recibo.
 * Cartão, MB WAY, Multibanco (pendente e depois pago), expirado, falhado, reembolso e compra com NIF.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { lerConfig } from '../../functions/_shared/config.ts'
import { CONSENTIMENTO_ACESSO } from '../../functions/_shared/faturacao/planos.ts'
import { criarCenario, json, ORIGEM, type Cenario } from './cenario.ts'
import { AMBIENTE_TESTE, DIA, evento, paymentIntent, sessaoCheckout, T0 } from './fakes.ts'

const CONSENTIMENTO = { versao: CONSENTIMENTO_ACESSO.versao, aceite: true }

let c: Cenario
let familia: { id: string }

beforeEach(() => {
  c = criarCenario()
  familia = c.bd.familia()
  c.comSessao({ sessao: { id: familia.id, email: 'familia@exemplo.pt', anonimo: false } })
})

async function comprar(corpo: Record<string, unknown> = { plano: 'acesso_30', consentimento: CONSENTIMENTO }) {
  const r = await c.handlers.acessoCheckout(c.pedidoApp(corpo))
  return { r, corpo: await json(r) }
}

/** O que o Stripe faria: a sessão criada (último pedido) com um PaymentIntent do método escolhido. */
function sessaoCriada() {
  const ch = c.stripe.chamadasDe('criarSessaoCheckout').at(-1)!
  const [id] = [...c.stripe.sessoes.keys()].slice(-1)
  const params = ch.params as { metadata: { pagamento_id: string; plano: string }; line_items: { price_data: { unit_amount: number } }[] }
  return { id: id!, pagamentoId: params.metadata.pagamento_id, plano: params.metadata.plano, valor: params.line_items[0]!.price_data.unit_amount }
}

describe('acesso-checkout: validações', () => {
  it('preflight, origem, método', async () => {
    const pf = await c.handlers.acessoCheckout(new Request('https://x/', { method: 'OPTIONS', headers: { origin: ORIGEM } }))
    expect(pf.status).toBe(204)
    expect((await c.handlers.acessoCheckout(c.pedidoApp({}, { origin: 'https://evil.example' }))).status).toBe(403)
    expect((await c.handlers.acessoCheckout(new Request('https://x/', { method: 'GET', headers: { origin: ORIGEM } }))).status).toBe(405)
  })

  it('sem sessão → 401; conta anónima → 403', async () => {
    c.comSessao({ sessao: null })
    expect((await comprar()).r.status).toBe(401)
    c.comSessao({ sessao: { id: familia.id, email: null, anonimo: true } })
    const { r, corpo } = await comprar()
    expect(r.status).toBe(403)
    expect(corpo.erro?.codigo).toBe('conta_anonima')
  })

  it('plano inválido → 400; consentimento em falta → 400; versão antiga → 409', async () => {
    expect((await comprar({ plano: 'acesso_365', consentimento: CONSENTIMENTO })).corpo.erro?.codigo).toBe('plano_invalido')
    expect((await comprar({ plano: 'acesso_30' })).r.status).toBe(400)
    expect((await comprar({ plano: 'acesso_30', consentimento: { versao: CONSENTIMENTO.versao, aceite: 'sim' } })).r.status).toBe(400)
    const antigo = await comprar({ plano: 'acesso_30', consentimento: { versao: 'acesso-familia-2020-01-01', aceite: true } })
    expect(antigo.r.status).toBe(409)
    expect(antigo.corpo.erro?.codigo).toBe('consentimento_desatualizado')
    expect(c.stripe.chamadas).toHaveLength(0)
    expect(c.bd.pagamentos.size).toBe(0)
  })

  it('NIF inválido → 400 com a mensagem; 999999990 = sem NIF', async () => {
    const mau = await comprar({ plano: 'acesso_30', consentimento: CONSENTIMENTO, fatura: { nif: '123456788' } })
    expect(mau.r.status).toBe(400)
    expect(mau.corpo.erro).toEqual({ codigo: 'nif', mensagem: 'Este NIF não é válido. Confirme os algarismos.' })
    await comprar({ plano: 'acesso_30', consentimento: CONSENTIMENTO, fatura: { nif: '999 999 990', nome: 'Graça' } })
    expect([...c.bd.pagamentos.values()][0]).toMatchObject({ nif: null, nome_fiscal: null })
  })

  it('conta que não é de família → 403 com a mensagem da BD', async () => {
    c.bd.utilizadores.get(familia.id)!.role = 'lar'
    const { r, corpo } = await comprar()
    expect(r.status).toBe(403)
    expect(corpo.erro).toEqual({ codigo: 'sem_permissao', mensagem: 'O Acesso Família é para contas de família.' })
    expect(c.stripe.chamadas).toHaveLength(0)
  })

  it('conta de demonstração: em teste pode; em produção → 403 sem ir ao Stripe', async () => {
    c.bd.utilizadores.get(familia.id)!.demonstracao = true
    expect((await comprar()).r.status).toBe(200)
    const prod = lerConfig({ ...AMBIENTE_TESTE, STRIPE_MODO: 'producao', STRIPE_SECRET_KEY: 'rk_live_x', FATURACAO_EMISSOR: 'moloni' }, ['utilizador'])
    if (!prod.ok) throw new Error(prod.problemas.join())
    const p = criarCenario({ config: prod.config })
    const u = p.bd.familia(undefined, { demonstracao: true })
    p.comSessao({ sessao: { id: u.id, email: null, anonimo: false } })
    const r = await p.handlers.acessoCheckout(p.pedidoApp({ plano: 'acesso_30', consentimento: CONSENTIMENTO }))
    expect(r.status).toBe(403)
    expect((await json(r)).erro?.codigo).toBe('demonstracao')
    expect(p.stripe.chamadas).toHaveLength(0)
  })

  it('o Stripe falha → 502 com mensagem nossa (nunca a do Stripe)', async () => {
    c.stripe.falhar.set('criarSessaoCheckout', Object.assign(new Error('Your account cannot currently make live charges.'), { type: 'StripeInvalidRequestError', code: 'account_invalid' }))
    const { r, corpo } = await comprar()
    expect(r.status).toBe(502)
    expect(JSON.stringify(corpo)).not.toMatch(/account|live charges/)
    expect(corpo.erro?.mensagem).toBe('Não foi possível contactar o serviço de pagamentos. Tente de novo dentro de momentos.')
  })

  it('sucesso: consentimento registado (versão, IP truncado), pagamento pendente com a sessão, devolve { url }', async () => {
    const { r, corpo } = await comprar({ plano: 'acesso_90', consentimento: CONSENTIMENTO, voltar: '/lar/jardins-do-douro' })
    expect(r.status).toBe(200)
    expect(r.headers.get('access-control-allow-origin')).toBe(ORIGEM)
    const s = sessaoCriada()
    expect(corpo).toEqual({ url: `https://checkout.stripe.com/c/pay/${s.id}`, pagamento_id: s.pagamentoId })
    expect(c.bd.consentimentos).toEqual([
      { user_id: familia.id, pagamento_id: s.pagamentoId, plano: 'acesso_90', texto_versao: CONSENTIMENTO_ACESSO.versao, aceite_em: new Date(T0).toISOString(), ip_truncado: '203.0.113.0' },
    ])
    expect(c.bd.pagamentos.get(s.pagamentoId)).toMatchObject({ estado: 'pendente', session_id: s.id, valor_centimos: 2990, plano: 'acesso_90' })
    expect(c.stripe.chamadasDe('criarSessaoCheckout')[0]!.params).toMatchObject({
      client_reference_id: familia.id,
      success_url: 'https://encontralar.example/app/?acesso=sucesso&sessao={CHECKOUT_SESSION_ID}&voltar=%2Flar%2Fjardins-do-douro',
    })
  })
})

describe('compra completa', () => {
  async function pagarCom(tipo: 'card' | 'mb_way') {
    await comprar()
    const s = sessaoCriada()
    c.stripe.paymentIntents.set('pi_1', paymentIntent({ id: 'pi_1', tipo, pagamentoId: s.pagamentoId }))
    const r = await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_intent: 'pi_1', amount_total: s.valor })))
    expect(r.status).toBe(200)
    return s
  }

  it('cartão: acesso de 30 dias logo, pagamento pago, Fatura-Recibo a consumidor final (12,11 € + 2,79 €)', async () => {
    const s = await pagarCom('card')
    expect(c.bd.acessos.get(familia.id)).toEqual({ plano: 'acesso_30', ate: new Date(T0 + 30 * DIA).toISOString() })
    expect(c.bd.pagamentos.get(s.pagamentoId)).toMatchObject({ estado: 'pago', metodo: 'card', payment_intent_id: 'pi_1' })
    const fr = c.bd.documentosDe({ tipo: 'FR', pagamento_id: s.pagamentoId })[0]!
    expect(fr).toMatchObject({ estado: 'emitido', numero: 'FR F2026/1', chave: `FR:pag:${s.pagamentoId}`, total_centimos: 1490, iva_centimos: 279, cliente: { tipo: 'consumidor_final' } })
    const emitido = c.emissor.documentos()[0]!
    expect(emitido.linhas).toEqual([{ produto: 'acesso', descricao: 'Acesso Família — 30 dias', quantidade: 1, liquidoCentimos: 1211, ivaPercent: 23, ivaCentimos: 279, totalCentimos: 1490 }])
    expect(emitido.pagamento).toEqual({ metodo: 'card', data: '2026-10-13', valorCentimos: 1490 })
  })

  it('MB WAY: igual ao cartão, com o método mb_way no recibo', async () => {
    const s = await pagarCom('mb_way')
    expect(c.bd.pagamentos.get(s.pagamentoId)?.metodo).toBe('mb_way')
    expect(c.emissor.documentos()[0]!.pagamento?.metodo).toBe('mb_way')
  })

  it('a família descarrega a sua Fatura-Recibo (e outra família não)', async () => {
    const s = await pagarCom('card')
    const fr = c.bd.documentosDe({ tipo: 'FR', pagamento_id: s.pagamentoId })[0]!
    const r = await c.handlers.faturacaoDocumento(c.pedidoApp({ documento_id: fr.id }))
    expect(r.status).toBe(200)
    expect(await json(r)).toMatchObject({ numero: 'FR F2026/1', tipo: 'FR', url: expect.stringMatching(/^data:text\/plain/) })
    const outra = c.bd.familia()
    c.comSessao({ sessao: { id: outra.id, email: null, anonimo: false } })
    expect((await c.handlers.faturacaoDocumento(c.pedidoApp({ documento_id: fr.id }))).status).toBe(404)
    expect((await c.handlers.faturacaoDocumento(c.pedidoApp({ documento_id: 'nao-e-uuid' }))).status).toBe(400)
  })

  it('Multibanco: fica a aguardar com a referência (sem acesso); dias depois é pago e o acesso abre nesse momento', async () => {
    await comprar()
    const s = sessaoCriada()
    const expira = Math.floor(T0 / 1000) + 3 * 86400
    c.stripe.paymentIntents.set('pi_mb', paymentIntent({ id: 'pi_mb', tipo: 'multibanco', pagamentoId: s.pagamentoId, multibanco: { entity: '11249', reference: '123456789', expires_at: expira } }))
    await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_status: 'unpaid', payment_intent: 'pi_mb', amount_total: 1490 })))
    expect(c.bd.pagamentos.get(s.pagamentoId)).toMatchObject({
      estado: 'a_aguardar_pagamento',
      metodo: 'multibanco',
      multibanco: { entidade: '11249', referencia: '123456789', expira_em: new Date(expira * 1000).toISOString() },
    })
    expect(c.bd.acessos.get(familia.id)).toBeUndefined()
    expect(c.bd.documentos.size).toBe(0)

    c.relogio.avancar(2 * DIA)
    const pago = evento('checkout.session.async_payment_succeeded', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_intent: 'pi_mb', amount_total: 1490 }), { created: Math.floor(c.relogio.agora / 1000) })
    await c.entregar(pago)
    expect(c.bd.pagamentos.get(s.pagamentoId)).toMatchObject({ estado: 'pago', pago_em: new Date(c.relogio.agora).toISOString() })
    expect(c.bd.acessos.get(familia.id)?.ate).toBe(new Date(T0 + 2 * DIA + 30 * DIA).toISOString())
    expect(c.bd.documentosDe({ tipo: 'FR' })[0]).toMatchObject({ estado: 'emitido', data: '2026-10-15', pagamento: { metodo: 'multibanco' } })
  })

  it('Multibanco não pago: async_payment_failed → falhou (referência expirada), sem acesso nem documento', async () => {
    await comprar()
    const s = sessaoCriada()
    c.stripe.paymentIntents.set('pi_mb', paymentIntent({ id: 'pi_mb', tipo: 'multibanco', pagamentoId: s.pagamentoId, multibanco: { entity: '11249', reference: '987654321', expires_at: 1 } }))
    await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_status: 'unpaid', payment_intent: 'pi_mb', amount_total: 1490 })))
    await c.entregar(evento('checkout.session.async_payment_failed', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_status: 'unpaid', payment_intent: 'pi_mb' })))
    expect(c.bd.pagamentos.get(s.pagamentoId)).toMatchObject({ estado: 'falhou', motivo_falha: 'referencia_expirada' })
    expect(c.bd.acessos.get(familia.id)).toBeUndefined()
    expect(c.bd.documentos.size).toBe(0)
  })

  it('sessão expirada (a família desistiu) → expirado, sem acesso nem documento', async () => {
    await comprar()
    const s = sessaoCriada()
    await c.entregar(evento('checkout.session.expired', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_status: 'unpaid' })))
    expect(c.bd.pagamentos.get(s.pagamentoId)?.estado).toBe('expirado')
    expect(c.bd.acessos.get(familia.id)).toBeUndefined()
    expect(c.bd.documentos.size).toBe(0)
  })

  it('segunda compra soma os dias ao fim atual (novoAte)', async () => {
    await pagarCom('card')
    c.relogio.avancar(10 * DIA)
    await comprar({ plano: 'acesso_90', consentimento: CONSENTIMENTO })
    const s = sessaoCriada()
    c.stripe.paymentIntents.set('pi_2', paymentIntent({ id: 'pi_2', tipo: 'card', pagamentoId: s.pagamentoId }))
    await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, plano: 'acesso_90', payment_intent: 'pi_2', amount_total: 2990 })))
    expect(c.bd.acessos.get(familia.id)).toEqual({ plano: 'acesso_90', ate: new Date(T0 + 30 * DIA + 90 * DIA).toISOString() })
    expect(c.bd.documentosDe({ tipo: 'FR' }).map((d) => d.numero)).toEqual(['FR F2026/1', 'FR F2026/2'])
  })

  it('reembolso total: marca reembolsado e avisa a equipa, sem encurtar o acesso', async () => {
    const s = await pagarCom('card')
    const ate = c.bd.acessos.get(familia.id)!.ate
    await c.entregar(evento('charge.refunded', { id: 'ch_1', object: 'charge', payment_intent: 'pi_1', amount: 1490, amount_refunded: 1490, refunded: true }))
    expect(c.bd.pagamentos.get(s.pagamentoId)).toMatchObject({ estado: 'reembolsado', reembolsado_centimos: 1490 })
    expect(c.bd.acessos.get(familia.id)!.ate).toBe(ate)
    expect(c.bd.alertas).toContainEqual({ tipo: 'reembolso', ref: s.pagamentoId })
  })

  it('com NIF: Fatura-Recibo ao particular (o NIF nunca foi ao Stripe)', async () => {
    await comprar({ plano: 'acesso_30', consentimento: CONSENTIMENTO, fatura: { nif: '123456789', nome: 'Graça Rocha' } })
    const s = sessaoCriada()
    expect(JSON.stringify(c.stripe.chamadas)).not.toContain('123456789')
    c.stripe.paymentIntents.set('pi_n', paymentIntent({ id: 'pi_n', tipo: 'card', pagamentoId: s.pagamentoId }))
    await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_intent: 'pi_n', amount_total: 1490 })))
    expect(c.bd.documentosDe({ tipo: 'FR' })[0]).toMatchObject({ estado: 'emitido', cliente: { tipo: 'particular', nif: '123456789', nome: 'Graça Rocha' } })
  })

  it('se servico_acesso_sessao_criada falhar, a família segue e o webhook encontra o pagamento por metadata', async () => {
    c.bd.falhar.set('servico_acesso_sessao_criada', new Error('timeout'))
    const { r } = await comprar()
    expect(r.status).toBe(200)
    const s = sessaoCriada()
    expect(c.bd.pagamentos.get(s.pagamentoId)?.session_id).toBeNull()
    c.stripe.paymentIntents.set('pi_1', paymentIntent({ id: 'pi_1', tipo: 'card', pagamentoId: s.pagamentoId }))
    await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_intent: 'pi_1', amount_total: 1490 })))
    expect(c.bd.pagamentos.get(s.pagamentoId)).toMatchObject({ estado: 'pago', session_id: s.id })
  })

  it('valor pago diferente do passe → o evento falha (500) e nada é aplicado', async () => {
    await comprar()
    const s = sessaoCriada()
    c.stripe.paymentIntents.set('pi_1', paymentIntent({ id: 'pi_1', tipo: 'card', pagamentoId: s.pagamentoId }))
    const r = await c.entregar(evento('checkout.session.completed', sessaoCheckout({ id: s.id, pagamentoId: s.pagamentoId, payment_intent: 'pi_1', amount_total: 100 })))
    expect(r.status).toBe(500)
    expect(c.bd.acessos.get(familia.id)).toBeUndefined()
    expect(c.bd.pagamentos.get(s.pagamentoId)?.estado).toBe('pendente')
  })
})
