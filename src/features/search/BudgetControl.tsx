import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { euro } from '@/lib/format'
import { useDebounced } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { pillClasses } from './Chips'
import { PillPopover } from './PillPopover'

export const TETO = 5000
const PISO = 300
const PASSO = 50
const PRESETS = [800, 1200, 1800, 2500]
const BIN = 250

interface SliderProps {
  value: number | null
  onChange: (v: number | null) => void
  /** mensalidades mínimas das instituições na zona (histograma real) */
  precos: number[]
  className?: string
}

/** Orçamento: histograma dos preços na zona + régua + atalhos. */
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
  const pct = ((v - PISO) / (TETO - PISO)) * 100

  return (
    <div className={cn('flex flex-col gap-5', className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <label htmlFor={id} className="text-sm text-ink-mute">
            Mensalidade máxima
          </label>
          <p aria-hidden className="mt-0.5 text-3xl leading-none font-semibold tracking-tight text-ink tabular">
            {value == null ? 'Sem limite' : euro(v)}
          </p>
        </div>
        <p className="text-right text-sm text-ink-mute tabular">
          {dentro} de {precos.length}
          <br />
          nesta zona
        </p>
      </div>

      <div>
        <div aria-hidden className="flex h-12 items-end gap-[2px]">
          {bins.map((b, i) => (
            <span
              key={i}
              className={cn('flex-1 rounded-t-[2px] transition-colors duration-200', i * BIN < v ? 'bg-ink' : 'bg-sand-deep')}
              style={{ height: `${b ? Math.max(6, (b / maxBin) * 100) : 0}%` }}
            />
          ))}
        </div>
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
          className="el-range -mt-1 w-full"
          style={{ ['--pct' as string]: `${pct}%` }}
        />
      </div>

      <div role="group" aria-label="Valores rápidos" className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p} type="button" aria-pressed={value === p} onClick={() => onChange(p)} className={pillClasses(value === p, 'px-4 tabular')}>
            {euro(p)}
          </button>
        ))}
        <button type="button" aria-pressed={value == null} onClick={() => onChange(null)} className={pillClasses(value == null, 'px-4')}>
          Sem limite
        </button>
      </div>

      <p className="text-sm text-ink-mute">Nas IPSS e Misericórdias conta o valor mais baixo; o final depende dos rendimentos.</p>
    </div>
  )
}

/** Pílula "Orçamento" / "Até 1200 €" com o BudgetSlider num painel. Aplica após uma pausa curta. */
export function BudgetPill({ value, onChange, precos }: { value: number | null; onChange: (v: number | null) => void; precos: number[] }) {
  const [local, setLocal] = useState(value)
  const tocado = useRef(false)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => setLocal(value), [value])
  const deb = useDebounced(local, 280)
  useEffect(() => {
    if (!tocado.current) return
    tocado.current = false
    onChangeRef.current(deb)
  }, [deb])

  return (
    <PillPopover
      active={value != null}
      label={<span className="tabular">{value != null ? `Até ${euro(value)}` : 'Orçamento'}</span>}
      panelLabel="Mensalidade máxima"
      panelClassName="w-[24rem]"
      onClose={() => {
        // aplicar já o que estiver pendente
        if (tocado.current) {
          tocado.current = false
          onChangeRef.current(local)
        }
      }}
    >
      <BudgetSlider
        value={local}
        onChange={(v) => {
          tocado.current = true
          setLocal(v)
        }}
        precos={precos}
      />
    </PillPopover>
  )
}
