import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ChevronLeft, ChevronRight, CornerDownLeft } from 'lucide-react'
import type { Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { primeiroIncompleto, TOTAL_PASSOS, validarPasso, type Erros } from '../model'
import { pessoa } from '../language'
import type { AcoesSessao, Sessao } from '../useMatchSession'
import { ledePasso, tituloPasso } from './copy'
import { StepPessoa } from '../steps/StepPessoa'
import { StepAutonomia } from '../steps/StepAutonomia'
import { StepSaude } from '../steps/StepSaude'
import { StepLocal } from '../steps/StepLocal'
import { StepOrcamento } from '../steps/StepOrcamento'
import { StepQuando } from '../steps/StepQuando'

const reduzMovimento = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Uma pergunta por ecrã, ao estilo do assistente de configuração da Apple:
 * barra de progresso fina no topo, pergunta enorme e centrada, Voltar / Continuar (fixos em baixo no telemóvel).
 */
export function Wizard({ sessao, acoes, lares }: { sessao: Sessao; acoes: AcoesSessao; lares: Lar[] }) {
  const { passo, r } = sessao
  const p = pessoa(r)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [tentou, setTentou] = useState<number | null>(null)
  const erros: Erros = tentou === passo ? validarPasso(passo, r) : {}
  const ultimo = passo === TOTAL_PASSOS - 1
  // a editar a partir dos resultados: tudo respondido → atalho para voltar às sugestões
  const completo = primeiroIncompleto(r) === -1

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduzMovimento() ? 'auto' : 'smooth' })
    headingRef.current?.focus({ preventScroll: true })
  }, [passo])

  const continuar = () => {
    const e = validarPasso(passo, r)
    if (Object.keys(e).length) {
      setTentou(passo)
      // foco no primeiro campo com problema (depois de o erro ser desenhado)
      requestAnimationFrame(() => {
        const alvo = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        alvo?.focus()
        alvo?.scrollIntoView({ block: 'center', behavior: reduzMovimento() ? 'auto' : 'smooth' })
      })
      return
    }
    setTentou(null)
    if (ultimo) acoes.verResultados()
    else acoes.irPara(passo + 1)
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

  const voltar = () => (passo === 0 ? acoes.voltarAoInicio() : acoes.irPara(passo - 1))
  const props = { r, patch: acoes.patch, erros, lares, p }
  const progresso = ((passo + 1) / TOTAL_PASSOS) * 100

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-1 flex-col">
      <div
        role="progressbar"
        aria-label="Progresso do questionário"
        aria-valuemin={1}
        aria-valuemax={TOTAL_PASSOS}
        aria-valuenow={passo + 1}
        aria-valuetext={`Passo ${passo + 1} de ${TOTAL_PASSOS}`}
        className="sticky top-16 z-[900] h-[3px] bg-sand-deep"
      >
        <div
          className="h-full rounded-r-full bg-terra-600 transition-[width] duration-500 ease-[cubic-bezier(.25,.1,.25,1)]"
          style={{ width: `${progresso}%` }}
        />
      </div>

      <form
        ref={formRef}
        noValidate
        onSubmit={onSubmit}
        onKeyDown={onKeyDown}
        aria-labelledby="pergunta"
        className="flex flex-1 flex-col"
      >
        <div className="container-narrow flex-1 pt-9 pb-12 sm:pt-20 sm:pb-14 lg:pt-24">
          <header key={`h${passo}`} className="mx-auto max-w-3xl animate-fade-up text-center [animation-fill-mode:backwards]">
            <p className="text-sm font-medium text-ink-mute tabular">
              Passo {passo + 1} de {TOTAL_PASSOS}
              {completo && !ultimo && (
                <>
                  <span aria-hidden className="mx-2 text-line-strong">
                    ·
                  </span>
                  <button type="button" onClick={acoes.verResultados} className="link inline-flex min-h-10 items-center">
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
              className="mt-3 font-display text-4xl font-semibold text-ink outline-none sm:text-5xl"
            >
              {tituloPasso(passo, p)}
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-ink-mute sm:mt-4 sm:text-xl">{ledePasso(passo)}</p>
          </header>

          <div
            key={`c${passo}`}
            className="relative z-10 mx-auto mt-10 max-w-2xl animate-fade-up [animation-delay:90ms] [animation-fill-mode:backwards] sm:mt-16"
          >
            {passo === 0 && <StepPessoa {...props} />}
            {passo === 1 && <StepAutonomia {...props} />}
            {passo === 2 && <StepSaude {...props} />}
            {passo === 3 && <StepLocal {...props} />}
            {passo === 4 && <StepOrcamento {...props} />}
            {passo === 5 && <StepQuando {...props} />}
          </div>
        </div>

        {/* navegação: fixa no fundo no telemóvel (por cima da área segura), no fim do conteúdo a partir de sm */}
        <div
          className={cn(
            'sticky bottom-[var(--tabbar-h,0px)] z-[900] border-t border-black/[0.06] bg-white/85 backdrop-blur-xl backdrop-saturate-150',
            'sm:static sm:z-auto sm:border-0 sm:bg-transparent sm:backdrop-blur-none',
          )}
        >
          <div className="container-narrow">
            <div className="mx-auto flex max-w-2xl items-center gap-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pt-0 sm:pb-24">
              <Button variant="subtle" size="lg" onClick={voltar} icon={<ChevronLeft aria-hidden />} className="max-sm:px-4 sm:px-6">
                Voltar
              </Button>
              <p className="ml-auto hidden items-center gap-1.5 text-sm text-ink-mute md:flex">
                ou prima <kbd className="rounded-md bg-sand px-1.5 py-0.5 font-sans text-xs font-medium text-ink-soft">Enter</kbd>
                <CornerDownLeft aria-hidden className="size-3.5" />
              </p>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                iconRight={<ChevronRight aria-hidden />}
                className="ml-auto min-w-0 flex-1 max-sm:px-5 sm:flex-none sm:px-9 md:ml-2"
              >
                {ultimo ? 'Ver sugestões' : 'Continuar'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}
