import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ElementType, type ReactNode } from 'react'
import { prefersReducedMotion } from '@/lib/motion'

/**
 * Entradas das páginas de conta (logótipo, título, campos) — escalonadas, com desfoque/subida.
 *
 * Porque não o <Reveal> partilhado: aqui os blocos são campos de formulário. Depois de entrar, o bloco
 * fica SEM transform/filter/will-change, para não criar contextos de empilhamento (a lista de sugestões
 * da localidade e a barra de ação "sticky" precisam disso) nem atrasar o foco.
 */

export type AppearVariant = 'blur' | 'up' | 'scale' | 'fade'

const FROM: Record<AppearVariant, CSSProperties> = {
  blur: { opacity: 0, transform: 'translate3d(0,14px,0)', filter: 'blur(8px)' },
  up: { opacity: 0, transform: 'translate3d(0,18px,0)' },
  scale: { opacity: 0, transform: 'scale(0.86)', filter: 'blur(6px)' },
  fade: { opacity: 0 },
}

const EASE = 'cubic-bezier(.16,1,.3,1)'

/**
 * "Portão" de entradas: enquanto um painel desliza para dentro (troca Família/Instituição, passos),
 * os blocos que já estão no ecrã aparecem logo — o deslize do painel já é a animação.
 * Encadeado: um painel dentro de outro painel respeita os dois.
 */
export interface AppearGate {
  until: number
  parent: AppearGate | null
}
const GateContext = createContext<AppearGate | null>(null)
export const AppearGateProvider = GateContext.Provider
export const useAppearGate = () => useContext(GateContext)

function gateOpen(g: AppearGate | null): boolean {
  const now = performance.now()
  for (let x = g; x; x = x.parent) if (now < x.until) return true
  return false
}

/** Atraso para a cascata inicial; no máximo 700 ms para nada importante ficar à espera. */
export const cascade = (i: number, base = 160, step = 70) => Math.min(700, base + i * step)

export function Appear({
  children,
  as: As = 'div',
  delay = 0,
  variant = 'blur',
  duration = 720,
  className,
  id,
}: {
  children: ReactNode
  as?: ElementType
  /** atraso (ms) na cascata inicial; blocos revelados mais tarde, com o scroll, usam no máximo 60 ms */
  delay?: number
  variant?: AppearVariant
  duration?: number
  className?: string
  id?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const gate = useAppearGate()
  const [phase, setPhase] = useState<'hidden' | 'in' | 'done'>(() => (prefersReducedMotion() ? 'done' : 'hidden'))
  const [wait, setWait] = useState(delay)

  useEffect(() => {
    if (phase !== 'hidden') return
    const el = ref.current
    if (!el || !('IntersectionObserver' in window)) {
      setPhase('done')
      return
    }
    const mountedAt = performance.now()
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return
        io.disconnect()
        if (gateOpen(gate)) {
          setPhase('done')
          return
        }
        // cascata só na chegada à página; ao fazer scroll, quase imediato
        setWait(performance.now() - mountedAt > 600 ? Math.min(delay, 60) : delay)
        setPhase('in')
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.01 },
    )
    io.observe(el)
    return () => io.disconnect()
    // só na montagem: uma entrada por bloco
  }, [])

  useEffect(() => {
    if (phase !== 'in') return
    const t = window.setTimeout(() => setPhase('done'), wait + duration + 60)
    return () => window.clearTimeout(t)
  }, [phase, wait, duration])

  const style: CSSProperties | undefined =
    phase === 'hidden'
      ? FROM[variant]
      : phase === 'in'
        ? {
            opacity: 1,
            transform: 'none',
            filter: 'none',
            transition: `opacity ${duration}ms ${EASE} ${wait}ms, transform ${duration}ms ${EASE} ${wait}ms, filter ${duration}ms ${EASE} ${wait}ms`,
            willChange: 'opacity, transform',
          }
        : undefined

  return (
    <As
      ref={ref}
      id={id}
      className={className}
      style={style}
      // nunca esconder um campo que recebe foco (Tab, atalhos do resumo de erros)
      onFocusCapture={phase === 'hidden' ? () => setPhase('done') : undefined}
    >
      {children}
    </As>
  )
}
