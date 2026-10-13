import { Check } from 'lucide-react'
import type { Cuidado } from '@/types'
import { CUIDADO_LABEL, CUIDADOS_ORDEM } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Secao } from '../ui'

/** (d) Cuidados assegurados: botões que ligam e desligam (aria-pressed), começando com os da ficha. */
export function Cuidados({ cuidados, naFicha, onChange }: { cuidados: Cuidado[]; naFicha: readonly Cuidado[]; onChange: (c: Cuidado[]) => void }) {
  const juntou = cuidados.filter((c) => !naFicha.includes(c)).length
  const tirou = naFicha.filter((c) => !cuidados.includes(c)).length
  const alterou = juntou + tirou > 0
  return (
    <Secao id="cuidados" titulo="Cuidados" texto="O que a instituição assegura. Toque para ligar ou desligar.">
      <div role="group" aria-label="Cuidados assegurados" className="flex flex-wrap gap-2">
        {CUIDADOS_ORDEM.map((c) => {
          const on = cuidados.includes(c)
          return (
            <button
              key={c}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? cuidados.filter((x) => x !== c) : CUIDADOS_ORDEM.filter((x) => x === c || cuidados.includes(x)))}
              className={cn(
                'inline-flex min-h-12 items-center gap-2 rounded-full px-5 font-medium select-none',
                'transition-[background-color,color,scale] duration-200 ease-[cubic-bezier(.25,.1,.25,1)] active:scale-[0.97]',
                on ? 'bg-ink text-white' : 'bg-sand text-ink hover:bg-sand-deep',
              )}
            >
              {on && <Check aria-hidden strokeWidth={2.5} className="-ml-1 size-4 shrink-0 motion-safe:animate-[pop-in_.3s_cubic-bezier(.16,1,.3,1)_both]" />}
              {CUIDADO_LABEL[c]}
            </button>
          )
        })}
      </div>
      <p aria-live="polite" className="mt-4 text-sm text-ink-mute">
        {alterou
          ? `Muda a ficha: ${[juntou ? `${juntou} a mais` : '', tirou ? `${tirou} a menos` : ''].filter(Boolean).join(', ')}.`
          : `Igual à ficha (${cuidados.length} de ${CUIDADOS_ORDEM.length}).`}
      </p>
    </Secao>
  )
}
