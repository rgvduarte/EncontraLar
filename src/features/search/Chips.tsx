import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Disponibilidade } from '@/types'
import { cn } from '@/lib/cn'

/** Pílula de filtro: cinza discreta; preta quando ativa ('aberta' = painel aberto). Alvo de 48px. */
export function pillClasses(active: boolean | 'aberta', extra?: string) {
  return cn(
    'inline-flex min-h-12 shrink-0 items-center gap-2 rounded-full text-sm font-medium whitespace-nowrap select-none',
    'transition-colors duration-200 ease-[cubic-bezier(.25,.1,.25,1)]',
    active === true ? 'bg-ink text-white hover:bg-pine-600' : active === 'aberta' ? 'bg-sand-deep text-ink' : 'bg-sand text-ink hover:bg-sand-deep',
    extra ?? 'px-4.5',
  )
}

type TogglePillProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> & { pressed: boolean }

/** Botão de alternância (aria-pressed) em forma de pílula. */
export const TogglePill = forwardRef<HTMLButtonElement, TogglePillProps>(function TogglePill({ pressed, className, children, ...rest }, ref) {
  return (
    <button ref={ref} type="button" aria-pressed={pressed} className={pillClasses(pressed, cn('px-4.5', className))} {...rest}>
      {children}
    </button>
  )
})

/**
 * Estado de vaga com forma própria (nunca só cor):
 * vaga agora = círculo cheio · em breve = meio cheio · lista de espera = anel.
 */
export function DispDot({ disp, className }: { disp: Disponibilidade; className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 12 12" className={cn('size-3 shrink-0', className)}>
      {disp === 'disponivel' && <circle cx="6" cy="6" r="5" className="fill-leaf-500" />}
      {disp === 'breve' && (
        <>
          <circle cx="6" cy="6" r="4.25" fill="none" strokeWidth="1.5" className="stroke-sun-500" />
          <path d="M6 1.75a4.25 4.25 0 0 1 0 8.5Z" className="fill-sun-500" />
        </>
      )}
      {disp === 'espera' && <circle cx="6" cy="6" r="4.25" fill="none" strokeWidth="1.5" className="stroke-dusk-500" />}
    </svg>
  )
}

/** Contador pequeno dentro de uma pílula ("Mais filtros 3"). */
export function Count({ n, onDark }: { n: number; onDark?: boolean }) {
  if (n <= 0) return null
  return (
    <span
      className={cn(
        'inline-flex min-w-5.5 items-center justify-center rounded-full px-1.5 text-xs leading-5.5 font-semibold tabular',
        onDark ? 'bg-white text-ink' : 'bg-ink text-white',
      )}
    >
      {n}
    </span>
  )
}

type QuietSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> & {
  /** etiqueta visível antes do valor (ex.: "Ordenar") */
  label: ReactNode
  /** dentro de uma superfície cinza (hover a branco) */
  onSand?: boolean
  wrapperClassName?: string
}

/** <select> nativo sem caixa: "Ordenar  Relevância ⌄". */
export function QuietSelect({ label, onSand, wrapperClassName, className, children, ...rest }: QuietSelectProps) {
  const id = useId()
  return (
    <div className={cn('relative inline-flex min-h-12 shrink-0 items-center rounded-full transition-colors', onSand ? 'hover:bg-white' : 'hover:bg-sand', wrapperClassName)}>
      <label htmlFor={id} className="shrink-0 pl-3 text-sm text-ink-mute">
        {label}
      </label>
      <select
        id={id}
        className={cn(
          'min-h-12 cursor-pointer appearance-none rounded-full bg-transparent py-2 pr-9 pl-1.5 text-sm font-medium text-ink [field-sizing:content] focus:outline-none',
          'focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500',
          className,
        )}
        {...rest}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink-mute" />
    </div>
  )
}
