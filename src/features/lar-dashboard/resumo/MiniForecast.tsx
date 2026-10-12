import { useMemo } from 'react'
import type { Lar } from '@/types'
import { previsaoMensal } from '@/lib/forecast'
import { MESES_LONGOS } from '@/lib/format'
import { Numero } from '../shared/motion'
import { MoreLink, dec1 } from '../shared/ui'

/** Próximos 3 meses: lugares que deverão libertar-se, mês a mês. */
export function MiniForecast({ lar }: { lar: Lar }) {
  const meses = useMemo(() => previsaoMensal(lar, 3), [lar])
  const total = meses.reduce((s, m) => s + m.esperado, 0)
  return (
    <section aria-labelledby="mini-prev-titulo" className="px-1">
      <h2 id="mini-prev-titulo" className="text-xl font-semibold">
        Próximos 3 meses
      </h2>
      <p className="mt-1 text-ink-mute">
        Deverão <span className="whitespace-nowrap">libertar-se</span> cerca de {dec1(total)} lugares.
      </p>
      <dl className="mt-6 grid grid-cols-3 gap-4">
        {meses.map((m) => (
          <div key={`${m.ano}-${m.mes}`} className="flex flex-col">
            <dt className="text-sm text-ink-mute capitalize">{MESES_LONGOS[m.mes]}</dt>
            <dd className="mt-1 text-3xl leading-none font-semibold tracking-tight">
              <span className="sr-only">cerca de </span>
              <Numero value={m.esperado} format={dec1} duration={1000} />
            </dd>
            <dd className="mt-1.5 text-xs text-ink-mute">
              entre {m.min} e {m.max}
            </dd>
          </div>
        ))}
      </dl>
      <MoreLink to="/gestao/previsao" className="mt-4">
        Ver os próximos 12 meses
      </MoreLink>
    </section>
  )
}
