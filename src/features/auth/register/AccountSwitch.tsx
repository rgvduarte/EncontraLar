import type { Role } from '@/types'
import { cn } from '@/lib/cn'

/** `curto`: o texto visível quando o nome inteiro não cabe no segmento (o leitor de ecrã lê sempre o nome inteiro). */
const OPCOES: { value: Role; label: string; curto?: string }[] = [
  { value: 'familia', label: 'Família' },
  { value: 'lar', label: 'Instituição' },
  { value: 'profissional', label: 'Profissional de saúde', curto: 'Profissional' },
]

const DESLOCAMENTO = ['translate-x-0', 'translate-x-full', 'translate-x-[200%]']

/**
 * Controlo segmentado "Família | Instituição | Profissional" (rádios nativos: setas para mudar, foco visível).
 * Como no iOS: a pílula branca desliza com uma curva de mola para a opção escolhida e encolhe
 * ligeiramente enquanto se prime a opção ativa.
 */
export function AccountSwitch({ value, onChange }: { value: Role; onChange: (r: Role) => void }) {
  const indice = Math.max(0, OPCOES.findIndex((o) => o.value === value))
  return (
    <fieldset>
      <legend className="sr-only">Tipo de conta</legend>
      <div className="group/seg relative grid grid-cols-3 rounded-full bg-sand p-1">
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)]',
            'transition-[translate,scale] duration-[420ms] ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none',
            'group-has-[[data-ativo]:active]/seg:scale-[0.96]',
            DESLOCAMENTO[indice],
          )}
        />
        {OPCOES.map((o) => {
          const ativo = value === o.value
          return (
            <label
              key={o.value}
              data-ativo={ativo || undefined}
              className={cn(
                'relative flex min-h-12 min-w-0 cursor-pointer items-center justify-center rounded-full px-2 text-[1rem] font-medium select-none sm:px-3 sm:text-base',
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
              {o.curto ? (
                <>
                  <span aria-hidden className="truncate">
                    {o.curto}
                  </span>
                  <span className="sr-only">{o.label}</span>
                </>
              ) : (
                <span className="truncate">{o.label}</span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
