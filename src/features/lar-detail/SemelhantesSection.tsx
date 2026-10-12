import { useMemo } from 'react'
import { ArrowRight } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCard } from '@/components/lar/LarCard'
import { ButtonLink } from '@/components/ui/Button'
import { CalcadaDivider } from '@/components/brand/patterns'
import { useLares } from '@/lib/store'
import { distanceKm } from '@/lib/geo'

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

  const tipoPlural = lar.tipo === 'erpi' ? 'lares' : lar.tipo === 'residencia' ? 'residências seniores' : 'centros de dia'
  const tipoFrase = lar.tipo === 'residencia' ? 'As residências seniores' : `Os ${tipoPlural}`
  const pesquisa = `/pesquisa?distrito=${encodeURIComponent(lar.distrito)}&tipo=${lar.tipo}`

  return (
    <section aria-labelledby="semelhantes-titulo" className="mt-20">
      <CalcadaDivider color="#f4ede2" height={20} />
      <div className="bg-sand pt-12 pb-16 sm:pt-14 sm:pb-20">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <p className="eyebrow">Comparar antes de decidir</p>
              <h2 id="semelhantes-titulo" className="mt-2 text-3xl font-semibold sm:text-4xl">
                Outras opções <em>perto</em>
              </h2>
              <p className="mt-3 text-lg text-ink-soft">
                {tipoFrase} mais {lar.tipo === 'residencia' ? 'próximas' : 'próximos'} de {lar.nome}, com as vagas e a previsão de hoje. As distâncias
                contam a partir desta instituição.
              </p>
            </div>
            <ButtonLink to={pesquisa} variant="secondary" iconRight={<ArrowRight aria-hidden className="size-5" />}>
              Ver {tipoPlural} no mapa
            </ButtonLink>
          </div>
          <ul className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {perto.map(({ l, d }) => (
              <li key={l.id} className="flex">
                <LarCard lar={l} distanciaKm={d} className="w-full" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
