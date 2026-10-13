/**
 * Emissor de documentos fiscais (software certificado pela AT). Em produção: MoloniEmissor
 * (moloni/cliente.ts). Nesta fase de testes: EmissorFalso, em memória, com números determinísticos
 * ("FT F2026/1", "FR F2026/1", "RC F2026/1": série F de falso, por tipo e ano) e idempotente pela chave.
 *
 * O EmissorFalso só é permitido com STRIPE_MODO=teste (config.ts recusa FATURACAO_EMISSOR=falso em produção):
 * os seus documentos NÃO têm valor fiscal.
 */
import { totaisDocumento } from './dinheiro.ts'
import type { ClienteFiscal, LinhaDocumento, PagamentoDocumento } from './documentos.ts'

export interface DocumentoEmitido {
  /** id no emissor (Moloni: document_id; falso: 'falso:<chave>') */
  id: string
  tipo: 'FT' | 'FR' | 'RC'
  /** ex.: 'FT F2026/1' */
  numero: string
  totalCentimos: number
  ivaCentimos: number
  /** ISO */
  emitidoEm: string
  chave: string
}

export interface PedidoEmissaoFatura {
  tipo: 'FT' | 'FR'
  clienteId: string
  data: string
  vencimento: string
  linhas: LinhaDocumento[]
  chave: string
  pagamento: PagamentoDocumento | null
}

export interface PedidoEmissaoRecibo {
  clienteId: string
  data: string
  documentos: { externoId: string; valorCentimos: number }[]
  pagamento: PagamentoDocumento
  chave: string
}

export interface EmissorFaturas {
  readonly tipo: 'moloni' | 'falso'
  garantirCliente(c: ClienteFiscal): Promise<{ clienteId: string }>
  emitirFatura(d: PedidoEmissaoFatura): Promise<DocumentoEmitido>
  emitirRecibo(r: PedidoEmissaoRecibo): Promise<DocumentoEmitido>
  linkPdf(documentoId: string): Promise<string>
  /** recuperação depois de uma falha a meio: o documento com esta chave já existe? */
  procurarPorChave(chave: string): Promise<DocumentoEmitido | null>
}

interface Guardado extends DocumentoEmitido {
  clienteId: string
  linhas: LinhaDocumento[]
  pagamento: PagamentoDocumento | null
  documentos: { externoId: string; valorCentimos: number }[]
}

export interface OpcoesEmissorFalso {
  /** série (por omissão 'F') */
  serie?: string
  agora?: () => number
}

export class EmissorFalso implements EmissorFaturas {
  readonly tipo = 'falso' as const
  private readonly serie: string
  private readonly agora: () => number
  private readonly clientes = new Map<string, string>()
  private readonly porChave = new Map<string, Guardado>()
  private readonly porId = new Map<string, Guardado>()
  private readonly contadores = new Map<string, number>()
  /** testes: número de chamadas que criaram documentos novos */
  criados = 0

  constructor(opcoes: OpcoesEmissorFalso = {}) {
    this.serie = opcoes.serie ?? 'F'
    this.agora = opcoes.agora ?? Date.now
  }

  async garantirCliente(c: ClienteFiscal): Promise<{ clienteId: string }> {
    const chave = c.tipo === 'consumidor_final' ? 'consumidor_final' : `nif:${c.nif}`
    let id = this.clientes.get(chave)
    if (!id) {
      id = `cli-${this.clientes.size + 1}`
      this.clientes.set(chave, id)
    }
    return { clienteId: id }
  }

  private numerar(tipo: 'FT' | 'FR' | 'RC', data: string): string {
    const ano = data.slice(0, 4)
    const k = `${tipo}:${ano}`
    const n = (this.contadores.get(k) ?? 0) + 1
    this.contadores.set(k, n)
    return `${tipo} ${this.serie}${ano}/${n}`
  }

  private guardar(g: Guardado): DocumentoEmitido {
    this.porChave.set(g.chave, g)
    this.porId.set(g.id, g)
    this.criados++
    return publico(g)
  }

  async emitirFatura(d: PedidoEmissaoFatura): Promise<DocumentoEmitido> {
    const existente = this.porChave.get(d.chave)
    if (existente) return publico(existente)
    if (!d.linhas.length) throw new Error('Documento sem linhas.')
    const t = totaisDocumento(d.linhas)
    if (d.tipo === 'FR' && (!d.pagamento || d.pagamento.valorCentimos !== t.totalCentimos)) throw new Error('Fatura-recibo sem pagamento do valor total.')
    return this.guardar({
      id: `falso:${d.chave}`,
      tipo: d.tipo,
      numero: this.numerar(d.tipo, d.data),
      totalCentimos: t.totalCentimos,
      ivaCentimos: t.ivaCentimos,
      emitidoEm: new Date(this.agora()).toISOString(),
      chave: d.chave,
      clienteId: d.clienteId,
      linhas: d.linhas.map((l) => ({ ...l })),
      pagamento: d.pagamento,
      documentos: [],
    })
  }

  async emitirRecibo(r: PedidoEmissaoRecibo): Promise<DocumentoEmitido> {
    const existente = this.porChave.get(r.chave)
    if (existente) return publico(existente)
    for (const a of r.documentos) if (!this.porId.has(a.externoId)) throw new Error('Documento associado desconhecido.')
    const total = r.documentos.reduce((s, a) => s + a.valorCentimos, 0)
    if (total !== r.pagamento.valorCentimos) throw new Error('O pagamento não liquida os documentos.')
    return this.guardar({
      id: `falso:${r.chave}`,
      tipo: 'RC',
      numero: this.numerar('RC', r.data),
      totalCentimos: total,
      ivaCentimos: 0,
      emitidoEm: new Date(this.agora()).toISOString(),
      chave: r.chave,
      clienteId: r.clienteId,
      linhas: [],
      pagamento: r.pagamento,
      documentos: r.documentos.map((a) => ({ ...a })),
    })
  }

  async linkPdf(documentoId: string): Promise<string> {
    const g = this.porId.get(documentoId)
    const numero = g?.numero ?? documentoId.replace(/^falso:/, '')
    const texto = `EncontraLar — documento de teste SEM VALOR FISCAL (emissor falso).\n${numero}\n`
    return `data:text/plain;charset=utf-8,${encodeURIComponent(texto)}`
  }

  async procurarPorChave(chave: string): Promise<DocumentoEmitido | null> {
    const g = this.porChave.get(chave)
    return g ? publico(g) : null
  }

  /** testes: todos os documentos emitidos, por ordem */
  documentos(): readonly (DocumentoEmitido & { linhas: LinhaDocumento[]; pagamento: PagamentoDocumento | null; documentos: { externoId: string; valorCentimos: number }[] })[] {
    return [...this.porChave.values()].map((g) => ({ ...publico(g), linhas: g.linhas, pagamento: g.pagamento, documentos: g.documentos }))
  }
}

function publico(g: Guardado): DocumentoEmitido {
  return { id: g.id, tipo: g.tipo, numero: g.numero, totalCentimos: g.totalCentimos, ivaCentimos: g.ivaCentimos, emitidoEm: g.emitidoEm, chave: g.chave }
}
