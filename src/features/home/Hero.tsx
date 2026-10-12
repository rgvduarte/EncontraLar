import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { Reveal } from '@/components/ui/Reveal'
import { SearchPill } from './SearchPill'
import { HeroMap } from './HeroMap'

export function Hero({ lares, agora, comVaga }: { lares: Lar[]; agora: number; comVaga: number }) {
  return (
    <section aria-labelledby="home-titulo" className="overflow-x-clip">
      <div className="container-page flex flex-col items-center pt-16 pb-20 text-center sm:pt-24 lg:pt-28 lg:pb-28">
        <Reveal>
          <p className="eyebrow">Lares e residências seniores em Portugal</p>
        </Reveal>
        <Reveal delay={80}>
          <h1
            id="home-titulo"
            className="mt-4 text-[2.875rem] leading-[1.04] font-semibold text-ink sm:mt-5 sm:text-6xl lg:text-7xl"
          >
            O lar certo.
            <br />
            <em>Com vaga real.</em>
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-ink-mute sm:mt-6 sm:text-2xl">
            Vagas atualizadas pelas próprias instituições e a previsão de quando abre a próxima.
          </p>
        </Reveal>

        <Reveal delay={240} className="relative z-20 mt-10 w-full sm:mt-12">
          <SearchPill lares={lares} />
        </Reveal>
        <Reveal delay={300} className="mt-5">
          <p className="text-ink-mute">
            Não sabe por onde começar?{' '}
            <Link to="/encontrar" className="link inline-flex min-h-12 items-center gap-0.5 whitespace-nowrap">
              Ajuda-me a escolher
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          </p>
        </Reveal>

        <Reveal delay={380} className="mt-10 w-full sm:mt-20">
          <HeroMap lares={lares} agora={agora} comVaga={comVaga} />
        </Reveal>
      </div>
    </section>
  )
}
