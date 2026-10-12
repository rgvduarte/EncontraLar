import { useId, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Opção em pílula (rádio ou caixa): cinza → preta quando escolhida, com visto (nunca só cor). Alvo ≥ 48px. */
export function Pill({
  type = 'checkbox',
  name,
  checked,
  onChange,
  children,
  className,
}: {
  type?: 'checkbox' | 'radio'
  name?: string
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  className?: string
}) {
  return (
    <label
      className={cn(
        'inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full px-5 font-medium select-none',
        'transition-[background-color,color] duration-200 ease-[cubic-bezier(.25,.1,.25,1)]',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
        checked ? 'bg-ink text-white' : 'bg-sand text-ink hover:bg-sand-deep',
        className,
      )}
    >
      <input type={type} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      {checked && <Check aria-hidden strokeWidth={2.5} className="-ml-1 size-4 shrink-0" />}
      {children}
    </label>
  )
}

/** Grupo de pílulas com rótulo (role group/radiogroup). */
export function PillGroup({ label, hint, radio, children }: { label: ReactNode; hint?: ReactNode; radio?: boolean; children: ReactNode }) {
  const id = useId()
  return (
    <div role={radio ? 'radiogroup' : 'group'} aria-labelledby={id}>
      <p id={id} className="font-medium text-ink">
        {label}
      </p>
      {hint && <p className="mt-0.5 text-sm text-ink-mute">{hint}</p>}
      <div className="mt-3 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

/** Secção do formulário: título curto, frase de apoio opcional, campos. */
export function FormSection({ title, hint, children }: { title: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-10 first-of-type:border-t-0 first-of-type:pt-0">
      <legend className="float-left w-full">
        <span className="block text-2xl font-semibold text-ink">{title}</span>
        {hint && <span className="mt-1 block text-ink-mute">{hint}</span>}
      </legend>
      <div className="clear-both flex flex-col gap-7 pt-7">{children}</div>
    </fieldset>
  )
}
