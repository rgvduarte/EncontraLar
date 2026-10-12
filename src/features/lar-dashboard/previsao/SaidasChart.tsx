import { useId, useState } from 'react'
import { MESES_CURTOS, MESES_LONGOS } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * Saídas registadas nos últimos 12 meses — colunas finas, uma série (sem legenda),
 * valor ao passar o rato/foco e tabela equivalente para leitores de ecrã.
 * O último valor corresponde ao mês corrente (é aí que o registo de uma vaga libertada soma).
 */
export function SaidasChart({ valores, agora = new Date() }: { valores: number[]; agora?: Date }) {
  const [ativo, setAtivo] = useState<number | null>(null)
  const tabelaId = useId()
  const dados = valores.slice(-12).map((v, i, arr) => {
    const d = new Date(agora.getFullYear(), agora.getMonth() - (arr.length - 1 - i), 1)
    return { v, mes: d.getMonth(), ano: d.getFullYear() }
  })
  const max = Math.max(1, ...dados.map((d) => d.v))
  const passo = max <= 6 ? 1 : Math.ceil(max / 4)
  const topo = Math.ceil(max / passo) * passo
  const ticks = Array.from({ length: topo / passo + 1 }, (_, i) => i * passo)

  return (
    <figure>
      <figcaption className="sr-only">Saídas de residentes por mês, nos últimos 12 meses</figcaption>
      <div className="relative grid grid-cols-[1.75rem_1fr] gap-x-2">
        {/* eixo e grelha */}
        <div aria-hidden className="relative h-48">
          {ticks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2 text-xs text-ink-mute tabular" style={{ bottom: `${(t / topo) * 100}%` }}>
              {t}
            </span>
          ))}
        </div>
        <div className="relative h-48" aria-describedby={tabelaId}>
          {ticks.map((t) => (
            <span key={t} aria-hidden className={cn('absolute inset-x-0 h-px', t === 0 ? 'bg-line-strong' : 'bg-line')} style={{ bottom: `${(t / topo) * 100}%` }} />
          ))}
          <ol className="absolute inset-0 flex items-end gap-0.5">
            {dados.map((d, i) => (
              <li
                key={`${d.ano}-${d.mes}`}
                tabIndex={0}
                aria-label={`${MESES_LONGOS[d.mes]} de ${d.ano}: ${d.v} ${d.v === 1 ? 'saída' : 'saídas'}`}
                onMouseEnter={() => setAtivo(i)}
                onMouseLeave={() => setAtivo(null)}
                onFocus={() => setAtivo(i)}
                onBlur={() => setAtivo(null)}
                className="relative flex h-full flex-1 cursor-default items-end justify-center rounded-md outline-none focus-visible:bg-sand"
              >
                <span
                  className={cn(
                    'block w-full max-w-6 rounded-t-[4px] transition-colors duration-200',
                    ativo === i ? 'bg-ink' : i === dados.length - 1 ? 'bg-pine-500' : 'bg-pine-300',
                  )}
                  style={{ height: d.v > 0 ? `${(d.v / topo) * 100}%` : '2px' }}
                />
                {ativo === i && (
                  <span aria-hidden className="pointer-events-none absolute -top-9 z-10 rounded-lg bg-white px-2.5 py-1 text-sm whitespace-nowrap shadow-lift ring-1 ring-black/5">
                    <span className="capitalize">{MESES_CURTOS[d.mes]}</span>: <strong className="font-semibold">{d.v}</strong>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
        <span />
        <ol aria-hidden className="mt-2 flex gap-0.5">
          {dados.map((d, i) => (
            <li key={`${d.ano}-${d.mes}`} className="flex-1 text-center text-xs text-ink-mute">
              <span className={cn((dados.length - 1 - i) % 2 === 1 && 'max-sm:invisible')}>{MESES_CURTOS[d.mes]}</span>
            </li>
          ))}
        </ol>
      </div>
      <table id={tabelaId} className="sr-only">
        <caption>Saídas por mês</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Saídas</th>
          </tr>
        </thead>
        <tbody>
          {dados.map((d) => (
            <tr key={`${d.ano}-${d.mes}`}>
              <th scope="row">
                {MESES_LONGOS[d.mes]} {d.ano}
              </th>
              <td>{d.v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
