import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

const controlBase =
  'w-full rounded-2xl border border-line-strong bg-white px-4 text-base text-ink placeholder:text-ink-mute ' +
  'transition-[border-color,box-shadow] hover:border-pine-400 focus:border-terra-500 focus:ring-4 focus:ring-terra-100 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:bg-sand aria-[invalid=true]:border-alert-600 aria-[invalid=true]:ring-alert-50'

interface FieldShellProps {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  className?: string
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => ReactNode
}

/** Estrutura acessível: etiqueta + controlo + ajuda + erro (ligados por aria-describedby). */
export function FieldShell({ label, hint, error, optional, className, children }: FieldShellProps) {
  const id = useId()
  const hintId = hint ? `${id}-hint` : undefined
  const errId = error ? `${id}-err` : undefined
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={id} className="text-base font-medium text-ink">
        {label}
        {optional && <span className="ml-2 text-sm font-normal text-ink-mute">(opcional)</span>}
      </label>
      {hint && (
        <p id={hintId} className="-mt-1 text-sm text-ink-soft">
          {hint}
        </p>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error && (
        <p id={errId} role="alert" className="text-sm font-medium text-alert-700">
          {error}
        </p>
      )}
    </div>
  )
}

type InputFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  wrapperClassName?: string
  leading?: ReactNode
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(function InputField(
  { label, hint, error, optional, wrapperClassName, leading, className, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          {leading && (
            <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-mute [&_svg]:size-5">
              {leading}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(controlBase, 'min-h-13 py-3', leading && 'pl-12', className)}
            {...rest}
          />
        </div>
      )}
    </FieldShell>
  )
})

type SelectFieldProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  wrapperClassName?: string
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, hint, error, optional, wrapperClassName, className, children, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <div className="relative">
          <select
            ref={ref}
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            className={cn(controlBase, 'min-h-13 appearance-none py-3 pr-12', className)}
            {...rest}
          >
            {children}
          </select>
          <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-4 size-5 -translate-y-1/2 text-ink-soft" />
        </div>
      )}
    </FieldShell>
  )
})

type TextareaFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  optional?: boolean
  wrapperClassName?: string
}

export const TextareaField = forwardRef<HTMLTextAreaElement, TextareaFieldProps>(function TextareaField(
  { label, hint, error, optional, wrapperClassName, className, rows = 4, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} hint={hint} error={error} optional={optional} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          className={cn(controlBase, 'py-3 leading-relaxed', className)}
          {...rest}
        />
      )}
    </FieldShell>
  )
})

/** Caixa de seleção grande (alvo ≥ 48px). */
export function Checkbox({
  label,
  description,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: ReactNode; description?: ReactNode }) {
  return (
    <label className={cn('group flex min-h-12 cursor-pointer items-start gap-3 rounded-xl py-2', className)}>
      <span className="relative mt-0.5 flex size-7 shrink-0 items-center justify-center">
        <input type="checkbox" className="peer absolute inset-0 cursor-pointer appearance-none rounded-[8px] border-[1.5px] border-line-strong bg-white transition-colors checked:border-terra-600 checked:bg-terra-600 group-hover:border-pine-400 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500" {...rest} />
        <Check aria-hidden strokeWidth={3} className="pointer-events-none relative size-4.5 text-white opacity-0 peer-checked:opacity-100" />
      </span>
      <span className="flex flex-col">
        <span className="text-base leading-snug font-medium text-ink">{label}</span>
        {description && <span className="text-sm text-ink-soft">{description}</span>}
      </span>
    </label>
  )
}

/** Cartão selecionável (rádio ou checkbox) — usado em questionários. */
export function ChoiceCard({
  type = 'radio',
  label,
  description,
  icon,
  className,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  type?: 'radio' | 'checkbox'
  label: ReactNode
  description?: ReactNode
  icon?: ReactNode
}) {
  return (
    <label
      className={cn(
        'group relative flex min-h-16 cursor-pointer items-start gap-4 rounded-[1.25rem] border border-line-strong bg-white p-5 transition-all duration-200',
        'hover:border-pine-400 has-[:checked]:border-terra-600 has-[:checked]:bg-terra-50/60 has-[:checked]:ring-1 has-[:checked]:ring-terra-600 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
        className,
      )}
    >
      <input type={type} className="peer sr-only" {...rest} />
      {icon && (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-sand text-ink group-has-[:checked]:bg-terra-600 group-has-[:checked]:text-white [&_svg]:size-5.5">
          {icon}
        </span>
      )}
      <span className="flex flex-1 flex-col gap-0.5 pr-8">
        <span className="text-base leading-snug font-semibold text-ink">{label}</span>
        {description && <span className="text-sm text-ink-soft">{description}</span>}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute top-5 right-5 flex size-6 items-center justify-center border-[1.5px] border-line-strong bg-white text-white transition-colors',
          'peer-checked:border-terra-600 peer-checked:bg-terra-600',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
        )}
      >
        <Check strokeWidth={3} className="size-3.5" />
      </span>
    </label>
  )
}

/** Interruptor on/off acessível (role="switch"). */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex min-h-12 items-center justify-between gap-4', className)}>
      <label htmlFor={id} className="flex cursor-pointer flex-col">
        <span className="text-base font-medium text-ink">{label}</span>
        {description && <span className="text-sm text-ink-soft">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-[31px] w-[51px] shrink-0 items-center rounded-full p-[2px] transition-colors duration-200 disabled:opacity-50',
          checked ? 'bg-leaf-500' : 'bg-sand-deep',
        )}
      >
        <span className={cn('inline-block size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform duration-200', checked ? 'translate-x-5' : 'translate-x-0')} />
      </button>
    </div>
  )
}
