import { CalendarClock, Clock, Siren, Sprout } from 'lucide-react'
import type { Candidatura, Urgencia } from '@/types'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { CUIDADO_LABEL, GRAU_LABEL } from '@/lib/labels'

const URGENCIA: Record<Urgencia, { texto: string; tone: BadgeTone; Icon: typeof Clock }> = {
  imediata: { texto: 'Urgente — alta hospitalar', tone: 'alert', Icon: Siren },
  '1-3meses': { texto: 'Dentro de 1 a 3 meses', tone: 'sun', Icon: Clock },
  '3-6meses': { texto: 'Dentro de 3 a 6 meses', tone: 'neutral', Icon: CalendarClock },
  planeamento: { texto: 'A planear com tempo', tone: 'neutral', Icon: Sprout },
}

export function UrgenciaBadge({ urgencia, size = 'sm' }: { urgencia: Urgencia; size?: 'sm' | 'md' }) {
  const u = URGENCIA[urgencia]
  return (
    <Badge tone={u.tone} size={size} icon={<u.Icon aria-hidden />}>
      {u.texto}
    </Badge>
  )
}

/** "Pai de Rui Sousa" — relação do perfil com quem fez o pedido. */
export function relacaoTexto(c: Candidatura): string {
  const r = c.perfil.relacao
  if (!r || r === 'Eu próprio(a)') return 'Pedido feito pela própria pessoa'
  return `${r} de ${c.contacto.nome}`
}

/** "dependência grave · enfermagem 24 horas, pessoas acamadas" */
export function perfilLinha(c: Candidatura, maxCuidados = 2): string {
  const grau = GRAU_LABEL[c.perfil.grau].toLowerCase()
  const nec = c.perfil.necessidades.slice(0, maxCuidados).map((n) => CUIDADO_LABEL[n].toLowerCase())
  const mais = c.perfil.necessidades.length - nec.length
  return [grau, nec.length ? nec.join(', ') + (mais > 0 ? ` e mais ${mais}` : '') : null].filter(Boolean).join(' · ')
}
