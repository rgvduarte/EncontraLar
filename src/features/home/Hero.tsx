import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import type { Lar } from '@/types'
import { SearchPanel } from './SearchPanel'
import { HeroMap } from './HeroMap'
import { HeroStats } from './HeroStats'
import type { HomeStats } from './homeData'

const diaDaSemana = (agora: number) => new Date(agora).toLocaleDateString('pt-PT', { weekday: 'long' })
const diaEMes = (agora: number) => new Date(agora).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })

export function Hero({ lares, stats, agora }: { lares: Lar[]; stats: HomeStats; agora: number }) {
  return (
    <section aria-labelledby="home-titulo" className="relative overflow-x-clip">
      <div className="container-page pt-8 pb-14 sm:pt-12 lg:pt-14 lg:pb-20">
        <div className="grid grid-cols-1 gap-x-12 gap-y-12 lg:grid-cols-12">
          <div className="flex flex-col lg:col-span-7">
            {/* linha de data, como num jornal */}
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line-strong pb-3 text-xs font-bold tracking-[0.08em] text-ink-soft uppercase sm:text-sm">
              <span>
                <span className="hidden sm:inline">{diaDaSemana(agora)}, </span>
                {diaEMes(agora)}
              </span>
              <span aria-hidden className="text-line-strong">
                /
              </span>
              <span className="text-leaf-700">
                {stats.comVaga} <span className="hidden sm:inline">instituições </span>com vaga hoje
              </span>
            </p>

            <h1
              id="home-titulo"
              className="mt-5 text-[2.6rem] leading-[1.02] font-semibold tracking-tight text-ink sm:mt-6 sm:text-6xl xl:text-[4.6rem]"
            >
              Um lar com vaga, <em>perto</em> de quem ama.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-ink-soft sm:mt-5 sm:text-xl">
              Vagas atualizadas pelas próprias instituições, o preço real de cada quarto e uma previsão honesta de quando abre a
              próxima vaga — em lares, residências e centros de dia de todo o país.
            </p>

            <div className="mt-6 sm:mt-8">
              <SearchPanel lares={lares} />
            </div>

            <Link
              to="/encontrar"
              className="group mt-5 flex min-h-14 items-center gap-4 rounded-2xl border-2 border-dashed border-line-strong px-5 py-3 transition-colors hover:border-terra-400 hover:bg-terra-50/60"
            >
              <span className="flex-1 leading-snug">
                <span className="block text-ink-soft">Não sabe por onde começar?</span>
                <span className="block font-bold text-ink group-hover:text-terra-700">
                  Responda a 6 perguntas e mostramos os lares compatíveis
                </span>
              </span>
              <ArrowRight aria-hidden className="size-6 shrink-0 text-terra-600 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="lg:col-span-5 lg:pt-14">
            <HeroMap lares={lares} comVaga={stats.comVaga} agora={agora} />
          </div>
        </div>

        <div className="mt-14 border-t-2 border-ink pt-6">
          <HeroStats stats={stats} agora={agora} />
        </div>
      </div>
    </section>
  )
}
