import { Link } from 'react-router'
import { ArrowUpRight, MapPin, TriangleAlert } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { AvailabilityBadge, VerifiedBadge } from '@/components/lar/badges'
import { tempoRelativo } from '@/lib/format'
import { TIPO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { frescura } from '../lib/derive'
import { useAgora } from '../lib/hooks'

/** Bloco de identidade no topo da barra lateral (desktop). */
export function SidebarIdentity({ lar }: { lar: Lar }) {
  return (
    <div>
      <div className="relative -mx-5 -mt-5 mb-4 aspect-[16/9] overflow-hidden rounded-t-[calc(1.5rem-1px)] bg-sand">
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
      </div>
      <p className="text-sm font-semibold text-ink-mute">{TIPO_LABEL[lar.tipo]}</p>
      <p className="font-display text-xl leading-snug font-semibold text-ink">{lar.nome}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-soft">
        <MapPin aria-hidden className="size-4 shrink-0 text-pine-600" />
        {lar.localidade}, {lar.distrito}
      </p>
      <div className="mt-3">
        <VerifiedBadge lar={lar} showPending />
      </div>
      <Link to={`/lar/${lar.id}`} className="link mt-3 inline-flex min-h-11 items-center gap-1 text-sm">
        Ver ficha pública <ArrowUpRight aria-hidden className="size-4" />
      </Link>
    </div>
  )
}

/** Versão compacta para o telemóvel (a barra lateral não aparece). */
export function MobileIdentity({ lar, className }: { lar: Lar; className?: string }) {
  return (
    <div className={cn('mb-6 flex items-center gap-4 rounded-3xl border border-line bg-white p-3 pr-4 shadow-soft', className)}>
      <div className="h-16 w-22 shrink-0 overflow-hidden rounded-2xl bg-sand">
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-lg leading-snug font-semibold">{lar.nome}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          <VerifiedBadge lar={lar} showPending />
          <Link to={`/lar/${lar.id}`} className="link inline-flex min-h-10 items-center gap-1 text-sm">
            Ficha pública <ArrowUpRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

/** "Como as famílias o veem agora" — o estado que aparece no mapa de vagas. */
export function PublicStatus({ lar }: { lar: Lar }) {
  const agora = useAgora()
  const f = frescura(lar.atualizadoEm, agora)
  return (
    <div className={cn('rounded-3xl border-2 border-dashed p-4', f === 'desatualizada' ? 'border-sun-400 bg-sun-50' : 'border-line-strong')}>
      <p className="eyebrow">No mapa de vagas</p>
      <div className="mt-2">
        <AvailabilityBadge lar={lar} size="md" />
      </div>
      <p className={cn('mt-2 flex items-start gap-1.5 text-sm', f === 'desatualizada' ? 'font-bold text-sun-800' : 'text-ink-soft')}>
        {f === 'desatualizada' && <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
        Vagas confirmadas {tempoRelativo(lar.atualizadoEm, new Date(agora))}
      </p>
    </div>
  )
}
