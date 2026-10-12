/**
 * Primitivas de movimento ligadas ao scroll (estilo Apple), sem dependências externas.
 * Um único "scheduler" (rAF) partilhado por todos os subscritores evita trabalho por frame duplicado.
 */
import { useEffect, useRef, useState, type RefObject } from 'react'

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

export const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v))
/** mapeia v de [a,b] para [0,1] (com clamp) */
export const range = (v: number, a: number, b: number) => clamp((v - a) / (b - a || 1))
/** interpola entre x e y */
export const mix = (x: number, y: number, t: number) => x + (y - x) * t
/** easing suave (easeOutCubic) */
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

// ————————————————————————————————————————— scheduler partilhado

type Sub = () => void
const subs = new Set<Sub>()
let ticking = false
function tick() {
  ticking = false
  for (const s of subs) s()
}
function schedule() {
  if (!ticking) {
    ticking = true
    requestAnimationFrame(tick)
  }
}
let listening = false
function ensureListening() {
  if (listening || typeof window === 'undefined') return
  listening = true
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
}
export function subscribeScroll(fn: Sub) {
  ensureListening()
  subs.add(fn)
  schedule()
  return () => {
    subs.delete(fn)
  }
}

/**
 * Modos de progresso de um elemento em relação ao ecrã:
 * - 'through': 0 quando o topo entra por baixo, 1 quando o fundo sai por cima.
 * - 'enter':   0 quando o topo entra por baixo, 1 quando o topo chega a 35% da altura do ecrã.
 * - 'sticky':  para contentores altos com filho sticky — 0 quando o topo chega ao topo (abaixo do cabeçalho),
 *              1 quando o fundo chega ao fundo do ecrã.
 */
export type ProgressMode = 'through' | 'enter' | 'sticky'

export function measureProgress(el: HTMLElement, mode: ProgressMode, topOffset = 64): number {
  const r = el.getBoundingClientRect()
  const vh = window.innerHeight
  if (mode === 'through') return range(vh - r.top, 0, vh + r.height)
  if (mode === 'enter') return range(vh - r.top, 0, vh * 0.65)
  const total = r.height - (vh - topOffset)
  return total <= 0 ? (r.top <= topOffset ? 1 : 0) : range(topOffset - r.top, 0, total)
}

/** Progresso (0–1) como estado React — re-renderiza em cada frame de scroll; usar com moderação. */
export function useScrollProgress(ref: RefObject<HTMLElement | null>, mode: ProgressMode = 'through'): number {
  const [p, setP] = useState(0)
  useEffect(() => {
    if (prefersReducedMotion()) {
      setP(1)
      return
    }
    return subscribeScroll(() => {
      const el = ref.current
      if (el) setP((prev) => {
        const next = measureProgress(el, mode)
        return Math.abs(next - prev) < 0.001 ? prev : next
      })
    })
  }, [ref, mode])
  return p
}

/**
 * Escreve o progresso numa variável CSS do elemento (ex.: --p) sem re-render.
 * Ideal para transformações em CSS: style={{ transform: 'scale(calc(0.9 + var(--p) * 0.1))' }}.
 */
export function useScrollVar(ref: RefObject<HTMLElement | null>, mode: ProgressMode = 'through', name = '--p') {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) {
      el.style.setProperty(name, '1')
      return
    }
    return subscribeScroll(() => {
      const node = ref.current
      if (node) node.style.setProperty(name, measureProgress(node, mode).toFixed(4))
    })
  }, [ref, mode, name])
}

/** true quando o elemento entra no ecrã (por omissão só uma vez). */
export function useInView<T extends HTMLElement>(opts: { once?: boolean; rootMargin?: string; threshold?: number } = {}) {
  const { once = true, rootMargin = '0px 0px -10% 0px', threshold = 0.1 } = opts
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true)
          if (once) io.disconnect()
        } else if (!once) setInView(false)
      },
      { rootMargin, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, rootMargin, threshold])
  return [ref, inView] as const
}
