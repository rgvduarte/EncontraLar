import { CloudSun, Sun, Cloud } from 'lucide-react'
import { MESES_CURTOS, MESES_LONGOS, pct } from '@/lib/format'
import { cn } from '@/lib/cn'

/**
 * "Previsão do tempo" das vagas: probabilidade acumulada de conseguir vaga até ao fim de cada mês.
 * Metáfora familiar para o público (todos leem a previsão do tempo).
 */
function nivel(p: number) {
  if (p >= 0.66) return { Icon: Sun, cor: 'text-leaf-700', fundo: 'bg-leaf-500', claro: 'bg-leaf-50', txt: 'Provável' }
  if (p >= 0.33) return { Icon: CloudSun, cor: 'text-sun-800', fundo: 'bg-sun-400', claro: 'bg-sun-50', txt: 'Possível' }
  return { Icon: Cloud, cor: 'text-dusk-700', fundo: 'bg-dusk-500', claro: 'bg-dusk-50', txt: 'Pouco provável' }
}

export function ForecastStrip({
  curva,
  meses = 6,
  inicio = new Date(),
  variant = 'full',
  className,
}: {
  /** probabilidades acumuladas (0–1) no fim de cada mês, a partir de `inicio` */
  curva: number[]
  meses?: number
  inicio?: Date
  /** full = cartões com ícone; mini = barras pequenas para cartões de lista */
  variant?: 'full' | 'mini'
  className?: string
}) {
  const dados = curva.slice(0, meses).map((p, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1)
    return { p, mes: d.getMonth(), ano: d.getFullYear() }
  })
  const resumo = dados.map((d) => `${MESES_LONGOS[d.mes]}: ${pct(d.p)}`).join(', ')

  if (variant === 'mini') {
    return (
      <div className={cn('flex items-end gap-1', className)} role="img" aria-label={`Probabilidade acumulada de vaga — ${resumo}`}>
        {dados.map((d, i) => {
          const n = nivel(d.p)
          return (
            <span key={i} className="flex flex-col items-center gap-0.5">
              <span className={cn('relative block h-6 w-4 overflow-hidden rounded-[5px]', n.claro)}>
                <span className={cn('absolute inset-x-0 bottom-0 rounded-[5px]', n.fundo)} style={{ height: `${Math.max(8, d.p * 100)}%` }} />
              </span>
              <span aria-hidden className="text-[11px] leading-none text-ink-mute">{MESES_CURTOS[d.mes]![0]!.toUpperCase()}</span>
            </span>
          )
        })}
      </div>
    )
  }

  return (
    <ol className={cn('grid grid-cols-3 gap-2 sm:grid-cols-6', className)} aria-label="Previsão de vaga por mês (probabilidade acumulada)">
      {dados.map((d, i) => {
        const n = nivel(d.p)
        return (
          <li key={i} className={cn('flex flex-col items-center gap-1 rounded-2xl border border-line px-2 py-3 text-center', n.claro)}>
            <span className="text-sm font-bold text-ink capitalize">
              {MESES_CURTOS[d.mes]}
              {d.mes === 0 && <span className="font-normal text-ink-mute"> {String(d.ano).slice(2)}</span>}
            </span>
            <n.Icon aria-hidden className={cn('size-8', n.cor)} strokeWidth={1.8} />
            <span className={cn('font-display text-2xl leading-none font-semibold', n.cor)}>{pct(d.p)}</span>
            <span className="text-xs text-ink-soft">{n.txt}</span>
          </li>
        )
      })}
    </ol>
  )
}
