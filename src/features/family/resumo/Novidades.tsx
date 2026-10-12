import { Link, useLocation } from 'react-router'
import { BellRing, CalendarCheck, FileText, Info, type LucideIcon } from 'lucide-react'
import type { Notificacao } from '@/types'
import { marcarNotificacaoLida, marcarTodasLidas } from '@/lib/store'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'

const ICON: Record<Notificacao['tipo'], LucideIcon> = {
  vaga: BellRing,
  candidatura: FileText,
  visita: CalendarCheck,
  sistema: Info,
}
const ICON_TONE: Record<Notificacao['tipo'], string> = {
  vaga: 'bg-leaf-100 text-leaf-700',
  candidatura: 'bg-dusk-50 text-dusk-700',
  visita: 'bg-pine-50 text-pine-700',
  sistema: 'bg-sand text-ink-soft',
}
const ACAO: Record<Notificacao['tipo'], string> = {
  vaga: 'Ver instituição',
  candidatura: 'Ver pedido',
  visita: 'Ver visita',
  sistema: 'Abrir',
}

export function Novidades({ notifs, limite = 5 }: { notifs: Notificacao[]; limite?: number }) {
  const { pathname } = useLocation()
  const porLer = notifs.filter((n) => !n.lida).length
  const lista = notifs.slice(0, limite)

  return (
    <section aria-labelledby="novidades" className="rounded-[1.75rem] border border-line bg-white shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-6 pb-3 sm:px-7">
        <div>
          <p className="eyebrow mb-1">Notificações</p>
          <h2 id="novidades" className="font-display text-2xl font-semibold">
            Novidades{' '}
            {porLer > 0 && <span className="font-sans text-base font-bold text-terra-700">· {porLer === 1 ? '1 por ler' : `${porLer} por ler`}</span>}
          </h2>
        </div>
        {porLer > 0 && (
          <button type="button" onClick={() => marcarTodasLidas()} className="link min-h-11 text-sm">
            Marcar todas como lidas
          </button>
        )}
      </div>

      {lista.length === 0 ? (
        <p className="px-5 pb-7 text-ink-soft sm:px-7">
          Ainda não há novidades. Quando uma instituição responder a um pedido ou abrir vaga numa das guardadas, aparece aqui e no
          sino, no topo da página.
        </p>
      ) : (
        <ul className="divide-y divide-line border-t border-line">
          {lista.map((n) => {
            const Icon = ICON[n.tipo]
            const destino = n.link === '/familia' && n.candidaturaId ? `/familia/pedidos#pedido-${n.candidaturaId}` : n.link
            const link = destino && destino !== pathname ? destino : undefined
            return (
              <li key={n.id} className={cn('flex gap-4 px-5 py-4 sm:px-7', !n.lida && 'bg-pine-50/50')}>
                <span aria-hidden className={cn('mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full', ICON_TONE[n.tipo])}>
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-start justify-between gap-3">
                    <span className="font-bold">
                      {!n.lida && <span className="sr-only">Por ler: </span>}
                      {n.titulo}
                    </span>
                    <span className="shrink-0 text-xs text-ink-mute">{tempoRelativo(n.criadaEm)}</span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-soft">{n.texto}</p>
                  <div className="mt-1 flex flex-wrap gap-x-5">
                    {link && (
                      <Link to={link} onClick={() => !n.lida && marcarNotificacaoLida(n.id)} className="link inline-flex min-h-11 items-center text-sm">
                        {ACAO[n.tipo]}
                      </Link>
                    )}
                    {!n.lida && (
                      <button
                        type="button"
                        onClick={() => marcarNotificacaoLida(n.id)}
                        className="inline-flex min-h-11 items-center text-sm font-semibold text-ink-soft underline decoration-line-strong underline-offset-4 hover:text-ink"
                      >
                        Marcar como lida
                      </button>
                    )}
                  </div>
                </div>
                {!n.lida && <span aria-hidden className="mt-2 size-2.5 shrink-0 rounded-full bg-terra-500" />}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
