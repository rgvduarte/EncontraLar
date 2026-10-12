import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowBigUpDash, Eye, EyeOff, KeyRound } from 'lucide-react'
import { FieldShell } from '@/components/ui/Field'
import { cn } from '@/lib/cn'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  wrapperClassName?: string
}

/**
 * Campo de palavra-passe com botão "Mostrar/Ocultar" (com texto, não só ícone)
 * e aviso quando as maiúsculas (Caps Lock) estão ativas.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, hint, error, wrapperClassName, className, onKeyDown, onKeyUp, onBlur, ...rest },
  ref,
) {
  const [visivel, setVisivel] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const verCaps = (e: KeyboardEvent<HTMLInputElement>) => {
    if (typeof e.getModifierState === 'function') setCapsLock(e.getModifierState('CapsLock'))
  }

  return (
    <FieldShell label={label} hint={hint} error={error} className={wrapperClassName}>
      {({ id, describedBy, invalid }) => (
        <>
          <div className="relative">
            <KeyRound aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-mute" />
            <input
              ref={ref}
              id={id}
              type={visivel ? 'text' : 'password'}
              aria-describedby={[describedBy, capsLock ? `${id}-caps` : undefined].filter(Boolean).join(' ') || undefined}
              aria-invalid={invalid || undefined}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={(e) => {
                verCaps(e)
                onKeyDown?.(e)
              }}
              onKeyUp={(e) => {
                verCaps(e)
                onKeyUp?.(e)
              }}
              onBlur={(e) => {
                setCapsLock(false)
                onBlur?.(e)
              }}
              className={cn(
                'min-h-13 w-full rounded-2xl border-2 border-line-strong bg-white py-3 pr-32 pl-12 text-base text-ink placeholder:text-ink-mute/80',
                'transition-colors hover:border-pine-400 focus:border-pine-600 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500',
                'aria-[invalid=true]:border-alert-600',
                !visivel && 'tracking-wider',
                className,
              )}
              {...rest}
            />
            <button
              type="button"
              onClick={() => setVisivel((v) => !v)}
              aria-pressed={visivel}
              aria-controls={id}
              className="absolute top-1/2 right-1 flex h-12 -translate-y-1/2 items-center gap-2 rounded-xl px-3.5 text-sm font-bold text-pine-800 transition-colors hover:bg-pine-50"
            >
              {visivel ? <EyeOff aria-hidden className="size-5" /> : <Eye aria-hidden className="size-5" />}
              {visivel ? 'Ocultar' : 'Mostrar'}
              <span className="sr-only"> palavra-passe</span>
            </button>
          </div>
          <p id={`${id}-caps`} aria-live="polite" className={cn('text-sm font-semibold text-sun-800', !capsLock && 'sr-only')}>
            {capsLock && (
              <span className="inline-flex items-center gap-1.5">
                <ArrowBigUpDash aria-hidden className="size-4.5" />
                As maiúsculas estão ativas (Caps Lock).
              </span>
            )}
          </p>
        </>
      )}
    </FieldShell>
  )
})
