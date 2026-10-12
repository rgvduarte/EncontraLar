import { MESES_CURTOS, MESES_LONGOS, pct } from '@/lib/format'
import { useInView } from '@/lib/motion'
import { cn } from '@/lib/cn'

function cor(p: number) {
  if (p >= 0.66) return { barra: 'bg-leaf-500', txt: 'text-leaf-700', rotulo: 'Provável' }
  if (p >= 0.33) return { barra: 'bg-sun-500', txt: 'text-sun-800', rotulo: 'Possível' }
  return { barra: 'bg-dusk-500', txt: 'text-ink-mute', rotulo: 'Pouco provável' }
}

/**
 * Previsão de vaga mês a mês: probabilidade acumulada de conseguir vaga até ao fim de cada mês.
 * full = colunas com percentagem grande e barra fina; mini = barras pequenas para listas.
 */
export function ForecastStrip({
  curva,
  meses = 6,
  inicio = new Date(),
  variant = 'full',
  animate = true,
  className,
}: {
  /** probabilidades acumuladas (0–1) no fim de cada mês, a partir de `inicio` */
  curva: number[]
  meses?: number
  inicio?: Date
  variant?: 'full' | 'mini'
  /** barras enchem quando entram no ecrã (escalonadas); com movimento reduzido aparecem logo */
  animate?: boolean
  className?: string
}) {
  const [ref, inView] = useInView<HTMLElement>({ threshold: 0.2 })
  const on = !animate || inView
  const dados = curva.slice(0, meses).map((p, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1)
    return { p, mes: d.getMonth(), ano: d.getFullYear() }
  })
  const resumo = dados.map((d) => `${MESES_LONGOS[d.mes]}: ${pct(d.p)}`).join(', ')

  if (variant === 'mini') {
    return (
      <div ref={ref as React.RefObject<HTMLDivElement>} className={cn('flex items-end gap-[3px]', className)} role="img" aria-label={`Probabilidade acumulada de vaga — ${resumo}`}>
        {dados.map((d, i) => (
          <span key={i} className="relative block h-5 w-1.5 overflow-hidden rounded-full bg-sand-deep">
            <span
              className={cn('absolute inset-x-0 bottom-0 h-full origin-bottom rounded-full transition-[scale] duration-700 ease-[cubic-bezier(.16,1,.3,1)]', cor(d.p).barra)}
              style={{ scale: `1 ${on ? Math.max(0.1, d.p) : 0}`, transitionDelay: `${i * 60}ms` }}
            />
          </span>
        ))}
      </div>
    )
  }

  return (
    <ol ref={ref as React.RefObject<HTMLOListElement>} className={cn('grid grid-cols-3 gap-x-4 gap-y-6 sm:grid-cols-6', className)} aria-label="Probabilidade de conseguir vaga, mês a mês">
      {dados.map((d, i) => {
        const c = cor(d.p)
        return (
          <li key={i} className="flex flex-col gap-2">
            <span className="text-sm text-ink-mute capitalize">
              {MESES_CURTOS[d.mes]}
              {d.mes === 0 && ` ${String(d.ano).slice(2)}`}
            </span>
            <span className={cn('text-3xl font-semibold tracking-tight tabular', d.p >= 0.33 ? 'text-ink' : 'text-ink-mute')}>{pct(d.p)}</span>
            <span className="h-1 overflow-hidden rounded-full bg-sand-deep">
              <span
                className={cn('block h-full origin-left rounded-full transition-[scale] duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)]', c.barra)}
                style={{ scale: `${on ? Math.max(0.03, d.p) : 0} 1`, transitionDelay: `${i * 80}ms` }}
              />
            </span>
            <span className={cn('text-xs', c.txt)}>{c.rotulo}</span>
          </li>
        )
      })}
    </ol>
  )
}
