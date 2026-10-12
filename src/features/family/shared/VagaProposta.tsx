import { useEffect, useId, useState } from 'react'
import { Link } from 'react-router'
import { Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { toast } from '@/components/ui/Toast'
import { responderVaga } from '@/lib/store'
import { euro, tempoRelativo } from '@/lib/format'
import { QUARTO_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { ConfirmModal, pillGlass, pillWhite } from './ui'
import { emLar, horaDe, quartoProposto } from './estado'
import { artigo, diaPorExtenso, g, nomeCurto, ordinal, telHref } from './text'

/** Hora atual que se atualiza sozinha (para contagens decrescentes). */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(t)
  }, [ms])
  return now
}

/** "47 h 12 min", "2 dias 3 h", "25 min" */
function restante(ms: number): string {
  const min = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(min / 60)
  if (h >= 48) {
    const d = Math.floor(h / 24)
    return `${d} ${d === 1 ? 'dia' : 'dias'} ${h % 24} h`
  }
  if (h >= 1) return `${h} h ${min % 60} min`
  return `${min} min`
}

function Contagem({ prazo }: { prazo: string }) {
  const now = useNow()
  const ms = new Date(prazo).getTime() - now
  const ate = `${diaPorExtenso(new Date(prazo))}, às ${horaDe(prazo)}`
  if (ms <= 0) {
    return (
      <div>
        <p className="text-2xl font-semibold text-white">O prazo terminou</p>
        <p className="mt-1 text-white/65">Ligue para confirmar se a vaga ainda está reservada.</p>
      </div>
    )
  }
  return (
    <div>
      <p className="text-5xl leading-none font-semibold tracking-tight text-white tabular sm:text-6xl">{restante(ms)}</p>
      <p className="mt-3 text-white/65">
        para responder · até {ate}
      </p>
    </div>
  )
}

/**
 * Vaga proposta — o momento mais importante do percurso. Bloco preto, uma decisão:
 * aceitar ou recusar mantendo o lugar na lista. Ambas pedem confirmação.
 */
export function VagaProposta({ c, lar, variant = 'tile' }: { c: Candidatura; lar: Lar; variant?: 'tile' | 'inline' }) {
  const [modal, setModal] = useState<'aceitar' | 'recusar' | null>(null)
  const titleId = useId()
  const quarto = quartoProposto(lar, c.perfil)
  const nome = nomeCurto(c.perfil.nome)
  const tile = variant === 'tile'
  const H = tile ? 'h2' : 'h3'
  const desde = c.historico.findLast((h) => h.estado === 'vaga_proposta')?.data ?? c.atualizadaEm

  const aceitar = () => {
    setModal(null)
    responderVaga(c.id, true)
    toast.success('Vaga aceite', `${lar.nome} vai contactá-lo(a) para combinar a entrada.`)
  }
  const recusar = () => {
    setModal(null)
    responderVaga(c.id, false)
    toast.info('Vaga recusada', `${nome} continua na lista de espera${c.posicao ? `, em ${ordinal(c.posicao)} lugar` : ''}.`)
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn('on-dark rounded-[1.75rem] bg-pine-950 text-white', tile ? 'p-7 sm:p-10 lg:p-12' : 'p-6 sm:p-8')}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-white/65">
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-terra-400 opacity-70 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-terra-400" />
        </span>
        Vaga proposta · {tempoRelativo(desde)}
      </p>
      <H id={titleId} className={cn('mt-4 max-w-3xl font-semibold text-white', tile ? 'text-3xl sm:text-4xl lg:text-5xl' : 'text-2xl sm:text-3xl')}>
        Há uma vaga para {artigo(c.perfil)}
        <em>{nome}</em> {emLar(lar.nome)}.
      </H>
      {quarto && (
        <p className="mt-3 text-lg text-white/70">
          {QUARTO_LABEL[quarto.tipo]} · desde {euro(quarto.precoMin)}/mês · {lar.localidade}
        </p>
      )}

      <div className={cn('grid gap-8', tile ? 'mt-10 lg:grid-cols-[1fr_auto] lg:items-end' : 'mt-8')}>
        {c.prazoResposta ? <Contagem prazo={c.prazoResposta} /> : <p className="text-white/70">Responda à instituição o mais depressa possível.</p>}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="button" className={pillWhite(tile ? 'lg' : 'md')} onClick={() => setModal('aceitar')}>
            Aceitar vaga
          </button>
          <button type="button" className={pillGlass(tile ? 'lg' : 'md')} onClick={() => setModal('recusar')}>
            Recusar e manter na lista
          </button>
        </div>
      </div>

      <p className="mt-8 flex flex-wrap gap-x-6 text-white/65">
        {lar.telefone && (
          <a href={telHref(lar.telefone)} className="inline-flex min-h-12 items-center gap-2 font-medium text-terra-300 hover:underline">
            <Phone aria-hidden className="size-4" />
            Ligar antes de decidir
          </a>
        )}
        {tile && (
          <Link to={`/lar/${lar.id}`} className="inline-flex min-h-12 items-center font-medium text-terra-300 hover:underline">
            Ver a ficha da instituição
          </Link>
        )}
      </p>

      <ConfirmModal
        open={modal === 'aceitar'}
        onClose={() => setModal(null)}
        onConfirm={aceitar}
        title="Aceitar esta vaga?"
        description={lar.nome}
        confirmLabel="Aceitar vaga"
        cancelLabel="Ainda não"
      >
        <p>A instituição recebe já a sua resposta e liga-lhe para combinar o dia de entrada.</p>
        <p className="mt-3">Os outros pedidos continuam ativos. Pode cancelá-los depois, em “Pedidos”.</p>
      </ConfirmModal>

      <ConfirmModal
        open={modal === 'recusar'}
        onClose={() => setModal(null)}
        onConfirm={recusar}
        title="Recusar esta vaga?"
        description={lar.nome}
        confirmLabel="Recusar e manter na lista"
        cancelLabel="Voltar"
      >
        <p>
          A vaga passa para a família seguinte.{' '}
          {c.posicao
            ? `${nome} mantém o ${ordinal(c.posicao)} lugar na lista e volta a ser ${g(c.perfil, 'avisada', 'avisado')} quando houver nova vaga.`
            : `${nome} continua na lista de espera e volta a ser ${g(c.perfil, 'avisada', 'avisado')} quando houver nova vaga.`}
        </p>
      </ConfirmModal>
    </section>
  )
}
