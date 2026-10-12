import { useId } from 'react'
import { Link } from 'react-router'
import { BookOpenText, CalendarPlus, CalendarDays, MapPin, Navigation } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, ButtonLink } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { azulejoBg } from '@/components/brand/patterns'
import type { VisitaMarcada } from './data'
import { descarregarVisita } from './ics'
import { Perforation } from './ui'
import { nomeCurto, quando } from './text'

/** Cor do fundo do painel (sand a 40% sobre creme) — para os recortes do "bilhete". */
export const PAINEL_BG = 'bg-[color-mix(in_srgb,var(--color-sand)_40%,var(--color-cream))]'

export function mapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(5)},${lng.toFixed(5)}`
}

/**
 * Próxima visita em forma de bilhete: data grande em cima, instituição e ações em baixo.
 * Sem visitas, explica porque vale a pena marcar uma e leva ao sítio certo.
 */
export function VisitTicket({ visita, outras = 0, temPedidos }: { visita: VisitaMarcada | undefined; outras?: number; temPedidos: boolean }) {
  const titleId = useId()

  if (!visita) {
    return (
      <section aria-labelledby={titleId} className="rounded-[1.75rem] border-2 border-dashed border-line-strong bg-white/70 p-6">
        <p className="eyebrow">Visitas</p>
        <h2 id={titleId} className="mt-1 font-display text-2xl font-semibold">
          Ainda sem visitas marcadas
        </h2>
        <p className="mt-2 text-ink-soft">
          Ver o lar ao vivo — o cheiro, a luz, a forma como falam com os residentes — diz mais do que qualquer ficha. Marque pelo
          menos uma visita antes de decidir.
        </p>
        <ButtonLink to={temPedidos ? '/familia/pedidos' : '/pesquisa'} variant="subtle" className="mt-4" icon={<CalendarDays aria-hidden className="size-5" />}>
          {temPedidos ? 'Marcar visita num pedido' : 'Escolher instituições para visitar'}
        </ButtonLink>
      </section>
    )
  }

  const { c, lar, quando: data } = visita
  const confirmada = c.visita?.estado === 'confirmada'
  const morada = [lar.morada, `${lar.codigoPostal} ${lar.localidade}`.trim()].filter(Boolean).join(', ')

  return (
    <section aria-labelledby={titleId} className="overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-card">
      <div className="on-dark relative bg-pine-900 px-6 pt-5 pb-6 text-white">
        <div aria-hidden className="absolute inset-0 opacity-[0.09]" style={azulejoBg('#ffffff', 1, 48)} />
        <div className="relative">
          <p className="text-xs font-bold tracking-[0.14em] text-pine-200 uppercase">
            Próxima visita · <span className="normal-case tracking-normal">{quando(data)}</span>
          </p>
          <h2 id={titleId} className="sr-only">
            Próxima visita: {lar.nome}
          </h2>
          <div className="mt-3 flex items-end gap-5">
            <p className="flex flex-col leading-none">
              <span className="text-sm font-bold text-terra-300 capitalize">{data.toLocaleDateString('pt-PT', { weekday: 'long' })}</span>
              <span className="mt-1 font-display text-6xl font-semibold tabular">{data.getDate()}</span>
              <span className="mt-1 text-sm text-pine-100">{data.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })}</span>
            </p>
            <p className="mb-0.5 border-l border-white/20 pl-5 leading-none">
              <span className="block font-display text-4xl font-semibold tabular">{c.visita!.hora}</span>
              <span className="mt-2 block text-sm text-pine-200">cerca de 1 hora</span>
            </p>
          </div>
        </div>
      </div>
      <Perforation notchClass={PAINEL_BG} className="-my-3" />
      <div className="px-6 pt-3 pb-6">
        <Badge tone={confirmada ? 'leaf' : 'sun'} icon={<CalendarDays aria-hidden />}>
          {confirmada ? 'Confirmada pela instituição' : 'A aguardar confirmação'}
        </Badge>
        <p className="mt-3 font-display text-xl leading-snug font-semibold">
          <Link to={`/lar/${lar.id}`} className="hover:underline">
            {lar.nome}
          </Link>
        </p>
        <p className="mt-1 flex items-start gap-1.5 text-sm text-ink-soft">
          <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-pine-600" />
          {morada || lar.localidade}
        </p>
        <p className="mt-1 text-sm text-ink-soft">Pedido para {nomeCurto(c.perfil.nome)}</p>

        <Button
          variant="secondary"
          full
          className="mt-4"
          icon={<CalendarPlus aria-hidden className="size-5" />}
          onClick={() => {
            if (descarregarVisita(c, lar)) toast.success('Ficheiro de calendário descarregado', 'Abra-o para juntar a visita ao seu calendário.')
          }}
        >
          Adicionar ao calendário
        </Button>
        <div className="mt-2 flex flex-wrap gap-x-1">
          <a
            href={mapsUrl(lar.lat, lar.lng)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-12 items-center gap-2 rounded-2xl px-3 text-sm font-bold text-pine-800 hover:bg-pine-50"
          >
            <Navigation aria-hidden className="size-4.5" />
            Como chegar
            <span className="sr-only">(abre noutro separador)</span>
          </a>
          <Link to="/guia#visita" className="flex min-h-12 items-center gap-2 rounded-2xl px-3 text-sm font-bold text-pine-800 hover:bg-pine-50">
            <BookOpenText aria-hidden className="size-4.5" />
            Guia da visita
          </Link>
        </div>
        {outras > 0 && (
          <p className="mt-3 border-t border-dashed border-line pt-3 text-sm text-ink-soft">
            E mais {outras === 1 ? '1 visita marcada' : `${outras} visitas marcadas`} —{' '}
            <Link to="/familia/pedidos" className="link">
              ver nos pedidos
            </Link>
          </p>
        )}
      </div>
    </section>
  )
}
