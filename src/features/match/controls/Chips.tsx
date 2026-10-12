import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Pílula estilo Apple: cinza claro quando livre, preta quando escolhida. Alvo ≥ 48px. */
const chipBase =
  'inline-flex min-h-12 items-center gap-2 rounded-full px-5 text-base font-medium transition-colors duration-200 ease-[cubic-bezier(.25,.1,.25,1)] [&_svg]:size-[1.05em] [&_svg]:shrink-0'
const OFF = 'bg-sand text-ink hover:bg-sand-deep'
const ON = 'bg-ink text-white'

export interface ChipOption<T extends string> {
  value: T
  label: ReactNode
}

/** Grupo de rádios com aspeto de pílulas (as setas do teclado mudam a escolha, como num rádio nativo). */
export function RadioChips<T extends string>({
  name,
  legend,
  optional,
  error,
  value,
  onChange,
  options,
  className,
}: {
  name: string
  legend: ReactNode
  optional?: boolean
  error?: string
  value: T | ''
  onChange: (v: T) => void
  options: ChipOption<T>[]
  className?: string
}) {
  const errId = error ? `${name}-err` : undefined
  return (
    <fieldset className={cn('flex flex-col', className)} aria-describedby={errId}>
      <legend className="mb-3 text-base font-medium text-ink">
        {legend}
        {optional && <span className="ml-2 text-sm font-normal text-ink-mute">(opcional)</span>}
      </legend>
      <div className="flex flex-wrap gap-2">
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
                'pointer-events-none',
                value === o.value ? ON : 'bg-sand text-ink peer-hover:bg-sand-deep',
                'peer-focus-visible:outline-3 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-terra-500',
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p id={errId} role="alert" className="mt-3 text-sm font-medium text-alert-700">
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
  children,
  disabled,
  className,
}: {
  pressed: boolean
  onToggle: () => void
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
      className={cn(chipBase, pressed ? ON : cn(OFF, 'disabled:bg-sand/60 disabled:text-ink-mute disabled:hover:bg-sand/60'), className)}
    >
      {pressed && <Check aria-hidden strokeWidth={2.5} />}
      {children}
    </button>
  )
}
