import { memo, useMemo } from 'react'
import { Link } from 'react-router'
import { Star } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCover } from './LarCover'
import { AvailabilityBadge, VerifiedBadge, livreComListaAFrente } from './badges'
import { FavoriteButton } from './FavoriteButton'
import { disponibilidade, estimarEspera, resumoPrevisao } from '@/lib/forecast'
import { CUIDADO_LABEL, NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { euro, km } from '@/lib/format'
import type { MatchResult } from '@/lib/matching'
import { cn } from '@/lib/cn'

const DESTAQUES = ['demencia', 'enfermagem24h', 'acamados', 'fisioterapia', 'paliativos'] as const

export interface LarCardProps {
  lar: Lar
  /** distância ao ponto de pesquisa */
  distanciaKm?: number
  match?: MatchResult
  layout?: 'vertical' | 'horizontal'
  selected?: boolean
  onHover?: (id: string | null) => void
  className?: string
  /** nível do título (hierarquia de cabeçalhos da página) */
  headingLevel?: 'h2' | 'h3'
}

/**
 * Cartão de instituição — minimalista: capa, nome, local, disponibilidade, preço.
 * Usado na pesquisa, página inicial, recomendações e favoritos.
 */
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
  // lugar livre já prometido à lista de espera: o cartão mostra a espera estimada, como nos outros estados
  const listaAFrente = livreComListaAFrente(lar, disp, est)
  const destaques = DESTAQUES.filter((c) => lar.cuidados.includes(c)).slice(0, 2)
  const horizontal = layout === 'horizontal'
  const centroDia = lar.tipo === 'centro_dia'

  return (
    <article
      onMouseEnter={onHover ? () => onHover(lar.id) : undefined}
      onMouseLeave={onHover ? () => onHover(null) : undefined}
      onFocus={onHover ? () => onHover(lar.id) : undefined}
      className={cn(
        'group relative flex rounded-[1.75rem] bg-white transition-all duration-300 ease-[cubic-bezier(.25,.1,.25,1)]',
        horizontal ? 'flex-col gap-4 p-3 sm:flex-row sm:items-stretch' : 'flex-col',
        horizontal && (selected ? 'bg-sand ring-1 ring-line-strong' : 'hover:bg-sand/70'),
        className,
      )}
    >
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-[1.375rem] bg-sand',
          horizontal ? 'aspect-[16/10] sm:aspect-auto sm:w-56' : 'aspect-[4/3]',
          !horizontal && selected && 'ring-2 ring-ink',
        )}
      >
        <LarCover hue={lar.capa.hue} variante={lar.capa.variante} className="transition-transform duration-700 ease-[cubic-bezier(.25,.1,.25,1)] group-hover:scale-[1.04]" />
        <div className="absolute top-3 left-3">
          <AvailabilityBadge lar={lar} estado={disp} est={est} overlay />
        </div>
        <div className="absolute top-2 right-2">
          <FavoriteButton larId={lar.id} larNome={lar.nome} />
        </div>
        {match && (
          <div className="absolute bottom-3 left-3 rounded-full bg-ink/85 px-3 py-1 text-sm font-semibold text-white backdrop-blur-md">
            {match.score}% compatível
          </div>
        )}
      </div>

      <div className={cn('flex flex-1 flex-col', horizontal ? 'gap-1.5 py-1 pr-2' : 'gap-1.5 px-1 pt-4')}>
        <div className="flex items-start justify-between gap-3">
          <H className="text-lg leading-snug font-semibold tracking-[-0.015em] text-ink">
            <Link
              to={`/lar/${lar.id}`}
              className="after:absolute after:inset-0 after:z-0 after:rounded-[1.75rem] after:content-[''] focus-visible:outline-none"
            >
              {lar.nome}
            </Link>
          </H>
          {lar.numAvaliacoes > 0 && (
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-sm text-ink" aria-label={`Avaliação ${lar.avaliacao.toLocaleString('pt-PT')} em 5, ${lar.numAvaliacoes} avaliações`}>
              <Star aria-hidden className="size-3.5 fill-ink text-ink" />
              {lar.avaliacao.toLocaleString('pt-PT', { minimumFractionDigits: 1 })}
              <span className="text-ink-mute">({lar.numAvaliacoes})</span>
            </span>
          )}
        </div>

        <p className="text-sm text-ink-mute">
          {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
          {distanciaKm != null && <> · {km(distanciaKm)}</>}
        </p>

        {(destaques.length > 0 || lar.verificacao.estado === 'verificado') && (
          // sem separador "|" (quando a lista quebrava de linha ficava pendurado no fim): o espaço chega para separar.
          // O "·" fica preso às duas palavras vizinhas (espaços não separáveis) para nunca ficar sozinho no fim da linha.
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-ink-soft">
            <VerifiedBadge lar={lar} />
            {destaques.length > 0 && <span>{destaques.map((c) => CUIDADO_LABEL[c]).join('\u00a0·\u00a0')}</span>}
          </p>
        )}

        <div className="mt-auto flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pt-2">
          <p className="text-ink">
            <span className="text-lg font-semibold tabular">
              {lar.natureza === 'privado' ? euro(lar.mensalidadeMin) : `${euro(lar.mensalidadeMin)}–${euro(lar.mensalidadeMax)}`}
            </span>
            <span className="text-sm text-ink-mute"> /mês</span>
            {lar.natureza !== 'privado' && <span className="block text-sm text-ink-mute">Conforme os rendimentos</span>}
          </p>
          {!centroDia && (disp !== 'disponivel' || listaAFrente) && <p className="text-sm text-ink-mute">{previsao}</p>}
        </div>
      </div>
    </article>
  )
})
