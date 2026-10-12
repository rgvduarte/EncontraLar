/**
 * Pré-visualizações com dados reais do store, ao lado da lista "problema → solução".
 */
import { useMemo } from 'react'
import { CircleCheck, CircleAlert, Inbox, TrendingUp } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { useCandidaturasDoLar } from '@/lib/store'
import { previsaoMensal, taxaSaidasMensal } from '@/lib/forecast'
import { euro, tempoRelativo } from '@/lib/format'
import { CUIDADO_LABEL, GRAU_LABEL, URGENCIA_LABEL } from '@/lib/labels'
import { CUIDADO_ICON } from '@/components/lar/icons'
import { ForecastChart } from '@/components/lar/ForecastChart'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/cn'

/** "Joaquim Sousa" → "J. Sousa" (o painel mostra o nome completo; aqui basta a inicial). */
const abreviar = (nome: string) => {
  const p = nome.trim().split(/\s+/)
  return p.length > 1 ? `${p[0]![0]}. ${p[p.length - 1]}` : nome
}

function escolherPedido(cands: Candidatura[]): Candidatura | undefined {
  return (
    cands.find((c) => c.estado === 'enviada' && c.perfil.necessidades.length > 0) ??
    cands.find((c) => c.estado === 'em_analise') ??
    cands[0]
  )
}

/** Um pedido de vaga tal como chega ao painel: já com o perfil clínico e a compatibilidade. */
export function PedidoPreview({ lar, className }: { lar: Lar; className?: string }) {
  const cands = useCandidaturasDoLar(lar.id)
  const c = useMemo(() => escolherPedido(cands), [cands])
  if (!c) return null
  const p = c.perfil
  const cobertos = p.necessidades.filter((n) => lar.cuidados.includes(n))
  const grauOk = lar.graus.includes(p.grau)
  const tudoOk = grauOk && cobertos.length === p.necessidades.length

  return (
    <article aria-label="Exemplo de pedido de vaga recebido" className={cn('rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6', className)}>
      <header className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-terra-700 uppercase">
          <Inbox aria-hidden className="size-4" /> Novo pedido
        </p>
        <p className="text-sm text-ink-mute">{tempoRelativo(c.criadaEm)}</p>
      </header>
      <p className="mt-3 font-display text-2xl font-semibold text-ink">
        {abreviar(p.nome)}, <span className="tabular">{p.idade}</span> anos
      </p>
      <p className="text-sm text-ink-soft">
        {p.relacao} de {abreviar(c.contacto.nome)} · {URGENCIA_LABEL[p.urgencia]}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge tone={grauOk ? 'pine' : 'alert'}>{GRAU_LABEL[p.grau]}</Badge>
        {p.necessidades.map((n) => {
          const Icon = CUIDADO_ICON[n]
          const ok = lar.cuidados.includes(n)
          return (
            <Badge key={n} tone={ok ? 'neutral' : 'alert'} icon={<Icon aria-hidden />}>
              {CUIDADO_LABEL[n]}
              {!ok && <span className="sr-only"> (não assegurado)</span>}
            </Badge>
          )
        })}
      </div>

      {p.notas && <p className="mt-4 border-l-2 border-line-strong pl-3 text-sm text-ink-soft italic">“{p.notas}”</p>}

      <footer
        className={cn(
          'mt-5 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm',
          tudoOk ? 'bg-leaf-50 text-leaf-700' : 'bg-sun-50 text-sun-800',
        )}
      >
        {tudoOk ? <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0" /> : <CircleAlert aria-hidden className="mt-0.5 size-5 shrink-0" />}
        <span>
          <strong>{tudoOk ? 'Compatível com a sua casa' : 'Compatibilidade parcial'}</strong> — {cobertos.length} de {p.necessidades.length}{' '}
          cuidados assegurados · orçamento até {euro(p.orcamentoMax)}
        </span>
      </footer>
    </article>
  )
}

/** Saídas previstas nos próximos 6 meses — para planear entradas antes de o quarto ficar vazio. */
export function SaidasPreview({ lar, className }: { lar: Lar; className?: string }) {
  const dados = useMemo(() => previsaoMensal(lar, 6), [lar])
  const taxa = taxaSaidasMensal(lar)
  const total = dados.reduce((s, d) => s + d.esperado, 0)
  return (
    <article aria-label="Exemplo de previsão de saídas" className={cn('overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6', className)}>
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-pine-700 uppercase">
            <TrendingUp aria-hidden className="size-4" /> Previsão · próximos 6 meses
          </p>
          <p className="mt-2 text-ink-soft">
            Cerca de{' '}
            <strong className="font-display text-xl text-ink tabular">{total.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}</strong> lugares
            deverão libertar-se ({taxa.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} por mês, em média).
          </p>
        </div>
      </header>
      <ForecastChart data={dados} height={190} className="mt-4" caption={`Lugares que deverão libertar-se por mês em ${lar.nome}`} />
    </article>
  )
}
