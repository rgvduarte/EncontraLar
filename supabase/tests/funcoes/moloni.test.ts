/**
 * Moloni (nunca chamado a sério): construtores dos pedidos e MoloniEmissor com um `fetch` falso —
 * token em cache e renovado num 401, rascunho → conferir totais → fechar, totais diferentes → apagar e
 * falhar, interpretação dos erros, link do PDF e procura pela chave.
 */
import { describe, expect, it } from 'vitest'
import { ErroMoloni, interpretarResposta, MoloniEmissor } from '../../functions/_shared/moloni/cliente.ts'
import { corpoDocumento, corpoRecibo, ENDPOINTS_A_VERIFICAR, pedidoInserirCliente, pedidoToken, tipoDaChave } from '../../functions/_shared/moloni/pedidos.ts'
import { CFG_MOLONI as CFG, LINHA_ENTRADA as LINHA, moloniFalso } from './fakes.ts'
import { referenciaExterna } from '../../functions/_shared/faturacao/documentos.ts'

const token = () => ({ json: { access_token: 'tok-1', expires_in: 3600, refresh_token: 'ref-1' } })

describe('construtores', () => {
  it('token: grant password por GET', () => {
    const p = pedidoToken(CFG)
    expect(p.metodo).toBe('GET')
    expect(p.url).toBe('https://api.moloni.pt/v1/grant/?grant_type=password&client_id=cliente&client_secret=segredo&username=api%40encontralar.pt&password=pw')
  })

  it('FT (rascunho): série, cliente, referência externa opaca, produto e IVA por taxa', () => {
    expect(corpoDocumento(CFG, { tipo: 'FT', clienteId: 77, data: '2026-10-13', vencimento: '2026-11-12', linhas: [LINHA], chave: 'FT:c-1', pagamento: null }, 0)).toEqual({
      company_id: 5,
      date: '2026-10-13',
      expiration_date: '2026-11-12',
      document_set_id: 9,
      customer_id: 77,
      your_reference: referenciaExterna('FT:c-1'),
      financial_discount: 0,
      special_discount: 0,
      products: [
        { product_id: 101, name: 'Pedido EL-3F9A2B1C · entrada a 30/09/2026', summary: '', qty: 1, price: 150, discount: 0, order: 1, exemption_reason: '', taxes: [{ tax_id: 11, value: 23, order: 1, cumulative: 0 }] },
      ],
      status: 0,
    })
  })

  it('FR do Acesso Família: preço líquido 12,11 e pagamento MB WAY', () => {
    const c = corpoDocumento(
      CFG,
      {
        tipo: 'FR',
        clienteId: 1,
        data: '2026-10-13',
        vencimento: '2026-10-13',
        linhas: [{ produto: 'acesso', descricao: 'Acesso Família — 30 dias', quantidade: 1, liquidoCentimos: 1211, ivaPercent: 23, ivaCentimos: 279, totalCentimos: 1490 }],
        chave: 'FR:pag:p-1',
        pagamento: { metodo: 'mb_way', data: '2026-10-13', valorCentimos: 1490 },
      },
      1,
    )
    expect(c).toMatchObject({ products: [{ product_id: 103, price: 12.11, taxes: [{ tax_id: 11, value: 23 }] }], payments: [{ payment_method_id: 24, date: '2026-10-13', value: 14.9 }], status: 1 })
  })

  it('RC: documentos associados e pagamento', () => {
    expect(corpoRecibo(CFG, { clienteId: 77, data: '2026-11-08', chave: 'RC:f-1', documentos: [{ externoId: 1001, valorCentimos: 18450 }, { externoId: 1002, valorCentimos: 18450 }], pagamento: { metodo: 'sepa_debit', data: '2026-11-08', valorCentimos: 36900 } }, 0)).toEqual({
      company_id: 5,
      date: '2026-11-08',
      document_set_id: 9,
      customer_id: 77,
      your_reference: referenciaExterna('RC:f-1'),
      net_value: 369,
      associated_documents: [
        { associated_id: 1001, value: 184.5 },
        { associated_id: 1002, value: 184.5 },
      ],
      payments: [{ payment_method_id: 21, date: '2026-11-08', value: 369, notes: '' }],
      status: 0,
    })
  })

  it('clientes: empresa com morada; consumidor final 999999990 sem morada', () => {
    expect(pedidoInserirCliente(CFG, 't', { tipo: 'empresa', nif: '599999993', nome: 'Lar, Lda.', morada: 'Rua A', codigoPostal: '4200-187', localidade: 'Porto', pais: 'PT', email: 'f@l.pt' }, '12').corpo).toMatchObject({
      vat: '599999993',
      name: 'Lar, Lda.',
      address: 'Rua A',
      zip_code: '4200-187',
      number: '12',
    })
    expect(pedidoInserirCliente(CFG, 't', { tipo: 'consumidor_final' }, '13').corpo).toMatchObject({ vat: '999999990', name: 'Consumidor final', address: 'Desconhecido', email: '' })
  })

  it('a descrição de cada linha tem de seguir os modelos (nunca um nome)', () => {
    expect(() => corpoDocumento(CFG, { tipo: 'FT', clienteId: 1, data: '2026-10-13', vencimento: '2026-10-13', linhas: [{ ...LINHA, descricao: 'Entrada de Amélia Rocha' }], chave: 'FT:x', pagamento: null }, 0)).toThrow(RangeError)
  })

  it('referência externa: opaca, estável, única e sem uuids', () => {
    const chave = 'FT:3f9a2b1c-0000-4000-8000-000000000001'
    expect(referenciaExterna(chave)).toMatch(/^FT-[0-9A-F]{16}$/)
    expect(referenciaExterna(chave)).toBe(referenciaExterna(chave))
    const vistas = new Set<string>()
    for (let i = 0; i < 20000; i++) vistas.add(referenciaExterna(`FT:00000000-0000-4000-8000-${String(i).padStart(12, '0')}`))
    expect(vistas.size).toBe(20000)
  })

  it('tipo pela chave e lista do que verificar', () => {
    expect(['FT:c-1', 'FR:pag:p', 'RC:f', 'NC:x'].map(tipoDaChave)).toEqual(['FT', 'FR', 'RC', null])
    expect(ENDPOINTS_A_VERIFICAR.length).toBeGreaterThanOrEqual(10)
  })
})

describe('interpretarResposta', () => {
  it('erros em lista, { error }, valid: 0 e HTTP ≥ 400 → ErroMoloni sem valores', () => {
    expect(() => interpretarResposta('invoices/insert', 200, [{ code: '2 customer_id', field: 'customer_id', description: 'Cliente Amélia não existe' }])).toThrow('Moloni invoices/insert: 2 customer_id (customer_id)')
    expect(() => interpretarResposta('grant', 400, { error: 'invalid_grant', error_description: 'x' })).toThrow(ErroMoloni)
    expect(() => interpretarResposta('x', 200, { valid: 0 })).toThrow('Moloni x: invalido')
    expect(() => interpretarResposta('x', 500, {})).toThrow('http_500')
    expect(interpretarResposta('x', 200, { valid: 1, document_id: 1 })).toEqual({ valid: 1, document_id: 1 })
    try {
      interpretarResposta('customers/insert', 200, [{ code: '1', field: 'name', description: 'Amélia Rocha' }])
    } catch (e) {
      expect((e as Error).message).not.toContain('Amélia')
    }
  })
})

describe('MoloniEmissor', () => {
  function servidor(opcoes: { bruto?: string; clienteExiste?: boolean } = {}) {
    let estado = 0
    return moloniFalso({
      grant: token,
      'customers/getByVat': () => ({ json: opcoes.clienteExiste ? [{ customer_id: 77, vat: '599999993' }] : [] }),
      'customers/getNextNumber': () => ({ json: { number: '42' } }),
      'customers/insert': () => ({ json: { valid: 1, customer_id: 78 } }),
      'invoices/insert': () => ({ json: { valid: 1, document_id: 1001 } }),
      'invoices/getOne': () => ({ json: { document_id: 1001, status: estado, number: 7, document_set_name: '2026A', gross_value: opcoes.bruto ?? '184.50', taxes_value: '34.50' } }),
      'invoices/update': () => {
        estado = 1
        return { json: { valid: 1, document_id: 1001 } }
      },
      'invoices/delete': () => ({ json: { valid: 1 } }),
      'receipts/insert': () => ({ json: { valid: 1, document_id: 2001 } }),
      'receipts/getOne': () => ({ json: { document_id: 2001, status: estado, number: 3, document_set_name: '2026A', gross_value: '184.5' } }),
      'receipts/update': () => {
        estado = 1
        return { json: { valid: 1 } }
      },
      'documents/getPDFLink': () => ({ json: { url: 'https://www.moloni.pt/downloads/x.pdf' } }),
      'invoices/getAll': (c) => ({ json: c.your_reference === referenciaExterna('FT:existe') ? [{ document_id: 1001, your_reference: referenciaExterna('FT:existe'), status: 1 }] : [] }),
    })
  }

  it('FT: cliente novo → rascunho → confere totais → fecha → número "FT 2026A/7"; token pedido uma vez', async () => {
    const s = servidor()
    const m = new MoloniEmissor(CFG, s.buscar, () => Date.parse('2026-10-13T09:00:00Z'))
    const { clienteId } = await m.garantirCliente({ tipo: 'empresa', nif: '599999993', nome: 'Lar, Lda.', morada: 'Rua A', codigoPostal: '4200-187', localidade: 'Porto', pais: 'PT', email: 'f@l.pt' })
    expect(clienteId).toBe('78')
    const d = await m.emitirFatura({ tipo: 'FT', clienteId, data: '2026-10-13', vencimento: '2026-11-12', linhas: [LINHA], chave: 'FT:c-1', pagamento: null })
    expect(d).toEqual({ id: '1001', tipo: 'FT', numero: 'FT 2026A/7', totalCentimos: 18450, ivaCentimos: 3450, emitidoEm: '2026-10-13T09:00:00.000Z', chave: 'FT:c-1' })
    expect(s.pedidos.map((p) => p.endpoint)).toEqual([
      'grant',
      'customers/getByVat',
      'customers/getNextNumber',
      'customers/insert',
      'invoices/insert',
      'invoices/getOne',
      'invoices/update',
      'invoices/getOne',
    ])
    expect(s.pedidos.find((p) => p.endpoint === 'invoices/insert')!.corpo).toMatchObject({ status: 0, customer_id: 78, your_reference: referenciaExterna('FT:c-1') })
    expect(s.pedidos.find((p) => p.endpoint === 'invoices/update')!.corpo).toMatchObject({ status: 1, document_id: 1001 })
    expect(s.pedidos.filter((p) => p.endpoint !== 'grant').every((p) => p.url.includes('access_token=tok-1&json=true'))).toBe(true)
  })

  it('cliente existente: não insere outro', async () => {
    const s = servidor({ clienteExiste: true })
    const m = new MoloniEmissor(CFG, s.buscar)
    expect((await m.garantirCliente({ tipo: 'empresa', nif: '599999993', nome: 'x', morada: 'x', codigoPostal: '4200-187', localidade: 'x', pais: 'PT', email: 'x@x.pt' })).clienteId).toBe('77')
    expect(s.pedidos.some((p) => p.endpoint === 'customers/insert')).toBe(false)
  })

  it('totais diferentes no rascunho → apaga o rascunho e falha (nada fica fechado)', async () => {
    const s = servidor({ bruto: '184.51' })
    const m = new MoloniEmissor(CFG, s.buscar)
    await expect(m.emitirFatura({ tipo: 'FT', clienteId: '78', data: '2026-10-13', vencimento: '2026-11-12', linhas: [LINHA], chave: 'FT:c-1', pagamento: null })).rejects.toThrow('totais_diferentes')
    expect(s.pedidos.map((p) => p.endpoint)).toContain('invoices/delete')
    expect(s.pedidos.map((p) => p.endpoint)).not.toContain('invoices/update')
  })

  it('RC: rascunho → confere → fecha', async () => {
    const s = servidor()
    const m = new MoloniEmissor(CFG, s.buscar)
    const rc = await m.emitirRecibo({ clienteId: '78', data: '2026-11-08', documentos: [{ externoId: '1001', valorCentimos: 18450 }], pagamento: { metodo: 'sepa_debit', data: '2026-11-08', valorCentimos: 18450 }, chave: 'RC:f-1' })
    expect(rc).toMatchObject({ id: '2001', tipo: 'RC', numero: 'RC 2026A/3', totalCentimos: 18450 })
  })

  it('token: reutilizado até perto de expirar; um 401 força a renovação (uma vez)', async () => {
    let agora = 0
    let respostas401 = 1
    const s = moloniFalso({
      grant: (_c, n) => ({ json: { access_token: `tok-${n}`, expires_in: 3600, refresh_token: 'ref' } }),
      'documents/getPDFLink': () => (respostas401-- > 0 ? { status: 401, json: { error: 'invalid_token' } } : { json: { url: 'https://www.moloni.pt/d.pdf' } }),
    })
    const m = new MoloniEmissor(CFG, s.buscar, () => agora)
    expect(await m.linkPdf('1001')).toBe('https://www.moloni.pt/d.pdf')
    expect(s.pedidos.map((p) => p.endpoint)).toEqual(['grant', 'documents/getPDFLink', 'grant', 'documents/getPDFLink'])
    expect(s.pedidos[2]!.url).toContain('grant_type=refresh_token')
    await m.linkPdf('1001')
    expect(s.pedidos.filter((p) => p.endpoint === 'grant')).toHaveLength(2)
    agora = 3600_000 - 30_000 // a menos de 60 s de expirar
    await m.linkPdf('1001')
    expect(s.pedidos.filter((p) => p.endpoint === 'grant')).toHaveLength(3)
  })

  it('procurarPorChave: encontra um documento fechado com essa referência', async () => {
    const s = servidor()
    const m = new MoloniEmissor(CFG, s.buscar)
    expect(await m.procurarPorChave('FT:nao-existe')).toBeNull()
    expect(await m.procurarPorChave('NC:x')).toBeNull()
    const d = await m.procurarPorChave('FT:existe')
    expect(d).toMatchObject({ id: '1001', tipo: 'FT', chave: 'FT:existe' })
  })

  it('link do PDF tem de ser https', async () => {
    const s = moloniFalso({ grant: token, 'documents/getPDFLink': () => ({ json: { url: 'http://inseguro' } }) })
    await expect(new MoloniEmissor(CFG, s.buscar).linkPdf('1')).rejects.toThrow('sem_url')
  })
})
