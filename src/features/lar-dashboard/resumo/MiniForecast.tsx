import { useMemo } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Cloud, CloudSun, Sun } from 'lucide-react'
import type { Lar } from '@/types'
import { previsaoMensal } from '@/lib/forecast'
import { MESES_LONGOS, pct } from '@/lib/format'
import { cn } from '@/lib/cn'

const fmt1 = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

export function nivelMes(p: number) {
  if (p >= 0.66) return { Icon: Sun, cor: 'text-leaf-700', fundo: 'bg-leaf-50', borda: 'border-leaf-200', txt: 'Provável' }
  if (p >= 0.33) return { Icon: CloudSun, cor: 'text-sun-800', fundo: 'bg-sun-50', borda: 'border-sun-200', txt: 'Possível' }
  return { Icon: Cloud, cor: 'text-dusk-700', fundo: 'bg-dusk-50', borda: 'border-dusk-200', txt: 'Pouco provável' }
}

/** Próximos 3 meses, à maneira da previsão do tempo. */
export function MiniForecast({ lar }: { lar: Lar }) {
  const meses = useMemo(() => previsaoMensal(lar, 3), [lar])
  const total = meses.reduce((s, m) => s + m.esperado, 0)
  return (
    <section aria-labelledby="mini-prev-titulo" className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-7">
      <p className="eyebrow">Previsão</p>
      <h2 id="mini-prev-titulo" className="mt-1.5 font-display text-2xl font-semibold">
        Próximos <em>3 meses</em>
      </h2>
      <p className="mt-1.5 text-ink-soft">
        Deverão libertar-se cerca de <strong className="text-ink">{fmt1(total)} lugares</strong>. Estimativa, não garantia.
      </p>
      <ol className="mt-5 grid grid-cols-3 gap-2">
        {meses.map((m) => {
          const n = nivelMes(m.pAlguma)
          return (
            <li key={`${m.ano}-${m.mes}`} className={cn('flex flex-col items-center gap-1 rounded-2xl border px-1.5 py-3 text-center', n.fundo, n.borda)}>
              <span aria-hidden className="text-sm font-bold capitalize">{MESES_LONGOS[m.mes]!.slice(0, 3)}</span>
              <n.Icon aria-hidden className={cn('size-8', n.cor)} strokeWidth={1.8} />
              <span aria-hidden className="font-display text-2xl leading-none font-semibold tabular">≈{fmt1(m.esperado)}</span>
              <span aria-hidden className="text-xs text-ink-soft">
                entre {m.min} e {m.max}
              </span>
              <span className="sr-only">
                {MESES_LONGOS[m.mes]}: cerca de {fmt1(m.esperado)} lugares libertados, entre {m.min} e {m.max}; {pct(m.pAlguma)} de probabilidade de pelo menos um.
              </span>
            </li>
          )
        })}
      </ol>
      <Link to="/gestao/previsao" className="link mt-4 inline-flex min-h-11 items-center gap-1.5">
        Ver previsão de 12 meses <ArrowRight aria-hidden className="size-4" />
      </Link>
    </section>
  )
}
