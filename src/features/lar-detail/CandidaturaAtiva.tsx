import { useMemo } from 'react'
import type { Candidatura, Lar } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { estimarEspera } from '@/lib/forecast'
import { ESTADO_CANDIDATURA_DESCRICAO, ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { pct, tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { diaPorExtenso, esperaEstimada } from './helpers'

const PONTO: Record<Candidatura['estado'], string> = {
  enviada: 'bg-terra-600',
  em_analise: 'bg-sun-500',
  lista_espera: 'bg-dusk-500',
  vaga_proposta: 'bg-leaf-500',
  aceite: 'bg-leaf-500',
  recusada: 'bg-alert-600',
  cancelada: 'bg-dusk-500',
}

/** Estado do pedido que a família já fez a esta instituição (substitui "Pedir vaga"). */
export function CandidaturaAtiva({ lar, c, onVisita }: { lar: Lar; c: Candidatura; onVisita: () => void }) {
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
            <span className="text-6xl font-semibold tracking-tight text-ink tabular">{c.posicao}.º</span>
            <span className="text-sm text-ink-soft">lugar na lista de espera</span>
          </p>
          {est.imediata ? (
            <p className="mt-3 text-ink">Há lugar livre para si — a instituição deve contactá-lo(a).</p>
          ) : (
            <>
              <p className="mt-3 text-ink">
                <span className="font-semibold tabular">{pct(est.p90)}</span> de probabilidade de vaga em 3 meses
              </p>
              <p className="text-ink">
                Espera estimada de <span className="font-semibold">{esperaEstimada(est)}</span>
              </p>
              <p className="mt-1 text-sm text-ink-mute">Estimativa para a sua posição, não é garantia.</p>
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
