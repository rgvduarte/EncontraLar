import { useMemo } from 'react'
import type { PerfilIdoso } from '@/types'
import { ButtonLink } from '@/components/ui/Button'
import { LarCard } from '@/components/lar/LarCard'
import { LinhasBloqueadas } from '@/components/acesso'
import { recomendar } from '@/lib/matching'
import { useAcesso, useLares } from '@/lib/store'
import { pesquisaUrl } from '../shared/data'
import { MoreLink, SectionHeader } from '../shared/ui'
import { Tween, useStagger } from '../shared/motion'
import { comArtigo, deNome } from '../shared/text'

/**
 * As três instituições mais compatíveis com o perfil principal (sem as que já têm pedido).
 * Versão grátis: só quantas são (no raio do perfil) e quantas têm vaga agora — nunca quais.
 */
export function Sugestoes({ perfil, excluir }: { perfil: PerfilIdoso | undefined; excluir: Set<string> }) {
  const lares = useLares()
  const { completo } = useAcesso()
  const [ul, item] = useStagger<HTMLUListElement>('right', 90)
  const top = useMemo(() => {
    if (!perfil || !completo) return []
    const porId = new Map(lares.map((l) => [l.id, l]))
    return recomendar(lares, perfil, 40)
      .filter((m) => m.compativel && !excluir.has(m.larId))
      .slice(0, 3)
      .flatMap((m) => {
        const lar = porId.get(m.larId)
        return lar ? [{ m, lar }] : []
      })
  }, [lares, perfil, excluir, completo])
  // a mesma conta do perfil de cuidados: compatíveis dentro da distância escolhida; "com vaga agora" = lugar para
  // quem pede hoje (um lugar livre já prometido à lista de espera não conta)
  const contagem = useMemo(() => {
    if (!perfil || completo) return null
    const dentro = recomendar(lares, perfil, 500).filter((m) => m.compativel && m.distanciaKm <= perfil.raioKm)
    return { total: dentro.length, comVaga: dentro.filter((m) => m.espera.imediata).length }
  }, [lares, perfil, completo])

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

  const semNenhuma = (novas: boolean) => (
    <div className="mt-6 tile">
      <p className="max-w-xl text-lg text-ink-soft">
        Não há {novas ? 'novas instituições compatíveis' : 'instituições compatíveis'} nesta zona. Alargar o raio ou rever o
        orçamento no perfil {deNome(perfil)} costuma ajudar.
      </p>
      <MoreLink to="/familia/perfil" className="mt-3">
        Rever o perfil
      </MoreLink>
    </div>
  )

  if (contagem) {
    const { total, comVaga } = contagem
    return (
      <section aria-labelledby="sugestoes">
        <SectionHeader
          id="sugestoes"
          title={`Sugestões para ${comArtigo(perfil)}`}
          sub={`Na zona do perfil, até ${perfil.raioKm} km.`}
          action={<MoreLink to={pesquisaUrl(perfil)}>Ver no mapa</MoreLink>}
        />
        {total === 0 ? (
          semNenhuma(false)
        ) : (
          <>
            <p className="mt-6 max-w-3xl text-2xl leading-snug font-semibold tracking-tight sm:text-3xl">
              <Tween value={total} fromZero duration={900} /> {total === 1 ? 'compatível' : 'compatíveis'} com o perfil {deNome(perfil)},{' '}
              <span className={comVaga > 0 ? 'text-leaf-700' : 'text-ink-mute'}>
                <Tween value={comVaga} fromZero duration={900} /> com vaga agora
              </span>
              .
            </p>
            <LinhasBloqueadas n={Math.min(total, 3)} rotulo="Quais são, com vaga, preço e contactos" voltar="/familia" className="mt-8" />
          </>
        )}
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
        semNenhuma(true)
      ) : (
        <ul
          ref={ul}
          data-lenis-prevent-horizontal
          className="relative -mx-5 mt-8 flex snap-x snap-mandatory scroll-px-5 gap-4 overflow-x-auto overscroll-x-contain overscroll-y-auto! px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:gap-5 sm:scroll-px-8 sm:px-8 lg:mx-0 lg:px-0 xl:grid xl:grid-cols-3 xl:overflow-visible xl:pb-0"
        >
          {top.map(({ m, lar }, i) => (
            <li key={lar.id} {...item(i, 'w-[82%] max-w-[21rem] shrink-0 snap-start xl:w-auto xl:max-w-none')}>
              <LarCard lar={lar} match={m} distanciaKm={m.distanciaKm} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
