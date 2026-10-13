/**
 * Tarefas agendadas (função faturar-mes), com as portas injetadas:
 *
 * - faturarDiario (todos os dias, 06:13 UTC):
 *     1. arrendamento da fase 'diario' (servico_iniciar_execucao) — duas execuções não se sobrepõem;
 *     2. modo fatura_por_entrada: servico_reservar_documentos (linhas + FT pendentes das entradas faturáveis);
 *     3. emitir os documentos da fila (FT, FR, RC) — procura primeiro pela chave (recuperação);
 *     4. debitar as cobranças com debito_em vencido (invoices.pay, uma tentativa por dia);
 *     5. reconciliar mensalidades: criar/cancelar subscrições que divergem da modalidade;
 *     6. servico_terminar_execucao com um resumo (só contagens).
 * - cobrarMes (dia 1, 07:07 UTC): uma cobrança Stripe por lar (v1, passos com chaves de idempotência).
 *
 * Nada aqui lança para fora: cada item falhado fica registado e na fila para a próxima execução.
 */
import { erroSeguro } from '../erros.ts'
import {
  parametrosCancelarSubscricao,
  parametrosPagarFatura,
  parametrosSubscricao,
  planoCobrancaMensal,
} from '../stripe/parametros.ts'
import { resumirErroStripe, type PortaStripe } from '../stripe/porta.ts'
import { normalizarMotivo } from '../stripe/motivos.ts'
import type { CobrancaPreparadaRpc, ContextoSubscricaoRpc, DocumentoPendenteRpc, EstadoSubscricao, ModoDocumento, MotivoFalha, PortaBD, Registo } from '../portas.ts'
import { compromissoAte, diaLisboa, inicioDoDiaLisboa } from './datas.ts'
import { eTaxaIva } from './dinheiro.ts'
import { pedidoDoDocumento } from './documentos.ts'
import type { DocumentoEmitido, EmissorFaturas } from './emissor.ts'

export interface ConfigOrquestrador {
  modo: ModoDocumento
  preAvisoDias: number
  diasPagamento: number
  paisTransferencia: string | null
  stripeModo: 'teste' | 'producao'
}

export interface DepsOrquestrador {
  bd: PortaBD
  stripe: PortaStripe
  emissor: EmissorFaturas
  registo: Registo
  config: ConfigOrquestrador
}

export const LIMITES = { documentos: 50, cobrancas: 50, debitos: 50, subscricoes: 20, arrendamentoSegundos: 900 } as const

const iso = (t: number) => new Date(t).toISOString()

// ————————————————————————————————————————————————————————————— documentos

export async function emitirDocumento(doc: DocumentoPendenteRpc, d: Pick<DepsOrquestrador, 'bd' | 'emissor' | 'registo'>): Promise<'emitido' | 'falhou'> {
  try {
    if (doc.demonstracao && d.emissor.tipo === 'moloni') throw new Error('Documento de demonstração: nunca vai ao Moloni.')
    let emitido: DocumentoEmitido | null = await d.emissor.procurarPorChave(doc.chave)
    if (!emitido) {
      const pedido = pedidoDoDocumento(doc)
      const { clienteId } = await d.emissor.garantirCliente(pedido.cliente)
      emitido =
        pedido.tipo === 'RC'
          ? await d.emissor.emitirRecibo({ clienteId, data: pedido.data, documentos: pedido.documentos, pagamento: pedido.pagamento, chave: pedido.chave })
          : await d.emissor.emitirFatura({ tipo: pedido.tipo, clienteId, data: pedido.data, vencimento: pedido.vencimento, linhas: pedido.linhas, chave: pedido.chave, pagamento: pedido.pagamento })
    }
    if (emitido.totalCentimos !== doc.total_centimos) throw new Error('O emissor devolveu um total diferente do esperado.')
    await d.bd.rpc('servico_documento_emitido', {
      p_id: doc.id,
      p_externo_id: emitido.id,
      p_numero: emitido.numero,
      p_total_centimos: emitido.totalCentimos,
      p_iva_centimos: emitido.ivaCentimos,
      p_emitido_em: emitido.emitidoEm,
      p_emissor: d.emissor.tipo,
    })
    d.registo.info('documento_emitido', { id: doc.id, tipo: doc.tipo, numero: emitido.numero })
    return 'emitido'
  } catch (e) {
    const erro = erroSeguro(e)
    d.registo.erro('documento_falhou', { id: doc.id, tipo: doc.tipo, erro })
    try {
      await d.bd.rpc('servico_documento_falhou', { p_id: doc.id, p_erro: erro })
    } catch {
      // fica pendente; a próxima execução volta a tentar
    }
    return 'falhou'
  }
}

export async function emitirPendentes(d: Pick<DepsOrquestrador, 'bd' | 'emissor' | 'registo'>, agora: number, limite: number = LIMITES.documentos) {
  const pendentes = await d.bd.rpc('servico_documentos_pendentes', { p_agora: iso(agora), p_limite: limite })
  let emitidos = 0
  let falhados = 0
  for (const doc of pendentes) ((await emitirDocumento(doc, d)) === 'emitido' ? emitidos++ : falhados++)
  return { emitidos, falhados }
}

// ————————————————————————————————————————————————————————————— cobranças por entrada (dia 1)

export async function criarCobranca(c: CobrancaPreparadaRpc, d: DepsOrquestrador, agora: number): Promise<'criada' | 'falhou'> {
  try {
    const plano = planoCobrancaMensal(c, { diasPagamento: d.config.diasPagamento, paisTransferencia: d.config.paisTransferencia })
    const fatura = await d.stripe.criarFatura(plano.fatura.params, plano.fatura.opcoes)
    for (const item of plano.itens) {
      const p = item(fatura.id)
      await d.stripe.criarItemFatura(p.params, p.opcoes)
    }
    const fin = await d.stripe.finalizarFatura(fatura.id, plano.finalizar.params, plano.finalizar.opcoes)
    if (plano.enviar) await d.stripe.enviarFatura(fatura.id, plano.enviar.opcoes)
    await d.bd.rpc('servico_cobranca_criada', {
      p_fatura_id: c.fatura_id,
      p_stripe_invoice_id: fatura.id,
      p_numero: fin.number,
      p_url: fin.hosted_invoice_url ?? null,
      p_cobranca: plano.cobranca,
      // SEPA: pré-aviso — debitar a partir das 00:00 de Lisboa do dia agora + N
      p_debito_em: plano.cobranca === 'debito_automatico' ? inicioDoDiaLisboa(agora, d.config.preAvisoDias) : null,
    })
    d.registo.info('cobranca_criada', { fatura_id: c.fatura_id, linhas: c.linhas.length, total: c.total_centimos })
    return 'criada'
  } catch (e) {
    d.registo.erro('cobranca_falhou', { fatura_id: c.fatura_id, erro: erroSeguro(e), stripe: resumirErroStripe(e) })
    return 'falhou'
  }
}

export async function cobrarMes(d: DepsOrquestrador, agora: number) {
  if (!(await d.bd.rpc('servico_iniciar_execucao', { p_fase: 'cobranca', p_duracao_segundos: LIMITES.arrendamentoSegundos }))) {
    return { ignorado: true as const }
  }
  const resumo = { criadas: 0, falhadas: 0 }
  try {
    const lista = await d.bd.rpc('servico_preparar_cobrancas', { p_modo: d.config.modo, p_agora: iso(agora), p_limite: LIMITES.cobrancas })
    for (const c of lista) ((await criarCobranca(c, d, agora)) === 'criada' ? resumo.criadas++ : resumo.falhadas++)
    return { ignorado: false as const, ...resumo }
  } finally {
    await d.bd.rpc('servico_terminar_execucao', { p_fase: 'cobranca', p_resumo: resumo })
  }
}

// ————————————————————————————————————————————————————————————— débitos (pré-aviso SEPA cumprido)

export async function debitarCobrancas(d: DepsOrquestrador, agora: number) {
  const lista = await d.bd.rpc('servico_cobrancas_a_debitar', { p_agora: iso(agora), p_limite: LIMITES.debitos })
  const resumo = { paga: 0, em_processamento: 0, falhou: 0, erro: 0 }
  for (const c of lista) {
    const p = parametrosPagarFatura(c.fatura_id, diaLisboa(agora))
    let estado: 'paga' | 'em_processamento' | 'falhou'
    let motivo: MotivoFalha | null = null
    try {
      const r = await d.stripe.pagarFatura(c.stripe_invoice_id, p.params, p.opcoes)
      estado = r.status === 'paid' ? 'paga' : 'em_processamento'
    } catch (e) {
      const s = resumirErroStripe(e)
      if (s.tipo !== 'StripeCardError' && s.codigo !== 'invoice_payment_intent_requires_action') {
        // rede, limite de pedidos…: tenta-se amanhã
        d.registo.erro('debito_erro', { fatura_id: c.fatura_id, stripe: s })
        resumo.erro++
        continue
      }
      estado = 'falhou'
      motivo = normalizarMotivo({ codigo: s.codigo, declineCode: s.declineCode })
    }
    await d.bd.rpc('servico_cobranca_debito_iniciado', { p_fatura_id: c.fatura_id, p_estado: estado, p_motivo: motivo, p_em: iso(agora) })
    resumo[estado]++
  }
  return resumo
}

// ————————————————————————————————————————————————————————————— mensalidade (subscrições)

export type ResultadoSubscricao =
  | { estado: 'criada' | 'cancelada'; stripeSubscriptionId: string; estadoSubscricao: EstadoSubscricao }
  | { estado: 'nada' }
  | { estado: 'recusada'; motivo: 'sem_metodo' | 'demonstracao' | 'nao_mensal' | 'iva' }

const estadoInicial = (status: string): EstadoSubscricao =>
  status === 'active' || status === 'trialing' ? 'ativa' : status === 'canceled' || status === 'incomplete_expired' ? 'cancelada' : status === 'past_due' || status === 'unpaid' ? 'em_atraso' : 'incompleta'

/** Cria a subscrição de um lar em 'mensal' (idempotente: chave por plano_desde; não cria se já houver uma ativa). */
export async function garantirSubscricao(ctx: ContextoSubscricaoRpc, d: Pick<DepsOrquestrador, 'bd' | 'stripe' | 'registo' | 'config'>): Promise<ResultadoSubscricao> {
  if (ctx.plano !== 'mensal' || !ctx.plano_desde) return { estado: 'recusada', motivo: 'nao_mensal' }
  if (ctx.demonstracao && d.config.stripeModo === 'producao') return { estado: 'recusada', motivo: 'demonstracao' }
  if (ctx.subscricao && ctx.subscricao.estado !== 'cancelada') return { estado: 'nada' }
  if (!ctx.stripe_customer_id || !ctx.stripe_payment_method_id || !ctx.tem_metodo) return { estado: 'recusada', motivo: 'sem_metodo' }
  if (!eTaxaIva(ctx.iva_percent)) return { estado: 'recusada', motivo: 'iva' }
  const p = parametrosSubscricao({
    instituicaoId: ctx.instituicao_id,
    customerId: ctx.stripe_customer_id,
    paymentMethodId: ctx.stripe_payment_method_id,
    ivaPercent: ctx.iva_percent,
    planoDesde: ctx.plano_desde,
    compromissoAte: ctx.compromisso_ate ?? compromissoAte(ctx.plano_desde),
  })
  const sub = await d.stripe.criarSubscricao(p.params, p.opcoes)
  const estado = estadoInicial(sub.status)
  await d.bd.rpc('servico_subscricao_registar', {
    p_instituicao_id: ctx.instituicao_id,
    p_stripe_subscription_id: sub.id,
    p_estado: estado,
    p_inicio: new Date(sub.start_date * 1000).toISOString(),
  })
  d.registo.info('subscricao_criada', { instituicao_id: ctx.instituicao_id, estado })
  return { estado: 'criada', stripeSubscriptionId: sub.id, estadoSubscricao: estado }
}

/** Cancela a subscrição de um lar que voltou à taxa por entrada (depois do compromisso). */
export async function terminarSubscricao(instituicaoId: string, subscriptionId: string, d: Pick<DepsOrquestrador, 'bd' | 'stripe' | 'registo'>): Promise<ResultadoSubscricao> {
  const p = parametrosCancelarSubscricao(subscriptionId)
  const sub = await d.stripe.cancelarSubscricao(subscriptionId, p.params, p.opcoes)
  await d.bd.rpc('servico_subscricao_registar', { p_instituicao_id: instituicaoId, p_stripe_subscription_id: sub.id, p_estado: 'cancelada', p_inicio: null })
  d.registo.info('subscricao_cancelada', { instituicao_id: instituicaoId })
  return { estado: 'cancelada', stripeSubscriptionId: sub.id, estadoSubscricao: 'cancelada' }
}

export async function sincronizarSubscricoes(d: DepsOrquestrador) {
  const lista = await d.bd.rpc('servico_subscricoes_a_sincronizar', { p_limite: LIMITES.subscricoes })
  const resumo = { criadas: 0, canceladas: 0, ignoradas: 0, falhadas: 0 }
  for (const s of lista) {
    try {
      if (s.acao === 'cancelar' && s.stripe_subscription_id) {
        await terminarSubscricao(s.instituicao_id, s.stripe_subscription_id, d)
        resumo.canceladas++
        continue
      }
      const ctx = await d.bd.rpc('servico_subscricao_contexto', { p_instituicao_id: s.instituicao_id })
      const r = ctx ? await garantirSubscricao(ctx, d) : { estado: 'nada' as const }
      if (r.estado === 'criada') resumo.criadas++
      else resumo.ignoradas++
    } catch (e) {
      d.registo.erro('subscricao_falhou', { instituicao_id: s.instituicao_id, erro: erroSeguro(e), stripe: resumirErroStripe(e) })
      resumo.falhadas++
    }
  }
  return resumo
}

// ————————————————————————————————————————————————————————————— tarefa diária

export async function faturarDiario(d: DepsOrquestrador, agora: number) {
  if (!(await d.bd.rpc('servico_iniciar_execucao', { p_fase: 'diario', p_duracao_segundos: LIMITES.arrendamentoSegundos }))) {
    return { ignorado: true as const }
  }
  const resumo: Record<string, unknown> = {}
  try {
    if (d.config.modo === 'fatura_por_entrada') {
      resumo.reservados = (await d.bd.rpc('servico_reservar_documentos', { p_modo: d.config.modo, p_agora: iso(agora), p_limite: LIMITES.documentos })).reservados
    }
    resumo.documentos = await emitirPendentes(d, agora)
    resumo.debitos = await debitarCobrancas(d, agora)
    resumo.subscricoes = await sincronizarSubscricoes(d)
    return { ignorado: false as const, ...resumo }
  } finally {
    await d.bd.rpc('servico_terminar_execucao', { p_fase: 'diario', p_resumo: resumo })
  }
}
