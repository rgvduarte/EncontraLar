import type { ReactNode } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Opção em forma de "pastilha" (rádio ou caixa) — alvo ≥ 48px, estado com cor + visto. */
export function Chip({
  type = 'checkbox',
  name,
  checked,
  onChange,
  icon,
  tag,
  children,
  className,
}: {
  type?: 'checkbox' | 'radio'
  name?: string
  checked: boolean
  onChange: (v: boolean) => void
  icon?: ReactNode
  /** etiqueta discreta à direita (ex.: "essencial") */
  tag?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <label
      className={cn(
        'group relative flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border-2 border-line bg-white px-4 py-2 transition-colors',
        'hover:border-pine-400 has-[:checked]:border-pine-700 has-[:checked]:bg-pine-50',
        'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
        className,
      )}
    >
      <input type={type} name={name} checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      {icon && <span className="text-pine-700 [&_svg]:size-5">{icon}</span>}
      <span className="flex-1 leading-snug font-semibold text-ink">{children}</span>
      {tag}
      <span
        aria-hidden
        className={cn(
          'flex size-6 shrink-0 items-center justify-center border-2 border-line-strong bg-white text-white transition-colors',
          'group-has-[:checked]:border-pine-700 group-has-[:checked]:bg-pine-700',
          type === 'radio' ? 'rounded-full' : 'rounded-md',
        )}
      >
        <Check strokeWidth={3} className="size-3.5" />
      </span>
    </label>
  )
}

/** Secção numerada do formulário (fieldset + legenda editorial). */
export function Seccao({ n, titulo, texto, children }: { n: number; titulo: ReactNode; texto?: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="border-t border-line pt-7 first-of-type:border-t-0 first-of-type:pt-0">
      <legend className="float-left mb-5 flex w-full items-baseline gap-4">
        <span aria-hidden className="font-display text-3xl leading-none font-semibold text-terra-600 tabular">
          {String(n).padStart(2, '0')}
        </span>
        <span>
          <span className="block font-display text-2xl leading-tight font-semibold text-ink">{titulo}</span>
          {texto && <span className="mt-1 block text-sm text-ink-soft">{texto}</span>}
        </span>
      </legend>
      <div className="clear-both flex flex-col gap-5">{children}</div>
    </fieldset>
  )
}

/** Grupo de opções com rótulo (para rádios/caixas fora de FieldShell). */
export function Grupo({ label, hint, children, className }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div role="group" aria-label={typeof label === 'string' ? label : undefined} className={className}>
      <p className="text-base font-bold text-ink">{label}</p>
      {hint && <p className="mt-0.5 text-sm text-ink-soft">{hint}</p>}
      <div className="mt-3">{children}</div>
    </div>
  )
}
