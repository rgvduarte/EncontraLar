import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import Lenis from 'lenis'
import 'lenis/dist/lenis.css'
import { prefersReducedMotion } from '@/lib/motion'

const LenisContext = createContext<Lenis | null>(null)

/** Instância do scroll suave (ou null com movimento reduzido). Use lenis?.scrollTo(alvo) para scroll programático. */
export const useLenis = () => useContext(LenisContext)

/** Scroll suave e "amanteigado" (tipo sites premiados) — desativado com prefers-reduced-motion. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const l = new Lenis({
      lerp: 0.11,
      wheelMultiplier: 0.95,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: true,
      anchors: false,
      allowNestedScroll: true,
      prevent: (node: HTMLElement) =>
        Boolean(node.closest?.('.leaflet-container, dialog, [data-lenis-prevent], [role="listbox"], [role="menu"]')),
    })
    setLenis(l)
    return () => {
      l.destroy()
      setLenis(null)
    }
  }, [])
  return <LenisContext.Provider value={lenis}>{children}</LenisContext.Provider>
}
