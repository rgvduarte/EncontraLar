import type { Candidatura, Lar } from '@/types'
import { tempoRelativo } from '@/lib/format'
import { GRAU_LABEL } from '@/lib/labels'
import { excerto, necessidadesTexto, procuraTexto, relacaoTexto } from '../shared/pedidoBits'
import { MoreLink } from '../shared/ui'
import { PedidoAcoes } from './PedidoAcoes'
import { CompatLines, ContactoLinks, EstadoTag, PropostaLinha, VisitaLinha } from './partes'

const FECHADOS: Candidatura['estado'][] = ['aceite', 'recusada', 'cancelada']

/** Um pedido numa linha limpa: quem é, de que precisa, se cabe nesta casa e o que fazer a seguir. */
export function PedidoRow({ c, lar, agora, verHref }: { c: Candidatura; lar: Lar; agora: number; verHref: string }) {
  const p = c.perfil
  const ativo = !FECHADOS.includes(c.estado)
  const nec = necessidadesTexto(c)
  return (
    <li className="py-10 first:pt-6">
      <article aria-labelledby={`pedido-${c.id}`}>
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="text-sm text-ink-mute">
            {ativo && p.urgencia === 'imediata' && <span className="font-medium text-alert-700">Urgente — alta hospitalar · </span>}
            Recebido {tempoRelativo(c.criadaEm, new Date(agora))}
          </p>
          {c.estado !== 'enviada' && <EstadoTag c={c} />}
        </div>
        <h3 id={`pedido-${c.id}`} className="mt-1 text-2xl font-semibold">
          {p.nome}, {p.idade} anos
        </h3>
        <p className="mt-1 text-ink-soft">
          {relacaoTexto(c)} · {GRAU_LABEL[p.grau].toLowerCase()}
        </p>
        <p className="text-ink-soft">{nec ? `Precisa de ${nec}.` : 'Sem necessidades de saúde específicas indicadas.'}</p>
        <p className="text-ink-soft">{procuraTexto(c)}</p>
        {c.mensagem && <p className="mt-4 max-w-2xl text-ink">«{excerto(c.mensagem)}»</p>}

        {ativo && <CompatLines lar={lar} perfil={p} className="mt-6" />}
        <VisitaLinha c={c} className="mt-6" />
        <PropostaLinha c={c} agora={agora} className="mt-6" />

        <ContactoLinks c={c} className="mt-4" />
        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <PedidoAcoes c={c} lar={lar} agora={agora} />
          <MoreLink to={verHref} aria-label={`Perfil completo e histórico de ${p.nome}`}>
            Perfil completo
          </MoreLink>
        </div>
      </article>
    </li>
  )
}
