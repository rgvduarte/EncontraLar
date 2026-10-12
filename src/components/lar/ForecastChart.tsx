import { useEffect, useId, useRef, useState } from 'react'
import type { PrevisaoMes } from '@/lib/forecast'
import { MESES_CURTOS, MESES_LONGOS, pct } from '@/lib/format'
import { cn } from '@/lib/cn'

const fmt1 = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 1, minimumFractionDigits: 1 })

/**
 * Gráfico de barras: vagas que deverão libertar-se por mês (com intervalo de 80%).
 * Opcional: linha com a probabilidade acumulada de conseguir vaga (eixo da direita).
 * Acessível: cada mês é focável e existe uma tabela equivalente para leitores de ecrã.
 */
export function ForecastChart({
  data,
  probabilidade,
  height = 260,
  className,
  caption = 'Vagas previstas por mês',
}: {
  data: PrevisaoMes[]
  /** probabilidade acumulada (0–1) no fim de cada mês, mesmo comprimento que data */
  probabilidade?: number[]
  height?: number
  className?: string
  caption?: string
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [active, setActive] = useState<number | null>(null)
  const tableId = useId()

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(280, Math.round(e!.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const compact = width < 520
  const padL = 36
  const padR = probabilidade ? 46 : 12
  const padT = 18
  const padB = 44
  const plotW = width - padL - padR
  const plotH = height - padT - padB
  const maxV = Math.max(2, ...data.map((d) => d.max))
  const yMax = Math.ceil(maxV)
  const step = plotW / data.length
  const barW = Math.min(36, step * 0.56)
  const y = (v: number) => padT + plotH - (v / yMax) * plotH
  const yP = (p: number) => padT + plotH - p * plotH
  const ticks = Array.from({ length: yMax + 1 }, (_, i) => i).filter((t) => yMax <= 6 || t % 2 === 0)

  const linePath = probabilidade
    ?.map((p, i) => `${i === 0 ? 'M' : 'L'}${(padL + step * i + step / 2).toFixed(1)} ${yP(p).toFixed(1)}`)
    .join(' ')

  const act = active != null ? data[active] : null

  return (
    <figure className={cn('relative', className)}>
      <figcaption className="sr-only">{caption}</figcaption>
      <div ref={wrap} className="relative w-full">
        <svg width={width} height={height} role="group" aria-describedby={tableId} className="block overflow-visible">
          {/* grelha */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={width - padR} y1={y(t)} y2={y(t)} stroke="#e5e5ea" strokeDasharray={t === 0 ? undefined : '3 5'} />
              <text x={padL - 10} y={y(t)} dy="0.35em" textAnchor="end" fontSize="13" fill="#6e6e73">
                {t}
              </text>
            </g>
          ))}
          {probabilidade &&
            [0, 0.5, 1].map((p) => (
              <text key={p} x={width - padR + 8} y={yP(p)} dy="0.35em" fontSize="13" fill="#248a3d">
                {pct(p)}
              </text>
            ))}

          {/* barras */}
          {data.map((d, i) => {
            const cx = padL + step * i + step / 2
            const isActive = active === i
            const label = `${MESES_LONGOS[d.mes]} de ${d.ano}: cerca de ${fmt1(d.esperado)} vagas libertadas (entre ${d.min} e ${d.max})${
              probabilidade ? `; probabilidade acumulada de vaga ${pct(probabilidade[i] ?? 0)}` : ''
            }`
            return (
              <g
                key={`${d.ano}-${d.mes}`}
                tabIndex={0}
                role="img"
                aria-label={label}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="cursor-default outline-none"
              >
                <rect x={cx - step / 2} y={padT} width={step} height={plotH} fill={isActive ? '#f5f5f7' : 'transparent'} rx="8" />
                <rect
                  x={cx - barW / 2}
                  y={y(d.esperado)}
                  width={barW}
                  height={Math.max(1, y(0) - y(d.esperado))}
                  rx={Math.min(8, barW / 3)}
                  fill={isActive ? '#0071e3' : d.mes === 11 || d.mes <= 1 ? '#84b9ff' : '#b8d6ff'}
                />
                <line x1={cx} x2={cx} y1={y(d.max)} y2={y(d.min)} stroke="#1d1d1f" strokeOpacity="0.35" strokeWidth="1.5" />
                <line x1={cx - 5} x2={cx + 5} y1={y(d.max)} y2={y(d.max)} stroke="#1d1d1f" strokeOpacity="0.35" strokeWidth="1.5" />
                <text x={cx} y={height - padB + 20} textAnchor="middle" fontSize="13" fontWeight={isActive ? 700 : 400} fill="#424245">
                  {compact && i % 2 === 1 ? '' : MESES_CURTOS[d.mes]}
                </text>
                {(d.mes === 0 || i === 0) && (
                  <text x={cx} y={height - padB + 37} textAnchor="middle" fontSize="12" fill="#6e6e73">
                    {d.ano}
                  </text>
                )}
              </g>
            )
          })}

          {linePath && (
            <g pointerEvents="none">
              <path d={linePath} fill="none" stroke="#248a3d" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
              {probabilidade!.map((p, i) => (
                <circle key={i} cx={padL + step * i + step / 2} cy={yP(p)} r={active === i ? 5.5 : 3.5} fill="#fff" stroke="#248a3d" strokeWidth="2.5" />
              ))}
            </g>
          )}
        </svg>

        {act && active != null && (
          <div
            aria-hidden
            className="pointer-events-none absolute z-10 w-max max-w-56 -translate-x-1/2 rounded-xl bg-white/95 px-3 py-2 text-sm shadow-lift ring-1 ring-black/5 backdrop-blur"
            style={{ left: Math.min(width - 90, Math.max(90, padL + step * active + step / 2)), top: 0 }}
          >
            <p className="font-semibold capitalize">
              {MESES_LONGOS[act.mes]} {act.ano}
            </p>
            <p>
              ≈ {fmt1(act.esperado)} vagas <span className="text-ink-mute">({act.min}–{act.max})</span>
            </p>
            {probabilidade && <p className="text-leaf-700">Prob. acumulada: {pct(probabilidade[active] ?? 0)}</p>}
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-mute">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block size-3 rounded bg-terra-200" /> Vagas libertadas (estimativa)
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="inline-block h-3 w-0.5 bg-ink/50" /> Intervalo provável (80%)
        </span>
        {probabilidade && (
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="inline-block h-0.5 w-4 rounded bg-leaf-600" /> Probabilidade de conseguir vaga
          </span>
        )}
      </div>

      <table id={tableId} className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Mês</th>
            <th scope="col">Vagas libertadas (estimativa)</th>
            <th scope="col">Intervalo provável</th>
            {probabilidade && <th scope="col">Probabilidade acumulada</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}>
              <th scope="row">
                {MESES_LONGOS[d.mes]} {d.ano}
              </th>
              <td>{fmt1(d.esperado)}</td>
              <td>
                {d.min} a {d.max}
              </td>
              {probabilidade && <td>{pct(probabilidade[i] ?? 0)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
