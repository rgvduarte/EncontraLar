import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ChevronDown, CircleCheck, CircleMinus, CircleX, type LucideIcon } from 'lucide-react'
import { CountUp, useLenis } from '@/components/motion'
import { PESOS, scoreLabel, type MatchResult, type TipoRazao } from '@/lib/matching'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { fundoUtil, scrollPara } from '../motion'

const PARCELA_LABEL: Record<keyof typeof PESOS, string> = {
  cuidados: 'Cuidados de saúde',
  orcamento: 'Orçamento',
  distancia: 'Distância',
  disponibilidade: 'Vaga para o prazo',
  preferencias: 'Preferências e quarto',
}

const RAZAO: Record<TipoRazao, { sr: string; Icon: LucideIcon; cor: string }> = {
  ok: { sr: 'A favor', Icon: CircleCheck, cor: 'text-leaf-600' },
  parcial: { sr: 'A ponderar', Icon: CircleMinus, cor: 'text-sun-700' },
  falta: { sr: 'Em falta', Icon: CircleX, cor: 'text-alert-600' },
}

/** Quanto cada critério contribuiu, sobre o seu peso máximo. As barras enchem-se em cascata ao abrir. */
function Parcelas({ m }: { m: MatchResult }) {
  return (
    <ul className="flex flex-col gap-4">
      {(Object.keys(PESOS) as (keyof typeof PESOS)[]).map((k, i) => {
        const v = Math.round(m.parcelas[k])
        const peso = PESOS[k]
        return (
          <li key={k}>
            <p className="flex items-baseline justify-between gap-3 text-sm">
              <span className="text-ink">{PARCELA_LABEL[k]}</span>
              <span className="text-ink-mute tabular">
                <span className="font-medium text-ink">{v}</span> de {peso}
              </span>
            </p>
            <span aria-hidden className="mt-1.5 block h-1 overflow-hidden rounded-full bg-black/[0.08]">
              <span
                className="block h-full origin-left rounded-full bg-ink transition-transform delay-(--d) duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] [transform:scaleX(var(--f))] starting:[transform:scaleX(0)] motion-reduce:delay-0"
                style={
                  {
                    '--f': Math.max(0, Math.min(1, m.parcelas[k] / peso)).toFixed(3),
                    '--d': `${220 + i * 70}ms`,
                  } as CSSProperties
                }
              />
            </span>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * "Porque sugerimos": razões a favor / a ponderar / em falta e as parcelas da pontuação.
 * Abre e fecha com uma animação de altura + opacidade (grid 0fr → 1fr); as barras enchem-se ao abrir.
 */
export function WhyPanel({ m, nome }: { m: MatchResult; nome: string }) {
  const [aberto, setAberto] = useState(false)
  // continua montado durante a animação de fecho
  const [montado, setMontado] = useState(false)
  const id = useId()
  const lenis = useLenis()
  const botaoRef = useRef<HTMLButtonElement>(null)
  const painelRef = useRef<HTMLDivElement>(null)

  // ao abrir, se o painel for ficar escondido por baixo (ou atrás da barra fixa), a página acompanha-o
  // — sem nunca tirar o botão do ecrã
  useEffect(() => {
    if (!aberto) return
    const t = window.setTimeout(() => {
      const painel = painelRef.current
      const botao = botaoRef.current
      if (!painel || !botao) return
      const fimPainel = botao.getBoundingClientRect().bottom + 8 + painel.offsetHeight
      const topoBotao = botao.getBoundingClientRect().top
      const delta = Math.min(fimPainel - (fundoUtil() - 16), topoBotao - 96)
      if (delta > 0) scrollPara(lenis, window.scrollY + delta)
    }, 60)
    return () => window.clearTimeout(t)
  }, [aberto, lenis])

  useEffect(() => {
    if (aberto || !montado) return
    // rede de segurança se o transitionend não chegar (ex.: separador em segundo plano)
    const t = window.setTimeout(() => setMontado(false), prefersReducedMotion() ? 0 : 600)
    return () => window.clearTimeout(t)
  }, [aberto, montado])

  const alternar = () => {
    if (aberto) setAberto(false)
    else {
      setMontado(true)
      setAberto(true)
    }
  }
  const nOk = m.razoes.filter((r) => r.tipo === 'ok').length
  const nFalta = m.razoes.filter((r) => r.tipo === 'falta').length

  return (
    <div className="px-3 sm:px-0">
      <div className="flex flex-wrap items-center gap-x-4">
        <button
          type="button"
          ref={botaoRef}
          aria-expanded={aberto}
          aria-controls={id}
          onClick={alternar}
          className="link inline-flex min-h-12 items-center gap-1 rounded-lg text-base active:opacity-60"
        >
          Porque sugerimos<span className="sr-only"> {nome}</span>
          <ChevronDown aria-hidden className={cn('size-4 transition-transform duration-300', aberto && 'rotate-180')} />
        </button>
        <span className="text-sm text-ink-mute">
          {nOk} a favor{nFalta > 0 && ` · ${nFalta} em falta`}
        </span>
      </div>

      {montado && (
        <div
          inert={!aberto}
          onTransitionEnd={(e) => {
            if (e.target === e.currentTarget && e.propertyName === 'grid-template-rows' && !aberto) setMontado(false)
          }}
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] starting:grid-rows-[0fr] starting:opacity-0',
            aberto ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0 duration-300',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              ref={painelRef}
              id={id}
              className={cn(
                'mt-2 grid gap-10 rounded-[1.5rem] bg-sand p-6 transition-transform duration-500 ease-[cubic-bezier(.16,1,.3,1)] starting:-translate-y-3 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] sm:p-8',
                !aberto && '-translate-y-3',
              )}
            >
              <ul className="flex flex-col gap-2.5">
                {m.razoes.map((r, i) => {
                  const g = RAZAO[r.tipo]
                  return (
                    <li
                      key={i}
                      style={{ '--d': `${120 + i * 45}ms` } as CSSProperties}
                      className="flex items-start gap-2.5 text-base leading-snug text-ink transition-[opacity,translate] delay-(--d) duration-500 ease-[cubic-bezier(.16,1,.3,1)] starting:translate-y-1.5 starting:opacity-0 motion-reduce:delay-0"
                    >
                      <g.Icon aria-hidden className={cn('mt-0.5 size-5 shrink-0', g.cor)} strokeWidth={1.8} />
                      <span>
                        <span className="sr-only">{g.sr}: </span>
                        {r.texto}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <div>
                <p className="mb-4 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-ink">{scoreLabel(m.score)}</span>
                  <span className="text-2xl font-semibold text-ink tabular">
                    <span aria-hidden>
                      <CountUp value={m.score} duration={900} format={(n) => `${Math.round(n)}%`} />
                    </span>
                    <span className="sr-only">{m.score}%</span>
                  </span>
                </p>
                <Parcelas m={m} />
                {!m.compativel && (
                  <p className="mt-4 text-sm text-ink-soft">
                    Falha um requisito essencial, por isso a pontuação fica limitada a 35%.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
