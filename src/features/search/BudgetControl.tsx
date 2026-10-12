import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { ChevronDown, Wallet } from 'lucide-react'
import { euro } from '@/lib/format'
import { useDebounced, useDismiss } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { chipClasses } from './Chips'

export const TETO = 5000
const PISO = 300
const PASSO = 50
const PRESETS = [800, 1200, 1800, 2500]
const BIN = 250

interface SliderProps {
  value: number | null
  onChange: (v: number | null) => void
  /** mensalidades mínimas das instituições na zona (para o histograma) */
  precos: number[]
  className?: string
}

/** Orçamento: histograma real dos preços na zona + régua + atalhos. */
export function BudgetSlider({ value, onChange, precos, className }: SliderProps) {
  const id = useId()
  const v = value ?? TETO
  const bins = useMemo(() => {
    const n = Math.ceil(TETO / BIN)
    const arr = Array.from({ length: n }, () => 0)
    for (const p of precos) arr[Math.min(n - 1, Math.floor(p / BIN))]!++
    return arr
  }, [precos])
  const maxBin = Math.max(1, ...bins)
  const dentro = precos.filter((p) => p <= v).length
  const pctPos = ((v - PISO) / (TETO - PISO)) * 100

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <label htmlFor={id} className="text-sm font-bold text-ink">
            Mensalidade máxima
          </label>
          <p className="font-display text-4xl leading-none font-semibold text-ink tabular" aria-hidden>
            {value == null ? 'Sem limite' : euro(v)}
          </p>
        </div>
        <p className="pb-1 text-right text-sm text-ink-soft tabular">
          <strong className="text-ink">{dentro}</strong> de {precos.length}
          <br />
          na zona
        </p>
      </div>

      <div>
        <div aria-hidden className="flex h-14 items-end gap-[2px]">
          {bins.map((b, i) => (
            <span
              key={i}
              className={cn('flex-1 rounded-t-[3px] transition-colors', i * BIN < v ? 'bg-pine-600' : 'bg-sand-deep')}
              style={{ height: `${b ? Math.max(8, (b / maxBin) * 100) : 0}%` }}
            />
          ))}
        </div>
        <div className="relative -mt-1">
          <input
            id={id}
            type="range"
            min={PISO}
            max={TETO}
            step={PASSO}
            value={v}
            onChange={(e) => {
              const n = Number(e.target.value)
              onChange(n >= TETO ? null : n)
            }}
            aria-valuetext={value == null ? 'Sem limite' : `Até ${euro(v)} por mês`}
            className="budget-range w-full"
            style={{ ['--pct' as string]: `${pctPos}%` }}
          />
        </div>
        <div aria-hidden className="mt-1 flex justify-between text-xs text-ink-mute tabular">
          <span>{euro(PISO)}</span>
          <span>{euro(TETO)}+</span>
        </div>
      </div>

      <div role="group" aria-label="Valores rápidos" className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            className={chipClasses(value === p, 'min-h-11 px-3.5 tabular')}
          >
            {euro(p)}
          </button>
        ))}
        <button type="button" aria-pressed={value == null} onClick={() => onChange(null)} className={chipClasses(value == null, 'min-h-11 px-3.5')}>
          Sem limite
        </button>
      </div>

      <p className="rounded-xl bg-sand/70 px-3 py-2.5 text-sm text-ink-soft">
        Nas IPSS e Misericórdias a mensalidade depende dos rendimentos. Contamos o valor mais baixo indicado pela instituição.
      </p>
    </div>
  )
}

/** Pílula "Até X €" que abre um pequeno painel com o BudgetSlider. */
export function BudgetChip({ value, onChange, precos }: { value: number | null; onChange: (v: number | null) => void; precos: number[] }) {
  const [open, setOpen] = useState(false)
  const [local, setLocal] = useState(value)
  const tocado = useRef(false)
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => setLocal(value), [value])
  const deb = useDebounced(local, 280)
  useEffect(() => {
    if (!tocado.current) return
    tocado.current = false
    onChange(deb)
    // só reage ao valor estabilizado (onChange muda a cada render do pai)
  }, [deb]) // eslint-disable-line react-hooks/exhaustive-deps

  const close = useCallback(() => {
    setOpen(false)
    btnRef.current?.focus()
  }, [])
  useDismiss(open, ref, close)

  useEffect(() => {
    if (open) ref.current?.querySelector<HTMLInputElement>('input[type=range]')?.focus()
  }, [open])

  const ativo = value != null
  return (
    <div ref={ref} className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={chipClasses(ativo, 'tabular')}
      >
        <Wallet aria-hidden />
        {ativo ? `Até ${euro(value)}` : 'Orçamento'}
        <ChevronDown aria-hidden className={cn('transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Mensalidade máxima"
          className="absolute top-full left-0 z-50 mt-2 w-[24rem] animate-fade-up rounded-3xl border border-line bg-white p-5 shadow-lift"
        >
          <BudgetSlider
            value={local}
            onChange={(v) => {
              tocado.current = true
              setLocal(v)
            }}
            precos={precos}
          />
          <div className="mt-4 flex justify-end border-t border-line pt-4">
            <button type="button" onClick={close} className="link min-h-11 px-2 text-sm">
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
