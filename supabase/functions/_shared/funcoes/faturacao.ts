/**
 * Funções v1 dos lares (JWT do utilizador; a posse prova-se SEMPRE pela RPC do próprio utilizador — o
 * instituicao_id nunca vem do corpo do pedido):
 *
 * - faturacao-checkout: garante o cliente Stripe do lar e abre o Checkout em modo `setup` (mandato SEPA ou
 *   cartão) → { url };
 * - faturacao-portal: abre o Customer Portal do Stripe (trocar método, ver cobranças) → { url };
 * - faturacao-documento: link do PDF de um documento fiscal que o utilizador pode ler (lar: FT/RC; família:
 *   FR) → { url, numero, tipo }.
 */
import type { EmissorFaturas } from '../faturacao/emissor.ts'
import { lerCorpoJson } from '../http/pedido.ts'
import { MENSAGENS, respostaErro, respostaJson } from '../http/respostas.ts'
import type { ContextoInstituicaoRpc, PortaBD, Registo } from '../portas.ts'
import { parametrosAtualizarCliente, parametrosCheckoutMandato, parametrosCliente, parametrosPortal, parametrosTaxId } from '../stripe/parametros.ts'
import { resumirErroStripe, type PortaStripe } from '../stripe/porta.ts'
import { handlerUtilizador, tentarBD, type DepsUtilizador, type Handler, type Pedido } from './comum.ts'

export interface DepsFaturacaoLar extends DepsUtilizador {
  bd: PortaBD
  stripe: PortaStripe
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Posse + contexto: faturacao_resumo() do utilizador dá o instituicao_id; o serviço dá o resto. */
async function contextoDoDono(p: Pedido, d: DepsFaturacaoLar, contexto: string): Promise<{ ok: true; ctx: ContextoInstituicaoRpc } | { ok: false; resposta: Response }> {
  const u = d.utilizadorDe(p.req)
  const sessao = await u.utilizador()
  if (!sessao) return { ok: false, resposta: respostaErro(401, 'sessao', MENSAGENS.sessao, p.cors) }
  const resumo = await tentarBD(() => u.rpc('faturacao_resumo', {}), p.cors, d.registo, contexto)
  if (!resumo.ok) return resumo
  if (resumo.valor.isenta) return { ok: false, resposta: respostaErro(409, 'isenta', 'As IPSS e Misericórdias não têm custos.', p.cors) }
  const ctx = await tentarBD(() => d.bd.rpc('servico_contexto_instituicao', { p_instituicao_id: resumo.valor.instituicao_id }), p.cors, d.registo, contexto)
  if (!ctx.ok) return ctx
  if (!ctx.valor) return { ok: false, resposta: respostaErro(404, 'nao_encontrado', MENSAGENS.naoEncontrado, p.cors) }
  if (ctx.valor.demonstracao && d.config.stripe.modo === 'producao') {
    return { ok: false, resposta: respostaErro(403, 'demonstracao', 'As instituições de demonstração não têm pagamentos reais.', p.cors) }
  }
  return { ok: true, ctx: ctx.valor }
}

/** Cria ou atualiza o cliente Stripe do lar; troca o tax id se o NIF mudou. Devolve o customer id. */
export async function garantirClienteStripe(ctx: ContextoInstituicaoRpc, stripe: PortaStripe, bd: PortaBD, registo: Registo): Promise<string> {
  const dados = ctx.dados!
  if (ctx.stripe_customer_id) {
    const id = ctx.stripe_customer_id
    const a = parametrosAtualizarCliente(ctx.instituicao_id, dados)
    await stripe.atualizarCliente(id, a.params, a.opcoes)
    const valor = `PT${dados.nif}`
    const atuais = await stripe.listarTaxIds(id)
    if (!atuais.some((t) => t.type === 'eu_vat' && t.value === valor)) {
      for (const t of atuais.filter((t) => t.type === 'eu_vat')) await stripe.apagarTaxId(id, t.id)
      const t = parametrosTaxId(ctx.instituicao_id, dados.nif)
      await stripe.criarTaxId(id, t.params, t.opcoes)
    }
    return id
  }
  const c = parametrosCliente(ctx.instituicao_id, dados)
  const criado = await stripe.criarCliente(c.params, c.opcoes)
  const guardado = await bd.rpc('servico_definir_cliente_stripe', { p_instituicao_id: ctx.instituicao_id, p_customer_id: criado.id })
  if (guardado !== criado.id) {
    // corrida entre dois pedidos: fica o primeiro, apaga-se o duplicado
    registo.info('cliente_stripe_duplicado', { instituicao_id: ctx.instituicao_id })
    await stripe.apagarCliente(criado.id)
  }
  return guardado
}

export function criarHandlerFaturacaoCheckout(d: DepsFaturacaoLar): Handler {
  return handlerUtilizador('faturacao_checkout', d, async (p) => {
    const r = await contextoDoDono(p, d, 'faturacao_checkout')
    if (!r.ok) return r.resposta
    if (!r.ctx.dados) return respostaErro(409, 'dados_em_falta', 'Preencha primeiro os dados de faturação (razão social, NIF e morada).', p.cors)
    try {
      const customer = await garantirClienteStripe(r.ctx, d.stripe, d.bd, d.registo)
      const s = parametrosCheckoutMandato({ instituicaoId: r.ctx.instituicao_id, customerId: customer, appUrl: d.config.app.url, agora: d.agora() })
      const sessao = await d.stripe.criarSessaoCheckout(s.params, s.opcoes)
      if (!sessao.url) return respostaErro(502, 'stripe', MENSAGENS.stripe, p.cors)
      return respostaJson(200, { url: sessao.url }, p.cors)
    } catch (e) {
      d.registo.erro('faturacao_checkout_stripe', { instituicao_id: r.ctx.instituicao_id, stripe: resumirErroStripe(e) })
      return respostaErro(502, 'stripe', MENSAGENS.stripe, p.cors)
    }
  })
}

export function criarHandlerFaturacaoPortal(d: DepsFaturacaoLar): Handler {
  return handlerUtilizador('faturacao_portal', d, async (p) => {
    const r = await contextoDoDono(p, d, 'faturacao_portal')
    if (!r.ok) return r.resposta
    if (!r.ctx.stripe_customer_id) return respostaErro(409, 'sem_cliente', 'Ainda não há um método de pagamento configurado.', p.cors)
    try {
      const s = parametrosPortal(r.ctx.stripe_customer_id, d.config.app.url, d.agora())
      const sessao = await d.stripe.criarSessaoPortal(s.params, s.opcoes)
      return respostaJson(200, { url: sessao.url }, p.cors)
    } catch (e) {
      d.registo.erro('faturacao_portal_stripe', { instituicao_id: r.ctx.instituicao_id, stripe: resumirErroStripe(e) })
      return respostaErro(502, 'stripe', MENSAGENS.stripe, p.cors)
    }
  })
}

export interface DepsDocumento extends DepsUtilizador {
  bd: PortaBD
  emissor: EmissorFaturas
}

export function criarHandlerFaturacaoDocumento(d: DepsDocumento): Handler {
  return handlerUtilizador('faturacao_documento', d, async ({ req, cors }) => {
    const u = d.utilizadorDe(req)
    if (!(await u.utilizador())) return respostaErro(401, 'sessao', MENSAGENS.sessao, cors)
    const corpo = await lerCorpoJson(req)
    const id = corpo?.documento_id
    if (typeof id !== 'string' || !UUID.test(id)) return respostaErro(400, 'corpo', MENSAGENS.corpo, cors)
    // o RLS de documentos_fiscais prova a posse (lar: os seus; família: os seus FR)
    if (!(await u.documentoVisivel(id))) return respostaErro(404, 'nao_encontrado', 'Documento não encontrado.', cors)
    const doc = await tentarBD(() => d.bd.rpc('servico_documento_externo', { p_id: id }), cors, d.registo, 'faturacao_documento')
    if (!doc.ok) return doc.resposta
    if (!doc.valor) return respostaErro(404, 'nao_encontrado', 'Documento não encontrado.', cors)
    if (doc.valor.emissor !== d.emissor.tipo) return respostaErro(409, 'emissor', 'Este documento foi emitido noutro ambiente e não tem PDF aqui.', cors)
    try {
      const url = await d.emissor.linkPdf(doc.valor.externo_id)
      return respostaJson(200, { url, numero: doc.valor.numero, tipo: doc.valor.tipo }, cors)
    } catch {
      d.registo.erro('faturacao_documento_pdf', { id })
      return respostaErro(502, 'emissor', 'Não foi possível obter o PDF. Tente de novo dentro de momentos.', cors)
    }
  })
}
