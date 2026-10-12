import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { Disponibilidade } from '@/types'
import { cn } from '@/lib/cn'

const chipBase =
  'inline-flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-sm font-bold whitespace-nowrap transition-colors select-none [&_svg]:size-4.5 [&_svg]:shrink-0'

export function chipClasses(active: boolean, extra?: string) {
  return cn(
    chipBase,
    active
      ? 'border-pine-800 bg-pine-800 text-white shadow-soft hover:bg-pine-900'
      : 'border-line-strong bg-white text-ink hover:border-pine-500 hover:text-pine-800',
    extra,
  )
}

type ToggleChipProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & {
  pressed: boolean
  icon?: ReactNode
  /** mostra um visto quando ativo (por defeito: sim, se não houver ícone) */
  check?: boolean
}

/** Botão de alternância (aria-pressed) em forma de pílula. */
export const ToggleChip = forwardRef<HTMLButtonElement, ToggleChipProps>(function ToggleChip(
  { pressed, icon, check, className, children, ...rest },
  ref,
) {
  const showCheck = check ?? !icon
  return (
    <button ref={ref} type="button" aria-pressed={pressed} className={chipClasses(pressed, className)} {...rest}>
      {pressed && showCheck ? <Check aria-hidden strokeWidth={3} /> : icon}
      {children}
    </button>
  )
})

/**
 * Símbolo de disponibilidade com forma própria (não depende só da cor):
 * disponível = círculo cheio a pulsar · em breve = meio cheio · lista de espera = anel.
 */
export function DispGlyph({ disp, className, onDark }: { disp: Disponibilidade; className?: string; onDark?: boolean }) {
  const cor = disp === 'disponivel' ? '#2f8c4b' : disp === 'breve' ? '#b06f0b' : '#575176'
  const fill = onDark ? '#ffffff' : cor
  return (
    <span aria-hidden className={cn('relative inline-flex size-4 shrink-0 items-center justify-center', className)}>
      {disp === 'disponivel' && (
        <span className="absolute inset-0 animate-ping rounded-full opacity-40 motion-reduce:hidden" style={{ background: fill }} />
      )}
      <svg viewBox="0 0 16 16" className="relative size-4">
        {disp === 'disponivel' && <circle cx="8" cy="8" r="6" fill={fill} />}
        {disp === 'breve' && (
          <>
            <circle cx="8" cy="8" r="5.2" fill="none" stroke={fill} strokeWidth="1.8" />
            <path d="M8 2.8a5.2 5.2 0 0 1 0 10.4Z" fill={fill} />
          </>
        )}
        {disp === 'espera' && <circle cx="8" cy="8" r="5.2" fill="none" stroke={fill} strokeWidth="1.8" />}
      </svg>
    </span>
  )
}

type PillSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  /** etiqueta visível dentro da pílula (ex.: "Raio") */
  label: string
  icon?: ReactNode
  wrapperClassName?: string
}

/** <select> nativo com etiqueta visível, no formato pílula dos filtros. */
export function PillSelect({ label, icon, wrapperClassName, className, children, ...rest }: PillSelectProps) {
  const id = useId()
  return (
    <div
      className={cn(
        'relative inline-flex min-h-12 items-center rounded-full border-2 border-line-strong bg-white transition-colors focus-within:border-pine-600 hover:border-pine-500',
        wrapperClassName,
      )}
    >
      <label htmlFor={id} className="flex shrink-0 items-center gap-2 pl-4 text-sm font-semibold text-ink-soft [&_svg]:size-4.5 [&_svg]:text-pine-700">
        {icon}
        {label}
      </label>
      <select
        id={id}
        className={cn(
          'min-h-11 cursor-pointer appearance-none rounded-full bg-transparent py-2 pr-10 pl-2 text-sm font-bold text-ink focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2 text-ink-soft" />
    </div>
  )
}

/** Contador redondo para botões ("Mais filtros 3"). */
export function CountBadge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null
  return (
    <span className={cn('inline-flex min-w-6 items-center justify-center rounded-full bg-terra-600 px-1.5 text-xs leading-6 font-bold text-white tabular', className)}>
      {n}
    </span>
  )
}
