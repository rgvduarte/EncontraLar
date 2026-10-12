import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/cn'

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'subtle' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-pine-700 text-white shadow-soft hover:bg-pine-800 active:bg-pine-900 disabled:bg-pine-300',
  accent:
    'bg-terra-600 text-white shadow-soft hover:bg-terra-700 active:bg-terra-800 disabled:bg-terra-200',
  secondary:
    'bg-white text-ink border-2 border-line-strong hover:border-pine-600 hover:text-pine-800 active:bg-pine-50 disabled:text-ink-mute',
  ghost: 'bg-transparent text-pine-800 hover:bg-pine-50 active:bg-pine-100 disabled:text-ink-mute',
  subtle: 'bg-pine-50 text-pine-800 hover:bg-pine-100 active:bg-pine-200 disabled:text-ink-mute',
  danger: 'bg-white text-alert-700 border-2 border-alert-600/40 hover:bg-alert-50 hover:border-alert-600',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-10 px-4 text-sm gap-2 rounded-xl',
  md: 'min-h-12 px-5 text-base gap-2.5 rounded-2xl',
  lg: 'min-h-14 px-7 text-lg gap-3 rounded-2xl',
}

export function buttonClasses(variant: ButtonVariant = 'primary', size: ButtonSize = 'md', extra?: string) {
  return cn(
    'inline-flex items-center justify-center font-bold leading-tight whitespace-nowrap transition-colors duration-150 select-none',
    'disabled:cursor-not-allowed [&_svg]:shrink-0',
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
