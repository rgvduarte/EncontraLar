import type { ChangeEvent, ReactNode } from 'react'
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

/** Consentimentos (caixas grandes, com o erro ligado por aria-describedby). */
export function ConsentFields({ items, legend }: { items: ConsentItem[]; legend: string }) {
  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{legend}</legend>
      {items.map((it) => {
        const errId = `consent-${it.key}-err`
        return (
          <div
            key={it.key}
            className={
              it.error
                ? 'rounded-2xl border-2 border-alert-600/40 bg-alert-50/60 px-4 py-2'
                : 'rounded-2xl border-2 border-transparent px-4 py-2 transition-colors hover:bg-sand/60'
            }
          >
            <Checkbox {...it.props} label={it.label} description={it.description} aria-describedby={it.error ? errId : undefined} />
            {it.error && (
              <p id={errId} className="pb-1 pl-10 text-sm font-bold text-alert-700">
                {it.error}
              </p>
            )}
          </div>
        )
      })}
    </fieldset>
  )
}
