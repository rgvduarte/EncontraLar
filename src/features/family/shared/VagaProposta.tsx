import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { BellRing, Check, Phone, TriangleAlert, Undo2 } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { Meter } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { AzulejoBand } from '@/components/brand/patterns'
import { responderVaga } from '@/lib/store'
import { euro, tempoRelativo } from '@/lib/format'
import { QUARTO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { ConfirmModal } from './ui'
import { horaDe, quartoProposto } from './estado'
import { artigo, comArtigo, diaPorExtenso, g, nomeCurto, ordinal, telHref } from './text'

const PRAZO_PADRAO_MS = 48 * 3_600_000

/** Hora atual que se atualiza sozinha (para contagens decrescentes). */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

function partes(ms: number): { v: number; u: string }[] {
  const min = Math.floor(ms / 60_000)
  const h = Math.floor(min / 60)
  if (h >= 48) {
    const d = Math.floor(h / 24)
    return [
      { v: d, u: d === 1 ? 'dia' : 'dias' },
      { v: h % 24, u: 'h' },
    ]
  }
  if (h >= 1) return [{ v: h, u: 'h' }, { v: min % 60, u: 'min' }]
  return [{ v: Math.max(0, min), u: 'min' }]
}

/** Bloco de contagem decrescente até ao prazo de resposta. */
function Contagem({ prazo, compact }: { prazo: string; compact?: boolean }) {
  const now = useNow()
  const fim = new Date(prazo).getTime()
  const restante = fim - now
  const expirou = restante <= 0
  const p = partes(restante)
  const textoPrazo = `${diaPorExtenso(new Date(prazo))}, às ${horaDe(prazo)}`
  return (
    <div className={cn('rounded-3xl border border-terra-200 bg-white/85 text-left', compact ? 'p-4' : 'p-5 lg:min-w-64')}>
      <p className="text-sm font-bold text-terra-800">{expirou ? 'O prazo terminou' : 'Tempo para responder'}</p>
      {expirou ? (
        <p className="mt-1 flex items-start gap-2 text-sm text-ink-soft">
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-alert-600" />
          Ligue para a instituição para confirmar se a vaga ainda está reservada.
        </p>
      ) : (
        <>
          <p className={cn('font-display leading-none font-semibold text-terra-700 tabular', compact ? 'mt-1 text-4xl' : 'mt-2 text-5xl')}>
            {p.map((x, i) => (
              <span key={x.u} className={i > 0 ? 'ml-2' : undefined}>
                {x.v}
                <span className="ml-1 font-sans text-lg font-bold text-terra-800">{x.u}</span>
              </span>
            ))}
          </p>
          <Meter value={restante / PRAZO_PADRAO_MS} tone="terra" className="mt-3" label="Tempo restante para responder" />
        </>
      )}
      <p className="mt-2 text-sm text-ink-soft">até {textoPrazo}</p>
    </div>
  )
}

/**
 * Vaga proposta: o momento mais importante do percurso. Aceitar ou recusar (mantendo o lugar na lista),
 * sempre com confirmação e com a explicação do que acontece a seguir.
 */
export function VagaProposta({ c, lar, variant = 'banner' }: { c: Candidatura; lar: Lar; variant?: 'banner' | 'inline' }) {
  const [modal, setModal] = useState<'aceitar' | 'recusar' | null>(null)
  const titleId = useId()
  const quarto = quartoProposto(lar, c.perfil)
  const quem = comArtigo(c.perfil)
  const nome = nomeCurto(c.perfil.nome)
  const banner = variant === 'banner'
  const H = banner ? 'h2' : 'h3'
  const desde = c.historico.findLast((h) => h.estado === 'vaga_proposta')?.data ?? c.atualizadaEm

  const aceitar = () => {
    responderVaga(c.id, true)
    setModal(null)
    toast.success('Vaga aceite', `${lar.nome} já recebeu a sua resposta e vai contactá-lo(a) para combinar a entrada.`)
  }
  const recusar = () => {
    responderVaga(c.id, false)
    setModal(null)
    toast.info('Vaga recusada', `${nome} continua na lista de espera${c.posicao ? `, no ${ordinal(c.posicao)} lugar` : ''}.`)
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'relative overflow-hidden border-2 border-terra-300 bg-terra-50',
        banner ? 'animate-fade-up rounded-[2rem] shadow-card' : 'rounded-3xl',
      )}
    >
      <AzulejoBand color="#b9472f" size={44} className={cn('absolute inset-y-0 left-0 opacity-30', banner ? 'w-9 sm:w-14' : 'w-6')} />
      <div className={cn('relative grid gap-6', banner ? 'p-6 pl-14 sm:p-8 sm:pl-22 lg:grid-cols-[1fr_auto] lg:items-center' : 'p-5 pl-11 xl:grid-cols-[1fr_auto] xl:items-center')}>
        <div>
          <p className="flex flex-wrap items-center gap-x-2 text-sm font-bold tracking-[0.1em] text-terra-800 uppercase">
            <BellRing aria-hidden className="size-4" />
            Vaga proposta
            <span className="font-normal tracking-normal normal-case">· {tempoRelativo(desde)}</span>
          </p>
          <H id={titleId} className={cn('mt-2 font-display font-semibold text-ink', banner ? 'text-3xl sm:text-4xl' : 'text-2xl')}>
            {banner ? (
              <>
                Há uma vaga para {artigo(c.perfil)}
                <em>{nome}</em>.
              </>
            ) : (
              <>A instituição tem uma vaga para {quem}</>
            )}
          </H>
          <p className={cn('mt-2 text-ink-soft', banner && 'text-lg')}>
            {banner && (
              <>
                <Link to={`/lar/${lar.id}`} className="link">
                  {lar.nome}
                </Link>
                , {lar.localidade}.{' '}
              </>
            )}
            {quarto && (
              <strong className="text-ink">
                {QUARTO_LABEL[quarto.tipo]} · desde {euro(quarto.precoMin)}/mês.
              </strong>
            )}{' '}
            Se aceitar, a instituição contacta-o(a) para combinar a entrada. Se recusar,{' '}
            {c.posicao ? `${nome} mantém o ${ordinal(c.posicao)} lugar na lista.` : `${nome} continua na lista de espera.`}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="accent" size={banner ? 'lg' : 'md'} icon={<Check aria-hidden className="size-5" />} onClick={() => setModal('aceitar')}>
              Aceitar vaga
            </Button>
            <Button variant="secondary" size={banner ? 'lg' : 'md'} icon={<Undo2 aria-hidden className="size-5" />} onClick={() => setModal('recusar')}>
              Recusar e manter na lista
            </Button>
            {lar.telefone && (
              <a href={telHref(lar.telefone)} className="link inline-flex min-h-12 items-center gap-2 px-1">
                <Phone aria-hidden className="size-4.5" />
                Ligar antes de decidir
              </a>
            )}
          </div>
        </div>
        {c.prazoResposta && <Contagem prazo={c.prazoResposta} compact={!banner} />}
      </div>

      <ConfirmModal
        open={modal === 'aceitar'}
        onClose={() => setModal(null)}
        onConfirm={aceitar}
        title="Aceitar esta vaga?"
        description={`${lar.nome} · ${lar.localidade}`}
        confirmLabel="Sim, aceitar a vaga"
        confirmVariant="accent"
        confirmIcon={<Check aria-hidden className="size-5" />}
      >
        <ol className="flex flex-col gap-4">
          {[
            ['A instituição recebe a resposta de imediato', 'e liga-lhe para combinar o dia de entrada.'],
            [
              'Prepare a documentação habitual',
              'cartão de cidadão e de utente, relatório médico recente, lista da medicação e, se aplicável, comprovativos de rendimentos.',
            ],
            [
              'Os outros pedidos continuam ativos',
              `pode cancelá-los depois em “Pedidos”, para libertar o lugar a outras famílias.`,
            ],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4">
              <span aria-hidden className="font-display text-3xl leading-none font-semibold text-terra-600 tabular">
                {i + 1}
              </span>
              <p>
                <strong>{t}</strong> — {d}
              </p>
            </li>
          ))}
        </ol>
      </ConfirmModal>

      <ConfirmModal
        open={modal === 'recusar'}
        onClose={() => setModal(null)}
        onConfirm={recusar}
        title="Recusar esta vaga?"
        description={`${lar.nome} · ${lar.localidade}`}
        confirmLabel="Recusar e manter na lista"
        confirmVariant="primary"
        confirmIcon={<Undo2 aria-hidden className="size-5" />}
      >
        <p>
          A vaga passa para a família seguinte da lista.{' '}
          {c.posicao ? (
            <>
              <strong>{nome} mantém o {ordinal(c.posicao)} lugar</strong> e volta a ser {g(c.perfil, 'avisada', 'avisado')} quando houver
              nova vaga.
            </>
          ) : (
            <>
              <strong>
                {nome} continua {g(c.perfil, 'inscrita', 'inscrito')} na lista de espera
              </strong>{' '}
              e volta a ser {g(c.perfil, 'avisada', 'avisado')} quando houver nova vaga.
            </>
          )}
        </p>
        <p className="mt-3 text-ink-soft">
          Se a razão for o tipo de quarto ou o preço, diga-o à instituição — pode ajudar a propor a vaga certa da próxima vez.
        </p>
      </ConfirmModal>
    </section>
  )
}
