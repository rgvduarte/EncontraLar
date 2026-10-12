import { useEffect, useState, type RefObject } from 'react'

/**
 * Scroll-spy: devolve o id da última secção cujo topo já passou a linha `offset` (px a partir do topo).
 * No fim da página, a última secção fica ativa.
 */
export function useScrollSpy(ids: readonly string[], offset = 180): string {
  const [ativo, setAtivo] = useState<string>(ids[0] ?? '')
  const chave = ids.join('|')

  useEffect(() => {
    const lista = chave.split('|')
    let raf = 0
    const atualizar = () => {
      raf = 0
      let atual = lista[0] ?? ''
      for (const id of lista) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top - offset <= 0) atual = id
      }
      setAtivo(atual)
    }
    const agendar = () => {
      if (!raf) raf = requestAnimationFrame(atualizar)
    }
    atualizar()
    window.addEventListener('scroll', agendar, { passive: true })
    window.addEventListener('resize', agendar)
    return () => {
      if (raf) cancelAnimationFrame(raf)
      window.removeEventListener('scroll', agendar)
      window.removeEventListener('resize', agendar)
    }
  }, [chave, offset])

  return ativo
}

/** true enquanto o elemento estiver (parcialmente) visível no ecrã. */
export function useInView(ref: RefObject<Element | null>, rootMargin = '0px'): boolean {
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisivel(Boolean(e?.isIntersecting)), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin])
  return visivel
}

/**
 * `top` para um elemento sticky que pode ser mais alto do que o ecrã: se couber, fica a `base` px do topo;
 * se não couber, cola pelo fundo (top negativo), para que nunca fique uma parte inalcançável.
 */
export function useStickyTop(ref: RefObject<HTMLElement | null>, base = 96, margem = 16): number {
  const [top, setTop] = useState(base)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const calcular = () => setTop(Math.min(base, window.innerHeight - el.offsetHeight - margem))
    calcular()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(calcular) : null
    ro?.observe(el)
    window.addEventListener('resize', calcular)
    return () => {
      ro?.disconnect()
      window.removeEventListener('resize', calcular)
    }
  }, [ref, base, margem])
  return top
}
