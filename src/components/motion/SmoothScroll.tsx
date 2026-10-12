import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { prefersReducedMotion } from '@/lib/motion'

const LenisContext = createContext<Lenis | null>(null)

/** Instância do scroll suave (ou null com movimento reduzido). Use lenis?.scrollTo(alvo) para scroll programático. */
export const useLenis = () => useContext(LenisContext)

/**
 * Scroll programático robusto: recalcula a altura (páginas carregadas de forma diferida) e
 * usa o Lenis quando ativo; caso contrário, scroll nativo suave. offset negativo = parar acima (ex.: -96).
 */
export function useScrollTo() {
  const lenis = useLenis()
  return (target: HTMLElement | number, offset = -96) => {
    if (lenis) {
      lenis.resize()
      lenis.scrollTo(target, { offset })
      return
    }
    if (typeof target === 'number') window.scrollTo({ top: target + offset, behavior: 'smooth' })
    else window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY + offset, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }
}

/** Scroll suave e "amanteigado" (tipo sites premiados) — desativado com prefers-reduced-motion. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const l = new Lenis({
      lerp: 0.11,
      wheelMultiplier: 1,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: true,
      anchors: false,
      allowNestedScroll: true,
      prevent: (node: HTMLElement) =>
        Boolean(node.closest?.('.leaflet-container, dialog, [data-lenis-prevent], [role="listbox"], [role="menu"]')),
    })
    setLenis(l)
    ;(window as unknown as { __lenis?: Lenis }).__lenis = l
    return () => {
      l.destroy()
      setLenis(null)
      delete (window as unknown as { __lenis?: Lenis }).__lenis
    }
  }, [])
  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
}
