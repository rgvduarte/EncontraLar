import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { RoomOffer } from '@/types'
import { Reveal } from '@/components/motion'
import { euro, num, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import { nomeQuarto } from '../lib/derive'
import { Barra, Rolo } from '../shared/motion'
import { Stepper } from '../shared/Stepper'
import { capitalizar } from '../shared/ui'
import { RoomPriceForm } from './RoomPriceForm'
import { useVagasDraft } from './useVagasDraft'

/**
 * Um tipo de quarto: nome e preço, contador grande de lugares livres e, à parte, lugares e preços.
 * Cada toque no contador faz rolar o número e deslizar a barra de ocupação; "A guardar…" passa a "Guardado"
 * com um visto. No telemóvel o contador ocupa a largura toda, com os botões nas extremidades.
 */
export function RoomRow({ larId, quarto, podeRemover, indice = 0 }: { larId: string; quarto: RoomOffer; podeRemover: boolean; indice?: number }) {
  const { value, set, estado } = useVagasDraft(larId, quarto.tipo, quarto.livres)
  const [editar, setEditar] = useState(false)
  const ocupacao = quarto.total > 0 ? (quarto.total - value) / quarto.total : 0
  const nome = nomeQuarto(quarto.tipo)
  const formId = `precos-${quarto.tipo}`

  return (
    <li className="py-8 sm:py-10">
      <Reveal delay={Math.min(indice, 3) * 90} className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">{capitalizar(nome)}</h2>
          <p className="mt-1 text-ink-mute">
            {quarto.total} {quarto.total === 1 ? 'lugar' : 'lugares'} ·{' '}
            {quarto.precoMin === quarto.precoMax ? euro(quarto.precoMin) : `${num(quarto.precoMin)}–${euro(quarto.precoMax)}`}/mês
          </p>
          <div className="mt-4 flex max-w-xs items-center gap-3">
            <Barra value={ocupacao} label={`Ocupação do ${nome}: ${pct(ocupacao)}`} className="flex-1" />
            <span className="text-sm whitespace-nowrap text-ink-mute tabular">
              <Rolo value={Math.round(ocupacao * 100)} />% ocupado
            </span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Stepper
            value={value}
            max={quarto.total}
            onChange={set}
            label={`Lugares livres em ${nome}`}
            unidade={`lugar livre em ${nome}`}
            sufixo={`livres de ${quarto.total}`}
            className="max-md:w-full max-md:justify-between"
          />
          <p aria-live="polite" className="flex min-h-6 items-center justify-center text-sm">
            {estado === 'pendente' && (
              <span className="inline-flex animate-fade-in items-center gap-1.5 text-ink-mute">
                <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-ink-mute" />A guardar…
              </span>
            )}
            {estado === 'guardado' && (
              <span className="inline-flex animate-pop-in items-center gap-1 font-medium text-leaf-700">
                <Check aria-hidden className="size-4" strokeWidth={2.5} /> Guardado
              </span>
            )}
          </p>
        </div>
      </Reveal>

      <button
        type="button"
        aria-expanded={editar}
        aria-controls={formId}
        onClick={() => setEditar((v) => !v)}
        className="link mt-3 inline-flex min-h-12 items-center gap-1"
      >
        Lugares e preços
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-300 ease-[cubic-bezier(.16,1,.3,1)]', editar && 'rotate-180')} />
      </button>
      {editar && (
        <RoomPriceForm
          id={formId}
          key={`${quarto.total}-${quarto.precoMin}-${quarto.precoMax}`}
          larId={larId}
          quarto={quarto}
          podeRemover={podeRemover}
          onDone={() => setEditar(false)}
        />
      )}
    </li>
  )
}
