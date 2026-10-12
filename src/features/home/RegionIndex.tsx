import { useMemo } from 'react'
import { Link } from 'react-router'
import type { Lar } from '@/types'
import { AzulejoBand } from '@/components/brand/patterns'
import { euro } from '@/lib/format'
import { GRUPOS_DISTRITO, contarPorDistrito } from './homeData'
import { deDistrito } from './search'

/**
 * Índice de distritos, desenhado como o índice de uma estação ou de um guia de viagem:
 * nome, pontilhado, contagens. Cada linha abre a pesquisa nesse distrito.
 */
export function RegionIndex({ lares }: { lares: Lar[] }) {
  const contagens = useMemo(() => contarPorDistrito(lares), [lares])
  const grupos = GRUPOS_DISTRITO.map((g) => ({
    ...g,
    linhas: g.distritos.map((d) => contagens.get(d)).filter((c): c is NonNullable<typeof c> => Boolean(c && c.total > 0)),
  })).filter((g) => g.linhas.length > 0)

  // duas colunas equilibradas, mantendo a ordem de norte para sul
  const metade = grupos.findIndex((g) => g.grupo === 'Lisboa e Vale do Tejo')
  const colunas = metade > 0 ? [grupos.slice(0, metade), grupos.slice(metade)] : [grupos]

  return (
    <section aria-labelledby="distritos-titulo" className="py-16 lg:py-24">
      <div className="container-page grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="lg:col-span-4">
          <div className="lg:sticky lg:top-28">
            <p className="eyebrow">Índice por distrito</p>
            <h2 id="distritos-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl">
              Do Minho às <em>ilhas</em>.
            </h2>
            <p className="mt-6 text-lg text-ink-soft">
              Quantas instituições têm ficha em cada distrito e quantas indicaram lugar livre hoje. Escolha um para abrir o mapa já
              centrado.
            </p>
            <div aria-hidden className="mt-8 flex items-baseline gap-2 rounded-2xl border border-dashed border-line-strong p-4 text-sm text-ink-soft">
              <span className="font-display text-lg font-semibold text-ink">Distrito</span>
              <span className="min-w-4 flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-line-strong" />
              <span className="tabular">com ficha</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-leaf-700">
                <span className="size-2 rounded-full bg-leaf-500" /> com vaga
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-x-12 sm:grid-cols-2 lg:col-span-8">
          {colunas.map((col, ci) => (
            <div key={ci} className="flex flex-col gap-10">
              {col.map((g) => (
                <div key={g.grupo}>
                  <h3 className="flex items-center gap-3 border-b-2 border-ink pb-2 font-sans text-sm font-bold tracking-[0.14em] text-ink uppercase">
                    <AzulejoBand color="#1d564e" opacity={0.9} size={22} className="size-[22px] shrink-0 rounded-[4px] border border-pine-700/40" />
                    {g.grupo}
                  </h3>
                  <ul>
                    {g.linhas.map((c) => (
                      <li key={c.distrito} className="border-b border-line">
                        <Link
                          to={`/pesquisa?distrito=${encodeURIComponent(c.distrito)}`}
                          className="group flex min-h-14 items-baseline gap-2 py-3 hover:bg-sand/60"
                          aria-label={`Distrito ${deDistrito(c.distrito)}: ${c.total} ${c.total === 1 ? 'instituição' : 'instituições'}, ${c.comVaga} com vaga agora${c.desde ? `, desde ${euro(c.desde)} por mês` : ''}`}
                        >
                          <span className="font-display text-xl font-semibold text-ink group-hover:text-pine-800 group-hover:underline group-hover:decoration-terra-400 group-hover:underline-offset-4">
                            {c.distrito}
                          </span>
                          <span aria-hidden className="min-w-4 flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-line-strong" />
                          <span className="text-sm whitespace-nowrap text-ink-soft tabular">{c.total}</span>
                          <span
                            className={
                              c.comVaga
                                ? 'inline-flex min-w-[6.5rem] items-center justify-end gap-1.5 text-sm font-bold whitespace-nowrap text-leaf-700 tabular'
                                : 'inline-flex min-w-[6.5rem] items-center justify-end text-sm whitespace-nowrap text-ink-mute'
                            }
                          >
                            {c.comVaga ? (
                              <>
                                <span aria-hidden className="size-2 rounded-full bg-leaf-500" />
                                {c.comVaga} com vaga
                              </>
                            ) : (
                              'sem vaga hoje'
                            )}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
