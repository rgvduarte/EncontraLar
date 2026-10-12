import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Mail, Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { toast } from '@/components/ui/Toast'
import { LarCover } from '@/components/lar/LarCover'
import { CountUp } from '@/components/motion'
import { cancelarCandidatura } from '@/lib/store'
import { ESTADO_CANDIDATURA_DESCRICAO } from '@/lib/labels'
import { dataLonga } from '@/lib/format'
import { cn } from '@/lib/cn'
import { estimativaPessoal, isAtiva } from '../shared/estado'
import { VagaProposta } from '../shared/VagaProposta'
import { AnimatedForecast } from '../shared/Forecast'
import { enterCls, sairEDepois, useChangeAnimation, useSeen } from '../shared/motion'
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
              <span className="mt-2 block text-ink-mute">
                de <CountUp value={Math.max(lar.listaEspera, c.posicao)} duration={1100} className="tabular" /> inscritos
              </span>
            </dd>
          ) : (
            <dd className="mt-1 text-xl font-semibold text-ink-soft">Ainda sem lugar</dd>
          )}
        </div>
        <div>
          <dt className="text-sm text-ink-mute">{pessoal ? 'Estimativa para si' : 'Se entrar na lista hoje'}</dt>
          <dd className="mt-1 text-2xl leading-tight font-semibold tracking-tight first-letter:uppercase sm:text-3xl">{texto}</dd>
        </div>
      </dl>
      {!est.imediata && (
        <div className="mt-10">
          <AnimatedForecast curva={est.curva} meses={6} />
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
export function PedidoCard({
  c,
  lar,
  index = 0,
  animateIn = true,
  thumbBar = false,
}: {
  c: Candidatura
  lar: Lar
  /** posição na lista (para escalonar a entrada) */
  index?: number
  animateIn?: boolean
  thumbBar?: boolean
}) {
  const [cancelar, setCancelar] = useState(false)
  const [seen, visto] = useSeen<HTMLElement>()
  const on = visto || !animateIn
  const card = useRef<HTMLElement | null>(null)
  const cardRef = useCallback(
    (el: HTMLElement | null) => {
      card.current = el
      return seen(el)
    },
    [seen],
  )
  const estadoRef = useRef<HTMLDivElement>(null)
  // quando o estado muda (aceite, recusada…), o bloco de estado entra de novo
  useChangeAnimation(estadoRef, c.estado)
  const ativa = isAtiva(c)
  const titleId = `pedido-${c.id}-titulo`
  const pessoa = nomeCurto(c.perfil.nome)
  const mostraEspera = ['enviada', 'em_analise', 'lista_espera'].includes(c.estado)

  const confirmarCancelamento = () => {
    setCancelar(false)
    // o cartão sai antes de passar para "Terminados"
    sairEDepois(card.current, () => {
      cancelarCandidatura(c.id)
      toast.info('Pedido cancelado', 'A instituição foi avisada. Pode voltar a pedir vaga quando quiser.')
    })
  }
  const contactos = Number(Boolean(lar.telefone)) + Number(Boolean(lar.email))

  return (
    <article
      ref={cardRef}
      id={`pedido-${c.id}`}
      aria-labelledby={titleId}
      style={{ transitionDelay: on ? `${Math.min(index, 4) * 90}ms` : '0ms' }}
      className={cn(
        enterCls(on, 'up'),
        'scroll-mt-40 border-t border-line pt-12 lg:scroll-mt-24 first:border-t-0 first:pt-0 sm:rounded-[1.75rem] sm:border-t-0 sm:bg-white sm:p-10 sm:ring-1 sm:ring-line sm:first:pt-10',
      )}
    >
      <header>
        <div className="flex items-center gap-4 sm:gap-5">
          <Link to={`/lar/${lar.id}`} tabIndex={-1} aria-hidden className="block size-14 shrink-0 overflow-hidden rounded-2xl sm:size-20">
            <LarCover hue={lar.capa.hue} variante={lar.capa.variante} />
          </Link>
          <h2 id={titleId} className="min-w-0 text-xl leading-tight font-semibold sm:text-3xl">
            <Link to={`/lar/${lar.id}`} className="hover:underline">
              {lar.nome}
            </Link>
          </h2>
        </div>
        <p className="mt-3 text-ink-mute sm:mt-2 sm:pl-25">
          {lar.localidade} · para {pessoa} · desde {dataLonga(c.criadaEm)}
        </p>
      </header>

      <div ref={estadoRef} className="mt-8">
        {c.estado === 'vaga_proposta' ? (
          <VagaProposta c={c} lar={lar} variant="inline" thumbBar={thumbBar} />
        ) : (
          <>
            <p className="text-lg font-semibold">
              <EstadoTag estado={c.estado} />
            </p>
            <p className="mt-1 text-ink-mute">{ESTADO_CANDIDATURA_DESCRICAO[c.estado]}</p>
          </>
        )}
      </div>

      {c.estado === 'aceite' && (
        <p className="mt-8 rounded-[1.75rem] bg-sand p-6 text-ink-soft">
          Para a entrada, costumam pedir o cartão de cidadão e de utente, um relatório médico recente e a lista da medicação.
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
        {ativa && (c.estado !== 'aceite' || c.visita) && (
          <section aria-labelledby={`${titleId}-visita`}>
            <h3 id={`${titleId}-visita`} className="mb-5 text-sm font-semibold text-ink-mute">
              Visita
            </h3>
            <VisitaBlock c={c} lar={lar} />
          </section>
        )}
      </div>

      {/* telemóvel: Ligar/Email como botões ao alcance do polegar; desktop: uma linha de ligações */}
      <footer className="mt-10 border-t border-line pt-5 sm:flex sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-1">
        {contactos > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:contents">
            {lar.telefone && (
              <a
                href={telHref(lar.telefone)}
                aria-label={`Ligar para ${lar.nome}: ${lar.telefone}`}
                className={cn(
                  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-sand px-5 font-medium text-ink transition-[background-color,scale] duration-200 active:scale-[0.98] active:bg-sand-deep',
                  'sm:justify-start sm:rounded-none sm:bg-transparent sm:px-0 sm:text-terra-600 sm:hover:underline sm:active:scale-100 sm:active:bg-transparent',
                  contactos === 1 && 'col-span-2',
                )}
              >
                <Phone aria-hidden className="size-4" />
                <span className="sm:hidden">Ligar</span>
                <span className="hidden sm:inline">{lar.telefone}</span>
              </a>
            )}
            {lar.email && (
              <a
                href={`mailto:${lar.email}?subject=${encodeURIComponent(`Pedido de vaga — ${c.perfil.nome}`)}`}
                className={cn(
                  'inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-sand px-5 font-medium text-ink transition-[background-color,scale] duration-200 active:scale-[0.98] active:bg-sand-deep',
                  'sm:justify-start sm:rounded-none sm:bg-transparent sm:px-0 sm:text-terra-600 sm:hover:underline sm:active:scale-100 sm:active:bg-transparent',
                  contactos === 1 && 'col-span-2',
                )}
              >
                <Mail aria-hidden className="size-4" />
                Email
              </a>
            )}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-4 sm:contents">
          <MoreLink to={`/lar/${lar.id}`} className="sm:order-first">
            Ver ficha
          </MoreLink>
          {ativa && (
            <button
              type="button"
              onClick={() => setCancelar(true)}
              className="inline-flex min-h-12 items-center font-medium text-alert-700 hover:underline sm:ml-auto"
            >
              {c.estado === 'aceite' ? 'Desistir da vaga' : 'Cancelar pedido'}
            </button>
          )}
        </div>
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
