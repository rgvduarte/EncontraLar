/**
 * Um mês da taxa por entrada (v1) com as tarefas agendadas (faturar-mes): FT por entrada faturável →
 * cobrança Stripe no dia 1 → débito SEPA depois do pré-aviso → invoice.paid → RC. E as falhas: débito
 * recusado, rede, emissor em baixo, queda a meio, autenticação e arrendamento do cron.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { criarCenario, json, type Cenario } from './cenario.ts'
import { AMBIENTE_TESTE, DIA, evento, faturaComPagamento, faturaStripe, iso, T0 } from './fakes.ts'

let c: Cenario
const LAR = 'jardins-do-douro'

beforeEach(() => {
  c = criarCenario()
  c.bd.lar(LAR, { stripe_customer_id: 'cus_lar', stripe_payment_method_id: 'pm_sepa', metodo: { tipo: 'sepa_debit', ultimos4: '3000', mandato_ref: 'M-1' } })
})

function entradasDoMes() {
  const e1 = c.bd.entrada(LAR, { lar_em: iso(T0 - 19 * DIA), entrada_data: '2026-09-23' }) // o lar confirmou
  const e2 = c.bd.entrada(LAR, { lar_em: null, familia_em: iso(T0 - 20 * DIA), entrada_data: '2026-09-22' }) // família há 20 dias
  const e3 = c.bd.entrada(LAR, { lar_em: null, familia_em: iso(T0 - 3 * DIA), entrada_data: '2026-10-09' }) // família há 3 dias
  c.bd.entrada(LAR, { taxa: 'incluida' })
  c.bd.lar('ipss-1', { natureza: 'ipss' })
  c.bd.entrada('ipss-1', { taxa: 'isenta' })
  c.bd.lar('demo-1', { demonstracao: true, stripe_customer_id: 'cus_demo' })
  c.bd.entrada('demo-1')
  return { e1, e2, e3 }
}

const ftsDoLar = () => c.bd.documentosDe({ tipo: 'FT', origem: 'entradas' }).filter((d) => d.instituicao_id === LAR)

describe('um mês por entrada', () => {
  it('FT por entrada faturável → cobrança no dia 1 → débito no fim do pré-aviso → paga → RC', async () => {
    const { e1, e2, e3 } = entradasDoMes()

    // 13/10: duas entradas faturáveis (lar confirmou; família há mais de 14 dias)
    expect((await c.cron('diario')).status).toBe(202)
    expect(ftsDoLar().map((d) => [d.chave, d.estado, d.numero, d.total_centimos])).toEqual([
      [`FT:${e1.candidatura_id}`, 'emitido', 'FT F2026/1', 18450],
      [`FT:${e2.candidatura_id}`, 'emitido', 'FT F2026/2', 18450],
    ])
    expect(c.emissor.documentos()[0]!.linhas[0]!.descricao).toMatch(/^Pedido EL-3F9A2B1C · entrada a 23\/09\/2026$/)
    // incluída, isenta e demonstração nunca geram linha
    expect([...c.bd.linhas.values()].map((l) => l.instituicao_id)).toEqual([LAR, LAR])

    // 25/10: a terceira passou os 14 dias sem contestação
    c.relogio.agora = Date.parse('2026-10-25T06:13:00Z')
    await c.cron('diario')
    expect(ftsDoLar().map((d) => d.numero)).toEqual(['FT F2026/1', 'FT F2026/2', 'FT F2026/3'])
    expect(ftsDoLar()[2]!.chave).toBe(`FT:${e3.candidatura_id}`)

    // 1/11 07:07 UTC: cobrança do mês de outubro (uma fatura Stripe com 3 linhas + IVA)
    c.relogio.agora = Date.parse('2026-11-01T07:07:00Z')
    expect((await c.cron('cobranca')).status).toBe(202)
    const fatura = [...c.bd.faturas.values()].find((f) => f.instituicao_id === LAR)!
    expect(fatura).toMatchObject({ periodo: '2026-10-01', estado: 'emitida', cobranca: 'debito_automatico', total_centimos: 55350, debito_em: '2026-11-04T00:00:00.000Z' })
    const inv = c.stripe.faturas.get(fatura.stripe_invoice_id!)!
    expect(inv.params).toMatchObject({ collection_method: 'charge_automatically', auto_advance: false, custom_fields: [{ name: 'Faturas', value: 'FT F2026/1, FT F2026/2, FT F2026/3' }] })
    expect(inv.itens.map((i) => [i.amount, i.description])).toEqual([
      [15000, 'Pedido EL-3F9A2B1C · entrada a 23/09/2026'],
      [15000, expect.stringMatching(/^Pedido EL-[0-9A-F]{8} · entrada a 22\/09\/2026$/)],
      [15000, expect.stringMatching(/^Pedido EL-[0-9A-F]{8} · entrada a 09\/10\/2026$/)],
      [10350, 'IVA 23 % sobre 450,00 €'],
    ])
    expect(inv.status).toBe('open')
    expect(c.stripe.chamadasDe('enviarFatura')).toHaveLength(0)

    // o finalized chega pelo webhook (fatura já emitida: nada muda)
    await c.entregar(evento('invoice.finalized', faturaStripe({ id: fatura.stripe_invoice_id!, total: 55350, faturaId: fatura.id, instituicaoId: LAR })))
    expect(c.bd.faturas.get(fatura.id)?.estado).toBe('emitida')

    // 2/11: ainda no pré-aviso SEPA, nada se debita
    c.relogio.agora = Date.parse('2026-11-02T06:13:00Z')
    await c.cron('diario')
    expect(c.stripe.chamadasDe('pagarFatura')).toHaveLength(0)

    // 4/11: débito (SEPA fica em processamento)
    c.relogio.agora = Date.parse('2026-11-04T06:13:00Z')
    await c.cron('diario')
    expect(c.stripe.chamadasDe('pagarFatura')).toEqual([
      { metodo: 'pagarFatura', id: fatura.stripe_invoice_id, params: { off_session: true }, opcoes: { idempotencyKey: `debito:${fatura.id}:2026-11-04` } },
    ])
    expect(c.bd.faturas.get(fatura.id)?.estado).toBe('em_processamento')

    // 8/11: o banco confirma → invoice.paid → RC das três FT
    c.relogio.agora = Date.parse('2026-11-08T10:00:00Z')
    c.stripe.faturasComPagamentos.set(fatura.stripe_invoice_id!, faturaComPagamento(fatura.stripe_invoice_id!, 'sepa_debit'))
    await c.entregar(evento('invoice.paid', faturaStripe({ id: fatura.stripe_invoice_id!, total: 55350, faturaId: fatura.id }), { created: Math.floor(c.relogio.agora / 1000) }))
    expect(c.bd.faturas.get(fatura.id)).toMatchObject({ estado: 'paga', metodo: 'sepa_debit' })
    const rc = c.bd.documentosDe({ tipo: 'RC' })
    expect(rc).toHaveLength(1)
    expect(rc[0]).toMatchObject({ estado: 'emitido', numero: 'RC F2026/1', total_centimos: 55350, pagamento: { metodo: 'sepa_debit', valor_centimos: 55350 } })
    expect(c.emissor.documentos().at(-1)!.documentos.map((d) => d.valorCentimos)).toEqual([18450, 18450, 18450])

    // nada fica por emitir; a próxima tarefa não refatura
    await c.cron('diario')
    expect(c.bd.documentosDe({}).every((d) => d.estado === 'emitido')).toBe(true)
    expect(c.bd.linhas.size).toBe(2 + 1)
  })

  it('sem método de pagamento: cobrança por link (send_invoice, 15 dias), nunca débito', async () => {
    const lar = c.bd.instituicoes.get(LAR)!
    Object.assign(lar, { stripe_payment_method_id: null, metodo: null })
    c.bd.entrada(LAR)
    await c.cron('diario')
    c.relogio.agora = Date.parse('2026-11-01T07:07:00Z')
    await c.cron('cobranca')
    const f = [...c.bd.faturas.values()][0]!
    expect(f).toMatchObject({ cobranca: 'pagamento_por_link', debito_em: null })
    expect(c.stripe.faturas.get(f.stripe_invoice_id!)!.params).toMatchObject({ collection_method: 'send_invoice', days_until_due: 15 })
    expect(c.stripe.chamadasDe('enviarFatura')).toHaveLength(1)
    c.relogio.agora = Date.parse('2026-11-10T06:13:00Z')
    await c.cron('diario')
    expect(c.stripe.chamadasDe('pagarFatura')).toHaveLength(0)
  })
})

describe('falhas', () => {
  async function ateAoDebito() {
    c.bd.entrada(LAR)
    await c.cron('diario')
    c.relogio.agora = Date.parse('2026-11-01T07:07:00Z')
    await c.cron('cobranca')
    c.relogio.agora = Date.parse('2026-11-04T06:13:00Z')
    return [...c.bd.faturas.values()][0]!
  }

  it('cartão recusado no débito → falhou + motivo normalizado + aviso ao lar', async () => {
    const f = await ateAoDebito()
    c.stripe.resultadoPagar = () => Object.assign(new Error('Your card has insufficient funds.'), { type: 'StripeCardError', code: 'card_declined', decline_code: 'insufficient_funds' })
    await c.cron('diario')
    expect(c.bd.faturas.get(f.id)).toMatchObject({ estado: 'falhou', motivo: 'saldo_insuficiente' })
    expect(c.bd.alertas).toContainEqual({ tipo: 'pagamento_falhou', ref: f.id })
  })

  it('erro de rede no débito → a fatura fica emitida e tenta-se no dia seguinte (nova chave)', async () => {
    const f = await ateAoDebito()
    c.stripe.resultadoPagar = () => Object.assign(new Error('socket hang up'), { type: 'StripeConnectionError' })
    await c.cron('diario')
    expect(c.bd.faturas.get(f.id)?.estado).toBe('emitida')
    c.stripe.resultadoPagar = () => 'paid'
    c.relogio.avancar(DIA)
    await c.cron('diario')
    expect(c.bd.faturas.get(f.id)?.estado).toBe('paga')
    expect(c.stripe.chamadasDe('pagarFatura').map((x) => x.opcoes?.idempotencyKey)).toEqual([`debito:${f.id}:2026-11-04`, `debito:${f.id}:2026-11-05`])
    // pago com cartão logo no débito: o RC sai na mesma tarefa (servico_cobranca_debito_iniciado → paga)
    c.relogio.avancar(DIA)
    await c.cron('diario')
    expect(c.bd.documentosDe({ tipo: 'RC' })[0]?.estado).toBe('emitido')
  })

  it('emissor em baixo → documento em erro; a tarefa seguinte emite-o', async () => {
    c.bd.entrada(LAR)
    const emitir = c.emissor.emitirFatura.bind(c.emissor)
    let falhas = 1
    c.emissor.emitirFatura = async (d) => {
      if (falhas-- > 0) throw new Error('Moloni indisponível')
      return emitir(d)
    }
    await c.cron('diario')
    expect(ftsDoLar()[0]).toMatchObject({ estado: 'erro', tentativas: 1, ultimo_erro: 'Error: Moloni indisponível' })
    c.relogio.avancar(DIA)
    await c.cron('diario')
    expect(ftsDoLar()[0]).toMatchObject({ estado: 'emitido', numero: 'FT F2026/1' })
  })

  it('queda depois de emitir e antes de registar → recupera pela chave, sem número duplicado', async () => {
    c.bd.entrada(LAR)
    c.bd.falhar.set('servico_documento_emitido', new Error('ligação perdida'))
    await c.cron('diario')
    expect(ftsDoLar()[0]?.estado).toBe('erro')
    expect(c.emissor.criados).toBe(1)
    c.relogio.avancar(DIA)
    await c.cron('diario')
    expect(ftsDoLar()[0]).toMatchObject({ estado: 'emitido', numero: 'FT F2026/1' })
    expect(c.emissor.criados).toBe(1)
  })

  it('o Stripe falha a meio da cobrança → a fatura fica em rascunho; no mesmo dia as chaves de idempotência evitam duplicados', async () => {
    c.bd.entrada(LAR)
    await c.cron('diario')
    c.relogio.agora = Date.parse('2026-11-01T07:07:00Z')
    c.stripe.falhar.set('finalizarFatura', Object.assign(new Error('api'), { type: 'StripeAPIError' }))
    await c.cron('cobranca')
    const f = [...c.bd.faturas.values()][0]!
    expect(f.estado).toBe('rascunho')
    expect(c.registo.linhas.some((l) => l.evento === 'cobranca_falhou')).toBe(true)
  })
})

describe('faturar-mes: autenticação e arrendamento', () => {
  it('segredo errado ou ausente → 401; fase inválida → 400; só POST', async () => {
    expect((await c.cron('diario', 'segredo-errado-mas-com-mais-de-32-caracteres!!')).status).toBe(401)
    expect((await c.handlers.faturarMes(new Request('https://x/', { method: 'POST', body: '{"fase":"diario"}' }))).status).toBe(401)
    const r = await c.handlers.faturarMes(new Request('https://x/', { method: 'POST', headers: { 'x-encontralar-cron': AMBIENTE_TESTE.FATURACAO_CRON_SECRET! }, body: '{"fase":"tudo"}' }))
    expect(r.status).toBe(400)
    expect((await c.handlers.faturarMes(new Request('https://x/', { method: 'GET' }))).status).toBe(405)
    expect(c.bd.chamadas).toHaveLength(0)
  })

  it('responde 202 logo e corre em segundo plano; uma segunda execução simultânea não faz nada', async () => {
    c.bd.entrada(LAR)
    const r = await c.handlers.faturarMes(
      new Request('https://x/', { method: 'POST', headers: { 'x-encontralar-cron': AMBIENTE_TESTE.FATURACAO_CRON_SECRET! }, body: '{"fase":"diario"}' }),
    )
    expect(r.status).toBe(202)
    expect(await json(r)).toEqual({ aceite: true, fase: 'diario' })
    expect(c.agendados).toHaveLength(1)
    await c.esperar()
    expect(c.registo.linhas.find((l) => l.evento === 'faturar_diario')?.dados).toMatchObject({ ignorado: false, reservados: 1, documentos: { emitidos: 1, falhados: 0 } })
    expect(c.bd.execucoes.has('diario')).toBe(false) // arrendamento libertado no fim

    // outra execução enquanto alguém tem o arrendamento: não faz nada
    c.bd.entrada(LAR)
    c.bd.execucoes.set('diario', c.relogio.agora + 60_000)
    await c.cron('diario')
    expect(c.registo.linhas.filter((l) => l.evento === 'faturar_diario').at(-1)?.dados).toEqual({ ignorado: true })
    expect(c.bd.linhas.size).toBe(1)
    // o arrendamento expira (função que morreu a meio): a seguinte corre
    c.relogio.avancar(61_000)
    await c.cron('diario')
    expect(c.bd.linhas.size).toBe(2)
  })
})
