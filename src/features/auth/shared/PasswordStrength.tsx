import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import { avaliarPalavraPasse } from './passwordStrength'

const COR = ['bg-sand-deep', 'bg-alert-600', 'bg-sun-500', 'bg-leaf-500', 'bg-leaf-600'] as const
const TEXTO = ['text-ink-mute', 'text-alert-700', 'text-sun-800', 'text-leaf-700', 'text-leaf-700'] as const

/** Barra fina de força (4 segmentos) + uma palavra; um conselho só quando há um problema concreto. */
export function PasswordStrength({ password, pessoal }: { password: string; pessoal: string[] }) {
  const { nivel, rotulo, conselho } = useMemo(() => avaliarPalavraPasse(password, pessoal), [password, pessoal])

  return (
    <div className={cn('flex flex-col gap-1.5 transition-opacity duration-300', nivel === 0 && 'opacity-0')}>
      <div className="flex items-center gap-3">
        <div aria-hidden className="grid flex-1 grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((s) => (
            <span key={s} className={cn('h-1 rounded-full transition-colors duration-300', s <= nivel ? COR[nivel] : 'bg-sand-deep')} />
          ))}
        </div>
        <p aria-live="polite" className={cn('min-w-24 text-right text-xs font-medium', TEXTO[nivel])}>
          {rotulo && (
            <>
              <span className="sr-only">Força da palavra-passe: </span>
              {rotulo}
            </>
          )}
        </p>
      </div>
      {conselho && <p className="text-xs text-ink-mute">{conselho}</p>}
    </div>
  )
}
