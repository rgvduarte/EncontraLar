import { useState } from 'react'
import { Link } from 'react-router'
import { Mail, Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { toast } from '@/components/ui/Toast'
import { LarCover } from '@/components/lar/LarCover'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { cancelarCandidatura } from '@/lib/store'
import { ESTADO_CANDIDATURA_DESCRICAO } from '@/lib/labels'
import { dataLonga } from '@/lib/format'
import { estimativaPessoal, isAtiva } from '../shared/estado'
import { VagaProposta } from '../shared/VagaProposta'
import { ConfirmModal, EstadoTag, MoreLink } from '../shared/ui'
import { comArtigo, nomeCurto, ordinal, telHref } from '../shared/text'
import { Historico } from './Historico'
import { VisitaBlock } from './VisitaBlock'

/** Lugar na lista + estimativa pessoal + previsão mês a mês. */
function Espera({ c, lar }: { c: Candidatura; lar: Lar }) {
  const { est, texto, pessoal } = estimativaPessoal(lar, c.posicao)
  return (
    <div className="mt-10">
      <dl className="grid grid-cols-2 gap-6 sm:max-w-xl">
        <div>
          <dt className="text-sm text-ink-mute">Lugar na lista</dt>
          {c.posicao ? (
            <dd className="mt-1">
              <span className="block text-6xl leading-none font-semibold tracking-tight tabular">{ordinal(c.posicao)}</span>
              <span className="mt-2 block text-ink-mute">de {Math.max(lar.listaEspera, c.posicao)} inscritos</span>
            </dd>
          ) : (
            <dd className="mt-1 text-xl font-semibold text-ink-soft">Ainda sem lugar</dd>
          )}
        </div>
        <div>
          <dt className="text-sm text-ink-mute">{pessoal ? 'Estimativa para si' : 'Se entrar na lista hoje'}</dt>
          <dd className="mt-1 text-3xl leading-tight font-semibold tracking-tight first-letter:uppercase">{texto}</dd>
        </div>
      </dl>
      {!est.imediata && (
        <div className="mt-10">
          <ForecastStrip curva={est.curva} meses={6} />
          <p className="mt-4 text-sm text-ink-mute">
            Probabilidade de já ter vaga no fim de cada mês, {pessoal ? `com o ${ordinal(c.posicao!)} lugar` : 'para quem entra hoje na lista'}.
            É uma estimativa, não uma garantia.
          </p>
        </div>
      )}
    </div>
  )
}

/** Um pedido de vaga: estado, espera prevista, histórico, visita e ações. */
export function PedidoCard({ c, lar }: { c: Candidatura; lar: Lar }) {
  const [cancelar, setCancelar] = useState(false)
  const ativa = isAtiva(c)
  const titleId = `pedido-${c.id}-titulo`
  const pessoa = nomeCurto(c.perfil.nome)
  const mostraEspera = ['enviada', 'em_analise', 'lista_espera'].includes(c.estado)

  const confirmarCancelamento = () => {
    setCancelar(false)
    cancelarCandidatura(c.id)
    toast.info('Pedido cancelado', 'A instituição foi avisada. Pode voltar a pedir vaga quando quiser.')
  }

  return (
    <article id={`pedido-${c.id}`} aria-labelledby={titleId} className="scroll-mt-40 rounded-[1.75rem] bg-white p-6 ring-1 ring-line sm:p-10">
      <header className="flex items-start gap-5">
        <Link to={`/lar/${lar.id}`} tabIndex={-1} aria-hidden className="block size-16 shrink-0 overflow-hidden rounded-2xl sm:size-20">
          <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
        </Link>
        <div className="min-w-0">
          <h2 id={titleId} className="text-2xl leading-tight font-semibold sm:text-3xl">
            <Link to={`/lar/${lar.id}`} className="hover:underline">
              {lar.nome}
            </Link>
          </h2>
          <p className="mt-1.5 text-ink-mute">
            {lar.localidade} · para {pessoa} · desde {dataLonga(c.criadaEm)}
          </p>
        </div>
      </header>

      <div className="mt-8">
        <p className="text-lg font-semibold">
          <EstadoTag estado={c.estado} />
        </p>
        <p className="mt-1 text-ink-mute">{ESTADO_CANDIDATURA_DESCRICAO[c.estado]}</p>
      </div>

      {c.estado === 'vaga_proposta' && (
        <div className="mt-8">
          <VagaProposta c={c} lar={lar} variant="inline" />
        </div>
      )}

      {c.estado === 'aceite' && (
        <p className="mt-8 rounded-[1.75rem] bg-sand p-6 text-ink-soft">
          A instituição liga-lhe para combinar o dia de entrada. Costumam pedir cartão de cidadão e de utente, relatório médico
          recente e a lista da medicação.
        </p>
      )}

      {mostraEspera && <Espera c={c} lar={lar} />}

      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <section aria-labelledby={`${titleId}-hist`}>
          <h3 id={`${titleId}-hist`} className="mb-5 text-sm font-semibold text-ink-mute">
            Histórico
          </h3>
          <Historico c={c} />
        </section>
        {ativa && (
          <section aria-labelledby={`${titleId}-visita`}>
            <h3 id={`${titleId}-visita`} className="mb-5 text-sm font-semibold text-ink-mute">
              Visita
            </h3>
            <VisitaBlock c={c} lar={lar} />
          </section>
        )}
      </div>

      <footer className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-1 border-t border-line pt-5">
        <MoreLink to={`/lar/${lar.id}`}>Ver ficha</MoreLink>
        {lar.telefone && (
          <a href={telHref(lar.telefone)} className="link inline-flex min-h-12 items-center gap-2">
            <Phone aria-hidden className="size-4" />
            {lar.telefone}
          </a>
        )}
        {lar.email && (
          <a
            href={`mailto:${lar.email}?subject=${encodeURIComponent(`Pedido de vaga — ${c.perfil.nome}`)}`}
            className="link inline-flex min-h-12 items-center gap-2"
          >
            <Mail aria-hidden className="size-4" />
            Email
          </a>
        )}
        {ativa && (
          <button
            type="button"
            onClick={() => setCancelar(true)}
            className="inline-flex min-h-12 items-center font-medium text-alert-700 hover:underline sm:ml-auto"
          >
            {c.estado === 'aceite' ? 'Desistir da vaga' : 'Cancelar pedido'}
          </button>
        )}
      </footer>

      <ConfirmModal
        open={cancelar}
        onClose={() => setCancelar(false)}
        onConfirm={confirmarCancelamento}
        title={c.estado === 'aceite' ? 'Desistir da vaga?' : 'Cancelar este pedido?'}
        description={lar.nome}
        confirmLabel={c.estado === 'aceite' ? 'Desistir da vaga' : 'Cancelar pedido'}
        cancelLabel="Manter pedido"
        confirmVariant="danger"
      >
        <p>
          {c.posicao
            ? `${pessoa} sai da lista e perde o ${ordinal(c.posicao)} lugar. Para voltar, terá de fazer um novo pedido e entra no fim da lista.`
            : c.estado === 'aceite'
              ? 'A vaga fica livre para outra família.'
              : `A instituição deixa de analisar o pedido para ${comArtigo(c.perfil)}. Pode voltar a pedir mais tarde.`}
        </p>
        <p className="mt-3">A instituição é avisada do cancelamento.</p>
      </ConfirmModal>
    </article>
  )
}
