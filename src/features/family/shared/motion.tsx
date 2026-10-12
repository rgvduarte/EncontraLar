/**
 * Movimento funcional do painel da família (ecrãs de app, não de marketing): entradas curtas e
 * escalonadas, estados que mudam com transição, barras que enchem ao aparecer, números que contam.
 * Só transform/opacity/filter; com prefers-reduced-motion tudo aparece logo no estado final.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ElementType,
  type ReactNode,
  type RefObject,
} from 'react'
import { easeOut, prefersReducedMotion, useInView } from '@/lib/motion'
import { cn } from '@/lib/cn'

/** Curva "expo out" usada em todo o site. */
export const EASE = 'cubic-bezier(.16,1,.3,1)'

const podeAnimar = (el: Element | null | undefined): el is Element =>
  Boolean(el) && !prefersReducedMotion() && typeof (el as Element).animate === 'function'

/** Web Animations API com a curva da casa; null com movimento reduzido. */
export function animar(el: Element | null | undefined, keyframes: Keyframe[], options: KeyframeAnimationOptions = {}): Animation | null {
  if (!podeAnimar(el)) return null
  return el.animate(keyframes, { duration: 500, easing: EASE, fill: 'backwards', ...options })
}

/** Anima a saída de um elemento e só depois executa a ação (que normalmente o desmonta). */
export function sairEDepois(el: Element | null | undefined, depois: () => void, keyframes?: Keyframe[], duration = 300) {
  const a = animar(el, keyframes ?? [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.97)', filter: 'blur(4px)' }], {
    duration,
    easing: 'cubic-bezier(.4,0,.2,1)',
    fill: 'forwards',
  })
  if (!a) return depois()
  a.finished.then(depois, depois).finally(() => {
    // se o elemento continuar montado (ex.: a ação falhou), volta a aparecer
    requestAnimationFrame(() => requestAnimationFrame(() => a.cancel()))
  })
}

/** Entrada ao ser montado (antes da primeira pintura, sem "piscar"). */
export function useMountAnimation(ref: RefObject<Element | null>, keyframes: Keyframe[], options: KeyframeAnimationOptions = {}, enabled = true) {
  useLayoutEffect(() => {
    if (!enabled) return
    const a = animar(ref.current, keyframes, options)
    return () => a?.cancel()
    // só no momento da montagem
  }, [])
}

/**
 * Anima quando `key` muda (não na montagem): ex. o bloco de estado de um pedido quando passa de
 * "Lista de espera" para "Aceite".
 */
export function useChangeAnimation(ref: RefObject<Element | null>, key: unknown, keyframes: Keyframe[] = ENTRA_CIMA, options: KeyframeAnimationOptions = {}) {
  const prev = useRef(key)
  useLayoutEffect(() => {
    if (Object.is(prev.current, key)) return
    prev.current = key
    const a = animar(ref.current, keyframes, options)
    return () => a?.cancel()
  }, [key])
}

export const ENTRA_CIMA: Keyframe[] = [
  { opacity: 0, transform: 'translateY(12px)' },
  { opacity: 1, transform: 'none' },
]
export const ENTRA_DIREITA: Keyframe[] = [
  { opacity: 0, transform: 'translateX(28px)' },
  { opacity: 1, transform: 'none' },
]
export const ENTRA_ESQUERDA: Keyframe[] = [
  { opacity: 0, transform: 'translateX(-28px)' },
  { opacity: 1, transform: 'none' },
]

interface ViewSpec {
  el: Element
  keyframes: Keyframe[]
  options?: KeyframeAnimationOptions
}

/**
 * Prepara animações (em pausa, no 1.º fotograma) ao montar e toca-as quando o bloco entra no ecrã.
 * Útil para "desenhar" elementos internos: barras que enchem, linhas do tempo que se traçam.
 */
export function useViewAnimations<T extends HTMLElement>(build: (root: T) => ViewSpec[]) {
  const [ref, inView] = useInView<T>({ rootMargin: '0px 0px -8% 0px' })
  const anims = useRef<Animation[]>([])
  const visto = useRef(false)
  useLayoutEffect(() => {
    const root = ref.current
    if (!podeAnimar(root)) return
    const list = build(root).map(({ el, keyframes, options }) => {
      const a = el.animate(keyframes, { duration: 900, easing: EASE, fill: 'backwards', ...options })
      if (!visto.current) a.pause()
      return a
    })
    anims.current = list
    return () => list.forEach((a) => a.cancel())
    // só na montagem
  }, [])
  useEffect(() => {
    if (!inView) return
    visto.current = true
    anims.current.forEach((a) => a.play())
  }, [inView])
  return ref
}

// ————————————————————————————————————————— entradas por classes (escalonadas)

/**
 * true (uma vez) quando o elemento entra no ecrã. Usa uma ref de callback, por isso funciona também
 * com elementos que só aparecem depois (ex.: uma lista que deixa de estar vazia).
 */
export function useSeen<T extends Element>(rootMargin = '0px 0px -8% 0px') {
  const [on, setOn] = useState(prefersReducedMotion)
  const ref = useCallback(
    (node: T | null) => {
      if (!node) return
      if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
        setOn(true)
        return
      }
      const io = new IntersectionObserver(
        ([e]) => {
          if (e?.isIntersecting) {
            setOn(true)
            io.disconnect()
          }
        },
        { rootMargin, threshold: 0.08 },
      )
      io.observe(node)
      return () => io.disconnect()
    },
    [rootMargin],
  )
  return [ref, on] as const
}

export type EnterVariant = 'up' | 'fade' | 'scale' | 'left' | 'right'

const ESCONDIDO: Record<EnterVariant, string> = {
  up: 'translate-y-5 opacity-0',
  fade: 'opacity-0',
  scale: 'scale-[0.95] opacity-0',
  left: '-translate-x-6 opacity-0',
  right: 'translate-x-8 opacity-0',
}

/** Classes de entrada para quem controla o "inView" (listas em que cada <li> entra com atraso). */
export function enterCls(on: boolean, variant: EnterVariant = 'up') {
  return cn(
    'transition-[opacity,translate,scale] duration-700 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
    on ? 'translate-x-0 translate-y-0 scale-100 opacity-100' : ESCONDIDO[variant],
  )
}

/** Atraso escalonado (máximo de 8 passos, para listas longas não demorarem). */
export const stagger = (on: boolean, i: number, step = 70, base = 0): CSSProperties => ({
  transitionDelay: on ? `${base + Math.min(i, 8) * step}ms` : '0ms',
})

/** Bloco que entra quando aparece no ecrã — versão curta (app) do <Reveal>. */
export function Enter({
  as: As = 'div',
  variant = 'up',
  delay = 0,
  duration,
  className,
  style,
  children,
  id,
}: {
  as?: ElementType
  variant?: EnterVariant
  delay?: number
  /** ms (por omissão 700) */
  duration?: number
  className?: string
  style?: CSSProperties
  children: ReactNode
  id?: string
}) {
  const [ref, on] = useSeen<HTMLElement>()
  return (
    <As ref={ref} id={id} className={cn(enterCls(on, variant), className)} style={{ transitionDelay: on ? `${delay}ms` : '0ms', transitionDuration: duration ? `${duration}ms` : undefined, ...style }}>
      {children}
    </As>
  )
}

/** Hook para listas: devolve [ref, on] para o contentor e uma função de props por item. */
export function useStagger<T extends HTMLElement>(variant: EnterVariant = 'up', step = 70, base = 0) {
  const [ref, on] = useSeen<T>()
  const item = (i: number, className?: string) => ({ className: cn(enterCls(on, variant), className), style: stagger(on, i, step, base) })
  return [ref, item, on] as const
}

// ————————————————————————————————————————— números

/** Valor que desliza suavemente até ao novo valor quando muda (ex.: contagem de compatíveis). */
export function useTweened(value: number, duration = 500, fromZero = false): number {
  const inicio = fromZero && !prefersReducedMotion() ? 0 : value
  const [n, setN] = useState(inicio)
  const atual = useRef(inicio)
  useEffect(() => {
    const from = atual.current
    if (from === value) return
    if (prefersReducedMotion()) {
      atual.current = value
      setN(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const v = from + (value - from) * easeOut(k)
      atual.current = v
      setN(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return n
}

/** Número que desliza ao mudar; o leitor de ecrã lê só o valor final. */
export function Tween({
  value,
  className,
  fromZero = false,
  duration = 500,
  format = (v) => Math.round(v).toLocaleString('pt-PT'),
}: {
  value: number
  className?: string
  /** conta a partir de 0 ao aparecer (CountUp) e depois desliza nas mudanças */
  fromZero?: boolean
  duration?: number
  format?: (v: number) => string
}) {
  const [ref, visto] = useSeen<HTMLSpanElement>('0px')
  // com fromZero, só começa a contar quando o número aparece no ecrã
  const n = useTweened(fromZero && !visto ? 0 : value, duration, fromZero)
  return (
    <span ref={ref} className={cn('tabular', className)}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden>{format(n)}</span>
    </span>
  )
}

/**
 * Segmento de "conta-quilómetros": quando o valor muda, o novo entra por baixo dentro de uma máscara
 * (contagens decrescentes que avançam com suavidade).
 */
export function Roll({ value, className }: { value: string | number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  useChangeAnimation(
    ref,
    value,
    [
      { transform: 'translateY(55%)', opacity: 0, filter: 'blur(3px)' },
      { transform: 'none', opacity: 1, filter: 'blur(0)' },
    ],
    { duration: 650 },
  )
  return (
    <span className={cn('inline-flex overflow-hidden align-bottom', className)}>
      <span ref={ref} className="inline-block">
        {value}
      </span>
    </span>
  )
}
