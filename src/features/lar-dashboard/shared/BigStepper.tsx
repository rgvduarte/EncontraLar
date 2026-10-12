import { useEffect, useId, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Contador grande "−  12  +" para quem tem pouco tempo: alvos de 64px, número legível de longe,
 * e campo editável para quem prefere escrever o valor.
 */
export function BigStepper({
  value,
  min = 0,
  max,
  onChange,
  label,
  unidade,
  sufixo,
  size = 'lg',
  tone = 'pine',
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
  /** texto sob o número, ex.: "de 20 livres" */
  sufixo?: string
  size?: 'md' | 'lg'
  tone?: 'pine' | 'light'
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

  const btn = cn(
    'flex shrink-0 items-center justify-center rounded-2xl border-2 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100',
    size === 'lg' ? 'size-16' : 'size-13',
    tone === 'pine'
      ? 'border-line-strong bg-white text-pine-800 hover:border-pine-600 hover:bg-pine-50'
      : 'border-white/25 bg-white/10 text-white hover:border-white/60 hover:bg-white/15',
  )

  return (
    <div className={cn('flex items-center gap-3 sm:gap-4', className)}>
      <button type="button" className={btn} onClick={() => onChange(clamp(value - 1))} disabled={value <= min} aria-label={`Menos um ${unidade}`} aria-controls={id}>
        <Minus aria-hidden className={size === 'lg' ? 'size-7' : 'size-6'} strokeWidth={2.5} />
      </button>
      <div className="flex min-w-0 flex-col items-center">
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
            'w-[3ch] rounded-xl bg-transparent text-center font-display leading-none font-semibold tabular outline-offset-4',
            size === 'lg' ? 'text-6xl' : 'text-5xl',
            texto.length > 2 && 'w-[4ch]',
            tone === 'pine' ? 'text-ink' : 'text-white',
          )}
        />
        {sufixo && (
          <span id={`${id}-suf`} className={cn('mt-1 text-sm font-semibold whitespace-nowrap', tone === 'pine' ? 'text-ink-soft' : 'text-pine-200')}>
            {sufixo}
          </span>
        )}
      </div>
      <button type="button" className={btn} onClick={() => onChange(clamp(value + 1))} disabled={value >= max} aria-label={`Mais um ${unidade}`} aria-controls={id}>
        <Plus aria-hidden className={size === 'lg' ? 'size-7' : 'size-6'} strokeWidth={2.5} />
      </button>
    </div>
  )
}
