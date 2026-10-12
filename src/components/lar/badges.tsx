import { BadgeCheck } from 'lucide-react'
import type { Disponibilidade, Lar } from '@/types'
import { disponibilidade, vagasLivres } from '@/lib/forecast'
import { DISPONIBILIDADE_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'

const DOT: Record<Disponibilidade, string> = { disponivel: 'bg-leaf-500', breve: 'bg-sun-500', espera: 'bg-dusk-500' }
const TXT: Record<Disponibilidade, string> = { disponivel: 'text-leaf-700', breve: 'text-sun-800', espera: 'text-dusk-700' }
const BG: Record<Disponibilidade, string> = { disponivel: 'bg-leaf-50', breve: 'bg-sun-50', espera: 'bg-dusk-50' }

export function disponibilidadeTexto(lar: Lar | undefined, d: Disponibilidade, showCount = true) {
  const n = lar ? vagasLivres(lar) : 0
  return d === 'disponivel' && showCount && n > 0 ? (n === 1 ? '1 vaga disponível' : `${n} vagas disponíveis`) : DISPONIBILIDADE_LABEL[d]
}

/** Disponibilidade: ponto de cor + texto (nunca só cor). */
export function AvailabilityBadge({
  lar,
  estado,
  size = 'sm',
  overlay,
  showCount = true,
  className,
}: {
  lar?: Lar
  estado?: Disponibilidade
  size?: 'sm' | 'md'
  /** versão para pousar sobre imagens (pílula branca translúcida) */
  overlay?: boolean
  showCount?: boolean
  className?: string
}) {
  const d = estado ?? (lar ? disponibilidade(lar) : 'espera')
  const text = disponibilidadeTexto(lar, d, showCount)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        overlay ? 'bg-white/90 text-ink shadow-soft backdrop-blur-md' : cn(BG[d], TXT[d]),
        className,
      )}
    >
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[d], d === 'disponivel' && 'animate-pulse-ring')} />
      {text}
    </span>
  )
}

export function VerifiedBadge({ lar, size = 'sm', showPending = false, className }: { lar: Lar; size?: 'sm' | 'md'; showPending?: boolean; className?: string }) {
  if (lar.verificacao.estado === 'verificado') {
    return (
      <span
        className={cn('inline-flex items-center gap-1 font-medium text-terra-700', size === 'sm' ? 'text-xs' : 'text-sm', className)}
        title="Instalações visitadas e documentação confirmada pela equipa EncontraLar"
      >
        <BadgeCheck aria-hidden className={size === 'sm' ? 'size-4' : 'size-5'} />
        Verificado
      </span>
    )
  }
  if (!showPending) return null
  return (
    <span className={cn('inline-flex items-center gap-1 font-medium text-ink-mute', size === 'sm' ? 'text-xs' : 'text-sm', className)}>
      {lar.verificacao.estado === 'pendente' ? 'Verificação em curso' : 'Ainda não verificado'}
    </span>
  )
}
