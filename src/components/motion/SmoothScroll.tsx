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

/** Barras presas por baixo do cabeçalho (o foco do teclado tem de parar abaixo delas). */
const BARRAS_FIXAS = '.sticky.top-16.z-\\[900\\], [data-barra-fixa]'

/** Scroll suave e "amanteigado" (tipo sites premiados) — desativado com prefers-reduced-motion. */
export function SmoothScroll({ children }: { children: ReactNode }) {
  const [lenis, setLenis] = useState<Lenis | null>(null)

  // "modo teclado": enquanto se navega com o Tab, o <html> ganha scroll-padding-top (index.css) e o elemento focado
  // nunca fica por baixo do cabeçalho fixo nem das barras presas por baixo dele; um toque ou clique tira-o
  // (as âncoras com rato/dedo não mudam)
  useEffect(() => {
    const html = document.documentElement
    let barraAtual = ''
    const teclado = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      html.dataset.teclado = ''
      // barras da página presas por baixo do cabeçalho: camada 900 com top-16 (DESIGN §9) ou data-barra-fixa
      let extra = 0
      for (const b of document.querySelectorAll<HTMLElement>(BARRAS_FIXAS)) {
        if (b.getClientRects().length) extra = Math.max(extra, b.offsetHeight)
      }
      const valor = `${extra}px`
      if (valor !== barraAtual) {
        barraAtual = valor
        html.style.setProperty('--barra-fixa', valor)
      }
    }
    const ponteiro = () => {
      delete html.dataset.teclado
    }
    document.addEventListener('keydown', teclado, true)
    document.addEventListener('pointerdown', ponteiro, true)
    return () => {
      document.removeEventListener('keydown', teclado, true)
      document.removeEventListener('pointerdown', ponteiro, true)
      delete html.dataset.teclado
      html.style.removeProperty('--barra-fixa')
    }
  }, [])

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
      // os mapas Leaflet NÃO entram aqui: com zoom pela roda (pesquisa), o próprio Leaflet trava a propagação do
      // evento; sem ele (ficha do lar), a roda por cima do mapa deve mover a página com o mesmo scroll suave —
      // ignorá-la aqui perdia parte do movimento (a animação em curso do Lenis sobrepunha-se ao scroll nativo).
      prevent: (node: HTMLElement) => Boolean(node.closest?.('dialog, [data-lenis-prevent], [role="listbox"], [role="menu"]')),
    })
    // O Lenis subtrai o scroll-padding-top do <html> a cada scrollTo(elemento). Esse padding só existe para o foco do
    // teclado (index.css) e as secções já têm scroll-mt-*: devolve-se aqui, para as âncoras ficarem onde sempre ficaram.
    const scrollTo = l.scrollTo.bind(l)
    const PALAVRAS = ['top', 'left', 'start', 'bottom', 'right', 'end', '#']
    const resolver = (alvo: string): Element | null => {
      if (PALAVRAS.includes(alvo)) return null
      if (alvo.startsWith('#')) return document.getElementById(alvo.slice(1))
      try {
        return document.querySelector(alvo)
      } catch {
        return null
      }
    }
    l.scrollTo = (alvo, opcoes = {}) => {
      const no = typeof alvo === 'string' ? resolver(alvo) : alvo
      if (no instanceof HTMLElement) {
        const pad = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0
        return scrollTo(no, { ...opcoes, offset: (opcoes.offset ?? 0) + pad })
      }
      return scrollTo(alvo, opcoes)
    }
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
