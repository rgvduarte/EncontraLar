import { useEffect, useId, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { animar, useRolo } from './motion'

/**
 * Contador grande e minimalista "−  12  +": botões redondos (64px no telemóvel, 56px no desktop),
 * número legível de longe que "rola" para cima ou para baixo quando muda, e campo editável para
 * quem prefere escrever o valor (setas ↑/↓ também funcionam). No telemóvel ocupa a largura toda:
 * os botões ficam nas extremidades, ao alcance do polegar.
 */
export function Stepper({
  value,
  min = 0,
  max,
  onChange,
  label,
  unidade,
  sufixo,
  className,
}: {
  value: number
  min?: number
  max: number
  onChange: (v: number) => void
  /** etiqueta acessível do campo, ex.: "Lugares livres em quarto duplo" */
  label: string
  /** para os botões: "lugar livre" → "Menos um lugar livre" */
  unidade: string
  /** texto sob o número, ex.: "livres de 20" */
  sufixo?: string
  className?: string
}) {
  const id = useId()
  const [texto, setTexto] = useState(String(value))
  const [focado, setFocado] = useState(false)
  const { wrap, atual, fantasma } = useRolo<HTMLInputElement>(value)
  useEffect(() => {
    if (!focado) setTexto(String(value))
  }, [value, focado])

  const clamp = (v: number) => Math.max(min, Math.min(max, Math.round(v)))
  const commit = () => {
    const n = Number(texto.replace(/[^\d]/g, ''))
    const v = texto.trim() === '' || Number.isNaN(n) ? value : clamp(n)
    setTexto(String(v))
    if (v !== value) onChange(v)
  }
  /** no limite, um pequeno abanão diz "não dá mais" sem texto extra */
  const passo = (d: 1 | -1) => {
    const v = clamp(value + d)
    if (v === value) {
      animar(wrap.current, [{ transform: 'translateX(0)' }, { transform: `translateX(${d * 6}px)` }, { transform: 'translateX(0)' }], { duration: 260 })
      return
    }
    onChange(v)
  }

  const btn =
    'flex size-16 shrink-0 touch-manipulation items-center justify-center rounded-full bg-sand text-ink transition-[background-color,transform,translate,scale,color] duration-200 md:size-14 ' +
    'hover:bg-sand-deep active:scale-90 active:bg-sand-deep disabled:cursor-not-allowed disabled:text-pine-300 disabled:hover:bg-sand disabled:active:scale-100'

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <button type="button" className={btn} onClick={() => passo(-1)} disabled={value <= min} aria-label={`Menos um ${unidade}`} aria-controls={id}>
        <Minus aria-hidden className="size-7 md:size-6" strokeWidth={1.75} />
      </button>
      <div className="flex min-w-[5.5rem] flex-col items-center">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <span ref={wrap} className="relative inline-flex">
          <input
            ref={atual}
            id={id}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            enterKeyHint="done"
            autoComplete="off"
            value={texto}
            onFocus={(e) => {
              setFocado(true)
              e.currentTarget.select()
            }}
            onBlur={() => {
              setFocado(false)
              commit()
            }}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commit()
                e.currentTarget.blur()
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                passo(1)
              } else if (e.key === 'ArrowDown') {
                e.preventDefault()
                passo(-1)
              }
            }}
            aria-describedby={sufixo ? `${id}-suf` : undefined}
            className={cn(
              'w-[2.4ch] rounded-xl bg-transparent text-center text-6xl leading-none font-semibold tracking-tight text-ink tabular',
              texto.length > 2 && 'w-[3.4ch]',
            )}
          />
          <span
            ref={fantasma}
            aria-hidden
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-6xl leading-none font-semibold tracking-tight text-ink tabular opacity-0"
          />
        </span>
        {sufixo && (
          <span id={`${id}-suf`} className="mt-1.5 text-sm whitespace-nowrap text-ink-mute">
            {sufixo}
          </span>
        )}
      </div>
      <button type="button" className={btn} onClick={() => passo(1)} disabled={value >= max} aria-label={`Mais um ${unidade}`} aria-controls={id}>
        <Plus aria-hidden className="size-7 md:size-6" strokeWidth={1.75} />
      </button>
    </div>
  )
}
