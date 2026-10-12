import { CountUp } from '@/components/motion/CountUp'
import { Reveal } from '@/components/ui/Reveal'
import { num } from '@/lib/format'
import type { HomeStats } from './homeData'

/** Três números, calculados a partir do store. */
export function Numbers({ stats }: { stats: HomeStats }) {
  const itens = [
    { valor: stats.total, rotulo: 'instituições', vivo: false },
    { valor: stats.comVaga, rotulo: 'com vaga agora', vivo: true },
    { valor: stats.distritos, rotulo: 'distritos e ilhas', vivo: false },
  ]
  return (
    <section aria-labelledby="numeros-titulo" className="bg-sand py-16 sm:py-24">
      <h2 id="numeros-titulo" className="sr-only">
        O EncontraLar hoje
      </h2>
      <dl className="container-page grid grid-cols-3 gap-4 text-center sm:gap-8">
        {itens.map((it, i) => (
          <Reveal key={it.rotulo} delay={i * 100} className="flex flex-col-reverse items-center justify-end gap-1 sm:gap-2">
            <dt className="flex items-center gap-2 text-sm leading-snug text-ink-mute sm:text-lg">
              {it.vivo && <span aria-hidden className="hidden size-2 shrink-0 animate-pulse-ring rounded-full bg-leaf-500 sm:block" />}
              {it.rotulo}
            </dt>
            <dd className="text-[2.75rem] leading-none font-semibold tracking-[-0.04em] text-ink tabular sm:text-6xl lg:text-7xl">
              <span className="sr-only">{num(it.valor)}</span>
              <span aria-hidden>
                <CountUp value={it.valor} format={(n) => num(Math.round(n))} />
              </span>
            </dd>
          </Reveal>
        ))}
      </dl>
    </section>
  )
}
