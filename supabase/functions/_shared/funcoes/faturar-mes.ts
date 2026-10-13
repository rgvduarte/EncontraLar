/**
 * faturar-mes — chamada pelo pg_cron (pg_net) com o cabeçalho x-encontralar-cron; deploy com
 * --no-verify-jwt. Responde 202 já e corre a fase em segundo plano (EdgeRuntime.waitUntil):
 *   { fase: 'diario' }   faturarDiario (documentos, débitos, reconciliação das mensalidades)
 *   { fase: 'cobranca' } cobrarMes (dia 1: uma cobrança Stripe por lar com entradas faturadas)
 */
import type { EmissorFaturas } from '../faturacao/emissor.ts'
import { cobrarMes, faturarDiario, type DepsOrquestrador } from '../faturacao/orquestrador.ts'
import { lerCorpoJson } from '../http/pedido.ts'
import { MENSAGENS, respostaErro, respostaJson } from '../http/respostas.ts'
import { segredosIguais } from '../http/segredo.ts'
import type { FaseExecucao, PortaBD } from '../portas.ts'
import type { PortaStripe } from '../stripe/porta.ts'
import { erroSeguro } from '../erros.ts'
import type { DepsComuns, Handler } from './comum.ts'

export const CABECALHO_CRON = 'x-encontralar-cron'

export interface DepsCron extends DepsComuns {
  bd: PortaBD
  stripe: PortaStripe
  emissor: EmissorFaturas
  agendar: (p: Promise<unknown>) => void
}

const eFase = (v: unknown): v is FaseExecucao => v === 'diario' || v === 'cobranca'

export function criarHandlerFaturarMes(d: DepsCron): Handler {
  return async (req) => {
    if (req.method !== 'POST') return respostaErro(405, 'metodo', MENSAGENS.metodo, { Allow: 'POST' })
    const segredo = d.config.faturacao.segredoCron
    if (!segredo || !(await segredosIguais(req.headers.get(CABECALHO_CRON), segredo))) return respostaErro(401, 'nao_autorizado', 'Não autorizado.')
    const corpo = await lerCorpoJson(req)
    const fase = corpo?.fase
    if (!eFase(fase)) return respostaErro(400, 'fase', "Fase desconhecida: use 'diario' ou 'cobranca'.")
    const deps: DepsOrquestrador = {
      bd: d.bd,
      stripe: d.stripe,
      emissor: d.emissor,
      registo: d.registo,
      config: {
        modo: d.config.faturacao.modo,
        preAvisoDias: d.config.faturacao.preAvisoDias,
        diasPagamento: d.config.faturacao.diasPagamento,
        paisTransferencia: d.config.stripe.paisTransferencia,
        stripeModo: d.config.stripe.modo,
      },
    }
    const agora = d.agora()
    const trabalho = (fase === 'diario' ? faturarDiario(deps, agora) : cobrarMes(deps, agora)).then(
      (r) => d.registo.info(`faturar_${fase}`, r as Record<string, unknown>),
      (e) => d.registo.erro(`faturar_${fase}_falhou`, { erro: erroSeguro(e) }),
    )
    d.agendar(trabalho)
    return respostaJson(202, { aceite: true, fase })
  }
}
