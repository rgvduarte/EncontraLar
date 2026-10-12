import { memo, useCallback, useMemo, useRef, type ReactNode } from 'react'
import type { Lar } from '@/types'
import { StickyScene } from '@/components/motion/StickyScene'
import { Reveal } from './Entrada'
import { useLenis } from '@/components/motion/SmoothScroll'
import { estimarEspera } from '@/lib/forecast'
import { useInView, usePrefersReducedMotion } from '@/lib/motion'
import { useMediaQuery } from '@/lib/hooks'
import { cn } from '@/lib/cn'
import { ECRAS, Telefone, type Historia } from './ComoFuncionaEcras'
import { comVagaAgora, escolherPrevisao } from './homeData'

const PASSOS = [
  {
    curto: 'Procurar',
    titulo: 'Procure no mapa.',
    texto: 'Escreva a localidade e veja logo onde há vaga agora, onde abre em breve e onde há lista de espera.',
  },
  {
    curto: 'Comparar',
    titulo: 'Compare com transparência.',
    texto: 'O preço de cada quarto, a previsão de vaga mês a mês e o selo de verificação, antes de telefonar.',
  },
  {
    curto: 'Pedir vaga',
    titulo: 'Peça vaga e receba alertas.',
    texto: 'Envie o pedido com o perfil da pessoa. Avisamos no momento em que abrir um lugar.',
  },
] as const

/** Passo ativo para um progresso 0–1 da cena (três terços iguais). */
const passoDe = (p: number) => (p < 1 / 3 ? 0 : p < 2 / 3 ? 1 : 2)

function Cabecalho({ className }: { className?: string }) {
  return (
    <div className={className}>
      <p className="eyebrow">Como funciona</p>
      <h2 id="como-titulo" className="headline mt-3">
        Da pesquisa
        <br />à vaga.
      </h2>
    </div>
  )
}

/**
 * Percurso: "Como funciona" em três passos, sempre com o mesmo lar real (sem vaga hoje, com vaga prevista),
 * para contar uma história: encontrá-lo no mapa → comparar → pedir vaga e ser avisado quando abre.
 * - Desktop: cena presa (280vh ≈ 1,9 ecrãs de scroll a mais); os passos acendem-se um a um e o ecrã do telemóvel muda.
 * - Telemóvel/tablet e movimento reduzido: passos empilhados, cada um com o seu ecrã a entrar ao aparecer.
 */
export function ComoFunciona({ lares, agora }: { lares: Lar[]; agora: number }) {
  const historia = useMemo<Historia | null>(() => {
    const prev = escolherPrevisao(lares)
    if (prev) return { lar: prev.lar, est: prev.est, lares, agora }
    const l = comVagaAgora(lares, 1)[0]
    return l ? { lar: l, est: estimarEspera(l), lares, agora } : null
  }, [lares, agora])
  const desktop = useMediaQuery('(min-width: 1024px)')
  const reduzido = usePrefersReducedMotion()
  if (!historia) return null
  return desktop && !reduzido ? <CenaFixa h={historia} /> : <Empilhado h={historia} />
}

// ————————————————————————————————————————— desktop: cena presa

function CenaFixa({ h }: { h: Historia }) {
  const wrap = useRef<HTMLDivElement>(null)
  const lenis = useLenis()

  /** Os botões de passo levam o scroll ao meio do troço desse passo (sem saltos bruscos). */
  const irPara = useCallback(
    (i: number) => {
      const el = wrap.current
      if (!el) return
      const topo = el.getBoundingClientRect().top + window.scrollY - 64
      const percurso = el.offsetHeight - (window.innerHeight - 64)
      const alvo = topo + percurso * ((i + 0.5) / 3)
      if (lenis) lenis.scrollTo(alvo, { duration: 1.2 })
      else window.scrollTo({ top: alvo, behavior: 'smooth' })
    },
    [lenis],
  )

  return (
    <div ref={wrap}>
      <StickyScene length="280vh" label="Como funciona" className="bg-sand" innerClassName="flex items-center">
        {(p) => <Palco ativo={passoDe(p)} h={h} irPara={irPara} />}
      </StickyScene>
    </div>
  )
}

/** Conteúdo fixo da cena. Só volta a desenhar quando o passo muda; as barras de progresso usam a variável --p. */
const Palco = memo(function Palco({ ativo, h, irPara }: { ativo: number; h: Historia; irPara: (i: number) => void }) {
  return (
    <div className="container-page grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-16 xl:gap-28">
      <div>
        <Reveal>
          <Cabecalho />
        </Reveal>

        {/* os três textos ocupam o mesmo sítio e trocam (todos ficam no DOM para o leitor de ecrã) */}
        <Reveal delay={120} className="mt-12 grid xl:mt-16">
          {PASSOS.map((s, i) => (
            <div
              key={s.curto}
              className={cn(
                'transition-[opacity,translate] duration-700 ease-[cubic-bezier(.16,1,.3,1)] [grid-area:1/1]',
                i === ativo ? 'translate-y-0 opacity-100' : i < ativo ? '-translate-y-5 opacity-0' : 'translate-y-5 opacity-0',
              )}
            >
              <p className="text-sm font-semibold text-ink-mute tabular">Passo {i + 1} de 3</p>
              <h3 className="mt-2 text-3xl font-semibold text-ink xl:text-4xl">{s.titulo}</h3>
              <p className="mt-4 max-w-md text-xl text-ink-mute">{s.texto}</p>
            </div>
          ))}
        </Reveal>

        {/* indicador de progresso: uma barra por passo, cheia com o scroll; clicar leva a esse passo */}
        <Reveal delay={200} className="mt-12">
          <ol aria-label="Passos" className="grid max-w-md grid-cols-3 gap-3">
          {PASSOS.map((s, i) => (
            <li key={s.curto}>
              <button
                type="button"
                onClick={() => irPara(i)}
                aria-current={i === ativo ? 'step' : undefined}
                className="group flex min-h-12 w-full flex-col justify-center gap-3 rounded-lg text-left"
              >
                <span aria-hidden className="block h-1 overflow-hidden rounded-full bg-black/10">
                  <span
                    className="block h-full origin-left rounded-full bg-ink"
                    style={{ transform: `scaleX(clamp(0, calc(var(--p, 0) * 3 - ${i}), 1))` }}
                  />
                </span>
                <span className={cn('text-sm font-medium transition-colors', i === ativo ? 'text-ink' : 'text-ink-mute group-hover:text-ink')}>
                  <span className="sr-only">Passo {i + 1}: </span>
                  {s.curto}
                </span>
              </button>
            </li>
          ))}
          </ol>
        </Reveal>
      </div>

      <Reveal variant="scale" duration={900} className="flex justify-center">
        <Telefone className="h-[min(40rem,calc(100dvh-9rem))]">
          {ECRAS.map((Ecra, i) => (
            <Camada key={i} estado={i === ativo ? 0 : i < ativo ? -1 : 1}>
              <Ecra h={h} ativo={i === ativo} />
            </Camada>
          ))}
        </Telefone>
      </Reveal>
    </div>
  )
})

/** Um ecrã do telemóvel: o atual está visível; o anterior sai a encolher, o seguinte espera ligeiramente maior. */
function Camada({ estado, children }: { estado: -1 | 0 | 1; children: ReactNode }) {
  return (
    <div
      className="absolute inset-0 transition-[opacity,transform] duration-[800ms] ease-[cubic-bezier(.16,1,.3,1)]"
      style={{ opacity: estado === 0 ? 1 : 0, transform: estado === 0 ? 'none' : `scale(${estado < 0 ? 0.94 : 1.05})` }}
    >
      {children}
    </div>
  )
}

// ————————————————————————————————————————— telemóvel / movimento reduzido: empilhado

function Empilhado({ h }: { h: Historia }) {
  return (
    <section aria-labelledby="como-titulo" className="bg-sand py-20 sm:py-28">
      <div className="container-page">
        <Reveal>
          <Cabecalho className="text-center md:text-left" />
        </Reveal>
        <ol className="mt-12 flex flex-col gap-20 sm:mt-16 md:gap-28">
          {PASSOS.map((s, i) => (
            <PassoEmpilhado key={s.curto} i={i} h={h} />
          ))}
        </ol>
      </div>
    </section>
  )
}

function PassoEmpilhado({ i, h }: { i: number; h: Historia }) {
  // o ecrã "acontece" (peças a entrar, notificação a descer) quando o telemóvel está bem à vista
  const [ref, visto] = useInView<HTMLDivElement>({ threshold: 0.45 })
  const s = PASSOS[i]!
  const Ecra = ECRAS[i]!
  return (
    <li className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
      <Reveal className="text-center md:text-left">
        <p className="text-sm font-semibold text-ink-mute tabular">Passo {i + 1} de 3</p>
        <h3 className="mt-1.5 text-2xl font-semibold text-ink sm:text-3xl">{s.titulo}</h3>
        <p className="mx-auto mt-2 max-w-md text-lg text-ink-mute md:mx-0">{s.texto}</p>
      </Reveal>
      <div ref={ref} className="flex justify-center">
        <Reveal variant="scale" duration={900}>
          <Telefone className="h-[35rem] sm:h-[38rem]">
            <Ecra h={h} ativo={visto} />
          </Telefone>
        </Reveal>
      </div>
    </li>
  )
}
