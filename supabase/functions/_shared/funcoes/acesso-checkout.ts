/**
 * acesso-checkout — compra do Acesso Família (B2C). JWT do utilizador obrigatório.
 *
 * POST { plano: 'acesso_30' | 'acesso_90', consentimento: { versao, aceite: true }, fatura?: { nif?, nome? }, voltar? }
 *   1. sessão válida e não anónima;
 *   2. plano conhecido; consentimento aceite na versão em vigor (CONSENTIMENTO_ACESSO);
 *   3. NIF opcional validado (B2C: 999999990 = consumidor final = sem NIF). O NIF nunca vai ao Stripe;
 *   4. servico_acesso_iniciar (a BD confirma que é família, regista o consentimento com o IP truncado e um
 *      pagamento `pendente`); o valor tem de bater com PLANOS_FAMILIA;
 *   5. conta de demonstração em modo produção → 403;
 *   6. Checkout Session mode=payment (cartão, MB WAY, Multibanco) → servico_acesso_sessao_criada → { url }.
 */
import { CONSENTIMENTO_ACESSO, planoFamilia } from '../faturacao/planos.ts'
import { validarNIF } from '../faturacao/nif.ts'
import { ipTruncadoDoPedido, lerCorpoJson } from '../http/pedido.ts'
import { MENSAGENS, respostaErro, respostaJson } from '../http/respostas.ts'
import type { PortaBD } from '../portas.ts'
import { parametrosCheckoutAcesso, voltarSeguro } from '../stripe/parametros.ts'
import type { PortaStripe } from '../stripe/porta.ts'
import { resumirErroStripe } from '../stripe/porta.ts'
import { handlerUtilizador, respostaDeErroBD, type DepsUtilizador, type Handler } from './comum.ts'

export interface DepsAcessoCheckout extends DepsUtilizador {
  bd: PortaBD
  stripe: PortaStripe
}

export function criarHandlerAcessoCheckout(d: DepsAcessoCheckout): Handler {
  return handlerUtilizador('acesso_checkout', d, async ({ req, cors }) => {
    const utilizador = await d.utilizadorDe(req).utilizador()
    if (!utilizador) return respostaErro(401, 'sessao', MENSAGENS.sessao, cors)
    if (utilizador.anonimo) return respostaErro(403, 'conta_anonima', 'Crie uma conta com email para comprar o Acesso Família.', cors)

    const corpo = await lerCorpoJson(req)
    if (!corpo) return respostaErro(400, 'corpo', MENSAGENS.corpo, cors)
    const plano = planoFamilia(corpo.plano)
    if (!plano) return respostaErro(400, 'plano_invalido', 'Escolha o passe de 30 ou de 90 dias.', cors)

    const c = corpo.consentimento as { versao?: unknown; aceite?: unknown } | undefined
    if (!c || c.aceite !== true) {
      return respostaErro(400, 'consentimento', 'Para continuar, confirme que o acesso começa logo e que perde o direito de livre resolução.', cors)
    }
    if (c.versao !== CONSENTIMENTO_ACESSO.versao) {
      return respostaErro(409, 'consentimento_desatualizado', 'O texto do consentimento mudou. Atualize a página e confirme de novo.', cors)
    }

    const fatura = (corpo.fatura ?? {}) as { nif?: unknown; nome?: unknown }
    let nif: string | null = null
    if (typeof fatura.nif === 'string' && fatura.nif.trim()) {
      const r = validarNIF(fatura.nif, 'b2c')
      if (!r.ok) return respostaErro(400, 'nif', r.erro, cors)
      nif = r.consumidorFinal ? null : r.nif
    }
    const nome = nif && typeof fatura.nome === 'string' && fatura.nome.trim() ? fatura.nome.trim().slice(0, 100) : null

    let iniciado
    try {
      iniciado = await d.bd.rpc('servico_acesso_iniciar', {
        p_user_id: utilizador.id,
        p_plano: plano.id,
        p_texto_versao: CONSENTIMENTO_ACESSO.versao,
        p_ip: ipTruncadoDoPedido(req),
        p_nif: nif,
        p_nome_fiscal: nome,
      })
    } catch (e) {
      return respostaDeErroBD(e, cors, d.registo, 'acesso_iniciar')
    }
    if (iniciado.valor_centimos !== plano.precoCentimos || iniciado.dias !== plano.dias || iniciado.plano !== plano.id) {
      d.registo.erro('acesso_valor_divergente', { plano: plano.id, bd: iniciado.valor_centimos })
      return respostaErro(500, 'configuracao', MENSAGENS.configuracao, cors)
    }
    if (iniciado.demonstracao && d.config.stripe.modo === 'producao') {
      return respostaErro(403, 'demonstracao', 'As contas de demonstração não fazem pagamentos reais.', cors)
    }

    const p = parametrosCheckoutAcesso({
      pagamentoId: iniciado.pagamento_id,
      plano: plano.id,
      userId: utilizador.id,
      email: utilizador.email,
      appUrl: d.config.app.url,
      agora: d.agora(),
      voltar: voltarSeguro(corpo.voltar),
    })
    let sessao
    try {
      sessao = await d.stripe.criarSessaoCheckout(p.params, p.opcoes)
    } catch (e) {
      d.registo.erro('acesso_checkout_stripe', { pagamento_id: iniciado.pagamento_id, stripe: resumirErroStripe(e) })
      return respostaErro(502, 'stripe', MENSAGENS.stripe, cors)
    }
    if (!sessao.url) return respostaErro(502, 'stripe', MENSAGENS.stripe, cors)

    try {
      await d.bd.rpc('servico_acesso_sessao_criada', { p_pagamento_id: iniciado.pagamento_id, p_session_id: sessao.id })
    } catch (e) {
      // o webhook encontra o pagamento por metadata.pagamento_id: a família pode seguir para o pagamento
      d.registo.erro('acesso_sessao_nao_registada', { pagamento_id: iniciado.pagamento_id, erro: String((e as Error)?.name) })
    }
    d.registo.info('acesso_checkout', { pagamento_id: iniciado.pagamento_id, plano: plano.id })
    return respostaJson(200, { url: sessao.url, pagamento_id: iniciado.pagamento_id }, cors)
  })
}
