import { TriangleAlert } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCover } from '@/components/lar/LarCover'
import { AvailabilityBadge, VerifiedBadge } from '@/components/lar/badges'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { frescura } from '../lib/derive'
import { useAgora } from '../lib/hooks'
import { MoreLink } from '../shared/ui'

/** Identidade no topo da barra lateral (desktop): miniatura, nome, localidade e verificação. */
export function SidebarIdentity({ lar }: { lar: Lar }) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="size-12 shrink-0 overflow-hidden rounded-xl">
          <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
        </div>
        <div className="min-w-0">
          <p className="leading-snug font-semibold text-ink">{lar.nome}</p>
          <p className="text-sm text-ink-mute">{lar.localidade}</p>
        </div>
      </div>
      <p className="mt-3">
        <VerifiedBadge lar={lar} showPending />
      </p>
    </div>
  )
}

/** Como as famílias veem a casa agora no mapa de vagas (fundo da barra lateral). */
export function PublicStatus({ lar }: { lar: Lar }) {
  const agora = useAgora()
  const velha = frescura(lar.atualizadoEm, agora) === 'desatualizada'
  return (
    <div className="flex flex-col items-start gap-2 border-t border-line px-3.5 pt-6 text-sm">
      <p className="text-ink-mute">No mapa de vagas</p>
      <AvailabilityBadge lar={lar} />
      <p className={cn('flex items-start gap-1.5', velha ? 'font-medium text-sun-800' : 'text-ink-mute')}>
        {velha && <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" />}
        Confirmadas {tempoRelativo(lar.atualizadoEm, new Date(agora))}
      </p>
      <MoreLink to={`/lar/${lar.id}`} className="text-sm">
        Ver ficha pública
      </MoreLink>
    </div>
  )
}
