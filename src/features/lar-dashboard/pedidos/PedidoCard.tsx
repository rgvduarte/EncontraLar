import { Link } from 'react-router'
import { ArrowRight, BedDouble, Euro, Quote } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Avatar } from '@/components/ui/misc'
import { euro, tempoRelativo } from '@/lib/format'
import { GRAU_LABEL, QUARTO_CURTO } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { UrgenciaBadge, relacaoTexto } from '../shared/pedidoBits'
import { CompatChecklist } from './CompatChecklist'
import { PedidoAcoes } from './PedidoAcoes'
import { ContactoLinks, EstadoTag, NecessidadesChips, PropostaCallout, VisitaCallout } from './partes'

const excerto = (s: string, n = 220) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s)

/** Um pedido, já triado: quem é, de que precisa, se cabe nesta casa e o que fazer a seguir. */
export function PedidoCard({ c, lar, agora, verHref }: { c: Candidatura; lar: Lar; agora: number; verHref: string }) {
  const p = c.perfil
  const ativo = !['recusada', 'cancelada', 'aceite'].includes(c.estado)
  return (
    <article
      aria-labelledby={`pedido-${c.id}`}
      className={cn(
        'overflow-hidden rounded-3xl border bg-white shadow-card',
        p.urgencia === 'imediata' && ativo ? 'border-alert-600/30' : 'border-line',
        !ativo && 'opacity-90',
      )}
    >
      <header className="flex flex-wrap items-start gap-4 p-5 sm:p-6">
        <Avatar nome={p.nome} className="size-14 text-lg" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {ativo && <UrgenciaBadge urgencia={p.urgencia} />}
            <span className="text-sm text-ink-mute">Recebido {tempoRelativo(c.criadaEm, new Date(agora))}</span>
          </div>
          <h3 id={`pedido-${c.id}`} className="mt-1 font-display text-2xl leading-snug font-semibold">
            {p.nome}, {p.idade} anos
          </h3>
          <p className="text-ink-soft">
            {relacaoTexto(c)} · {GRAU_LABEL[p.grau].toLowerCase()}
          </p>
        </div>
        <EstadoTag c={c} />
      </header>

      <div className="grid border-t border-line lg:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <NecessidadesChips lar={lar} c={c} />
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
            <span className="inline-flex items-center gap-1.5">
              <BedDouble aria-hidden className="size-4 text-pine-700" />
              {p.quarto === 'indiferente' ? 'Qualquer quarto' : `Quarto ${QUARTO_CURTO[p.quarto].toLowerCase()}`}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Euro aria-hidden className="size-4 text-pine-700" />
              Até {euro(p.orcamentoMax)}/mês
            </span>
          </p>
          {c.mensagem && (
            <blockquote className="relative rounded-2xl bg-sand/60 py-3 pr-4 pl-11 text-ink">
              <Quote aria-hidden className="absolute top-3.5 left-3.5 size-5 text-terra-400" />
              <p className="font-display text-lg leading-snug italic">{excerto(c.mensagem)}</p>
              <footer className="mt-1 text-sm text-ink-soft">— {c.contacto.nome}</footer>
            </blockquote>
          )}
          <VisitaCallout c={c} />
          <PropostaCallout c={c} agora={agora} />
          <ContactoLinks c={c} />
        </div>
        <CompatChecklist lar={lar} perfil={p} compact className="border-t border-line bg-sand/40 p-5 sm:p-6 lg:border-t-0 lg:border-l" />
      </div>

      <footer className="flex flex-wrap items-start justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
        <PedidoAcoes c={c} lar={lar} />
        <Link to={verHref} className="link inline-flex min-h-12 items-center gap-1.5" aria-label={`Ver o perfil completo de ${p.nome}`}>
          Perfil completo e histórico <ArrowRight aria-hidden className="size-4" />
        </Link>
      </footer>
    </article>
  )
}
