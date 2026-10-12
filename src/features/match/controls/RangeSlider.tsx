import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Diâmetro do cursor (px). */
const THUMB = 28

/** Posição horizontal (CSS) do centro do cursor para uma fração 0–1 — igual à do <input type="range">. */
const posicaoCursor = (frac: number) =>
  `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${Math.max(0, Math.min(1, frac)).toFixed(4)})`

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: number
  min: number
  max: number
  onValue: (v: number) => void
}

/**
 * Régua ao estilo Apple: trilho fino, preenchimento azul, cursor branco com sombra.
 * Alvo de 48px de altura; setas, PageUp/PageDown, Home/End funcionam (input nativo).
 */
export const RangeSlider = forwardRef<HTMLInputElement, Props>(function RangeSlider(
  { value, min, max, onValue, className, ...rest },
  ref,
) {
  const frac = (value - min) / (max - min)
  return (
    <div className={cn('relative h-12', className)}>
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sand-deep" />
      <div
        aria-hidden
        className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-terra-600"
        style={{ width: posicaoCursor(frac) }}
      />
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onValue(Number(e.target.value))}
        className={cn(
          'relative block h-12 w-full cursor-pointer appearance-none rounded-full bg-transparent',
          '[&::-webkit-slider-runnable-track]:h-12 [&::-webkit-slider-runnable-track]:bg-transparent',
          '[&::-webkit-slider-thumb]:mt-[10px] [&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/5 [&::-webkit-slider-thumb]:bg-white',
          '[&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgb(0_0_0/0.18),0_6px_14px_rgb(0_0_0/0.12)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200',
          'active:[&::-webkit-slider-thumb]:scale-110',
          '[&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0',
          '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_1px_3px_rgb(0_0_0/0.18),0_6px_14px_rgb(0_0_0/0.12)]',
        )}
        {...rest}
      />
    </div>
  )
})
