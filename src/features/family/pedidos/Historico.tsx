import type { Candidatura } from '@/types'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { proximoPasso } from '../shared/estado'
import { diaHora } from '../shared/text'

/** Linha do tempo do pedido: uma linha fina vertical, do pedido ao passo seguinte. */
export function Historico({ c }: { c: Candidatura }) {
  const itens = [...c.historico].sort((a, b) => a.data.localeCompare(b.data))
  const seguinte = proximoPasso(c)
  return (
    <ol className="relative ml-1 border-l border-line-strong">
      {itens.map((h, i) => {
        const atual = i === itens.length - 1
        return (
          <li key={`${h.estado}-${h.data}`} className="relative pb-6 pl-6 last:pb-0">
            <span
              aria-hidden
              className={cn('absolute top-2 -left-[5px] size-2.5 rounded-full ring-4 ring-white', atual ? 'bg-ink' : 'bg-line-strong')}
            />
            <p className={cn('font-medium', atual ? 'text-ink' : 'text-ink-soft')}>
              {ESTADO_CANDIDATURA_LABEL[h.estado]}
              {atual && <span className="sr-only"> (estado atual)</span>}
            </p>
            <p className="text-sm text-ink-mute">
              <time dateTime={h.data}>{diaHora(h.data)}</time>
            </p>
            {h.nota && <p className="mt-1 text-sm text-ink-soft">{h.nota}</p>}
          </li>
        )
      })}
      {seguinte && (
        <li className="relative pt-6 pl-6">
          <span aria-hidden className="absolute top-8 -left-[5px] size-2.5 rounded-full bg-white ring-[1.5px] ring-line-strong" />
          <p className="font-medium text-ink-mute">A seguir</p>
          <p className="text-sm text-ink-mute">{seguinte}</p>
        </li>
      )}
    </ol>
  )
}
