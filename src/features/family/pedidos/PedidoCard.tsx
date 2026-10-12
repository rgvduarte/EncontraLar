import { useState } from 'react'
import { Link } from 'react-router'
import { ArrowUpRight, Ban, Mail, Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { ButtonLink, Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { LarCover } from '@/components/lar/LarCover'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { cancelarCandidatura } from '@/lib/store'
import { ESTADO_CANDIDATURA_DESCRICAO, NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { dataLonga, duracaoHumana } from '@/lib/format'
import { cn } from '@/lib/cn'
import { estimativaPessoal, isAtiva } from '../shared/estado'
import { PedidoRail } from '../shared/PedidoRail'
import { VagaProposta } from '../shared/VagaProposta'
import { ConfirmModal, EstadoBadge } from '../shared/ui'
import { deNome, g, nomeCurto, ordinal, telHref } from '../shared/text'
import { Historico } from './Historico'
import { VisitaBlock } from './VisitaBlock'

const comPrevisao = (c: Candidatura) => ['enviada', 'em_analise', 'lista_espera'].includes(c.estado)

/** Lugar na lista + estimativa pessoal, em números grandes. */
function Lugar({ c, lar }: { c: Candidatura; lar: Lar }) {
  if (c.estado === 'aceite') {
    return (
      <div>
        <h3 className="eyebrow">Entrada</h3>
        <p className="mt-2 font-display text-3xl font-semibold text-leaf-700">Vaga garantida</p>
        <p className="mt-2 text-ink-soft">
          A instituição vai ligar-lhe para combinar o dia de entrada. Costumam pedir: cartão de cidadão e de utente, relatório
          médico recente, lista da medicação e, nas IPSS e Misericórdias, comprovativos de rendimentos.
        </p>
      </div>
    )
  }
  if (!isAtiva(c)) {
    return (
      <div>
        <h3 className="eyebrow">Situação</h3>
        <p className="mt-2 text-ink-soft">{ESTADO_CANDIDATURA_DESCRICAO[c.estado]}</p>
        <p className="mt-2 text-ink-soft">
          Se a situação mudar, pode voltar a pedir vaga na{' '}
          <Link to={`/lar/${lar.id}`} className="link">
            ficha da instituição
          </Link>
          .
        </p>
      </div>
    )
  }
  const { est, texto, pessoal } = estimativaPessoal(lar, c.posicao)
  const proxLugar = lar.listaEspera + 1
  return (
    <div>
      <h3 className="eyebrow">Lugar na lista de espera</h3>
      {c.posicao ? (
        <p className="mt-2 flex items-baseline gap-3">
          <span className="font-display text-6xl leading-none font-semibold text-ink tabular">{ordinal(c.posicao)}</span>
          <span className="text-ink-soft">de {Math.max(lar.listaEspera, c.posicao)} pessoas inscritas</span>
        </p>
      ) : (
        <p className="mt-2 text-ink-soft">
          Ainda sem lugar: a instituição está a analisar o pedido. Se {nomeCurto(c.perfil.nome)} fosse {g(c.perfil, 'inscrita', 'inscrito')}{' '}
          hoje, ficaria em{' '}
          <strong className="text-ink">{ordinal(proxLugar)}</strong>.
        </p>
      )}
      {c.estado !== 'vaga_proposta' && (
        <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-dashed border-line-strong pt-4">
          <div>
            <dt className="text-sm text-ink-soft">{pessoal ? 'Estimativa para si' : 'Estimativa ao entrar na lista'}</dt>
            <dd className="mt-0.5 text-lg leading-snug font-bold first-letter:uppercase">{texto}</dd>
          </div>
          <div>
            <dt className="text-sm text-ink-soft">Cenário mais provável</dt>
            <dd className="mt-0.5 text-lg leading-snug font-bold first-letter:uppercase">
              {est.imediata ? 'já há lugar' : est.diasMediana != null ? duracaoHumana(est.diasMediana) : 'mais de 2 anos'}
            </dd>
          </div>
        </dl>
      )}
      <p className="mt-4 text-sm text-ink-soft">
        Nem todas as pessoas à frente aceitam a vaga quando são contactadas — muitas inscrevem-se em vários lares ou já encontraram
        solução. A estimativa já tem isso em conta.
      </p>
    </div>
  )
}

export function PedidoCard({ c, lar }: { c: Candidatura; lar: Lar }) {
  const [cancelar, setCancelar] = useState(false)
  const ativa = isAtiva(c)
  const titleId = `pedido-${c.id}-titulo`
  const pessoa = nomeCurto(c.perfil.nome)
  const previsao = comPrevisao(c) ? estimativaPessoal(lar, c.posicao) : null

  const confirmarCancelamento = () => {
    cancelarCandidatura(c.id)
    setCancelar(false)
    toast.info('Pedido cancelado', 'A instituição foi avisada. Pode voltar a pedir vaga quando quiser.')
  }

  return (
    <article id={`pedido-${c.id}`} aria-labelledby={titleId} className="scroll-mt-40 overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-card">
      {/* cabeçalho */}
      <div className="flex flex-col gap-5 p-5 sm:flex-row sm:p-7">
        <Link to={`/lar/${lar.id}`} tabIndex={-1} aria-hidden className="block aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl border border-line sm:w-44">
          <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink-soft">
            {TIPO_LABEL[lar.tipo]} · {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
          </p>
          <h2 id={titleId} className="mt-1 font-display text-2xl leading-snug font-semibold">
            <Link to={`/lar/${lar.id}`} className="hover:underline">
              {lar.nome}
            </Link>
          </h2>
          <p className="mt-1 text-ink-soft">
            Pedido para <strong className="text-ink">{pessoa}</strong> · enviado a {dataLonga(c.criadaEm)}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <EstadoBadge estado={c.estado} size="md" />
            <span className="text-sm text-ink-soft">{ESTADO_CANDIDATURA_DESCRICAO[c.estado]}</span>
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-7">
        <PedidoRail c={c} />
      </div>

      {c.estado === 'vaga_proposta' && (
        <div className="mt-6 px-5 sm:px-7">
          <VagaProposta c={c} lar={lar} variant="inline" />
        </div>
      )}

      {/* corpo: lugar/estimativa + histórico */}
      <div className="mt-6 grid border-t border-line md:grid-cols-2">
        <div className="bg-sand/35 p-5 sm:p-7">
          <Lugar c={c} lar={lar} />
        </div>
        <div className="border-t border-line p-5 sm:p-7 md:border-t-0 md:border-l">
          <h3 className="eyebrow mb-4">Histórico do pedido</h3>
          <Historico c={c} />
        </div>
      </div>

      {previsao && !previsao.est.imediata && (
        <div className="border-t border-line p-5 sm:p-7">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h3 className="font-display text-xl font-semibold">
              Previsão {deNome(c.perfil)}, mês a mês
            </h3>
            <p className="text-sm text-ink-soft">probabilidade de já ter vaga no fim de cada mês</p>
          </div>
          <ForecastStrip curva={previsao.est.curva} meses={6} />
          <p className="mt-3 text-sm text-ink-soft">
            Calculada com {previsao.pessoal ? `o ${ordinal(c.posicao!)} lugar na lista` : 'a lista de espera atual'}, as vagas livres e as
            saídas dos últimos 12 meses desta instituição. É uma estimativa, não uma garantia.
          </p>
        </div>
      )}

      {ativa && (
        <div className="border-t border-line p-5 sm:p-7">
          <VisitaBlock c={c} lar={lar} />
        </div>
      )}

      {/* ações */}
      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-cream px-5 py-4 sm:px-7">
        <ButtonLink to={`/lar/${lar.id}`} variant="secondary" iconRight={<ArrowUpRight aria-hidden className="size-4.5" />}>
          Ver ficha
        </ButtonLink>
        {lar.telefone && (
          <a href={telHref(lar.telefone)} className="inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 font-bold text-pine-800 hover:bg-pine-50">
            <Phone aria-hidden className="size-4.5" />
            <span>
              Ligar<span className="hidden sm:inline"> · {lar.telefone}</span>
            </span>
          </a>
        )}
        {lar.email && (
          <a
            href={`mailto:${lar.email}?subject=${encodeURIComponent(`Pedido de vaga — ${c.perfil.nome}`)}`}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 font-bold text-pine-800 hover:bg-pine-50"
          >
            <Mail aria-hidden className="size-4.5" />
            Enviar email
          </a>
        )}
        {ativa && (
          <Button variant="danger" className="sm:ml-auto" icon={<Ban aria-hidden className="size-4.5" />} onClick={() => setCancelar(true)}>
            {c.estado === 'aceite' ? 'Desistir da vaga' : 'Cancelar pedido'}
          </Button>
        )}
      </div>

      <ConfirmModal
        open={cancelar}
        onClose={() => setCancelar(false)}
        onConfirm={confirmarCancelamento}
        title={c.estado === 'aceite' ? 'Desistir da vaga aceite?' : 'Cancelar este pedido?'}
        description={`${lar.nome} · pedido para ${pessoa}`}
        confirmLabel={c.estado === 'aceite' ? 'Sim, desistir' : 'Sim, cancelar pedido'}
        cancelLabel="Manter pedido"
        confirmVariant="danger"
        confirmIcon={<Ban aria-hidden className="size-5" />}
      >
        <p>
          {c.posicao ? (
            <>
              <strong>
                {pessoa} sai da lista de espera e perde o {ordinal(c.posicao)} lugar.
              </strong>{' '}
              Se mudar de ideias, terá de fazer um novo pedido e entra no fim da lista.
            </>
          ) : c.estado === 'aceite' ? (
            <>
              <strong>A vaga fica livre para outra família.</strong> Avise também a instituição por telefone, se já combinou a entrada.
            </>
          ) : (
            <>A instituição deixa de analisar o pedido. Pode voltar a pedir vaga mais tarde.</>
          )}
        </p>
        <p className={cn('mt-3 text-ink-soft')}>A instituição recebe uma notificação do cancelamento.</p>
      </ConfirmModal>
    </article>
  )
}
