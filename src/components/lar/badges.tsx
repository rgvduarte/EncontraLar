import { BadgeCheck } from 'lucide-react'
import type { Disponibilidade, Lar } from '@/types'
import { disponibilidade, vagaParaNovos, vagasLivres, type EstimativaEspera } from '@/lib/forecast'
import { DISPONIBILIDADE_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'

const DOT: Record<Disponibilidade, string> = { disponivel: 'bg-leaf-500', breve: 'bg-sun-500', espera: 'bg-dusk-500' }
const TXT: Record<Disponibilidade, string> = { disponivel: 'text-leaf-700', breve: 'text-sun-800', espera: 'text-dusk-700' }
const BG: Record<Disponibilidade, string> = { disponivel: 'bg-leaf-50', breve: 'bg-sun-50', espera: 'bg-dusk-50' }

/**
 * Há lugar livre, mas já prometido a quem está na lista de espera (a previsão não é imediata):
 * para quem pede hoje não é "vaga agora". Mostra-se a laranja, com "lista à frente".
 */
export function livreComListaAFrente(lar: Lar | undefined, d: Disponibilidade, est?: EstimativaEspera): boolean {
  if (!lar || d !== 'disponivel' || vagasLivres(lar) === 0) return false
  return !vagaParaNovos(lar, est)
}

export function disponibilidadeTexto(lar: Lar | undefined, d: Disponibilidade, showCount = true, curto = false, est?: EstimativaEspera) {
  const n = lar ? vagasLivres(lar) : 0
  if (livreComListaAFrente(lar, d, est)) {
    if (curto) return 'Lista à frente'
    return `${n === 1 ? '1 lugar livre' : `${n} lugares livres`} · lista à frente`
  }
  if (curto) {
    if (d === 'disponivel') return n > 1 && showCount ? `${n} vagas` : 'Com vaga'
    return d === 'breve' ? 'Vaga em breve' : 'Lista de espera'
  }
  return d === 'disponivel' && showCount && n > 0 ? (n === 1 ? '1 vaga disponível' : `${n} vagas disponíveis`) : DISPONIBILIDADE_LABEL[d]
}

/** Disponibilidade: ponto de cor + texto (nunca só cor). */
export function AvailabilityBadge({
  lar,
  estado,
  est,
  size = 'sm',
  overlay,
  showCount = true,
  className,
}: {
  lar?: Lar
  estado?: Disponibilidade
  /** estimativa já calculada (evita recalcular em listas) */
  est?: EstimativaEspera
  size?: 'sm' | 'md'
  /** versão para pousar sobre imagens (pílula branca translúcida) */
  overlay?: boolean
  showCount?: boolean
  className?: string
}) {
  const d0 = estado ?? (lar ? disponibilidade(lar, est) : 'espera')
  // lugar livre que deverá ir para a lista de espera: estado "em breve" (laranja), com texto próprio
  const d: Disponibilidade = livreComListaAFrente(lar, d0, est) ? 'breve' : d0
  // sobre imagens o espaço é curto (ao lado do coração): texto abreviado
  const text = disponibilidadeTexto(lar, d0, showCount, overlay, est)
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-full font-medium whitespace-nowrap',
        size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        overlay ? 'bg-white/90 text-ink shadow-soft backdrop-blur-md' : cn(BG[d], TXT[d]),
        className,
      )}
    >
      {/* pulso só com transform/opacity, 3 vezes (não fica a repintar a página) */}
      <span aria-hidden className={cn('size-2 shrink-0 rounded-full', DOT[d], d === 'disponivel' && 'pulse-dot')} />
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
