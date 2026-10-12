import { forwardRef, useRef, type CSSProperties, type InputHTMLAttributes, type PointerEvent } from 'react'
import { cn } from '@/lib/cn'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange' | 'min' | 'max'> & {
  value: number
  min: number
  max: number
  onValue: (v: number) => void
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

/**
 * Régua ao estilo Apple: trilho fino, preenchimento azul, cursor branco com sombra.
 * Alvo de 48px de altura; cursor de 28px (34px em ecrãs táteis). Setas, PageUp/PageDown, Home/End funcionam
 * (input nativo). No telemóvel um toque no trilho também escolhe o valor — o Safari do iOS só deixa arrastar o cursor.
 */
export const RangeSlider = forwardRef<HTMLInputElement, Props>(function RangeSlider(
  { value, min, max, onValue, className, step, onPointerDown, onPointerUp, onPointerCancel, ...rest },
  ref,
) {
  const frac = clamp01((value - min) / (max - min))
  const toque = useRef<{ x: number; y: number } | null>(null)

  const fimDoToque = (e: PointerEvent<HTMLInputElement>) => {
    const t = toque.current
    toque.current = null
    if (!t || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 8) return // arrastou ou fez scroll
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const thumb = parseFloat(getComputedStyle(el).getPropertyValue('--thumb')) || 28
    const xCursor = r.left + thumb / 2 + (r.width - thumb) * frac
    if (Math.abs(e.clientX - xCursor) <= thumb / 2 + 4) return // tocou no próprio cursor
    const f = clamp01((e.clientX - r.left - thumb / 2) / (r.width - thumb))
    const s = Number(step) || 1
    const v = Math.min(max, Math.max(min, min + Math.round((f * (max - min)) / s) * s))
    if (v !== value) onValue(v)
  }

  return (
    <div
      className={cn('relative h-12 [--thumb:28px] pointer-coarse:[--thumb:34px]', className)}
      style={{ '--f': frac.toFixed(4) } as CSSProperties}
    >
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-sand-deep" />
      <div
        aria-hidden
        className="absolute top-1/2 left-0 h-1.5 w-[calc(var(--thumb)/2_+_(100%_-_var(--thumb))_*_var(--f))] -translate-y-1/2 rounded-full bg-terra-600"
      />
      <input
        ref={ref}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValue(Number(e.target.value))}
        onPointerDown={(e) => {
          toque.current = e.pointerType === 'touch' ? { x: e.clientX, y: e.clientY } : null
          onPointerDown?.(e)
        }}
        onPointerUp={(e) => {
          if (e.pointerType === 'touch') fimDoToque(e)
          onPointerUp?.(e)
        }}
        onPointerCancel={(e) => {
          toque.current = null
          onPointerCancel?.(e)
        }}
        className={cn(
          'relative block h-12 w-full cursor-pointer appearance-none rounded-full bg-transparent',
          '[&::-webkit-slider-runnable-track]:h-12 [&::-webkit-slider-runnable-track]:bg-transparent',
          '[&::-webkit-slider-thumb]:mt-[calc((3rem_-_var(--thumb))/2)] [&::-webkit-slider-thumb]:size-(--thumb) [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full',
          '[&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-black/5 [&::-webkit-slider-thumb]:bg-white',
          '[&::-webkit-slider-thumb]:shadow-[0_1px_3px_rgb(0_0_0/0.18),0_6px_14px_rgb(0_0_0/0.12)] [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:duration-200',
          'active:[&::-webkit-slider-thumb]:scale-110 motion-reduce:active:[&::-webkit-slider-thumb]:scale-100',
          '[&::-moz-range-track]:bg-transparent [&::-moz-range-thumb]:size-(--thumb) [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0',
          '[&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:shadow-[0_1px_3px_rgb(0_0_0/0.18),0_6px_14px_rgb(0_0_0/0.12)]',
        )}
        {...rest}
      />
    </div>
  )
})
