import type { Candidatura } from '@/types'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { proximoPasso } from '../shared/estado'
import { diaHora } from '../shared/text'

/** Linha do tempo do pedido: pontos ligados por uma linha fina, do pedido ao passo seguinte. */
export function Historico({ c }: { c: Candidatura }) {
  const itens = [...c.historico].sort((a, b) => a.data.localeCompare(b.data))
  const seguinte = proximoPasso(c)
  return (
    <ol>
      {itens.map((h, i) => {
        const atual = i === itens.length - 1
        const fim = atual && !seguinte
        return (
          <li key={`${h.estado}-${h.data}`} className="relative pb-6 pl-7 last:pb-0">
            {!(i === 0 && fim) && (
              <span aria-hidden className={cn('absolute left-[4.5px] w-px bg-line-strong', i === 0 ? 'top-3' : 'top-0', fim ? 'h-3' : 'bottom-0')} />
            )}
            <span aria-hidden className={cn('absolute top-2 left-0 size-2.5 rounded-full', atual ? 'bg-ink' : 'bg-line-strong')} />
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
        <li className="relative pt-0 pl-7">
          <span aria-hidden className="absolute top-0 left-[4.5px] h-2 w-px bg-line-strong" />
          <span aria-hidden className="absolute top-2 left-0 size-2.5 rounded-full bg-white ring-[1.5px] ring-line-strong ring-inset" />
          <p className="font-medium text-ink-mute">A seguir</p>
          <p className="text-sm text-ink-mute">{seguinte}</p>
        </li>
      )}
    </ol>
  )
}
