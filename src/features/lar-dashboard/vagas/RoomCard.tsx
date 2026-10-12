import { BellRing, Check, LoaderCircle } from 'lucide-react'
import type { RoomOffer } from '@/types'
import { Meter } from '@/components/ui/misc'
import { euro, pct } from '@/lib/format'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { BedMap } from '../shared/BedMap'
import { BigStepper } from '../shared/BigStepper'
import { RoomPriceForm } from './RoomPriceForm'
import { useVagasDraft } from './useVagasDraft'

const DESCRICAO: Record<RoomOffer['tipo'], string> = {
  individual: 'Uma pessoa por quarto',
  duplo: 'Partilhado por duas pessoas',
  casal: 'Para duas pessoas que vivem juntas',
}

/** Um tipo de quarto: contador grande de lugares livres, "planta" de camas e preços. */
export function RoomCard({ larId, quarto, podeRemover, avisaveis }: { larId: string; quarto: RoomOffer; podeRemover: boolean; avisaveis: number }) {
  const { value, set, estado } = useVagasDraft(larId, quarto.tipo, quarto.livres)
  const ocupadosN = quarto.total - value
  const ocupacao = quarto.total > 0 ? ocupadosN / quarto.total : 0
  const nome = QUARTO_CURTO[quarto.tipo].toLowerCase()

  return (
    <article aria-labelledby={`quarto-${quarto.tipo}`} className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-6 pt-6 sm:px-7">
        <div>
          <h2 id={`quarto-${quarto.tipo}`} className="font-display text-3xl font-semibold">
            {QUARTO_LABEL[quarto.tipo].replace(' (partilhado)', '')}
          </h2>
          <p className="text-ink-soft">
            {DESCRICAO[quarto.tipo]} · desde {euro(quarto.precoMin)}/mês
          </p>
        </div>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-sm font-bold',
            value > 0 ? 'border-leaf-200 bg-leaf-50 text-leaf-700' : 'border-line bg-sand text-ink-soft',
          )}
        >
          <span aria-hidden className={cn('size-2.5 rounded-full', value > 0 ? 'bg-leaf-500' : 'bg-ink-mute/50')} />
          {value > 0 ? (value === 1 ? '1 livre' : `${value} livres`) : 'Completo'}
        </span>
      </header>

      <div className="grid gap-6 px-6 pt-5 pb-6 sm:px-7 md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-8">
        <BigStepper
          value={value}
          max={quarto.total}
          onChange={set}
          label={`Lugares livres em ${QUARTO_LABEL[quarto.tipo].toLowerCase()}`}
          unidade={`lugar livre em quarto ${nome}`}
          sufixo={`livres de ${quarto.total}`}
          className="justify-center md:justify-start"
        />
        <div className="flex min-w-0 flex-col gap-3">
          <BedMap total={quarto.total} livres={value} size="md" />
          <div className="flex items-center gap-3">
            <Meter value={ocupacao} label={`Ocupação do ${QUARTO_LABEL[quarto.tipo].toLowerCase()}: ${pct(ocupacao)}`} className="flex-1" />
            <span className="text-sm font-bold whitespace-nowrap tabular">{pct(ocupacao)} ocupado</span>
          </div>
          {value < quarto.total && (
            <p className="flex items-start gap-1.5 text-sm text-ink-soft">
              <BellRing aria-hidden className="mt-0.5 size-4 shrink-0 text-terra-600" />
              {avisaveis > 0
                ? `Se carregar em «+», ${avisaveis === 1 ? 'a família que espera é avisada' : `as ${avisaveis} famílias que esperam são avisadas`} logo.`
                : 'Se carregar em «+», o lugar aparece logo como livre no mapa de vagas.'}
            </p>
          )}
          <p aria-live="polite" className="min-h-6 text-sm">
            {estado === 'pendente' && (
              <span className="inline-flex items-center gap-1.5 text-ink-soft">
                <LoaderCircle aria-hidden className="size-4 animate-spin" /> A guardar…
              </span>
            )}
            {estado === 'guardado' && (
              <span className="inline-flex animate-fade-in items-center gap-1.5 font-bold text-leaf-700">
                <Check aria-hidden className="size-4" strokeWidth={3} /> Guardado — as famílias já veem {value === 1 ? '1 lugar livre' : `${value} lugares livres`}
              </span>
            )}
          </p>
        </div>
      </div>

      <RoomPriceForm key={`${quarto.total}-${quarto.precoMin}-${quarto.precoMax}`} larId={larId} quarto={quarto} podeRemover={podeRemover} />
    </article>
  )
}
