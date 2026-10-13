/**
 * Minimização de dados: corre os três fluxos de dinheiro com o MoloniEmissor VERDADEIRO (sobre um Moloni
 * falso) e o Stripe falso, e serializa TUDO o que sai — parâmetros do Stripe, pedidos ao Moloni (URL e corpo)
 * e os registos das funções. Nenhum nome de residente, contacto, nota ou necessidade de cuidados pode
 * aparecer, embora estejam na base de dados ao lado das entradas faturadas.
 */
import { describe, expect, it } from 'vitest'
import { pedidoDoDocumento } from '../../functions/_shared/faturacao/documentos.ts'
import { CONSENTIMENTO_ACESSO } from '../../functions/_shared/faturacao/planos.ts'
import { MoloniEmissor } from '../../functions/_shared/moloni/cliente.ts'
import type { DocumentoPendenteRpc } from '../../functions/_shared/portas.ts'
import { criarCenario } from './cenario.ts'
import { CFG_MOLONI, DADOS_PESSOAIS, DIA, evento, faturaComPagamento, faturaStripe, iso, moloniComEstado, paymentIntent, sessaoCheckout, T0 } from './fakes.ts'

/** Os valores que nunca podem sair (o nome do lar não é dado pessoal: o cliente B2B é a empresa). */
const PROIBIDOS = [DADOS_PESSOAIS.residente, DADOS_PESSOAIS.familiar, DADOS_PESSOAIS.notas, DADOS_PESSOAIS.necessidade, DADOS_PESSOAIS.telefone]
const partes = PROIBIDOS.flatMap((v) => [v, ...v.split(/[ ,]+/).filter((p) => p.length >= 5)])

/** Palavra inteira (sem distinguir maiúsculas): "Camélias" na morada do lar não é "Amélia". */
const palavra = (p: string) => new RegExp(`(?<![\\p{L}\\p{N}])${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}\\p{N}])`, 'iu')

function semDadosPessoais(rotulo: string, texto: string) {
  const encontrados = partes.filter((p) => palavra(p).test(texto))
  expect(encontrados, `${rotulo} contém dados pessoais`).toEqual([])
}

describe('nada de dados pessoais nos pedidos ao Stripe e ao Moloni', () => {
  it('o detetor encontra os dados em qualquer caixa e ignora palavras que só os contêm', () => {
    expect(() => semDadosPessoais('x', '{"name":"AMÉLIA ROCHA"}')).toThrow()
    expect(() => semDadosPessoais('x', 'diálise')).toThrow()
    expect(() => semDadosPessoais('x', '912 345 678')).toThrow()
    semDadosPessoais('x', 'Rua das Camélias 128, Rochas')
  })

  it('três fluxos completos: Acesso Família, taxa por entrada e mensalidade', async () => {
    const moloni = moloniComEstado()
    const c = criarCenario({ emissor: (r) => new MoloniEmissor(CFG_MOLONI, moloni.buscar, r.fn) })
    const LAR = 'lar-privado'
    const LAR_M = 'lar-mensal'

    // ——— a BD tem os dados de saúde ao lado da faturação
    c.bd.lar(LAR, { stripe_customer_id: 'cus_lar', stripe_payment_method_id: 'pm_sepa', metodo: { tipo: 'sepa_debit', ultimos4: '3000', mandato_ref: 'M-1' } })
    c.bd.entrada(LAR, { lar_em: iso(T0 - 2 * DIA) })
    c.bd.entrada(LAR, { lar_em: null, familia_em: iso(T0 - 15 * DIA) })
    expect(JSON.stringify(c.bd.entradas)).toContain(DADOS_PESSOAIS.residente)

    // ——— 1. família: cartão sem NIF + Multibanco com NIF
    const familia = c.bd.familia()
    c.comSessao({ sessao: { id: familia.id, email: 'familia@exemplo.pt', anonimo: false } })
    for (const [i, corpo] of [
      { plano: 'acesso_30', consentimento: { versao: CONSENTIMENTO_ACESSO.versao, aceite: true } },
      { plano: 'acesso_90', consentimento: { versao: CONSENTIMENTO_ACESSO.versao, aceite: true }, fatura: { nif: '123456789', nome: 'Contribuinte Exemplo' } },
    ].entries()) {
      expect((await c.handlers.acessoCheckout(c.pedidoApp(corpo))).status).toBe(200)
      const params = c.stripe.chamadasDe('criarSessaoCheckout').at(-1)!.params as { metadata: { pagamento_id: string }; line_items: { price_data: { unit_amount: number } }[] }
      const sid = [...c.stripe.sessoes.keys()].at(-1)!
      const pi = `pi_f${i}`
      c.stripe.paymentIntents.set(pi, paymentIntent({ id: pi, tipo: i ? 'multibanco' : 'card', pagamentoId: params.metadata.pagamento_id }))
      const tipo = i ? 'checkout.session.async_payment_succeeded' : 'checkout.session.completed'
      expect((await c.entregar(evento(tipo, sessaoCheckout({ id: sid, pagamentoId: params.metadata.pagamento_id, payment_intent: pi, amount_total: params.line_items[0]!.price_data.unit_amount })))).status).toBe(200)
    }

    // ——— 2. lar por entrada: FT por entrada, cobrança, débito, recibo
    await c.cron('diario')
    c.relogio.agora = Date.parse('2026-11-01T07:07:00Z')
    await c.cron('cobranca')
    c.relogio.agora = Date.parse('2026-11-04T06:13:00Z')
    await c.cron('diario')
    const fatura = [...c.bd.faturas.values()].find((f) => f.instituicao_id === LAR)!
    c.stripe.faturasComPagamentos.set(fatura.stripe_invoice_id!, faturaComPagamento(fatura.stripe_invoice_id!, 'sepa_debit'))
    await c.entregar(evento('invoice.paid', faturaStripe({ id: fatura.stripe_invoice_id!, total: fatura.total_centimos, faturaId: fatura.id })))

    // ——— 3. lar com mensalidade: mandato, subscrição, fatura e recibo
    c.bd.lar(LAR_M, { stripe_customer_id: 'cus_m', stripe_payment_method_id: 'pm_m', metodo: { tipo: 'card', ultimos4: '4242', mandato_ref: null } })
    c.bd.entrada(LAR_M, { taxa: 'incluida' })
    c.comSessao({ sessao: { id: 'gestor', email: null, anonimo: false }, instituicaoId: LAR_M })
    expect((await c.handlers.faturacaoCheckout(c.pedidoApp({}))).status).toBe(200)
    expect((await c.handlers.planoInstituicao(c.pedidoApp({ plano: 'mensal' }))).status).toBe(200)
    const sub = c.bd.subscricoes.get(LAR_M)!.stripe_subscription_id
    const inv = faturaStripe({ id: 'in_m1', total: 3567, subscricao: { id: sub, inicio: Math.floor(c.relogio.agora / 1000), fim: Math.floor(c.relogio.agora / 1000) + 30 * 86400 } })
    await c.entregar(evento('invoice.finalized', inv))
    c.stripe.faturasComPagamentos.set('in_m1', faturaComPagamento('in_m1', 'card'))
    await c.entregar(evento('invoice.paid', inv))

    // ——— tudo foi emitido pelo Moloni (falso) com o emissor verdadeiro
    const docs = c.bd.documentosDe({})
    expect(docs.map((d) => [d.tipo, d.estado])).toEqual([
      ['FR', 'emitido'],
      ['FR', 'emitido'],
      ['FT', 'emitido'],
      ['FT', 'emitido'],
      ['RC', 'emitido'],
      ['FT', 'emitido'],
      ['RC', 'emitido'],
    ])
    expect(docs.every((d) => d.emissor === 'moloni' && /^(FT|FR|RC) M2026\/\d+$/.test(d.numero!))).toBe(true)
    expect(moloni.pedidos.length).toBeGreaterThan(20)
    expect(c.stripe.chamadas.length).toBeGreaterThan(10)

    // ——— e nada do que saiu tem dados pessoais
    semDadosPessoais('Stripe', JSON.stringify(c.stripe.chamadas))
    semDadosPessoais('Moloni', JSON.stringify(moloni.pedidos))
    semDadosPessoais('registos', JSON.stringify(c.registo.linhas))
    // nem uuids internos nas referências impressas no documento
    for (const p of moloni.pedidos) {
      const ref = p.corpo?.your_reference
      if (typeof ref === 'string') expect(ref).toMatch(/^(FT|FR|RC)-[0-9A-F]{16}$/)
    }
    // o NIF da família só foi ao Moloni (Fatura-Recibo), nunca ao Stripe
    expect(JSON.stringify(c.stripe.chamadas)).not.toContain('123456789')
    expect(JSON.stringify(moloni.pedidos)).toContain('123456789')
  })

  it('se a BD devolvesse um nome numa linha, o documento falha em vez de o enviar', () => {
    const doc: DocumentoPendenteRpc = {
      id: 'd',
      tipo: 'FT',
      chave: 'FT:x',
      tentativas: 0,
      origem: 'entradas',
      instituicao_id: 'l',
      user_id: null,
      pagamento_id: null,
      fatura_id: null,
      data: '2026-10-13',
      vencimento: '2026-11-12',
      cliente: { tipo: 'empresa', pais: 'PT', razao_social: 'L, Lda.', nif: '599999993', morada: 'R', codigo_postal: '4200-187', localidade: 'P', email: 'e@l.pt' },
      linhas: [{ tipo: 'entrada', referencia: DADOS_PESSOAIS.residente, entrada_data: '2026-09-30', valor_centimos: 15000, iva_percent: 23 }],
      pagamento: null,
      documentos_associados: [],
      total_centimos: 18450,
      iva_centimos: 3450,
      demonstracao: false,
    }
    expect(() => pedidoDoDocumento(doc)).toThrow(RangeError)
    expect(() => pedidoDoDocumento({ ...doc, linhas: [{ tipo: 'mensalidade', periodo_inicio: DADOS_PESSOAIS.residente, periodo_fim: '2026-11-12', valor_centimos: 2900, iva_percent: 23 }] })).toThrow(RangeError)
  })

  it('os eventos do Stripe com dados de cliente (nome, email, morada) não passam para as operações', async () => {
    const { interpretarEvento } = await import('../../functions/_shared/stripe/eventos.ts')
    const sessao = {
      ...sessaoCheckout({ id: 'cs_1', pagamentoId: 'p-1', payment_intent: 'pi_1', amount_total: 1490 }),
      customer_details: { name: DADOS_PESSOAIS.familiar, email: 'graca@exemplo.pt', phone: DADOS_PESSOAIS.telefone, address: { line1: 'Rua X' } },
    }
    const r = interpretarEvento(evento('checkout.session.completed', sessao), { paymentIntent: paymentIntent({ id: 'pi_1', tipo: 'card' }) })
    semDadosPessoais('operações', JSON.stringify(r))
    expect(JSON.stringify(r)).not.toContain('graca@exemplo.pt')
  })
})
