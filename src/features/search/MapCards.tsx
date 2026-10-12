import { Link } from 'react-router'
import { ChevronRight, X } from 'lucide-react'
import { LarCover } from '@/components/lar/LarCover'
import { AvailabilityBadge } from '@/components/lar/badges'
import { buttonClasses } from '@/components/ui/Button'
import { resumoPrevisao } from '@/lib/forecast'
import { TIPO_LABEL } from '@/lib/labels'
import { euro, km } from '@/lib/format'
import type { Entrada } from './filtering'

function Preco({ e }: { e: Entrada }) {
  const { lar } = e
  const social = lar.natureza !== 'privado'
  return (
    <p className="leading-tight text-ink">
      <span className="text-lg font-semibold tabular">{social ? `${euro(lar.mensalidadeMin)}–${euro(lar.mensalidadeMax)}` : euro(lar.mensalidadeMin)}</span>
      <span className="text-sm text-ink-mute"> /mês</span>
      {social && <span className="block text-sm text-ink-mute">conforme rendimentos</span>}
    </p>
  )
}

function Linha({ e }: { e: Entrada }) {
  const { lar } = e
  return (
    <p className="truncate text-sm text-ink-mute">
      {TIPO_LABEL[lar.tipo]} · {lar.localidade}
      {e.distanciaKm != null && ` · ${km(e.distanciaKm)}`}
    </p>
  )
}

/** Popup do marcador (desktop): nome, estado, preço, "Ver ficha ›". */
export function MapPopupContent({ e }: { e: Entrada }) {
  const { lar } = e
  return (
    <div className="flex flex-col gap-3 p-5 font-sans text-ink">
      <div className="pr-8">
        <Linha e={e} />
        <p className="mt-1 text-lg leading-snug font-semibold tracking-[-0.015em]">{lar.nome}</p>
      </div>
      <div className="flex flex-col items-start gap-1.5">
        <AvailabilityBadge lar={lar} estado={e.disp} />
        {e.disp !== 'disponivel' && lar.tipo !== 'centro_dia' && <p className="text-sm text-ink-mute">{resumoPrevisao(lar, e.est)}</p>}
      </div>
      <div className="flex items-end justify-between gap-3">
        <Preco e={e} />
        <Link to={`/lar/${lar.id}`} className="inline-flex min-h-11 shrink-0 items-center font-medium text-terra-600! hover:underline">
          Ver ficha
          <ChevronRight aria-hidden className="size-4.5" />
        </Link>
      </div>
    </div>
  )
}

/** Cartão que sobe do fundo do mapa no telemóvel ao tocar num marcador. */
export function MapPeekCard({ e, onClose }: { e: Entrada; onClose: () => void }) {
  const { lar } = e
  return (
    <div
      role="dialog"
      aria-label={`Instituição selecionada: ${lar.nome}`}
      className="pointer-events-auto relative flex animate-sheet-up gap-4 rounded-[1.75rem] bg-white p-3 shadow-lift ring-1 ring-black/5"
    >
      <div className="relative w-24 shrink-0 overflow-hidden rounded-[1.25rem] bg-sand">
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-1 pr-9">
        <p className="text-lg leading-snug font-semibold tracking-[-0.015em] text-ink">{lar.nome}</p>
        <Linha e={e} />
        <AvailabilityBadge lar={lar} estado={e.disp} className="self-start" />
        <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
          <Preco e={e} />
          <Link to={`/lar/${lar.id}`} className={buttonClasses('primary', 'sm', 'min-h-12 px-5')}>
            Ver ficha
          </Link>
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar"
        className="absolute top-2 right-2 flex size-11 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-sand hover:text-ink"
      >
        <X aria-hidden className="size-5" />
      </button>
    </div>
  )
}
