import type { ReactNode } from 'react'
import { MapPin } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { COMODIDADE_ICON } from '@/components/lar/icons'
import { dataLonga, euro, tempoRelativo } from '@/lib/format'
import { COMODIDADE_LABEL, ESTADO_CANDIDATURA_LABEL, GRAU_DESCRICAO, GRAU_LABEL, QUARTO_LABEL, URGENCIA_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { UrgenciaBadge, relacaoTexto } from '../shared/pedidoBits'
import { CompatChecklist } from './CompatChecklist'
import { PedidoAcoes } from './PedidoAcoes'
import { acoesDoPedido } from './acoes'
import { ContactoLinks, EstadoTag, NecessidadesChips, PropostaCallout, VisitaCallout } from './partes'

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="mb-3 font-sans text-base font-bold tracking-[0.08em] text-pine-800 uppercase">{titulo}</h3>
      {children}
    </section>
  )
}

function Linha({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-2 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm font-bold text-ink-soft">{k}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Perfil completo do pedido, com o histórico — abre a partir de ?pedido=<id>. */
export function PedidoDetailModal({ c, lar, agora, onClose }: { c: Candidatura; lar: Lar; agora: number; onClose: () => void }) {
  const p = c.perfil
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${p.nome}, ${p.idade} anos`}
      description={`${relacaoTexto(c)} · pedido recebido a ${dataLonga(c.criadaEm)}`}
      footer={acoesDoPedido(c, lar).length > 0 || c.estado === 'aceite' ? <PedidoAcoes c={c} lar={lar} className="w-full" /> : undefined}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <EstadoTag c={c} />
          {!['aceite', 'recusada', 'cancelada'].includes(c.estado) && <UrgenciaBadge urgencia={p.urgencia} size="md" />}
        </div>
        <VisitaCallout c={c} />
        <PropostaCallout c={c} agora={agora} />

        <Bloco titulo="Situação de saúde">
          <p className="font-bold">{GRAU_LABEL[p.grau]}</p>
          <p className="text-ink-soft">{GRAU_DESCRICAO[p.grau]}</p>
          <NecessidadesChips lar={lar} c={c} className="mt-3" />
          {p.notas && (
            <div className="mt-4 rounded-2xl bg-sand/60 p-4">
              <p className="text-sm font-bold text-ink-soft">Notas da família</p>
              <p className="mt-1">{p.notas}</p>
            </div>
          )}
        </Bloco>

        <Bloco titulo="O que procura">
          <dl className="divide-y divide-line">
            <Linha k="Quarto">{p.quarto === 'indiferente' ? 'Indiferente' : QUARTO_LABEL[p.quarto]}</Linha>
            <Linha k="Orçamento">Até {euro(p.orcamentoMax)} por mês</Linha>
            <Linha k="Quando">{URGENCIA_LABEL[p.urgencia]}</Linha>
            <Linha k="Zona">
              <span className="inline-flex items-center gap-1.5">
                <MapPin aria-hidden className="size-4 text-pine-700" />
                {p.local.label}, até {p.raioKm} km
              </span>
            </Linha>
            <Linha k="Segurança Social">{p.precisaAcordoSS ? 'Precisa de vaga comparticipada (acordo de cooperação)' : 'Não precisa de comparticipação'}</Linha>
            {p.preferencias.length > 0 && (
              <Linha k="Gostaria de ter">
                <ul className="flex flex-wrap gap-1.5">
                  {p.preferencias.map((x) => {
                    const Icon = COMODIDADE_ICON[x]
                    const tem = lar.comodidades.includes(x)
                    return (
                      <li key={x} className={cn('inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm', tem ? 'bg-pine-50 text-pine-900' : 'bg-sand text-ink-soft')}>
                        <Icon aria-hidden className="size-4" />
                        {COMODIDADE_LABEL[x]}
                        {!tem && <span className="font-semibold">· não tem</span>}
                      </li>
                    )
                  })}
                </ul>
              </Linha>
            )}
          </dl>
        </Bloco>

        <Bloco titulo="Compatibilidade">
          <CompatChecklist lar={lar} perfil={p} />
        </Bloco>

        {c.mensagem && (
          <Bloco titulo="Mensagem">
            <blockquote className="border-l-4 border-terra-300 pl-4 font-display text-lg leading-snug italic">{c.mensagem}</blockquote>
          </Bloco>
        )}

        <Bloco titulo="Contacto">
          <p className="mb-2 font-bold">{c.contacto.nome}</p>
          <ContactoLinks c={c} />
        </Bloco>

        <Bloco titulo="Histórico">
          <ol className="relative ml-2 border-l-2 border-line">
            {[...c.historico].reverse().map((h, i) => (
              <li key={`${h.data}-${i}`} className="relative pb-5 pl-6 last:pb-0">
                <span aria-hidden className={cn('absolute top-1.5 -left-[7px] size-3 rounded-full ring-4 ring-cream', i === 0 ? 'bg-pine-600' : 'bg-line-strong')} />
                <p className="font-bold">{ESTADO_CANDIDATURA_LABEL[h.estado]}</p>
                <p className="text-sm text-ink-mute">
                  {dataLonga(h.data)} · {tempoRelativo(h.data, new Date(agora))}
                </p>
                {h.nota && <p className="mt-1 text-ink-soft">«{h.nota}»</p>}
              </li>
            ))}
          </ol>
        </Bloco>
      </div>
    </Modal>
  )
}
