import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import { tempoCurto, type HomeStats } from './homeData'

/** Números em direto, em Fraunces grande, separados por filetes — sem cartões nem ícones. */
export function HeroStats({ stats, agora }: { stats: HomeStats; agora: number }) {
  const itens = [
    { valor: String(stats.total), rotulo: 'instituições com ficha', destaque: false },
    { valor: String(stats.comVaga), rotulo: 'com vaga agora', destaque: true },
    { valor: String(stats.distritos), rotulo: 'distritos e regiões autónomas', destaque: false },
    {
      valor: tempoCurto(stats.ultima, agora),
      rotulo: 'desde a última vaga atualizada',
      destaque: false,
      titulo: stats.ultima ? `Última atualização ${tempoRelativo(stats.ultima, new Date(agora))}` : undefined,
    },
  ]
  return (
    <dl className="grid grid-cols-2 gap-y-6 sm:grid-cols-4">
      {itens.map((it, i) => (
        <div
          key={it.rotulo}
          title={it.titulo}
          className={cn(
            'flex flex-col gap-1 pr-3',
            i > 0 && 'sm:border-l sm:border-line-strong sm:pl-5',
            i % 2 === 1 && 'border-l border-line-strong pl-5',
          )}
        >
          <dt className="order-last text-sm leading-snug text-ink-soft">{it.rotulo}</dt>
          <dd className={cn('flex items-center gap-2 font-display text-4xl leading-none font-semibold tabular sm:text-5xl', it.destaque ? 'text-leaf-700' : 'text-ink')}>
            {it.destaque && <span aria-hidden className="size-3 shrink-0 animate-pulse-ring rounded-full bg-leaf-500" />}
            {it.valor}
          </dd>
        </div>
      ))}
    </dl>
  )
}
