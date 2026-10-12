/**
 * Pré-visualização real do painel da instituição (componentes e dados verdadeiros do store),
 * em modo de ensaio: os botões funcionam, mas nada é gravado.
 */
import { useMemo, useState } from 'react'
import { BellRing, Minus, MousePointerClick, Plus } from 'lucide-react'
import type { DB, Lar, TipoQuarto } from '@/types'
import { useDB } from '@/lib/store'
import { euro, plural, tempoRelativo } from '@/lib/format'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { LogoMark } from '@/components/layout/Logo'
import { VerifiedBadge } from '@/components/lar/badges'
import { calcadaStonesBg } from '@/components/brand/patterns'
import { cn } from '@/lib/cn'

/** Famílias que seriam avisadas se abrisse uma vaga agora (mesma regra do store: lista de espera + alertas). */
export function familiasAAvisar(db: DB, lar: Lar): number {
  const ids = new Set<string>()
  for (const c of db.candidaturas) if (c.larId === lar.id && c.estado === 'lista_espera') ids.add(c.userId)
  for (const f of db.favoritos) if (f.larId === lar.id && f.alerta && f.userId !== lar.ownerId) ids.add(f.userId)
  return ids.size
}

type Evento = { tipo: TipoQuarto; acao: 'abriu' | 'ocupou'; key: number; quando: string }

export function HeroPanel({ lar, className }: { lar: Lar; className?: string }) {
  const db = useDB()
  const avisadas = useMemo(() => familiasAAvisar(db, lar), [db, lar])
  const pedidosNovos = useMemo(
    () => db.candidaturas.filter((c) => c.larId === lar.id && (c.estado === 'enviada' || c.estado === 'em_analise')).length,
    [db.candidaturas, lar.id],
  )

  const [livres, setLivres] = useState<Record<string, number>>(() => Object.fromEntries(lar.quartos.map((q) => [q.tipo, q.livres])))
  const [tocou, setTocou] = useState(false)
  const inicial = lar.quartos.find((q) => q.livres > 0)
  const [evento, setEvento] = useState<Evento | null>(() =>
    inicial ? { tipo: inicial.tipo, acao: 'abriu', key: 0, quando: lar.atualizadoEm } : null,
  )

  const mudar = (tipo: TipoQuarto, delta: number) => {
    const q = lar.quartos.find((x) => x.tipo === tipo)
    if (!q) return
    const atual = livres[tipo] ?? 0
    const novo = Math.max(0, Math.min(q.total, atual + delta))
    if (novo === atual) return
    setLivres((s) => ({ ...s, [tipo]: novo }))
    setTocou(true)
    setEvento({ tipo, acao: delta > 0 ? 'abriu' : 'ocupou', key: Date.now(), quando: new Date().toISOString() })
  }

  const total = Object.values(livres).reduce((a, b) => a + b, 0)

  return (
    <div className={cn('relative sm:pb-8', className)}>
      <p className="relative mb-3 flex items-center gap-2 text-sm font-semibold text-pine-800">
        <MousePointerClick aria-hidden className="size-4.5 shrink-0" />
        Experimente — é o painel verdadeiro, em modo de ensaio.
      </p>
      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-lift">
        {/* cabeçalho do painel */}
        <div className="flex items-start justify-between gap-3 border-b border-line bg-sand/60 px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <LogoMark className="size-9" />
            <div className="min-w-0">
              <p className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Painel da instituição</p>
              <p className="font-display text-lg leading-tight font-semibold text-ink">{lar.nome}</p>
            </div>
          </div>
          <span className="mt-1 hidden sm:block">
            <VerifiedBadge lar={lar} />
          </span>
        </div>

        {/* vagas */}
        <div className="px-5 pt-5 pb-3 sm:px-6">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
            <p className="font-bold text-ink">Vagas neste momento</p>
            <p className="text-sm text-ink-mute" aria-live="polite">
              {tocou ? 'Atualizado agora mesmo' : `Atualizado ${tempoRelativo(lar.atualizadoEm)}`}
            </p>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-line">
            {lar.quartos.map((q) => {
              const n = livres[q.tipo] ?? 0
              return (
                <li key={q.tipo} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-ink">
                      <span className="hidden sm:inline">Quarto </span>
                      <span className="sm:lowercase">{QUARTO_CURTO[q.tipo]}</span>
                    </p>
                    <p className="text-sm text-ink-mute tabular">
                      {plural(q.total, 'lugar', 'lugares')} · desde {euro(q.precoMin)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label={`Vagas em ${QUARTO_LABEL[q.tipo].toLowerCase()}`}>
                    <button
                      type="button"
                      onClick={() => mudar(q.tipo, -1)}
                      disabled={n <= 0}
                      aria-label={`Menos uma vaga em ${QUARTO_LABEL[q.tipo].toLowerCase()}`}
                      className="flex size-12 items-center justify-center rounded-xl border-2 border-line-strong text-ink transition-colors hover:border-pine-600 hover:bg-pine-50 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line-strong disabled:hover:bg-transparent"
                    >
                      <Minus aria-hidden className="size-5" />
                    </button>
                    <output
                      aria-live="polite"
                      className={cn(
                        'font-display flex h-12 w-14 items-center justify-center rounded-xl text-2xl font-semibold tabular transition-colors',
                        n > 0 ? 'bg-leaf-50 text-leaf-700' : 'bg-sand text-ink-mute',
                      )}
                    >
                      {n}
                    </output>
                    <button
                      type="button"
                      onClick={() => mudar(q.tipo, +1)}
                      disabled={n >= q.total}
                      aria-label={`Mais uma vaga em ${QUARTO_LABEL[q.tipo].toLowerCase()}`}
                      className="flex size-12 items-center justify-center rounded-xl bg-pine-700 text-white shadow-soft transition-colors hover:bg-pine-800 disabled:cursor-not-allowed disabled:bg-pine-300"
                    >
                      <Plus aria-hidden className="size-5" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        {/* indicadores reais do lar */}
        <dl className="grid grid-cols-3 border-t border-line bg-cream text-center">
          {[
            { k: 'No mapa', v: total === 0 ? 'Sem vaga' : plural(total, 'vaga', 'vagas') },
            { k: 'Lista de espera', v: plural(lar.listaEspera, 'pessoa', 'pessoas') },
            { k: 'Pedidos novos', v: String(pedidosNovos) },
          ].map((s, i) => (
            <div key={s.k} className={cn('flex flex-col-reverse gap-0.5 px-2 py-3.5', i > 0 && 'border-l border-line')}>
              <dt className="text-xs text-ink-mute">{s.k}</dt>
              <dd className="font-display text-lg font-semibold text-ink tabular">{s.v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* notificação flutuante — o momento "aha" */}
      <div
        role="status"
        aria-live="polite"
        className="relative z-10 mx-3 -mt-2 sm:absolute sm:-bottom-16 sm:-left-8 sm:mx-0 sm:mt-0 sm:w-[23rem] lg:-left-20"
      >
        {evento && (
          <div
            key={evento.key}
            className="on-dark flex animate-fade-up items-start gap-3 rounded-2xl bg-pine-950 px-4 py-3.5 text-pine-50 shadow-lift ring-1 ring-black/20"
            style={calcadaStonesBg('#ffffff', 0.04)}
          >
            <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-sun-400 text-pine-950">
              <BellRing aria-hidden className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              {evento.acao === 'abriu' ? (
                <>
                  <span className="font-bold text-white">
                    {avisadas > 0 ? `${plural(avisadas, 'família avisada', 'famílias avisadas')}` : 'Vaga publicada no mapa'}
                  </span>
                  <span className="text-sm text-pine-200">
                    Vaga em {QUARTO_LABEL[evento.tipo].replace(' (partilhado)', '').toLowerCase()} ·{' '}
                    {avisadas > 0 ? 'lista de espera e alertas' : 'visível para quem procura na zona'} · {tempoRelativo(evento.quando)}
                  </span>
                </>
              ) : (
                <>
                  <span className="font-bold text-white">Mapa atualizado</span>
                  <span className="text-sm text-pine-200">
                    {QUARTO_LABEL[evento.tipo].replace(' (partilhado)', '')}: {plural(livres[evento.tipo] ?? 0, 'vaga', 'vagas')} · ninguém liga
                    por engano
                  </span>
                </>
              )}
            </span>
          </div>
        )}
      </div>

    </div>
  )
}
