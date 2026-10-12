import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Lar } from '@/types'
import { vagasLivres } from '@/lib/forecast'
import { tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'

/** Lista "em direto" das vagas atualizadas mais recentemente pelas instituições (roda devagar). */
export function VagasBoard({
  lares,
  linhas = 5,
  className,
  titulo = 'Atualizadas agora',
  theme = 'light',
}: {
  lares: Lar[]
  linhas?: number
  className?: string
  titulo?: string
  theme?: 'light' | 'dark'
}) {
  const lista = useMemo(
    () =>
      lares
        .filter((l) => vagasLivres(l) > 0 && l.tipo !== 'centro_dia')
        .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
        .slice(0, 15),
    [lares],
  )
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (lista.length <= linhas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setOffset((o) => (o + 1) % lista.length), 4500)
    return () => clearInterval(t)
  }, [lista.length, linhas])
  const visiveis = Array.from({ length: Math.min(linhas, lista.length) }, (_, i) => lista[(offset + i) % lista.length]!)
  const dark = theme === 'dark'

  return (
    <section
      aria-label={titulo}
      className={cn('overflow-hidden rounded-[1.75rem]', dark ? 'bg-pine-800 text-white' : 'bg-white ring-1 ring-line', className)}
    >
      <header className="flex items-center justify-between gap-3 px-6 pt-5 pb-3">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-500 opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-leaf-500" />
          </span>
          {titulo}
        </p>
        <span className={cn('text-xs', dark ? 'text-pine-400' : 'text-ink-mute')}>{lista.length} com vaga</span>
      </header>
      <ol aria-live="off" className="px-2 pb-2">
        {visiveis.map((l, i) => {
          const q = l.quartos.find((x) => x.livres > 0)
          const n = vagasLivres(l)
          return (
            <li key={`${l.id}-${(offset + i) % lista.length}`} className="animate-fade-in">
              <Link
                to={`/lar/${l.id}`}
                className={cn('group flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors', dark ? 'hover:bg-white/8' : 'hover:bg-sand')}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{l.nome}</span>
                  <span className={cn('block truncate text-sm', dark ? 'text-pine-400' : 'text-ink-mute')}>
                    {l.localidade} · {q ? QUARTO_CURTO[q.tipo].toLowerCase() : ''} · {tempoRelativo(l.atualizadoEm)}
                  </span>
                </span>
                <span className={cn('shrink-0 text-sm font-semibold tabular', dark ? 'text-leaf-200' : 'text-leaf-600')}>
                  {n} {n === 1 ? 'vaga' : 'vagas'}
                </span>
                <ChevronRight aria-hidden className={cn('size-4 shrink-0', dark ? 'text-pine-500' : 'text-ink-mute/60')} />
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
