import { forwardRef, useState, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react'
import { FieldShell } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { controlClass } from './control'

type PasswordFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> & {
  label: ReactNode
  hint?: ReactNode
  error?: ReactNode
  /** conteúdo por baixo do campo (ex.: medidor de força) */
  below?: ReactNode
  wrapperClassName?: string
}

/**
 * Campo de palavra-passe com botão de texto "Mostrar/Ocultar"
 * e aviso quando as maiúsculas (Caps Lock) estão ativas.
 */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, hint, error, below, wrapperClassName, className, onKeyDown, onKeyUp, onBlur, ...rest },
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
              className={cn(controlClass, 'pr-28', className)}
              {...rest}
            />
            <button
              type="button"
              onClick={() => setVisivel((v) => !v)}
              aria-controls={id}
              className="absolute top-1/2 right-0.5 flex h-12 -translate-y-1/2 items-center rounded-[0.875rem] px-4 text-sm font-medium text-terra-600 transition-colors hover:bg-terra-50"
            >
              {visivel ? 'Ocultar' : 'Mostrar'}
              <span className="sr-only"> palavra-passe</span>
            </button>
          </div>
          <p id={`${id}-caps`} aria-live="polite" className={cn('text-sm text-sun-800', !capsLock && 'sr-only')}>
            {capsLock ? 'As maiúsculas estão ativas.' : ''}
          </p>
          {below}
        </>
      )}
    </FieldShell>
  )
})
