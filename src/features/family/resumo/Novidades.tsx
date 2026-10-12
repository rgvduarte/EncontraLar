import { Link, useLocation } from 'react-router'
import type { Notificacao } from '@/types'
import { marcarNotificacaoLida, marcarTodasLidas } from '@/lib/store'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { SectionHeader } from '../shared/ui'

const ACAO: Record<Notificacao['tipo'], string> = {
  vaga: 'Ver instituição',
  candidatura: 'Ver pedido',
  visita: 'Ver visita',
  sistema: 'Abrir',
}

/** Notificações recentes: lista simples, ponto azul nas por ler. */
export function Novidades({ notifs, limite = 4 }: { notifs: Notificacao[]; limite?: number }) {
  const { pathname } = useLocation()
  const porLer = notifs.filter((n) => !n.lida).length
  const lista = notifs.slice(0, limite)

  return (
    <section aria-labelledby="novidades">
      <SectionHeader
        id="novidades"
        title="Novidades"
        sub={porLer > 0 ? (porLer === 1 ? '1 por ler' : `${porLer} por ler`) : 'Tudo lido'}
        action={
          porLer > 0 ? (
            <button type="button" onClick={() => marcarTodasLidas()} className="link inline-flex min-h-12 items-center">
              Marcar todas como lidas
            </button>
          ) : undefined
        }
      />
      {lista.length === 0 ? (
        <p className="mt-6 text-ink-mute">Quando uma instituição responder ou abrir vaga numa guardada, aparece aqui.</p>
      ) : (
        <ul className="mt-6 divide-y divide-line border-y border-line" aria-live="polite">
          {lista.map((n) => {
            const destino = n.link === '/familia' && n.candidaturaId ? `/familia/pedidos#pedido-${n.candidaturaId}` : n.link
            const link = destino && destino !== pathname ? destino : undefined
            return (
              <li key={n.id} className="grid grid-cols-[0.75rem_minmax(0,1fr)] gap-x-3 py-5">
                <span aria-hidden className={cn('mt-2.5 size-2 rounded-full', n.lida ? 'bg-transparent' : 'bg-terra-600')} />
                <div>
                  <p className="flex items-baseline justify-between gap-4">
                    <span className={n.lida ? 'font-medium text-ink-soft' : 'font-semibold'}>
                      {!n.lida && <span className="sr-only">Por ler: </span>}
                      {n.titulo}
                    </span>
                    <span className="shrink-0 text-xs text-ink-mute">{tempoRelativo(n.criadaEm)}</span>
                  </p>
                  <p className="mt-1 text-sm text-ink-mute">{n.texto}</p>
                  {(link || !n.lida) && (
                    <p className="mt-1 flex flex-wrap gap-x-5 text-sm">
                      {link && (
                        <Link to={link} onClick={() => !n.lida && marcarNotificacaoLida(n.id)} className="link inline-flex min-h-11 items-center">
                          {ACAO[n.tipo]}
                        </Link>
                      )}
                      {!n.lida && (
                        <button
                          type="button"
                          onClick={() => marcarNotificacaoLida(n.id)}
                          className="inline-flex min-h-11 items-center text-ink-mute hover:text-ink hover:underline"
                        >
                          Marcar como lida
                        </button>
                      )}
                    </p>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
