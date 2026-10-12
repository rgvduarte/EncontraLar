import { memo } from 'react'
import type { Lar } from '@/types'
import type { MatchResult } from '@/lib/matching'
import { LarCard } from '@/components/lar/LarCard'
import { cn } from '@/lib/cn'
import { useEntrada } from '../motion'
import { WhyPanel } from './WhyPanel'

/**
 * Uma sugestão: o cartão do lar (com a compatibilidade) e a gaveta "Porque sugerimos".
 * Entra ao aparecer no ecrã; as que aparecem juntas (primeira página, "Mostrar mais") entram em cascata.
 */
export const RankedItem = memo(function RankedItem({
  lar,
  m,
  melhor,
  apagado,
}: {
  lar: Lar
  m: MatchResult
  /** primeira sugestão compatível */
  melhor?: boolean
  /** pouco compatível */
  apagado?: boolean
}) {
  const entrada = useEntrada<HTMLLIElement>()
  return (
    <li
      ref={entrada.ref}
      id={`sugestao-${lar.id}`}
      style={entrada.style}
      className={cn('scroll-mt-24 py-6 first:pt-2 sm:py-8 sm:first:pt-4', entrada.className)}
    >
      {melhor && <p className="mb-2 px-3 text-sm font-semibold text-terra-600 sm:px-0">Melhor compatibilidade</p>}
      <LarCard
        lar={lar}
        match={m}
        distanciaKm={m.distanciaKm}
        layout="horizontal"
        headingLevel="h3"
        // telemóvel: capa mais baixa (2:1 em vez de 16:10) — cabe mais de uma sugestão por ecrã
        className={cn(
          'max-sm:[&>div:first-child]:aspect-[2/1] sm:-mx-3',
          apagado && 'opacity-75 transition-opacity duration-300 hover:opacity-100',
        )}
      />
      <WhyPanel m={m} nome={lar.nome} />
    </li>
  )
})
