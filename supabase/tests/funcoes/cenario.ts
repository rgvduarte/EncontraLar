/**
 * Cenário completo para os testes das funções: BD falsa, Stripe falso, emissor falso, relógio e os
 * handlers puros ligados como nas funções Deno. Os eventos do webhook são assinados com o pacote `stripe`
 * verdadeiro (generateTestHeaderString) e verificados com constructEventAsync + SubtleCrypto.
 */
import Stripe from 'stripe'
import type { Config } from '../../functions/_shared/config.ts'
import { EmissorFalso, type EmissorFaturas } from '../../functions/_shared/faturacao/emissor.ts'
import { criarHandlerAcessoCheckout } from '../../functions/_shared/funcoes/acesso-checkout.ts'
import { criarHandlerFaturacaoCheckout, criarHandlerFaturacaoDocumento, criarHandlerFaturacaoPortal } from '../../functions/_shared/funcoes/faturacao.ts'
import { CABECALHO_CRON, criarHandlerFaturarMes } from '../../functions/_shared/funcoes/faturar-mes.ts'
import { criarHandlerPlanoInstituicao } from '../../functions/_shared/funcoes/plano-instituicao.ts'
import { criarHandlerStripeWebhook } from '../../functions/_shared/funcoes/stripe-webhook.ts'
import type { UtilizadorSessao } from '../../functions/_shared/portas.ts'
import type { VerificadorWebhook } from '../../functions/_shared/stripe/webhook.ts'
import { AMBIENTE_TESTE, BDFalsa, configTeste, RegistoMemoria, Relogio, StripeFalso, UtilizadorFalso } from './fakes.ts'

export const sdk = new Stripe('sk_test_apenas_para_assinar', { apiVersion: '2026-09-30.endive' })
export const verificador: VerificadorWebhook = { webhooks: sdk.webhooks, cripto: Stripe.createSubtleCryptoProvider() }
export const SEGREDO_WEBHOOK = AMBIENTE_TESTE.STRIPE_WEBHOOK_SECRET!
export const ORIGEM = 'https://encontralar.example'

export interface Sessao {
  sessao: UtilizadorSessao | null
  instituicaoId?: string
}

export function criarCenario(opcoes: { config?: Config; emissor?: (relogio: Relogio) => EmissorFaturas } = {}) {
  const relogio = new Relogio()
  const bd = new BDFalsa(relogio)
  const stripe = new StripeFalso()
  const emissorFalso = new EmissorFalso({ agora: relogio.fn })
  const emissor: EmissorFaturas = opcoes.emissor?.(relogio) ?? emissorFalso
  const registo = new RegistoMemoria()
  const config = opcoes.config ?? configTeste()
  const agendados: Promise<unknown>[] = []
  const agendar = (p: Promise<unknown>) => void agendados.push(p)
  let sessaoAtual: Sessao = { sessao: null }
  const utilizadorDe = () => new UtilizadorFalso(bd, sessaoAtual.sessao, { instituicaoId: sessaoAtual.instituicaoId })
  const comuns = { config, registo, agora: relogio.fn }

  const handlers = {
    acessoCheckout: criarHandlerAcessoCheckout({ ...comuns, bd, stripe, utilizadorDe }),
    faturacaoCheckout: criarHandlerFaturacaoCheckout({ ...comuns, bd, stripe, utilizadorDe }),
    faturacaoPortal: criarHandlerFaturacaoPortal({ ...comuns, bd, stripe, utilizadorDe }),
    faturacaoDocumento: criarHandlerFaturacaoDocumento({ ...comuns, bd, emissor, utilizadorDe }),
    planoInstituicao: criarHandlerPlanoInstituicao({ ...comuns, bd, stripe, utilizadorDe }),
    webhook: criarHandlerStripeWebhook({ ...comuns, bd, stripe, emissor, verificador, agendar }),
    faturarMes: criarHandlerFaturarMes({ ...comuns, bd, stripe, emissor, agendar }),
  }

  /** Espera pelo trabalho agendado (EdgeRuntime.waitUntil). */
  async function esperar() {
    while (agendados.length) await agendados.shift()
  }

  /** POST de um utilizador com sessão (Authorization) a partir da app. */
  function pedidoApp(corpo: unknown, cabecalhos: Record<string, string> = {}) {
    return new Request('https://abcdefghijklmnop.supabase.co/functions/v1/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGEM, authorization: 'Bearer jwt-de-teste', 'x-forwarded-for': '203.0.113.57, 10.0.0.1', ...cabecalhos },
      body: JSON.stringify(corpo),
    })
  }

  function comSessao(s: Sessao) {
    sessaoAtual = s
  }

  /** Assina e entrega um evento ao webhook (como o Stripe), e espera pelo trabalho depois da resposta. */
  async function entregar(e: Stripe.Event, opcoes: { segredo?: string; corpo?: string; assinadoEm?: number } = {}) {
    const corpo = opcoes.corpo ?? JSON.stringify(e)
    const assinatura = sdk.webhooks.generateTestHeaderString({
      payload: JSON.stringify(e),
      secret: opcoes.segredo ?? SEGREDO_WEBHOOK,
      timestamp: Math.floor((opcoes.assinadoEm ?? relogio.agora) / 1000),
    })
    const r = await handlers.webhook(
      new Request('https://abcdefghijklmnop.supabase.co/functions/v1/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': assinatura, 'content-type': 'application/json' }, body: corpo }),
    )
    await esperar()
    return r
  }

  /** O pg_cron a chamar faturar-mes. */
  async function cron(fase: 'diario' | 'cobranca', segredo = AMBIENTE_TESTE.FATURACAO_CRON_SECRET!) {
    const r = await handlers.faturarMes(
      new Request('https://abcdefghijklmnop.supabase.co/functions/v1/faturar-mes', { method: 'POST', headers: { 'content-type': 'application/json', [CABECALHO_CRON]: segredo }, body: JSON.stringify({ fase }) }),
    )
    await esperar()
    return r
  }

  return { relogio, bd, stripe, emissor: emissorFalso, emissorAtivo: emissor, registo, config, handlers, esperar, pedidoApp, comSessao, entregar, cron, agendados }
}

export type Cenario = ReturnType<typeof criarCenario>

export const json = async (r: Response) => (await r.json()) as Record<string, unknown> & { erro?: { codigo: string; mensagem: string } }
