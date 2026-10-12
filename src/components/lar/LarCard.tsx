import { memo, useMemo } from 'react'
import { Link } from 'react-router'
import { MapPin, TrendingUp } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCover } from './LarCover'
import { AvailabilityBadge, VerifiedBadge } from './badges'
import { FavoriteButton } from './FavoriteButton'
import { CUIDADO_ICON } from './icons'
import { Stars } from '@/components/ui/Stars'
import { disponibilidade, estimarEspera, resumoPrevisao } from '@/lib/forecast'
import { CUIDADO_LABEL, NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { euro, km } from '@/lib/format'
import type { MatchResult } from '@/lib/matching'
import { cn } from '@/lib/cn'

const DESTAQUES = ['demencia', 'enfermagem24h', 'acamados', 'fisioterapia', 'paliativos', 'medico'] as const

export interface LarCardProps {
  lar: Lar
  /** distância ao ponto de pesquisa */
  distanciaKm?: number
  match?: MatchResult
  layout?: 'vertical' | 'horizontal'
  selected?: boolean
  onHover?: (id: string | null) => void
  className?: string
  /** heading level do nome (acessibilidade na página) */
  headingLevel?: 'h2' | 'h3'
}

/** Cartão de instituição — usado na pesquisa, página inicial, recomendações e favoritos. */
export const LarCard = memo(function LarCard({
  lar,
  distanciaKm,
  match,
  layout = 'vertical',
  selected,
  onHover,
  className,
  headingLevel: H = 'h3',
}: LarCardProps) {
  const est = useMemo(() => match?.espera ?? estimarEspera(lar), [lar, match])
  const disp = disponibilidade(lar, est)
  const previsao = resumoPrevisao(lar, est)
  const destaques = DESTAQUES.filter((c) => lar.cuidados.includes(c)).slice(0, 3)
  const horizontal = layout === 'horizontal'
  const centroDia = lar.tipo === 'centro_dia'

  return (
    <article
      onMouseEnter={onHover ? () => onHover(lar.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(lar.id) : undefined}
      className={cn(
        'group relative flex overflow-hidden rounded-3xl border bg-white transition-all duration-200',
        'focus-within:shadow-lift hover:-translate-y-0.5 hover:shadow-lift',
        selected ? 'border-pine-600 shadow-lift ring-2 ring-pine-600' : 'border-line shadow-card',
        horizontal ? 'flex-col sm:flex-row' : 'flex-col',
        className,
      )}
    >
      <div className={cn('relative shrink-0 overflow-hidden bg-sand', horizontal ? 'aspect-[16/10] sm:aspect-auto sm:w-64' : 'aspect-[16/10]')}>
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="absolute top-3 left-3">
          <AvailabilityBadge lar={lar} estado={disp} overlay />
        </div>
        <div className="absolute top-2 right-2">
          <FavoriteButton larId={lar.id} larNome={lar.nome} />
        </div>
        {match && (
          <div className="absolute bottom-3 left-3 rounded-2xl bg-pine-800/92 px-3 py-1.5 text-white shadow-soft backdrop-blur">
            <span className="text-lg font-bold">{match.score}%</span>
            <span className="ml-1.5 text-xs font-semibold opacity-90">compatível</span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <p className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-ink-soft">
          <span>{TIPO_LABEL[lar.tipo]}</span>
          <span aria-hidden>·</span>
          <span>{NATUREZA_LABEL[lar.natureza]}</span>
        </p>
        <H className="font-display text-xl leading-snug font-semibold text-ink">
          <Link
            to={`/lar/${lar.id}`}
            className="after:absolute after:inset-0 after:z-0 after:content-[''] focus-visible:outline-none group-focus-within:underline hover:underline"
          >
            {lar.nome}
          </Link>
        </H>
        <p className="flex items-center gap-1.5 text-sm text-ink-soft">
          <MapPin aria-hidden className="size-4 shrink-0 text-pine-600" />
          <span>
            {lar.localidade}, {lar.distrito}
            {distanciaKm != null && <span className="font-semibold text-ink"> · a {km(distanciaKm)}</span>}
          </span>
        </p>

        <div className="flex flex-wrap items-center gap-2">
          {lar.numAvaliacoes > 0 && (
            <span className="inline-flex items-center gap-1.5 text-sm">
              <Stars value={lar.avaliacao} />
              <span className="font-bold">{lar.avaliacao.toLocaleString('pt-PT', { minimumFractionDigits: 1 })}</span>
              <span className="text-ink-mute">({lar.numAvaliacoes})</span>
            </span>
          )}
          <VerifiedBadge lar={lar} />
        </div>

        {destaques.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Cuidados em destaque">
            {destaques.map((c) => {
              const Icon = CUIDADO_ICON[c]
              return (
                <li key={c} className="inline-flex items-center gap-1.5 rounded-lg bg-sand px-2 py-1 text-xs font-semibold text-ink-soft">
                  <Icon aria-hidden className="size-3.5 text-pine-700" />
                  {CUIDADO_LABEL[c]}
                </li>
              )
            })}
          </ul>
        )}

        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-t border-line pt-3">
          <p>
            <span className="text-sm text-ink-soft">{lar.natureza === 'privado' ? 'Desde' : 'Mensalidade'} </span>
            <span className="text-lg font-bold text-ink">
              {lar.natureza === 'privado' ? euro(lar.mensalidadeMin) : `${euro(lar.mensalidadeMin)}–${euro(lar.mensalidadeMax)}`}
            </span>
            <span className="text-sm text-ink-soft">/mês</span>
          </p>
          {!centroDia && (
            <p
              className={cn(
                'inline-flex items-center gap-1.5 text-sm font-semibold',
                disp === 'disponivel' ? 'text-leaf-700' : disp === 'breve' ? 'text-sun-800' : 'text-dusk-700',
              )}
            >
              <TrendingUp aria-hidden className="size-4" />
              {previsao}
            </p>
          )}
        </div>
      </div>
    </article>
  )
})
