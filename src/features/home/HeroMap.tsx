import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Lar } from '@/types'
import { MapLegend, PortugalMap } from '@/components/brand/PortugalMap'
import { vagasLivres } from '@/lib/forecast'
import { cn } from '@/lib/cn'
import { tempoCurto, ultimasVagas } from './homeData'

/** Onde pousa cada etiqueta em ecrãs largos (≥1280px): no mar a oeste e em Espanha a leste, longe dos pontos. */
const POSICAO = [
  'xl:absolute xl:top-[13%] xl:right-[70%]',
  'xl:absolute xl:top-[38%] xl:left-[84%]',
  'xl:absolute xl:top-[66%] xl:left-[86%]',
]

/**
 * O "produto como imagem": o mapa de Portugal em pontos, com as últimas vagas a flutuar à volta.
 * Passar o rato (ou o foco) numa etiqueta realça o ponto da instituição no mapa.
 */
export function HeroMap({ lares, agora, comVaga }: { lares: Lar[]; agora: number; comVaga: number }) {
  const navigate = useNavigate()
  const [destaque, setDestaque] = useState<string | null>(null)
  const ultimas = useMemo(() => ultimasVagas(lares, 3), [lares])
  const mapaRef = useRef<HTMLDivElement>(null)

  // O PortugalMap declara role="img" mas, com onSelect, contém ligações focáveis (um "img" não pode ter
  // controlos lá dentro). Até o componente partilhado tratar disto, expomo-lo como grupo de ligações.
  useEffect(() => {
    mapaRef.current?.querySelector('svg[role="img"]')?.setAttribute('role', 'group')
  }, [])

  return (
    <figure className="relative mx-auto w-full max-w-[19rem] sm:max-w-[30rem] lg:max-w-[34rem]">
      <div ref={mapaRef}>
        <PortugalMap
          lares={lares}
          highlightId={destaque}
          onSelect={(l) => navigate(`/lar/${l.id}`)}
          title={`Mapa de Portugal com ${lares.length} instituições, ${comVaga} com vaga agora. Cada ponto abre a ficha da instituição.`}
        />
      </div>

      {ultimas.length > 0 && (
        <ul aria-label="Vagas atualizadas há menos tempo" className="mt-8 flex flex-col items-center gap-3 xl:mt-0">
          {ultimas.map((l, i) => {
            const n = vagasLivres(l)
            return (
              <li key={l.id} className={cn(POSICAO[i], i === 2 && 'max-xl:hidden')}>
                <Link
                  to={`/lar/${l.id}`}
                  onMouseEnter={() => setDestaque(l.id)}
                  onMouseLeave={() => setDestaque(null)}
                  onFocus={() => setDestaque(l.id)}
                  onBlur={() => setDestaque(null)}
                  className={cn(
                    'flex min-h-12 items-center gap-2.5 rounded-full bg-white/90 py-2 pr-5 pl-4 text-sm whitespace-nowrap shadow-card ring-1 ring-black/5 backdrop-blur-md',
                    'transition-transform duration-300 ease-[cubic-bezier(.25,.1,.25,1)] hover:-translate-y-0.5',
                  )}
                >
                  <span aria-hidden className="size-2 shrink-0 animate-pulse-ring rounded-full bg-leaf-500" />
                  <span className="max-w-[11rem] truncate font-medium text-ink sm:max-w-[15rem]">{l.nome}</span>
                  <span className="text-ink-mute">
                    · {n} {n === 1 ? 'vaga' : 'vagas'} · {tempoCurto(l.atualizadoEm, agora)}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <figcaption className="mt-8 flex justify-center xl:mt-10">
        <MapLegend className="justify-center" />
      </figcaption>
    </figure>
  )
}
