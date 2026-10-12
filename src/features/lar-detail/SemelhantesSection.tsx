import { useMemo } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCard } from '@/components/lar/LarCard'
import { Reveal } from '@/components/ui/Reveal'
import { useLares } from '@/lib/store'
import { distanceKm } from '@/lib/geo'

const PLURAL: Record<Lar['tipo'], string> = { erpi: 'lares', residencia: 'residências', centro_dia: 'centros de dia' }

/** Três instituições do mesmo tipo, as mais próximas desta. */
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
    <section aria-labelledby="semelhantes-titulo" className="bg-sand py-24 sm:py-32">
      <div className="container-page">
        <Reveal className="mx-auto max-w-4xl text-center">
          <h2 id="semelhantes-titulo" className="headline">
            Outras opções perto
          </h2>
          <p className="mt-4 text-xl text-ink-mute">Compare antes de decidir. Distâncias a partir desta instituição.</p>
          <Link to={pesquisa} className="mt-5 inline-flex min-h-12 items-center gap-0.5 text-lg text-terra-600 hover:underline">
            Ver {PLURAL[lar.tipo]} no mapa
            <ChevronRight aria-hidden className="size-5" />
          </Link>
        </Reveal>
        <ul className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {perto.map(({ l, d }, i) => (
            <Reveal as="li" key={l.id} delay={i * 90} className="flex">
              <LarCard lar={l} distanciaKm={d} className="w-full p-3 pb-5" headingLevel="h3" />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  )
}
