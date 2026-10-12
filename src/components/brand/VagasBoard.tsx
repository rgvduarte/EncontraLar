import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight } from 'lucide-react'
import type { Lar } from '@/types'
import { vagasLivres } from '@/lib/forecast'
import { tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO, TIPO_LABEL } from '@/lib/labels'
import { calcadaStonesBg } from './patterns'
import { cn } from '@/lib/cn'

/**
 * "Quadro de vagas" — inspirado nos painéis de partidas das estações.
 * Mostra as vagas mais recentemente atualizadas pelas instituições, a rodar devagar.
 */
export function VagasBoard({ lares, linhas = 6, className, titulo = 'Vagas atualizadas agora' }: { lares: Lar[]; linhas?: number; className?: string; titulo?: string }) {
  const lista = useMemo(
    () =>
      lares
        .filter((l) => vagasLivres(l) > 0 && l.tipo !== 'centro_dia')
        .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
        .slice(0, 18),
    [lares],
  )
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    if (lista.length <= linhas) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => setOffset((o) => (o + 1) % lista.length), 4200)
    return () => clearInterval(t)
  }, [lista.length, linhas])

  const visiveis = Array.from({ length: Math.min(linhas, lista.length) }, (_, i) => lista[(offset + i) % lista.length]!)

  return (
    <section
      aria-label={titulo}
      className={cn('overflow-hidden rounded-[1.75rem] bg-pine-950 text-pine-50 shadow-lift ring-1 ring-black/20', className)}
      style={calcadaStonesBg('#ffffff', 0.035)}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
        <p className="flex items-center gap-2.5 text-sm font-bold tracking-[0.16em] text-sun-200 uppercase">
          <span aria-hidden className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-leaf-200 opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-leaf-200" />
          </span>
          {titulo}
        </p>
        <span className="text-xs text-pine-300">{lista.length} instituições com vaga</span>
      </header>
      <ol className="divide-y divide-white/8" aria-live="off">
        {visiveis.map((l, i) => {
          const q = l.quartos.find((x) => x.livres > 0)
          const n = vagasLivres(l)
          return (
            <li key={`${l.id}-${(offset + i) % lista.length}`} className="animate-fade-in">
              <Link
                to={`/lar/${l.id}`}
                className="group grid grid-cols-[4.75rem_1fr_auto] items-center gap-3 px-5 py-3.5 transition-colors hover:bg-white/6 focus-visible:bg-white/8 sm:grid-cols-[5.5rem_1fr_auto_auto]"
              >
                <span className="font-mono text-sm text-pine-300 tabular-nums">{tempoRelativo(l.atualizadoEm).replace('há ', '')}</span>
                <span className="min-w-0">
                  <span className="block truncate font-bold text-white group-hover:underline">{l.nome}</span>
                  <span className="block truncate text-sm text-pine-300">
                    {l.localidade} · {TIPO_LABEL[l.tipo]}
                  </span>
                </span>
                <span className="hidden text-sm text-pine-200 sm:block">{q ? QUARTO_CURTO[q.tipo] : ''}</span>
                <span className="flex items-center gap-2">
                  <span className="rounded-lg bg-sun-400 px-2.5 py-1 font-mono text-base font-bold text-pine-950 tabular-nums">
                    {n} {n === 1 ? 'vaga' : 'vagas'}
                  </span>
                  <ArrowUpRight aria-hidden className="hidden size-5 text-pine-300 group-hover:text-white sm:block" />
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
