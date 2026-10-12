import { BadgeCheck, CircleCheck, Clock, Hourglass, ShieldQuestion } from 'lucide-react'
import type { Disponibilidade, Lar } from '@/types'
import { Badge } from '@/components/ui/Badge'
import { disponibilidade, vagasLivres } from '@/lib/forecast'
import { DISPONIBILIDADE_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'

const DISP_TONE = { disponivel: 'leaf', breve: 'sun', espera: 'dusk' } as const
const DISP_ICON = { disponivel: CircleCheck, breve: Hourglass, espera: Clock }

/** Etiqueta de disponibilidade — cor + ícone + texto (nunca só cor). */
export function AvailabilityBadge({
  lar,
  estado,
  size = 'sm',
  overlay,
  showCount = true,
  className,
}: {
  lar?: Lar
  /** passar quando já calculado (evita recalcular a previsão) */
  estado?: Disponibilidade
  size?: 'sm' | 'md'
  /** versão para pousar sobre imagens */
  overlay?: boolean
  showCount?: boolean
  className?: string
}) {
  const d = estado ?? (lar ? disponibilidade(lar) : 'espera')
  const Icon = DISP_ICON[d]
  const n = lar ? vagasLivres(lar) : 0
  const text = d === 'disponivel' && showCount && n > 0 ? (n === 1 ? '1 vaga disponível' : `${n} vagas disponíveis`) : DISPONIBILIDADE_LABEL[d]
  if (overlay) {
    return (
      <Badge tone="white" size={size} className={cn('backdrop-blur', className)}>
        <span
          aria-hidden
          className={cn(
            'size-2.5 rounded-full',
            d === 'disponivel' ? 'animate-pulse-ring bg-leaf-500' : d === 'breve' ? 'bg-sun-500' : 'bg-dusk-500',
          )}
        />
        {text}
      </Badge>
    )
  }
  return (
    <Badge tone={DISP_TONE[d]} size={size} icon={<Icon aria-hidden />} className={className}>
      {text}
    </Badge>
  )
}

export function VerifiedBadge({ lar, size = 'sm', showPending = false, className }: { lar: Lar; size?: 'sm' | 'md'; showPending?: boolean; className?: string }) {
  if (lar.verificacao.estado === 'verificado') {
    return (
      <Badge tone="pine" size={size} icon={<BadgeCheck aria-hidden />} className={className} title="Instalações visitadas e documentação confirmada pela equipa EncontraLar">
        Verificado
      </Badge>
    )
  }
  if (!showPending) return null
  return (
    <Badge tone="neutral" size={size} icon={<ShieldQuestion aria-hidden />} className={className}>
      {lar.verificacao.estado === 'pendente' ? 'Verificação em curso' : 'Ainda não verificado'}
    </Badge>
  )
}
