import { Fragment, useId, type ChangeEvent, type ReactNode } from 'react'
import { Checkbox } from '@/components/ui/Field'
import { errorNode } from '../shared/useForm'

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

/**
 * Consentimentos como uma lista agrupada do iOS: cada linha inteira (largura total, ≥ 56px) é a área
 * de toque da caixa; separadores finos entre linhas; o erro entra por baixo da linha e fica ligado
 * por aria-describedby.
 */
export function ConsentFields({ items, legend }: { items: ConsentItem[]; legend: string }) {
  const id = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="sr-only">{legend}</legend>
      <div className="overflow-hidden rounded-[1.25rem] bg-sand">
        {items.map((it, i) => {
          const errId = `${id}-${it.key}-err`
          return (
            <Fragment key={it.key}>
              {i > 0 && <div aria-hidden className="ml-[3.625rem] h-px bg-line-strong/70" />}
              <div>
                <Checkbox
                  {...it.props}
                  label={it.label}
                  description={it.description}
                  aria-describedby={it.error ? errId : undefined}
                  className="min-h-14 w-full gap-3.5 rounded-none px-4 py-3.5 transition-colors duration-150 hover:bg-sand-deep/60 active:bg-sand-deep [&_input[aria-invalid=true]]:border-alert-600"
                />
                {it.error && (
                  <p id={errId} className="-mt-1 pr-4 pb-3.5 pl-[3.625rem] text-sm font-medium text-alert-700">
                    {errorNode(it.error, it.error)}
                  </p>
                )}
              </div>
            </Fragment>
          )
        })}
      </div>
    </fieldset>
  )
}
