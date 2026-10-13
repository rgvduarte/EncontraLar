/**
 * Pedidos à API v1 do Moloni (https://api.moloni.pt/v1/), puros. NUNCA foram executados contra o Moloni
 * real: cada formato abaixo está na lista "a verificar antes de produção" do README (endpoints, campos
 * obrigatórios, formato do corpo, forma dos erros, fecho de rascunhos, número do documento, link do PDF).
 *
 * Formato assumido: POST {endpoint}/?access_token=…&json=true&human_errors=true com corpo JSON; o token vem
 * de GET grant/?grant_type=password|refresh_token&….
 *
 * Minimização: as linhas só levam a descrição dos modelos de documentos.ts (referência EL-… e datas).
 */
import type { ConfigMoloni } from '../config.ts'
import { centimosParaDecimal } from '../faturacao/dinheiro.ts'
import { assegurarDescricaoSegura, type ClienteFiscal, type LinhaDocumento, type PagamentoDocumento } from '../faturacao/documentos.ts'
import { NIF_CONSUMIDOR_FINAL } from '../faturacao/nif.ts'

export const MOLONI_BASE = 'https://api.moloni.pt/v1'

export interface PedidoMoloni {
  metodo: 'GET' | 'POST'
  url: string
  /** endpoint sem token (para registos e erros) */
  endpoint: string
  corpo: Record<string, unknown> | null
}

export type TipoMoloni = 'FT' | 'FR' | 'RC'

/** Recurso da API por tipo de documento. */
export const RECURSO: Readonly<Record<TipoMoloni, string>> = { FT: 'invoices', FR: 'invoiceReceipts', RC: 'receipts' }

const decimal = (c: number) => Number(centimosParaDecimal(c))

function post(endpoint: string, token: string, corpo: Record<string, unknown>): PedidoMoloni {
  return { metodo: 'POST', url: `${MOLONI_BASE}/${endpoint}/?access_token=${encodeURIComponent(token)}&json=true&human_errors=true`, endpoint, corpo }
}

export function pedidoToken(cfg: ConfigMoloni): PedidoMoloni {
  const q = new URLSearchParams({ grant_type: 'password', client_id: cfg.clientId, client_secret: cfg.clientSecret, username: cfg.username, password: cfg.password })
  return { metodo: 'GET', url: `${MOLONI_BASE}/grant/?${q}`, endpoint: 'grant', corpo: null }
}

export function pedidoRenovarToken(cfg: ConfigMoloni, refreshToken: string): PedidoMoloni {
  const q = new URLSearchParams({ grant_type: 'refresh_token', client_id: cfg.clientId, client_secret: cfg.clientSecret, refresh_token: refreshToken })
  return { metodo: 'GET', url: `${MOLONI_BASE}/grant/?${q}`, endpoint: 'grant', corpo: null }
}

// ————————————————————————————————————————————————————————————— clientes

const nifDoCliente = (c: ClienteFiscal) => (c.tipo === 'consumidor_final' ? NIF_CONSUMIDOR_FINAL : c.nif)

export const pedidoClientePorNif = (cfg: ConfigMoloni, token: string, c: ClienteFiscal) =>
  post('customers/getByVat', token, { company_id: cfg.companyId, vat: nifDoCliente(c) })

export const pedidoProximoNumeroCliente = (cfg: ConfigMoloni, token: string) => post('customers/getNextNumber', token, { company_id: cfg.companyId })

export function pedidoInserirCliente(cfg: ConfigMoloni, token: string, c: ClienteFiscal, numero: string): PedidoMoloni {
  const base = {
    company_id: cfg.companyId,
    vat: nifDoCliente(c),
    number: numero,
    language_id: cfg.idiomaId,
    country_id: cfg.paisId,
    maturity_date_id: cfg.prazoVencimentoId,
    payment_method_id: 0,
    salesman_id: 0,
    payment_day: 0,
    discount: 0,
    credit_limit: 0,
    delivery_method_id: 0,
  }
  if (c.tipo === 'empresa') {
    return post('customers/insert', token, { ...base, name: c.nome, address: c.morada, zip_code: c.codigoPostal, city: c.localidade, email: c.email })
  }
  // famílias: nunca a morada (não a recolhemos); "Desconhecido" é o valor habitual no Moloni (verificar)
  const nome = c.tipo === 'particular' ? c.nome ?? 'Cliente' : 'Consumidor final'
  return post('customers/insert', token, { ...base, name: nome, address: 'Desconhecido', zip_code: '0000-000', city: 'Desconhecido', email: '' })
}

// ————————————————————————————————————————————————————————————— documentos

export interface DocumentoMoloni {
  tipo: 'FT' | 'FR'
  clienteId: number
  data: string
  vencimento: string
  linhas: LinhaDocumento[]
  chave: string
  pagamento: PagamentoDocumento | null
}

function produtos(cfg: ConfigMoloni, linhas: LinhaDocumento[]) {
  return linhas.map((l, i) => ({
    product_id: cfg.produtos[l.produto],
    name: assegurarDescricaoSegura(l.descricao),
    summary: '',
    qty: l.quantidade,
    price: decimal(l.liquidoCentimos),
    discount: 0,
    order: i + 1,
    exemption_reason: '',
    taxes: [{ tax_id: cfg.impostos[l.ivaPercent], value: l.ivaPercent, order: 1, cumulative: 0 }],
  }))
}

function pagamentos(cfg: ConfigMoloni, p: PagamentoDocumento) {
  return [{ payment_method_id: cfg.metodosPagamento[p.metodo], date: p.data, value: decimal(p.valorCentimos), notes: '' }]
}

/** Corpo do documento (rascunho: status 0). O mesmo corpo com status 1 fecha-o. */
export function corpoDocumento(cfg: ConfigMoloni, d: DocumentoMoloni, status: 0 | 1): Record<string, unknown> {
  if (d.tipo === 'FR' && !d.pagamento) throw new RangeError('Fatura-recibo sem pagamento.')
  return {
    company_id: cfg.companyId,
    date: d.data,
    expiration_date: d.vencimento,
    document_set_id: cfg.documentSetId,
    customer_id: d.clienteId,
    your_reference: d.chave,
    financial_discount: 0,
    special_discount: 0,
    products: produtos(cfg, d.linhas),
    ...(d.tipo === 'FR' && d.pagamento ? { payments: pagamentos(cfg, d.pagamento) } : {}),
    status,
  }
}

export const pedidoInserirDocumento = (cfg: ConfigMoloni, token: string, d: DocumentoMoloni) => post(`${RECURSO[d.tipo]}/insert`, token, corpoDocumento(cfg, d, 0))

/** Fechar o rascunho (verificar: o Moloni pode exigir o corpo completo no update — enviamo-lo). */
export const pedidoFecharDocumento = (cfg: ConfigMoloni, token: string, d: DocumentoMoloni, documentId: number) =>
  post(`${RECURSO[d.tipo]}/update`, token, { ...corpoDocumento(cfg, d, 1), document_id: documentId })

export interface ReciboMoloni {
  clienteId: number
  data: string
  chave: string
  documentos: { externoId: number; valorCentimos: number }[]
  pagamento: PagamentoDocumento
}

export function corpoRecibo(cfg: ConfigMoloni, r: ReciboMoloni, status: 0 | 1): Record<string, unknown> {
  const total = r.documentos.reduce((s, x) => s + x.valorCentimos, 0)
  return {
    company_id: cfg.companyId,
    date: r.data,
    document_set_id: cfg.documentSetId,
    customer_id: r.clienteId,
    your_reference: r.chave,
    net_value: decimal(total),
    associated_documents: r.documentos.map((a) => ({ associated_id: a.externoId, value: decimal(a.valorCentimos) })),
    payments: pagamentos(cfg, r.pagamento),
    status,
  }
}

export const pedidoInserirRecibo = (cfg: ConfigMoloni, token: string, r: ReciboMoloni) => post('receipts/insert', token, corpoRecibo(cfg, r, 0))

export const pedidoFecharRecibo = (cfg: ConfigMoloni, token: string, r: ReciboMoloni, documentId: number) =>
  post('receipts/update', token, { ...corpoRecibo(cfg, r, 1), document_id: documentId })

export const pedidoLerDocumento = (cfg: ConfigMoloni, token: string, tipo: TipoMoloni, documentId: number) =>
  post(`${RECURSO[tipo]}/getOne`, token, { company_id: cfg.companyId, document_id: documentId })

export const pedidoApagarDocumento = (cfg: ConfigMoloni, token: string, tipo: TipoMoloni, documentId: number) =>
  post(`${RECURSO[tipo]}/delete`, token, { company_id: cfg.companyId, document_id: documentId })

export const pedidoProcurarPorChave = (cfg: ConfigMoloni, token: string, tipo: TipoMoloni, chave: string) =>
  post(`${RECURSO[tipo]}/getAll`, token, { company_id: cfg.companyId, your_reference: chave })

export const pedidoLinkPdf = (cfg: ConfigMoloni, token: string, documentId: number) =>
  post('documents/getPDFLink', token, { company_id: cfg.companyId, document_id: documentId })

/** Tipo do documento a partir da chave (FT:… / FR:… / RC:…). */
export function tipoDaChave(chave: string): TipoMoloni | null {
  const t = chave.slice(0, 2)
  return t === 'FT' || t === 'FR' || t === 'RC' ? t : null
}

/** Endpoints a confirmar antes de produção (o README repete esta lista). */
export const ENDPOINTS_A_VERIFICAR = [
  'grant (password e refresh_token): validade do token e se o grant password continua permitido',
  'formato dos pedidos: ?access_token=…&json=true&human_errors=true com corpo JSON, e a forma dos erros',
  'customers/getByVat, customers/getNextNumber e os campos obrigatórios de customers/insert',
  'invoices/insert (FT) e invoiceReceipts/insert (FR): campos, status 0/1, taxes[].value',
  'invoices/update e invoiceReceipts/update: fechar um rascunho (corpo completo ou só status?)',
  'invoices/getOne, invoiceReceipts/getOne, receipts/getOne: gross_value, taxes_value, number, document_set_name',
  'invoices/delete e receipts/delete: apagar um rascunho',
  'receipts/insert: associated_documents[] e payments[]',
  'creditNotes/insert (NC, playbook da equipa)',
  'documents/getPDFLink: forma da resposta e validade do link',
  '<recurso>/getAll com your_reference (procurar por chave)',
  'ATCUD e QR gerados ao fechar (série comunicada à AT)',
  'limites de pedidos (rate limits)',
  'cliente "Consumidor final" (999999990) e morada "Desconhecido"',
] as const
