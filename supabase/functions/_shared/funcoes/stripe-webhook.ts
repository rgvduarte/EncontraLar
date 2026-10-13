/**
 * stripe-webhook — deploy com --no-verify-jwt (o Stripe não tem JWT do Supabase); a autenticação é a
 * assinatura Stripe-Signature com STRIPE_WEBHOOK_SECRET. Fluxo em stripe/webhook.ts.
 */
import { emitirPendentes } from '../faturacao/orquestrador.ts'
import type { EmissorFaturas } from '../faturacao/emissor.ts'
import { MENSAGENS, respostaErro, respostaJson } from '../http/respostas.ts'
import type { PortaBD } from '../portas.ts'
import type { PortaStripe } from '../stripe/porta.ts'
import { modoCompativel, processarEvento, verificarEvento, type VerificadorWebhook } from '../stripe/webhook.ts'
import { erroSeguro } from '../erros.ts'
import type { DepsComuns, Handler } from './comum.ts'

export interface DepsWebhook extends DepsComuns {
  bd: PortaBD
  stripe: PortaStripe
  emissor: EmissorFaturas
  verificador: VerificadorWebhook
  /** EdgeRuntime.waitUntil: trabalho depois da resposta */
  agendar: (p: Promise<unknown>) => void
}

/** Documentos a emitir logo a seguir a um evento (o resto fica para a tarefa diária). */
export const DOCUMENTOS_APOS_EVENTO = 10

export function criarHandlerStripeWebhook(d: DepsWebhook): Handler {
  return async (req) => {
    if (req.method !== 'POST') return respostaErro(405, 'metodo', MENSAGENS.metodo, { Allow: 'POST' })
    const segredo = d.config.stripe.segredoWebhook
    if (!segredo) return respostaErro(500, 'configuracao', MENSAGENS.configuracao)
    const corpo = await req.text()
    const v = await verificarEvento(corpo, req.headers.get('stripe-signature'), segredo, d.verificador, d.agora())
    if (!v.ok) {
      d.registo.erro('webhook_assinatura', { motivo: v.motivo })
      return respostaErro(400, v.motivo, 'Assinatura inválida.')
    }
    const evento = v.evento
    if (!modoCompativel(evento, d.config.stripe.modo)) {
      d.registo.erro('webhook_modo', { id: evento.id, livemode: evento.livemode, modo: d.config.stripe.modo })
      return respostaErro(400, 'modo', 'Evento de outro modo (teste/produção).')
    }
    let r
    try {
      r = await processarEvento(evento, { bd: d.bd, stripe: d.stripe, registo: d.registo })
    } catch (e) {
      // servico_evento_iniciar falhou (BD indisponível): o Stripe volta a tentar
      d.registo.erro('webhook_bd', { id: evento.id, erro: erroSeguro(e) })
      return respostaErro(500, 'interno', MENSAGENS.interno)
    }
    if (r.estado === 'falhou') return respostaErro(500, 'interno', MENSAGENS.interno)
    if (r.estado === 'aplicado' && r.operacoes > 0) {
      d.agendar(
        emitirPendentes({ bd: d.bd, emissor: d.emissor, registo: d.registo }, d.agora(), DOCUMENTOS_APOS_EVENTO).catch((e) =>
          d.registo.erro('webhook_documentos', { erro: erroSeguro(e) }),
        ),
      )
    }
    return respostaJson(200, { recebido: true, estado: r.estado })
  }
}
