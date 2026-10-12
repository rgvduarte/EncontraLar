import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowLeft, ArrowRight, ChevronDown, CornerDownLeft, ListChecks } from 'lucide-react'
import type { Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/cn'
import { PASSOS, primeiroIncompleto, TOTAL_PASSOS, validarPasso, type Erros } from '../model'
import { pessoa } from '../language'
import type { AcoesSessao, Sessao } from '../useMatchSession'
import { FunilRetrato, IndicePassos, RetratoRail } from './Retrato'
import { ledePasso, tituloPasso } from './copy'
import { StepPessoa } from '../steps/StepPessoa'
import { StepAutonomia } from '../steps/StepAutonomia'
import { StepSaude } from '../steps/StepSaude'
import { StepLocal } from '../steps/StepLocal'
import { StepOrcamento } from '../steps/StepOrcamento'
import { StepQuando } from '../steps/StepQuando'

const reduzMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Barra de progresso compacta (telemóvel) com o retrato desdobrável. */
function ProgressoMovel({ sessao, onIrPara, lares }: { sessao: Sessao; onIrPara: (i: number) => void; lares: Lar[] }) {
  const [aberto, setAberto] = useState(false)
  const { passo, r, alcancado } = sessao
  return (
    <div className="border-b border-line bg-sand/70 lg:hidden">
      <div className="container-page py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink">
            Passo {passo + 1} de {TOTAL_PASSOS} <span className="font-normal text-ink-soft">· {PASSOS[passo]!.nome}</span>
          </p>
          <button
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            aria-controls="retrato-movel"
            className="-mr-2 inline-flex min-h-12 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-pine-800 hover:bg-white/70"
          >
            <ListChecks aria-hidden className="size-5" />
            Retrato
            <ChevronDown aria-hidden className={cn('size-4 transition-transform', aberto && 'rotate-180')} />
          </button>
        </div>
        <div className="mt-1 flex gap-1.5" aria-hidden>
          {PASSOS.map((s, i) => (
            <span
              key={s.id}
              className={cn('h-1.5 flex-1 rounded-full', i < passo ? 'bg-pine-600' : i === passo ? 'bg-terra-500' : 'bg-sand-deep')}
            />
          ))}
        </div>
        {aberto && (
          <div id="retrato-movel" className="mt-3 animate-fade-in rounded-3xl border border-line bg-cream p-2">
            <IndicePassos
              r={r}
              passo={passo}
              alcancado={alcancado}
              onIrPara={(i) => {
                setAberto(false)
                onIrPara(i)
              }}
            />
            <div className="mx-3 mt-1 mb-2 border-t border-dashed border-line-strong pt-4">
              <FunilRetrato r={r} lares={lares} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function Wizard({ sessao, acoes, lares }: { sessao: Sessao; acoes: AcoesSessao; lares: Lar[] }) {
  const { passo, r, alcancado } = sessao
  const p = pessoa(r)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [tentou, setTentou] = useState<number | null>(null)
  const erros: Erros = tentou === passo ? validarPasso(passo, r) : {}
  const ultimo = passo === TOTAL_PASSOS - 1
  // a editar a partir dos resultados: tudo respondido → atalho para os resultados
  const completo = primeiroIncompleto(r) === -1

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: reduzMovimento() ? 'auto' : 'smooth' })
  }, [passo])

  const continuar = () => {
    const e = validarPasso(passo, r)
    if (Object.keys(e).length) {
      setTentou(passo)
      // foco no primeiro campo com problema (depois de o erro ser desenhado)
      requestAnimationFrame(() => {
        const alvo = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')
        alvo?.focus()
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

  // Enter avança (exceto em botões, áreas de texto e quando a lista da localidade está aberta)
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

  return (
    <div className="flex flex-1 flex-col">
      <ProgressoMovel sessao={sessao} onIrPara={acoes.irPara} lares={lares} />
      <div className="container-page grid flex-1 gap-10 pt-8 pb-36 lg:grid-cols-12 lg:gap-12 lg:pt-12 lg:pb-20">
        <div className="hidden lg:col-span-4 lg:block xl:col-span-4">
          <div className="sticky top-[calc(4.5rem+1.5rem)]">
            <RetratoRail r={r} passo={passo} alcancado={alcancado} onIrPara={acoes.irPara} lares={lares} />
          </div>
        </div>

        <form
          ref={formRef}
          noValidate
          onSubmit={onSubmit}
          onKeyDown={onKeyDown}
          className="flex min-w-0 flex-col lg:col-span-8 xl:col-span-8"
          aria-labelledby="pergunta"
        >
          <header key={`h${passo}`} className="max-w-3xl animate-fade-up">
            <p className="eyebrow hidden lg:block">
              Passo {passo + 1} de {TOTAL_PASSOS} · {PASSOS[passo]!.nome}
            </p>
            <h1
              id="pergunta"
              ref={headingRef}
              tabIndex={-1}
              className="mt-3 font-display text-4xl font-semibold text-ink outline-none sm:text-5xl"
            >
              {tituloPasso(passo, p)}
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-ink-soft">{ledePasso(passo, p)}</p>
          </header>

          <div key={`c${passo}`} className="mt-9 animate-fade-up [animation-delay:60ms]">
            {passo === 0 && <StepPessoa {...props} />}
            {passo === 1 && <StepAutonomia {...props} />}
            {passo === 2 && <StepSaude {...props} />}
            {passo === 3 && <StepLocal {...props} />}
            {passo === 4 && <StepOrcamento {...props} />}
            {passo === 5 && <StepQuando {...props} />}
          </div>

          {/* navegação: fixa em baixo no telemóvel, no fim do conteúdo no desktop */}
          <div
            className={cn(
              'fixed inset-x-0 bottom-0 z-[900] border-t border-line bg-cream/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-16px_rgb(70_50_20/0.35)] backdrop-blur',
              'lg:static lg:z-auto lg:mt-12 lg:border-t-2 lg:border-dashed lg:border-line-strong lg:bg-transparent lg:px-0 lg:pt-7 lg:pb-0 lg:shadow-none lg:backdrop-blur-none',
            )}
          >
            <div className="flex items-center gap-3">
              <Button
                variant="secondary"
                size="lg"
                onClick={voltar}
                icon={<ArrowLeft aria-hidden className="size-5" />}
                className="px-5 max-sm:px-4"
              >
                Voltar
              </Button>
              {completo && !ultimo && (
                <Button variant="ghost" size="lg" onClick={acoes.verResultados} className="hidden px-4 sm:inline-flex">
                  Ver sugestões
                </Button>
              )}
              <Button
                type="submit"
                variant={ultimo ? 'accent' : 'primary'}
                size="lg"
                iconRight={<ArrowRight aria-hidden className="size-5" />}
                className="ml-auto flex-1 sm:flex-none sm:px-9"
              >
                {ultimo ? 'Ver sugestões' : 'Continuar'}
              </Button>
            </div>
            <p className="mt-3 hidden items-center justify-end gap-1.5 text-sm text-ink-mute lg:flex">
              <CornerDownLeft aria-hidden className="size-4" />
              Também pode carregar em <kbd className="rounded-md border border-line-strong bg-white px-1.5 font-sans text-xs font-bold">Enter</kbd>
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}
