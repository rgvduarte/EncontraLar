import { useEffect, useLayoutEffect, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react'
import type { Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { useLenis } from '@/components/motion'
import { useMediaQuery } from '@/lib/hooks'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { primeiroIncompleto, TOTAL_PASSOS, validarPasso, type Erros } from '../model'
import { pessoa } from '../language'
import type { AcoesSessao, Sessao } from '../useMatchSession'
import { abanar, abreTeclado, EASE_IN, EASE_OUT, mostrarCampo, scrollAte, scrollPara, useKeyboardInset } from '../motion'
import { ledePasso, tituloPasso } from './copy'
import { NotaFinal } from '../NotaFinal'
import { StepPessoa } from '../steps/StepPessoa'
import { StepAutonomia } from '../steps/StepAutonomia'
import { StepSaude } from '../steps/StepSaude'
import { StepLocal } from '../steps/StepLocal'
import { StepOrcamento } from '../steps/StepOrcamento'
import { StepQuando } from '../steps/StepQuando'

/** Distância (px) que a pergunta percorre ao sair / ao entrar. */
const SAIDA_PX = 48
const ENTRADA_PX = 72

/**
 * Uma pergunta por ecrã, ao estilo do assistente de configuração do iOS:
 * barra de progresso fina no topo, pergunta enorme e centrada. Ao avançar, a pergunta sai para a esquerda
 * e a seguinte entra pela direita (ao contrário em "Voltar"); o foco passa para a nova pergunta no fim.
 * Telemóvel/tablet: Voltar / Continuar numa barra presa ao fundo (zona do polegar), que sobe com o teclado.
 */
export function Wizard({
  sessao,
  acoes,
  lares,
  entrada = 1,
}: {
  sessao: Sessao
  acoes: AcoesSessao
  lares: Lar[]
  /** de onde vem: 1 = início (entra pela direita), -1 = resultados (entra pela esquerda) */
  entrada?: 1 | -1
}) {
  const { passo, r } = sessao
  const lenis = useLenis()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const teclado = useKeyboardInset()
  const tecladoAberto = !desktop && teclado > 0

  // passo desenhado no ecrã: fica no anterior enquanto a pergunta sai
  const [visto, setVisto] = useState(passo)
  const direcao = useRef<1 | -1>(entrada)
  /** quando a pergunta desenhada mudou pela última vez (protege de toques duplos, também sem animação) */
  const trocaEm = useRef(0)
  const emTransicao = visto !== passo
  const bloqueado = () => emTransicao || performance.now() - trocaEm.current < 350

  const headerRef = useRef<HTMLElement>(null)
  const corpoRef = useRef<HTMLDivElement>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const focado = useRef<HTMLElement | null>(null)

  const p = pessoa(r)
  const [tentou, setTentou] = useState<number | null>(null)
  const erros: Erros = tentou === visto ? validarPasso(visto, r) : {}
  const ultimo = visto === TOTAL_PASSOS - 1
  // a editar a partir dos resultados: tudo respondido → atalho para voltar às sugestões
  const completo = primeiroIncompleto(r) === -1

  // 1) saída: a pergunta atual desliza para trás e desvanece; no fim troca-se o passo desenhado
  useEffect(() => {
    if (passo === visto) return
    direcao.current = passo > visto ? 1 : -1
    const els = [headerRef.current, corpoRef.current].filter((x): x is HTMLElement => Boolean(x?.animate))
    if (prefersReducedMotion() || els.length === 0) {
      setVisto(passo)
      return
    }
    let vivo = true
    const fim = `translate3d(${-direcao.current * SAIDA_PX}px,0,0)`
    // só o fotograma final: se já havia uma saída a meio, continua a partir de onde está
    const anims = els.map((el, i) =>
      el.animate([{ opacity: 0, transform: fim }], { duration: 200, delay: i * 40, easing: EASE_IN, fill: 'forwards' }),
    )
    Promise.all(anims.map((a) => a.finished)).then(
      () => vivo && setVisto(passo),
      () => {},
    )
    return () => {
      vivo = false
    }
  }, [passo, visto])

  // 2) entrada (antes da pintura): limpa a saída, volta ao topo sem animação (nada visível a saltar),
  //    a nova pergunta entra do lado oposto — cabeçalho primeiro, opções 70ms depois — e só então recebe o foco
  useLayoutEffect(() => {
    trocaEm.current = performance.now()
    const els = [headerRef.current, corpoRef.current].filter((x): x is HTMLElement => Boolean(x?.animate))
    els.forEach((el) => el.getAnimations().forEach((a) => a.cancel()))
    scrollPara(lenis, 0, { instant: true })
    const focar = () => {
      const ativo = document.activeElement
      // não rouba o foco a quem já começou a responder
      if (ativo && ativo !== document.body && corpoRef.current?.contains(ativo)) return
      headingRef.current?.focus({ preventScroll: true })
    }
    if (prefersReducedMotion() || els.length === 0) {
      focar()
      return
    }
    const inicio = `translate3d(${direcao.current * ENTRADA_PX}px,0,0)`
    const anims = els.map((el, i) =>
      el.animate(
        [
          { opacity: 0, transform: inicio },
          { opacity: 1, transform: 'translate3d(0,0,0)' },
        ],
        {
          duration: 620,
          delay: i * 70,
          easing: EASE_OUT,
          fill: 'backwards',
        },
      ),
    )
    let vivo = true
    Promise.all(anims.map((a) => a.finished)).then(
      () => vivo && focar(),
      () => {},
    )
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando muda a pergunta desenhada
  }, [visto])

  // 3) teclado no ecrã: o campo focado fica visível entre o cabeçalho e a barra de ação
  const ajustarCampo = () => {
    const el = focado.current
    if (!el || document.activeElement !== el) return
    mostrarCampo(lenis, el.closest('[data-campo]') ?? el, { alinharTopo: el.getAttribute('role') === 'combobox' })
  }
  const onFocus = (e: FocusEvent<HTMLFormElement>) => {
    if (desktop || !abreTeclado(e.target)) {
      focado.current = null
      return
    }
    focado.current = e.target
    // dá tempo ao teclado para abrir (o iOS também faz o seu próprio scroll)
    window.setTimeout(ajustarCampo, 320)
  }
  useEffect(() => {
    if (tecladoAberto) ajustarCampo()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o teclado abre
  }, [tecladoAberto])

  const continuar = () => {
    if (bloqueado()) return // toque duplo não salta uma pergunta
    const e = validarPasso(visto, r)
    if (Object.keys(e).length) {
      setTentou(visto)
      // foco no primeiro campo com problema (depois de o erro ser desenhado) + um pequeno abanão
      requestAnimationFrame(() => {
        const alvo = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        if (!alvo) return
        alvo.focus({ preventScroll: true })
        const bloco = alvo.closest('[data-campo], fieldset') ?? alvo
        scrollAte(lenis, bloco, 'center')
        abanar(bloco)
      })
      return
    }
    setTentou(null)
    if (ultimo) acoes.verResultados()
    else acoes.irPara(visto + 1)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    continuar()
  }

  // Enter avança (exceto em botões, ligações, interruptores e na lista aberta da localidade)
  const onKeyDown = (e: KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return
    const t = e.target as HTMLElement
    if (t.closest('button, a, textarea, [role="switch"]')) return
    if (t instanceof HTMLInputElement && t.type === 'text' && t.getAttribute('role') !== 'combobox') return // submissão nativa
    e.preventDefault()
    continuar()
  }

  const voltar = () => {
    if (bloqueado()) return
    if (visto === 0) acoes.voltarAoInicio()
    else acoes.irPara(visto - 1)
  }
  const props = { r, patch: acoes.patch, erros, lares, p }
  // a barra de progresso avança logo ao tocar (acompanha a saída da pergunta)
  const progresso = (passo + 1) / TOTAL_PASSOS

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col">
      <div
        role="progressbar"
        aria-label="Progresso do questionário"
        aria-valuemin={1}
        aria-valuemax={TOTAL_PASSOS}
        aria-valuenow={passo + 1}
        aria-valuetext={`Passo ${passo + 1} de ${TOTAL_PASSOS}`}
        className="sticky top-16 z-[900] h-[3px] overflow-hidden bg-sand-deep"
      >
        <div
          className="h-full origin-left bg-terra-600 transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)]"
          style={{ transform: `scaleX(${progresso})` }}
        />
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        aria-labelledby="pergunta"
        className="flex flex-1 flex-col"
      >
        {/* overflow-x-clip: a pergunta a deslizar nunca cria scroll horizontal (e não estraga o sticky) */}
        <div className="container-narrow flex-1 overflow-x-clip pt-7 pb-10 sm:pt-16 sm:pb-14 lg:pt-24">
          <header ref={headerRef} className="mx-auto max-w-3xl text-center">
            <p className="flex min-h-10 flex-wrap items-center justify-center text-sm font-medium text-ink-mute tabular">
              Passo {visto + 1} de {TOTAL_PASSOS}
              {completo && !ultimo && (
                <>
                  <span aria-hidden className="mx-2 text-line-strong">
                    ·
                  </span>
                  <button
                    type="button"
                    onClick={acoes.verResultados}
                    className="link inline-flex min-h-11 items-center rounded-lg px-1 active:opacity-60"
                  >
                    Ver sugestões
                    <ChevronRight aria-hidden className="size-4" />
                  </button>
                </>
              )}
            </p>
            <h1
              id="pergunta"
              ref={headingRef}
              tabIndex={-1}
              className="mt-1 font-display text-[2.25rem] leading-[1.08] font-semibold text-ink outline-none sm:mt-2 sm:text-5xl"
            >
              {tituloPasso(visto, p)}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-ink-mute sm:mt-4 sm:text-xl">{ledePasso(visto)}</p>
          </header>

          <div ref={corpoRef} className="relative z-10 mx-auto mt-9 max-w-2xl sm:mt-14">
            {visto === 0 && <StepPessoa {...props} />}
            {visto === 1 && <StepAutonomia {...props} />}
            {visto === 2 && <StepSaude {...props} />}
            {visto === 3 && <StepLocal {...props} />}
            {visto === 4 && <StepOrcamento {...props} />}
            {visto === 5 && <StepQuando {...props} />}
          </div>
        </div>

        {/*
          Navegação. < lg: presa ao fundo (sticky — pára no fim do formulário, nunca tapa o rodapé), por cima da
          área segura; com o teclado aberto o `bottom` sticky passa a ser a altura do teclado (fica logo acima dele).
          ≥ lg: no fim do conteúdo.
        */}
        <div
          data-match-barra={desktop ? undefined : ''}
          style={tecladoAberto ? { bottom: teclado } : undefined}
          className={cn(
            'sticky bottom-0 z-[900] border-t border-black/[0.06] bg-white/85 backdrop-blur-xl backdrop-saturate-150',
            // o deslocamento sticky (bottom) respeita a posição natural da barra; anima-se para acompanhar o teclado
            'transition-[bottom] duration-300 ease-[cubic-bezier(.16,1,.3,1)]',
            'lg:static lg:z-auto lg:border-0 lg:bg-transparent lg:backdrop-blur-none lg:transition-none',
          )}
        >
          <div className="container-narrow">
            <div
              className={cn(
                'mx-auto flex max-w-2xl items-center gap-3 pt-3 lg:pt-0 lg:pb-16',
                tecladoAberto ? 'pb-3' : 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]',
              )}
            >
              <Button
                variant="subtle"
                size="lg"
                onClick={voltar}
                icon={<ChevronLeft aria-hidden />}
                className="shrink-0 px-5 sm:px-6"
              >
                Voltar
              </Button>
              <p className="ml-auto hidden items-center gap-1.5 text-sm text-ink-mute lg:flex">
                ou prima <kbd className="rounded-md bg-sand px-1.5 py-0.5 font-sans text-xs font-medium text-ink-soft">Enter</kbd>
                <CornerDownLeft aria-hidden className="size-3.5" />
              </p>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                iconRight={<ChevronRight aria-hidden />}
                className="min-w-0 flex-1 px-5 lg:ml-2 lg:flex-none lg:px-9"
              >
                {ultimo ? 'Ver sugestões' : 'Continuar'}
              </Button>
            </div>
          </div>
        </div>
      </form>
      {/* sem rodapé em /encontrar: aviso de protótipo discreto (no telemóvel, o fundo é da barra Voltar/Continuar) */}
      <NotaFinal className="container-narrow pb-2 max-lg:hidden" />
    </div>
  )
}
