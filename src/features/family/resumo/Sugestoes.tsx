import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Map, SlidersHorizontal, UserRoundPen } from 'lucide-react'
import type { PerfilIdoso } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { LarCard } from '@/components/lar/LarCard'
import { calcadaStonesBg } from '@/components/brand/patterns'
import { recomendar } from '@/lib/matching'
import { useLares } from '@/lib/store'
import { CUIDADO_LABEL } from '@/lib/labels'
import { euro } from '@/lib/format'
import { pesquisaUrl } from '../shared/data'
import { deNome, nomeCurto, prepDe } from '../shared/text'

/** Três sugestões para o perfil principal, num painel escuro com textura de calçada. */
export function Sugestoes({ perfil, excluir }: { perfil: PerfilIdoso | undefined; excluir: Set<string> }) {
  const lares = useLares()
  const top = useMemo(() => {
    if (!perfil) return []
    return recomendar(lares, perfil, 40)
      .filter((m) => m.compativel && !excluir.has(m.larId))
      .slice(0, 3)
      .map((m) => ({ m, lar: lares.find((l) => l.id === m.larId)! }))
  }, [lares, perfil, excluir])

  return (
    <section
      aria-labelledby="sugestoes"
      className="on-dark relative overflow-hidden rounded-[2rem] bg-pine-950 px-5 py-7 text-pine-50 shadow-lift sm:px-8 sm:py-9"
      style={calcadaStonesBg('#ffffff', 0.04)}
    >
      {!perfil ? (
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.14em] text-sun-200 uppercase">Sugestões à medida</p>
          <h2 id="sugestoes" className="mt-2 font-display text-3xl font-semibold text-white">
            Diga-nos de quem cuida e mostramos as casas que <em>encaixam</em>.
          </h2>
          <p className="mt-3 text-lg text-pine-100">
            Grau de autonomia, cuidados de saúde, orçamento e zona — com isto calculamos a compatibilidade de cada instituição e a
            previsão de vaga.
          </p>
          <ButtonLink to="/familia/perfil" variant="accent" size="lg" className="mt-6" icon={<UserRoundPen aria-hidden className="size-5" />}>
            Criar perfil de cuidados
          </ButtonLink>
        </div>
      ) : (
        <>
          <p className="text-xs font-bold tracking-[0.14em] text-sun-200 uppercase">Sugestões à medida</p>
          <h2 id="sugestoes" className="mt-2 max-w-3xl font-display text-3xl font-semibold text-white sm:text-4xl">
            Casas que encaixam no perfil {prepDe(perfil)} <em>{nomeCurto(perfil.nome)}</em>
          </h2>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <p className="max-w-xl text-pine-100">
              {perfil.necessidades.length > 0 && <>{perfil.necessidades.map((n) => CUIDADO_LABEL[n].toLowerCase()).join(', ')} · </>}
              até {euro(perfil.orcamentoMax)}/mês · {perfil.raioKm} km de {perfil.local.label}. Sem as instituições onde já pediu vaga.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/familia/perfil"
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl border-2 border-white/25 px-4 font-bold text-white hover:border-white/60"
              >
                <SlidersHorizontal aria-hidden className="size-5" />
                Ajustar perfil
              </Link>
              <ButtonLink to={pesquisaUrl(perfil)} variant="accent" icon={<Map aria-hidden className="size-5" />}>
                Ver todas no mapa
              </ButtonLink>
            </div>
          </div>

          {top.length === 0 ? (
            <div className="mt-7 rounded-3xl border border-white/15 bg-white/5 p-6">
              <p className="text-lg font-bold text-white">Não encontrámos novas instituições compatíveis nesta zona.</p>
              <p className="mt-1 text-pine-100">
                Experimente alargar o raio de pesquisa ou rever o orçamento no perfil {deNome(perfil)} — muitas vezes 10 km fazem
                toda a diferença.
              </p>
              <Link to="/familia/perfil" className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-bold text-sun-200 underline underline-offset-4">
                Rever o perfil
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </div>
          ) : (
            <ul className="-mx-5 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-2 [scrollbar-width:thin] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-3">
              {top.map(({ m, lar }) => (
                <li key={lar.id} className="w-[85%] shrink-0 snap-start sm:w-auto">
                  <LarCard lar={lar} match={m} distanciaKm={m.distanciaKm} className="h-full" />
                </li>
              ))}
            </ul>
          )}
          <p className="mt-5 text-sm text-pine-200">
            A compatibilidade pesa cuidados de saúde, orçamento, distância, disponibilidade e preferências {deNome(perfil)}. A
            previsão de vaga é uma estimativa, não uma garantia.
          </p>
        </>
      )}
    </section>
  )
}
