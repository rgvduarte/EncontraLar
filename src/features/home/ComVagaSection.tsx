import { useCallback, useEffect, useMemo, useState, type FocusEvent } from 'react'
import { Link } from 'react-router'
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import type { Lar } from '@/types'
import { LarCard } from '@/components/lar/LarCard'
import { HorizontalScroll } from '@/components/motion/HorizontalScroll'
import { useLenis } from '@/components/motion/SmoothScroll'
import { ButtonLink } from '@/components/ui/Button'
import { ACESSO_CTA, ACESSO_DESDE, ACESSO_PARA_LARES, useVoltarAtual } from '@/components/acesso'
import { linkAcesso } from '@/lib/acesso'
import { useCurrentUser } from '@/lib/store'
import { usePrefersReducedMotion } from '@/lib/motion'
import { useMediaQuery } from '@/lib/hooks'
import { num } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Reveal } from './Entrada'
import { comVagaAgora, contarComVaga } from './homeData'

/**
 * Quantos cartões na faixa. No desktop a faixa é guiada pelo scroll (secção presa): 7 cartões + o cartão final
 * dão ~1,7 ecrãs de scroll a mais — juntando a cena "Como funciona", a página fica abaixo de 4 ecrãs de fixação.
 */
const CARTOES = 7

const item = 'flex w-[min(20rem,80vw)] shrink-0 snap-start sm:w-[21rem]'

/** Margem esquerda da faixa no ecrã largo = margem do container-page (o 1.º cartão alinha com o título). */
const ALINHAR = 'lg:pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))] lg:scroll-pl-[max(2.5rem,calc((100vw-80rem)/2+2.5rem))]'

const seta =
  'flex size-12 items-center justify-center rounded-full bg-sand text-ink transition-colors duration-200 hover:bg-sand-deep disabled:cursor-default disabled:text-ink-mute/40 disabled:hover:bg-sand'

/**
 * Setas para a faixa quando ela NÃO está presa num ecrã largo (movimento reduzido): com rato e sem trackpad
 * não há outra forma cómoda de a deslizar. A faixa é encontrada a partir do 1.º cartão (vive dentro do
 * HorizontalScroll partilhado).
 */
function useSetas(ativo: boolean) {
  const [faixa, setFaixa] = useState<HTMLElement | null>(null)
  const [pos, setPos] = useState({ inicio: true, fim: false })
  const primeiro = useCallback((el: HTMLDivElement | null) => setFaixa(el?.parentElement ?? null), [])
  useEffect(() => {
    if (!ativo || !faixa) return
    const medir = () =>
      setPos({ inicio: faixa.scrollLeft <= 4, fim: faixa.scrollLeft + faixa.clientWidth >= faixa.scrollWidth - 4 })
    medir()
    faixa.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      faixa.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [ativo, faixa])
  const mover = (dir: 1 | -1) => {
    const cartao = faixa?.firstElementChild
    if (!faixa || !cartao) return
    const passo = cartao.getBoundingClientRect().width + 20
    faixa.scrollBy({ left: dir * passo * Math.max(1, Math.floor(faixa.clientWidth / passo) - 1), behavior: 'auto' })
  }
  return { primeiro, pos, mover }
}

/**
 * Desfecho: "Com vaga agora". Com Acesso Família (ou para profissionais), a galeria das instituições com vaga;
 * na versão grátis, quantas são e o convite para saber quais (nenhuma instituição nomeada).
 */
export function ComVagaSection({ lares, completo }: { lares: Lar[]; completo: boolean }) {
  return completo ? <ComVagaGaleria lares={lares} /> : <ComVagaFechada lares={lares} />
}

/** Larguras das "linhas" dos cartões fechados (fixas: o mesmo desenho em cada visita). */
const BARRAS = [
  ['w-[72%]', 'w-[46%]'],
  ['w-[58%]', 'w-[40%]'],
  ['w-[66%]', 'w-[52%]'],
  ['w-[50%]', 'w-[36%]'],
] as const

/**
 * Versão grátis: o número de lares e residências com vaga agora (o "quantas"), cartões fechados com a forma de
 * um cartão mas sem nenhum dado, e o convite para o Acesso Família. Explorar o mapa continua a ser grátis.
 */
function ComVagaFechada({ lares }: { lares: Lar[] }) {
  const n = useMemo(() => contarComVaga(lares), [lares])
  const voltar = useVoltarAtual()
  // instituições veem a versão grátis, mas o convite não é para elas (como no BloqueioCartao)
  const instituicao = useCurrentUser()?.role === 'lar'
  return (
    <section aria-labelledby="com-vaga-titulo" className="pt-20 pb-12 sm:pt-28 sm:pb-16">
      <div className="container-page">
        <Reveal variant="blur" className="max-w-3xl">
          <h2 id="com-vaga-titulo" className="headline">
            {n > 0 ? (
              <>
                {num(n)} {n === 1 ? 'lar ou residência' : 'lares e residências'} <em>com vaga agora.</em>
              </>
            ) : (
              'Neste momento não há lugares livres.'
            )}
          </h2>
          <p className="mt-4 text-xl text-ink-mute sm:text-2xl">
            {n > 0
              ? `Explorar é grátis. Para saber quais têm vaga, quantos lugares e a que preço, há o Acesso Família — ${ACESSO_DESDE}.`
              : `As vagas abrem todas as semanas. Para ver onde se prevê a próxima e receber um alerta, há o Acesso Família — ${ACESSO_DESDE}.`}
          </p>
        </Reveal>

        {n > 0 && (
          // só formas, sem dados: decorativo (o título e a frase dizem o que está fechado)
          <div aria-hidden className="mt-10 flex gap-4 overflow-hidden sm:mt-14 sm:gap-5 [mask-image:linear-gradient(to_right,#000_45%,transparent)]">
            {BARRAS.map(([a, b], i) => (
              <Reveal key={i} delay={Math.min(i, 3) * 90} duration={900} className={cn(item, 'flex-col')}>
                <span className="relative flex aspect-[4/3] items-center justify-center rounded-[1.375rem] bg-sand">
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-sm font-medium text-ink">
                    <span className="size-2 rounded-full bg-leaf-500" />
                    Com vaga
                  </span>
                  <Lock className="size-6 text-ink-mute/50" />
                </span>
                <span className="flex flex-col gap-2.5 px-1 pt-4">
                  <span className={cn('h-4 rounded-full bg-ink/[0.08]', a)} />
                  <span className={cn('h-3 rounded-full bg-ink/[0.05]', b)} />
                  <span className="mt-4 h-4 w-[30%] rounded-full bg-ink/[0.07]" />
                </span>
              </Reveal>
            ))}
          </div>
        )}

        <Reveal delay={160} className="mt-10 flex flex-col items-start gap-x-6 gap-y-2 sm:mt-12 sm:flex-row sm:items-center">
          {instituicao ? (
            <p className="text-lg text-ink-mute">{ACESSO_PARA_LARES}</p>
          ) : (
            <ButtonLink to={linkAcesso(voltar)} size="lg" className="w-full sm:w-auto">
              {ACESSO_CTA}
            </ButtonLink>
          )}
          <Link to="/pesquisa" className="link inline-flex min-h-12 items-center gap-0.5 text-lg max-sm:self-center">
            Explorar o mapa
            <ChevronRight aria-hidden className="size-4.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * "Com vaga agora" — galeria horizontal de cartões reais.
 * Desktop: a secção fica presa e o scroll vertical faz deslizar a faixa (sem sequestrar: a roda continua a descer
 * a página). Telemóvel e movimento reduzido: faixa deslizável com o dedo, com snap.
 */
function ComVagaGaleria({ lares }: { lares: Lar[] }) {
  const todas = useMemo(() => comVagaAgora(lares, Infinity), [lares])
  const lista = todas.slice(0, CARTOES)
  const lenis = useLenis()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const reduzido = usePrefersReducedMotion()
  const presa = desktop && !reduzido
  const setas = useSetas(desktop && reduzido)

  /**
   * Com a faixa presa, um cartão fora do ecrã que recebe foco (Tab) não deve "saltar" a faixa: repõe o scroll
   * interno e leva a página ao ponto em que esse cartão está à vista.
   */
  const seguirFoco = useCallback(
    (e: FocusEvent<HTMLDivElement>) => {
      const cartao = e.currentTarget
      // depois do scroll automático do próprio navegador ao focar (que mexeria no contentor fixo)
      requestAnimationFrame(() => {
        const faixa = cartao.parentElement
        const fixo = faixa?.parentElement
        const seccao = fixo?.parentElement
        if (!faixa || !fixo || !seccao) return
        fixo.scrollLeft = 0
        const dist = Math.max(0, faixa.scrollWidth - window.innerWidth + 80)
        const centro = cartao.offsetLeft + cartao.offsetWidth / 2 - window.innerWidth / 2
        const p = dist ? Math.min(1, Math.max(0, centro / dist)) : 0
        const topo = seccao.getBoundingClientRect().top + window.scrollY - 64
        const alvo = Math.round(topo + p * (seccao.offsetHeight - (window.innerHeight - 64)))
        if (Math.abs(alvo - window.scrollY) < 4) return
        if (lenis) lenis.scrollTo(alvo, { immediate: true, force: true })
        else window.scrollTo({ top: alvo })
      })
    },
    [lenis],
  )

  const cabecalho = (
    <div className={cn('container-page flex items-end justify-between gap-6', presa ? 'mb-10 xl:mb-12' : 'mb-8 sm:mb-10')}>
      <Reveal variant="blur">
        <h2 id="com-vaga-titulo" className="headline">
          Com vaga agora.
        </h2>
        <p className="mt-4 text-xl text-ink-mute sm:text-2xl">Lugares livres hoje, confirmados pelas instituições.</p>
        <Link to="/pesquisa?vaga=agora" className="link mt-2 inline-flex min-h-12 items-center gap-0.5 text-lg">
          Ver todas no mapa
          <ChevronRight aria-hidden className="size-4.5" />
        </Link>
      </Reveal>
      {desktop && reduzido && lista.length > 1 && (
        <div className="flex shrink-0 gap-3">
          <button type="button" onClick={() => setas.mover(-1)} disabled={setas.pos.inicio} className={seta} aria-label="Instituições anteriores">
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <button type="button" onClick={() => setas.mover(1)} disabled={setas.pos.fim} className={seta} aria-label="Mais instituições com vaga">
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
      )}
    </div>
  )

  if (lista.length === 0) {
    return (
      <section aria-labelledby="com-vaga-titulo" className="py-20 sm:py-28">
        {cabecalho}
        <div className="container-page">
          <Reveal className="rounded-[1.75rem] bg-sand px-8 py-14 text-center">
            <p className="text-xl text-ink">Neste momento não há lugares livres.</p>
            <p className="mt-2 text-ink-mute">As vagas abrem todas as semanas. Veja onde se prevê a próxima.</p>
            <Link to="/pesquisa?vaga=breve" className="link mt-3 inline-flex min-h-12 items-center gap-0.5 text-lg">
              Vagas previstas em breve
              <ChevronRight aria-hidden className="size-4.5" />
            </Link>
          </Reveal>
        </div>
      </section>
    )
  }

  return (
    <HorizontalScroll
      label="Com vaga agora"
      header={cabecalho}
      className={presa ? undefined : 'py-20 sm:py-28'}
      // a faixa começa alinhada com o texto (container-page) e, no telemóvel, encaixa cartão a cartão
      trackClassName={cn('scroll-px-5 sm:scroll-px-8', ALINHAR, presa ? 'pb-2' : 'gap-4 sm:gap-5')}
    >
      {lista.map((l, i) => (
        <div key={l.id} ref={i === 0 ? setas.primeiro : undefined} className={item} onFocus={presa ? seguirFoco : undefined}>
          {/* os cartões entram (sobem e aparecem) à medida que chegam ao ecrã — também os que deslizam da direita */}
          <Reveal delay={Math.min(i, 3) * 90} duration={900} className="flex w-full">
            <LarCard lar={l} className="w-full" />
          </Reveal>
        </div>
      ))}
      <div className={item} onFocus={presa ? seguirFoco : undefined}>
        <Link
          to="/pesquisa?vaga=agora"
          className="group flex w-full flex-col justify-between gap-10 rounded-[1.75rem] bg-sand p-8 transition-colors duration-300 hover:bg-sand-deep"
        >
          <span className="text-3xl leading-tight font-semibold tracking-[-0.025em] text-ink">
            {todas.length > lista.length ? (
              <>
                Mais {num(todas.length - lista.length)} {todas.length - lista.length === 1 ? 'lar ou residência' : 'lares e residências'} com vaga hoje.
              </>
            ) : (
              <>Veja-as no mapa, perto de quem precisa.</>
            )}
          </span>
          <span className="inline-flex min-h-12 items-center gap-1 text-lg font-medium text-terra-700">
            Ver todas no mapa
            <ChevronRight aria-hidden className="size-5 transition-transform duration-300 group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </HorizontalScroll>
  )
}
