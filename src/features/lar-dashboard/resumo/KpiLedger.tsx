import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { ArrowRight } from 'lucide-react'
import type { Lar } from '@/types'
import { Meter } from '@/components/ui/misc'
import { euro, num, pct } from '@/lib/format'
import { QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import type { NumerosResumo } from '../lib/derive'
import { BedLegend, BedMap } from '../shared/BedMap'

function Celula({ label, children, nota, className }: { label: string; children: ReactNode; nota?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-1 bg-white p-5 sm:p-6', className)}>
      <dt className="text-sm font-bold text-ink-soft">{label}</dt>
      <dd className="flex flex-1 flex-col gap-1.5">
        {children}
        {nota && <span className="mt-auto text-sm text-ink-soft">{nota}</span>}
      </dd>
    </div>
  )
}

const Numero = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cn('font-display text-5xl leading-none font-semibold tabular', className)}>{children}</span>
)

/** A instituição em números — um "livro de registo" com um ponto focal (ocupação). */
export function KpiLedger({ lar, n }: { lar: Lar; n: NumerosResumo }) {
  const livresPorTipo = lar.quartos.filter((q) => q.livres > 0)
  const pctOnline = n.listaTotal > 0 ? n.listaOnline / n.listaTotal : 0

  return (
    <section aria-labelledby="numeros-titulo" className="overflow-hidden rounded-3xl border border-line bg-white shadow-card">
      <h2 id="numeros-titulo" className="sr-only">
        A instituição em números
      </h2>
      <div className="grid gap-6 border-b border-line bg-sand/50 p-6 sm:p-7 md:grid-cols-[minmax(0,4fr)_minmax(0,6fr)] md:items-center md:gap-10">
        <div className="flex flex-col gap-3">
          <p className="eyebrow">Ocupação hoje</p>
          <p className="flex items-baseline gap-1">
            <span className="font-display text-6xl leading-none font-semibold tabular sm:text-7xl">{Math.round(n.ocupacao * 100)}</span>
            <span className="font-display text-3xl font-semibold text-ink-soft">%</span>
          </p>
          <Meter value={n.ocupacao} label={`Taxa de ocupação: ${pct(n.ocupacao)}`} tone={n.ocupacao >= 0.97 ? 'pine' : 'leaf'} className="h-3" />
          <p className="text-ink-soft">
            <strong className="text-ink">{n.ocupados}</strong> de {n.capacidade} lugares ocupados
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <BedMap total={n.capacidade} livres={n.livres} size="md" />
          <BedLegend />
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
        <Celula
          label="Lugares livres"
          nota={livresPorTipo.length ? livresPorTipo.map((q) => `${q.livres} ${QUARTO_CURTO[q.tipo].toLowerCase()}`).join(' · ') : 'Casa cheia'}
        >
          <Numero className={n.livres > 0 ? 'text-leaf-700' : undefined}>{n.livres}</Numero>
        </Celula>
        <Celula
          label="Pedidos novos"
          nota={
            n.novos > 0 ? (
              <Link to="/gestao/pedidos?filtro=novos" className="link inline-flex min-h-10 items-center gap-1">
                Abrir <ArrowRight aria-hidden className="size-4" />
              </Link>
            ) : (
              'Nenhum por ler'
            )
          }
        >
          <Numero className={n.novos > 0 ? 'text-terra-700' : undefined}>{n.novos}</Numero>
        </Celula>
        <Celula label="Visualizações (30 dias)" nota="da sua ficha pública">
          <Numero>{num(n.visualizacoes)}</Numero>
        </Celula>
        <Celula
          label="Receita mensal em risco"
          nota={n.receita > 0 ? `por cada mês com ${n.livres === 1 ? 'o lugar livre vazio' : `os ${n.livres} lugares livres vazios`}` : 'Todos os lugares estão ocupados'}
        >
          <Numero className={cn('text-4xl sm:text-5xl', n.receita > 0 ? 'text-terra-700' : 'text-leaf-700')}>{euro(n.receita)}</Numero>
        </Celula>

        <div className="col-span-2 grid gap-x-10 gap-y-1 bg-white p-5 sm:p-6 md:col-span-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
          <dt className="text-sm font-bold text-ink-soft md:col-start-1 md:row-start-1">Lista de espera</dt>
          <dd className="flex items-baseline gap-2.5 md:col-start-1 md:row-start-2">
            <Numero>{n.listaTotal}</Numero>
            <span className="text-ink-soft">{n.listaTotal === 1 ? 'pessoa' : 'pessoas'}</span>
          </dd>
          <dd className="mt-2 flex flex-col gap-2 md:col-start-2 md:row-span-2 md:row-start-1 md:mt-0">
            {n.listaTotal > 0 ? (
              <>
                <span className="flex h-3.5 w-full overflow-hidden rounded-full bg-sand-deep" aria-hidden>
                  <span className="h-full rounded-full bg-pine-600" style={{ width: `${Math.max(pctOnline > 0 ? 4 : 0, pctOnline * 100)}%` }} />
                </span>
                <span className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2.5 rounded-full bg-pine-600" />
                    <strong className="text-ink">{n.listaOnline}</strong> pela plataforma
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="size-2.5 rounded-full bg-sand-deep ring-1 ring-line-strong" />
                    <strong className="text-ink">{n.listaOffline}</strong> por telefone ou presencialmente
                  </span>
                  <Link to="/gestao/pedidos?filtro=lista" className="link inline-flex items-center gap-1">
                    Ver a lista <ArrowRight aria-hidden className="size-4" />
                  </Link>
                </span>
              </>
            ) : (
              <span className="text-sm text-ink-soft">Ninguém inscrito. Os pedidos que aceitar para a lista de espera aparecem aqui.</span>
            )}
          </dd>
        </div>
      </dl>
    </section>
  )
}
