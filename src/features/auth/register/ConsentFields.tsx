import { useId, type ChangeEvent, type ReactNode } from 'react'
import { Checkbox } from '@/components/ui/Field'

export interface ConsentItem {
  key: string
  label: ReactNode
  description?: ReactNode
  error?: string
  props: {
    name: string
    checked: boolean
    onChange: (e: ChangeEvent<HTMLInputElement>) => void
    ref: (el: HTMLElement | null) => void
    'aria-invalid'?: boolean
  }
}

/** Consentimentos: caixas grandes, com o erro por baixo e ligado por aria-describedby. */
export function ConsentFields({ items, legend }: { items: ConsentItem[]; legend: string }) {
  const id = useId()
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="sr-only">{legend}</legend>
      {items.map((it) => {
        const errId = `${id}-${it.key}-err`
        return (
          <div key={it.key}>
            <Checkbox {...it.props} label={it.label} description={it.description} aria-describedby={it.error ? errId : undefined} />
            {it.error && (
              <p id={errId} className="pb-1 pl-10 text-sm font-medium text-alert-700">
                {it.error}
              </p>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
