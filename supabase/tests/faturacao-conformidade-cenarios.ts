/**
 * Cenários de CONFORMIDADE (corridos por faturacao-conformidade.test.ts).
 *
 * CONFORMIDADE com o contrato das Edge Functions: os mesmos cenários correm na BD falsa (BDFalsa, a implementação
 * de referência em supabase/tests/funcoes/fakes.ts, contra a qual as funções foram testadas) e no SQL verdadeiro
 * (BDPGlite: as mesmas chamadas RPC que o adaptador Deno faz). Passo a passo comparam-se o resultado de cada RPC
 * (ou o erro: código e mensagem) e o estado observável inteiro (pagamentos, consentimentos, acessos, linhas,
 * faturas, documentos, subscrições, métodos, alertas e eventos), normalizados (ids gerados → #n; instantes →
 * minutos relativos a T, porque o SQL usa now() e a BD falsa um relógio parado).
 *
 * Diferenças DOCUMENTADAS (o SQL é mais robusto; ficam fora destes cenários e têm testes próprios em
 * faturacao.test.ts e faturacao-lares.test.ts): contestações (a BD falsa ignora-as), taxa do contrato (a falsa usa sempre 150 €), retoma
 * dos rascunhos em servico_preparar_cobrancas e FT ainda por emitir (o SQL não cobra uma fatura que não existe),
 * reserva de 10 min e recuo exponencial na fila de documentos, demonstração na fila (o SQL exclui-a), conflitos
 * de ids do Stripe e metadata divergente (o SQL alerta e não aplica), NIF 999999990 e normalização do NIF.
 */
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { diaLisboa } from '../functions/_shared/faturacao/datas.ts'
import { CONSENTIMENTO_ACESSO } from '../functions/_shared/faturacao/planos.ts'
import { ErroBD, type DocumentoPendenteRpc, type OperacaoEvento, type PortaBD, type RpcServico } from '../functions/_shared/portas.ts'
import { BDFalsa, DIA, Relogio } from './funcoes/fakes.ts'
import { BDPGlite, estadoFalso, estadoSql, limparBase, MontagemFalsa, MontagemSql, Normalizador, type Montagem } from './faturacao-bd'
import { admin, criarBase } from './helpers'

// ————————————————————————————————————————————————————————————— cenários

/* eslint-disable @typescript-eslint/no-explicit-any */
type R = Record<string, any>

interface Ctx {
  T: number
  /** instante T + ms (ISO) */
  em: (ms: number) => string
  /** dia de Lisboa de T + ms */
  dia: (ms: number) => string
  r: R
}

interface Passo {
  nome: string
  rpc: keyof RpcServico
  args: (c: Ctx) => object
  guardar?: string
  /** o passo tem de falhar (na referência) */
  erro?: true
}

export interface Cenario {
  nome: string
  ids: string[]
  montar: (m: Montagem, c: Ctx) => Promise<void>
  passos: Passo[]
}

const p = <K extends keyof RpcServico>(nome: string, rpc: K, args: (c: Ctx) => RpcServico[K]['args'], extra: { guardar?: string; erro?: true } = {}): Passo => ({
  nome,
  rpc,
  args,
  ...extra,
})

const H = 3_600_000
const V = CONSENTIMENTO_ACESSO.versao
const IP = '203.0.113.0'
const id = (prefixo: string, n: number) => `${prefixo}-0000-4000-8000-${String(n).padStart(12, '0')}`
const FAM = (n: number) => id('a0a0a0a0', n)
const CAND = (n: number) => id(`c1a0000${n}`.slice(0, 8), n)

/** Um evento do webhook: iniciar + aplicar (como processarEvento). */
const evento = (eid: string, tipo: string, ops: (c: Ctx) => OperacaoEvento[], extra: { erro?: true; quando?: number } = {}): Passo[] => [
  p(`${eid} iniciar`, 'servico_evento_iniciar', (c) => ({ p_id: eid, p_tipo: tipo, p_livemode: false, p_criado_em: c.em(extra.quando ?? 0) })),
  p(`${eid} aplicar`, 'servico_evento_aplicar', (c) => ({ p_id: eid, p_operacoes: ops(c) }), { erro: extra.erro }),
]

/** Emite (no emissor falso) o documento `i` da última lista de pendentes guardada em `chave`. */
const emitir = (chave: string, i: number, numero: string, extra: { total?: number; iva?: number; erro?: true } = {}) =>
  p(`emitir ${chave}[${i}] ${numero}`, 'servico_documento_emitido', (c) => {
    const d = (c.r[chave] as DocumentoPendenteRpc[])[i]!
    return {
      p_id: d.id,
      p_externo_id: `falso:${d.chave}`,
      p_numero: numero,
      p_total_centimos: d.total_centimos + (extra.total ?? 0),
      p_iva_centimos: d.iva_centimos + (extra.iva ?? 0),
      p_emitido_em: c.em(0),
      p_emissor: 'falso',
    }
  }, { erro: extra.erro })

const pendentes = (guardar: string, ms = 0) => p(`pendentes (T+${ms / H}h)`, 'servico_documentos_pendentes', (c) => ({ p_agora: c.em(ms), p_limite: 50 }), { guardar })

const iniciarAcesso = (user: string, plano: 'acesso_30' | 'acesso_90', guardar: string, fatura: { nif?: string; nome?: string } = {}, erro?: true) =>
  p(`iniciar ${plano}`, 'servico_acesso_iniciar', () => ({
    p_user_id: user, p_plano: plano, p_texto_versao: V, p_ip: IP, p_nif: fatura.nif ?? null, p_nome_fiscal: fatura.nome ?? null,
  }), { guardar, erro })

const sessao = (pag: string, session: string) => p(`sessão ${session}`, 'servico_acesso_sessao_criada', (c) => ({ p_pagamento_id: c.r[pag].pagamento_id, p_session_id: session }))

const pago = (session: string, pag: string | null, valor: number, metodo: 'card' | 'mb_way' | 'multibanco', pi: string, ms = 0) => (c: Ctx): OperacaoEvento[] => [
  { op: 'acesso_pago', session_id: session, pagamento_id: pag ? c.r[pag].pagamento_id : null, payment_intent_id: pi, metodo, valor_centimos: valor, pago_em: c.em(ms) },
]

const faturaEstado = (o: Partial<Extract<OperacaoEvento, { op: 'fatura_estado' }>> & { stripe_invoice_id: string; estado: Extract<OperacaoEvento, { op: 'fatura_estado' }>['estado'] }) =>
  ({ op: 'fatura_estado', fatura_id: null, origem: 'entradas', em: '', url: null, numero: null, motivo: null, metodo: null, total_centimos: null, subscricao: null, ...o }) as OperacaoEvento

const LAR_SEPA = { stripe_customer_id: 'cus_lar1', metodo: { tipo: 'sepa_debit' as const, ultimos4: '3000', mandato_ref: 'M-1', pm: 'pm_lar1' } }

export const CENARIOS: Cenario[] = [
  {
    nome: 'Acesso Família: cartão, evento repetido, Fatura-Recibo a consumidor final',
    ids: [FAM(1)],
    montar: async (m) => m.familia(FAM(1)),
    passos: [
      iniciarAcesso(FAM(1), 'acesso_30', 'ini'),
      sessao('ini', 'cs_test_a1'),
      sessao('ini', 'cs_test_outra'),
      ...evento('evt_a1', 'checkout.session.completed', pago('cs_test_a1', 'ini', 1490, 'card', 'pi_a1')),
      ...evento('evt_a1', 'checkout.session.completed', pago('cs_test_a1', 'ini', 1490, 'card', 'pi_a1')),
      pendentes('pend'),
      emitir('pend', 0, 'FR F2026/1'),
      emitir('pend', 0, 'FR F2026/1'),
      pendentes('vazio', H),
      p('documento externo', 'servico_documento_externo', (c) => ({ p_id: c.r.pend[0].id })),
    ],
  },
  {
    nome: 'Acesso Família: MB WAY com NIF e nome; uma segunda compra soma os dias (novoAte)',
    ids: [FAM(2)],
    montar: async (m) => m.familia(FAM(2)),
    passos: [
      iniciarAcesso(FAM(2), 'acesso_30', 'p1', { nif: '123456789', nome: 'Graça Rocha' }),
      sessao('p1', 'cs_test_b1'),
      ...evento('evt_b1', 'checkout.session.completed', pago('cs_test_b1', 'p1', 1490, 'mb_way', 'pi_b1')),
      iniciarAcesso(FAM(2), 'acesso_90', 'p2'),
      sessao('p2', 'cs_test_b2'),
      ...evento('evt_b2', 'checkout.session.completed', pago('cs_test_b2', 'p2', 2990, 'card', 'pi_b2')),
      pendentes('pend'),
      emitir('pend', 0, 'FR F2026/1'),
      emitir('pend', 1, 'FR F2026/2'),
    ],
  },
  {
    nome: 'Acesso Família: Multibanco a aguardar (sem acesso nem documento) e pago dias depois',
    ids: [FAM(3)],
    montar: async (m) => m.familia(FAM(3)),
    passos: [
      iniciarAcesso(FAM(3), 'acesso_30', 'ini'),
      sessao('ini', 'cs_test_c1'),
      ...evento('evt_c1', 'checkout.session.completed', (c) => [
        { op: 'acesso_a_aguardar', session_id: 'cs_test_c1', pagamento_id: c.r.ini.pagamento_id, payment_intent_id: 'pi_c1', metodo: 'multibanco', entidade: '11249', referencia: '123456789', expira_em: c.em(3 * DIA) },
      ]),
      pendentes('vazio'),
      ...evento('evt_c2', 'checkout.session.async_payment_succeeded', pago('cs_test_c1', 'ini', 1490, 'multibanco', 'pi_c1', 2 * DIA), { quando: 2 * DIA }),
      pendentes('pend', 2 * DIA),
      emitir('pend', 0, 'FR F2026/1'),
    ],
  },
  {
    nome: 'Acesso Família: referência expirada, sessão expirada, cartão recusado (e depois pago)',
    ids: [FAM(4)],
    montar: async (m) => m.familia(FAM(4)),
    passos: [
      iniciarAcesso(FAM(4), 'acesso_30', 'mb'),
      sessao('mb', 'cs_test_d1'),
      ...evento('evt_d1', 'checkout.session.completed', (c) => [
        { op: 'acesso_a_aguardar', session_id: 'cs_test_d1', pagamento_id: c.r.mb.pagamento_id, payment_intent_id: 'pi_d1', metodo: 'multibanco', entidade: '11249', referencia: '987654321', expira_em: c.em(DIA) },
      ]),
      ...evento('evt_d2', 'checkout.session.async_payment_failed', (c) => [{ op: 'acesso_falhou', session_id: 'cs_test_d1', pagamento_id: c.r.mb.pagamento_id, motivo: 'referencia_expirada' }]),
      // um expirado depois de falhado não muda nada
      ...evento('evt_d3', 'checkout.session.expired', (c) => [{ op: 'acesso_expirado', session_id: 'cs_test_d1', pagamento_id: c.r.mb.pagamento_id }]),
      iniciarAcesso(FAM(4), 'acesso_90', 'exp'),
      sessao('exp', 'cs_test_d2'),
      ...evento('evt_d4', 'checkout.session.expired', (c) => [{ op: 'acesso_expirado', session_id: 'cs_test_d2', pagamento_id: c.r.exp.pagamento_id }]),
      iniciarAcesso(FAM(4), 'acesso_30', 'rec'),
      sessao('rec', 'cs_test_d3'),
      ...evento('evt_d5', 'checkout.session.async_payment_failed', (c) => [{ op: 'acesso_falhou', session_id: 'cs_test_d3', pagamento_id: c.r.rec.pagamento_id, motivo: 'cartao_recusado' }]),
      ...evento('evt_d6', 'checkout.session.completed', pago('cs_test_d3', 'rec', 1490, 'card', 'pi_d3')),
      pendentes('pend'),
    ],
  },
  {
    nome: 'Acesso Família: reembolso parcial e total (marca e avisa a equipa, sem encurtar o acesso)',
    ids: [FAM(5)],
    montar: async (m) => m.familia(FAM(5)),
    passos: [
      iniciarAcesso(FAM(5), 'acesso_30', 'ini'),
      sessao('ini', 'cs_test_e1'),
      ...evento('evt_e1', 'checkout.session.completed', pago('cs_test_e1', 'ini', 1490, 'card', 'pi_e1')),
      ...evento('evt_e2', 'charge.refunded', (c) => [{ op: 'acesso_reembolsado', payment_intent_id: 'pi_e1', valor_reembolsado_centimos: 500, total: false, em: c.em(H) }]),
      ...evento('evt_e3', 'charge.refunded', (c) => [{ op: 'acesso_reembolsado', payment_intent_id: 'pi_e1', valor_reembolsado_centimos: 1490, total: true, em: c.em(2 * H) }]),
      // depois de reembolsado, um pago repetido não volta a estender o acesso
      ...evento('evt_e4', 'checkout.session.async_payment_succeeded', pago('cs_test_e1', 'ini', 1490, 'card', 'pi_e1')),
      ...evento('evt_e5', 'charge.refunded', (c) => [{ op: 'acesso_reembolsado', payment_intent_id: 'pi_desconhecido', valor_reembolsado_centimos: 100, total: true, em: c.em(0) }]),
    ],
  },
  {
    nome: 'Acesso Família: sessão nunca registada (encontra por metadata) e referências desconhecidas',
    ids: [FAM(6)],
    montar: async (m) => m.familia(FAM(6)),
    passos: [
      iniciarAcesso(FAM(6), 'acesso_30', 'p1'),
      iniciarAcesso(FAM(6), 'acesso_90', 'p2'),
      sessao('p2', 'cs_test_f2'),
      ...evento('evt_f1', 'checkout.session.completed', pago('cs_test_f1', 'p1', 1490, 'card', 'pi_f1')),
      ...evento('evt_f2', 'checkout.session.completed', pago('cs_test_desconhecida', null, 1490, 'card', 'pi_f9')),
      // pagamento_id de outro pagamento que já tem outra sessão: ignorado
      ...evento('evt_f3', 'checkout.session.completed', pago('cs_test_estranha', 'p2', 2990, 'card', 'pi_f8')),
    ],
  },
  {
    nome: 'Webhook: valor pago diferente falha o evento inteiro (atómico) e o evento volta a ser novo',
    ids: [FAM(7)],
    montar: async (m) => m.familia(FAM(7)),
    passos: [
      iniciarAcesso(FAM(7), 'acesso_30', 'ini'),
      sessao('ini', 'cs_test_g1'),
      ...evento('evt_g1', 'checkout.session.completed', (c) => [
        { op: 'acesso_a_aguardar', session_id: 'cs_test_g1', pagamento_id: c.r.ini.pagamento_id, payment_intent_id: 'pi_g1', metodo: 'multibanco', entidade: '11249', referencia: '111222333', expira_em: c.em(DIA) },
        ...pago('cs_test_g1', 'ini', 100, 'multibanco', 'pi_g1')(c),
      ], { erro: true }),
      p('evento falhou', 'servico_evento_falhou', () => ({ p_id: 'evt_g1', p_erro: 'ErroBD: Valor pago diferente do valor do passe.' })),
      ...evento('evt_g1', 'checkout.session.completed', pago('cs_test_g1', 'ini', 1490, 'multibanco', 'pi_g1')),
      p('aplicar evento não iniciado', 'servico_evento_aplicar', () => ({ p_id: 'evt_nunca', p_operacoes: [] }), { erro: true }),
      ...evento('evt_g2', 'ping', () => []),
      p('falhou de evento desconhecido', 'servico_evento_falhou', () => ({ p_id: 'evt_nenhum', p_erro: 'x' })),
    ],
  },
  {
    nome: 'Acesso Família: validações (família, anónima, plano, consentimento, NIF, pagamento desconhecido, demonstração)',
    ids: [FAM(8), FAM(9), FAM(10), FAM(11), FAM(12)],
    montar: async (m) => {
      await m.familia(FAM(8))
      await m.familia(FAM(9), { anonimo: true })
      await m.familia(FAM(10), { role: 'lar' })
      await m.familia(FAM(11), { demonstracao: true })
    },
    passos: [
      iniciarAcesso(FAM(9), 'acesso_30', 'anon', {}, true),
      iniciarAcesso(FAM(10), 'acesso_30', 'lar', {}, true),
      iniciarAcesso(FAM(12), 'acesso_30', 'nao_existe', {}, true),
      p('plano desconhecido', 'servico_acesso_iniciar', () => ({ p_user_id: FAM(8), p_plano: 'acesso_365' as 'acesso_30', p_texto_versao: V, p_ip: IP, p_nif: null, p_nome_fiscal: null }), { erro: true }),
      p('sem versão', 'servico_acesso_iniciar', () => ({ p_user_id: FAM(8), p_plano: 'acesso_30', p_texto_versao: '', p_ip: IP, p_nif: null, p_nome_fiscal: null }), { erro: true }),
      iniciarAcesso(FAM(8), 'acesso_30', 'nif_curto', { nif: '12345' }, true),
      iniciarAcesso(FAM(8), 'acesso_30', 'nif_errado', { nif: '123456788' }, true),
      p('sessão de pagamento desconhecido', 'servico_acesso_sessao_criada', () => ({ p_pagamento_id: id('99999999', 1), p_session_id: 'cs_test_x' }), { erro: true }),
      iniciarAcesso(FAM(11), 'acesso_90', 'demo'),
      iniciarAcesso(FAM(8), 'acesso_30', 'ok'),
    ],
  },
  {
    nome: 'Lar por entrada: FT por entrada faturável → cobrança → débito SEPA → paga → RC (incluída, isenta, janela e demonstração nunca)',
    ids: [CAND(1), CAND(2), CAND(3), CAND(4), CAND(5), CAND(6), CAND(7)],
    montar: async (m, c) => {
      await m.lar('lar-um', LAR_SEPA)
      await m.lar('ipss-um', { natureza: 'ipss' })
      await m.lar('lar-demo', { demonstracao: true, stripe_customer_id: 'cus_demo' })
      const ent = (n: number, inst: string, o: { pedido: number; entrada: number; lar?: number; familia?: number; taxa?: 'aplicavel' | 'incluida' | 'isenta' }) =>
        m.entrada({
          candidatura_id: CAND(n), instituicao_id: inst, pedido_criado_em: c.em(-o.pedido * DIA), entrada_data: c.dia(-o.entrada * DIA),
          lar_em: o.lar === undefined ? null : c.em(-o.lar * DIA), familia_em: o.familia === undefined ? null : c.em(-o.familia * DIA), taxa: o.taxa ?? 'aplicavel',
        })
      await ent(1, 'lar-um', { pedido: 60, entrada: 20, lar: 19 })
      await ent(2, 'lar-um', { pedido: 60, entrada: 21, familia: 20 })
      await ent(3, 'lar-um', { pedido: 30, entrada: 4, familia: 3 })
      await ent(4, 'lar-um', { pedido: 60, entrada: 20, lar: 19, taxa: 'incluida' })
      await ent(5, 'lar-um', { pedido: 500, entrada: 20, lar: 19 })
      await ent(6, 'ipss-um', { pedido: 60, entrada: 20, lar: 19, taxa: 'isenta' })
      await ent(7, 'lar-demo', { pedido: 60, entrada: 20, lar: 19 })
    },
    passos: [
      p('arrendar diário', 'servico_iniciar_execucao', () => ({ p_fase: 'diario', p_duracao_segundos: 900 })),
      p('arrendar diário outra vez', 'servico_iniciar_execucao', () => ({ p_fase: 'diario', p_duracao_segundos: 900 })),
      p('reservar', 'servico_reservar_documentos', (c) => ({ p_modo: 'fatura_por_entrada', p_agora: c.em(0), p_limite: 50 })),
      p('reservar de novo', 'servico_reservar_documentos', (c) => ({ p_modo: 'fatura_por_entrada', p_agora: c.em(0), p_limite: 50 })),
      pendentes('p1'),
      emitir('p1', 0, 'FT F2026/1'),
      emitir('p1', 1, 'FT F2026/2'),
      p('terminar diário', 'servico_terminar_execucao', () => ({ p_fase: 'diario', p_resumo: { reservados: 2 } })),
      p('arrendar diário depois', 'servico_iniciar_execucao', () => ({ p_fase: 'diario', p_duracao_segundos: 900 })),
      p('reservar 12 dias depois', 'servico_reservar_documentos', (c) => ({ p_modo: 'fatura_por_entrada', p_agora: c.em(12 * DIA), p_limite: 50 })),
      pendentes('p2', 12 * DIA),
      emitir('p2', 0, 'FT F2026/3'),
      p('preparar cobranças', 'servico_preparar_cobrancas', (c) => ({ p_modo: 'fatura_por_entrada', p_agora: c.em(19 * DIA), p_limite: 50 }), { guardar: 'cob' }),
      p('contexto do lar', 'servico_contexto_instituicao', () => ({ p_instituicao_id: 'lar-um' })),
      p('contexto da IPSS', 'servico_contexto_instituicao', () => ({ p_instituicao_id: 'ipss-um' })),
      p('contexto da demonstração', 'servico_contexto_instituicao', () => ({ p_instituicao_id: 'lar-demo' })),
      p('contexto desconhecido', 'servico_contexto_instituicao', () => ({ p_instituicao_id: 'nao-existe' })),
      p('cobrança criada', 'servico_cobranca_criada', (c) => ({
        p_fatura_id: c.r.cob[0].fatura_id, p_stripe_invoice_id: 'in_lar1_1', p_numero: 'EL-0001', p_url: 'https://invoice.stripe.com/i/in_lar1_1',
        p_cobranca: 'debito_automatico', p_debito_em: c.em(22 * DIA),
      })),
      ...evento('evt_i1', 'invoice.finalized', (c) => [faturaEstado({ stripe_invoice_id: 'in_lar1_1', fatura_id: c.r.cob[0].fatura_id, estado: 'emitida', em: c.em(19 * DIA), url: 'https://invoice.stripe.com/i/in_lar1_1', numero: 'EL-0001', total_centimos: 55350 })]),
      p('a debitar no pré-aviso', 'servico_cobrancas_a_debitar', (c) => ({ p_agora: c.em(21 * DIA), p_limite: 50 })),
      p('a debitar', 'servico_cobrancas_a_debitar', (c) => ({ p_agora: c.em(22 * DIA), p_limite: 50 }), { guardar: 'deb' }),
      p('débito em processamento', 'servico_cobranca_debito_iniciado', (c) => ({ p_fatura_id: c.r.deb[0].fatura_id, p_estado: 'em_processamento', p_motivo: null, p_em: c.em(22 * DIA) })),
      p('a debitar depois', 'servico_cobrancas_a_debitar', (c) => ({ p_agora: c.em(23 * DIA), p_limite: 50 })),
      // transições inválidas são ignoradas: em processamento não se anula nem volta a emitida
      ...evento('evt_i3', 'invoice.voided', (c) => [faturaEstado({ stripe_invoice_id: 'in_lar1_1', estado: 'anulada', em: c.em(23 * DIA) })]),
      ...evento('evt_i4', 'invoice.finalized', (c) => [faturaEstado({ stripe_invoice_id: 'in_lar1_1', estado: 'emitida', em: c.em(23 * DIA) })]),
      ...evento('evt_i2', 'invoice.paid', (c) => [faturaEstado({ stripe_invoice_id: 'in_lar1_1', estado: 'paga', em: c.em(26 * DIA), metodo: 'sepa_debit', total_centimos: 55350 })]),
      pendentes('p3', 26 * DIA),
      emitir('p3', 0, 'RC F2026/1'),
      pendentes('vazio', 27 * DIA),
      p('reservar no fim', 'servico_reservar_documentos', (c) => ({ p_modo: 'fatura_por_entrada', p_agora: c.em(27 * DIA), p_limite: 50 })),
      p('arrendar cobrança', 'servico_iniciar_execucao', () => ({ p_fase: 'cobranca', p_duracao_segundos: 900 })),
    ],
  },
  {
    nome: 'Lar por entrada: sem método → cobrança por link (nunca débito); débito com cartão recusado → falhou, depois paga',
    ids: [CAND(8), CAND(9)],
    montar: async (m, c) => {
      await m.lar('lar-b-link', { stripe_customer_id: 'cus_b' })
      await m.lar('lar-c-cartao', { stripe_customer_id: 'cus_c', metodo: { tipo: 'card', ultimos4: '4242', mandato_ref: null, pm: 'pm_c' } })
      for (const [n, inst] of [[8, 'lar-b-link'], [9, 'lar-c-cartao']] as const) {
        await m.entrada({ candidatura_id: CAND(n), instituicao_id: inst, pedido_criado_em: c.em(-30 * DIA), entrada_data: c.dia(-11 * DIA), lar_em: c.em(-10 * DIA), familia_em: null, taxa: 'aplicavel' })
      }
    },
    passos: [
      p('reservar', 'servico_reservar_documentos', (c) => ({ p_modo: 'fatura_por_entrada', p_agora: c.em(0), p_limite: 50 })),
      pendentes('p1'),
      emitir('p1', 0, 'FT F2026/1'),
      emitir('p1', 1, 'FT F2026/2'),
      p('preparar', 'servico_preparar_cobrancas', (c) => ({ p_modo: 'fatura_por_entrada', p_agora: c.em(19 * DIA), p_limite: 50 }), { guardar: 'cob' }),
      p('cobrança por link', 'servico_cobranca_criada', (c) => ({ p_fatura_id: c.r.cob[0].fatura_id, p_stripe_invoice_id: 'in_b', p_numero: 'EL-0002', p_url: 'https://invoice.stripe.com/i/in_b', p_cobranca: 'pagamento_por_link', p_debito_em: null })),
      p('cobrança com débito', 'servico_cobranca_criada', (c) => ({ p_fatura_id: c.r.cob[1].fatura_id, p_stripe_invoice_id: 'in_c', p_numero: 'EL-0003', p_url: 'https://invoice.stripe.com/i/in_c', p_cobranca: 'debito_automatico', p_debito_em: c.em(22 * DIA) })),
      p('a debitar', 'servico_cobrancas_a_debitar', (c) => ({ p_agora: c.em(30 * DIA), p_limite: 50 }), { guardar: 'deb' }),
      p('débito falhou', 'servico_cobranca_debito_iniciado', (c) => ({ p_fatura_id: c.r.deb[0].fatura_id, p_estado: 'falhou', p_motivo: 'saldo_insuficiente', p_em: c.em(22 * DIA) })),
      p('fatura falhada não se volta a debitar', 'servico_cobrancas_a_debitar', (c) => ({ p_agora: c.em(30 * DIA), p_limite: 50 })),
      p('fatura desconhecida', 'servico_cobranca_debito_iniciado', (c) => ({ p_fatura_id: id('99999999', 2), p_estado: 'paga', p_motivo: null, p_em: c.em(0) }), { erro: true }),
      ...evento('evt_j1', 'invoice.paid', (c) => [faturaEstado({ stripe_invoice_id: 'in_c', estado: 'paga', em: c.em(25 * DIA), metodo: 'card', total_centimos: 18450 })]),
      pendentes('p2', 25 * DIA),
      emitir('p2', 0, 'RC F2026/1'),
      ...evento('evt_j2', 'invoice.voided', (c) => [faturaEstado({ stripe_invoice_id: 'in_b', estado: 'anulada', em: c.em(26 * DIA) })]),
      ...evento('evt_j3', 'invoice.paid', (c) => [faturaEstado({ stripe_invoice_id: 'in_b', estado: 'paga', em: c.em(27 * DIA), metodo: 'card' })]),
      ...evento('evt_j4', 'invoice.paid', (c) => [faturaEstado({ stripe_invoice_id: 'in_desconhecida', estado: 'paga', em: c.em(27 * DIA) })]),
    ],
  },
  {
    nome: 'Fila de documentos: falha e nova tentativa, totais errados recusados, documento desconhecido',
    ids: [CAND(10)],
    montar: async (m, c) => {
      await m.lar('lar-k', LAR_SEPA)
      await m.entrada({ candidatura_id: CAND(10), instituicao_id: 'lar-k', pedido_criado_em: c.em(-30 * DIA), entrada_data: c.dia(-6 * DIA), lar_em: c.em(-5 * DIA), familia_em: null, taxa: 'aplicavel' })
    },
    passos: [
      p('reservar', 'servico_reservar_documentos', (c) => ({ p_modo: 'fatura_por_entrada', p_agora: c.em(0), p_limite: 50 })),
      pendentes('p1'),
      p('o emissor falhou', 'servico_documento_falhou', (c) => ({ p_id: c.r.p1[0].id, p_erro: 'Error: Moloni indisponível' })),
      pendentes('p2', DIA),
      emitir('p2', 0, 'FT F2026/1', { total: 1, erro: true }),
      emitir('p2', 0, 'FT F2026/1', { iva: 1, erro: true }),
      p('emitido desconhecido', 'servico_documento_emitido', (c) => ({ p_id: id('99999999', 3), p_externo_id: 'x', p_numero: 'FT X', p_total_centimos: 1, p_iva_centimos: 0, p_emitido_em: c.em(0), p_emissor: 'falso' }), { erro: true }),
      p('falhou desconhecido', 'servico_documento_falhou', () => ({ p_id: id('99999999', 4), p_erro: 'x' })),
      emitir('p2', 0, 'FT F2026/1'),
      p('externo', 'servico_documento_externo', (c) => ({ p_id: c.r.p1[0].id })),
      p('externo desconhecido', 'servico_documento_externo', () => ({ p_id: id('99999999', 5) })),
      pendentes('vazio', 2 * DIA),
    ],
  },
  {
    nome: 'Mensalidade: subscrição registada, FT e RC da mensalidade, eventos fora de ordem, total divergente, débito falhado',
    ids: [],
    montar: async (m, c) => {
      await m.lar('lar-mensal', { plano: 'mensal', plano_desde: c.em(-DIA), stripe_customer_id: 'cus_m', metodo: { tipo: 'sepa_debit', ultimos4: '3000', mandato_ref: 'M-2', pm: 'pm_m' } })
    },
    passos: [
      p('contexto', 'servico_subscricao_contexto', () => ({ p_instituicao_id: 'lar-mensal' })),
      p('a sincronizar', 'servico_subscricoes_a_sincronizar', () => ({ p_limite: 20 })),
      p('registar', 'servico_subscricao_registar', (c) => ({ p_instituicao_id: 'lar-mensal', p_stripe_subscription_id: 'sub_m1', p_estado: 'ativa', p_inicio: c.em(0) })),
      p('a sincronizar depois', 'servico_subscricoes_a_sincronizar', () => ({ p_limite: 20 })),
      ...evento('evt_l1', 'customer.subscription.created', (c) => [{ op: 'subscricao_estado', stripe_subscription_id: 'sub_m1', stripe_customer_id: 'cus_m', instituicao_id: 'lar-mensal', estado: 'ativa', inicio: c.em(0), cancelada_em: null }]),
      ...evento('evt_l2', 'invoice.finalized', (c) => [faturaEstado({
        stripe_invoice_id: 'in_m1', origem: 'subscricao', estado: 'emitida', em: c.em(0), url: 'https://invoice.stripe.com/i/in_m1', numero: 'EL-1001', total_centimos: 3567,
        subscricao: { stripe_subscription_id: 'sub_m1', instituicao_id: 'lar-mensal', periodo_inicio: c.dia(0), periodo_fim: c.dia(29 * DIA) },
      })]),
      pendentes('p1'),
      emitir('p1', 0, 'FT F2026/1'),
      ...evento('evt_l3', 'invoice.paid', (c) => [faturaEstado({
        stripe_invoice_id: 'in_m1', origem: 'subscricao', estado: 'paga', em: c.em(4 * DIA), metodo: 'sepa_debit', total_centimos: 3567,
        subscricao: { stripe_subscription_id: 'sub_m1', instituicao_id: 'lar-mensal', periodo_inicio: c.dia(0), periodo_fim: c.dia(29 * DIA) },
      })]),
      pendentes('p2', 4 * DIA),
      emitir('p2', 0, 'RC F2026/1'),
      // pago antes de emitido: cria a fatura, a FT e o RC; o finalized que chega depois não muda nada
      ...evento('evt_l4', 'invoice.paid', (c) => [faturaEstado({
        stripe_invoice_id: 'in_m2', origem: 'subscricao', estado: 'paga', em: c.em(30 * DIA), metodo: 'card', total_centimos: 3567,
        subscricao: { stripe_subscription_id: 'sub_m1', instituicao_id: null, periodo_inicio: c.dia(30 * DIA), periodo_fim: c.dia(59 * DIA) },
      })]),
      ...evento('evt_l5', 'invoice.finalized', (c) => [faturaEstado({
        stripe_invoice_id: 'in_m2', origem: 'subscricao', estado: 'emitida', em: c.em(30 * DIA), total_centimos: 3567,
        subscricao: { stripe_subscription_id: 'sub_m1', instituicao_id: null, periodo_inicio: c.dia(30 * DIA), periodo_fim: c.dia(59 * DIA) },
      })]),
      pendentes('p3', 30 * DIA),
      emitir('p3', 0, 'FT F2026/2'),
      pendentes('p4', 30 * DIA + H),
      emitir('p4', 0, 'RC F2026/2'),
      ...evento('evt_l6', 'invoice.finalized', (c) => [faturaEstado({
        stripe_invoice_id: 'in_m3', origem: 'subscricao', estado: 'emitida', em: c.em(31 * DIA), total_centimos: 1200,
        subscricao: { stripe_subscription_id: 'sub_m1', instituicao_id: null, periodo_inicio: c.dia(31 * DIA), periodo_fim: c.dia(32 * DIA) },
      })]),
      ...evento('evt_l7', 'invoice.finalized', (c) => [faturaEstado({
        stripe_invoice_id: 'in_m4', origem: 'subscricao', estado: 'emitida', em: c.em(60 * DIA), total_centimos: 3567,
        subscricao: { stripe_subscription_id: 'sub_m1', instituicao_id: null, periodo_inicio: c.dia(60 * DIA), periodo_fim: c.dia(89 * DIA) },
      })]),
      ...evento('evt_l8', 'invoice.payment_failed', (c) => [faturaEstado({ stripe_invoice_id: 'in_m4', origem: 'subscricao', estado: 'falhou', em: c.em(64 * DIA), motivo: 'saldo_insuficiente', total_centimos: 3567 })]),
      ...evento('evt_l9', 'customer.subscription.updated', () => [{ op: 'subscricao_estado', stripe_subscription_id: 'sub_m1', stripe_customer_id: 'cus_m', instituicao_id: 'lar-mensal', estado: 'em_atraso', inicio: null, cancelada_em: null }]),
      p('contexto no fim', 'servico_subscricao_contexto', () => ({ p_instituicao_id: 'lar-mensal' })),
      p('a sincronizar no fim', 'servico_subscricoes_a_sincronizar', () => ({ p_limite: 20 })),
    ],
  },
  {
    nome: 'Mensalidade: a primeira fatura chega antes do registo (liga pela metadata); subscrição desconhecida falha',
    ids: [],
    montar: async (m, c) => {
      await m.lar('lar-mensal-novo', { plano: 'mensal', plano_desde: c.em(-H), stripe_customer_id: 'cus_n', metodo: { tipo: 'sepa_debit', ultimos4: '0154', mandato_ref: 'M-3', pm: 'pm_n' } })
    },
    passos: [
      ...evento('evt_m1', 'invoice.finalized', (c) => [faturaEstado({
        stripe_invoice_id: 'in_n0', origem: 'subscricao', estado: 'emitida', em: c.em(0), total_centimos: 3567,
        subscricao: { stripe_subscription_id: 'sub_novo', instituicao_id: 'lar-mensal-novo', periodo_inicio: c.dia(0), periodo_fim: c.dia(30 * DIA) },
      })]),
      ...evento('evt_m2', 'customer.subscription.created', (c) => [{ op: 'subscricao_estado', stripe_subscription_id: 'sub_novo', stripe_customer_id: 'cus_n', instituicao_id: 'lar-mensal-novo', estado: 'ativa', inicio: c.em(0), cancelada_em: null }]),
      ...evento('evt_m3', 'invoice.finalized', (c) => [faturaEstado({
        stripe_invoice_id: 'in_x', origem: 'subscricao', estado: 'emitida', em: c.em(0), total_centimos: 3567,
        subscricao: { stripe_subscription_id: 'sub_desconhecida', instituicao_id: null, periodo_inicio: c.dia(0), periodo_fim: c.dia(30 * DIA) },
      })], { erro: true }),
      ...evento('evt_m4', 'customer.subscription.updated', () => [{ op: 'subscricao_estado', stripe_subscription_id: 'sub_sem_lar', stripe_customer_id: null, instituicao_id: null, estado: 'ativa', inicio: null, cancelada_em: null }]),
      pendentes('p1'),
    ],
  },
  {
    nome: 'Modalidade: reconciliar (cancelar a subscrição de quem voltou à taxa por entrada; sem método, demonstração e IPSS nunca)',
    ids: [],
    montar: async (m, c) => {
      await m.lar('lar-seis', { plano: 'por_entrada', plano_desde: c.em(-10 * DIA), stripe_customer_id: 'cus_6', metodo: { tipo: 'sepa_debit', ultimos4: '1111', mandato_ref: 'M-6', pm: 'pm_6' } })
      await m.lar('lar-sete', { plano: 'mensal', plano_desde: c.em(-DIA) })
      await m.lar('lar-demo-mensal', { demonstracao: true, plano: 'mensal', plano_desde: c.em(-DIA), stripe_customer_id: 'cus_d', metodo: { tipo: 'sepa_debit', ultimos4: '2222', mandato_ref: 'M-D', pm: 'pm_d' } })
      await m.lar('ipss-dois', { natureza: 'ipss' })
    },
    passos: [
      p('registar ativa', 'servico_subscricao_registar', (c) => ({ p_instituicao_id: 'lar-seis', p_stripe_subscription_id: 'sub_6', p_estado: 'ativa', p_inicio: c.em(-400 * DIA) })),
      p('a sincronizar', 'servico_subscricoes_a_sincronizar', () => ({ p_limite: 20 })),
      p('registar cancelada', 'servico_subscricao_registar', () => ({ p_instituicao_id: 'lar-seis', p_stripe_subscription_id: 'sub_6', p_estado: 'cancelada', p_inicio: null })),
      p('a sincronizar depois', 'servico_subscricoes_a_sincronizar', () => ({ p_limite: 20 })),
      p('registar instituição desconhecida', 'servico_subscricao_registar', () => ({ p_instituicao_id: 'nao-existe', p_stripe_subscription_id: 'sub_x', p_estado: 'ativa', p_inicio: null }), { erro: true }),
      p('contexto demonstração', 'servico_subscricao_contexto', () => ({ p_instituicao_id: 'lar-demo-mensal' })),
      p('contexto sem método', 'servico_subscricao_contexto', () => ({ p_instituicao_id: 'lar-sete' })),
      p('contexto desconhecido', 'servico_subscricao_contexto', () => ({ p_instituicao_id: 'nao-existe' })),
    ],
  },
  {
    nome: 'Cliente Stripe e método de pagamento: guardar uma vez, mandato SEPA, removido, disputa',
    ids: [],
    montar: async (m) => {
      await m.lar('lar-metodo')
    },
    passos: [
      p('definir cliente', 'servico_definir_cliente_stripe', () => ({ p_instituicao_id: 'lar-metodo', p_customer_id: 'cus_o1' })),
      p('definir outro (fica o primeiro)', 'servico_definir_cliente_stripe', () => ({ p_instituicao_id: 'lar-metodo', p_customer_id: 'cus_o2' })),
      p('instituição desconhecida', 'servico_definir_cliente_stripe', () => ({ p_instituicao_id: 'nao-existe', p_customer_id: 'cus_o3' }), { erro: true }),
      p('contexto sem método', 'servico_contexto_instituicao', () => ({ p_instituicao_id: 'lar-metodo' })),
      ...evento('evt_o1', 'checkout.session.completed', () => [{ op: 'metodo_definido', stripe_customer_id: 'cus_o1', instituicao_id: 'lar-metodo', payment_method_id: 'pm_o1', tipo: 'sepa_debit', ultimos4: '3000', banco: '0002', validade: null, mandato_ref: 'MANDATO-1' }]),
      p('contexto com método', 'servico_contexto_instituicao', () => ({ p_instituicao_id: 'lar-metodo' })),
      p('contexto da subscrição com método', 'servico_subscricao_contexto', () => ({ p_instituicao_id: 'lar-metodo' })),
      ...evento('evt_o2', 'customer.updated', () => [{ op: 'metodo_definido', stripe_customer_id: 'cus_desconhecido', instituicao_id: null, payment_method_id: 'pm_x', tipo: 'card', ultimos4: '4242', banco: null, validade: '12/2030', mandato_ref: null }]),
      ...evento('evt_o3', 'customer.updated', () => [{ op: 'metodo_definido', stripe_customer_id: 'cus_o1', instituicao_id: null, payment_method_id: 'pm_o2', tipo: 'card', ultimos4: '4242', banco: null, validade: '12/2030', mandato_ref: null }]),
      ...evento('evt_o4', 'payment_method.detached', () => [{ op: 'metodo_removido', stripe_customer_id: null, payment_method_id: 'pm_o2' }]),
      ...evento('evt_o5', 'mandate.updated', () => [{ op: 'metodo_removido', stripe_customer_id: null, payment_method_id: 'pm_nenhum' }]),
      ...evento('evt_o6', 'charge.dispute.created', () => [{ op: 'disputa', stripe_customer_id: 'cus_o1', payment_intent_id: 'pi_o', charge_id: 'ch_o1', motivo: 'fraudulent', valor_centimos: 3567 }]),
      p('contexto no fim', 'servico_contexto_instituicao', () => ({ p_instituicao_id: 'lar-metodo' })),
    ],
  },
  {
    nome: 'Tarefas agendadas: arrendamento por fase',
    ids: [],
    montar: async () => {},
    passos: [
      p('diário', 'servico_iniciar_execucao', () => ({ p_fase: 'diario', p_duracao_segundos: 900 })),
      p('diário ocupado', 'servico_iniciar_execucao', () => ({ p_fase: 'diario', p_duracao_segundos: 900 })),
      p('cobrança (outra fase)', 'servico_iniciar_execucao', () => ({ p_fase: 'cobranca', p_duracao_segundos: 900 })),
      p('terminar diário', 'servico_terminar_execucao', () => ({ p_fase: 'diario', p_resumo: { documentos: { emitidos: 0 } } })),
      p('diário outra vez', 'servico_iniciar_execucao', () => ({ p_fase: 'diario', p_duracao_segundos: 900 })),
      p('cobrança ocupada', 'servico_iniciar_execucao', () => ({ p_fase: 'cobranca', p_duracao_segundos: 900 })),
    ],
  },
]

// ————————————————————————————————————————————————————————————— execução nas duas implementações

interface Registo {
  passo: string
  resultado: unknown
  estado: unknown
}

async function correr(c: Cenario, impl: { porta: PortaBD; montagem: Montagem; estado: () => Promise<unknown> | unknown }, T: number): Promise<Registo[]> {
  const ctx: Ctx = { T, em: (ms) => new Date(T + ms).toISOString(), dia: (ms) => diaLisboa(T + ms), r: {} }
  const norm = new Normalizador(T, new Set(c.ids.map((x) => x.toLowerCase())))
  await c.montar(impl.montagem, ctx)
  const out: Registo[] = [{ passo: '(montagem)', resultado: null, estado: norm.valor(await impl.estado()) }]
  for (const passo of c.passos) {
    let resultado: unknown
    try {
      resultado = await impl.porta.rpc(passo.rpc, passo.args(ctx) as never)
      if (passo.guardar) ctx.r[passo.guardar] = resultado
    } catch (e) {
      if (!(e instanceof ErroBD)) throw e
      resultado = { erro: { codigo: e.codigo, mensagem: e.message } }
    }
    out.push({ passo: passo.nome, resultado: norm.valor(resultado), estado: norm.valor(await impl.estado()) })
  }
  return out
}

/**
 * Regista um describe por grupo de cenários: cada cenário corre na base (com todas as migrações, esvaziada antes) e
 * na BD falsa, e os dois têm de dar o mesmo passo a passo. Uma base para todos os grupos.
 */
export function descreverConformidade(grupos: { titulo: string; filtro: (c: Cenario) => boolean }[], extra?: () => void) {
  let db: PGlite
  beforeAll(async () => {
    db = await criarBase()
  }, 120_000)
  afterAll(async () => {
    await db.close()
  })
  for (const g of grupos) {
    describe(g.titulo, () => {
      for (const c of CENARIOS.filter(g.filtro)) {
        it(c.nome, async () => {
          await limparBase(db)
          const [{ t }] = await admin<{ t: Date }>(db, 'select now() as t')
          const T = t.getTime()
          const sql = await correr(c, { porta: new BDPGlite(db), montagem: new MontagemSql(db), estado: () => estadoSql(db) }, T)
          const falsa = new BDFalsa(new Relogio(T))
          const ref = await correr(c, { porta: falsa, montagem: new MontagemFalsa(falsa), estado: () => estadoFalso(falsa) }, T)

          // a referência comporta-se como o cenário diz (um passo que devia funcionar não pode falhar nas duas)
          c.passos.forEach((passo, i) => {
            const r = ref[i + 1]!.resultado as { erro?: unknown } | null
            const falhou = !!r && typeof r === 'object' && 'erro' in r
            expect(falhou, `${c.nome} › ${passo.nome}: ${JSON.stringify(r)}`).toBe(!!passo.erro)
          })
          expect(sql.map((x) => x.passo)).toEqual(ref.map((x) => x.passo))
          for (let i = 0; i < ref.length; i++) {
            expect(sql[i]!.resultado, `resultado de «${ref[i]!.passo}»`).toEqual(ref[i]!.resultado)
            expect(sql[i]!.estado, `estado depois de «${ref[i]!.passo}»`).toEqual(ref[i]!.estado)
          }
        }, 60_000)
      }
    })
  }
  extra?.()
}
