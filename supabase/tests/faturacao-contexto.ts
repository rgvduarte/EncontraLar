/**
 * Contexto dos testes SQL da faturação (faturacao.test.ts e faturacao-lares.test.ts): uma base com todas as
 * migrações criada uma vez por ficheiro e ESVAZIADA antes de cada teste (isolamento total, sem repetir as
 * migrações), e os atalhos (RPC como o PostgREST, montagem de lares e entradas relativas a T = now() da base).
 */
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach } from 'vitest'
import { ErroBD, type DocumentoPendenteRpc, type OperacaoEvento } from '../functions/_shared/portas.ts'
import { DIA } from './funcoes/fakes.ts'
import { BDPGlite, chamarRpc, limparBase, MontagemSql } from './faturacao-bd'
import { admin, criarBase, type Quem } from './helpers'

export let db: PGlite
export let bd: BDPGlite
export let m: MontagemSql
/** now() da base no início do teste */
export let T: number

/**
 * Regista os hooks: uma base por ficheiro (todas as migrações), esvaziada antes de cada teste (TRUNCATE em cascata
 * a partir das contas e das fichas: muito mais rápido do que criar ou clonar uma base). Um teste que mude
 * privilégios repõe-nos no fim.
 */
export function usarBaseLimpa() {
  beforeAll(async () => {
    db = await criarBase()
    bd = new BDPGlite(db)
  }, 120_000)
  afterAll(async () => {
    await db.close()
  })
  beforeEach(async () => {
    await limparBase(db)
    m = new MontagemSql(db)
    T = (await admin<{ t: Date }>(db, 'select now() t'))[0]!.t.getTime()
  })
}

export const H = 3_600_000
export const em = (ms: number) => new Date(T + ms).toISOString()
export const adm = <X = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<X>(db, sql, params)
/* eslint-disable @typescript-eslint/no-explicit-any */
export const rpc = (quem: Quem, nome: string, args: object = {}): Promise<any> => chamarRpc(db, quem, nome, args)
export const falha = async (f: () => Promise<unknown>) => {
  try {
    await f()
    return null
  } catch (e) {
    return e instanceof ErroBD ? { codigo: e.codigo, mensagem: e.message } : { codigo: '?', mensagem: String(e) }
  }
}
let nEvento = 0
/** Um evento do webhook com estas operações (iniciar + aplicar). */
export const aplicar = async (ops: OperacaoEvento[]) => {
  const id = `evt_ft${++nEvento}`
  await bd.rpc('servico_evento_iniciar', { p_id: id, p_tipo: 'teste', p_livemode: false, p_criado_em: em(0) })
  return bd.rpc('servico_evento_aplicar', { p_id: id, p_operacoes: ops })
}
export const emitir = (d: DocumentoPendenteRpc, numero: string, emissor: 'falso' | 'moloni' = 'falso', externo = `falso:${d.chave}`) =>
  bd.rpc('servico_documento_emitido', { p_id: d.id, p_externo_id: externo, p_numero: numero, p_total_centimos: d.total_centimos, p_iva_centimos: d.iva_centimos, p_emitido_em: em(0), p_emissor: emissor })
export const pendentes = (ms = 0) => bd.rpc('servico_documentos_pendentes', { p_agora: em(ms), p_limite: 50 })
export const reservar = (ms = 0) => bd.rpc('servico_reservar_documentos', { p_modo: 'fatura_por_entrada', p_agora: em(ms), p_limite: 50 })
let nCand = 0
export const cand = () => `c${String(++nCand).padStart(7, '0')}-0000-4000-8000-000000000000`
/** entrada confirmada pelo lar há `dias` dias */
export const entradaLar = async (inst: string, dias = 10, extra: Partial<{ taxa: 'aplicavel' | 'incluida' | 'isenta'; pedido: number }> = {}) => {
  const id = cand()
  await m.entrada({ candidatura_id: id, instituicao_id: inst, pedido_criado_em: em(-(extra.pedido ?? 30) * DIA), entrada_data: new Date(T - (dias + 1) * DIA).toISOString().slice(0, 10), lar_em: em(-dias * DIA), familia_em: null, taxa: extra.taxa ?? 'aplicavel' })
  return id
}
/** entrada confirmada só pela família há `dias` dias */
export const entradaFamilia = async (inst: string, dias = 3) => {
  const id = cand()
  await m.entrada({ candidatura_id: id, instituicao_id: inst, pedido_criado_em: em(-30 * DIA), entrada_data: new Date(T - (dias + 1) * DIA).toISOString().slice(0, 10), lar_em: null, familia_em: em(-dias * DIA), taxa: 'aplicavel' })
  return id
}
export const LAR_SEPA = { stripe_customer_id: 'cus_ok', metodo: { tipo: 'sepa_debit' as const, ultimos4: '3000', mandato_ref: 'M-1', pm: 'pm_ok' } }
