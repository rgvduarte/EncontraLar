import { useCallback, useEffect, useState, type RefObject } from 'react'
import { useLenis } from '@/components/motion/SmoothScroll'
import { subscribeScroll } from '@/lib/motion'
import { prefereMenosMovimento } from './helpers'

/**
 * Scroll-spy: devolve o id da última secção cujo topo já passou a linha `offset` (px a partir do topo).
 * Antes da primeira secção devolve '' (nenhuma ativa).
 */
export function useScrollSpy(ids: readonly string[], offset = 180): string {
  const [ativo, setAtivo] = useState<string>('')
  const chave = ids.join('|')

  useEffect(() => {
    const lista = chave.split('|')
    let raf = 0
    const atualizar = () => {
      raf = 0
      let atual = ''
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

/**
 * true enquanto o elemento estiver (parcialmente) visível no ecrã.
 * `chave` volta a observar quando o elemento do ref é substituído (ex.: o cartão troca de estado).
 */
export function useInView(ref: RefObject<Element | null>, rootMargin = '0px', chave?: string): boolean {
  const [visivel, setVisivel] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setVisivel(Boolean(e?.isIntersecting)), { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin, chave])
  return visivel
}

/**
 * true quando o topo do elemento já entrou no ecrã (com `margem` px de antecedência) ou ficou para trás —
 * ex.: "já chegámos ao fim da ficha", que continua verdadeiro enquanto se lê o rodapé.
 * Mede a posição a cada scroll (e quando a página muda de altura) em vez de usar um IntersectionObserver:
 * um salto direto ao fundo (tecla End, scroll programático, leitor de ecrã) passa por cima de uma sentinela
 * sem nunca a "intersetar", e o observador não chegava a avisar.
 */
export function useJaPassou(ref: RefObject<Element | null>, margem = 0): boolean {
  const [passou, setPassou] = useState(false)
  useEffect(() => {
    const medir = () => {
      const el = ref.current
      if (el) setPassou(el.getBoundingClientRect().top < window.innerHeight + margem)
    }
    const sair = subscribeScroll(medir)
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(document.body)
    return () => {
      sair()
      ro?.disconnect()
    }
  }, [ref, margem])
  return passou
}

/**
 * Passa a true (e fica) quando o elemento chega perto do ecrã — para montar tarde o que é pesado (ex.: o mapa).
 * Observador próprio: o useInView de lib/motion devolve true logo à entrada com movimento reduzido.
 */
export function useJaPerto(ref: RefObject<Element | null>, rootMargin = '800px 0px'): boolean {
  const [perto, setPerto] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (perto || !el) return
    const io = new IntersectionObserver(([e]) => {
      if (e?.isIntersecting) setPerto(true)
    }, { rootMargin })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, rootMargin, perto])
  return perto
}

/**
 * `top` para um elemento sticky que pode ser mais alto do que o ecrã: se couber, fica a `base` px do topo;
 * se não couber, cola pelo fundo (top negativo), para que nunca fique uma parte inalcançável.
 */
export function useStickyTop(ref: RefObject<HTMLElement | null>, base = 140, margem = 16): number {
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

/**
 * Desloca até uma secção da ficha e coloca lá o foco. Usa o scroll suave global (Lenis) quando existe;
 * sem ele, scrollIntoView. Nunca '#id' — colide com o HashRouter.
 */
export function useIrParaSecao(): (id: string) => void {
  const lenis = useLenis()
  return useCallback(
    (id: string) => {
      const el = document.getElementById(id)
      if (!el) return
      // ambos respeitam o scroll-margin-top da secção (scroll-mt-36: cabeçalho + navegação da ficha)
      if (lenis) lenis.scrollTo(el, { duration: 1.1 })
      else el.scrollIntoView({ behavior: prefereMenosMovimento() ? 'auto' : 'smooth', block: 'start' })
      el.focus({ preventScroll: true })
    },
    [lenis],
  )
}
