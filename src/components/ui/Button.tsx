import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'subtle' | 'danger' | 'inverse' | 'glass'
export type ButtonSize = 'sm' | 'md' | 'lg'

// Pílulas ao estilo Apple: preto = ação principal, azul = acento, cinza claro = secundária.
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-ink text-white hover:bg-pine-600 active:bg-pine-500 disabled:bg-pine-300',
  accent: 'bg-terra-600 text-white hover:bg-terra-700 active:bg-terra-800 disabled:bg-terra-200',
  secondary:
    'bg-white text-ink ring-1 ring-inset ring-line-strong hover:bg-sand active:bg-sand-deep disabled:text-ink-mute',
  ghost: 'bg-transparent text-terra-600 hover:bg-terra-50 active:bg-terra-100 disabled:text-ink-mute',
  subtle: 'bg-sand text-ink hover:bg-sand-deep active:bg-line-strong disabled:text-ink-mute',
  danger: 'bg-white text-alert-700 ring-1 ring-inset ring-alert-600/40 hover:bg-alert-50',
  // para fundos pretos (blocos on-dark)
  inverse: 'bg-white text-ink hover:bg-sand active:bg-sand-deep disabled:text-ink-mute',
  glass: 'bg-white/12 text-white ring-1 ring-inset ring-white/20 backdrop-blur-md hover:bg-white/20 active:bg-white/25',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-4 text-sm gap-1.5',
  md: 'min-h-12 px-6 text-base gap-2',
  lg: 'min-h-14 px-8 text-lg gap-2.5',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center rounded-full font-medium leading-tight tracking-[-0.01em] whitespace-nowrap',
    'transition-[background-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(.25,.1,.25,1)] select-none active:scale-[0.98]',
    'disabled:cursor-not-allowed disabled:active:scale-100 [&_svg]:shrink-0 [&_svg]:size-[1.1em]',
    VARIANTS[variant],
    SIZES[size],
    extra,
  )
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  /** ícone à esquerda */
  icon?: ReactNode
  /** ícone à direita */
  iconRight?: ReactNode
  full?: boolean
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, icon, iconRight, full, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses(variant, size, cn(full && 'w-full', className))} {...rest}>
      {icon}
      {children}
      {iconRight}
    </button>
  )
})

export type ButtonLinkProps = CommonProps & LinkProps

/** Link do router com aparência de botão. */
export function ButtonLink({ variant, size, icon, iconRight, full, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={buttonClasses(variant, size, cn(full && 'w-full', className))} {...rest}>
      {icon}
      {children}
      {iconRight}
    </Link>
  )
}

/** Ligação de texto estilo Apple: azul com chevron — "Saber mais ›". Em fundos escuros use tone="light". */
export function TextLink({
  children,
  className,
  tone = 'blue',
  ...rest
}: LinkProps & { tone?: 'blue' | 'light' | 'ink' }) {
  return (
    <Link
      className={cn(
        'group inline-flex min-h-11 items-center gap-0.5 font-medium transition-colors',
        tone === 'blue' && 'text-terra-600 hover:text-terra-700',
        tone === 'light' && 'text-terra-300 hover:text-white',
        tone === 'ink' && 'text-ink hover:text-ink-soft',
        className,
      )}
      {...rest}
    >
      {children}
      <ChevronRight aria-hidden className="size-[1.05em] transition-transform duration-200 group-hover:translate-x-0.5" />
    </Link>
  )
}
