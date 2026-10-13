/**
 * Duplos em memória para testar as funções sem rede:
 * - BDFalsa: implementação de REFERÊNCIA do contrato portas.ts (o SQL tem de se comportar assim);
 * - StripeFalso: as chamadas da PortaStripe, com idempotência por chave e falhas injetáveis;
 * - UtilizadorFalso: a PortaUtilizador (JWT) de um utilizador;
 * - construtores de eventos do Stripe e dados pessoais de fixtures (para os testes de minimização).
 */
import type Stripe from 'stripe'
import { totaisDocumento, ivaCentimos, linhaLiquida, separarIvaIncluido, type TaxaIva } from '../../functions/_shared/faturacao/dinheiro.ts'
import { compromissoAte, diaLisboa, inicioDoDiaLisboa, periodoDe, somarDiasData, deLisboa, partesLisboa } from '../../functions/_shared/faturacao/datas.ts'
import { classificarEntrada, type EntradaFaturacao } from '../../functions/_shared/faturacao/regras.ts'
import { referenciaPedido } from '../../functions/_shared/faturacao/referencia.ts'
import { MENSALIDADE_CENTIMOS, PLANOS_FAMILIA, IVA_FAMILIA_PERCENT, planoFamilia } from '../../functions/_shared/faturacao/planos.ts'
import { validarNIF } from '../../functions/_shared/faturacao/nif.ts'
import { chaveDocumento } from '../../functions/_shared/faturacao/documentos.ts'
import {
  ErroBD,
  type ClienteDocumentoRpc,
  type DadosFiscaisRpc,
  type DocumentoPendenteRpc,
  type EstadoFatura,
  type EstadoSubscricao,
  type LinhaDocumentoRpc,
  type MetodoFamilia,
  type MotivoFalha,
  type OperacaoEvento,
  type PlanoInstituicao,
  type PortaBD,
  type PortaUtilizador,
  type Registo,
  type RpcServico,
  type RpcUtilizador,
  type UtilizadorSessao,
  type EstadoPagamentoFamilia,
  type OrigemFatura,
  type PagamentoDocumentoRpc,
  type Natureza,
} from '../../functions/_shared/portas.ts'
import type { OpcoesPedido, PortaStripe } from '../../functions/_shared/stripe/porta.ts'
import type { Config, ConfigMoloni } from '../../functions/_shared/config.ts'
import type { LinhaDocumento } from '../../functions/_shared/faturacao/documentos.ts'
import type { Buscar } from '../../functions/_shared/moloni/cliente.ts'
import { lerConfig } from '../../functions/_shared/config.ts'

// ————————————————————————————————————————————————————————————— relógio e dados pessoais

/** Terça, 13 de outubro de 2026, 10:00 em Lisboa (09:00 UTC, hora de verão). */
export const T0 = Date.parse('2026-10-13T09:00:00Z')
export const DIA = 86_400_000

export class Relogio {
  constructor(public agora = T0) {}
  avancar(ms: number) {
    this.agora += ms
  }
  readonly fn = () => this.agora
}

/** Dados de saúde e identificação das fixtures: NUNCA podem aparecer num pedido ao Stripe ou ao Moloni. */
export const DADOS_PESSOAIS = {
  residente: 'Amélia Rocha',
  familiar: 'Graça Rocha',
  notas: 'Alzheimer avançado, VIH+',
  necessidade: 'diálise peritoneal',
  telefone: '912 345 678',
  nomeLar: 'Jardins do Douro',
} as const

export const valoresSensiveis = () => Object.values(DADOS_PESSOAIS)

// ————————————————————————————————————————————————————————————— config de teste

export const AMBIENTE_TESTE: Record<string, string> = {
  SUPABASE_URL: 'https://abcdefghijklmnop.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'chave-servico-de-teste',
  SUPABASE_ANON_KEY: 'chave-anonima-de-teste',
  STRIPE_SECRET_KEY: 'sk_test_51Teste',
  STRIPE_WEBHOOK_SECRET: 'whsec_teste_0123456789abcdef',
  STRIPE_MODO: 'teste',
  APP_URL: 'https://encontralar.example/app/',
  APP_ORIGENS: 'https://encontralar.example,http://localhost:5173',
  FATURACAO_MODO: 'fatura_por_entrada',
  FATURACAO_EMISSOR: 'falso',
  FATURACAO_CRON_SECRET: 'segredo-do-cron-com-mais-de-32-caracteres!',
}

export function configTeste(extra: Record<string, string> = {}): Config {
  const r = lerConfig({ ...AMBIENTE_TESTE, ...extra }, ['utilizador', 'webhook', 'cron', 'emissor'])
  if (!r.ok) throw new Error(r.problemas.join(' '))
  return r.config
}

export class RegistoMemoria implements Registo {
  linhas: { nivel: 'info' | 'erro'; evento: string; dados?: Record<string, unknown> }[] = []
  info(evento: string, dados?: Record<string, unknown>) {
    this.linhas.push({ nivel: 'info', evento, dados })
  }
  erro(evento: string, dados?: Record<string, unknown>) {
    this.linhas.push({ nivel: 'erro', evento, dados })
  }
}

// ————————————————————————————————————————————————————————————— BD falsa (referência do contrato)

interface UtilizadorF {
  id: string
  role: 'familia' | 'lar' | 'profissional' | 'equipa'
  demonstracao: boolean
  anonimo: boolean
  email: string | null
}

export interface PagamentoF {
  id: string
  user_id: string
  plano: 'acesso_30' | 'acesso_90'
  valor_centimos: number
  dias: number
  metodo: MetodoFamilia | null
  estado: EstadoPagamentoFamilia
  session_id: string | null
  payment_intent_id: string | null
  multibanco: { entidade: string | null; referencia: string | null; expira_em: string | null } | null
  criado_em: string
  pago_em: string | null
  motivo_falha: MotivoFalha | null
  nif: string | null
  nome_fiscal: string | null
  documento_id: string | null
  reembolsado_centimos: number
}

export interface InstituicaoF {
  id: string
  natureza: Natureza
  demonstracao: boolean
  plano: PlanoInstituicao | null
  plano_desde: string | null
  dados: DadosFiscaisRpc | null
  iva_percent: TaxaIva
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  metodo: { tipo: 'sepa_debit' | 'card'; ultimos4: string; mandato_ref: string | null } | null
  /** dados que vivem noutras tabelas e NUNCA podem sair: nome do lar não é dado de saúde, mas não vai nas linhas */
  nome: string
}

export interface EntradaF {
  candidatura_id: string
  instituicao_id: string
  pedido_criado_em: string
  entrada_data: string
  lar_em: string | null
  familia_em: string | null
  taxa: 'aplicavel' | 'incluida' | 'isenta'
  /** perfil da pessoa (dados de saúde): está na BD ao lado da faturação, nunca no que sai */
  perfil: { nome: string; notas: string; necessidades: string[]; familiar: string; telefone: string }
}

interface LinhaF {
  id: string
  instituicao_id: string
  candidatura_id: string
  referencia: string
  entrada_data: string
  valor_centimos: number
  iva_percent: TaxaIva
  iva_centimos: number
  fatura_id: string | null
  documento_id: string | null
}

export interface FaturaF {
  id: string
  instituicao_id: string
  origem: OrigemFatura
  periodo: string
  estado: EstadoFatura
  cobranca: 'debito_automatico' | 'pagamento_por_link'
  stripe_invoice_id: string | null
  numero: string | null
  url: string | null
  debito_em: string | null
  emitida_em: string | null
  paga_em: string | null
  falhou_em: string | null
  motivo: MotivoFalha | null
  metodo: string | null
  subtotal_centimos: number
  iva_centimos: number
  total_centimos: number
  linhas: string[]
  subscricao: { stripe_subscription_id: string; periodo_inicio: string; periodo_fim: string } | null
  divergente: boolean
  tentativas: number
}

export interface DocumentoF {
  id: string
  tipo: 'FT' | 'FR' | 'RC'
  chave: string
  estado: 'pendente' | 'emitido' | 'erro'
  origem: 'entradas' | 'subscricao' | 'acesso'
  instituicao_id: string | null
  user_id: string | null
  pagamento_id: string | null
  fatura_id: string | null
  data: string
  vencimento: string | null
  cliente: ClienteDocumentoRpc
  linhas: LinhaDocumentoRpc[]
  pagamento: PagamentoDocumentoRpc | null
  associados: string[]
  total_centimos: number
  iva_centimos: number
  tentativas: number
  ultimo_erro: string | null
  externo_id: string | null
  numero: string | null
  emitido_em: string | null
  emissor: 'moloni' | 'falso' | null
}

export interface SubscricaoF {
  instituicao_id: string
  stripe_subscription_id: string
  estado: EstadoSubscricao
  inicio: string | null
  compromisso_ate: string | null
}

const TRANSICOES: Record<EstadoFatura, EstadoFatura[]> = {
  rascunho: ['emitida', 'em_processamento', 'paga', 'falhou', 'anulada'],
  emitida: ['em_processamento', 'paga', 'falhou', 'anulada'],
  em_processamento: ['paga', 'falhou'],
  falhou: ['em_processamento', 'paga', 'anulada'],
  paga: [],
  anulada: [],
}

let sequencia = 0
const uuid = () => {
  sequencia++
  const h = sequencia.toString(16).padStart(12, '0')
  return `00000000-0000-4000-8000-${h}`
}

type Implementacao = { [K in keyof RpcServico]: (a: RpcServico[K]['args']) => RpcServico[K]['resultado'] }

export class BDFalsa implements PortaBD {
  utilizadores = new Map<string, UtilizadorF>()
  acessos = new Map<string, { plano: string; ate: string }>()
  pagamentos = new Map<string, PagamentoF>()
  consentimentos: { user_id: string; pagamento_id: string; plano: string; texto_versao: string; aceite_em: string; ip_truncado: string | null }[] = []
  instituicoes = new Map<string, InstituicaoF>()
  entradas: EntradaF[] = []
  linhas = new Map<string, LinhaF>()
  faturas = new Map<string, FaturaF>()
  documentos = new Map<string, DocumentoF>()
  subscricoes = new Map<string, SubscricaoF>()
  eventos = new Map<string, { tipo: string; processado_em: string | null; tentativas: number; erro: string | null; operacoes: OperacaoEvento[] }>()
  execucoes = new Map<string, number>()
  alertas: { tipo: string; ref: string }[] = []
  chamadas: { nome: string; args: unknown }[] = []
  /** falha injetada: nome da RPC → erro a lançar (uma vez) */
  falhar = new Map<string, Error>()

  constructor(readonly relogio: Relogio = new Relogio()) {}

  private get agora() {
    return this.relogio.agora
  }

  async rpc<K extends keyof RpcServico>(nome: K, args: RpcServico[K]['args']): Promise<RpcServico[K]['resultado']> {
    this.chamadas.push({ nome, args: structuredClone(args) })
    const f = this.falhar.get(nome)
    if (f) {
      this.falhar.delete(nome)
      throw f
    }
    const impl = (this.impl as unknown as Record<string, (a: unknown) => unknown>)[nome]
    if (!impl) throw new ErroBD('42883', `RPC ${nome} não existe na BD falsa.`)
    // cópia: a função não pode depender de partilhar objetos com a BD
    return structuredClone(impl(args)) as RpcServico[K]['resultado']
  }

  // ——— utilitários de cenário

  familia(id = uuid(), extra: Partial<UtilizadorF> = {}): UtilizadorF {
    const u: UtilizadorF = { id, role: 'familia', demonstracao: false, anonimo: false, email: 'familia@exemplo.pt', ...extra }
    this.utilizadores.set(id, u)
    return u
  }

  lar(id: string, extra: Partial<InstituicaoF> = {}): InstituicaoF {
    const i: InstituicaoF = {
      id,
      natureza: 'privado',
      demonstracao: false,
      plano: null,
      plano_desde: null,
      dados: {
        razao_social: 'Cuidados Exemplo, Lda.',
        nif: '599999993',
        morada: 'Rua das Camélias 128',
        codigo_postal: '4200-187',
        localidade: 'Porto',
        email: 'faturacao@lar.exemplo.pt',
      },
      iva_percent: 23,
      stripe_customer_id: null,
      stripe_payment_method_id: null,
      metodo: null,
      nome: DADOS_PESSOAIS.nomeLar,
      ...extra,
    }
    this.instituicoes.set(id, i)
    return i
  }

  entrada(instituicaoId: string, extra: Partial<EntradaF> = {}): EntradaF {
    const e: EntradaF = {
      candidatura_id: uuid().replace(/^00000000/, '3f9a2b1c'),
      instituicao_id: instituicaoId,
      pedido_criado_em: new Date(this.agora - 60 * DIA).toISOString(),
      entrada_data: diaLisboa(this.agora - 20 * DIA),
      lar_em: new Date(this.agora - 19 * DIA).toISOString(),
      familia_em: null,
      taxa: 'aplicavel',
      perfil: {
        nome: DADOS_PESSOAIS.residente,
        notas: DADOS_PESSOAIS.notas,
        necessidades: [DADOS_PESSOAIS.necessidade],
        familiar: DADOS_PESSOAIS.familiar,
        telefone: DADOS_PESSOAIS.telefone,
      },
      ...extra,
    }
    this.entradas.push(e)
    return e
  }

  documentosDe(filtro: Partial<Pick<DocumentoF, 'tipo' | 'estado' | 'origem' | 'pagamento_id' | 'fatura_id'>> = {}): DocumentoF[] {
    return [...this.documentos.values()].filter((d) => Object.entries(filtro).every(([k, v]) => (d as unknown as Record<string, unknown>)[k] === v))
  }

  private clienteEmpresa(i: InstituicaoF): ClienteDocumentoRpc {
    if (!i.dados) throw new ErroBD('22023', 'Sem dados de faturação.')
    return { tipo: 'empresa', pais: 'PT', ...i.dados }
  }

  private criarDocumento(d: Omit<DocumentoF, 'id' | 'estado' | 'tentativas' | 'ultimo_erro' | 'externo_id' | 'numero' | 'emitido_em' | 'emissor'>): DocumentoF {
    const existente = [...this.documentos.values()].find((x) => x.chave === d.chave)
    if (existente) return existente
    const doc: DocumentoF = { ...d, id: uuid(), estado: 'pendente', tentativas: 0, ultimo_erro: null, externo_id: null, numero: null, emitido_em: null, emissor: null }
    this.documentos.set(doc.id, doc)
    return doc
  }

  private exigirFamilia(userId: string) {
    const u = this.utilizadores.get(userId)
    if (!u || u.role !== 'familia' || u.anonimo) throw new ErroBD('42501', 'O Acesso Família é para contas de família.')
    return u
  }

  private pagamentoDaSessao(sessionId: string, pagamentoId: string | null): PagamentoF | null {
    const porSessao = [...this.pagamentos.values()].find((p) => p.session_id === sessionId)
    if (porSessao) return porSessao
    const p = pagamentoId ? this.pagamentos.get(pagamentoId) : undefined
    if (p && !p.session_id) {
      p.session_id = sessionId
      return p
    }
    return null
  }

  private transitar(f: FaturaF, para: EstadoFatura, em: string, extra: { motivo?: MotivoFalha | null; metodo?: string | null } = {}) {
    if (f.estado === para || !TRANSICOES[f.estado].includes(para)) return false
    f.estado = para
    if (para === 'emitida') f.emitida_em = em
    if (para === 'paga') f.paga_em = em
    if (para === 'falhou') {
      f.falhou_em = em
      f.motivo = extra.motivo ?? 'outro'
      this.alertas.push({ tipo: 'pagamento_falhou', ref: f.id })
    }
    if (extra.metodo) f.metodo = extra.metodo
    if (para === 'paga') this.criarRecibo(f, em)
    return true
  }

  private criarRecibo(f: FaturaF, em: string) {
    const fts = [...this.documentos.values()].filter((d) => d.tipo === 'FT' && d.fatura_id === f.id)
    const inst = this.instituicoes.get(f.instituicao_id)!
    this.criarDocumento({
      tipo: 'RC',
      chave: chaveDocumento({ tipo: 'RC', fatura: f.id }),
      origem: f.origem === 'subscricao' ? 'subscricao' : 'entradas',
      instituicao_id: f.instituicao_id,
      user_id: null,
      pagamento_id: null,
      fatura_id: f.id,
      data: diaLisboa(em),
      vencimento: null,
      cliente: this.clienteEmpresa(inst),
      linhas: [],
      pagamento: { metodo: (f.metodo as 'sepa_debit' | 'card' | null) ?? 'sepa_debit', data: diaLisboa(em), valor_centimos: f.total_centimos },
      associados: fts.map((d) => d.id),
      total_centimos: f.total_centimos,
      iva_centimos: 0,
    })
  }

  private aplicar(op: OperacaoEvento) {
    const agoraIso = new Date(this.agora).toISOString()
    switch (op.op) {
      case 'acesso_pago': {
        const p = this.pagamentoDaSessao(op.session_id, op.pagamento_id)
        if (!p || p.estado === 'pago' || p.estado === 'reembolsado') return
        if (op.valor_centimos !== p.valor_centimos) throw new ErroBD('22023', 'Valor pago diferente do valor do passe.')
        p.estado = 'pago'
        p.metodo = op.metodo ?? p.metodo
        p.payment_intent_id = op.payment_intent_id
        p.pago_em = op.pago_em
        // private.estender_acesso = novoAte
        const atual = this.acessos.get(p.user_id)
        const base = atual && Date.parse(atual.ate) > this.agora ? Date.parse(atual.ate) : this.agora
        this.acessos.set(p.user_id, { plano: p.plano, ate: new Date(base + p.dias * DIA).toISOString() })
        const doc = this.criarDocumento({
          tipo: 'FR',
          chave: chaveDocumento({ tipo: 'FR', pagamento: p.id }),
          origem: 'acesso',
          instituicao_id: null,
          user_id: p.user_id,
          pagamento_id: p.id,
          fatura_id: null,
          data: diaLisboa(op.pago_em),
          vencimento: null,
          cliente: p.nif ? { tipo: 'particular', nif: p.nif, nome: p.nome_fiscal } : { tipo: 'consumidor_final' },
          linhas: [{ tipo: 'acesso', plano: p.plano, valor_centimos: p.valor_centimos, iva_percent: IVA_FAMILIA_PERCENT as TaxaIva }],
          pagamento: { metodo: p.metodo ?? 'card', data: diaLisboa(op.pago_em), valor_centimos: p.valor_centimos },
          associados: [],
          total_centimos: p.valor_centimos,
          iva_centimos: separarIvaIncluido(p.valor_centimos, IVA_FAMILIA_PERCENT as TaxaIva)!.ivaCentimos,
        })
        p.documento_id = doc.id
        return
      }
      case 'acesso_a_aguardar': {
        const p = this.pagamentoDaSessao(op.session_id, op.pagamento_id)
        if (!p || p.estado !== 'pendente') return
        p.estado = 'a_aguardar_pagamento'
        p.metodo = op.metodo
        p.payment_intent_id = op.payment_intent_id
        p.multibanco = { entidade: op.entidade, referencia: op.referencia, expira_em: op.expira_em }
        return
      }
      case 'acesso_falhou': {
        const p = this.pagamentoDaSessao(op.session_id, op.pagamento_id)
        if (!p || p.estado === 'pago' || p.estado === 'reembolsado') return
        p.estado = 'falhou'
        p.motivo_falha = op.motivo
        return
      }
      case 'acesso_expirado': {
        const p = this.pagamentoDaSessao(op.session_id, op.pagamento_id)
        if (!p || p.estado !== 'pendente') return
        p.estado = 'expirado'
        return
      }
      case 'acesso_reembolsado': {
        const p = [...this.pagamentos.values()].find((x) => x.payment_intent_id === op.payment_intent_id)
        if (!p) return
        p.reembolsado_centimos = op.valor_reembolsado_centimos
        if (op.total) p.estado = 'reembolsado'
        this.alertas.push({ tipo: 'reembolso', ref: p.id })
        return
      }
      case 'subscricao_estado': {
        const existente = [...this.subscricoes.values()].find((s) => s.stripe_subscription_id === op.stripe_subscription_id)
        const instId = existente?.instituicao_id ?? op.instituicao_id
        if (!instId || !this.instituicoes.has(instId)) return
        const inst = this.instituicoes.get(instId)!
        this.subscricoes.set(instId, {
          instituicao_id: instId,
          stripe_subscription_id: op.stripe_subscription_id,
          estado: op.estado,
          inicio: op.inicio ?? existente?.inicio ?? null,
          compromisso_ate: existente?.compromisso_ate ?? (inst.plano_desde ? compromissoAte(inst.plano_desde) : null),
        })
        return
      }
      case 'fatura_estado': {
        let f = [...this.faturas.values()].find((x) => x.stripe_invoice_id === op.stripe_invoice_id)
        if (!f && op.fatura_id) {
          f = this.faturas.get(op.fatura_id)
          if (f) f.stripe_invoice_id = op.stripe_invoice_id
        }
        if (!f && op.origem === 'subscricao' && op.subscricao) {
          let sub = [...this.subscricoes.values()].find((s) => s.stripe_subscription_id === op.subscricao!.stripe_subscription_id)
          const instMeta = op.subscricao.instituicao_id ? this.instituicoes.get(op.subscricao.instituicao_id) : undefined
          if (!sub && instMeta && !this.subscricoes.has(instMeta.id)) {
            // a fatura chegou antes do registo da subscrição: liga-a pelo metadata
            sub = { instituicao_id: instMeta.id, stripe_subscription_id: op.subscricao.stripe_subscription_id, estado: 'incompleta', inicio: null, compromisso_ate: null }
            this.subscricoes.set(instMeta.id, sub)
          }
          if (!sub) throw new ErroBD('P0002', 'Subscrição desconhecida.')
          const inst = this.instituicoes.get(sub.instituicao_id)!
          const v = linhaLiquida(MENSALIDADE_CENTIMOS, inst.iva_percent)
          f = {
            id: uuid(),
            instituicao_id: inst.id,
            origem: 'subscricao',
            periodo: `${op.subscricao.periodo_inicio.slice(0, 7)}-01`,
            estado: 'rascunho',
            cobranca: 'debito_automatico',
            stripe_invoice_id: op.stripe_invoice_id,
            numero: op.numero,
            url: op.url,
            debito_em: null,
            emitida_em: null,
            paga_em: null,
            falhou_em: null,
            motivo: null,
            metodo: null,
            subtotal_centimos: v.liquidoCentimos,
            iva_centimos: v.ivaCentimos,
            total_centimos: v.totalCentimos,
            linhas: [],
            subscricao: { stripe_subscription_id: sub.stripe_subscription_id, periodo_inicio: op.subscricao.periodo_inicio, periodo_fim: op.subscricao.periodo_fim },
            divergente: op.total_centimos !== null && op.total_centimos !== v.totalCentimos,
            tentativas: 0,
          }
          this.faturas.set(f.id, f)
          if (f.divergente) this.alertas.push({ tipo: 'subscricao_divergente', ref: f.id })
          else {
            this.criarDocumento({
              tipo: 'FT',
              chave: chaveDocumento({ tipo: 'FT', subscricaoInvoice: op.stripe_invoice_id }),
              origem: 'subscricao',
              instituicao_id: inst.id,
              user_id: null,
              pagamento_id: null,
              fatura_id: f.id,
              data: diaLisboa(op.em),
              vencimento: diaLisboa(op.em),
              cliente: this.clienteEmpresa(inst),
              linhas: [{ tipo: 'mensalidade', periodo_inicio: op.subscricao.periodo_inicio, periodo_fim: op.subscricao.periodo_fim, valor_centimos: v.liquidoCentimos, iva_percent: inst.iva_percent }],
              pagamento: null,
              associados: [],
              total_centimos: v.totalCentimos,
              iva_centimos: v.ivaCentimos,
            })
          }
        }
        if (!f) return
        if (op.url) f.url = op.url
        if (op.numero) f.numero = op.numero
        this.transitar(f, op.estado, op.em, { motivo: op.motivo, metodo: op.metodo })
        return
      }
      case 'metodo_definido': {
        const inst = [...this.instituicoes.values()].find((i) => i.stripe_customer_id === op.stripe_customer_id)
        if (!inst) return
        inst.stripe_payment_method_id = op.payment_method_id
        inst.metodo = { tipo: op.tipo, ultimos4: op.ultimos4, mandato_ref: op.mandato_ref }
        return
      }
      case 'metodo_removido': {
        const inst = [...this.instituicoes.values()].find((i) => i.stripe_payment_method_id === op.payment_method_id)
        if (!inst) return
        inst.stripe_payment_method_id = null
        inst.metodo = null
        this.alertas.push({ tipo: 'metodo_removido', ref: inst.id })
        return
      }
      case 'disputa':
        this.alertas.push({ tipo: 'disputa', ref: op.charge_id })
        return
    }
    void agoraIso
  }

  private contextoSub(i: InstituicaoF) {
    const s = this.subscricoes.get(i.id) ?? null
    return {
      instituicao_id: i.id,
      natureza: i.natureza,
      demonstracao: i.demonstracao,
      plano: i.plano,
      plano_desde: i.plano_desde,
      compromisso_ate: i.natureza === 'privado' && i.plano === 'mensal' && i.plano_desde ? compromissoAte(i.plano_desde) : null,
      stripe_customer_id: i.stripe_customer_id,
      stripe_payment_method_id: i.stripe_payment_method_id,
      tem_metodo: !!i.metodo && !!i.stripe_payment_method_id,
      iva_percent: i.iva_percent,
      subscricao: s ? { stripe_subscription_id: s.stripe_subscription_id, estado: s.estado, inicio: s.inicio, compromisso_ate: s.compromisso_ate } : null,
    }
  }

  private pendente(d: DocumentoF): DocumentoPendenteRpc {
    return {
      id: d.id,
      tipo: d.tipo,
      chave: d.chave,
      tentativas: d.tentativas,
      origem: d.origem,
      instituicao_id: d.instituicao_id,
      user_id: d.user_id,
      pagamento_id: d.pagamento_id,
      fatura_id: d.fatura_id,
      data: d.data,
      vencimento: d.vencimento,
      cliente: d.cliente,
      linhas: d.linhas,
      pagamento: d.pagamento,
      documentos_associados: d.associados.map((id) => {
        const a = this.documentos.get(id)!
        return { documento_id: a.id, externo_id: a.externo_id!, numero: a.numero!, total_centimos: a.total_centimos }
      }),
      total_centimos: d.total_centimos,
      iva_centimos: d.iva_centimos,
      demonstracao: false,
    }
  }

  readonly impl: Implementacao = {
    servico_iniciar_execucao: ({ p_fase, p_duracao_segundos }) => {
      const ate = this.execucoes.get(p_fase) ?? 0
      if (ate > this.agora) return false
      this.execucoes.set(p_fase, this.agora + p_duracao_segundos * 1000)
      return true
    },
    servico_terminar_execucao: ({ p_fase }) => {
      this.execucoes.delete(p_fase)
      return null
    },
    servico_contexto_instituicao: ({ p_instituicao_id }) => {
      const i = this.instituicoes.get(p_instituicao_id)
      if (!i) return null
      return {
        instituicao_id: i.id,
        natureza: i.natureza,
        demonstracao: i.demonstracao,
        plano: i.plano,
        dados: i.dados,
        contrato: null,
        iva_percent: i.iva_percent,
        stripe_customer_id: i.stripe_customer_id,
        stripe_payment_method_id: i.stripe_payment_method_id,
        tem_metodo: !!i.metodo,
      }
    },
    servico_definir_cliente_stripe: ({ p_instituicao_id, p_customer_id }) => {
      const i = this.instituicoes.get(p_instituicao_id)
      if (!i) throw new ErroBD('P0002', 'Instituição desconhecida.')
      i.stripe_customer_id ??= p_customer_id
      return i.stripe_customer_id
    },
    servico_reservar_documentos: ({ p_agora, p_limite }) => {
      const agora = Date.parse(p_agora)
      let n = 0
      for (const e of this.entradas) {
        if (n >= p_limite) break
        const inst = this.instituicoes.get(e.instituicao_id)
        if (!inst || inst.demonstracao || !inst.dados) continue
        const ativa = [...this.linhas.values()].find((l) => l.candidatura_id === e.candidatura_id)
        const ef: EntradaFaturacao = {
          candidaturaId: e.candidatura_id,
          pedidoCriadoEm: e.pedido_criado_em,
          entradaData: e.entrada_data,
          confirmadaLarEm: e.lar_em,
          confirmadaFamiliaEm: e.familia_em,
          taxa: e.taxa,
          contestacao: null,
          linha: ativa ? { faturaId: ativa.fatura_id, documentoNumero: null } : null,
        }
        if (classificarEntrada(ef, agora).estado !== 'faturavel') continue
        const valor = 15000
        const linha: LinhaF = {
          id: uuid(),
          instituicao_id: inst.id,
          candidatura_id: e.candidatura_id,
          referencia: referenciaPedido(e.candidatura_id),
          entrada_data: e.entrada_data,
          valor_centimos: valor,
          iva_percent: inst.iva_percent,
          iva_centimos: ivaCentimos(valor, inst.iva_percent),
          fatura_id: null,
          documento_id: null,
        }
        this.linhas.set(linha.id, linha)
        const doc = this.criarDocumento({
          tipo: 'FT',
          chave: chaveDocumento({ tipo: 'FT', entrada: e.candidatura_id }),
          origem: 'entradas',
          instituicao_id: inst.id,
          user_id: null,
          pagamento_id: null,
          fatura_id: null,
          data: diaLisboa(agora),
          vencimento: somarDiasData(diaLisboa(agora), 30),
          cliente: this.clienteEmpresa(inst),
          linhas: [{ tipo: 'entrada', referencia: linha.referencia, entrada_data: linha.entrada_data, valor_centimos: valor, iva_percent: inst.iva_percent }],
          pagamento: null,
          associados: [],
          total_centimos: valor + linha.iva_centimos,
          iva_centimos: linha.iva_centimos,
        })
        linha.documento_id = doc.id
        n++
      }
      return { reservados: n }
    },
    servico_documentos_pendentes: ({ p_limite }) => {
      const prontos = [...this.documentos.values()].filter(
        (d) => d.estado !== 'emitido' && d.associados.every((a) => this.documentos.get(a)?.estado === 'emitido') && (d.tipo !== 'RC' || d.associados.length > 0),
      )
      prontos.sort((a, b) => (a.tipo === 'RC' ? 1 : 0) - (b.tipo === 'RC' ? 1 : 0))
      return prontos.slice(0, p_limite).map((d) => this.pendente(d))
    },
    servico_documento_emitido: ({ p_id, p_externo_id, p_numero, p_total_centimos, p_iva_centimos, p_emitido_em, p_emissor }) => {
      const d = this.documentos.get(p_id)
      if (!d) throw new ErroBD('P0002', 'Documento desconhecido.')
      if (d.estado === 'emitido') return null
      if (p_total_centimos !== d.total_centimos || (d.tipo !== 'RC' && p_iva_centimos !== d.iva_centimos)) throw new ErroBD('22023', 'Totais diferentes dos esperados.')
      Object.assign(d, { estado: 'emitido', externo_id: p_externo_id, numero: p_numero, emitido_em: p_emitido_em, emissor: p_emissor })
      return null
    },
    servico_documento_falhou: ({ p_id, p_erro }) => {
      const d = this.documentos.get(p_id)
      if (d) Object.assign(d, { estado: 'erro', tentativas: d.tentativas + 1, ultimo_erro: p_erro })
      return null
    },
    servico_documento_externo: ({ p_id }) => {
      const d = this.documentos.get(p_id)
      if (!d || d.estado !== 'emitido') return null
      return { id: d.id, tipo: d.tipo, numero: d.numero!, externo_id: d.externo_id!, emissor: d.emissor! }
    },
    servico_preparar_cobrancas: ({ p_agora, p_limite }) => {
      const agora = Date.parse(p_agora)
      const p = partesLisboa(agora)
      const periodo = periodoDe(deLisboa(p.ano, p.mes - 1, 1))
      const out = []
      for (const inst of this.instituicoes.values()) {
        if (out.length >= p_limite) break
        if (inst.demonstracao || !inst.stripe_customer_id) continue
        const livres = [...this.linhas.values()].filter((l) => l.instituicao_id === inst.id && !l.fatura_id)
        if (!livres.length) continue
        const t = totaisDocumento(livres.map((l) => linhaLiquida(l.valor_centimos, l.iva_percent)))
        const f: FaturaF = {
          id: uuid(),
          instituicao_id: inst.id,
          origem: 'entradas',
          periodo,
          estado: 'rascunho',
          cobranca: inst.stripe_payment_method_id ? 'debito_automatico' : 'pagamento_por_link',
          stripe_invoice_id: null,
          numero: null,
          url: null,
          debito_em: null,
          emitida_em: null,
          paga_em: null,
          falhou_em: null,
          motivo: null,
          metodo: null,
          subtotal_centimos: t.subtotalCentimos,
          iva_centimos: t.ivaCentimos,
          total_centimos: t.totalCentimos,
          linhas: livres.map((l) => l.id),
          subscricao: null,
          divergente: false,
          tentativas: 0,
        }
        this.faturas.set(f.id, f)
        for (const l of livres) {
          l.fatura_id = f.id
          const d = l.documento_id ? this.documentos.get(l.documento_id) : undefined
          if (d) d.fatura_id = f.id
        }
        out.push({
          fatura_id: f.id,
          instituicao_id: inst.id,
          periodo,
          stripe_customer_id: inst.stripe_customer_id,
          stripe_payment_method_id: inst.stripe_payment_method_id,
          linhas: livres.map((l) => ({
            referencia: l.referencia,
            entrada_data: l.entrada_data,
            valor_centimos: l.valor_centimos,
            iva_percent: l.iva_percent,
            iva_centimos: l.iva_centimos,
            documento_numero: (l.documento_id && this.documentos.get(l.documento_id)?.numero) || null,
          })),
          subtotal_centimos: f.subtotal_centimos,
          iva_centimos: f.iva_centimos,
          total_centimos: f.total_centimos,
        })
      }
      return out
    },
    servico_cobranca_criada: ({ p_fatura_id, p_stripe_invoice_id, p_numero, p_url, p_cobranca, p_debito_em }) => {
      const f = this.faturas.get(p_fatura_id)
      if (!f) throw new ErroBD('P0002', 'Fatura desconhecida.')
      Object.assign(f, { stripe_invoice_id: p_stripe_invoice_id, numero: p_numero, url: p_url, cobranca: p_cobranca, debito_em: p_debito_em })
      this.transitar(f, 'emitida', new Date(this.agora).toISOString())
      return null
    },
    servico_cobrancas_a_debitar: ({ p_agora, p_limite }) =>
      [...this.faturas.values()]
        .filter((f) => f.origem === 'entradas' && f.estado === 'emitida' && f.cobranca === 'debito_automatico' && f.debito_em && Date.parse(f.debito_em) <= Date.parse(p_agora) && f.stripe_invoice_id)
        .slice(0, p_limite)
        .map((f) => ({ fatura_id: f.id, instituicao_id: f.instituicao_id, stripe_invoice_id: f.stripe_invoice_id!, total_centimos: f.total_centimos, debito_em: f.debito_em!, tentativas: f.tentativas })),
    servico_cobranca_debito_iniciado: ({ p_fatura_id, p_estado, p_motivo, p_em }) => {
      const f = this.faturas.get(p_fatura_id)
      if (!f) throw new ErroBD('P0002', 'Fatura desconhecida.')
      f.tentativas++
      this.transitar(f, p_estado, p_em, { motivo: p_motivo })
      return null
    },
    servico_evento_iniciar: ({ p_id, p_tipo }) => {
      const e = this.eventos.get(p_id)
      if (e?.processado_em) return 'repetido'
      if (e) e.tentativas++
      else this.eventos.set(p_id, { tipo: p_tipo, processado_em: null, tentativas: 1, erro: null, operacoes: [] })
      return 'novo'
    },
    servico_evento_aplicar: ({ p_id, p_operacoes }) => {
      const e = this.eventos.get(p_id)
      if (!e) throw new ErroBD('P0002', 'Evento não iniciado.')
      if (e.processado_em) return false
      // transação: aplica tudo numa cópia e só confirma no fim
      const copia = structuredClone({ p: this.pagamentos, a: this.acessos, f: this.faturas, d: this.documentos, s: this.subscricoes, i: this.instituicoes, al: this.alertas })
      try {
        for (const op of p_operacoes) this.aplicar(op)
      } catch (err) {
        this.pagamentos = copia.p
        this.acessos = copia.a
        this.faturas = copia.f
        this.documentos = copia.d
        this.subscricoes = copia.s
        this.instituicoes = copia.i
        this.alertas = copia.al
        throw err
      }
      e.processado_em = new Date(this.agora).toISOString()
      e.operacoes = p_operacoes
      return true
    },
    servico_evento_falhou: ({ p_id, p_erro }) => {
      const e = this.eventos.get(p_id)
      if (e) e.erro = p_erro
      return null
    },
    servico_acesso_iniciar: ({ p_user_id, p_plano, p_texto_versao, p_ip, p_nif, p_nome_fiscal }) => {
      const u = this.exigirFamilia(p_user_id)
      const plano = planoFamilia(p_plano)
      if (!plano) throw new ErroBD('22023', 'Plano desconhecido.')
      if (!p_texto_versao) throw new ErroBD('22023', 'Falta a versão do consentimento.')
      if (p_nif) {
        const r = validarNIF(p_nif, 'b2c')
        if (!r.ok) throw new ErroBD('22023', r.erro)
      }
      const p: PagamentoF = {
        id: uuid(),
        user_id: u.id,
        plano: plano.id,
        valor_centimos: PLANOS_FAMILIA[plano.id].precoCentimos,
        dias: plano.dias,
        metodo: null,
        estado: 'pendente',
        session_id: null,
        payment_intent_id: null,
        multibanco: null,
        criado_em: new Date(this.agora).toISOString(),
        pago_em: null,
        motivo_falha: null,
        nif: p_nif,
        nome_fiscal: p_nome_fiscal,
        documento_id: null,
        reembolsado_centimos: 0,
      }
      this.pagamentos.set(p.id, p)
      this.consentimentos.push({ user_id: u.id, pagamento_id: p.id, plano: p.plano, texto_versao: p_texto_versao, aceite_em: p.criado_em, ip_truncado: p_ip })
      return { pagamento_id: p.id, valor_centimos: p.valor_centimos, plano: p.plano, dias: p.dias, demonstracao: u.demonstracao }
    },
    servico_acesso_sessao_criada: ({ p_pagamento_id, p_session_id }) => {
      const p = this.pagamentos.get(p_pagamento_id)
      if (!p) throw new ErroBD('P0002', 'Pagamento desconhecido.')
      if (p.estado === 'pendente' && !p.session_id) p.session_id = p_session_id
      return null
    },
    servico_subscricao_contexto: ({ p_instituicao_id }) => {
      const i = this.instituicoes.get(p_instituicao_id)
      return i ? this.contextoSub(i) : null
    },
    servico_subscricao_registar: ({ p_instituicao_id, p_stripe_subscription_id, p_estado, p_inicio }) => {
      const i = this.instituicoes.get(p_instituicao_id)
      if (!i) throw new ErroBD('P0002', 'Instituição desconhecida.')
      const atual = this.subscricoes.get(p_instituicao_id)
      this.subscricoes.set(p_instituicao_id, {
        instituicao_id: p_instituicao_id,
        stripe_subscription_id: p_stripe_subscription_id,
        estado: p_estado,
        inicio: p_inicio ?? atual?.inicio ?? null,
        compromisso_ate: i.plano === 'mensal' && i.plano_desde ? compromissoAte(i.plano_desde) : atual?.compromisso_ate ?? null,
      })
      return null
    },
    servico_subscricoes_a_sincronizar: ({ p_limite }) => {
      const out: { instituicao_id: string; acao: 'criar' | 'cancelar'; stripe_subscription_id: string | null }[] = []
      for (const i of this.instituicoes.values()) {
        if (i.demonstracao || i.natureza !== 'privado') continue
        const s = this.subscricoes.get(i.id)
        const ativa = s && s.estado !== 'cancelada'
        if (i.plano === 'mensal' && !ativa && i.metodo) out.push({ instituicao_id: i.id, acao: 'criar', stripe_subscription_id: null })
        if (i.plano !== 'mensal' && ativa) out.push({ instituicao_id: i.id, acao: 'cancelar', stripe_subscription_id: s!.stripe_subscription_id })
      }
      return out.slice(0, p_limite)
    },
    resolver_contestacao: () => {
      throw new ErroBD('42501', 'Não usado nos testes das funções.')
    },
  }
}

// ————————————————————————————————————————————————————————————— utilizador (JWT)

export class UtilizadorFalso implements PortaUtilizador {
  constructor(
    readonly bd: BDFalsa,
    readonly sessao: UtilizadorSessao | null,
    readonly opcoes: { instituicaoId?: string } = {},
  ) {}

  async utilizador() {
    return this.sessao
  }

  private exigirDono(): InstituicaoF {
    const i = this.opcoes.instituicaoId ? this.bd.instituicoes.get(this.opcoes.instituicaoId) : undefined
    if (!this.sessao || !i) throw new ErroBD('42501', 'Só a instituição pode ver a faturação.')
    return i
  }

  async rpc<K extends keyof RpcUtilizador>(nome: K, args: RpcUtilizador[K]['args']): Promise<RpcUtilizador[K]['resultado']> {
    const r = (() => {
      switch (nome) {
        case 'faturacao_resumo': {
          const i = this.exigirDono()
          return { instituicao_id: i.id, isenta: i.natureza !== 'privado' }
        }
        case 'painel_instituicao': {
          if (!this.opcoes.instituicaoId) return []
          const i = this.bd.instituicoes.get(this.opcoes.instituicaoId)!
          return [{ id: i.id, publicado: true, verificacao_estado: 'verificado', visualizacoes_30d: 0, lista_espera_offline: 0, lista_espera_online: 0, plano: i.plano, plano_desde: i.plano_desde, compromisso_ate: i.plano === 'mensal' && i.plano_desde ? compromissoAte(i.plano_desde) : null }]
        }
        case 'escolher_plano_instituicao': {
          const i = this.exigirDono()
          const p = (args as RpcUtilizador['escolher_plano_instituicao']['args']).p_plano
          if ((i.plano ?? 'por_entrada') !== p) {
            const ate = i.plano === 'mensal' && i.plano_desde ? compromissoAte(i.plano_desde) : null
            if (ate && Date.parse(ate) > this.bd.relogio.agora) throw new ErroBD('22023', 'A mensalidade tem um compromisso de 12 meses (BD).')
            i.plano = p
            i.plano_desde = new Date(this.bd.relogio.agora).toISOString()
          }
          return [{ instituicao_id: i.id, plano: i.plano, plano_desde: i.plano_desde, compromisso_ate: i.plano === 'mensal' && i.plano_desde ? compromissoAte(i.plano_desde) : null }]
        }
        default:
          throw new ErroBD('42883', `RPC ${nome} não usada pelas funções.`)
      }
    })()
    return structuredClone(r) as RpcUtilizador[K]['resultado']
  }

  async documentoVisivel(id: string) {
    const d = this.bd.documentos.get(id)
    if (!d || d.estado !== 'emitido' || !this.sessao) return false
    return d.user_id === this.sessao.id || (!!d.instituicao_id && d.instituicao_id === this.opcoes.instituicaoId)
  }
}

// ————————————————————————————————————————————————————————————— Stripe falso

export type ChamadaStripe = { metodo: keyof PortaStripe; id?: string; params?: unknown; opcoes?: OpcoesPedido }

export class StripeFalso implements PortaStripe {
  chamadas: ChamadaStripe[] = []
  private idem = new Map<string, { metodo: string; resultado: unknown }>()
  private n = 0
  clientes = new Map<string, { id: string; params: Stripe.CustomerCreateParams; taxIds: { id: string; type: string; value: string }[] }>()
  sessoes = new Map<string, { id: string; url: string; params: Stripe.Checkout.SessionCreateParams }>()
  subscricoes = new Map<string, { id: string; status: string; params: Stripe.SubscriptionCreateParams }>()
  faturas = new Map<string, { id: string; status: 'draft' | 'open' | 'paid'; number: string | null; params: Stripe.InvoiceCreateParams; itens: Stripe.InvoiceItemCreateParams[] }>()
  paymentIntents = new Map<string, Stripe.PaymentIntent>()
  setupIntents = new Map<string, Stripe.SetupIntent>()
  metodos = new Map<string, Stripe.PaymentMethod>()
  faturasComPagamentos = new Map<string, Stripe.Invoice>()
  faturaDePI = new Map<string, string>()
  cargas = new Map<string, Stripe.Charge>()
  /** erro a lançar na próxima chamada a um método */
  falhar = new Map<keyof PortaStripe, unknown>()
  /** resultado de invoices.pay: 'paid' (cartão), 'open' (SEPA em processamento) ou um erro */
  resultadoPagar: (invoiceId: string) => 'paid' | 'open' | Error = () => 'open'
  estadoNovaSubscricao = 'active'

  private id(prefixo: string) {
    this.n++
    return `${prefixo}_teste${String(this.n).padStart(4, '0')}`
  }

  private async registar<T>(metodo: keyof PortaStripe, dados: { id?: string; params?: unknown; opcoes?: OpcoesPedido }, f: () => T): Promise<T> {
    this.chamadas.push({ metodo, ...structuredClone(dados) })
    const erro = this.falhar.get(metodo)
    if (erro) {
      this.falhar.delete(metodo)
      throw erro
    }
    const chave = dados.opcoes?.idempotencyKey
    if (chave) {
      const antes = this.idem.get(chave)
      if (antes) {
        if (antes.metodo !== metodo) throw Object.assign(new Error('Idempotency key reused'), { type: 'StripeIdempotencyError' })
        return structuredClone(antes.resultado) as T
      }
    }
    const r = f()
    if (chave) this.idem.set(chave, { metodo, resultado: structuredClone(r) })
    return r
  }

  chamadasDe(metodo: keyof PortaStripe) {
    return this.chamadas.filter((c) => c.metodo === metodo)
  }

  criarCliente(p: Stripe.CustomerCreateParams, o: OpcoesPedido) {
    return this.registar('criarCliente', { params: p, opcoes: o }, () => {
      const id = this.id('cus')
      this.clientes.set(id, { id, params: p, taxIds: (p.tax_id_data ?? []).map((t) => ({ id: this.id('txi'), type: t.type, value: t.value })) })
      return { id }
    })
  }
  atualizarCliente(id: string, p: Stripe.CustomerUpdateParams, o: OpcoesPedido) {
    return this.registar('atualizarCliente', { id, params: p, opcoes: o }, () => ({ id }))
  }
  apagarCliente(id: string) {
    return this.registar('apagarCliente', { id }, () => {
      this.clientes.delete(id)
    })
  }
  listarTaxIds(cliente: string) {
    return this.registar('listarTaxIds', { id: cliente }, () => this.clientes.get(cliente)?.taxIds ?? [])
  }
  criarTaxId(cliente: string, p: Stripe.CustomerCreateTaxIdParams, o: OpcoesPedido) {
    return this.registar('criarTaxId', { id: cliente, params: p, opcoes: o }, () => {
      const t = { id: this.id('txi'), type: p.type, value: p.value }
      this.clientes.get(cliente)?.taxIds.push(t)
      return { id: t.id }
    })
  }
  apagarTaxId(cliente: string, id: string) {
    return this.registar('apagarTaxId', { id: `${cliente}/${id}` }, () => {
      const c = this.clientes.get(cliente)
      if (c) c.taxIds = c.taxIds.filter((t) => t.id !== id)
    })
  }
  criarSessaoCheckout(p: Stripe.Checkout.SessionCreateParams, o: OpcoesPedido) {
    return this.registar('criarSessaoCheckout', { params: p, opcoes: o }, () => {
      const id = this.id('cs_test')
      const s = { id, url: `https://checkout.stripe.com/c/pay/${id}`, params: p }
      this.sessoes.set(id, s)
      return { id, url: s.url }
    })
  }
  criarSessaoPortal(p: Stripe.BillingPortal.SessionCreateParams, o: OpcoesPedido) {
    return this.registar('criarSessaoPortal', { params: p, opcoes: o }, () => ({ url: `https://billing.stripe.com/p/session/${this.id('bps')}` }))
  }
  criarSubscricao(p: Stripe.SubscriptionCreateParams, o: OpcoesPedido) {
    return this.registar('criarSubscricao', { params: p, opcoes: o }, () => {
      const id = this.id('sub')
      this.subscricoes.set(id, { id, status: this.estadoNovaSubscricao, params: p })
      return { id, status: this.estadoNovaSubscricao, start_date: Math.floor(T0 / 1000) }
    })
  }
  atualizarSubscricao(id: string, p: Stripe.SubscriptionUpdateParams, o: OpcoesPedido) {
    return this.registar('atualizarSubscricao', { id, params: p, opcoes: o }, () => ({ id, status: this.subscricoes.get(id)?.status ?? 'active' }))
  }
  cancelarSubscricao(id: string, p: Stripe.SubscriptionCancelParams, o: OpcoesPedido) {
    return this.registar('cancelarSubscricao', { id, params: p, opcoes: o }, () => {
      const s = this.subscricoes.get(id)
      if (s) s.status = 'canceled'
      return { id, status: 'canceled' }
    })
  }
  criarFatura(p: Stripe.InvoiceCreateParams, o: OpcoesPedido) {
    return this.registar('criarFatura', { params: p, opcoes: o }, () => {
      const id = this.id('in')
      this.faturas.set(id, { id, status: 'draft', number: null, params: p, itens: [] })
      return { id }
    })
  }
  criarItemFatura(p: Stripe.InvoiceItemCreateParams, o: OpcoesPedido) {
    return this.registar('criarItemFatura', { params: p, opcoes: o }, () => {
      this.faturas.get(p.invoice!)?.itens.push(p)
      return { id: this.id('ii') }
    })
  }
  finalizarFatura(id: string, p: Stripe.InvoiceFinalizeInvoiceParams, o: OpcoesPedido) {
    return this.registar('finalizarFatura', { id, params: p, opcoes: o }, () => {
      const f = this.faturas.get(id)!
      f.status = 'open'
      f.number = `EL-${String(this.faturas.size).padStart(4, '0')}`
      return { id, number: f.number, hosted_invoice_url: `https://invoice.stripe.com/i/${id}`, status: 'open' }
    })
  }
  enviarFatura(id: string, o: OpcoesPedido) {
    return this.registar('enviarFatura', { id, opcoes: o }, () => ({ id }))
  }
  pagarFatura(id: string, p: Stripe.InvoicePayParams, o: OpcoesPedido) {
    return this.registar('pagarFatura', { id, params: p, opcoes: o }, () => {
      const r = this.resultadoPagar(id)
      if (r instanceof Error) throw r
      const f = this.faturas.get(id)
      if (f && r === 'paid') f.status = 'paid'
      return { id, status: r }
    })
  }
  lerSetupIntent(id: string) {
    return this.registar('lerSetupIntent', { id }, () => {
      const si = this.setupIntents.get(id)
      if (!si) throw Object.assign(new Error('No such setupintent'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
      return si
    })
  }
  lerPaymentIntent(id: string) {
    return this.registar('lerPaymentIntent', { id }, () => {
      const pi = this.paymentIntents.get(id)
      if (!pi) throw Object.assign(new Error('No such payment_intent'), { type: 'StripeInvalidRequestError', code: 'resource_missing' })
      return pi
    })
  }
  lerMetodoPagamento(id: string) {
    return this.registar('lerMetodoPagamento', { id }, () => this.metodos.get(id)!)
  }
  lerFaturaComPagamentos(id: string) {
    return this.registar('lerFaturaComPagamentos', { id }, () => this.faturasComPagamentos.get(id) ?? ({ id, payments: { data: [] } } as unknown as Stripe.Invoice))
  }
  faturaDoPaymentIntent(pi: string) {
    return this.registar('faturaDoPaymentIntent', { id: pi }, () => this.faturaDePI.get(pi) ?? null)
  }
  lerCarga(id: string) {
    return this.registar('lerCarga', { id }, () => this.cargas.get(id) ?? ({ id, customer: null } as unknown as Stripe.Charge))
  }
}

// ————————————————————————————————————————————————————————————— eventos e objetos do Stripe (fixtures)

let nEvento = 0

/** Evento do Stripe com o mínimo que o código lê (o resto do objeto não interessa aos testes). */
export function evento(tipo: string, objeto: Record<string, unknown>, extra: { previous_attributes?: Record<string, unknown>; livemode?: boolean; created?: number; id?: string } = {}): Stripe.Event {
  nEvento++
  return {
    id: extra.id ?? `evt_teste${String(nEvento).padStart(5, '0')}`,
    object: 'event',
    api_version: '2026-09-30.endive',
    created: extra.created ?? Math.floor(T0 / 1000),
    livemode: extra.livemode ?? false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    type: tipo,
    data: { object: objeto, ...(extra.previous_attributes ? { previous_attributes: extra.previous_attributes } : {}) },
  } as unknown as Stripe.Event
}

export function sessaoCheckout(c: { id: string; mode?: 'payment' | 'setup'; payment_status?: 'paid' | 'unpaid' | 'no_payment_required'; pagamentoId?: string | null; plano?: string; payment_intent?: string | null; amount_total?: number; setup_intent?: string | null; customer?: string | null; instituicaoId?: string }) {
  const mode = c.mode ?? 'payment'
  return {
    id: c.id,
    object: 'checkout.session',
    mode,
    status: 'complete',
    payment_status: c.payment_status ?? (mode === 'setup' ? 'no_payment_required' : 'paid'),
    payment_intent: c.payment_intent ?? null,
    setup_intent: c.setup_intent ?? null,
    customer: c.customer ?? null,
    amount_total: c.amount_total ?? null,
    client_reference_id: null,
    metadata: mode === 'payment' ? (c.pagamentoId ? { pagamento_id: c.pagamentoId, plano: c.plano ?? 'acesso_30' } : {}) : { instituicao_id: c.instituicaoId ?? 'lar-x' },
  }
}

export function paymentIntent(c: { id: string; tipo: 'card' | 'mb_way' | 'multibanco' | 'sepa_debit'; pagamentoId?: string; multibanco?: { entity: string; reference: string; expires_at: number }; erro?: { code: string; decline_code?: string } }): Stripe.PaymentIntent {
  return {
    id: c.id,
    object: 'payment_intent',
    metadata: c.pagamentoId ? { pagamento_id: c.pagamentoId } : {},
    payment_method: { id: `pm_${c.id}`, object: 'payment_method', type: c.tipo },
    payment_method_types: [c.tipo],
    next_action: c.multibanco ? { type: 'multibanco_display_details', multibanco_display_details: { ...c.multibanco, hosted_voucher_url: 'https://payments.stripe.com/multibanco/voucher/teste' } } : null,
    last_payment_error: c.erro ? { ...c.erro, type: 'card_error', payment_method: { type: c.tipo } } : null,
    status: c.multibanco ? 'requires_action' : 'succeeded',
  } as unknown as Stripe.PaymentIntent
}

/** Fatura do Stripe (cobrança por entrada ou mensalidade). */
export function faturaStripe(c: { id: string; total: number; faturaId?: string; instituicaoId?: string; subscricao?: { id: string; inicio: number; fim: number; instituicaoId?: string }; number?: string }): Record<string, unknown> {
  return {
    id: c.id,
    object: 'invoice',
    total: c.total,
    number: c.number ?? 'EL-0001',
    hosted_invoice_url: `https://invoice.stripe.com/i/${c.id}`,
    metadata: c.faturaId ? { fatura_id: c.faturaId, instituicao_id: c.instituicaoId ?? null } : {},
    status_transitions: { finalized_at: Math.floor(T0 / 1000), paid_at: Math.floor(T0 / 1000), voided_at: null, marked_uncollectible_at: null },
    parent: c.subscricao
      ? { type: 'subscription_details', quote_details: null, subscription_details: { subscription: c.subscricao.id, metadata: { instituicao_id: c.subscricao.instituicaoId ?? null } } }
      : null,
    period_start: c.subscricao?.inicio ?? Math.floor(T0 / 1000),
    period_end: c.subscricao?.fim ?? Math.floor(T0 / 1000),
    lines: { object: 'list', data: c.subscricao ? [{ period: { start: c.subscricao.inicio, end: c.subscricao.fim } }] : [] },
  }
}

/** Fatura com o último pagamento expandido (leitura de invoice.paid / invoice.payment_failed). */
export function faturaComPagamento(id: string, tipo: 'sepa_debit' | 'card', erro?: { code: string; decline_code?: string }): Stripe.Invoice {
  return {
    id,
    payments: {
      data: [{ created: 1, payment: { type: 'payment_intent', payment_intent: { id: `pi_${id}`, payment_method: { type: tipo }, last_payment_error: erro ? { ...erro, payment_method: { type: tipo } } : null } } }],
    },
  } as unknown as Stripe.Invoice
}

// ————————————————————————————————————————————————————————————— Moloni falso (fetch)

export const CFG_MOLONI: ConfigMoloni = {
  clientId: 'cliente',
  clientSecret: 'segredo',
  username: 'api@encontralar.pt',
  password: 'pw',
  companyId: 5,
  documentSetId: 9,
  produtos: { entrada: 101, mensalidade: 102, acesso: 103 },
  impostos: { 23: 11, 22: 12, 16: 13 },
  metodosPagamento: { sepa_debit: 21, card: 22, customer_balance: 23, mb_way: 24, multibanco: 25 },
  paisId: 1,
  idiomaId: 1,
  prazoVencimentoId: 31,
}

export const LINHA_ENTRADA: LinhaDocumento = { produto: 'entrada', descricao: 'Pedido EL-3F9A2B1C · entrada a 30/09/2026', quantidade: 1, liquidoCentimos: 15000, ivaPercent: 23, ivaCentimos: 3450, totalCentimos: 18450 }

/** Servidor Moloni falso: responde por endpoint e regista os pedidos. */
export function moloniFalso(respostas: Record<string, (corpo: Record<string, unknown>, n: number) => { status?: number; json: unknown }>) {
  const pedidos: { endpoint: string; url: string; corpo: Record<string, unknown> | null }[] = []
  const contagem = new Map<string, number>()
  const buscar: Buscar = async (url, init) => {
    const endpoint = new URL(url).pathname.replace(/^\/v1\//, '').replace(/\/$/, '')
    const corpo = init.body ? (JSON.parse(init.body) as Record<string, unknown>) : null
    pedidos.push({ endpoint, url, corpo })
    const n = (contagem.get(endpoint) ?? 0) + 1
    contagem.set(endpoint, n)
    const f = respostas[endpoint]
    if (!f) return { status: 404, json: async () => ({ error: 'nao_simulado' }) }
    const r = f(corpo ?? {}, n)
    return { status: r.status ?? 200, json: async () => r.json }
  }
  return { buscar, pedidos }
}


/**
 * Moloni com estado: guarda os documentos inseridos e calcula os totais como o Moloni (IVA por linha,
 * arredondado ao cêntimo) — para correr os fluxos completos com o MoloniEmissor verdadeiro.
 */
export function moloniComEstado() {
  const docs = new Map<number, { tipo: string; corpo: Record<string, unknown>; status: number; numero: number }>()
  const numeros = new Map<string, number>()
  let id = 1000
  const totais = (corpo: Record<string, unknown>) => {
    const produtos = (corpo.products as { price: number; qty: number; taxes: { value: number }[] }[] | undefined) ?? []
    let liquido = 0
    let iva = 0
    for (const p of produtos) {
      const l = Math.round(p.price * p.qty * 100)
      liquido += l
      for (const t of p.taxes) iva += Math.round((l * t.value) / 100)
    }
    if (!produtos.length) return { bruto: Math.round(Number(corpo.net_value) * 100), iva: 0 }
    return { bruto: liquido + iva, iva }
  }
  const recurso = (r: string, tipo: string) => ({
    [`${r}/insert`]: (c: Record<string, unknown>) => {
      id++
      docs.set(id, { tipo, corpo: c, status: Number(c.status), numero: 0 })
      return { json: { valid: 1, document_id: id } }
    },
    [`${r}/update`]: (c: Record<string, unknown>) => {
      const d = docs.get(Number(c.document_id))!
      d.status = Number(c.status)
      if (d.status === 1 && !d.numero) {
        const n = (numeros.get(tipo) ?? 0) + 1
        numeros.set(tipo, n)
        d.numero = n
      }
      return { json: { valid: 1 } }
    },
    [`${r}/getOne`]: (c: Record<string, unknown>) => {
      const d = docs.get(Number(c.document_id))!
      const t = totais(d.corpo)
      return { json: { document_id: c.document_id, status: d.status, number: d.numero, document_set_name: 'M2026', gross_value: (t.bruto / 100).toFixed(2), taxes_value: (t.iva / 100).toFixed(2) } }
    },
    [`${r}/getAll`]: (c: Record<string, unknown>) => ({
      json: [...docs.entries()].filter(([, d]) => d.tipo === tipo && d.corpo.your_reference === c.your_reference).map(([k, d]) => ({ document_id: k, your_reference: d.corpo.your_reference, status: d.status })),
    }),
    [`${r}/delete`]: (c: Record<string, unknown>) => {
      docs.delete(Number(c.document_id))
      return { json: { valid: 1 } }
    },
  })
  let cliente = 0
  const servidor = moloniFalso({
    grant: () => ({ json: { access_token: 'tok', expires_in: 3600, refresh_token: 'ref' } }),
    'customers/getByVat': () => ({ json: [] }),
    'customers/getNextNumber': () => ({ json: { number: String(cliente + 1) } }),
    'customers/insert': () => ({ json: { valid: 1, customer_id: ++cliente } }),
    'documents/getPDFLink': () => ({ json: { url: 'https://www.moloni.pt/downloads/doc.pdf' } }),
    ...recurso('invoices', 'FT'),
    ...recurso('invoiceReceipts', 'FR'),
    ...recurso('receipts', 'RC'),
  })
  return { ...servidor, docs }
}

export const iso = (t: number) => new Date(t).toISOString()

export { inicioDoDiaLisboa }
