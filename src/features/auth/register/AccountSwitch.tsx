import type { Role } from '@/types'
import { cn } from '@/lib/cn'

const OPCOES: { value: Role; label: string }[] = [
  { value: 'familia', label: 'Família' },
  { value: 'lar', label: 'Instituição' },
]

/**
 * Controlo segmentado "Família | Instituição" (rádios nativos: setas para mudar, foco visível).
 * Como no iOS: a pílula branca desliza com uma curva de mola para a opção escolhida e encolhe
 * ligeiramente enquanto se prime a opção ativa.
 */
export function AccountSwitch({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  return (
    <fieldset>
      <legend className="sr-only">Tipo de conta</legend>
      <div className="group/seg relative grid grid-cols-2 rounded-full bg-sand p-1">
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]',
            'transition-[translate,scale] duration-[420ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none',
            'group-has-[[data-ativo]:active]/seg:scale-[0.96]',
            value === 'lar' ? 'translate-x-full' : 'translate-x-0',
          )}
        />
        {OPCOES.map((o) => {
          const ativo = value === o.value
          return (
            <label
              key={o.value}
              data-ativo={ativo || undefined}
              className={cn(
                'relative flex min-h-12 cursor-pointer items-center justify-center rounded-full px-4 text-base font-medium select-none',
                'transition-[color,opacity] duration-300 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
                ativo ? 'text-ink' : 'text-ink-mute hover:text-ink active:opacity-60',
              )}
            >
              <input
                type="radio"
                name="tipo-conta"
                value={o.value}
                checked={ativo}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
