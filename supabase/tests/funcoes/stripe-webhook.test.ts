/**
 * Webhook: assinaturas verdadeiras (stripe.webhooks.generateTestHeaderString) verificadas com
 * constructEventAsync + SubtleCrypto; livemode vs STRIPE_MODO; idempotência (um evento repetido não faz
 * nada); erro antes do fim → 500 e o Stripe repete.
 */
import { describe, expect, it } from 'vitest'
import { ErroBD } from '../../functions/_shared/portas.ts'
import { modoCompativel, TOLERANCIA_ASSINATURA_S, verificarEvento } from '../../functions/_shared/stripe/webhook.ts'
import { criarCenario, json, sdk, SEGREDO_WEBHOOK, verificador } from './cenario.ts'
import { evento, paymentIntent, sessaoCheckout, T0 } from './fakes.ts'

const AGORA_S = Math.floor(T0 / 1000)
const corpoDe = (tipo = 'customer.created') => JSON.stringify(evento(tipo, { id: 'cus_1', object: 'customer' }))
const assinar = (corpo: string, segredo = SEGREDO_WEBHOOK, timestamp = AGORA_S) => sdk.webhooks.generateTestHeaderString({ payload: corpo, secret: segredo, timestamp })

describe('verificarEvento (assinatura)', () => {
  it('assinatura válida → evento', async () => {
    const corpo = corpoDe()
    const r = await verificarEvento(corpo, assinar(corpo), SEGREDO_WEBHOOK, verificador, T0)
    expect(r.ok && r.evento.type).toBe('customer.created')
  })

  it('corpo alterado depois de assinado → inválida', async () => {
    const corpo = corpoDe()
    const r = await verificarEvento(corpo.replace('cus_1', 'cus_2'), assinar(corpo), SEGREDO_WEBHOOK, verificador, T0)
    expect(r).toEqual({ ok: false, motivo: 'assinatura_invalida' })
  })

  it('sem cabeçalho → sem_assinatura; segredo errado → inválida', async () => {
    const corpo = corpoDe()
    expect(await verificarEvento(corpo, null, SEGREDO_WEBHOOK, verificador, T0)).toEqual({ ok: false, motivo: 'sem_assinatura' })
    expect(await verificarEvento(corpo, assinar(corpo, 'whsec_outro'), SEGREDO_WEBHOOK, verificador, T0)).toEqual({ ok: false, motivo: 'assinatura_invalida' })
    expect(await verificarEvento(corpo, 't=1,v1=abc', SEGREDO_WEBHOOK, verificador, T0)).toEqual({ ok: false, motivo: 'assinatura_invalida' })
  })

  it('carimbo fora da tolerância (5 min) → inválida; dentro → válida (o relógio vai em ms)', async () => {
    const corpo = corpoDe()
    const velho = AGORA_S - TOLERANCIA_ASSINATURA_S - 1
    // em segundos o SDK calcularia uma idade negativa e aceitaria tudo: a função passa sempre ms
    expect((await verificarEvento(corpo, assinar(corpo, SEGREDO_WEBHOOK, velho), SEGREDO_WEBHOOK, verificador, AGORA_S)).ok).toBe(true)
    expect((await verificarEvento(corpo, assinar(corpo, SEGREDO_WEBHOOK, velho), SEGREDO_WEBHOOK, verificador, T0)).ok).toBe(false)
    expect((await verificarEvento(corpo, assinar(corpo, SEGREDO_WEBHOOK, AGORA_S - 60), SEGREDO_WEBHOOK, verificador, T0)).ok).toBe(true)
  })

  it('modoCompativel: teste só aceita livemode=false; produção só livemode=true', () => {
    expect(modoCompativel({ livemode: false }, 'teste')).toBe(true)
    expect(modoCompativel({ livemode: true }, 'teste')).toBe(false)
    expect(modoCompativel({ livemode: true }, 'producao')).toBe(true)
    expect(modoCompativel({ livemode: false }, 'producao')).toBe(false)
  })
})

describe('handler stripe-webhook', () => {
  function cenarioComPagamento() {
    const c = criarCenario()
    const u = c.bd.familia()
    const p = c.bd.impl.servico_acesso_iniciar({ p_user_id: u.id, p_plano: 'acesso_30', p_texto_versao: 'v', p_ip: null, p_nif: null, p_nome_fiscal: null })
    c.bd.impl.servico_acesso_sessao_criada({ p_pagamento_id: p.pagamento_id, p_session_id: 'cs_1' })
    c.stripe.paymentIntents.set('pi_1', paymentIntent({ id: 'pi_1', tipo: 'card', pagamentoId: p.pagamento_id }))
    const e = evento('checkout.session.completed', sessaoCheckout({ id: 'cs_1', pagamentoId: p.pagamento_id, payment_intent: 'pi_1', amount_total: 1490 }))
    return { c, u, p, e }
  }

  it('evento novo → 200 aplicado; o mesmo evento outra vez → 200 repetido e não aplica nada', async () => {
    const { c, u, e } = cenarioComPagamento()
    const r1 = await c.entregar(e)
    expect(r1.status).toBe(200)
    expect(await json(r1)).toEqual({ recebido: true, estado: 'aplicado' })
    const ate = c.bd.acessos.get(u.id)!.ate
    const aplicacoes = () => c.bd.chamadas.filter((x) => x.nome === 'servico_evento_aplicar').length
    expect(aplicacoes()).toBe(1)

    const r2 = await c.entregar(e)
    expect(await json(r2)).toEqual({ recebido: true, estado: 'repetido' })
    expect(aplicacoes()).toBe(1)
    expect(c.bd.acessos.get(u.id)!.ate).toBe(ate)
    expect(c.stripe.chamadasDe('lerPaymentIntent')).toHaveLength(1)
    expect(c.bd.documentosDe({ tipo: 'FR' })).toHaveLength(1)
  })

  it('assinatura inválida → 400 e nada chega à BD', async () => {
    const { c, e } = cenarioComPagamento()
    const r = await c.entregar(e, { segredo: 'whsec_errado' })
    expect(r.status).toBe(400)
    expect((await json(r)).erro?.codigo).toBe('assinatura_invalida')
    expect(c.bd.chamadas).toHaveLength(0)
  })

  it('assinatura com mais de 5 minutos (repetição de um pedido antigo) → 400', async () => {
    const { c, e } = cenarioComPagamento()
    const r = await c.entregar(e, { assinadoEm: c.relogio.agora - 6 * 60_000 })
    expect(r.status).toBe(400)
    expect(c.bd.chamadas).toHaveLength(0)
    expect((await c.entregar(e, { assinadoEm: c.relogio.agora - 4 * 60_000 })).status).toBe(200)
  })

  it('corpo alterado (ex.: valor) → 400', async () => {
    const { c, e } = cenarioComPagamento()
    const r = await c.entregar(e, { corpo: JSON.stringify(e).replace('"amount_total":1490', '"amount_total":1') })
    expect(r.status).toBe(400)
  })

  it('evento de produção num endpoint de teste → 400 sem tocar na BD', async () => {
    const { c } = cenarioComPagamento()
    const r = await c.entregar(evento('customer.created', { id: 'cus_1' }, { livemode: true }))
    expect(r.status).toBe(400)
    expect((await json(r)).erro?.codigo).toBe('modo')
    expect(c.bd.chamadas).toHaveLength(0)
  })

  it('só POST', async () => {
    const { c } = cenarioComPagamento()
    expect((await c.handlers.webhook(new Request('https://x/', { method: 'GET' }))).status).toBe(405)
  })

  it('falha a meio (BD) → 500, servico_evento_falhou, e a repetição do Stripe aplica uma vez', async () => {
    const { c, u, e } = cenarioComPagamento()
    c.bd.falhar.set('servico_evento_aplicar', new ErroBD('40001', 'could not serialize access'))
    const r1 = await c.entregar(e)
    expect(r1.status).toBe(500)
    expect(c.bd.eventos.get(e.id)).toMatchObject({ processado_em: null, erro: 'ErroBD [40001]: could not serialize access' })
    expect(c.bd.acessos.get(u.id)).toBeUndefined()
    const r2 = await c.entregar(e)
    expect(r2.status).toBe(200)
    expect(c.bd.acessos.get(u.id)).toBeDefined()
    expect(c.bd.eventos.get(e.id)?.tentativas).toBe(2)
  })

  it('falha a ler o Stripe → 500 sem aplicar; a mensagem guardada não tem a mensagem do Stripe', async () => {
    const { c, e } = cenarioComPagamento()
    c.stripe.falhar.set('lerPaymentIntent', Object.assign(new Error('Something went wrong with card 4242 for Amélia'), { type: 'StripeAPIError', code: 'api_error' }))
    const r = await c.entregar(e)
    expect(r.status).toBe(500)
    expect(c.bd.eventos.get(e.id)?.erro).toBe('StripeAPIError:api_error')
  })

  it('BD indisponível logo no início → 500', async () => {
    const { c, e } = cenarioComPagamento()
    c.bd.falhar.set('servico_evento_iniciar', new Error('fetch failed'))
    expect((await c.entregar(e)).status).toBe(500)
  })

  it('depois de aplicar, emite já os documentos da fila (FR da compra)', async () => {
    const { c, e } = cenarioComPagamento()
    await c.entregar(e)
    expect(c.bd.documentosDe({ tipo: 'FR' })[0]).toMatchObject({ estado: 'emitido', numero: 'FR F2026/1', emissor: 'falso' })
  })

  it('se a emissão falhar depois do 200, o documento fica na fila (o evento conta como aplicado)', async () => {
    const { c, e } = cenarioComPagamento()
    c.bd.falhar.set('servico_documentos_pendentes', new Error('timeout'))
    const r = await c.entregar(e)
    expect(r.status).toBe(200)
    expect(c.bd.documentosDe({ tipo: 'FR' })[0]?.estado).toBe('pendente')
    expect(c.registo.linhas.some((l) => l.evento === 'webhook_documentos')).toBe(true)
  })
})
