/** Documentos fiscais: agrupamento FT/FR/RC por modo, chaves, descrições minimizadas e o emissor falso. */
import { describe, expect, it } from 'vitest'
import {
  assegurarDescricaoSegura,
  chaveDocumento,
  descricaoAcesso,
  descricaoEntrada,
  descricaoMensalidade,
  descricaoSegura,
  ErroDocumento,
  pedidoDoDocumento,
  planearDocumentosEntradas,
  type LinhaEntradaPlano,
} from '../../functions/_shared/faturacao/documentos.ts'
import { EmissorFalso } from '../../functions/_shared/faturacao/emissor.ts'
import type { DocumentoPendenteRpc } from '../../functions/_shared/portas.ts'
import { DADOS_PESSOAIS } from './fakes.ts'

const linhas: LinhaEntradaPlano[] = [
  { candidaturaId: 'c-1', referencia: 'EL-3F9A2B1C', entradaData: '2026-09-30', valorCentimos: 15000, ivaPercent: 23 },
  { candidaturaId: 'c-2', referencia: 'EL-0A1B2C3D', entradaData: '2026-10-02', valorCentimos: 15000, ivaPercent: 23 },
]

describe('descrições (minimização de dados)', () => {
  it('só referência e datas', () => {
    expect(descricaoEntrada('EL-3F9A2B1C', '2026-09-30')).toBe('Pedido EL-3F9A2B1C · entrada a 30/09/2026')
    expect(descricaoMensalidade('2026-10-13', '2026-11-12')).toBe('Mensalidade EncontraLar · 13/10/2026 a 12/11/2026')
    expect(descricaoAcesso('acesso_30')).toBe('Acesso Família — 30 dias')
    expect(descricaoAcesso('acesso_90')).toBe('Acesso Família — 90 dias')
  })

  it('recusa qualquer texto fora dos modelos (ex.: um nome)', () => {
    expect(() => descricaoEntrada(DADOS_PESSOAIS.residente, '2026-09-30')).toThrow(RangeError)
    expect(descricaoSegura(`Pedido EL-3F9A2B1C · ${DADOS_PESSOAIS.residente}`)).toBe(false)
    expect(() => assegurarDescricaoSegura(`Entrada de ${DADOS_PESSOAIS.residente}`)).toThrow(RangeError)
    expect(assegurarDescricaoSegura('Acesso Família — 90 dias')).toBe('Acesso Família — 90 dias')
  })
})

describe('chaves e agrupamento por modo', () => {
  it('chaves únicas da fila', () => {
    expect(chaveDocumento({ tipo: 'FT', entrada: 'c-1' })).toBe('FT:c-1')
    expect(chaveDocumento({ tipo: 'FT', fatura: 'f-1' })).toBe('FT:f-1')
    expect(chaveDocumento({ tipo: 'FT', subscricaoInvoice: 'in_1' })).toBe('FT:sub:in_1')
    expect(chaveDocumento({ tipo: 'RC', fatura: 'f-1' })).toBe('RC:f-1')
    expect(chaveDocumento({ tipo: 'FR', fatura: 'f-1' })).toBe('FR:f-1')
    expect(chaveDocumento({ tipo: 'FR', pagamento: 'p-1' })).toBe('FR:pag:p-1')
  })

  it('fatura_por_entrada: uma FT por entrada (quando faturável) + um RC no pagamento', () => {
    const d = planearDocumentosEntradas('f-1', linhas, 'fatura_por_entrada')
    expect(d.map((x) => [x.tipo, x.chave, x.quando, x.totais.totalCentimos])).toEqual([
      ['FT', 'FT:c-1', 'faturavel', 18450],
      ['FT', 'FT:c-2', 'faturavel', 18450],
      ['RC', 'RC:f-1', 'pagamento', 36900],
    ])
  })

  it('fatura_mensal: uma FT global + RC; fatura_recibo_mensal: uma FR no pagamento', () => {
    expect(planearDocumentosEntradas('f-1', linhas, 'fatura_mensal').map((x) => [x.tipo, x.chave, x.quando, x.totais.totalCentimos])).toEqual([
      ['FT', 'FT:f-1', 'cobranca', 36900],
      ['RC', 'RC:f-1', 'pagamento', 36900],
    ])
    expect(planearDocumentosEntradas('f-1', linhas, 'fatura_recibo_mensal').map((x) => [x.tipo, x.chave, x.quando])).toEqual([['FR', 'FR:f-1', 'pagamento']])
    expect(planearDocumentosEntradas('f-1', [], 'fatura_mensal')).toEqual([])
  })
})

const pendente = (extra: Partial<DocumentoPendenteRpc>): DocumentoPendenteRpc => ({
  id: 'd-1',
  tipo: 'FT',
  chave: 'FT:c-1',
  tentativas: 0,
  origem: 'entradas',
  instituicao_id: 'lar-1',
  user_id: null,
  pagamento_id: null,
  fatura_id: null,
  data: '2026-10-13',
  vencimento: '2026-11-12',
  cliente: { tipo: 'empresa', pais: 'PT', razao_social: 'Cuidados Exemplo, Lda.', nif: '599999993', morada: 'Rua A 1', codigo_postal: '4200-187', localidade: 'Porto', email: 'f@lar.pt' },
  linhas: [{ tipo: 'entrada', referencia: 'EL-3F9A2B1C', entrada_data: '2026-09-30', valor_centimos: 15000, iva_percent: 23 }],
  pagamento: null,
  documentos_associados: [],
  total_centimos: 18450,
  iva_centimos: 3450,
  demonstracao: false,
  ...extra,
})

describe('pedidoDoDocumento (fila → pedido ao emissor)', () => {
  it('FT de uma entrada', () => {
    expect(pedidoDoDocumento(pendente({}))).toEqual({
      tipo: 'FT',
      cliente: { tipo: 'empresa', nif: '599999993', nome: 'Cuidados Exemplo, Lda.', morada: 'Rua A 1', codigoPostal: '4200-187', localidade: 'Porto', pais: 'PT', email: 'f@lar.pt' },
      data: '2026-10-13',
      vencimento: '2026-11-12',
      linhas: [{ produto: 'entrada', descricao: 'Pedido EL-3F9A2B1C · entrada a 30/09/2026', quantidade: 1, liquidoCentimos: 15000, ivaPercent: 23, ivaCentimos: 3450, totalCentimos: 18450 }],
      chave: 'FT:c-1',
      pagamento: null,
      subtotalCentimos: 15000,
      ivaCentimos: 3450,
      totalCentimos: 18450,
    })
  })

  it('FR do Acesso Família: preço com IVA separado ao cêntimo (consumidor final)', () => {
    const p = pedidoDoDocumento(
      pendente({
        tipo: 'FR',
        chave: 'FR:pag:p-1',
        origem: 'acesso',
        instituicao_id: null,
        user_id: 'u-1',
        pagamento_id: 'p-1',
        vencimento: null,
        cliente: { tipo: 'consumidor_final' },
        linhas: [{ tipo: 'acesso', plano: 'acesso_30', valor_centimos: 1490, iva_percent: 23 }],
        pagamento: { metodo: 'mb_way', data: '2026-10-13', valor_centimos: 1490 },
        total_centimos: 1490,
        iva_centimos: 279,
      }),
    )
    expect(p).toMatchObject({
      tipo: 'FR',
      cliente: { tipo: 'consumidor_final' },
      linhas: [{ produto: 'acesso', descricao: 'Acesso Família — 30 dias', liquidoCentimos: 1211, ivaCentimos: 279, totalCentimos: 1490 }],
      pagamento: { metodo: 'mb_way', valorCentimos: 1490 },
      totalCentimos: 1490,
    })
  })

  it('FT da mensalidade e RC das FT pagas', () => {
    const ft = pedidoDoDocumento(
      pendente({ origem: 'subscricao', chave: 'FT:sub:in_1', linhas: [{ tipo: 'mensalidade', periodo_inicio: '2026-10-13', periodo_fim: '2026-11-12', valor_centimos: 2900, iva_percent: 16 }], total_centimos: 3364, iva_centimos: 464 }),
    )
    expect(ft.tipo === 'FT' && ft.linhas[0]!.descricao).toBe('Mensalidade EncontraLar · 13/10/2026 a 12/11/2026')
    const rc = pedidoDoDocumento(
      pendente({
        tipo: 'RC',
        chave: 'RC:f-1',
        linhas: [],
        pagamento: { metodo: 'sepa_debit', data: '2026-11-08', valor_centimos: 36900 },
        documentos_associados: [
          { documento_id: 'd-1', externo_id: 'x1', numero: 'FT F2026/1', total_centimos: 18450 },
          { documento_id: 'd-2', externo_id: 'x2', numero: 'FT F2026/2', total_centimos: 18450 },
        ],
        total_centimos: 36900,
        iva_centimos: 0,
      }),
    )
    expect(rc).toMatchObject({ tipo: 'RC', totalCentimos: 36900, documentos: [{ externoId: 'x1', valorCentimos: 18450 }, { externoId: 'x2' }] })
  })

  it('recusa totais divergentes, FT a particulares, NC, recibos vazios', () => {
    expect(() => pedidoDoDocumento(pendente({ total_centimos: 18451 }))).toThrow(ErroDocumento)
    expect(() => pedidoDoDocumento(pendente({ cliente: { tipo: 'consumidor_final' } }))).toThrow(ErroDocumento)
    expect(() => pedidoDoDocumento(pendente({ tipo: 'NC' }))).toThrow(ErroDocumento)
    expect(() => pedidoDoDocumento(pendente({ tipo: 'RC', pagamento: { metodo: 'card', data: '2026-10-13', valor_centimos: 0 }, total_centimos: 0 }))).toThrow(ErroDocumento)
    expect(() => pedidoDoDocumento(pendente({ tipo: 'FR', pagamento: null }))).toThrow(ErroDocumento)
    // 1490 a 16 % não tem separação exata: falha em vez de arredondar
    expect(() => pedidoDoDocumento(pendente({ tipo: 'FR', cliente: { tipo: 'consumidor_final' }, linhas: [{ tipo: 'acesso', plano: 'acesso_30', valor_centimos: 1490, iva_percent: 16 }] }))).toThrow(/16 %/)
  })
})

describe('EmissorFalso', () => {
  it('números determinísticos por tipo e ano, idempotente pela chave', async () => {
    const e = new EmissorFalso({ agora: () => Date.parse('2026-10-13T09:00:00Z') })
    const { clienteId } = await e.garantirCliente({ tipo: 'consumidor_final' })
    expect((await e.garantirCliente({ tipo: 'consumidor_final' })).clienteId).toBe(clienteId)
    const linha = { produto: 'acesso' as const, descricao: 'Acesso Família — 30 dias', quantidade: 1 as const, liquidoCentimos: 1211, ivaPercent: 23 as const, ivaCentimos: 279, totalCentimos: 1490 }
    const pag = { metodo: 'card' as const, data: '2026-10-13', valorCentimos: 1490 }
    const fr1 = await e.emitirFatura({ tipo: 'FR', clienteId, data: '2026-10-13', vencimento: '2026-10-13', linhas: [linha], chave: 'FR:pag:1', pagamento: pag })
    const fr1b = await e.emitirFatura({ tipo: 'FR', clienteId, data: '2026-10-13', vencimento: '2026-10-13', linhas: [linha], chave: 'FR:pag:1', pagamento: pag })
    const fr2 = await e.emitirFatura({ tipo: 'FR', clienteId, data: '2026-10-13', vencimento: '2026-10-13', linhas: [linha], chave: 'FR:pag:2', pagamento: pag })
    const ft = await e.emitirFatura({ tipo: 'FT', clienteId, data: '2027-01-02', vencimento: '2027-02-01', linhas: [{ ...linha, produto: 'entrada', descricao: 'Pedido EL-3F9A2B1C · entrada a 30/12/2026', liquidoCentimos: 15000, ivaCentimos: 3450, totalCentimos: 18450 }], chave: 'FT:c-1', pagamento: null })
    expect([fr1.numero, fr1b.numero, fr2.numero, ft.numero]).toEqual(['FR F2026/1', 'FR F2026/1', 'FR F2026/2', 'FT F2027/1'])
    expect(fr1).toEqual(fr1b)
    expect(e.criados).toBe(3)
    expect(fr1).toMatchObject({ id: 'falso:FR:pag:1', totalCentimos: 1490, ivaCentimos: 279, emitidoEm: '2026-10-13T09:00:00.000Z' })
    const rc = await e.emitirRecibo({ clienteId, data: '2027-02-05', documentos: [{ externoId: ft.id, valorCentimos: 18450 }], pagamento: { metodo: 'sepa_debit', data: '2027-02-05', valorCentimos: 18450 }, chave: 'RC:f-1' })
    expect(rc.numero).toBe('RC F2027/1')
    expect(await e.procurarPorChave('RC:f-1')).toEqual(rc)
    expect(await e.procurarPorChave('RC:outra')).toBeNull()
    expect(decodeURIComponent(await e.linkPdf(rc.id))).toMatch(/SEM VALOR FISCAL[\s\S]*RC F2027\/1/)
  })

  it('recusa recibos que não liquidam os documentos e FR sem pagamento', async () => {
    const e = new EmissorFalso()
    await expect(e.emitirRecibo({ clienteId: 'c', data: '2026-10-13', documentos: [{ externoId: 'nao-existe', valorCentimos: 1 }], pagamento: { metodo: 'card', data: '2026-10-13', valorCentimos: 1 }, chave: 'RC:x' })).rejects.toThrow()
    await expect(e.emitirFatura({ tipo: 'FR', clienteId: 'c', data: '2026-10-13', vencimento: '2026-10-13', linhas: [], chave: 'FR:x', pagamento: null })).rejects.toThrow()
  })
})
