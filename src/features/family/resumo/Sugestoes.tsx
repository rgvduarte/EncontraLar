import { useMemo } from 'react'
import type { PerfilIdoso } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { LarCard } from '@/components/lar/LarCard'
import { recomendar } from '@/lib/matching'
import { useLares } from '@/lib/store'
import { pesquisaUrl } from '../shared/data'
import { MoreLink, SectionHeader } from '../shared/ui'
import { comArtigo, deNome } from '../shared/text'

/** As três instituições mais compatíveis com o perfil principal (sem as que já têm pedido). */
export function Sugestoes({ perfil, excluir }: { perfil: PerfilIdoso | undefined; excluir: Set<string> }) {
  const lares = useLares()
  const top = useMemo(() => {
    if (!perfil) return []
    const porId = new Map(lares.map((l) => [l.id, l]))
    return recomendar(lares, perfil, 40)
      .filter((m) => m.compativel && !excluir.has(m.larId))
      .slice(0, 3)
      .flatMap((m) => {
        const lar = porId.get(m.larId)
        return lar ? [{ m, lar }] : []
      })
  }, [lares, perfil, excluir])

  if (!perfil) {
    return (
      <section aria-labelledby="sugestoes" className="tile">
        <h2 id="sugestoes" className="max-w-xl text-3xl font-semibold">
          Diga-nos de quem cuida e mostramos as casas que encaixam.
        </h2>
        <p className="mt-3 max-w-xl text-lg text-ink-mute">Autonomia, cuidados de saúde, zona e orçamento. Leva dois minutos.</p>
        <ButtonLink to="/familia/perfil" className="mt-7">
          Criar perfil de cuidados
        </ButtonLink>
      </section>
    )
  }

  return (
    <section aria-labelledby="sugestoes">
      <SectionHeader
        id="sugestoes"
        title={`Sugestões para ${comArtigo(perfil)}`}
        sub="As mais compatíveis com o perfil, sem as que já têm pedido."
        action={<MoreLink to={pesquisaUrl(perfil)}>Ver no mapa</MoreLink>}
      />
      {top.length === 0 ? (
        <div className="mt-6 tile">
          <p className="max-w-xl text-lg text-ink-soft">
            Não há novas instituições compatíveis nesta zona. Alargar o raio ou rever o orçamento no perfil {deNome(perfil)} costuma
            ajudar.
          </p>
          <MoreLink to="/familia/perfil" className="mt-3">
            Rever o perfil
          </MoreLink>
        </div>
      ) : (
        <ul className="-mx-5 mt-8 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:px-0 xl:grid xl:grid-cols-3 xl:overflow-visible xl:pb-0">
          {top.map(({ m, lar }) => (
            <li key={lar.id} className="w-[82%] max-w-[21rem] shrink-0 snap-start xl:w-auto xl:max-w-none">
              <LarCard lar={lar} match={m} distanciaKm={m.distanciaKm} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
