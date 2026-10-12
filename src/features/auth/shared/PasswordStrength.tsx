import { useMemo } from 'react'
import { cn } from '@/lib/cn'
import { avaliarPalavraPasse } from './passwordStrength'

const COR = ['bg-sand-deep', 'bg-alert-600', 'bg-sun-500', 'bg-leaf-500', 'bg-leaf-600'] as const
const TEXTO = ['text-ink-mute', 'text-alert-700', 'text-sun-800', 'text-leaf-700', 'text-leaf-700'] as const

/**
 * Barra fina de força (4 segmentos) + uma palavra; um conselho só quando há um problema concreto.
 * Os segmentos enchem-se da esquerda para a direita (escala, não largura) e a cor acompanha o nível.
 * O espaço está sempre reservado: aparecer/desaparecer não empurra o formulário.
 */
export function PasswordStrength({ password, pessoal }: { password: string; pessoal: string[] }) {
  const { nivel, rotulo, conselho } = useMemo(() => avaliarPalavraPasse(password, pessoal), [password, pessoal])

  return (
    <div className={cn('flex flex-col gap-1.5 transition-opacity duration-300', nivel === 0 && 'opacity-0')}>
      <div className="flex items-center gap-3">
        <div aria-hidden className="grid flex-1 grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((s) => (
            <span key={s} className="h-1 overflow-hidden rounded-full bg-sand-deep">
              <span
                style={{ transitionDelay: `${(s - 1) * 45}ms` }}
                className={cn(
                  'block h-full origin-left rounded-full',
                  'transition-[scale,background-color] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
                  s <= nivel ? 'scale-x-100' : 'scale-x-0',
                  COR[nivel],
                )}
              />
            </span>
          ))}
        </div>
        <p aria-live="polite" className={cn('min-w-24 text-right text-xs font-medium transition-colors duration-300', TEXTO[nivel])}>
          {rotulo && (
            <span key={rotulo} className="inline-block animate-[pop-in_.3s_cubic-bezier(.16,1,.3,1)_both] motion-reduce:animate-none">
              <span className="sr-only">Força da palavra-passe: </span>
              {rotulo}
            </span>
          )}
        </p>
      </div>
      {conselho && (
        <p key={conselho} className="animate-[pop-in_.3s_cubic-bezier(.16,1,.3,1)_both] text-xs text-ink-mute motion-reduce:animate-none">
          {conselho}
        </p>
      )}
    </div>
  )
}
