import { useMemo } from 'react'
import { Check } from 'lucide-react'
import type { Lar } from '@/types'
import { useProcurasZona } from '@/lib/store'
import { resumirProcuras } from '@/lib/negocio'
import { euro, pct } from '@/lib/format'
import { CUIDADO_LABEL, GRAU_LABEL, noDistrito } from '@/lib/labels'
import { Barra, Numero } from '../shared/motion'

const DIAS = 30

/**
 * "Procura na sua zona": pesquisas no distrito da instituição que não encontraram vaga nos últimos 30 dias.
 * Dados anónimos (ProcuraAnonima): só o que se procurou — cuidados, grau, orçamento —, nunca quem procurou.
 */
export function ProcuraZona({ lar }: { lar: Lar }) {
  const procuras = useProcurasZona(lar, DIAS)
  const r = useMemo(() => resumirProcuras(procuras), [procuras])
  const cuidados = r.cuidados.slice(0, 3)
  const totalGraus = r.graus.reduce((s, [, n]) => s + n, 0)
  const zona = noDistrito(lar.distrito)

  return (
    <section aria-labelledby="procura-zona" className="tile">
      <h2 id="procura-zona" className="text-xl font-semibold">
        Procura na sua zona
      </h2>
      {r.total === 0 ? (
        <p className="mt-3 max-w-2xl text-ink-soft">Nos últimos {DIAS} dias, todas as pesquisas {zona} encontraram vaga.</p>
      ) : (
        <>
          <p className="mt-3 max-w-2xl text-2xl leading-snug font-semibold tracking-[-0.02em] text-ink">
            <Numero value={r.total} duration={900} /> {r.total === 1 ? 'pesquisa' : 'pesquisas'} {zona} não {r.total === 1 ? 'encontrou' : 'encontraram'}{' '}
            vaga nos últimos {DIAS} dias.
          </p>

          <div className="mt-8 grid gap-x-10 gap-y-8 md:grid-cols-3">
            {cuidados.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-ink-mute">Cuidados mais procurados</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {cuidados.map(([c, n]) => {
                    const tem = lar.cuidados.includes(c)
                    return (
                      <li key={c}>
                        <p className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0">
                            {CUIDADO_LABEL[c]}
                            {tem && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 text-sm text-leaf-700">
                                <Check aria-hidden className="size-3.5" strokeWidth={2.75} />
                                assegura
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-sm text-ink-mute tabular">{n}</span>
                        </p>
                        <Barra value={n / r.total} className="mt-1.5" />
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {totalGraus > 0 && (
              <div>
                <h3 className="text-sm font-medium text-ink-mute">Grau de dependência</h3>
                <ul className="mt-3 flex flex-col gap-3">
                  {r.graus.map(([g, n]) => (
                    <li key={g}>
                      <p className="flex items-baseline justify-between gap-3">
                        <span>{GRAU_LABEL[g]}</span>
                        <span className="shrink-0 text-sm text-ink-mute tabular">{pct(n / totalGraus)}</span>
                      </p>
                      <Barra value={n / totalGraus} className="mt-1.5" />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {r.orcamentoMediano != null && (
              <div>
                <h3 className="text-sm font-medium text-ink-mute">Orçamento mediano</h3>
                <p className="mt-3 text-4xl leading-none font-semibold tracking-tight tabular">{euro(r.orcamentoMediano)}</p>
                <p className="mt-2 text-sm text-ink-mute">por mês, de quem indicou um orçamento</p>
              </div>
            )}
          </div>
        </>
      )}
      <p className="mt-8 text-sm text-ink-mute">Dados anónimos: sem nomes nem contactos.</p>
    </section>
  )
}
