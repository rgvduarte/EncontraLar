import { Link } from 'react-router'
import { ArrowRight, MapPin, X } from 'lucide-react'
import { LarCover } from '@/components/lar/LarCover'
import { AvailabilityBadge } from '@/components/lar/badges'
import { resumoPrevisao } from '@/lib/forecast'
import { NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { euro, km } from '@/lib/format'
import { buttonClasses } from '@/components/ui/Button'
import type { Entrada } from './filtering'

function Preco({ e }: { e: Entrada }) {
  const { lar } = e
  return lar.natureza === 'privado' ? (
    <p className="leading-tight">
      <span className="text-xs text-ink-soft">desde </span>
      <span className="font-display text-xl font-semibold text-ink tabular">{euro(lar.mensalidadeMin)}</span>
      <span className="text-xs text-ink-soft">/mês</span>
    </p>
  ) : (
    <p className="leading-tight">
      <span className="font-display text-lg font-semibold text-ink tabular">
        {euro(lar.mensalidadeMin)}–{euro(lar.mensalidadeMax)}
      </span>
      <span className="block text-xs text-ink-soft">conforme os rendimentos</span>
    </p>
  )
}

/** Conteúdo do popup do marcador (desktop). */
export function MapPopupContent({ e }: { e: Entrada }) {
  const { lar } = e
  return (
    <div className="font-sans text-ink">
      <div className="relative h-24 overflow-hidden bg-sand">
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
      </div>
      <div className="flex flex-col gap-2 px-4 pt-3 pb-4">
        <p className="text-xs font-semibold text-ink-soft">
          {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]}
        </p>
        <p className="font-display text-lg leading-snug font-semibold">{lar.nome}</p>
        <AvailabilityBadge lar={lar} estado={e.disp} />
        {e.disp !== 'disponivel' && lar.tipo !== 'centro_dia' && <p className="text-sm text-ink-soft">{resumoPrevisao(lar, e.est)}</p>}
        <div className="mt-1 flex items-end justify-between gap-3">
          <Preco e={e} />
          <Link to={`/lar/${lar.id}`} className={buttonClasses('primary', 'sm', 'min-h-11 px-3.5 text-white!')}>
            Ver ficha
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  )
}

/** Cartão que sobe do fundo do mapa no telemóvel quando se toca num marcador. */
export function MapPeekCard({ e, onClose }: { e: Entrada; onClose: () => void }) {
  const { lar } = e
  return (
    <div
      role="dialog"
      aria-label={`Instituição selecionada: ${lar.nome}`}
      className="pointer-events-auto relative flex animate-fade-up overflow-hidden rounded-3xl border border-line bg-white shadow-lift"
    >
      <div className="relative w-28 shrink-0 bg-sand">
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-3 pr-12 pl-4">
        <p className="font-display text-lg leading-snug font-semibold text-ink">{lar.nome}</p>
        <p className="flex items-center gap-1 text-sm text-ink-soft">
          <MapPin aria-hidden className="size-4 shrink-0 text-pine-600" />
          <span className="truncate">
            {lar.localidade}
            {e.distanciaKm != null && ` · a ${km(e.distanciaKm)}`}
          </span>
        </p>
        <AvailabilityBadge lar={lar} estado={e.disp} className="self-start" />
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <Preco e={e} />
          <Link to={`/lar/${lar.id}`} className={buttonClasses('primary', 'sm', 'min-h-12')}>
            Ver ficha
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-1.5 right-1.5 flex size-11 items-center justify-center rounded-full text-ink-soft hover:bg-sand"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  )
}
