import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router'
import { Phone } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { responderVaga } from '@/lib/store'
import { euro, tempoRelativo } from '@/lib/format'
import { QUARTO_LABEL } from '@/lib/labels'
import { useMediaQuery } from '@/lib/hooks'
import { clamp, subscribeScroll } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { ConfirmModal } from './ui'
import { emLar, horaDe, quartoProposto } from './estado'
import { Roll, sairEDepois, useMountAnimation, useViewAnimations } from './motion'
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

/** [["47","h"],["12","min"]] · [["2","dias"],["3","h"]] · [["25","min"]] */
function restante(ms: number): [string, string][] {
  const min = Math.max(0, Math.floor(ms / 60_000))
  const h = Math.floor(min / 60)
  if (h >= 48) {
    const d = Math.floor(h / 24)
    return [
      [String(d), d === 1 ? 'dia' : 'dias'],
      [String(h % 24), 'h'],
    ]
  }
  if (h >= 1)
    return [
      [String(h), 'h'],
      [String(min % 60), 'min'],
    ]
  return [[String(min), 'min']]
}
const restanteTxt = (ms: number) => restante(ms).map((s) => s.join(' ')).join(' ')

/** Momento em que a vaga foi proposta (início da contagem). */
const desdeDe = (c: Candidatura) => c.historico.findLast((h) => h.estado === 'vaga_proposta')?.data ?? c.atualizadaEm

/**
 * Contagem decrescente: os algarismos rolam quando mudam (como um conta-quilómetros) e uma barra
 * fina esvazia-se continuamente até ao fim do prazo.
 */
function Contagem({ prazo, desde }: { prazo: string; desde: string }) {
  const now = useNow(1000)
  const fim = new Date(prazo).getTime()
  const ms = fim - now
  const total = fim - new Date(desde).getTime()
  const frac = clamp(ms / (total > 0 ? total : 48 * 3_600_000))
  const ate = `${diaPorExtenso(new Date(prazo)).replace('-', '‑')}, às ${horaDe(prazo)}`
  const barra = useViewAnimations<HTMLDivElement>((root) => {
    const fill = root.querySelector('[data-fill]')
    return fill ? [{ el: fill, keyframes: [{ transform: 'scaleX(0)' }], options: { duration: 1600, delay: 250 } }] : []
  })

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
      <p className="text-[2.5rem] leading-none font-semibold tracking-tight whitespace-nowrap text-white tabular sm:text-6xl">
        <span className="sr-only">{restanteTxt(ms)}</span>
        <span aria-hidden>
          {restante(ms).map(([v, u], i) => (
            <span key={u}>
              {i > 0 && ' '}
              <Roll value={v} /> {u}
            </span>
          ))}
        </span>
      </p>
      <div ref={barra} aria-hidden className="mt-5 h-1 max-w-sm overflow-hidden rounded-full bg-white/15">
        <div
          data-fill
          className="h-full origin-left rounded-full bg-white motion-safe:transition-transform motion-safe:duration-1000 motion-safe:ease-linear"
          style={{ transform: `scaleX(${frac})` }}
        />
      </div>
      <p className="mt-3 text-white/65">para responder · até {ate}</p>
    </div>
  )
}

/**
 * Barra de resposta ao alcance do polegar (telemóvel): aparece por cima da barra de abas enquanto os
 * botões do bloco ainda estão abaixo do ecrã, e recolhe-se quando eles aparecem.
 */
function BarraPolegar({
  alvo,
  lar,
  prazo,
  onAceitar,
  onRecusar,
}: {
  alvo: RefObject<HTMLElement | null>
  lar: Lar
  prazo?: string
  onAceitar: () => void
  onRecusar: () => void
}) {
  const [visivel, setVisivel] = useState(false)
  const now = useNow(30_000)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(
    () =>
      subscribeScroll(() => {
        const el = alvo.current
        if (!el) return
        const tabbar = document.querySelector('nav[aria-label="Navegação principal"]')
        const limite = tabbar ? tabbar.getBoundingClientRect().top : window.innerHeight
        // botões do bloco ainda por baixo da barra de abas → mostrar o atalho
        setVisivel(el.getBoundingClientRect().top > limite - 24)
      }),
    [alvo],
  )
  useMountAnimation(ref, [{ transform: 'translateY(140%)' }, { transform: 'none' }], { duration: 650, delay: 500 })

  const ms = prazo ? new Date(prazo).getTime() - now : 0
  return createPortal(
    <div
      ref={ref}
      inert={!visivel}
      className="fixed inset-x-3 bottom-[calc(var(--tabbar-h)+0.75rem)] z-[950] lg:hidden"
    >
      <div
        className={cn(
          'mx-auto max-w-lg rounded-[1.5rem] bg-white/90 p-3 shadow-lift ring-1 ring-black/[0.06] backdrop-blur-xl backdrop-saturate-150',
          'transition-[translate,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)]',
          visivel ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-[calc(100%+var(--tabbar-h)+1rem)] opacity-0',
        )}
      >
        <p className="flex items-center gap-2 px-2 pt-0.5 text-sm leading-snug">
          <span aria-hidden className="size-2 shrink-0 rounded-full bg-terra-600" />
          <span className="min-w-0 truncate font-semibold">
            Vaga proposta<span className="sr-only"> {emLar(lar.nome)}</span>
          </span>
          {ms > 0 && <span className="ml-auto shrink-0 text-ink-mute tabular">faltam {restanteTxt(ms)}</span>}
        </p>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <Button onClick={onAceitar}>Aceitar vaga</Button>
          <Button variant="subtle" onClick={onRecusar}>
            Recusar
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Vaga proposta — o momento mais importante do percurso. Bloco preto, uma decisão:
 * aceitar ou recusar mantendo o lugar na lista. Ambas pedem confirmação.
 * thumbBar: no telemóvel, mostra também a barra de resposta ao alcance do polegar.
 */
export function VagaProposta({ c, lar, variant = 'tile', thumbBar = false }: { c: Candidatura; lar: Lar; variant?: 'tile' | 'inline'; thumbBar?: boolean }) {
  const [modal, setModal] = useState<'aceitar' | 'recusar' | null>(null)
  const titleId = useId()
  const root = useRef<HTMLElement>(null)
  const acoes = useRef<HTMLDivElement>(null)
  const mobile = useMediaQuery('(max-width: 1023.98px)')
  const quarto = quartoProposto(lar, c.perfil)
  const nome = nomeCurto(c.perfil.nome)
  const tile = variant === 'tile'
  const H = tile ? 'h2' : 'h3'
  const desde = desdeDe(c)

  // o bloco "sai" (encolhe e desvanece) antes de o pedido mudar de estado
  const aceitar = () => {
    setModal(null)
    sairEDepois(root.current, () => {
      responderVaga(c.id, true)
      toast.success('Vaga aceite', `${lar.nome} vai entrar em contacto consigo para combinar a entrada.`)
    })
  }
  const recusar = () => {
    setModal(null)
    sairEDepois(root.current, () => {
      responderVaga(c.id, false)
      toast.info('Vaga recusada', `${nome} continua na lista de espera${c.posicao ? `, em ${ordinal(c.posicao)} lugar` : ''}.`)
    })
  }

  return (
    <section
      ref={root}
      aria-labelledby={titleId}
      className={cn('on-dark rounded-[1.75rem] bg-pine-950 text-white', tile ? 'p-6 sm:p-10 lg:p-12' : 'p-6 sm:p-8')}
    >
      <p className="flex items-center gap-2 text-sm font-medium text-white/65">
        <span aria-hidden className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-terra-400 opacity-70 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-terra-400" />
        </span>
        Vaga proposta · {tempoRelativo(desde)}
      </p>
      <H
        id={titleId}
        className={cn('mt-4 max-w-3xl font-semibold text-white', tile ? 'text-[2rem] leading-[1.1] sm:text-4xl lg:text-5xl' : 'text-2xl sm:text-3xl')}
      >
        Há uma vaga para {artigo(c.perfil)}
        <em>{nome}</em> {emLar(lar.nome)}.
      </H>
      {quarto && (
        <p className="mt-3 text-lg text-white/70">
          {QUARTO_LABEL[quarto.tipo]} · desde {euro(quarto.precoMin)}/mês · {lar.localidade}
        </p>
      )}

      <div className={tile ? 'mt-9 sm:mt-10' : 'mt-8'}>
        {c.prazoResposta ? (
          <Contagem prazo={c.prazoResposta} desde={desde} />
        ) : (
          <p className="text-white/70">Responda à instituição o mais depressa possível.</p>
        )}
      </div>
      <div ref={acoes} className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button variant="inverse" size={tile ? 'lg' : 'md'} className="w-full sm:w-auto" onClick={() => setModal('aceitar')}>
          Aceitar vaga
        </Button>
        <Button variant="glass" size={tile ? 'lg' : 'md'} className="w-full sm:w-auto" onClick={() => setModal('recusar')}>
          Recusar e manter na lista
        </Button>
      </div>

      <p className="mt-4 flex flex-wrap gap-x-6 text-white/65">
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

      {thumbBar && mobile && (
        <BarraPolegar alvo={acoes} lar={lar} prazo={c.prazoResposta} onAceitar={() => setModal('aceitar')} onRecusar={() => setModal('recusar')} />
      )}

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
