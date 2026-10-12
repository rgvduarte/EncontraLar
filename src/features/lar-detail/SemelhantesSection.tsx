import { useMemo } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCard } from '@/components/lar/LarCard'
import { Reveal } from '@/components/motion'
import { useLares } from '@/lib/store'
import { distanceKm } from '@/lib/geo'
import { Cascata } from './motion'

const PLURAL: Record<Lar['tipo'], string> = { erpi: 'lares', residencia: 'residências', centro_dia: 'centros de dia' }

/**
 * Três instituições do mesmo tipo, as mais próximas desta — o "desfecho" da página.
 * Telemóvel: faixa deslizável com snap (cartões a 85% da largura, o seguinte espreita). Desktop: grelha.
 */
export function SemelhantesSection({ lar }: { lar: Lar }) {
  const lares = useLares()
  const perto = useMemo(
    () =>
      lares
        .filter((l) => l.id !== lar.id && l.tipo === lar.tipo)
        .map((l) => ({ l, d: distanceKm(lar, l) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 3),
    [lares, lar],
  )
  if (!perto.length) return null

  const pesquisa = `/pesquisa?lat=${lar.lat.toFixed(4)}&lng=${lar.lng.toFixed(4)}&raio=15&tipo=${lar.tipo}`

  return (
    // no telemóvel/tablet o fundo reserva espaço para a barra de ação fixa
    <section aria-labelledby="semelhantes-titulo" className="overflow-hidden bg-sand pt-24 pb-28 sm:py-32">
      <div className="container-page">
        <div className="mx-auto max-w-4xl text-center">
          <Reveal variant="blur">
            <h2 id="semelhantes-titulo" className="headline">
              Outras opções perto
            </h2>
          </Reveal>
          <Reveal variant="up" delay={120}>
            <p className="mt-4 text-lg text-ink-mute sm:text-xl">Compare antes de decidir. Distâncias a partir desta instituição.</p>
            <Link to={pesquisa} className="mt-5 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
              Ver {PLURAL[lar.tipo]} no mapa
              <ChevronRight aria-hidden className="size-5" />
            </Link>
          </Reveal>
        </div>
        <Cascata
          passo={110}
          efeito="fade"
          aria-label="Instituições semelhantes perto"
          className={
            '-mx-5 mt-10 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overscroll-x-contain px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 [&::-webkit-scrollbar]:hidden ' +
            'md:mx-0 md:mt-12 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3'
          }
        >
          {perto.map(({ l, d }) => (
            <li key={l.id} className="flex w-[85%] max-w-[22rem] shrink-0 snap-start md:w-auto md:max-w-none">
              <LarCard lar={l} distanciaKm={d} className="w-full p-3 pb-5" headingLevel="h3" />
            </li>
          ))}
        </Cascata>
      </div>
    </section>
  )
}
