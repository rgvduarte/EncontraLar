/**
 * O capítulo "escuro" da página /sobre: a afirmação central acende-se palavra a palavra (TextReveal)
 * e os quatro problemas passam numa galeria horizontal guiada pelo scroll (desktop) ou deslizável
 * com o dedo (telemóvel). Com movimento reduzido no desktop, os quatro cartões ficam numa grelha.
 */
import { HorizontalScroll, Reveal, TextReveal } from '@/components/motion'
import { useMediaQuery } from '@/lib/hooks'
import { usePrefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'

const AFIRMACAO =
  'Hoje, quem procura um lar decide com pressa e quase às cegas. As vagas não estão publicadas, os preços passam de boca em boca e ninguém sabe quanto tempo vai esperar.'

const PROBLEMAS = [
  { t: 'Informação desigual.', d: 'As instituições sabem quantos lugares têm livres; as famílias só sabem se telefonarem.' },
  { t: 'Listas de espera lentas.', d: 'Inscrições em papel e telefonemas sem resposta.' },
  { t: 'Preços só por telefone.', d: 'Raramente por escrito, e quase nunca comparáveis.' },
  { t: 'Oferta invisível.', d: 'Boas casas com quartos livres que ninguém encontra a tempo.' },
] as const

function Cartao({ i, t, d, className }: { i: number; t: string; d: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-10 rounded-[1.75rem] bg-white/[0.07] p-7 ring-1 ring-white/10 ring-inset sm:p-9 lg:p-10',
        className,
      )}
    >
      <span aria-hidden className="text-[3.5rem] leading-none font-semibold tracking-tight text-white/25 tabular sm:text-7xl">
        0{i + 1}
      </span>
      <div>
        <h3 className="text-2xl font-semibold text-white sm:text-3xl">{t}</h3>
        <p className="mt-3 max-w-[30ch] text-lg text-pine-300 sm:min-h-[4.5em]">{d}</p>
      </div>
    </div>
  )
}

export function Problema() {
  const desktop = useMediaQuery('(min-width: 1024px)')
  const reduced = usePrefersReducedMotion()

  const titulo = (
    <div className="container-page mb-8 lg:mb-14">
      <Reveal variant="blur">
        <h2 id="sobre-problema" className="headline max-w-[18ch] text-white">
          Hoje, procurar um lar é assim.
        </h2>
      </Reveal>
      <p className="mt-4 text-lg text-pine-400 lg:hidden">Deslize para ver os quatro problemas.</p>
    </div>
  )

  return (
    <section aria-labelledby="sobre-problema" className="on-dark bg-pine-950 text-white">
      <div className="container-narrow py-24 sm:py-36 lg:py-48">
        <TextReveal
          text={AFIRMACAO}
          dim={0.2}
          className="text-[1.875rem] leading-[1.18] font-semibold tracking-tight text-white sm:text-5xl sm:leading-[1.1] lg:text-[3.5rem]"
        />
      </div>

      {desktop && reduced ? (
        <div className="pb-40">
          {titulo}
          <div className="container-page grid grid-cols-2 gap-4">
            {PROBLEMAS.map((p, i) => (
              <Cartao key={p.t} i={i} t={p.t} d={p.d} className="min-h-[20rem]" />
            ))}
          </div>
        </div>
      ) : (
        <HorizontalScroll
          label="Quatro problemas"
          header={titulo}
          className="pb-16 sm:pb-24 lg:pb-0"
          trackClassName="scroll-px-5 sm:scroll-px-8 lg:pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))] [&>*]:snap-start"
        >
          {PROBLEMAS.map((p, i) => (
            <Cartao key={p.t} i={i} t={p.t} d={p.d} className="h-[21rem] w-[80vw] max-w-[22rem] shrink-0 lg:h-[27rem] lg:w-[30rem] lg:max-w-none" />
          ))}
        </HorizontalScroll>
      )}
    </section>
  )
}
