/**
 * Documentos fiscais: que documentos existem para cada fluxo (FT / FR / RC), as chaves únicas, e a
 * construção dos pedidos ao emissor a partir de um documento da fila (DocumentoPendenteRpc).
 *
 * Minimização de dados: as descrições saem SÓ destes modelos —
 *   entrada:     'Pedido EL-3F9A2B1C · entrada a 30/09/2026'
 *   mensalidade: 'Mensalidade EncontraLar · 13/10/2026 a 12/11/2026'
 *   acesso:      'Acesso Família — 30 dias'
 * Nunca o nome da pessoa, notas, necessidades de cuidados ou o nome do lar. assegurarDescricaoSegura() recusa
 * qualquer outro texto.
 */
import { ivaCentimos, linhaLiquida, separarIvaIncluidoOuFalhar, totaisDocumento, eTaxaIva, type LinhaValores, type TaxaIva } from './dinheiro.ts'
import { dataCurta } from './datas.ts'
import { planoFamilia, type PlanoFamiliaId } from './planos.ts'
import { referenciaValida } from './referencia.ts'
import type { ClienteDocumentoRpc, DocumentoPendenteRpc, LinhaDocumentoRpc, MetodoFamilia, MetodoPago, ModoDocumento, TipoDocumentoFiscal } from '../portas.ts'

// ————————————————————————————————————————————————————————————— descrições

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/

export function descricaoEntrada(referencia: string, entradaData: string): string {
  if (!referenciaValida(referencia)) throw new RangeError('Referência de pedido inválida.')
  return `Pedido ${referencia} · entrada a ${dataCurta(entradaData)}`
}

export const descricaoMensalidade = (inicio: string, fim: string): string => `Mensalidade EncontraLar · ${dataCurta(inicio)} a ${dataCurta(fim)}`

export function descricaoAcesso(plano: PlanoFamiliaId): string {
  const p = planoFamilia(plano)
  if (!p) throw new RangeError('Plano desconhecido.')
  return p.produto
}

const MODELOS_DESCRICAO = [
  /^Pedido EL-[0-9A-F]{8} · entrada a \d{2}\/\d{2}\/\d{4}$/,
  /^Mensalidade EncontraLar · \d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}$/,
  /^Acesso Família — (30|90) dias$/,
]

export const descricaoSegura = (d: string): boolean => MODELOS_DESCRICAO.some((r) => r.test(d))

export function assegurarDescricaoSegura(d: string): string {
  if (!descricaoSegura(d)) throw new RangeError('Descrição fora dos modelos permitidos (minimização de dados).')
  return d
}

// ————————————————————————————————————————————————————————————— chaves (documentos_fiscais.chave)

export type ChaveDocumento =
  | { tipo: 'FT'; entrada: string }
  | { tipo: 'FT'; fatura: string }
  | { tipo: 'FT'; subscricaoInvoice: string }
  | { tipo: 'RC'; fatura: string }
  | { tipo: 'FR'; fatura: string }
  | { tipo: 'FR'; pagamento: string }

export function chaveDocumento(c: ChaveDocumento): string {
  if ('entrada' in c) return `FT:${c.entrada}`
  if ('subscricaoInvoice' in c) return `FT:sub:${c.subscricaoInvoice}`
  if ('pagamento' in c) return `FR:pag:${c.pagamento}`
  return `${c.tipo}:${c.fatura}`
}

// ————————————————————————————————————————————————————————————— agrupamento (referência para o SQL)

export interface LinhaEntradaPlano {
  candidaturaId: string
  referencia: string
  entradaData: string
  valorCentimos: number
  ivaPercent: TaxaIva
}

export interface DocumentoPlaneado {
  tipo: TipoDocumentoFiscal
  chave: string
  /** quando o documento nasce */
  quando: 'faturavel' | 'cobranca' | 'pagamento'
  linhas: LinhaEntradaPlano[]
  totais: ReturnType<typeof totaisDocumento>
}

/**
 * Documentos de uma cobrança mensal de entradas, por modo (v1, decisão 6):
 * - fatura_por_entrada: uma FT por entrada logo que fica faturável; um RC (de todas) quando a cobrança é paga;
 * - fatura_mensal: uma FT global no dia 1 com todas as entradas do mês; um RC quando é paga;
 * - fatura_recibo_mensal: uma FR quando a cobrança é paga.
 */
export function planearDocumentosEntradas(faturaId: string, linhas: readonly LinhaEntradaPlano[], modo: ModoDocumento): DocumentoPlaneado[] {
  const valores = (ls: readonly LinhaEntradaPlano[]) => totaisDocumento(ls.map((l) => linhaLiquida(l.valorCentimos, l.ivaPercent)))
  if (!linhas.length) return []
  if (modo === 'fatura_por_entrada') {
    return [
      ...linhas.map((l) => ({ tipo: 'FT' as const, chave: chaveDocumento({ tipo: 'FT', entrada: l.candidaturaId }), quando: 'faturavel' as const, linhas: [l], totais: valores([l]) })),
      { tipo: 'RC', chave: chaveDocumento({ tipo: 'RC', fatura: faturaId }), quando: 'pagamento', linhas: [...linhas], totais: valores(linhas) },
    ]
  }
  if (modo === 'fatura_mensal') {
    return [
      { tipo: 'FT', chave: chaveDocumento({ tipo: 'FT', fatura: faturaId }), quando: 'cobranca', linhas: [...linhas], totais: valores(linhas) },
      { tipo: 'RC', chave: chaveDocumento({ tipo: 'RC', fatura: faturaId }), quando: 'pagamento', linhas: [...linhas], totais: valores(linhas) },
    ]
  }
  return [{ tipo: 'FR', chave: chaveDocumento({ tipo: 'FR', fatura: faturaId }), quando: 'pagamento', linhas: [...linhas], totais: valores(linhas) }]
}

// ————————————————————————————————————————————————————————————— pedidos ao emissor

export type ClienteFiscal =
  | { tipo: 'empresa'; nif: string; nome: string; morada: string; codigoPostal: string; localidade: string; pais: 'PT'; email: string }
  | { tipo: 'particular'; nif: string; nome: string | null }
  | { tipo: 'consumidor_final' }

export type ProdutoDocumento = 'entrada' | 'mensalidade' | 'acesso'

export interface LinhaDocumento extends LinhaValores {
  produto: ProdutoDocumento
  descricao: string
  quantidade: 1
}

export interface PagamentoDocumento {
  metodo: MetodoPago | MetodoFamilia
  data: string
  valorCentimos: number
}

export interface PedidoFatura {
  tipo: 'FT' | 'FR'
  cliente: ClienteFiscal
  data: string
  vencimento: string
  linhas: LinhaDocumento[]
  chave: string
  /** só FR */
  pagamento: PagamentoDocumento | null
  subtotalCentimos: number
  ivaCentimos: number
  totalCentimos: number
}

export interface PedidoRecibo {
  tipo: 'RC'
  cliente: ClienteFiscal
  data: string
  chave: string
  documentos: { externoId: string; numero: string; valorCentimos: number }[]
  pagamento: PagamentoDocumento
  totalCentimos: number
}

export type PedidoDocumento = PedidoFatura | PedidoRecibo

export function clienteFiscal(c: ClienteDocumentoRpc): ClienteFiscal {
  if (c.tipo === 'consumidor_final') return { tipo: 'consumidor_final' }
  if (c.tipo === 'particular') return { tipo: 'particular', nif: c.nif, nome: c.nome }
  return {
    tipo: 'empresa',
    nif: c.nif,
    nome: c.razao_social,
    morada: c.morada,
    codigoPostal: c.codigo_postal,
    localidade: c.localidade,
    pais: 'PT',
    email: c.email,
  }
}

function taxa(v: number): TaxaIva {
  if (!eTaxaIva(v)) throw new RangeError('Taxa de IVA desconhecida.')
  return v
}

export function linhaDocumento(l: LinhaDocumentoRpc): LinhaDocumento {
  if (l.tipo === 'entrada') {
    return { produto: 'entrada', descricao: descricaoEntrada(l.referencia, l.entrada_data), quantidade: 1, ...linhaLiquida(l.valor_centimos, taxa(l.iva_percent)) }
  }
  if (l.tipo === 'mensalidade') {
    if (!DATA_ISO.test(l.periodo_inicio) || !DATA_ISO.test(l.periodo_fim)) throw new RangeError('Período inválido.')
    return { produto: 'mensalidade', descricao: descricaoMensalidade(l.periodo_inicio, l.periodo_fim), quantidade: 1, ...linhaLiquida(l.valor_centimos, taxa(l.iva_percent)) }
  }
  return { produto: 'acesso', descricao: descricaoAcesso(l.plano), quantidade: 1, ...separarIvaIncluidoOuFalhar(l.valor_centimos, taxa(l.iva_percent)) }
}

export class ErroDocumento extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ErroDocumento'
  }
}

/** DocumentoPendenteRpc → pedido ao emissor, com os totais conferidos contra os da base de dados. */
export function pedidoDoDocumento(d: DocumentoPendenteRpc): PedidoDocumento {
  const cliente = clienteFiscal(d.cliente)
  if (d.tipo === 'NC') throw new ErroDocumento('As notas de crédito são emitidas pela equipa (playbook).')
  if (d.tipo === 'RC') {
    if (!d.pagamento) throw new ErroDocumento('Recibo sem pagamento.')
    if (!d.documentos_associados.length) throw new ErroDocumento('Recibo sem documentos associados.')
    const documentos = d.documentos_associados.map((a) => ({ externoId: a.externo_id, numero: a.numero, valorCentimos: a.total_centimos }))
    const total = documentos.reduce((s, x) => s + x.valorCentimos, 0)
    if (total !== d.total_centimos || d.pagamento.valor_centimos !== total) throw new ErroDocumento('O total do recibo não bate com os documentos.')
    return { tipo: 'RC', cliente, data: d.data, chave: d.chave, documentos, pagamento: pagamentoDocumento(d.pagamento), totalCentimos: total }
  }
  if (!d.linhas.length) throw new ErroDocumento('Documento sem linhas.')
  const linhas = d.linhas.map(linhaDocumento)
  const t = totaisDocumento(linhas)
  if (t.totalCentimos !== d.total_centimos || t.ivaCentimos !== d.iva_centimos) throw new ErroDocumento('Os totais calculados não batem com os da base de dados.')
  if (d.tipo === 'FR' && (!d.pagamento || d.pagamento.valor_centimos !== t.totalCentimos)) throw new ErroDocumento('Fatura-recibo sem pagamento do valor total.')
  if (cliente.tipo !== 'empresa' && d.tipo === 'FT') throw new ErroDocumento('Faturas (FT) só para empresas.')
  return {
    tipo: d.tipo,
    cliente,
    data: d.data,
    vencimento: d.vencimento ?? d.data,
    linhas,
    chave: d.chave,
    pagamento: d.pagamento ? pagamentoDocumento(d.pagamento) : null,
    subtotalCentimos: t.subtotalCentimos,
    ivaCentimos: t.ivaCentimos,
    totalCentimos: t.totalCentimos,
  }
}

function pagamentoDocumento(p: NonNullable<DocumentoPendenteRpc['pagamento']>): PagamentoDocumento {
  return { metodo: p.metodo, data: p.data, valorCentimos: p.valor_centimos }
}

/** IVA de uma mensalidade (para conferir a fatura de subscrição do Stripe). */
export const totalMensalidade = (liquido: number, pct: TaxaIva) => liquido + ivaCentimos(liquido, pct)
