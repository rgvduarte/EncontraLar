import type { Candidatura } from '@/types'
import { ESTADO_CANDIDATURA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { proximoPasso } from '../shared/estado'
import { useViewAnimations } from '../shared/motion'
import { diaHora } from '../shared/text'

/** Linha do tempo do pedido: pontos ligados por uma linha fina, do pedido ao passo seguinte. */
export function Historico({ c }: { c: Candidatura }) {
  const itens = [...c.historico].sort((a, b) => a.data.localeCompare(b.data))
  const seguinte = proximoPasso(c)
  // a linha do tempo "desenha-se" de cima para baixo: traço, ponto e texto de cada passo
  const ref = useViewAnimations<HTMLOListElement>((root) =>
    Array.from(root.children).flatMap((li, i) => {
      const t = i * 200
      const linha = li.querySelector<HTMLElement>('[data-linha]')
      const ponto = li.querySelector('[data-ponto]')
      const specs = Array.from(li.querySelectorAll(':scope > p')).map((el) => ({
        el,
        keyframes: [{ opacity: 0, transform: 'translateX(-6px)' }, { opacity: 1, transform: 'none' }],
        options: { duration: 600, delay: t + 120 },
      }))
      if (ponto) specs.push({ el: ponto, keyframes: [{ opacity: 0, transform: 'scale(0)' }, { opacity: 1, transform: 'none' }], options: { duration: 500, delay: t + 60 } })
      if (linha) {
        linha.style.transformOrigin = '50% 0'
        specs.push({ el: linha, keyframes: [{ opacity: 1, transform: 'scaleY(0)' }, { opacity: 1, transform: 'none' }], options: { duration: 700, delay: t } })
      }
      return specs
    }),
  )
  return (
    <ol ref={ref}>
      {itens.map((h, i) => {
        const atual = i === itens.length - 1
        const fim = atual && !seguinte
        return (
          <li key={`${h.estado}-${h.data}`} className="relative pb-6 pl-7 last:pb-0">
            {!(i === 0 && fim) && (
              <span data-linha aria-hidden className={cn('absolute left-[4.5px] w-px bg-line-strong', i === 0 ? 'top-3' : 'top-0', fim ? 'h-3' : 'bottom-0')} />
            )}
            <span data-ponto aria-hidden className={cn('absolute top-2 left-0 size-2.5 rounded-full', atual ? 'bg-ink' : 'bg-line-strong')} />
            <p className={cn('font-medium', atual ? 'text-ink' : 'text-ink-soft')}>
              {/* a segunda confirmação da entrada (instituição + família) torna-a verificada */}
              {h.estado === 'admitida' && itens.slice(0, i).some((x) => x.estado === 'admitida') ? 'Entrada verificada' : ESTADO_CANDIDATURA_LABEL[h.estado]}
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
          <span data-linha aria-hidden className="absolute top-0 left-[4.5px] h-2 w-px bg-line-strong" />
          <span data-ponto aria-hidden className="absolute top-2 left-0 size-2.5 rounded-full bg-white ring-[1.5px] ring-line-strong ring-inset" />
          <p className="font-medium text-ink-mute">A seguir</p>
          <p className="text-sm text-ink-mute">{seguinte}</p>
        </li>
      )}
    </ol>
  )
}
