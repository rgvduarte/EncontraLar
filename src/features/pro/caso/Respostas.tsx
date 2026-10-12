import { forwardRef, useId, useState } from 'react'
import { Link } from 'react-router'
import { BadgeCheck, Clock, Phone } from 'lucide-react'
import type { Candidatura, Caso, Lar } from '@/types'
import { atualizarCaso, cancelarCandidatura, confirmarEntradaFamilia, responderVaga, useLares } from '@/lib/store'
import { contactoVisivel, entradaVerificada } from '@/lib/negocio'
import { isoDia, plural, tempoRelativo } from '@/lib/format'
import { NATUREZA_LABEL } from '@/lib/labels'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { cn } from '@/lib/cn'
import { CANCELAVEIS, descricaoEstado, diaLongo, ordenarRespostas, prazoTexto, resumirRespostas, ultimaNotaDoLar } from '../shared/caso'
import { Confirmar, EstadoPedido } from '../shared/ui'

const telHref = (t: string) => `tel:${t.replace(/[^\d+]/g, '')}`
const dataHora = (iso: string) => new Date(iso).toLocaleString('pt-PT', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/** "Já entrou?": dia de entrada (hoje por omissão) + "Confirmar entrada". */
function ConfirmarEntrada({ c, lar }: { c: Candidatura; lar: Lar }) {
  const hoje = isoDia(new Date())
  const [dia, setDia] = useState(hoje)
  const [erro, setErro] = useState<string>()
  const confirmar = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return setErro('Indique o dia de entrada.')
    if (dia > hoje) return setErro('O dia de entrada não pode ser no futuro.')
    confirmarEntradaFamilia(c.id, dia)
    toast.success('Entrada confirmada', `Fica registada a entrada a ${diaLongo(dia)}.`)
  }
  return (
    <div className="mt-4 rounded-[1.25rem] bg-sand p-5">
      <p className="font-semibold">Já entrou?</p>
      <p className="mt-1 text-[0.9375rem] text-ink-soft">
        Confirme o dia de entrada. {lar.nome} também a regista; com as duas confirmações, a entrada fica verificada.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <InputField
          label="Dia de entrada"
          type="date"
          max={hoje}
          value={dia}
          onChange={(e) => {
            setDia(e.target.value)
            setErro(undefined)
          }}
          error={erro}
          wrapperClassName="sm:w-56"
        />
        <Button onClick={confirmar} className="w-full sm:w-auto">
          Confirmar entrada
        </Button>
      </div>
    </div>
  )
}

/** Uma resposta: instituição, estado, última nota, data, contacto (depois de aceitar) e as ações do momento. */
function Resposta({ c, lar, caso }: { c: Candidatura; lar: Lar; caso: Caso }) {
  const [modal, setModal] = useState<'aceitar' | 'recusar' | 'cancelar' | null>(null)
  const nota = ultimaNotaDoLar(c)
  const titulo = useId()
  const contacto = contactoVisivel(c) && lar.telefone
  const terminado = c.estado === 'recusada' || c.estado === 'cancelada'

  const aceitar = () => {
    setModal(null)
    responderVaga(c.id, true)
    toast.success('Vaga aceite', 'A instituição foi avisada e vai combinar consigo o dia de entrada.')
  }
  const recusar = () => {
    setModal(null)
    responderVaga(c.id, false)
    toast.info('Vaga recusada', 'A pessoa mantém o lugar na lista de espera.')
  }
  const cancelar = () => {
    setModal(null)
    cancelarCandidatura(c.id)
    toast.info('Pedido cancelado', 'A instituição foi avisada.')
  }

  return (
    <li
      aria-labelledby={titulo}
      className={cn(
        'rounded-[1.5rem] p-5 ring-1 sm:p-6',
        c.estado === 'vaga_proposta' ? 'bg-terra-50/60 ring-2 ring-terra-600' : 'bg-white ring-line',
      )}
    >
      <div className="flex flex-col gap-x-6 gap-y-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h3 id={titulo} className={cn('text-lg leading-snug font-semibold', terminado && 'text-ink-soft')}>
            <Link to={`/lar/${encodeURIComponent(lar.id)}`} className="hover:underline">
              {lar.nome}
            </Link>
          </h3>
          <p className="mt-0.5 text-[0.9375rem] text-ink-mute">
            {NATUREZA_LABEL[lar.natureza]} · {lar.localidade}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 sm:flex-col sm:items-end sm:gap-1">
          <p className="font-semibold">
            <EstadoPedido estado={c.estado} />
          </p>
          <p className="text-sm text-ink-mute">
            <time dateTime={c.atualizadaEm} title={dataHora(c.atualizadaEm)}>
              {tempoRelativo(c.atualizadaEm)}
            </time>
          </p>
        </div>
      </div>

      <p className="mt-3 text-[0.9375rem] text-ink-soft">{descricaoEstado(c)}</p>

      {nota && (
        <figure className="mt-4 border-l-2 border-line-strong pl-4">
          <blockquote className="text-ink">“{nota.nota}”</blockquote>
          <figcaption className="mt-1 text-sm text-ink-mute">
            {lar.nome}, {tempoRelativo(nota.data)}
          </figcaption>
        </figure>
      )}

      {c.estado === 'vaga_proposta' && (
        <div className="mt-5">
          <p className="flex items-start gap-2 font-semibold text-terra-800">
            <Clock aria-hidden className="mt-1 size-4 shrink-0" />
            {c.prazoResposta ? `Responda até ${prazoTexto(c.prazoResposta)}.` : 'Responda à instituição o mais depressa possível.'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex">
            <Button onClick={() => setModal('aceitar')}>Aceitar vaga</Button>
            <Button variant="secondary" onClick={() => setModal('recusar')}>
              Recusar
            </Button>
          </div>
        </div>
      )}

      {c.estado === 'aceite' && <ConfirmarEntrada c={c} lar={lar} />}

      {c.estado === 'admitida' && (
        <div className="mt-4">
          {entradaVerificada(c) ? (
            <p className="inline-flex items-center gap-2 font-semibold text-leaf-700">
              <BadgeCheck aria-hidden className="size-5" />
              Entrada verificada{c.entrada ? ` · ${diaLongo(c.entrada.data)}` : ''}
            </p>
          ) : c.entrada?.confirmadaFamiliaEm ? (
            <p className="inline-flex items-center gap-2 font-medium text-ink-soft">
              <Clock aria-hidden className="size-5" />
              A aguardar confirmação da instituição
            </p>
          ) : (
            <>
              <p className="text-[0.9375rem] text-ink-soft">
                {lar.nome} registou a entrada{c.entrada ? ` a ${diaLongo(c.entrada.data)}` : ''}. Confirma?
              </p>
              <Button
                className="mt-3 w-full sm:w-auto"
                onClick={() => {
                  confirmarEntradaFamilia(c.id, c.entrada?.data ?? isoDia(new Date()))
                  toast.success('Entrada verificada', 'As duas confirmações estão registadas.')
                }}
              >
                Confirmar entrada
              </Button>
            </>
          )}
          {caso.estado === 'aberto' && (
            <div className="mt-3">
              <Button
                variant="subtle"
                className="w-full sm:w-auto"
                onClick={() => {
                  atualizarCaso(caso.id, { estado: 'colocado' })
                  toast.success('Caso colocado', 'Passa para “Colocados e fechados”.')
                }}
              >
                Marcar o caso como colocado
              </Button>
            </div>
          )}
        </div>
      )}

      {(contacto || CANCELAVEIS.includes(c.estado)) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 border-t border-line pt-3">
          {contacto && (
            <a href={telHref(lar.telefone)} className="link inline-flex min-h-11 items-center gap-2" aria-label={`Ligar para ${lar.nome}: ${lar.telefone}`}>
              <Phone aria-hidden className="size-4" />
              <span className="tabular">{lar.telefone}</span>
            </a>
          )}
          {CANCELAVEIS.includes(c.estado) && (
            <button type="button" onClick={() => setModal('cancelar')} className="inline-flex min-h-11 items-center font-medium text-alert-700 hover:underline">
              Cancelar pedido
            </button>
          )}
        </div>
      )}

      <Confirmar
        open={modal === 'aceitar'}
        onClose={() => setModal(null)}
        onConfirm={aceitar}
        title="Aceitar esta vaga?"
        description={lar.nome}
        confirmLabel="Aceitar vaga"
        cancelLabel="Ainda não"
      >
        <p>A instituição recebe já a resposta e combina consigo o dia de entrada.</p>
        <p>Os outros pedidos deste caso continuam ativos. Pode cancelá-los aqui, ou ao marcar o caso como colocado.</p>
      </Confirmar>
      <Confirmar
        open={modal === 'recusar'}
        onClose={() => setModal(null)}
        onConfirm={recusar}
        title="Recusar esta vaga?"
        description={lar.nome}
        confirmLabel="Recusar vaga"
        confirmVariant="danger"
      >
        <p>A vaga passa para a pessoa seguinte da lista. Esta pessoa mantém o lugar na lista de espera.</p>
      </Confirmar>
      <Confirmar
        open={modal === 'cancelar'}
        onClose={() => setModal(null)}
        onConfirm={cancelar}
        title="Cancelar este pedido?"
        description={lar.nome}
        confirmLabel="Cancelar pedido"
        cancelLabel="Manter"
        confirmVariant="danger"
      >
        <p>A instituição é avisada e deixa de guardar lugar para esta pessoa. Pode voltar a enviar o caso mais tarde.</p>
      </Confirmar>
    </li>
  )
}

/** "Respostas": um pedido por instituição, o que pede ação primeiro. O título recebe o foco depois de enviar. */
export const Respostas = forwardRef<HTMLHeadingElement, { caso: Caso; cands: Candidatura[] }>(function Respostas({ caso, cands }, ref) {
  const lares = useLares()
  const porId = new Map(lares.map((l) => [l.id, l]))
  const r = resumirRespostas(cands)
  const lista = ordenarRespostas(cands)
  return (
    <section aria-labelledby="respostas-titulo" className="scroll-mt-28">
      <h2 id="respostas-titulo" ref={ref} tabIndex={-1} className="text-2xl font-semibold outline-none sm:text-3xl">
        Respostas
      </h2>
      <p className="mt-1.5 text-ink-mute" aria-live="polite">
        {r.enviados ? r.texto : `${plural(cands.length, 'pedido cancelado', 'pedidos cancelados')}`}
      </p>
      <ul className="mt-6 flex flex-col gap-3">
        {lista.map((c) => {
          const lar = porId.get(c.larId)
          return lar ? <Resposta key={c.id} c={c} lar={lar} caso={caso} /> : null
        })}
      </ul>
    </section>
  )
})
