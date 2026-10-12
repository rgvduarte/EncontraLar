/**
 * Âncoras dentro da página com o HashRouter.
 *
 * Com createHashRouter, o URL "/#/guia#apoios" chega ao router como pathname "/guia" e hash "#apoios".
 * Um <a href="#apoios"> mudaria a rota, por isso a navegação interna faz scroll com scrollIntoView
 * e atualiza o hash através do router (com replace, para não encher o histórico).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Hash depois do segundo "#" em window.location (ex.: "#/guia#apoios" → "apoios"). */
function hashFromWindow(): string {
  if (typeof window === 'undefined') return ''
  const raw = window.location.hash
  const i = raw.indexOf('#', 1)
  return i >= 0 ? raw.slice(i + 1) : ''
}

/** Faz scroll até ao elemento com este id. Devolve false se ainda não existir. */
export function scrollToId(id: string, { smooth = true, focus = true }: { smooth?: boolean; focus?: boolean } = {}): boolean {
  const el = document.getElementById(id)
  if (!el) return false
  el.scrollIntoView({ behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto', block: 'start' })
  if (focus) {
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1')
    el.focus({ preventScroll: true })
  }
  return true
}

/**
 * Navegação por âncoras numa página: faz scroll para o hash ao abrir (ou quando muda por uma
 * ligação externa, ex.: rodapé → "/guia#apoios") e devolve `goTo(id)` para o índice.
 */
export function useAnchorNavigation(validIds?: readonly string[]) {
  const location = useLocation()
  const navigate = useNavigate()
  const skip = useRef<string | null>(null)

  useEffect(() => {
    const id = decodeURIComponent((location.hash || `#${hashFromWindow()}`).replace(/^#/, ''))
    if (!id) return
    if (validIds && !validIds.includes(id)) return
    if (skip.current === id) {
      skip.current = null
      return
    }
    // O Layout faz scroll para o topo depois de os filhos montarem, e o conteúdo é carregado
    // de forma diferida — esperamos um instante e repetimos depois de as fontes carregarem.
    let cancelled = false
    let tries = 0
    let timer = 0
    const attempt = () => {
      if (cancelled) return
      if (scrollToId(id, { smooth: false, focus: false }) || tries++ > 30) return
      timer = window.setTimeout(attempt, 50)
    }
    timer = window.setTimeout(attempt, 80)
    const started = Date.now()
    document.fonts?.ready.then(() => {
      if (!cancelled && Date.now() - started < 2000) window.setTimeout(() => !cancelled && scrollToId(id, { smooth: false, focus: false }), 30)
    })
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash])

  const goTo = useCallback(
    (id: string) => {
      scrollToId(id)
      if (location.hash !== `#${id}`) {
        skip.current = id
        navigate({ pathname: location.pathname, search: location.search, hash: id }, { replace: true, preventScrollReset: true })
      }
    },
    [location.hash, location.pathname, location.search, navigate],
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
        if (!el) continue
        if (el.getBoundingClientRect().top - offset <= 0) current = id
      }
      // no fim da página, a última secção fica ativa mesmo que seja curta
      const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4
      if (nearBottom && ids.length) {
        const last = ids[ids.length - 1]!
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
