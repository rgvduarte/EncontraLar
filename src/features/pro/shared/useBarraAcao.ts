import { useEffect, type RefObject } from 'react'

/**
 * Barra de ação presa ao fundo: enquanto está ativa, define --actionbar-h no <html> (altura + afastamento)
 * para os avisos (Toaster) aparecerem por cima dela em vez de a taparem (docs/DESIGN.md §10).
 */
export function useBarraAcao(ref: RefObject<HTMLElement | null>, ativa: boolean) {
  useEffect(() => {
    const el = ref.current
    if (!el || !ativa) return
    const root = document.documentElement
    const aplicar = () => root.style.setProperty('--actionbar-h', `${el.offsetHeight + 12}px`)
    aplicar()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(aplicar) : null
    ro?.observe(el)
    return () => {
      ro?.disconnect()
      root.style.removeProperty('--actionbar-h')
    }
  }, [ref, ativa])
}
