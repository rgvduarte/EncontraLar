import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { MapPinned } from 'lucide-react'
import type { Distrito, Lar } from '@/types'
import { LarCard } from '@/components/lar/LarCard'
import { buttonClasses } from '@/components/ui/Button'
import { euro } from '@/lib/format'
import { cn } from '@/lib/cn'
import { REGIAO_TABS, comVagaNaRegiao, type RegiaoTabId } from './homeData'
import { deDistrito } from './search'

const MOSTRAR = 3

/** "Com vaga agora": cartões reais, filtrados por região com separadores acessíveis. */
export function ComVagaSection({ lares }: { lares: Lar[] }) {
  const porRegiao = useMemo(
    () => Object.fromEntries(REGIAO_TABS.map((t) => [t.id, comVagaNaRegiao(lares, t.regioes)])) as Record<RegiaoTabId, Lar[]>,
    [lares],
  )
  // começa pela região com mais vagas
  const inicial = useMemo(
    () => REGIAO_TABS.reduce((a, b) => (porRegiao[b.id].length > porRegiao[a.id].length ? b : a)).id,
    [porRegiao],
  )
  const [escolha, setEscolha] = useState<RegiaoTabId | null>(null)
  const ativo = escolha ?? inicial
  const tab = REGIAO_TABS.find((t) => t.id === ativo)!
  const lista = porRegiao[ativo]
  const mostrar = lista.slice(0, MOSTRAR)
  const baseId = useId()
  const tabsRef = useRef<HTMLDivElement>(null)

  const distritosComVaga = useMemo(() => {
    const m = new Map<Distrito, number>()
    for (const l of lista) m.set(l.distrito, (m.get(l.distrito) ?? 0) + 1)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [lista])
  const desde = lista.length ? Math.min(...lista.map((l) => l.mensalidadeMin)) : null

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const n = REGIAO_TABS.length
    let j = -1
    if (e.key === 'ArrowRight') j = (i + 1) % n
    else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = n - 1
    if (j < 0) return
    e.preventDefault()
    setEscolha(REGIAO_TABS[j]!.id)
    tabsRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[j]?.focus()
  }

  return (
    <section aria-labelledby="com-vaga-titulo" className="bg-sand py-16 lg:py-24">
      <div className="container-page">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">Com vaga agora</p>
            <h2 id="com-vaga-titulo" className="mt-4 text-4xl leading-[1.08] font-semibold sm:text-5xl">
              Lugares livres <em>hoje</em>, por região.
            </h2>
          </div>
          <Link to="/pesquisa?vaga=agora" className={buttonClasses('secondary', 'lg', 'self-start lg:self-auto')}>
            <MapPinned aria-hidden className="size-5" /> Ver todas no mapa
          </Link>
        </div>

        {/* separadores */}
        <div className="relative -mx-4 mt-10 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div ref={tabsRef} role="tablist" aria-label="Regiões" className="flex min-w-max gap-1 border-b-2 border-line-strong">
            {REGIAO_TABS.map((t, i) => {
              const sel = t.id === ativo
              const n = porRegiao[t.id].length
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${t.id}`}
                  aria-selected={sel}
                  aria-controls={`${baseId}-painel`}
                  tabIndex={sel ? 0 : -1}
                  onClick={() => setEscolha(t.id)}
                  onKeyDown={(e) => onKeyDown(e, i)}
                  className={cn(
                    '-mb-0.5 flex min-h-14 items-center gap-2 rounded-t-xl border-b-4 px-4 font-bold whitespace-nowrap transition-colors',
                    sel ? 'border-pine-700 text-pine-800' : 'border-transparent text-ink-soft hover:border-line-strong hover:text-ink',
                  )}
                >
                  {t.label}
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-xs tabular',
                      sel ? 'bg-pine-700 text-white' : n ? 'bg-white text-leaf-700' : 'bg-white/60 text-ink-mute',
                    )}
                  >
                    {n}
                    <span className="sr-only"> com vaga</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        <div id={`${baseId}-painel`} role="tabpanel" aria-labelledby={`${baseId}-tab-${ativo}`} className="mt-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end">
            <div aria-live="polite" aria-atomic="true" className="flex items-end gap-5 lg:col-span-5">
              <span
                className={cn(
                  'font-display text-7xl leading-[0.8] font-semibold tracking-tight tabular sm:text-8xl',
                  lista.length ? 'text-leaf-700' : 'text-dusk-600',
                )}
              >
                {lista.length}
              </span>
              <p className="pb-0.5 text-lg leading-snug text-ink-soft">
                <strong className="block text-ink">
                  {lista.length === 1 ? 'instituição' : 'instituições'} com vaga {tab.em}
                </strong>
                {desde != null ? <>mensalidades desde {euro(desde)}</> : <>neste momento</>}
              </p>
            </div>
            {distritosComVaga.length > 0 && (
              <nav aria-label={`Distritos com vaga ${tab.em}`} className="flex flex-wrap items-center gap-2 lg:col-span-7 lg:justify-end">
                {distritosComVaga.map(([d, n]) => (
                  <Link
                    key={d}
                    to={`/pesquisa?distrito=${encodeURIComponent(d)}&vaga=agora`}
                    className="group inline-flex min-h-12 items-center gap-2 rounded-full border border-line-strong bg-white px-4 text-sm font-bold text-ink hover:border-pine-600 hover:text-pine-800"
                    aria-label={`Distrito ${deDistrito(d)}: ${n} com vaga`}
                  >
                    {d}
                    <span className="rounded-full bg-leaf-50 px-2 py-0.5 text-xs text-leaf-700 tabular">{n}</span>
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {lista.length === 0 ? (
            <div className="mt-8 flex flex-col gap-4 rounded-3xl border-2 border-dashed border-line-strong bg-white/70 p-8 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-xl text-ink-soft">
                As vagas abrem e fecham todas as semanas. Veja a previsão de cada instituição e peça para ser avisado(a) quando surgir
                um lugar.
              </p>
              <Link to="/pesquisa?vaga=breve" className={buttonClasses('primary', 'md', 'shrink-0')}>
                Ver vagas previstas em breve
              </Link>
            </div>
          ) : (
            <>
              <ul
                aria-label={`Instituições com vaga ${tab.em}`}
                className="relative -mx-4 mt-8 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-3"
              >
                {mostrar.map((l) => (
                  <li key={l.id} className="flex w-[84%] shrink-0 snap-start md:w-auto">
                    <LarCard lar={l} headingLevel="h3" className="w-full" />
                  </li>
                ))}
              </ul>
              {lista.length > MOSTRAR && (
                <p className="mt-5 text-sm text-ink-mute">
                  <span className="md:hidden">Deslize para o lado para ver as outras. </span>
                  Mostramos {MOSTRAR} de {lista.length}: primeiro as verificadas, depois as que atualizaram as vagas há menos tempo.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
