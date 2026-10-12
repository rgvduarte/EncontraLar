import { useEffect, useId, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Contador grande e minimalista "−  12  +": botões redondos de 56px, número legível de longe
 * e campo editável para quem prefere escrever o valor (setas ↑/↓ também funcionam).
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

  const btn =
    'flex size-14 shrink-0 items-center justify-center rounded-full bg-sand text-ink transition-[background-color,transform] duration-200 ' +
    'hover:bg-sand-deep active:scale-95 disabled:cursor-not-allowed disabled:text-pine-300 disabled:hover:bg-sand disabled:active:scale-100'

  return (
    <div className={cn('flex items-center gap-5', className)}>
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={`Menos um ${unidade}`} aria-controls={id}>
        <Minus aria-hidden className="size-6" strokeWidth={1.75} />
      </button>
      <div className="flex min-w-[5.5rem] flex-col items-center">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        <input
          id={id}
          type="text"
          inputMode="numeric"
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
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              onChange(clamp(value + 1))
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              onChange(clamp(value - 1))
            }
          }}
          aria-describedby={sufixo ? `${id}-suf` : undefined}
          className={cn(
            'w-[2.4ch] rounded-xl bg-transparent text-center text-6xl leading-none font-semibold tracking-tight text-ink tabular',
            texto.length > 2 && 'w-[3.4ch]',
          )}
        />
        {sufixo && (
          <span id={`${id}-suf`} className="mt-1.5 text-sm whitespace-nowrap text-ink-mute">
            {sufixo}
          </span>
        )}
      </div>
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={`Mais um ${unidade}`} aria-controls={id}>
        <Plus aria-hidden className="size-6" strokeWidth={1.75} />
      </button>
    </div>
  )
}
