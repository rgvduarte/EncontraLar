import { CountUp } from '@/components/motion/CountUp'
import { ScrollZoom } from '@/components/motion/ScrollZoom'
import { TextReveal } from '@/components/motion/TextReveal'
import { Reveal } from './Entrada'
import { num } from '@/lib/format'
import type { HomeStats } from './homeData'

/** A afirmação da página (a única TextReveal): o problema, em palavras simples, e a resposta. */
const AFIRMACAO =
  'Encontrar um lar ainda depende de telefonemas e do boca a boca. Aqui, as vagas reais de todo o país estão à vista.'

/**
 * Contexto: depois do mapa, o ecrã passa a preto. O bloco cresce até ocupar a largura toda (zoom de produto),
 * a frase acende-se palavra a palavra com o scroll e os três números contam quando aparecem.
 */
export function Contexto({ stats }: { stats: HomeStats }) {
  const itens = [
    { valor: stats.total, rotulo: 'instituições', vivo: false },
    { valor: stats.comVaga, rotulo: 'com vaga agora', vivo: true },
    { valor: stats.distritos, rotulo: 'distritos e ilhas', vivo: false },
  ]
  return (
    <section aria-labelledby="contexto-titulo" className="overflow-x-clip">
      <ScrollZoom from={0.93} radiusFrom={48} radiusTo={0} className="on-dark bg-pine-950 text-white">
        <div className="container-page py-20 sm:py-32 lg:py-44">
          <h2 id="contexto-titulo" className="sr-only">
            Porque existe o EncontraLar
          </h2>
          <TextReveal
            text={AFIRMACAO}
            dim={0.22}
            className="mx-auto max-w-5xl text-[2rem] leading-[1.14] font-semibold tracking-[-0.03em] text-white sm:text-5xl sm:leading-[1.08] lg:text-6xl"
          />

          <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-3 gap-3 border-t border-white/15 pt-10 sm:mt-24 sm:gap-8 sm:pt-14">
            {itens.map((it, i) => (
              <Reveal key={it.rotulo} delay={i * 120} className="flex flex-col-reverse items-start justify-end gap-1.5 sm:gap-2">
                <dt className="flex items-center gap-2 text-sm leading-snug text-pine-300 sm:text-lg">
                  {it.vivo && <span aria-hidden className="hidden size-2 shrink-0 animate-pulse-ring rounded-full bg-leaf-500 sm:block" />}
                  {it.rotulo}
                </dt>
                <dd className="text-[2.5rem] leading-none font-semibold tracking-[-0.04em] text-white tabular sm:text-6xl lg:text-7xl">
                  <CountUp value={it.valor} format={(n) => num(Math.round(n))} />
                </dd>
              </Reveal>
            ))}
          </dl>
        </div>
      </ScrollZoom>
    </section>
  )
}
