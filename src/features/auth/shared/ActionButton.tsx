import { forwardRef, type MouseEvent } from 'react'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { InlineSpinner } from './InlineSpinner'

export type ActionState = 'idle' | 'loading' | 'done'
const ORDEM: ActionState[] = ['idle', 'loading', 'done']

/**
 * Botão principal das páginas de conta (pílula preta, largura total).
 * - Premido: encolhe ligeiramente (feedback tátil).
 * - A enviar: o texto troca com um deslize para "A entrar…" e aparece o indicador dentro da pílula.
 * - Concluído: fica verde com um visto durante um instante, antes de mudar de página.
 * Não usa `disabled` enquanto envia (não perde o foco nem fica cinzento); a repetição é bloqueada aqui
 * e no `useForm`.
 */
export const ActionButton = forwardRef<
  HTMLButtonElement,
  {
    state?: ActionState
    labels: { idle: string; loading?: string; done?: string }
    type?: 'submit' | 'button'
    onClick?: (e: MouseEvent<HTMLButtonElement>) => void
    className?: string
  }
>(function ActionButton({ state = 'idle', labels, type = 'submit', onClick, className }, ref) {
  const ocupado = state !== 'idle'
  const estados = ORDEM.filter((s) => s === 'idle' || labels[s])
  return (
    <Button
      ref={ref}
      type={type}
      size="lg"
      full
      aria-disabled={ocupado || undefined}
      aria-busy={state === 'loading' || undefined}
      onClick={(e) => {
        if (ocupado) {
          e.preventDefault()
          return
        }
        onClick?.(e)
      }}
      className={cn(
        'relative overflow-hidden transition-[background-color,color,box-shadow,scale] duration-200 active:scale-[0.97]',
        ocupado && 'cursor-progress active:scale-100',
        state === 'done' && 'bg-leaf-600 hover:bg-leaf-600 active:bg-leaf-600',
        className,
      )}
    >
      <span className="grid w-full">
        {estados.map((s) => {
          const atual = s === state
          return (
            <span
              key={s}
              aria-hidden={!atual || undefined}
              className={cn(
                'col-start-1 row-start-1 flex items-center justify-center gap-2.5',
                'transition-[opacity,translate,filter] duration-300 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
                atual
                  ? 'translate-y-0 opacity-100'
                  : cn('opacity-0 blur-[2px]', ORDEM.indexOf(s) < ORDEM.indexOf(state) ? '-translate-y-3' : 'translate-y-3'),
              )}
            >
              {s === 'loading' && <InlineSpinner className="size-[1.1em]" />}
              {s === 'done' && <Check aria-hidden strokeWidth={2.6} />}
              {labels[s]}
            </span>
          )
        })}
      </span>
    </Button>
  )
})
