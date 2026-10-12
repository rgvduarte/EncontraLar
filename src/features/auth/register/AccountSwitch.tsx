import type { Role } from '@/types'
import { cn } from '@/lib/cn'

const OPCOES: { value: Role; label: string }[] = [
  { value: 'familia', label: 'Família' },
  { value: 'lar', label: 'Instituição' },
]

/**
 * Controlo segmentado "Família | Instituição" (rádios nativos: setas para mudar, foco visível).
 * A pílula branca desliza para a opção escolhida.
 */
export function AccountSwitch({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Tipo de conta</legend>
      <div className="relative grid grid-cols-2 rounded-full bg-sand p-1">
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-soft',
            'transition-transform duration-300 ease-[cubic-bezier(.25,.1,.25,1)] motion-reduce:transition-none',
            value === 'lar' && 'translate-x-full',
          )}
        />
        {OPCOES.map((o) => (
          <label
            key={o.value}
            className={cn(
              'relative flex min-h-12 cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium transition-colors duration-200',
              'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
              value === o.value ? 'text-ink' : 'text-ink-mute hover:text-ink',
            )}
          >
            <input
              type="radio"
              name="tipo-conta"
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="sr-only"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
