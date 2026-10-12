import type { Candidatura, Lar } from '@/types'
import { Reveal } from '@/components/motion'
import { euro, tempoRelativo } from '@/lib/format'
import { GRAU_LABEL, QUARTO_LABEL, URGENCIA_LABEL } from '@/lib/labels'
import { resumoAnonimo } from '@/lib/negocio'
import { bloqueado, excerto, necessidadesTexto, nomePedido, procuraTexto, relacaoTexto } from '../shared/pedidoBits'
import { MoreLink } from '../shared/ui'
import { PedidoAcoes } from './PedidoAcoes'
import { AvisoBloqueio, CompatLines, ContactoLinks, EntradaLinha, EstadoTag, OrigemBadges, PropostaLinha, VisitaLinha } from './partes'

const FECHADOS: Candidatura['estado'][] = ['aceite', 'admitida', 'recusada', 'cancelada']

/**
 * Um pedido numa linha limpa: quem é, de que precisa, se cabe nesta casa e o que fazer a seguir.
 * Antes de o aceitar, a linha mostra só o resumo anónimo (faixa etária, grau, cuidados, zona, orçamento,
 * urgência, quarto, comparticipação e origem) — nunca o nome, o contacto, as notas ou a mensagem.
 * Entra com um fade ao aparecer; quando muda de estado (e sai deste separador) desvanece e as
 * linhas de baixo sobem (FLIP na lista).
 */
export function PedidoRow({ c, lar, agora, verHref, leaving = false }: { c: Candidatura; lar: Lar; agora: number; verHref: string; leaving?: boolean }) {
  const p = c.perfil
  const ativo = !FECHADOS.includes(c.estado)
  const nec = necessidadesTexto(c)
  const anonimo = bloqueado(c)
  const r = anonimo ? resumoAnonimo(c) : null
  return (
    <li data-flip={c.id} data-leaving={leaving} inert={leaving} aria-hidden={leaving || undefined} className="bg-white py-10 first:pt-6">
      <Reveal variant="fade" duration={800}>
        <article aria-labelledby={`pedido-${c.id}`}>
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <p className="text-sm text-ink-mute">
              {ativo && p.urgencia === 'imediata' && !c.encaminhamento && <span className="font-medium text-alert-700">Urgente — alta hospitalar · </span>}
              Recebido {tempoRelativo(c.criadaEm, new Date(agora))}
            </p>
            {c.estado !== 'enviada' && <EstadoTag c={c} />}
          </div>
          <OrigemBadges c={c} agora={agora} className="mt-2" />
          <h2 id={`pedido-${c.id}`} className="mt-2 text-2xl font-semibold">
            {nomePedido(c)}
          </h2>

          {r ? (
            <>
              <p className="mt-1 text-ink-soft">
                {GRAU_LABEL[r.grau]} · {nec ? `precisa de ${nec}` : 'sem necessidades de saúde específicas indicadas'}.
              </p>
              <p className="text-ink-soft">
                {r.zona} · {r.quarto === 'indiferente' ? 'qualquer quarto' : QUARTO_LABEL[r.quarto].toLowerCase()} · até {euro(r.orcamentoMax)}/mês
              </p>
              <p className="text-ink-soft">
                {URGENCIA_LABEL[r.urgencia]}
                {r.precisaAcordoSS ? ' · precisa de vaga comparticipada pela Segurança Social' : ''}
                {r.origem === 'familia' ? ' · pedido de uma família' : ''}
              </p>
            </>
          ) : (
            <>
              <p className="mt-1 text-ink-soft">
                {relacaoTexto(c)} · {GRAU_LABEL[p.grau].toLowerCase()}
              </p>
              <p className="text-ink-soft">{nec ? `Precisa de ${nec}.` : 'Sem necessidades de saúde específicas indicadas.'}</p>
              <p className="text-ink-soft">{procuraTexto(c)}</p>
              {c.mensagem && <p className="mt-4 max-w-2xl text-ink">«{excerto(c.mensagem)}»</p>}
            </>
          )}

          {ativo && <CompatLines lar={lar} perfil={p} className="mt-6" />}
          <EntradaLinha c={c} className="mt-6" />
          <VisitaLinha c={c} className="mt-6" />
          <PropostaLinha c={c} agora={agora} className="mt-6" />

          {anonimo && <AvisoBloqueio c={c} className="mt-6" />}
          <ContactoLinks c={c} className="mt-4" />
          <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 max-sm:mt-6">
            <PedidoAcoes c={c} lar={lar} agora={agora} verHref={verHref} className="max-sm:w-full" />
            <MoreLink to={verHref} aria-label={anonimo ? `Resumo do pedido: ${nomePedido(c)}` : `Perfil completo e histórico de ${p.nome}`}>
              {anonimo ? 'Ver resumo' : 'Perfil completo'}
            </MoreLink>
          </div>
        </article>
      </Reveal>
    </li>
  )
}
