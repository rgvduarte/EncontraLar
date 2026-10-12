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
import { resumoAnonimo } from '@/lib/negocio'
import { cn } from '@/lib/cn'
import { altaTexto, bloqueado, diaCurto, nomeContacto, nomePedido, relacaoTexto } from '../shared/pedidoBits'
import { PedidoAcoes } from './PedidoAcoes'
import { acoesDoPedido } from './acoes'
import { TAXA_TEXTO } from './EntradaModal'
import { AvisoBloqueio, CompatLines, ContactoLinks, EntradaLinha, EstadoTag, OrigemBadges, PropostaLinha, VisitaLinha } from './partes'

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

/**
 * O pedido completo, com o histórico — abre a partir de ?pedido=<id>.
 * Antes de aceitar, mostra só o resumo anónimo e as ações "Aceitar e ver contacto" / "Recusar".
 */
export function PedidoDetailModal({ c, lar, agora, open = true, onClose }: { c: Candidatura; lar: Lar; agora: number; open?: boolean; onClose: () => void }) {
  if (bloqueado(c)) return <ResumoAnonimoModal c={c} lar={lar} agora={agora} open={open} onClose={onClose} />
  const p = c.perfil
  const ativo = !['aceite', 'admitida', 'recusada', 'cancelada'].includes(c.estado)
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={nomePedido(c)}
      description={`${relacaoTexto(c)} · recebido a ${dataLonga(c.criadaEm)}`}
      footer={acoesDoPedido(c, lar, agora).length > 0 ? <PedidoAcoes c={c} lar={lar} agora={agora} variante="folha" className="w-full" /> : undefined}
    >
      <div className="flex flex-col gap-5">
        {/* acabou de aceitar: o leitor de ecrã ouve que o contacto já está visível */}
        <p className="sr-only" role="status">
          {c.desbloqueadaEm && agora - new Date(c.desbloqueadaEm).getTime() < 60_000 ? 'Pedido aceite. O nome e o contacto estão visíveis.' : ''}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <EstadoTag c={c} />
          {ativo && p.urgencia === 'imediata' && !c.encaminhamento && <span className="text-sm font-medium text-alert-700">Urgente — alta hospitalar</span>}
        </div>
        <OrigemBadges c={c} agora={agora} />
        <EntradaLinha c={c} />
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
          <p className="font-medium">{nomeContacto(c)}</p>
          {c.encaminhamento && (
            <p className="text-ink-mute">
              {c.encaminhamento.organizacao}
              {c.encaminhamento.altaPrevista && ` · Alta prevista: ${diaCurto(c.encaminhamento.altaPrevista)}`}
            </p>
          )}
          <ContactoLinks c={c} />
        </Bloco>

        {c.entrada && (
          <Bloco titulo="Entrada">
            <dl>
              <Linha k="Dia">{diaCurto(c.entrada.data)}</Linha>
              <Linha k="Instituição">{c.entrada.confirmadaLarEm ? `Confirmou a ${dataLonga(c.entrada.confirmadaLarEm)}` : 'Ainda não confirmou'}</Linha>
              <Linha k={c.encaminhamento ? 'Quem encaminhou' : 'Família'}>
                {c.entrada.confirmadaFamiliaEm ? `Confirmou a ${dataLonga(c.entrada.confirmadaFamiliaEm)}` : 'Ainda não confirmou'}
              </Linha>
              <Linha k="Taxa">{TAXA_TEXTO[c.entrada.taxa]}</Linha>
            </dl>
          </Bloco>
        )}

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

/** Primeira fase: o resumo anónimo do pedido. Sem nome, contacto, notas, mensagem nem histórico. */
function ResumoAnonimoModal({ c, lar, agora, open, onClose }: { c: Candidatura; lar: Lar; agora: number; open: boolean; onClose: () => void }) {
  const r = resumoAnonimo(c)
  const alta = altaTexto(r.altaPrevista, agora)
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={nomePedido(c)}
      description={`${relacaoTexto(c)} · recebido a ${dataLonga(c.criadaEm)}`}
      footer={<PedidoAcoes c={c} lar={lar} agora={agora} variante="folha" className="w-full" />}
    >
      <div className="flex flex-col gap-5">
        <OrigemBadges c={c} agora={agora} />
        <AvisoBloqueio className="text-base" />
        <VisitaLinha c={c} />

        <Bloco titulo="Saúde">
          <p className="font-medium">{GRAU_LABEL[r.grau]}</p>
          <p className="text-ink-mute">{GRAU_DESCRICAO[r.grau]}</p>
          {r.necessidades.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-1">
              {r.necessidades.map((n) => {
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
        </Bloco>

        <Bloco titulo="O que procura">
          <dl>
            <Linha k="Idade">{r.faixaEtaria} anos</Linha>
            <Linha k="Zona">{r.zona}</Linha>
            <Linha k="Quarto">{r.quarto === 'indiferente' ? 'Indiferente' : QUARTO_LABEL[r.quarto]}</Linha>
            <Linha k="Orçamento">Até {euro(r.orcamentoMax)} por mês</Linha>
            <Linha k="Quando">{URGENCIA_LABEL[r.urgencia]}</Linha>
            <Linha k="Segurança Social">{r.precisaAcordoSS ? 'Precisa de vaga comparticipada' : 'Não precisa de comparticipação'}</Linha>
            <Linha k="Origem">{r.organizacao ? `Encaminhado por ${r.organizacao}` : 'Pedido de uma família'}</Linha>
            {r.altaPrevista && alta && (
              <Linha k="Alta hospitalar">
                {alta.dias >= 0 ? `Alta prevista: ${diaCurto(r.altaPrevista)} (${alta.texto.charAt(0).toLowerCase()}${alta.texto.slice(1)})` : alta.texto}
              </Linha>
            )}
          </dl>
        </Bloco>

        <Bloco titulo="Compatibilidade">
          <CompatLines lar={lar} perfil={c.perfil} />
          <p className="mt-3 text-xs text-ink-mute">Verificação automática com base na sua ficha.</p>
        </Bloco>
      </div>
    </Modal>
  )
}
