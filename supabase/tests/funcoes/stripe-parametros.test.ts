/**
 * Parâmetros exatos dos pedidos ao Stripe (stripe/parametros.ts). Os snapshots são o contrato com o Stripe:
 * qualquer mudança aparece na revisão. O `tsc` confirma os tipos contra o SDK fixado (stripe@23, API endive).
 */
import { describe, expect, it } from 'vitest'
import {
  ID_SESSAO,
  parametrosAtualizarCliente,
  parametrosCancelarSubscricao,
  parametrosCheckoutAcesso,
  parametrosCheckoutMandato,
  parametrosCliente,
  parametrosMetodoPredefinido,
  parametrosMetodoSubscricao,
  parametrosPagarFatura,
  parametrosPortal,
  parametrosSubscricao,
  parametrosTaxId,
  planoCobrancaMensal,
  urlRetorno,
  valoresMensalidade,
  voltarSeguro,
} from '../../functions/_shared/stripe/parametros.ts'
import type { CobrancaPreparadaRpc, DadosFiscaisRpc } from '../../functions/_shared/portas.ts'
import { T0 } from './fakes.ts'

const APP = 'https://encontralar.example/app/'
const DADOS: DadosFiscaisRpc = { razao_social: 'Cuidados Exemplo, Lda.', nif: '599999993', morada: 'Rua das Camélias 128', codigo_postal: '4200-187', localidade: 'Porto', email: 'faturacao@lar.exemplo.pt' }

describe('(a) Acesso Família: Checkout mode=payment', () => {
  it('30 dias', () => {
    const p = parametrosCheckoutAcesso({ pagamentoId: 'pag-1', plano: 'acesso_30', userId: 'user-1', email: 'familia@exemplo.pt', appUrl: APP, agora: T0, voltar: '/lar/jardins?x=1' })
    expect(p).toMatchInlineSnapshot(`
      {
        "opcoes": {
          "idempotencyKey": "acesso-checkout:pag-1",
        },
        "params": {
          "allowed_payment_method_types": [
            "card",
            "mb_way",
            "multibanco",
          ],
          "cancel_url": "https://encontralar.example/app/?acesso=cancelado&voltar=%2Flar%2Fjardins%3Fx%3D1",
          "client_reference_id": "user-1",
          "currency": "eur",
          "custom_text": {
            "submit": {
              "message": "O acesso começa assim que o pagamento é confirmado (por Multibanco, quando a referência for paga). Não há renovação automática.",
            },
          },
          "customer_email": "familia@exemplo.pt",
          "expires_at": 1791885600,
          "line_items": [
            {
              "price_data": {
                "currency": "eur",
                "product_data": {
                  "description": "Passe sem renovação automática. IVA incluído.",
                  "name": "Acesso Família — 30 dias",
                },
                "unit_amount": 1490,
              },
              "quantity": 1,
            },
          ],
          "locale": "pt",
          "metadata": {
            "pagamento_id": "pag-1",
            "plano": "acesso_30",
          },
          "mode": "payment",
          "payment_intent_data": {
            "description": "EncontraLar — Acesso Família — 30 dias",
            "metadata": {
              "pagamento_id": "pag-1",
              "plano": "acesso_30",
            },
          },
          "submit_type": "pay",
          "success_url": "https://encontralar.example/app/?acesso=sucesso&sessao={CHECKOUT_SESSION_ID}&voltar=%2Flar%2Fjardins%3Fx%3D1",
        },
      }
    `)
  })

  it('90 dias: só mudam o valor, o nome e a metadata', () => {
    const p30 = parametrosCheckoutAcesso({ pagamentoId: 'pag-1', plano: 'acesso_30', userId: 'u', email: null, appUrl: APP, agora: T0, voltar: null })
    const p90 = parametrosCheckoutAcesso({ pagamentoId: 'pag-1', plano: 'acesso_90', userId: 'u', email: null, appUrl: APP, agora: T0, voltar: null })
    expect(p90.params.line_items![0]!.price_data!.unit_amount).toBe(2990)
    expect(p90.params.line_items![0]!.price_data!.product_data!.name).toBe('Acesso Família — 90 dias')
    expect(p90.params.metadata).toEqual({ pagamento_id: 'pag-1', plano: 'acesso_90' })
    expect(p30.params).not.toHaveProperty('customer_email')
    expect(p30.params.success_url).toBe(`${APP}?acesso=sucesso&sessao=${ID_SESSAO}`)
    expect(p30.params.cancel_url).toBe(`${APP}?acesso=cancelado`)
  })

  it('expira dentro do intervalo do Stripe (30 min – 24 h) e a chave é estável por pagamento', () => {
    const p = parametrosCheckoutAcesso({ pagamentoId: 'pag-9', plano: 'acesso_30', userId: 'u', email: null, appUrl: APP, agora: T0, voltar: null })
    const s = p.params.expires_at! - Math.floor(T0 / 1000)
    expect(s).toBeGreaterThanOrEqual(30 * 60)
    expect(s).toBeLessThanOrEqual(24 * 3600)
    expect(p.opcoes.idempotencyKey).toBe('acesso-checkout:pag-9')
    expect(parametrosCheckoutAcesso({ pagamentoId: 'pag-9', plano: 'acesso_30', userId: 'u', email: null, appUrl: APP, agora: T0 + 5000, voltar: null }).opcoes.idempotencyKey).toBe('acesso-checkout:pag-9')
  })
})

describe('URLs de regresso', () => {
  it('sem #, com o marcador da sessão por codificar, e só caminhos internos em voltar', () => {
    const u = urlRetorno('https://x.example/app/#/acesso', { acesso: 'sucesso', sessao: ID_SESSAO, voltar: '/lar/a b' })
    expect(u).toBe('https://x.example/app/?acesso=sucesso&sessao={CHECKOUT_SESSION_ID}&voltar=%2Flar%2Fa%20b')
    expect(u).not.toContain('#')
    expect(voltarSeguro('/lar/jardins-do-douro?tab=vagas')).toBe('/lar/jardins-do-douro?tab=vagas')
    for (const mau of ['//evil.example', 'https://evil.example', 'javascript:alert(1)', '/a/../../b', 'lar', '/<script>', 42, null]) expect(voltarSeguro(mau)).toBeNull()
  })
})

describe('(b) lares: cliente e mandato SEPA/cartão (v1)', () => {
  it('cliente com NIF como eu_vat PT e metadata só com o id', () => {
    expect(parametrosCliente('lar-1', DADOS)).toMatchInlineSnapshot(`
      {
        "opcoes": {
          "idempotencyKey": "cliente:lar-1",
        },
        "params": {
          "address": {
            "city": "Porto",
            "country": "PT",
            "line1": "Rua das Camélias 128",
            "postal_code": "4200-187",
          },
          "email": "faturacao@lar.exemplo.pt",
          "metadata": {
            "instituicao_id": "lar-1",
          },
          "name": "Cuidados Exemplo, Lda.",
          "preferred_locales": [
            "pt",
          ],
          "tax_id_data": [
            {
              "type": "eu_vat",
              "value": "PT599999993",
            },
          ],
        },
      }
    `)
    expect(parametrosTaxId('lar-1', '599999993')).toEqual({ params: { type: 'eu_vat', value: 'PT599999993' }, opcoes: { idempotencyKey: 'taxid:lar-1:599999993' } })
  })

  it('atualizar cliente: a chave muda quando os dados mudam', () => {
    const a = parametrosAtualizarCliente('lar-1', DADOS)
    const b = parametrosAtualizarCliente('lar-1', { ...DADOS, email: 'outro@lar.pt' })
    expect(a.opcoes.idempotencyKey).toMatch(/^cliente-atualizar:lar-1:[0-9a-f]{8}$/)
    expect(a.opcoes.idempotencyKey).not.toBe(b.opcoes.idempotencyKey)
    expect(a.params).not.toHaveProperty('tax_id_data')
  })

  it('Checkout em modo setup', () => {
    expect(parametrosCheckoutMandato({ instituicaoId: 'lar-1', customerId: 'cus_1', appUrl: APP, agora: T0 })).toMatchInlineSnapshot(`
      {
        "opcoes": {
          "idempotencyKey": "mandato:lar-1:29864700",
        },
        "params": {
          "allowed_payment_method_types": [
            "sepa_debit",
            "card",
          ],
          "cancel_url": "https://encontralar.example/app/?faturacao=metodo-cancelado",
          "currency": "eur",
          "customer": "cus_1",
          "locale": "pt",
          "metadata": {
            "instituicao_id": "lar-1",
          },
          "mode": "setup",
          "setup_intent_data": {
            "description": "EncontraLar — autorização de débito das faturas",
            "metadata": {
              "instituicao_id": "lar-1",
            },
          },
          "success_url": "https://encontralar.example/app/?faturacao=metodo-ok&sessao={CHECKOUT_SESSION_ID}",
        },
      }
    `)
  })

  it('portal e método predefinido', () => {
    expect(parametrosPortal('cus_1', APP, T0)).toMatchInlineSnapshot(`
      {
        "opcoes": {
          "idempotencyKey": "portal:cus_1:29864700",
        },
        "params": {
          "customer": "cus_1",
          "locale": "pt",
          "return_url": "https://encontralar.example/app/?faturacao=portal",
        },
      }
    `)
    expect(parametrosMetodoPredefinido('cus_1', 'pm_1')).toEqual({
      params: { invoice_settings: { default_payment_method: 'pm_1' } },
      opcoes: { idempotencyKey: 'metodo-predefinido:cus_1:pm_1' },
    })
    expect(parametrosMetodoSubscricao('sub_1', 'pm_2').params).toEqual({ default_payment_method: 'pm_2' })
  })
})

describe('(c) mensalidade: subscrição com IVA explícito (sem Stripe Tax)', () => {
  it('23 % (Continente)', () => {
    expect(
      parametrosSubscricao({ instituicaoId: 'lar-1', customerId: 'cus_1', paymentMethodId: 'pm_1', ivaPercent: 23, planoDesde: '2026-10-13T09:00:00.000Z', compromissoAte: '2027-10-13T09:00:00.000Z' }),
    ).toMatchInlineSnapshot(`
      {
        "opcoes": {
          "idempotencyKey": "subscricao:lar-1:2026-10-13T09:00:00.000Z",
        },
        "params": {
          "collection_method": "charge_automatically",
          "currency": "eur",
          "customer": "cus_1",
          "default_payment_method": "pm_1",
          "description": "Mensalidade EncontraLar (compromisso de 12 meses). Documento de cobrança: a fatura é emitida à parte.",
          "items": [
            {
              "metadata": {
                "linha": "mensalidade",
              },
              "price_data": {
                "currency": "eur",
                "product": "el_mensalidade",
                "recurring": {
                  "interval": "month",
                },
                "unit_amount": 2900,
              },
              "quantity": 1,
            },
            {
              "metadata": {
                "iva_percent": "23",
                "linha": "iva",
              },
              "price_data": {
                "currency": "eur",
                "product": "el_iva_23",
                "recurring": {
                  "interval": "month",
                },
                "unit_amount": 667,
              },
              "quantity": 1,
            },
          ],
          "metadata": {
            "compromisso_ate": "2027-10-13T09:00:00.000Z",
            "instituicao_id": "lar-1",
            "iva_percent": "23",
          },
          "off_session": true,
          "payment_behavior": "allow_incomplete",
          "payment_settings": {
            "payment_method_types": [
              "sepa_debit",
              "card",
            ],
            "save_default_payment_method": "on_subscription",
          },
          "proration_behavior": "none",
        },
      }
    `)
  })

  it('22 % e 16 %: a linha de IVA bate com o Moloni (29,00 € + round(29,00 € × taxa))', () => {
    expect(valoresMensalidade(23)).toEqual({ liquidoCentimos: 2900, ivaPercent: 23, ivaCentimos: 667, totalCentimos: 3567 })
    expect(valoresMensalidade(22)).toEqual({ liquidoCentimos: 2900, ivaPercent: 22, ivaCentimos: 638, totalCentimos: 3538 })
    expect(valoresMensalidade(16)).toEqual({ liquidoCentimos: 2900, ivaPercent: 16, ivaCentimos: 464, totalCentimos: 3364 })
    const p = parametrosSubscricao({ instituicaoId: 'lar-2', customerId: 'cus_2', paymentMethodId: 'pm_2', ivaPercent: 16, planoDesde: 'x', compromissoAte: 'y' })
    expect(p.params.items!.map((i) => [i.price_data!.product, i.price_data!.unit_amount])).toEqual([
      ['el_mensalidade', 2900],
      ['el_iva_16', 464],
    ])
    expect(p.params).not.toHaveProperty('automatic_tax')
  })

  it('cancelar depois do compromisso: sem rateio nem fatura final', () => {
    expect(parametrosCancelarSubscricao('sub_1')).toMatchInlineSnapshot(`
      {
        "opcoes": {
          "idempotencyKey": "subscricao-cancelar:sub_1",
        },
        "params": {
          "cancellation_details": {
            "comment": "Mudança para a taxa por entrada depois do compromisso.",
          },
          "invoice_now": false,
          "prorate": false,
        },
      }
    `)
  })
})

describe('(d) cobrança mensal por entrada (v1)', () => {
  const cobranca = (pm: string | null): CobrancaPreparadaRpc => ({
    fatura_id: 'fat-1',
    instituicao_id: 'lar-1',
    periodo: '2026-10-01',
    stripe_customer_id: 'cus_1',
    stripe_payment_method_id: pm,
    linhas: [
      { referencia: 'EL-3F9A2B1C', entrada_data: '2026-09-30', valor_centimos: 15000, iva_percent: 23, iva_centimos: 3450, documento_numero: 'FT F2026/1' },
      { referencia: 'EL-0A1B2C3D', entrada_data: '2026-10-02', valor_centimos: 15000, iva_percent: 23, iva_centimos: 3450, documento_numero: 'FT F2026/2' },
    ],
    subtotal_centimos: 30000,
    iva_centimos: 6900,
    total_centimos: 36900,
  })

  it('débito automático (com mandato)', () => {
    const p = planoCobrancaMensal(cobranca('pm_1'), { diasPagamento: 15, paisTransferencia: null })
    expect({ fatura: p.fatura, itens: p.itens.map((f) => f('in_1')), finalizar: p.finalizar, enviar: p.enviar, cobranca: p.cobranca, total: p.totalCentimos }).toMatchInlineSnapshot(`
      {
        "cobranca": "debito_automatico",
        "enviar": null,
        "fatura": {
          "opcoes": {
            "idempotencyKey": "cobranca:fat-1:fatura",
          },
          "params": {
            "auto_advance": false,
            "collection_method": "charge_automatically",
            "currency": "eur",
            "custom_fields": [
              {
                "name": "Faturas",
                "value": "FT F2026/1, FT F2026/2",
              },
            ],
            "customer": "cus_1",
            "default_payment_method": "pm_1",
            "description": "Taxa por entrada — outubro de 2026. Documento de cobrança: não substitui a fatura.",
            "footer": "Faturas emitidas por software certificado pela AT (Moloni), disponíveis no painel da instituição.",
            "metadata": {
              "fatura_id": "fat-1",
              "instituicao_id": "lar-1",
              "periodo": "2026-10-01",
            },
            "payment_settings": {
              "payment_method_types": [
                "sepa_debit",
                "card",
              ],
            },
            "pending_invoice_items_behavior": "exclude",
          },
        },
        "finalizar": {
          "opcoes": {
            "idempotencyKey": "cobranca:fat-1:finalizar",
          },
          "params": {
            "auto_advance": false,
          },
        },
        "itens": [
          {
            "opcoes": {
              "idempotencyKey": "cobranca:fat-1:linha:0",
            },
            "params": {
              "amount": 15000,
              "currency": "eur",
              "customer": "cus_1",
              "description": "Pedido EL-3F9A2B1C · entrada a 30/09/2026",
              "invoice": "in_1",
            },
          },
          {
            "opcoes": {
              "idempotencyKey": "cobranca:fat-1:linha:1",
            },
            "params": {
              "amount": 15000,
              "currency": "eur",
              "customer": "cus_1",
              "description": "Pedido EL-0A1B2C3D · entrada a 02/10/2026",
              "invoice": "in_1",
            },
          },
          {
            "opcoes": {
              "idempotencyKey": "cobranca:fat-1:iva:23",
            },
            "params": {
              "amount": 6900,
              "currency": "eur",
              "customer": "cus_1",
              "description": "IVA 23 % sobre 300,00 €",
              "invoice": "in_1",
            },
          },
        ],
        "total": 36900,
      }
    `)
  })

  it('sem método: send_invoice com 15 dias e transferência (customer_balance) quando configurada', () => {
    const p = planoCobrancaMensal(cobranca(null), { diasPagamento: 15, paisTransferencia: 'IE' })
    expect(p.cobranca).toBe('pagamento_por_link')
    expect(p.fatura.params).toMatchObject({ collection_method: 'send_invoice', days_until_due: 15 })
    expect(p.fatura.params.payment_settings).toEqual({
      payment_method_types: ['sepa_debit', 'card', 'customer_balance'],
      payment_method_options: { customer_balance: { funding_type: 'bank_transfer', bank_transfer: { type: 'eu_bank_transfer', eu_bank_transfer: { country: 'IE' } } } },
    })
    expect(p.enviar).toEqual({ opcoes: { idempotencyKey: 'cobranca:fat-1:enviar' } })
  })

  it('as somas dos itens dão o total da fatura; totais incoerentes são recusados', () => {
    const p = planoCobrancaMensal(cobranca('pm_1'), { diasPagamento: 15, paisTransferencia: null })
    expect(p.itens.map((f) => f('in_1').params.amount!).reduce((a, b) => a + b, 0)).toBe(36900)
    expect(() => planoCobrancaMensal({ ...cobranca('pm_1'), total_centimos: 36901 }, { diasPagamento: 15, paisTransferencia: null })).toThrow(RangeError)
    const errada = cobranca('pm_1')
    errada.linhas[0]!.iva_centimos = 3449
    errada.iva_centimos = 6899
    errada.total_centimos = 36899
    expect(() => planoCobrancaMensal(errada, { diasPagamento: 15, paisTransferencia: null })).toThrow('IVA de linha incorreto.')
  })

  it('débito: uma tentativa por dia de Lisboa', () => {
    expect(parametrosPagarFatura('fat-1', '2026-11-04')).toEqual({ params: { off_session: true }, opcoes: { idempotencyKey: 'debito:fat-1:2026-11-04' } })
  })
})
