import { useMemo } from 'react'
import { Check, Circle } from 'lucide-react'
import { avaliarPalavraPasse } from './passwordStrength'
import { cn } from '@/lib/cn'

const COR_NIVEL = ['bg-sand-deep', 'bg-alert-600', 'bg-sun-500', 'bg-pine-500', 'bg-leaf-600'] as const
const TEXTO_NIVEL = ['text-ink-mute', 'text-alert-700', 'text-sun-800', 'text-pine-700', 'text-leaf-700'] as const

/** Medidor de força (4 segmentos + palavra) e lista de requisitos, atualizados enquanto escreve. */
export function PasswordStrength({ password, pessoal, id }: { password: string; pessoal: string[]; id?: string }) {
  const forca = useMemo(() => avaliarPalavraPasse(password, pessoal), [password, pessoal])
  const { nivel } = forca

  return (
    <div id={id} className="flex flex-col gap-3 rounded-2xl border border-line bg-sand/50 p-4">
      <div className="flex items-center gap-3">
        <div aria-hidden className="grid flex-1 grid-cols-4 gap-1.5">
          {[1, 2, 3, 4].map((s) => (
            <span
              key={s}
              className={cn('h-2 rounded-full transition-colors duration-300', s <= nivel ? COR_NIVEL[nivel] : 'bg-sand-deep')}
            />
          ))}
        </div>
        <p className={cn('min-w-28 text-right text-sm font-bold', TEXTO_NIVEL[nivel])} aria-live="polite">
          {nivel === 0 ? <span className="font-normal text-ink-mute">Força: —</span> : <>Força: {forca.rotulo.toLowerCase()}</>}
        </p>
      </div>
      <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2" aria-label="Requisitos da palavra-passe">
        {forca.requisitos.map((r) => (
          <li key={r.id} className={cn('flex items-start gap-2 text-sm', r.cumprido ? 'text-ink' : 'text-ink-soft')}>
            {r.cumprido ? (
              <Check aria-hidden strokeWidth={3} className="mt-0.5 size-4.5 shrink-0 text-leaf-600" />
            ) : (
              <Circle aria-hidden strokeWidth={2} className="mt-0.5 size-4.5 shrink-0 text-line-strong" />
            )}
            <span>
              {r.texto}
              {r.obrigatorio && <span className="text-ink-mute"> (obrigatório)</span>}
              <span className="sr-only">{r.cumprido ? ' — cumprido' : ' — por cumprir'}</span>
            </span>
          </li>
        ))}
      </ul>
      {forca.conselho && <p className="text-sm text-ink-soft">{forca.conselho}</p>}
    </div>
  )
}
