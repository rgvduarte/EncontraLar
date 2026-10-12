import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Diâmetro do cursor (px). Exportado para alinhar gráficos por cima da régua. */
export const THUMB = 32

/** Posição horizontal (CSS) do centro do cursor para uma fração 0–1 — igual à do <input type="range">. */
export const posicaoCursor = (frac: number) =>
  `calc(${THUMB / 2}px + (100% - ${THUMB}px) * ${Math.max(0, Math.min(1, frac)).toFixed(4)})`

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: number
  min: number
  max: number
  onValue: (v: number) => void
}

/** Régua grande e acessível (alvo de 48px, cursor de 32px, setas/PageUp/PageDown funcionam). */
export const RangeSlider = forwardRef<HTMLInputElement, Props>(function RangeSlider(
  { value, min, max, onValue, className, ...rest },
  ref,
) {
  const frac = (value - min) / (max - min)
  return (
    <div className={cn('relative h-12', className)}>
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 rounded-full bg-sand-deep" />
      <div
        aria-hidden
        className="absolute top-1/2 left-0 h-3 -translate-y-1/2 rounded-full bg-pine-600"
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
          'relative block h-12 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-offset-4',
          '[&::-webkit-slider-runnable-track]:h-12 [&::-webkit-slider-runnable-track]:bg-transparent',
          '[&::-webkit-slider-thumb]:mt-2 [&::-webkit-slider-thumb]:size-8 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:border-[5px] [&::-webkit-slider-thumb]:border-pine-700 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-card',
          '[&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-6 [&::-moz-range-thumb]:rounded-full',
          '[&::-moz-range-thumb]:border-[5px] [&::-moz-range-thumb]:border-pine-700 [&::-moz-range-thumb]:bg-white',
        )}
        {...rest}
      />
    </div>
  )
})
