import type { ReactNode } from 'react'
import type { Candidatura, Lar } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { dataLonga, euro, tempoRelativo } from '@/lib/format'
import {
  COMODIDADE_LABEL,
  CUIDADO_LABEL,
  CUIDADOS_CRITICOS,
  ESTADO_CANDIDATURA_LABEL,
  GRAU_DESCRICAO,
  GRAU_LABEL,
  QUARTO_LABEL,
  URGENCIA_LABEL,
} from '@/lib/labels'
import { cn } from '@/lib/cn'
import { relacaoTexto } from '../shared/pedidoBits'
import { PedidoAcoes } from './PedidoAcoes'
import { acoesDoPedido } from './acoes'
import { CompatLines, ContactoLinks, EstadoTag, PropostaLinha, VisitaLinha } from './partes'

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-5">
      <h3 className="mb-2 text-base font-semibold tracking-[-0.01em]">{titulo}</h3>
      {children}
    </section>
  )
}

function Linha({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="grid gap-0.5 py-1.5 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-ink-mute">{k}</dt>
      <dd>{children}</dd>
    </div>
  )
}

/** Perfil completo do pedido, com o histórico — abre a partir de ?pedido=<id>. */
export function PedidoDetailModal({ c, lar, agora, onClose }: { c: Candidatura; lar: Lar; agora: number; onClose: () => void }) {
  const p = c.perfil
  const ativo = !['aceite', 'recusada', 'cancelada'].includes(c.estado)
  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={`${p.nome}, ${p.idade} anos`}
      description={`${relacaoTexto(c)} · recebido a ${dataLonga(c.criadaEm)}`}
      footer={acoesDoPedido(c, lar, agora).length > 0 || c.estado === 'aceite' ? <PedidoAcoes c={c} lar={lar} agora={agora} className="w-full" /> : undefined}
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <EstadoTag c={c} />
          {ativo && p.urgencia === 'imediata' && <span className="text-sm font-medium text-alert-700">Urgente — alta hospitalar</span>}
        </div>
        <VisitaLinha c={c} />
        <PropostaLinha c={c} agora={agora} />

        <Bloco titulo="Saúde">
          <p className="font-medium">{GRAU_LABEL[p.grau]}</p>
          <p className="text-ink-mute">{GRAU_DESCRICAO[p.grau]}</p>
          {p.necessidades.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1">
              {p.necessidades.map((n) => {
                const tem = lar.cuidados.includes(n)
                return (
                  <li key={n} className={cn(!tem && 'text-alert-700')}>
                    {CUIDADO_LABEL[n]}
                    {CUIDADOS_CRITICOS.includes(n) && <span className="text-ink-mute"> · essencial</span>}
                    {!tem && <span className="font-medium"> · a sua ficha não indica</span>}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="mt-3 text-ink-mute">Sem necessidades de saúde específicas indicadas.</p>
          )}
          {p.notas && <p className="mt-3 text-ink-soft">«{p.notas}»</p>}
        </Bloco>

        <Bloco titulo="O que procura">
          <dl>
            <Linha k="Quarto">{p.quarto === 'indiferente' ? 'Indiferente' : QUARTO_LABEL[p.quarto]}</Linha>
            <Linha k="Orçamento">Até {euro(p.orcamentoMax)} por mês</Linha>
            <Linha k="Quando">{URGENCIA_LABEL[p.urgencia]}</Linha>
            <Linha k="Zona">
              {p.local.label}, até {p.raioKm} km
            </Linha>
            <Linha k="Segurança Social">{p.precisaAcordoSS ? 'Precisa de vaga comparticipada' : 'Não precisa de comparticipação'}</Linha>
            {p.preferencias.length > 0 && (
              <Linha k="Gostaria de ter">
                {p.preferencias.map((x) => `${COMODIDADE_LABEL[x]}${lar.comodidades.includes(x) ? '' : ' (não tem)'}`).join(' · ')}
              </Linha>
            )}
          </dl>
        </Bloco>

        <Bloco titulo="Compatibilidade">
          <CompatLines lar={lar} perfil={p} />
          <p className="mt-3 text-xs text-ink-mute">Verificação automática com base na sua ficha. Confirme sempre com a família.</p>
        </Bloco>

        {c.mensagem && (
          <Bloco titulo="Mensagem">
            <p className="text-ink">«{c.mensagem}»</p>
          </Bloco>
        )}

        <Bloco titulo="Contacto">
          <p className="font-medium">{c.contacto.nome}</p>
          <ContactoLinks c={c} />
        </Bloco>

        <Bloco titulo="Histórico">
          <ol className="flex flex-col gap-4">
            {[...c.historico].reverse().map((h, i) => (
              <li key={`${h.data}-${i}`} className="grid grid-cols-[0.75rem_1fr] gap-3">
                <span aria-hidden className={cn('mt-2 size-2 rounded-full', i === 0 ? 'bg-ink' : 'bg-line-strong')} />
                <div>
                  <p className="font-medium">{ESTADO_CANDIDATURA_LABEL[h.estado]}</p>
                  <p className="text-sm text-ink-mute">
                    {dataLonga(h.data)} · {tempoRelativo(h.data, new Date(agora))}
                  </p>
                  {h.nota && <p className="mt-1 text-ink-soft">«{h.nota}»</p>}
                </div>
              </li>
            ))}
          </ol>
        </Bloco>
      </div>
    </Modal>
  )
}
