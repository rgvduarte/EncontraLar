import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCard } from '@/components/lar/LarCard'
import { Reveal } from '@/components/ui/Reveal'
import { cn } from '@/lib/cn'
import { comVagaAgora } from './homeData'

const seta =
  'flex size-12 items-center justify-center rounded-full bg-sand text-ink transition-colors duration-200 hover:bg-sand-deep disabled:cursor-default disabled:text-ink-mute/40 disabled:hover:bg-sand'

/** "Com vaga agora": fila horizontal de cartões reais, com setas no ecrã grande e deslize no telemóvel. */
export function ComVagaSection({ lares }: { lares: Lar[] }) {
  const lista = useMemo(() => comVagaAgora(lares), [lares])
  const ref = useRef<HTMLUListElement>(null)
  const [pos, setPos] = useState({ inicio: true, fim: false })

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    setPos({ inicio: el.scrollLeft <= 4, fim: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    medir()
    window.addEventListener('resize', medir)
    return () => window.removeEventListener('resize', medir)
  }, [medir, lista.length])

  const mover = (dir: 1 | -1) => {
    const el = ref.current
    const item = el?.querySelector('li')
    if (!el || !item) return
    const passo = item.getBoundingClientRect().width + 20
    const porVez = Math.max(1, Math.floor(el.clientWidth / passo))
    const reduzir = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollBy({ left: dir * passo * porVez, behavior: reduzir ? 'auto' : 'smooth' })
  }

  return (
    <section aria-labelledby="com-vaga-titulo" className="overflow-x-clip pb-24 sm:pb-32 lg:pb-40">
      <div className="container-page">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="com-vaga-titulo" className="headline">
              Com vaga agora.
            </h2>
            <p className="mt-4 text-xl text-ink-mute sm:text-2xl">Lugares livres hoje, confirmados pelas instituições.</p>
            <Link to="/pesquisa?vaga=agora" className="link mt-2 inline-flex min-h-12 items-center gap-0.5 text-lg">
              Ver todas no mapa
              <ChevronRight aria-hidden className="size-4.5" />
            </Link>
          </div>
          {lista.length > 1 && (
            <div className="hidden shrink-0 gap-3 lg:flex">
              <button type="button" onClick={() => mover(-1)} disabled={pos.inicio} className={seta} aria-label="Instituições anteriores">
                <ChevronLeft aria-hidden className="size-5" />
              </button>
              <button type="button" onClick={() => mover(1)} disabled={pos.fim} className={seta} aria-label="Mais instituições com vaga">
                <ChevronRight aria-hidden className="size-5" />
              </button>
            </div>
          )}
        </Reveal>

        {lista.length === 0 ? (
          <Reveal className="mt-12 rounded-[1.75rem] bg-sand px-8 py-14 text-center">
            <p className="text-xl text-ink">Neste momento não há lugares livres.</p>
            <p className="mt-2 text-ink-mute">As vagas abrem todas as semanas. Veja onde se prevê a próxima.</p>
            <Link to="/pesquisa?vaga=breve" className="link mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg">
              Vagas previstas em breve
              <ChevronRight aria-hidden className="size-4.5" />
            </Link>
          </Reveal>
        ) : (
          <Reveal delay={120} className="relative mt-10 sm:mt-12">
            <ul
              ref={ref}
              onScroll={medir}
              aria-label="Instituições com vaga agora"
              className={cn(
                '-mx-5 flex snap-x snap-mandatory scroll-px-5 gap-5 overflow-x-auto px-5 pb-2 sm:-mx-8 sm:scroll-px-8 sm:px-8',
                'lg:mx-0 lg:scroll-px-0 lg:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              )}
            >
              {lista.map((l) => (
                <li key={l.id} className="flex w-[min(20rem,80vw)] shrink-0 snap-start sm:w-[21rem]">
                  <LarCard lar={l} className="w-full" />
                </li>
              ))}
            </ul>
            {/* margens esbatidas a indicar que há mais para o lado */}
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-y-0 left-0 hidden w-20 bg-gradient-to-r from-white to-transparent transition-opacity duration-300 lg:block',
                pos.inicio && 'opacity-0',
              )}
            />
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-y-0 right-0 hidden w-20 bg-gradient-to-l from-white to-transparent transition-opacity duration-300 lg:block',
                pos.fim && 'opacity-0',
              )}
            />
          </Reveal>
        )}
      </div>
    </section>
  )
}
