import { memo } from 'react'
import type { Lar } from '@/types'
import type { MatchResult } from '@/lib/matching'
import { LarCard } from '@/components/lar/LarCard'
import { cn } from '@/lib/cn'
import { WhyPanel } from './WhyPanel'

/** Uma sugestão: número grande à esquerda, cartão do lar e a gaveta "Porque sugerimos". */
export const RankedItem = memo(function RankedItem({
  lar,
  m,
  rank,
  destaque,
  onHover,
  aberto,
  apagado,
}: {
  lar: Lar
  m: MatchResult
  rank: number
  destaque: boolean
  onHover: (id: string | null) => void
  aberto?: boolean
  /** pouco compatível */
  apagado?: boolean
}) {
  const primeiro = rank === 1 && !apagado
  return (
    <li id={`sugestao-${lar.id}`} className="grid scroll-mt-28 grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[3.75rem_minmax(0,1fr)] sm:gap-x-5">
      <div aria-hidden className="flex flex-col items-start pt-1">
        <span
          className={cn(
            'font-display leading-none font-semibold tabular',
            primeiro ? 'text-5xl text-terra-600 sm:text-6xl' : 'text-3xl sm:text-4xl',
            apagado ? 'text-ink-mute/60' : !primeiro && 'text-pine-800/80',
          )}
        >
          {rank}
        </span>
        {primeiro && (
          <span className="mt-3 hidden text-xs leading-tight font-bold tracking-[0.1em] text-terra-700 uppercase [writing-mode:vertical-rl] sm:block">
            Melhor correspondência
          </span>
        )}
      </div>
      <div className={cn('min-w-0', apagado && 'opacity-90')}>
        {primeiro && (
          <p className="mb-2 text-xs font-bold tracking-[0.1em] text-terra-700 uppercase sm:hidden">Melhor correspondência</p>
        )}
        <LarCard
          lar={lar}
          match={m}
          distanciaKm={m.distanciaKm}
          layout="horizontal"
          headingLevel="h3"
          onHover={onHover}
          selected={destaque}
          className="relative z-10"
        />
        <WhyPanel m={m} nome={lar.nome} defaultOpen={aberto} />
      </div>
    </li>
  )
})
