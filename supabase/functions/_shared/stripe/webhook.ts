/**
 * Webhook do Stripe: verificação da assinatura com o pacote oficial (webhooks.constructEventAsync com o
 * fornecedor SubtleCrypto, que existe em Deno e em Node) e o fluxo idempotente do v1:
 *
 *   1. corpo em texto cru (nunca JSON.parse antes de verificar);
 *   2. assinatura inválida/ausente → 400;
 *   3. livemode diferente de STRIPE_MODO → 400 (endpoint ou segredo trocados entre teste e produção);
 *   4. servico_evento_iniciar: 'repetido' → 200 sem fazer nada;
 *   5. leitura (se for preciso) → interpretação pura → efeitos idempotentes no Stripe;
 *   6. servico_evento_aplicar (uma transação);
 *   7. qualquer erro antes do fim → servico_evento_falhou + 500 (o Stripe volta a tentar).
 * Depois do 200, a função tenta emitir já os documentos que ficaram na fila (FR/RC/FT); se falhar, ficam
 * para a tarefa diária.
 */
import type Stripe from 'stripe'
import { deSegundos } from '../faturacao/datas.ts'
import { erroSeguro } from '../erros.ts'
import type { PortaBD, Registo } from '../portas.ts'
import { executarLeitura, interpretarEvento, leituraDoEvento, type Efeito } from './eventos.ts'
import { parametrosMetodoPredefinido, parametrosMetodoSubscricao } from './parametros.ts'
import type { PortaStripe } from './porta.ts'

/** Tolerância da assinatura (s): a do Stripe por omissão. */
export const TOLERANCIA_ASSINATURA_S = 300

export interface VerificadorWebhook {
  webhooks: Pick<Stripe.Webhooks, 'constructEventAsync'>
  cripto: Stripe.CryptoProvider
}

export type ResultadoVerificacao = { ok: true; evento: Stripe.Event } | { ok: false; motivo: 'sem_assinatura' | 'assinatura_invalida' }

/**
 * `recebidoEmMs` é o relógio da função em MILISSEGUNDOS: o SDK (stripe@23) divide-o por 1000 para calcular a
 * idade da assinatura. Passar segundos desligaria, sem erro, a proteção contra repetições (o teste
 * "carimbo fora da tolerância" apanha isso).
 */
export async function verificarEvento(
  corpo: string,
  assinatura: string | null,
  segredo: string,
  v: VerificadorWebhook,
  recebidoEmMs?: number,
): Promise<ResultadoVerificacao> {
  if (!assinatura) return { ok: false, motivo: 'sem_assinatura' }
  try {
    const evento = await v.webhooks.constructEventAsync(corpo, assinatura, segredo, TOLERANCIA_ASSINATURA_S, v.cripto, recebidoEmMs)
    return { ok: true, evento }
  } catch {
    return { ok: false, motivo: 'assinatura_invalida' }
  }
}

export type ModoStripe = 'teste' | 'producao'

export const modoCompativel = (evento: Pick<Stripe.Event, 'livemode'>, modo: ModoStripe): boolean => evento.livemode === (modo === 'producao')

export type ResultadoProcessamento =
  | { estado: 'aplicado'; operacoes: number }
  | { estado: 'repetido' }
  | { estado: 'ja_aplicado' }
  | { estado: 'falhou'; erro: string }

export interface DepsProcessamento {
  bd: PortaBD
  stripe: PortaStripe
  registo: Registo
}

async function aplicarEfeito(ef: Efeito, d: DepsProcessamento): Promise<void> {
  if (ef.atualizarCliente) {
    const p = parametrosMetodoPredefinido(ef.customerId, ef.paymentMethodId)
    await d.stripe.atualizarCliente(ef.customerId, p.params, p.opcoes)
  }
  if (!ef.instituicaoId) return
  const ctx = await d.bd.rpc('servico_subscricao_contexto', { p_instituicao_id: ef.instituicaoId })
  const sub = ctx?.subscricao
  if (sub && sub.estado !== 'cancelada' && ctx.stripe_customer_id === ef.customerId) {
    const p = parametrosMetodoSubscricao(sub.stripe_subscription_id, ef.paymentMethodId)
    await d.stripe.atualizarSubscricao(sub.stripe_subscription_id, p.params, p.opcoes)
  }
}

/** Passos 4–7 (o evento já está verificado). */
export async function processarEvento(evento: Stripe.Event, d: DepsProcessamento): Promise<ResultadoProcessamento> {
  const inicio = await d.bd.rpc('servico_evento_iniciar', {
    p_id: evento.id,
    p_tipo: evento.type,
    p_livemode: evento.livemode,
    p_criado_em: deSegundos(evento.created)!,
  })
  if (inicio === 'repetido') return { estado: 'repetido' }
  try {
    const leitura = leituraDoEvento(evento)
    const lido = leitura ? await executarLeitura(leitura, d.stripe) : {}
    const { operacoes, efeitos } = interpretarEvento(evento, lido)
    for (const ef of efeitos) await aplicarEfeito(ef, d)
    const aplicou = await d.bd.rpc('servico_evento_aplicar', { p_id: evento.id, p_operacoes: operacoes })
    d.registo.info('stripe_evento', { id: evento.id, tipo: evento.type, operacoes: operacoes.map((o) => o.op), aplicou })
    return aplicou ? { estado: 'aplicado', operacoes: operacoes.length } : { estado: 'ja_aplicado' }
  } catch (e) {
    const erro = erroSeguro(e)
    d.registo.erro('stripe_evento_falhou', { id: evento.id, tipo: evento.type, erro })
    try {
      await d.bd.rpc('servico_evento_falhou', { p_id: evento.id, p_erro: erro })
    } catch {
      // o Stripe volta a tentar de qualquer forma
    }
    return { estado: 'falhou', erro }
  }
}
