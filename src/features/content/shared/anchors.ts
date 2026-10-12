/**
 * Âncoras dentro da página com o HashRouter.
 *
 * Com createHashRouter, o URL "/#/guia#apoios" chega ao router como pathname "/guia" e hash "#apoios".
 * Um <a href="#apoios"> mudaria a rota, por isso a navegação interna faz scroll com scrollIntoView
 * (ou com o scroll suave da app, se estiver ativo) e atualiza o hash pelo router, sem encher o histórico.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLenis } from '@/components/motion/SmoothScroll'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hash depois do segundo "#" em window.location (ex.: "#/guia#apoios" → "apoios"). */
function hashFromWindow(): string {
  if (typeof window === 'undefined') return ''
  const raw = window.location.hash
  const i = raw.indexOf('#', 1)
  return i >= 0 ? raw.slice(i + 1) : ''
}

type Scroller = { scrollTo: (target: HTMLElement, opts?: { immediate?: boolean }) => void } | null

/** Faz scroll até ao elemento com este id. Devolve false se ainda não existir. */
function scrollToId(id: string, lenis: Scroller, { smooth = true, focus = true } = {}): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  const animate = smooth && !reducedMotion()
  if (lenis) lenis.scrollTo(el, { immediate: !animate })
  else el.scrollIntoView({ behavior: animate ? 'smooth' : 'auto', block: 'start' })
  if (focus) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: true })
  }
  return true
}

/**
 * Faz scroll para o hash ao abrir a página (ou quando muda por uma ligação externa, ex.: rodapé →
 * "/sobre#previsao") e devolve `goTo(id)` para índices e botões dentro da página.
 */
export function useAnchorNavigation(validIds?: readonly string[]) {
  const location = useLocation()
  const navigate = useNavigate()
  const lenis = useLenis()
  const skip = useRef<string | null>(null)

  useEffect(() => {
    const id = decodeURIComponent((location.hash || `#${hashFromWindow()}`).replace(/^#/, ''))
    if (!id || (validIds && !validIds.includes(id))) return
    if (skip.current === id) {
      skip.current = null
      return
    }
    // O Layout volta ao topo depois de os filhos montarem e a página é carregada de forma diferida:
    // esperamos um instante e repetimos quando as fontes acabam de carregar (a altura muda).
    let cancelled = false
    let tries = 0
    let timer = 0
    const attempt = () => {
      if (cancelled) return
      if (scrollToId(id, lenis, { smooth: false, focus: false }) || tries++ > 30) return
      timer = window.setTimeout(attempt, 50)
    }
    timer = window.setTimeout(attempt, 80)
    const started = Date.now()
    document.fonts?.ready.then(() => {
      if (!cancelled && Date.now() - started < 2000)
        window.setTimeout(() => !cancelled && scrollToId(id, lenis, { smooth: false, focus: false }), 30)
    })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash])

  const goTo = useCallback(
    (id: string) => {
      scrollToId(id, lenis)
      if (location.hash !== `#${id}`) {
        skip.current = id
        navigate({ pathname: location.pathname, search: location.search, hash: id }, { replace: true, preventScrollReset: true })
      }
    },
    [lenis, location.hash, location.pathname, location.search, navigate],
  )

  return { goTo, pathname: location.pathname }
}

/**
 * Scroll-spy: devolve o id da última secção cujo topo já passou a linha de leitura
 * (por baixo do cabeçalho fixo).
 */
export function useScrollSpy(ids: readonly string[], offset = 180): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join('|')

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      let current: string | null = null
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top - offset <= 0) current = id
      }
      // no fim da página, a última secção fica ativa mesmo que seja curta
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      const last = ids[ids.length - 1]
      if (nearBottom && last) {
        const lastEl = document.getElementById(last)
        if (lastEl && lastEl.getBoundingClientRect().top < window.innerHeight) current = last
      }
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, offset])

  return active
}
