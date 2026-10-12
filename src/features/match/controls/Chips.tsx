import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

const chipBase =
  'inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-5 text-base font-bold transition-colors [&_svg]:size-5 [&_svg]:shrink-0'

export interface ChipOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

/** Grupo de rádios com aspeto de "pílulas" (setas do teclado mudam a escolha, como num rádio nativo). */
export function RadioChips<T extends string>({
  name,
  legend,
  hint,
  error,
  value,
  onChange,
  options,
  className,
}: {
  name: string
  legend: ReactNode
  hint?: ReactNode
  error?: string
  value: T | ''
  onChange: (v: T) => void
  options: ChipOption<T>[]
  className?: string
}) {
  const hintId = hint ? `${name}-hint` : undefined
  const errId = error ? `${name}-err` : undefined
  return (
    <fieldset className={cn('flex flex-col gap-3', className)} aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}>
      <legend className="mb-3 text-lg font-bold text-ink">{legend}</legend>
      {hint && (
        <p id={hintId} className="-mt-2 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        {options.map((o) => (
          <label key={o.value} className="relative">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              aria-invalid={error ? true : undefined}
              className="peer absolute inset-0 cursor-pointer appearance-none rounded-full focus-visible:outline-none"
            />
            <span
              className={cn(
                chipBase,
                'pointer-events-none border-line-strong bg-white text-ink',
                'peer-hover:border-pine-500 peer-checked:border-pine-700 peer-checked:bg-pine-700 peer-checked:text-white',
                'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-terra-500',
              )}
            >
              {o.icon}
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errId} role="alert" className="text-sm font-bold text-alert-700">
          {error}
        </p>
      )}
    </fieldset>
  )
}

/** Pílula que liga/desliga (aria-pressed). */
export function ToggleChip({
  pressed,
  onToggle,
  icon,
  children,
  disabled,
  className,
}: {
  pressed: boolean
  onToggle: () => void
  icon?: ReactNode
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        chipBase,
        pressed
          ? 'border-pine-700 bg-pine-700 text-white'
          : 'border-line-strong bg-white text-ink hover:border-pine-500 disabled:border-line disabled:bg-sand/60 disabled:text-ink-mute',
        className,
      )}
    >
      {pressed ? <Check aria-hidden strokeWidth={3} /> : icon}
      {children}
    </button>
  )
}
