import type { Candidatura } from '@/types'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { proximoPasso } from '../shared/estado'
import { diaHora } from '../shared/text'

/** Linha do tempo vertical do pedido (mais antigo em cima), com notas da instituição e o passo seguinte. */
export function Historico({ c }: { c: Candidatura }) {
  const itens = [...c.historico].sort((a, b) => a.data.localeCompare(b.data))
  const seguinte = proximoPasso(c)
  return (
    <ol className="relative">
      {itens.map((h, i) => {
        const ultimo = i === itens.length - 1
        return (
          <li key={`${h.estado}-${h.data}`} className="relative flex gap-4 pb-5">
            {/* linha */}
            {(!ultimo || seguinte) && <span aria-hidden className="absolute top-6 bottom-0 left-[11px] w-0.5 bg-line-strong" />}
            <span
              aria-hidden
              className={cn(
                'relative mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2',
                ultimo ? 'border-terra-600 bg-terra-600' : 'border-pine-700 bg-white',
              )}
            >
              <span className={cn('size-2 rounded-full', ultimo ? 'bg-white' : 'bg-pine-700')} />
            </span>
            <div className="min-w-0">
              <p className="text-sm text-ink-soft">
                <time dateTime={h.data}>{diaHora(h.data)}</time>
              </p>
              <p className={cn('font-bold', ultimo ? 'text-ink' : 'text-ink-soft')}>{ESTADO_CANDIDATURA_LABEL[h.estado]}</p>
              {h.estado === 'enviada' && c.mensagem && (
                <blockquote className="mt-1.5 rounded-xl border-l-4 border-line-strong bg-sand/60 px-3 py-2 text-sm text-ink-soft">
                  <span className="sr-only">A sua mensagem: </span>“{c.mensagem}”
                </blockquote>
              )}
              {h.nota && (
                <p className="mt-1.5 rounded-xl border-l-4 border-pine-300 bg-pine-50 px-3 py-2 text-sm">
                  <span className="font-bold text-pine-800">Nota: </span>
                  {h.nota}
                </p>
              )}
            </div>
          </li>
        )
      })}
      {seguinte && (
        <li className="relative flex gap-4">
          <span aria-hidden className="relative mt-1 size-6 shrink-0 rounded-full border-2 border-dashed border-line-strong bg-cream" />
          <div>
            <p className="text-sm font-bold text-ink-soft">A seguir</p>
            <p className="text-sm text-ink-soft">{seguinte}</p>
          </div>
        </li>
      )}
    </ol>
  )
}
