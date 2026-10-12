import { cn } from '@/lib/cn'

const MAX_CAMAS = 120

/**
 * "Planta" de camas: uma pequena cama por lugar — livres em verde (com almofada clara), ocupadas em pinho.
 * Ajuda a ler a ocupação de relance, sem gráficos abstratos.
 */
export function BedMap({
  total,
  livres,
  size = 'sm',
  className,
  label,
}: {
  total: number
  livres: number
  size?: 'sm' | 'md'
  className?: string
  /** descrição para leitores de ecrã (por omissão: "N camas: X livres, Y ocupadas") */
  label?: string
}) {
  const t = Math.max(0, total)
  const l = Math.max(0, Math.min(t, livres))
  const mostradas = Math.min(t, MAX_CAMAS)
  const resto = t - mostradas
  const aria = label ?? `${t} ${t === 1 ? 'lugar' : 'lugares'}: ${l} ${l === 1 ? 'livre' : 'livres'}, ${t - l} ${t - l === 1 ? 'ocupado' : 'ocupados'}`
  return (
    <div role="img" aria-label={aria} className={cn('flex flex-wrap items-end', size === 'sm' ? 'gap-1' : 'gap-1.5', className)}>
      {Array.from({ length: mostradas }, (_, i) => {
        const livre = i < l
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              'relative block shrink-0 rounded-[3px] transition-colors duration-300',
              size === 'sm' ? 'h-4 w-3' : 'h-6 w-[1.125rem] rounded-[4px]',
              livre ? 'bg-leaf-50 ring-2 ring-leaf-500 ring-inset' : 'bg-pine-700',
            )}
          >
            <span
              className={cn(
                'absolute inset-x-[2px] rounded-[1px]',
                size === 'sm' ? 'top-[2px] h-[3px]' : 'top-[3px] h-[5px] inset-x-[3px]',
                livre ? 'bg-leaf-500' : 'bg-pine-300',
              )}
            />
          </span>
        )
      })}
      {resto > 0 && <span className="ml-1 text-xs font-bold text-ink-mute">+{resto}</span>}
    </div>
  )
}

export function BedLegend({ className }: { className?: string }) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-soft', className)}>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="relative block h-4 w-3 rounded-[3px] bg-leaf-50 ring-2 ring-leaf-500 ring-inset" />
        Livre
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="relative block h-4 w-3 rounded-[3px] bg-pine-700" />
        Ocupado
      </span>
    </p>
  )
}
