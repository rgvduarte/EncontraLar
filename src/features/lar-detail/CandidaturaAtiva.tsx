import { useMemo } from 'react'
import { BadgeCheck } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { estimarEspera } from '@/lib/forecast'
import { ESTADO_CANDIDATURA_DESCRICAO, ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { dataLocal, pct, tempoRelativo } from '@/lib/format'
import { entradaVerificada } from '@/lib/negocio'
import { jaAvaliou } from '@/lib/store'
import { cn } from '@/lib/cn'
import { diaPorExtenso, esperaEstimada } from './helpers'

const PONTO: Record<Candidatura['estado'], string> = {
  enviada: 'bg-terra-600',
  em_analise: 'bg-sun-500',
  lista_espera: 'bg-dusk-500',
  vaga_proposta: 'bg-leaf-500',
  aceite: 'bg-leaf-500',
  admitida: 'bg-leaf-500',
  recusada: 'bg-alert-600',
  cancelada: 'bg-dusk-500',
}

/** "3 de agosto" (com o ano quando não é o atual), a partir de "AAAA-MM-DD", sem desvios de fuso horário. */
function diaDaEntrada(ymd: string): string {
  const d = dataLocal(ymd)
  const outroAno = d.getFullYear() !== new Date().getFullYear()
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', ...(outroAno ? { year: 'numeric' } : {}) })
}

/** O que falta à família depois da entrada: confirmá-la (só a instituição a registou) ou avaliar. */
function passoDaEntrada(c: Candidatura) {
  const e = c.entrada
  const porConfirmar = c.estado === 'admitida' && !!e?.confirmadaLarEm && !e.confirmadaFamiliaEm
  const podeAvaliar = c.estado === 'admitida' && !!e?.confirmadaFamiliaEm && !jaAvaliou(c)
  return { porConfirmar, podeAvaliar }
}

/** Texto da ação do pedido (cartão e barra do telemóvel), sempre para o painel da família. */
export function acaoDoPedido(c: Candidatura): string {
  if (c.estado !== 'admitida') return 'Acompanhar o pedido'
  const { porConfirmar, podeAvaliar } = passoDaEntrada(c)
  return porConfirmar ? 'Confirmar entrada' : podeAvaliar ? 'Avaliar a instituição' : 'Ver o pedido'
}

/**
 * A pessoa já entrou (estado 'admitida'): "Entrou a <dia>", quem confirmou e o passo seguinte da família —
 * confirmar a entrada (se só a instituição a registou) e, depois disso, deixar uma avaliação verificada.
 */
function Admitida({ c }: { c: Candidatura }) {
  const primeiroNome = c.perfil.nome.split(' ')[0]
  const e = c.entrada
  const verificada = entradaVerificada(c)
  const { porConfirmar, podeAvaliar } = passoDaEntrada(c)

  return (
    <div aria-live="polite">
      <p className="text-sm text-ink-mute">O seu pedido para {primeiroNome}</p>
      <p className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
        <span aria-hidden className="size-2.5 shrink-0 rounded-full bg-leaf-500" />
        {e?.data ? `Entrou a ${diaDaEntrada(e.data)}` : ESTADO_CANDIDATURA_LABEL.admitida}
      </p>
      {verificada ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-terra-700">
          <BadgeCheck aria-hidden className="size-4.5" />
          Entrada verificada
        </p>
      ) : porConfirmar ? (
        <p className="mt-1 text-sm text-ink-mute">Registada pela instituição. Já entrou? Confirme a entrada para a deixar verificada.</p>
      ) : e?.confirmadaFamiliaEm ? (
        <p className="mt-1 text-sm text-ink-mute">Confirmada por si. Falta a instituição registar a entrada.</p>
      ) : (
        <p className="mt-1 text-sm text-ink-mute">{ESTADO_CANDIDATURA_DESCRICAO.admitida}</p>
      )}
      {podeAvaliar && <p className="mt-3 text-sm text-ink-soft">Já pode deixar uma avaliação verificada. Ajuda outras famílias a escolher.</p>}

      <div className="mt-5 flex flex-col gap-3">
        <ButtonLink to="/familia/pedidos" variant={porConfirmar || podeAvaliar ? 'primary' : 'subtle'} size="lg" full>
          {acaoDoPedido(c)}
        </ButtonLink>
      </div>
    </div>
  )
}

/** Estado do pedido que a família já fez a esta instituição (substitui "Pedir vaga"); inclui a entrada ('admitida'). */
export function CandidaturaAtiva({ lar, c, onVisita }: { lar: Lar; c: Candidatura; onVisita: () => void }) {
  if (c.estado === 'admitida') return <Admitida c={c} />
  return <PedidoEmCurso lar={lar} c={c} onVisita={onVisita} />
}

function PedidoEmCurso({ lar, c, onVisita }: { lar: Lar; c: Candidatura; onVisita: () => void }) {
  const naLista = c.estado === 'lista_espera' && c.posicao != null
  const est = useMemo(() => (naLista ? estimarEspera(lar, { posicao: c.posicao }) : null), [lar, naLista, c.posicao])
  const primeiroNome = c.perfil.nome.split(' ')[0]
  const podeVisitar = !c.visita && ['enviada', 'em_analise', 'lista_espera'].includes(c.estado)

  return (
    <div aria-live="polite">
      <p className="text-sm text-ink-mute">O seu pedido para {primeiroNome}</p>
      <p className="mt-1 flex items-center gap-2 text-xl font-semibold tracking-tight text-ink">
        <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', PONTO[c.estado])} />
        {ESTADO_CANDIDATURA_LABEL[c.estado]}
      </p>
      <p className="mt-1 text-sm text-ink-mute">
        {naLista ? `Atualizado ${tempoRelativo(c.atualizadaEm)}` : `${ESTADO_CANDIDATURA_DESCRICAO[c.estado]}`}
      </p>

      {c.estado === 'vaga_proposta' && c.prazoResposta && (
        <p className="mt-3 text-base font-medium text-leaf-700">
          Responda até{' '}
          {new Date(c.prazoResposta).toLocaleString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.
        </p>
      )}

      {naLista && est && (
        <div className="mt-5">
          <p className="flex items-baseline gap-3">
            <span className="text-6xl font-semibold tracking-tight text-ink tabular">
              {c.posicao}
              <span className="text-4xl">.º</span>
            </span>
            <span className="text-sm text-ink-soft">lugar na lista de espera</span>
          </p>
          {est.imediata ? (
            <p className="mt-3 text-ink">Há lugar livre para si — a instituição deve contactá-lo(a).</p>
          ) : (
            <>
              <dl className="mt-4 flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Probabilidade de vaga em 3 meses</dt>
                  <dd className="shrink-0 font-semibold text-ink tabular">{pct(est.p90)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-ink-soft">Espera estimada</dt>
                  <dd className="shrink-0 font-semibold text-ink">{esperaEstimada(est)}</dd>
                </div>
              </dl>
              <p className="mt-2 text-sm text-ink-mute">Estimativa para a sua posição, não é garantia.</p>
            </>
          )}
        </div>
      )}

      {c.visita && (
        <p className="mt-4 text-sm text-ink-soft">
          Visita {c.visita.estado === 'confirmada' ? 'confirmada' : c.visita.estado === 'realizada' ? 'realizada' : 'pedida'} para{' '}
          <span className="font-medium text-ink">{diaPorExtenso(c.visita.data)}</span>, às {c.visita.hora}
          {c.visita.estado === 'pedida' && ' — a aguardar confirmação'}.
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3">
        <ButtonLink to="/familia/pedidos" size="lg" full>
          Acompanhar o pedido
        </ButtonLink>
        {podeVisitar && (
          <Button variant="subtle" size="lg" full onClick={onVisita}>
            Marcar visita
          </Button>
        )}
      </div>
    </div>
  )
}
