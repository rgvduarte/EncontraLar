/**
 * MoloniEmissor: EmissorFaturas sobre a API do Moloni, com `fetch` injetado (nunca chamado a sério nesta
 * fase). Fluxo de cada FT/FR/RC: inserir como rascunho → ler → comparar os totais com os nossos → fechar
 * (se não baterem: apagar o rascunho e falhar; o documento fica na fila para a equipa ver).
 *
 * O token é guardado em memória até 60 s antes de expirar; um 401 força uma renovação (uma vez).
 */
import type { ConfigMoloni } from '../config.ts'
import { decimalParaCentimos } from '../faturacao/dinheiro.ts'
import type { ClienteFiscal } from '../faturacao/documentos.ts'
import { totaisDocumento } from '../faturacao/dinheiro.ts'
import type { DocumentoEmitido, EmissorFaturas, PedidoEmissaoFatura, PedidoEmissaoRecibo } from '../faturacao/emissor.ts'
import {
  pedidoApagarDocumento,
  pedidoClientePorNif,
  pedidoFecharDocumento,
  pedidoFecharRecibo,
  pedidoInserirCliente,
  pedidoInserirDocumento,
  pedidoInserirRecibo,
  pedidoLerDocumento,
  pedidoLinkPdf,
  pedidoProcurarPorChave,
  pedidoProximoNumeroCliente,
  pedidoRenovarToken,
  pedidoToken,
  tipoDaChave,
  type DocumentoMoloni,
  type PedidoMoloni,
  type ReciboMoloni,
  type TipoMoloni,
} from './pedidos.ts'

export type Buscar = (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => Promise<{ status: number; json(): Promise<unknown> }>

/** Erro do Moloni sem dados: endpoint, código e campo. */
export class ErroMoloni extends Error {
  constructor(
    readonly endpoint: string,
    readonly codigo: string,
    readonly campo: string | null = null,
  ) {
    super(`Moloni ${endpoint}: ${codigo}${campo ? ` (${campo})` : ''}`)
    this.name = 'ErroMoloni'
  }
}

/** Interpreta a resposta: arrays de erros [{code, field}], { error }, { valid: 0 } → ErroMoloni. */
export function interpretarResposta(endpoint: string, estado: number, corpo: unknown): unknown {
  if (Array.isArray(corpo) && corpo.length && corpo.every((e) => e && typeof e === 'object' && 'code' in e && !('document_id' in e) && !('customer_id' in e))) {
    const e = corpo[0] as Record<string, unknown>
    throw new ErroMoloni(endpoint, String(e.code), typeof e.field === 'string' ? e.field : null)
  }
  if (corpo && typeof corpo === 'object' && !Array.isArray(corpo)) {
    const o = corpo as Record<string, unknown>
    if (typeof o.error === 'string') throw new ErroMoloni(endpoint, o.error)
    if (o.valid === 0 || o.valid === '0') throw new ErroMoloni(endpoint, 'invalido')
  }
  if (estado >= 400) throw new ErroMoloni(endpoint, `http_${estado}`)
  return corpo
}

interface Token {
  acesso: string
  renovacao: string | null
  expiraEm: number
}

const numero = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : v
  if (typeof n !== 'number' || !Number.isFinite(n)) throw new ErroMoloni('resposta', 'id_invalido')
  return n
}

export class MoloniEmissor implements EmissorFaturas {
  readonly tipo = 'moloni' as const
  private token: Token | null = null

  constructor(
    private readonly cfg: ConfigMoloni,
    private readonly buscar: Buscar,
    private readonly agora: () => number = Date.now,
  ) {}

  private async obterToken(forcar = false): Promise<string> {
    if (!forcar && this.token && this.token.expiraEm - 60_000 > this.agora()) return this.token.acesso
    const p = forcar && this.token?.renovacao ? pedidoRenovarToken(this.cfg, this.token.renovacao) : pedidoToken(this.cfg)
    const r = await this.buscar(p.url, { method: p.metodo, headers: { Accept: 'application/json' } })
    const o = interpretarResposta('grant', r.status, await r.json()) as Record<string, unknown>
    if (typeof o.access_token !== 'string') throw new ErroMoloni('grant', 'sem_token')
    const segundos = typeof o.expires_in === 'number' ? o.expires_in : 3600
    this.token = { acesso: o.access_token, renovacao: typeof o.refresh_token === 'string' ? o.refresh_token : null, expiraEm: this.agora() + segundos * 1000 }
    return this.token.acesso
  }

  private async chamar(criar: (token: string) => PedidoMoloni): Promise<unknown> {
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      const p = criar(await this.obterToken(tentativa > 0))
      const r = await this.buscar(p.url, {
        method: p.metodo,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        ...(p.corpo ? { body: JSON.stringify(p.corpo) } : {}),
      })
      if (r.status === 401 && tentativa === 0) continue
      return interpretarResposta(p.endpoint, r.status, await r.json())
    }
    throw new ErroMoloni('grant', 'nao_autorizado')
  }

  async garantirCliente(c: ClienteFiscal): Promise<{ clienteId: string }> {
    const lista = await this.chamar((t) => pedidoClientePorNif(this.cfg, t, c))
    const existente = Array.isArray(lista) ? (lista[0] as Record<string, unknown> | undefined) : undefined
    if (existente?.customer_id !== undefined) return { clienteId: String(numero(existente.customer_id)) }
    const prox = (await this.chamar((t) => pedidoProximoNumeroCliente(this.cfg, t))) as Record<string, unknown>
    const num = typeof prox?.number === 'string' || typeof prox?.number === 'number' ? String(prox.number) : `EL${Date.now()}`
    const r = (await this.chamar((t) => pedidoInserirCliente(this.cfg, t, c, num))) as Record<string, unknown>
    return { clienteId: String(numero(r.customer_id)) }
  }

  private async ler(tipo: TipoMoloni, id: number, chave: string): Promise<DocumentoEmitido & { fechado: boolean }> {
    const d = (await this.chamar((t) => pedidoLerDocumento(this.cfg, t, tipo, id))) as Record<string, unknown>
    const total = decimalParaCentimos(d.gross_value as string | number)
    const iva = d.taxes_value === undefined ? 0 : decimalParaCentimos(d.taxes_value as string | number)
    return {
      id: String(id),
      tipo,
      numero: `${tipo} ${String(d.document_set_name ?? '')}/${String(d.number ?? '')}`,
      totalCentimos: total,
      ivaCentimos: iva,
      emitidoEm: new Date(this.agora()).toISOString(),
      chave,
      fechado: Number(d.status) === 1,
    }
  }

  private async conferirEFechar(tipo: TipoMoloni, id: number, chave: string, total: number, iva: number | null, fechar: () => Promise<unknown>): Promise<DocumentoEmitido> {
    const rascunho = await this.ler(tipo, id, chave)
    if (rascunho.totalCentimos !== total || (iva !== null && rascunho.ivaCentimos !== iva)) {
      await this.chamar((t) => pedidoApagarDocumento(this.cfg, t, tipo, id))
      throw new ErroMoloni(`${tipo}`, 'totais_diferentes')
    }
    await fechar()
    const { fechado: _f, ...doc } = await this.ler(tipo, id, chave)
    return doc
  }

  async emitirFatura(d: PedidoEmissaoFatura): Promise<DocumentoEmitido> {
    const doc: DocumentoMoloni = { ...d, clienteId: numero(d.clienteId) }
    const r = (await this.chamar((t) => pedidoInserirDocumento(this.cfg, t, doc))) as Record<string, unknown>
    const id = numero(r.document_id)
    const t = totaisDocumento(d.linhas)
    return this.conferirEFechar(d.tipo, id, d.chave, t.totalCentimos, t.ivaCentimos, () => this.chamar((tk) => pedidoFecharDocumento(this.cfg, tk, doc, id)))
  }

  async emitirRecibo(r: PedidoEmissaoRecibo): Promise<DocumentoEmitido> {
    const rec: ReciboMoloni = { ...r, clienteId: numero(r.clienteId), documentos: r.documentos.map((a) => ({ externoId: numero(a.externoId), valorCentimos: a.valorCentimos })) }
    const ins = (await this.chamar((t) => pedidoInserirRecibo(this.cfg, t, rec))) as Record<string, unknown>
    const id = numero(ins.document_id)
    const total = r.documentos.reduce((s, a) => s + a.valorCentimos, 0)
    return this.conferirEFechar('RC', id, r.chave, total, null, () => this.chamar((tk) => pedidoFecharRecibo(this.cfg, tk, rec, id)))
  }

  async linkPdf(documentoId: string): Promise<string> {
    const r = (await this.chamar((t) => pedidoLinkPdf(this.cfg, t, numero(documentoId)))) as Record<string, unknown>
    if (typeof r?.url !== 'string' || !/^https:\/\//.test(r.url)) throw new ErroMoloni('documents/getPDFLink', 'sem_url')
    return r.url
  }

  async procurarPorChave(chave: string): Promise<DocumentoEmitido | null> {
    const tipo = tipoDaChave(chave)
    if (!tipo) return null
    const lista = await this.chamar((t) => pedidoProcurarPorChave(this.cfg, t, tipo, chave))
    const d = Array.isArray(lista) ? (lista as Record<string, unknown>[]).find((x) => x && x.your_reference === chave && Number(x.status) === 1) : undefined
    if (!d) return null
    const { fechado: _f, ...doc } = await this.ler(tipo, numero(d.document_id), chave)
    return doc
  }
}
