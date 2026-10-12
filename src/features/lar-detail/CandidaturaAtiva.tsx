import { useMemo } from 'react'
import { ArrowRight, CalendarCheck, CalendarClock, CalendarDays, Hourglass } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { estimarEspera } from '@/lib/forecast'
import { ESTADO_CANDIDATURA_DESCRICAO, ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { pct, tempoRelativo } from '@/lib/format'
import { diaPorExtenso, esperaEstimada } from './helpers'

const TOM: Record<Candidatura['estado'], BadgeTone> = {
  enviada: 'pine',
  em_analise: 'sun',
  lista_espera: 'dusk',
  vaga_proposta: 'leaf',
  aceite: 'leaf',
  recusada: 'alert',
  cancelada: 'neutral',
}

/** Estado do pedido que a família já fez a esta instituição (substitui o botão "Pedir vaga"). */
export function CandidaturaAtiva({ lar, c, onVisita }: { lar: Lar; c: Candidatura; onVisita: () => void }) {
  const naLista = c.estado === 'lista_espera' && c.posicao != null
  const est = useMemo(() => (naLista ? estimarEspera(lar, { posicao: c.posicao }) : null), [lar, naLista, c.posicao])
  const primeiroNome = c.perfil.nome.split(' ')[0]

  return (
    <div className="rounded-2xl border-2 border-pine-200 bg-pine-50/70 p-4" aria-live="polite">
      <p className="text-xs font-bold tracking-[0.12em] text-pine-700 uppercase">O seu pedido · {primeiroNome}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Badge tone={TOM[c.estado]} size="md">
          {ESTADO_CANDIDATURA_LABEL[c.estado]}
        </Badge>
        <span className="text-sm text-ink-mute">atualizado {tempoRelativo(c.atualizadaEm)}</span>
      </div>
      <p className="mt-2 text-sm text-ink-soft">{ESTADO_CANDIDATURA_DESCRICAO[c.estado]}</p>

      {c.estado === 'vaga_proposta' && c.prazoResposta && (
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-leaf-50 px-3 py-2 text-sm font-semibold text-leaf-700">
          <Hourglass aria-hidden className="mt-0.5 size-4 shrink-0" />
          Responda até {new Date(c.prazoResposta).toLocaleString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.
        </p>
      )}

      {naLista && est && (
        <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-4 border-t border-pine-200 pt-4">
          <p className="row-span-2 font-display text-5xl leading-none font-semibold text-pine-800 tabular">
            {c.posicao}
            <span className="align-super text-lg">.º</span>
          </p>
          <p className="text-sm font-bold text-ink">lugar na lista de espera</p>
          <p className="text-sm text-ink-soft">
            {est.imediata ? (
              'Há lugar livre para si — a instituição deve contactá-lo(a).'
            ) : (
              <>
                Para si: <strong className="text-ink">{pct(est.p90)}</strong> em 3 meses · <strong className="text-ink">{pct(est.p180)}</strong> em 6 meses
              </>
            )}
          </p>
          {!est.imediata && (
            <p className="col-span-2 mt-2 text-sm text-ink-soft">
              Espera estimada: <strong className="text-ink">{esperaEstimada(est)}</strong> (estimativa, não é garantia).
            </p>
          )}
        </div>
      )}

      {c.visita ? (
        <p className="mt-4 flex items-start gap-2 text-sm text-ink">
          {c.visita.estado === 'confirmada' ? (
            <CalendarCheck aria-hidden className="mt-0.5 size-4.5 shrink-0 text-leaf-600" />
          ) : (
            <CalendarClock aria-hidden className="mt-0.5 size-4.5 shrink-0 text-sun-700" />
          )}
          <span>
            Visita {c.visita.estado === 'confirmada' ? 'confirmada' : c.visita.estado === 'realizada' ? 'realizada' : 'pedida'} para{' '}
            <strong>{diaPorExtenso(c.visita.data)}</strong>, às {c.visita.hora}
            {c.visita.estado === 'pedida' && <span className="text-ink-soft"> — a aguardar confirmação</span>}.
          </span>
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-2">
        <ButtonLink to="/familia/pedidos" full iconRight={<ArrowRight aria-hidden className="size-5" />}>
          Acompanhar o pedido
        </ButtonLink>
        {!c.visita && ['enviada', 'em_analise', 'lista_espera'].includes(c.estado) && (
          <Button variant="secondary" full onClick={onVisita} icon={<CalendarDays aria-hidden className="size-5" />}>
            Marcar visita
          </Button>
        )}
      </div>
    </div>
  )
}
