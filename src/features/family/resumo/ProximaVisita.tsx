import { useId } from 'react'
import { Link } from 'react-router'
import { CalendarPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import type { VisitaMarcada } from '../shared/data'
import { descarregarVisita } from '../shared/ics'
import { MoreLink } from '../shared/ui'
import { nomeCurto, quando } from '../shared/text'

export const mapsUrl = (lat: number, lng: number) =>
  `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lng.toFixed(5)}`

/** Próxima visita: a data em grande, a instituição e uma ação — juntar ao calendário. */
export function ProximaVisita({ visita, outras = 0, temPedidos }: { visita: VisitaMarcada | undefined; outras?: number; temPedidos: boolean }) {
  const titleId = useId()

  if (!visita) {
    return (
      <section aria-labelledby={titleId}>
        <h2 id={titleId} className="text-2xl font-semibold sm:text-3xl">
          Próxima visita
        </h2>
        <div className="mt-6 tile flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-lg text-lg text-ink-soft">Ainda sem visitas marcadas. Ver o lar ao vivo diz mais do que qualquer ficha.</p>
          <MoreLink to={temPedidos ? '/familia/pedidos' : '/pesquisa'} className="shrink-0">
            {temPedidos ? 'Marcar visita' : 'Escolher onde visitar'}
          </MoreLink>
        </div>
      </section>
    )
  }

  const { c, lar, quando: data } = visita
  const confirmada = c.visita?.estado === 'confirmada'
  const morada = [lar.morada, `${lar.codigoPostal} ${lar.localidade}`.trim()].filter(Boolean).join(', ')

  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="text-2xl font-semibold sm:text-3xl">
        Próxima visita
      </h2>
      <div className="mt-6 tile grid gap-8 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-12">
        <p className="flex items-center gap-5 leading-none sm:flex-col sm:items-start sm:gap-0">
          <span className="sr-only">
            {data.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}, às {c.visita!.hora}
          </span>
          <span aria-hidden className="text-6xl font-semibold tracking-tight tabular sm:order-2 sm:mt-2 sm:text-7xl">
            {data.getDate()}
          </span>
          <span aria-hidden className="flex flex-col gap-1.5 sm:contents">
            <span className="text-lg font-medium text-terra-600 capitalize sm:order-1">{data.toLocaleDateString('pt-PT', { weekday: 'long' })}</span>
            <span className="text-lg text-ink-mute sm:order-3 sm:mt-2">
              {data.toLocaleDateString('pt-PT', { month: 'long' })} · {c.visita!.hora}
            </span>
          </span>
        </p>
        <div className="min-w-0">
          <p className="flex items-start gap-2 text-sm text-ink-mute">
            <span aria-hidden className={cn('mt-[0.45rem] size-2 shrink-0 rounded-full', confirmada ? 'bg-leaf-500' : 'bg-sun-500')} />
            <span>
              {confirmada ? 'Confirmada pela instituição' : 'A aguardar confirmação'} · {quando(data)}
            </span>
          </p>
          <h3 className="mt-2 text-2xl leading-snug font-semibold">
            <Link to={`/lar/${lar.id}`} className="hover:underline">
              {lar.nome}
            </Link>
          </h3>
          <p className="mt-1 text-ink-mute">{morada || lar.localidade}</p>
          <p className="text-ink-mute">Para {nomeCurto(c.perfil.nome)}</p>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2">
            <Button
              icon={<CalendarPlus aria-hidden />}
              onClick={() => {
                if (descarregarVisita(c, lar)) toast.success('Visita no calendário', 'Abra o ficheiro descarregado para a juntar ao seu calendário.')
              }}
            >
              Adicionar ao calendário
            </Button>
            <a href={mapsUrl(lar.lat, lar.lng)} target="_blank" rel="noreferrer" className="link inline-flex min-h-12 items-center">
              Como chegar
              <span className="sr-only"> (abre noutro separador)</span>
            </a>
            <MoreLink to="/guia#visita">O que observar</MoreLink>
          </div>
          {outras > 0 && (
            <p className="mt-4 text-sm text-ink-mute">
              E mais {outras === 1 ? '1 visita marcada' : `${outras} visitas marcadas`}, em{' '}
              <Link to="/familia/pedidos" className="link">
                Pedidos
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
