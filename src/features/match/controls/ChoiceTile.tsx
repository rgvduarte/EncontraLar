import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Cartão de escolha do questionário (rádio ou caixa) — o mesmo desenho do ChoiceCard partilhado,
 * com resposta tátil: encolhe ligeiramente ao tocar e o visto "desenha-se" com uma pequena mola.
 * Alvo ≥ 64px de altura; o cartão inteiro é tocável.
 */
export function ChoiceTile({
  type = 'radio',
  label,
  description,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type?: 'radio' | 'checkbox'
  label: ReactNode
  description?: ReactNode
}) {
  return (
    <label
      className={cn(
        'group/tile relative flex min-h-16 cursor-pointer items-start gap-4 rounded-[1.25rem] border border-line-strong bg-white p-5 select-none',
        'transition-[scale,border-color,background-color,box-shadow] duration-300 ease-[cubic-bezier(.16,1,.3,1)]',
        'active:scale-[0.98] active:duration-100 motion-reduce:active:scale-100',
        'hover:border-pine-400 has-[:checked]:border-terra-600 has-[:checked]:bg-terra-50/60 has-[:checked]:ring-1 has-[:checked]:ring-terra-600',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
        className,
      )}
    >
      <input type={type} className="peer sr-only" {...rest} />
      <span className="flex flex-1 flex-col gap-0.5 pr-9">
        <span className="text-base leading-snug font-semibold text-ink">{label}</span>
        {description && <span className="text-sm text-ink-soft">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute top-5 right-5 flex size-6 items-center justify-center border-[1.5px] border-line-strong bg-white',
          'transition-[background-color,border-color,scale] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]',
          'scale-90 group-has-[:checked]/tile:scale-100 group-has-[:checked]/tile:border-terra-600 group-has-[:checked]/tile:bg-terra-600',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
        )}
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-3.5 text-white">
          {/* o visto desenha-se da esquerda para a direita (stroke-dashoffset 1 → 0) */}
          <path
            d="M4 12l5 5L20 6"
            pathLength={1}
            stroke="currentColor"
            strokeWidth={3.2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="[stroke-dasharray:1_2] [stroke-dashoffset:1] transition-[stroke-dashoffset] delay-75 duration-300 ease-out motion-reduce:delay-0 group-has-[:checked]/tile:[stroke-dashoffset:0]"
          />
        </svg>
      </span>
    </label>
  )
}
