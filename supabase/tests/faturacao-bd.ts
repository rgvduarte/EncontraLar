/**
 * Faturação: as peças partilhadas pelos testes da base de dados (PGlite).
 *
 * - BDPGlite: a PortaBD do contrato (supabase/functions/_shared/portas.ts) sobre a base de dados verdadeira — as
 *   mesmas chamadas que o adaptador Deno faz com supabase.rpc(nome, args), com a chave de serviço (service_role).
 * - UtilizadorPGlite: a PortaUtilizador (JWT de um utilizador: RLS e auth.uid() aplicam-se).
 * - Montagem: monta o mesmo cenário (famílias, lares, entradas) na BD falsa (BDFalsa, a referência) e no SQL.
 * - estadoFalso / estadoSql: o estado observável das duas numa forma canónica, para os testes de conformidade.
 * - normalizar: ids gerados → '#n' (pela ordem em que aparecem), instantes → minutos relativos a T.
 */
import type { PGlite } from '@electric-sql/pglite'
import {
  ErroBD,
  type DadosFiscaisRpc,
  type PortaBD,
  type PortaUtilizador,
  type RpcServico,
  type RpcUtilizador,
  type UtilizadorSessao,
} from '../functions/_shared/portas.ts'
import { ivaDaRegiao, regiaoFiscal } from '../functions/_shared/faturacao/regiao.ts'
import { DADOS_PESSOAIS, type BDFalsa } from './funcoes/fakes.ts'
import { admin, como, q, type Quem } from './helpers'

// ————————————————————————————————————————————————————————————— portas sobre o PGlite

/** RPC que não devolvem nada (o PostgREST responde null). */
const SEM_RESULTADO = new Set([
  'servico_terminar_execucao', 'servico_documento_emitido', 'servico_documento_falhou', 'servico_cobranca_criada',
  'servico_cobranca_debito_iniciado', 'servico_evento_falhou', 'servico_acesso_sessao_criada', 'servico_subscricao_registar',
])

/** Chama public.<nome>(args nomeados) como `quem`, com os objetos/listas em JSON (como o PostgREST), e lança ErroBD. */
export async function chamarRpc(db: PGlite, quem: Quem, nome: string, args: object): Promise<unknown> {
  const entradas = Object.entries(args).filter(([, v]) => v !== undefined)
  const sql = `select public.${nome}(${entradas.map(([k], i) => `${k} => $${i + 1}`).join(', ')}) as r`
  const params = entradas.map(([, v]) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v))
  try {
    const [linha] = await q<{ r: unknown }>(db, quem, sql, params)
    const r = linha?.r ?? null
    return SEM_RESULTADO.has(nome) ? null : r
  } catch (e) {
    const x = e as { code?: string; message?: string }
    throw new ErroBD(x.code ?? null, x.message ?? 'Erro na base de dados.')
  }
}

/** A PortaBD das Edge Functions sobre o PGlite (service_role). */
export class BDPGlite implements PortaBD {
  chamadas: { nome: string; args: unknown }[] = []
  constructor(readonly db: PGlite, readonly quem: Quem = 'service_role') {}
  async rpc<K extends keyof RpcServico>(nome: K, args: RpcServico[K]['args']): Promise<RpcServico[K]['resultado']> {
    this.chamadas.push({ nome, args: structuredClone(args) })
    return (await chamarRpc(this.db, this.quem, nome, args)) as RpcServico[K]['resultado']
  }
}

/** A PortaUtilizador (JWT) de um utilizador, sobre o PGlite. */
export class UtilizadorPGlite implements PortaUtilizador {
  constructor(readonly db: PGlite, readonly sessao: UtilizadorSessao | null) {}
  async utilizador() {
    return this.sessao
  }
  private get quem(): Quem {
    if (!this.sessao) return 'anon'
    return { sub: this.sessao.id, claims: this.sessao.anonimo ? { is_anonymous: true } : {} }
  }
  async rpc<K extends keyof RpcUtilizador>(nome: K, args: RpcUtilizador[K]['args']): Promise<RpcUtilizador[K]['resultado']> {
    // painel_instituicao e escolher_plano_instituicao devolvem linhas (setof): como o PostgREST, uma lista
    if (nome === 'painel_instituicao' || nome === 'escolher_plano_instituicao') {
      const entradas = Object.entries(args)
      const sql = `select * from public.${nome}(${entradas.map(([k], i) => `${k} => $${i + 1}`).join(', ')})`
      try {
        const linhas = await q<Record<string, unknown>>(this.db, this.quem, `select coalesce(json_agg(t), '[]'::json) as j from (${sql}) t`, entradas.map(([, v]) => v))
        const j = linhas[0]!.j
        return (typeof j === 'string' ? JSON.parse(j) : j) as RpcUtilizador[K]['resultado']
      } catch (e) {
        const x = e as { code?: string; message?: string }
        throw new ErroBD(x.code ?? null, x.message ?? 'Erro na base de dados.')
      }
    }
    return (await chamarRpc(this.db, this.quem, nome, args)) as RpcUtilizador[K]['resultado']
  }
  async documentoVisivel(id: string) {
    if (!this.sessao) return false
    try {
      return (await q(this.db, this.quem, 'select id from public.documentos_fiscais where id = $1', [id])).length === 1
    } catch {
      return false
    }
  }
}

// ————————————————————————————————————————————————————————————— montagem do cenário (falsa e SQL)

export interface FamiliaMontagem {
  role?: 'familia' | 'lar' | 'profissional'
  demonstracao?: boolean
  anonimo?: boolean
}

export interface LarMontagem {
  natureza?: 'ipss' | 'misericordia' | 'privado'
  demonstracao?: boolean
  plano?: 'por_entrada' | 'mensal' | null
  plano_desde?: string | null
  /** null = sem dados de faturação */
  dados?: DadosFiscaisRpc | null
  stripe_customer_id?: string | null
  metodo?: { tipo: 'sepa_debit' | 'card'; ultimos4: string; mandato_ref: string | null; pm: string } | null
}

export interface EntradaMontagem {
  candidatura_id: string
  instituicao_id: string
  pedido_criado_em: string
  entrada_data: string
  lar_em: string | null
  familia_em: string | null
  taxa: 'aplicavel' | 'incluida' | 'isenta'
}

export interface Montagem {
  familia(id: string, extra?: FamiliaMontagem): Promise<void>
  lar(id: string, extra?: LarMontagem): Promise<void>
  entrada(e: EntradaMontagem): Promise<void>
}

export const DADOS_LAR: DadosFiscaisRpc = {
  razao_social: 'Cuidados Exemplo, Lda.',
  nif: '599999993',
  morada: 'Rua das Camélias 128',
  codigo_postal: '4200-187',
  localidade: 'Porto',
  email: 'faturacao@lar.exemplo.pt',
}

/** O perfil de saúde que está na BD ao lado da faturação e NUNCA pode sair (minimização). */
export const PERFIL_SENSIVEL = {
  nome: DADOS_PESSOAIS.residente,
  idade: 84,
  grau: 'grave',
  necessidades: [DADOS_PESSOAIS.necessidade],
  notas: DADOS_PESSOAIS.notas,
}

export class MontagemFalsa implements Montagem {
  constructor(readonly bd: BDFalsa) {}
  async familia(id: string, extra: FamiliaMontagem = {}) {
    this.bd.familia(id, { role: extra.role ?? 'familia', demonstracao: extra.demonstracao ?? false, anonimo: extra.anonimo ?? false })
  }
  async lar(id: string, extra: LarMontagem = {}) {
    const dados = extra.dados === undefined ? DADOS_LAR : extra.dados
    this.bd.lar(id, {
      natureza: extra.natureza ?? 'privado',
      demonstracao: extra.demonstracao ?? false,
      plano: extra.plano ?? null,
      plano_desde: extra.plano_desde ?? null,
      dados: dados ? { ...dados } : null,
      iva_percent: ivaDaRegiao(regiaoFiscal(dados?.codigo_postal, 'Norte')),
      stripe_customer_id: extra.stripe_customer_id ?? null,
      stripe_payment_method_id: extra.metodo?.pm ?? null,
      metodo: extra.metodo ? { tipo: extra.metodo.tipo, ultimos4: extra.metodo.ultimos4, mandato_ref: extra.metodo.mandato_ref } : null,
    })
  }
  async entrada(e: EntradaMontagem) {
    this.bd.entrada(e.instituicao_id, { ...e })
  }
}

/** A mesma montagem no SQL, como administrador (postgres), com dados de saúde verdadeiros nos pedidos. */
export class MontagemSql implements Montagem {
  private titular: string | null = null
  constructor(readonly db: PGlite) {}

  async familia(id: string, extra: FamiliaMontagem = {}) {
    await criarConta(this.db, id, extra.role ?? 'familia', extra.anonimo ?? false)
    if (extra.demonstracao) await admin(this.db, 'update public.perfis_utilizador set demonstracao = true where id = $1', [id])
  }

  async lar(id: string, extra: LarMontagem = {}) {
    const dono = await criarConta(this.db, null, 'lar', false, `gestor-${id}@teste.pt`)
    const natureza = extra.natureza ?? 'privado'
    await admin(
      this.db,
      `insert into public.instituicoes (id, owner_id, nome, tipo, natureza, localidade, concelho, distrito, regiao, lat, lng, capacidade,
                                        demonstracao, plano, plano_desde)
       values ($1, $2, $3, 'erpi', $4, 'Porto', 'Porto', 'Porto', 'Norte', 41.15, -8.61, 40, $5, $6, $7)`,
      [id, dono, DADOS_PESSOAIS.nomeLar, natureza, extra.demonstracao ?? false, natureza === 'privado' ? extra.plano ?? null : null,
        natureza === 'privado' && extra.plano ? extra.plano_desde ?? new Date().toISOString() : null],
    )
    const dados = extra.dados === undefined ? DADOS_LAR : extra.dados
    if (dados) {
      const m = extra.metodo
      await admin(
        this.db,
        `insert into public.dados_faturacao (instituicao_id, razao_social, nif, morada, codigo_postal, localidade, email,
                                             stripe_customer_id, stripe_payment_method_id, metodo_tipo, metodo_ultimos4,
                                             metodo_mandato_ref, metodo_atualizado_em)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, case when $10::text is null then null else now() end)`,
        [id, dados.razao_social, dados.nif, dados.morada, dados.codigo_postal, dados.localidade, dados.email,
          extra.stripe_customer_id ?? null, m?.pm ?? null, m?.tipo ?? null, m?.ultimos4 ?? null, m?.mandato_ref ?? null],
      )
    }
  }

  async entrada(e: EntradaMontagem) {
    this.titular ??= await criarConta(this.db, null, 'familia', false, 'titular-das-entradas@teste.pt')
    await admin(
      this.db,
      `insert into public.candidaturas (id, instituicao_id, user_id, perfil_snapshot, contacto, estado, consentimento_em, created_at,
                                         desbloqueada_em, entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
       values ($1, $2, $3, $4, $5, 'admitida', $6, $6, $6, $7, $8, $9, $10)`,
      [e.candidatura_id, e.instituicao_id, this.titular, JSON.stringify(PERFIL_SENSIVEL),
        JSON.stringify({ nome: DADOS_PESSOAIS.familiar, telefone: DADOS_PESSOAIS.telefone, email: 'graca@exemplo.pt' }),
        e.pedido_criado_em, e.entrada_data, e.lar_em, e.familia_em, e.taxa],
    )
  }
}

let nConta = 0
/** Conta (auth.users → perfis_utilizador pelo trigger), com o papel dado pelo administrador. */
export async function criarConta(db: PGlite, id: string | null, role: string, anonimo: boolean, email?: string): Promise<string> {
  nConta++
  const app = { provider: anonimo ? 'anonymous' : 'email', providers: [anonimo ? 'anonymous' : 'email'], role }
  const r = await db.query<{ id: string }>(
    `insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, is_anonymous, email_confirmed_at)
     values (coalesce($1::uuid, gen_random_uuid()), $2, $3, '{}', $4, case when $4 then null else now() end) returning id`,
    [id, anonimo ? null : email ?? `conta-${nConta}-${Math.random().toString(36).slice(2, 8)}@teste.pt`, JSON.stringify(app), anonimo],
  )
  return r.rows[0]!.id
}

// ————————————————————————————————————————————————————————————— estado canónico

export interface EstadoCanonico {
  pagamentos: unknown[]
  consentimentos: unknown[]
  acessos: unknown[]
  linhas: unknown[]
  faturas: unknown[]
  documentos: unknown[]
  subscricoes: unknown[]
  instituicoes: unknown[]
  alertas: unknown[]
  eventos: unknown[]
}

/** Alertas que a BD falsa conhece; os outros (divergências, duplicados, anulações) são só do SQL (mais robusto). */
export const ALERTAS_DO_CONTRATO = new Set(['pagamento_falhou', 'reembolso', 'subscricao_divergente', 'metodo_removido', 'disputa'])

const porId = (a: { id?: unknown; instituicao_id?: unknown; user_id?: unknown }, b: typeof a) =>
  String(a.id ?? a.instituicao_id ?? a.user_id).localeCompare(String(b.id ?? b.instituicao_id ?? b.user_id))

export function estadoFalso(bd: BDFalsa): EstadoCanonico {
  return {
    pagamentos: [...bd.pagamentos.values()].map((p) => ({
      id: p.id, user_id: p.user_id, plano: p.plano, valor_centimos: p.valor_centimos, dias: p.dias, metodo: p.metodo, estado: p.estado,
      session_id: p.session_id, payment_intent_id: p.payment_intent_id, multibanco: p.multibanco, criado_em: p.criado_em, pago_em: p.pago_em,
      motivo_falha: p.motivo_falha, nif: p.nif, nome_fiscal: p.nome_fiscal, documento_id: p.documento_id, reembolsado_centimos: p.reembolsado_centimos,
    })),
    consentimentos: bd.consentimentos.map((c) => ({ ...c })),
    acessos: [...bd.acessos.entries()].map(([user_id, a]) => ({ user_id, plano: a.plano, ate: a.ate })).sort(porId),
    linhas: [...bd.linhas.values()].map((l) => ({
      id: l.id, instituicao_id: l.instituicao_id, candidatura_id: l.candidatura_id, referencia: l.referencia, entrada_data: l.entrada_data,
      valor_centimos: l.valor_centimos, iva_percent: l.iva_percent, iva_centimos: l.iva_centimos, fatura_id: l.fatura_id, documento_id: l.documento_id,
    })),
    faturas: [...bd.faturas.values()].map((f) => ({
      id: f.id, instituicao_id: f.instituicao_id, origem: f.origem, periodo: f.periodo, estado: f.estado, cobranca: f.cobranca,
      stripe_invoice_id: f.stripe_invoice_id, numero: f.numero, url: f.url, debito_em: f.debito_em, emitida_em: f.emitida_em, paga_em: f.paga_em,
      falhou_em: f.falhou_em, motivo: f.motivo, metodo: f.metodo, subtotal_centimos: f.subtotal_centimos, iva_centimos: f.iva_centimos,
      total_centimos: f.total_centimos, subscricao: f.subscricao, divergente: f.divergente, tentativas: f.tentativas, linhas: f.linhas,
    })),
    documentos: [...bd.documentos.values()].map((d) => ({
      id: d.id, tipo: d.tipo, chave: d.chave, estado: d.estado, origem: d.origem, instituicao_id: d.instituicao_id, user_id: d.user_id,
      pagamento_id: d.pagamento_id, fatura_id: d.fatura_id, data: d.data, vencimento: d.vencimento, cliente: d.cliente, linhas: d.linhas,
      pagamento: d.pagamento, associados: d.tipo === 'RC' ? d.associados : [], total_centimos: d.total_centimos, iva_centimos: d.iva_centimos,
      tentativas: d.tentativas, ultimo_erro: d.ultimo_erro, externo_id: d.externo_id, numero: d.numero, emitido_em: d.emitido_em, emissor: d.emissor,
    })),
    subscricoes: [...bd.subscricoes.values()].map((s) => ({ ...s })).sort(porId),
    instituicoes: [...bd.instituicoes.values()]
      .map((i) => ({ id: i.id, stripe_customer_id: i.stripe_customer_id, stripe_payment_method_id: i.stripe_payment_method_id, metodo: i.metodo }))
      .sort(porId),
    alertas: bd.alertas.map((a) => ({ ...a })),
    eventos: [...bd.eventos.entries()].map(([id, e]) => ({ id, processado: !!e.processado_em, tentativas: e.tentativas, erro: e.erro })).sort(porId),
  }
}

export async function estadoSql(db: PGlite): Promise<EstadoCanonico> {
  const sel = async (sql: string) => (await admin<{ j: unknown[] }>(db, `select coalesce(json_agg(t), '[]'::json) as j from (${sql}) t`))[0]!.j
  return {
    pagamentos: await sel(`
      select p.id, p.user_id, p.plano, p.valor_centimos, p.dias, p.metodo, p.estado, p.stripe_checkout_session_id as session_id,
             p.stripe_payment_intent_id as payment_intent_id,
             case when coalesce(p.multibanco_entidade, p.multibanco_referencia, p.multibanco_expira_em::text) is null then null
                  else json_build_object('entidade', p.multibanco_entidade, 'referencia', p.multibanco_referencia, 'expira_em', p.multibanco_expira_em) end as multibanco,
             p.criado_em, p.pago_em, p.motivo_falha, p.fatura_nif as nif, p.fatura_nome as nome_fiscal, p.documento_id, p.reembolsado_centimos
        from public.pagamentos_familia p order by p.ordem`),
    consentimentos: await sel(`
      select c.user_id, c.pagamento_id, c.plano, c.texto_versao, c.aceite_em, c.ip_truncado
        from public.consentimentos_acesso c join public.pagamentos_familia p on p.id = c.pagamento_id order by p.ordem`),
    acessos: await sel('select a.user_id, a.plano, a.ate from public.acessos_familia a order by a.user_id::text'),
    linhas: await sel(`
      select l.id, l.instituicao_id, l.candidatura_id, l.referencia, l.entrada_data, l.valor_centimos, l.iva_percent, l.iva_centimos,
             l.fatura_id, l.documento_id
        from public.fatura_linhas l order by l.ordem`),
    faturas: await sel(`
      select f.id, f.instituicao_id, f.origem, f.periodo, f.estado, f.cobranca, f.stripe_invoice_id, f.numero, f.url_pagamento as url,
             f.debito_em, f.emitida_em, f.paga_em, f.falhou_em, f.motivo_falha as motivo, f.metodo_pago as metodo,
             f.subtotal_centimos, f.iva_centimos, f.total_centimos,
             case when f.origem = 'subscricao' then json_build_object('stripe_subscription_id', f.stripe_subscription_id,
                    'periodo_inicio', f.periodo_inicio, 'periodo_fim', f.periodo_fim) end as subscricao,
             f.divergente, f.tentativas,
             (select coalesce(json_agg(l.id order by l.ordem), '[]'::json) from public.fatura_linhas l where l.fatura_id = f.id) as linhas
        from public.faturas f order by f.ordem`),
    documentos: await sel(`
      select d.id, d.tipo, d.chave, d.estado, d.origem, d.instituicao_id, d.user_id, d.pagamento_id, d.fatura_id, d.data, d.vencimento,
             d.cliente, d.linhas, d.pagamento,
             case when d.tipo = 'RC' then (select coalesce(json_agg(a.id order by a.ordem), '[]'::json) from public.documentos_fiscais a
                                            where a.fatura_id = d.fatura_id and a.tipo = 'FT') else '[]'::json end as associados,
             d.total_centimos, d.iva_centimos, d.tentativas, d.ultimo_erro, d.externo_id, d.numero, d.emitido_em, d.emissor
        from public.documentos_fiscais d order by d.ordem`),
    subscricoes: await sel(`
      select s.instituicao_id, s.stripe_subscription_id, s.estado, s.inicio, s.compromisso_ate
        from public.subscricoes_instituicao s order by s.instituicao_id`),
    instituicoes: await sel(`
      select i.id, d.stripe_customer_id, d.stripe_payment_method_id,
             case when d.metodo_tipo is null then null
                  else json_build_object('tipo', d.metodo_tipo, 'ultimos4', d.metodo_ultimos4, 'mandato_ref', d.metodo_mandato_ref) end as metodo
        from public.instituicoes i left join public.dados_faturacao d on d.instituicao_id = i.id order by i.id`),
    alertas: ((await sel('select a.tipo, a.ref from private.alertas_faturacao a order by a.id')) as { tipo: string }[]).filter((a) =>
      ALERTAS_DO_CONTRATO.has(a.tipo),
    ),
    eventos: await sel('select e.id, e.processado_em is not null as processado, e.tentativas, e.erro from public.stripe_eventos e order by e.id'),
  }
}

// ————————————————————————————————————————————————————————————— normalização

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/

/**
 * Normalizador com memória: os ids gerados (não "conhecidos") passam a '#1', '#2'… pela ordem em que aparecem
 * (também dentro de textos, ex.: 'FR:pag:<uuid>'); os instantes passam a 'T+<minutos>m' em relação a T
 * (o SQL usa now(), que avança alguns milissegundos entre chamadas; a BD falsa um relógio parado).
 */
export class Normalizador {
  private ids = new Map<string, string>()
  constructor(readonly t0: number, readonly conhecidos: ReadonlySet<string> = new Set()) {}

  id(u: string): string {
    const k = u.toLowerCase()
    if (this.conhecidos.has(k)) return k
    let v = this.ids.get(k)
    if (!v) {
      v = `#${this.ids.size + 1}`
      this.ids.set(k, v)
    }
    return v
  }

  valor(v: unknown): unknown {
    if (typeof v === 'string') {
      if (INSTANTE.test(v)) {
        const m = Math.round((Date.parse(v) - this.t0) / 60_000)
        return `T${m >= 0 ? '+' : ''}${m}m`
      }
      return v.replace(UUID, (u) => this.id(u))
    }
    if (v instanceof Date) return this.valor(v.toISOString())
    if (Array.isArray(v)) return v.map((x) => this.valor(x))
    if (v && typeof v === 'object') {
      const o: Record<string, unknown> = {}
      for (const k of Object.keys(v).sort()) o[k] = this.valor((v as Record<string, unknown>)[k])
      return o
    }
    return v
  }
}
