/**
 * plano-instituicao — o lar privado muda de modalidade (por entrada ↔ mensalidade). JWT do utilizador.
 *
 * POST { plano: 'mensal' | 'por_entrada' }
 *   1. posse: painel_instituicao() do próprio utilizador (o id nunca vem do corpo);
 *   2. contexto (servico_subscricao_contexto) e decisão pura (regras.ts, decidirMudancaPlano):
 *        - para a mensalidade: exige cliente Stripe e método (mandato SEPA ou cartão) — senão 409;
 *        - de volta à taxa por entrada: só no fim do compromisso de 12 meses — 409 com a MESMA mensagem
 *          que escolher_plano_instituicao() dá na base de dados;
 *   3. escolher_plano_instituicao(p_plano) com o JWT do utilizador (a BD é a autoridade e volta a validar);
 *   4. Stripe: cria a subscrição (29 € + IVA explícito, débito do mandato) ou cancela-a; regista-a com
 *      servico_subscricao_registar. Se o Stripe falhar, a modalidade já mudou e a tarefa diária reconcilia
 *      (servico_subscricoes_a_sincronizar) — a resposta diz `sincronizacao: 'pendente'`.
 */
import { decidirMudancaPlano } from '../faturacao/regras.ts'
import { garantirSubscricao, terminarSubscricao, type ResultadoSubscricao } from '../faturacao/orquestrador.ts'
import { lerCorpoJson } from '../http/pedido.ts'
import { MENSAGENS, respostaErro, respostaJson } from '../http/respostas.ts'
import type { PlanoInstituicao, PortaBD } from '../portas.ts'
import { erroSeguro } from '../erros.ts'
import { resumirErroStripe, type PortaStripe } from '../stripe/porta.ts'
import { handlerUtilizador, respostaDeErroBD, tentarBD, type DepsUtilizador, type Handler } from './comum.ts'

export interface DepsPlanoInstituicao extends DepsUtilizador {
  bd: PortaBD
  stripe: PortaStripe
}

const ePlano = (v: unknown): v is PlanoInstituicao => v === 'mensal' || v === 'por_entrada'

export function criarHandlerPlanoInstituicao(d: DepsPlanoInstituicao): Handler {
  return handlerUtilizador('plano_instituicao', d, async ({ req, cors }) => {
    const u = d.utilizadorDe(req)
    if (!(await u.utilizador())) return respostaErro(401, 'sessao', MENSAGENS.sessao, cors)
    const corpo = await lerCorpoJson(req)
    const alvo = corpo?.plano
    if (!ePlano(alvo)) return respostaErro(400, 'plano_invalido', 'Indique a modalidade: por entrada ou mensalidade.', cors)

    const painel = await tentarBD(() => u.rpc('painel_instituicao', {}), cors, d.registo, 'plano_instituicao')
    if (!painel.ok) return painel.resposta
    const inst = painel.valor[0]
    if (!inst) return respostaErro(403, 'sem_permissao', 'Só a instituição pode escolher a modalidade.', cors)

    const lido = await tentarBD(() => d.bd.rpc('servico_subscricao_contexto', { p_instituicao_id: inst.id }), cors, d.registo, 'plano_instituicao')
    if (!lido.ok) return lido.resposta
    let ctx = lido.valor
    if (!ctx) return respostaErro(404, 'nao_encontrado', MENSAGENS.naoEncontrado, cors)

    const agora = d.agora()
    const decisao = decidirMudancaPlano(
      {
        natureza: ctx.natureza,
        plano: ctx.plano,
        planoDesde: ctx.plano_desde,
        demonstracao: ctx.demonstracao,
        temMetodo: ctx.tem_metodo && !!ctx.stripe_payment_method_id,
        temClienteStripe: !!ctx.stripe_customer_id,
        subscricaoAtiva: ctx.subscricao && ctx.subscricao.estado !== 'cancelada' ? { stripeSubscriptionId: ctx.subscricao.stripe_subscription_id } : null,
      },
      alvo,
      agora,
      d.config.stripe.modo === 'producao',
    )
    if (decisao.tipo === 'recusar') return respostaErro(decisao.estado, decisao.codigo, decisao.mensagem, cors)

    if (decisao.tipo === 'mudar') {
      let escolhido
      try {
        escolhido = (await u.rpc('escolher_plano_instituicao', { p_plano: alvo }))[0]
      } catch (e) {
        return respostaDeErroBD(e, cors, d.registo, 'plano_instituicao')
      }
      if (!escolhido) return respostaErro(500, 'interno', MENSAGENS.interno, cors)
      ctx = { ...ctx, plano: escolhido.plano ?? 'por_entrada', plano_desde: escolhido.plano_desde, compromisso_ate: escolhido.compromisso_ate }
    }

    let resultado: ResultadoSubscricao = { estado: 'nada' }
    let sincronizacao: 'ok' | 'pendente' = 'ok'
    try {
      if (decisao.depois === 'criar_subscricao') resultado = await garantirSubscricao(ctx, { ...d, config: orquestracao(d) })
      else if (decisao.depois === 'cancelar_subscricao' && ctx.subscricao) {
        resultado = await terminarSubscricao(ctx.instituicao_id, ctx.subscricao.stripe_subscription_id, d)
      }
    } catch (e) {
      sincronizacao = 'pendente'
      d.registo.erro('plano_instituicao_stripe', { instituicao_id: ctx.instituicao_id, erro: erroSeguro(e), stripe: resumirErroStripe(e) })
    }
    if (resultado.estado === 'recusada') sincronizacao = 'pendente'

    const subscricao =
      resultado.estado === 'criada' || resultado.estado === 'cancelada'
        ? { estado: resultado.estadoSubscricao }
        : ctx.subscricao
          ? { estado: ctx.subscricao.estado }
          : null
    return respostaJson(
      200,
      {
        plano: ctx.plano ?? 'por_entrada',
        plano_desde: ctx.plano_desde,
        compromisso_ate: ctx.compromisso_ate,
        subscricao,
        sincronizacao,
        ...(sincronizacao === 'pendente'
          ? {
              aviso:
                decisao.depois === 'cancelar_subscricao'
                  ? 'A modalidade mudou. A mensalidade é cancelada nas próximas horas.'
                  : 'A modalidade mudou. A cobrança mensal fica ativa nas próximas horas.',
            }
          : {}),
      },
      cors,
    )
  })
}

const orquestracao = (d: DepsPlanoInstituicao) => ({
  modo: d.config.faturacao.modo,
  preAvisoDias: d.config.faturacao.preAvisoDias,
  diasPagamento: d.config.faturacao.diasPagamento,
  paisTransferencia: d.config.stripe.paisTransferencia,
  stripeModo: d.config.stripe.modo,
})
