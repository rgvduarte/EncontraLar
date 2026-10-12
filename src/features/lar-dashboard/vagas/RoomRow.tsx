import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import type { RoomOffer } from '@/types'
import { Meter } from '@/components/ui/misc'
import { euro, num, pct } from '@/lib/format'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Stepper } from '../shared/Stepper'
import { RoomPriceForm } from './RoomPriceForm'
import { useVagasDraft } from './useVagasDraft'

const NOME: Record<RoomOffer['tipo'], string> = {
  individual: 'Quarto individual',
  duplo: 'Quarto duplo',
  casal: 'Quarto de casal',
}

/** Um tipo de quarto: nome e preço, contador grande de lugares livres e, à parte, lugares e preços. */
export function RoomRow({ larId, quarto, podeRemover }: { larId: string; quarto: RoomOffer; podeRemover: boolean }) {
  const { value, set, estado } = useVagasDraft(larId, quarto.tipo, quarto.livres)
  const [editar, setEditar] = useState(false)
  const ocupacao = quarto.total > 0 ? (quarto.total - value) / quarto.total : 0
  const nome = QUARTO_CURTO[quarto.tipo].toLowerCase()
  const formId = `precos-${quarto.tipo}`

  return (
    <li className="py-8 sm:py-10">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-10">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold">{NOME[quarto.tipo]}</h2>
          <p className="mt-1 text-ink-mute">
            {quarto.total} {quarto.total === 1 ? 'lugar' : 'lugares'} ·{' '}
            {quarto.precoMin === quarto.precoMax ? euro(quarto.precoMin) : `${num(quarto.precoMin)}–${euro(quarto.precoMax)}`}/mês
          </p>
          <div className="mt-4 flex max-w-xs items-center gap-3">
            <Meter value={ocupacao} label={`Ocupação do ${QUARTO_LABEL[quarto.tipo].toLowerCase()}: ${pct(ocupacao)}`} className="h-1 flex-1" />
            <span className="text-sm whitespace-nowrap text-ink-mute tabular">{pct(ocupacao)} ocupado</span>
          </div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <Stepper
            value={value}
            max={quarto.total}
            onChange={set}
            label={`Lugares livres em ${QUARTO_LABEL[quarto.tipo].toLowerCase()}`}
            unidade={`lugar livre em quarto ${nome}`}
            sufixo={`livres de ${quarto.total}`}
          />
          <p aria-live="polite" className="min-h-6 text-sm">
            {estado === 'pendente' && <span className="text-ink-mute">A guardar…</span>}
            {estado === 'guardado' && (
              <span className="inline-flex animate-fade-in items-center gap-1 text-leaf-700">
                <Check aria-hidden className="size-4" strokeWidth={2.5} /> Guardado
              </span>
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={editar}
        aria-controls={formId}
        onClick={() => setEditar((v) => !v)}
        className="link mt-2 inline-flex min-h-11 items-center gap-1"
      >
        Lugares e preços
        <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-200', editar && 'rotate-180')} />
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
