/**
 * Movimento e ergonomia do questionário: teclado no ecrã, scroll programático (Lenis), números que mudam,
 * entradas escalonadas em listas e o "abanão" de erro. Tudo respeita prefers-reduced-motion.
 */
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import type Lenis from 'lenis'
import { easeOut, prefersReducedMotion, useInView } from '@/lib/motion'
import { cn } from '@/lib/cn'

/** Curva das entradas (DESIGN.md §7). */
export const EASE_OUT = 'cubic-bezier(.16,1,.3,1)'
/** Curva das saídas (acelera a sair, como no iOS). */
export const EASE_IN = 'cubic-bezier(.4,0,.7,.2)'
/** Altura do cabeçalho fixo (h-16) + barra de progresso. */
const TOPO = 67

// ————————————————————————————————————————— teclado no ecrã

/**
 * Quanto o teclado do telemóvel tapa o fundo do ecrã (px), a partir da visualViewport.
 * No iOS (e no Chrome Android por omissão) o teclado não encolhe a página: elementos presos ao fundo
 * ficam por baixo dele se não forem empurrados para cima.
 */
export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    let raf = 0
    const medir = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        // com zoom de pinça a visualViewport também encolhe — não é o teclado
        if (vv.scale > 1.01) return setInset(0)
        const v = Math.round(window.innerHeight - vv.height - vv.offsetTop)
        // ignora a barra de endereço a aparecer/desaparecer
        setInset(v > 120 ? v : 0)
      })
    }
    medir()
    vv.addEventListener('resize', medir)
    vv.addEventListener('scroll', medir)
    return () => {
      cancelAnimationFrame(raf)
      vv.removeEventListener('resize', medir)
      vv.removeEventListener('scroll', medir)
    }
  }, [])
  return inset
}

/** Campos que abrem o teclado (não rádios, caixas, réguas nem botões). */
export const abreTeclado = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLInputElement &&
    !['radio', 'checkbox', 'range', 'button', 'submit', 'reset', 'file', 'color'].includes(el.type))

// ————————————————————————————————————————— scroll programático

/** Desloca a página até `y` (Lenis quando ativo; caso contrário scroll nativo). */
export function scrollPara(lenis: Lenis | null, y: number, { instant = false } = {}) {
  const top = Math.max(0, Math.round(y))
  if (Math.abs(window.scrollY - top) < 2) return
  const imediato = instant || prefersReducedMotion()
  if (lenis) lenis.scrollTo(top, imediato ? { immediate: true, force: true } : { duration: 0.6, force: true })
  else window.scrollTo({ top, behavior: imediato ? ('instant' as ScrollBehavior) : 'smooth' })
}

/**
 * Garante que `el` fica visível entre o cabeçalho e a barra de ação (ou o teclado).
 * `alinharTopo`: coloca-o logo abaixo do cabeçalho (ex.: combobox, para a lista ter espaço por baixo).
 */
export function mostrarCampo(lenis: Lenis | null, el: Element, { alinharTopo = false, margem = 16 } = {}) {
  const vv = window.visualViewport
  const vTop = vv?.offsetTop ?? 0
  const vBottom = vTop + (vv?.height ?? window.innerHeight)
  const barra = document.querySelector('[data-match-barra]')?.getBoundingClientRect()
  const minY = Math.max(vTop, TOPO) + margem
  const maxY = Math.min(vBottom, barra && barra.height ? barra.top : vBottom) - margem
  const r = el.getBoundingClientRect()
  let delta = 0
  if (alinharTopo) delta = Math.abs(r.top - minY) > 8 ? r.top - minY : 0
  else if (r.top < minY) delta = r.top - minY
  else if (r.bottom > maxY) delta = Math.min(r.bottom - maxY, r.top - minY)
  if (delta) scrollPara(lenis, window.scrollY + delta)
}

/** Desloca até um elemento (centrado ou no topo), com o cabeçalho em conta. */
export function scrollAte(lenis: Lenis | null, el: Element, bloco: 'start' | 'center' = 'start') {
  const r = el.getBoundingClientRect()
  const y = bloco === 'center' ? window.scrollY + r.top - (window.innerHeight - r.height) / 2 : window.scrollY + r.top - TOPO - 24
  scrollPara(lenis, y)
}

// ————————————————————————————————————————— números

/**
 * Número que desliza suavemente até ao novo valor quando muda (contadores ao vivo).
 * O valor final fica num texto só para leitores de ecrã — os intermédios não são anunciados.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(n),
  duration = 520,
  className,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const [shown, setShown] = useState(value)
  const atual = useRef(value)
  useEffect(() => {
    const de = atual.current
    if (de === value) return
    if (prefersReducedMotion()) {
      atual.current = value
      setShown(value)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / duration)
      const v = de + (value - de) * easeOut(k)
      atual.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return (
    <span className={cn('tabular', className)}>
      <span aria-hidden>{format(Math.round(shown))}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}

// ————————————————————————————————————————— entradas escalonadas em listas

let ultimaEntrada = 0
let emLote = 0
/**
 * Atraso para itens que entram no ecrã "ao mesmo tempo" (primeira página, "Mostrar mais"):
 * escalona-os 80ms; um item que aparece sozinho durante o scroll entra sem atraso.
 */
function atrasoEmLote() {
  const t = performance.now()
  if (t - ultimaEntrada > 160) emLote = 0
  ultimaEntrada = t
  return Math.min(emLote++, 5) * 80
}

/**
 * Entrada suave de um item de lista ao aparecer (sobe e ganha opacidade).
 * Mais leve do que <Reveal> para listas longas: sem will-change permanente.
 */
export function useEntrada<T extends HTMLElement>() {
  const [ref, inView] = useInView<T>({ rootMargin: '0px 0px -6% 0px', threshold: 0.05 })
  const [atraso, setAtraso] = useState(0)
  // antes da pintura: a transição já arranca com o atraso certo
  useLayoutEffect(() => {
    if (inView) setAtraso(atrasoEmLote())
  }, [inView])
  const className = cn(
    'transition-[opacity,transform] duration-700 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
    inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0',
  )
  const style: CSSProperties = { transitionDelay: inView ? `${atraso}ms` : '0ms' }
  return { ref, className, style }
}

// ————————————————————————————————————————— feedback de erro

/** "Abanão" curto (como o iOS numa palavra-passe errada) no campo com erro. */
export function abanar(el: Element | null) {
  if (!el || prefersReducedMotion() || !(el instanceof HTMLElement) || !el.animate) return
  el.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-9px)' },
      { transform: 'translateX(8px)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(3px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 420, easing: 'ease-out' },
  )
}
