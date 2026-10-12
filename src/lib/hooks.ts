import { createElement, Fragment, useEffect, useState, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

/** Define o título do separador: "Título · EncontraLar". */
export function useDocumentTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · EncontraLar` : 'EncontraLar — Lares e residências seniores com vagas reais'
  }, [title])
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatches(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return matches
}

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

/** Fecha algo ao clicar fora ou ao carregar em Esc. */
export function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, ref, onClose])
}

/**
 * Pede confirmação antes de sair de um formulário com alterações por guardar: ao mudar de página
 * dentro da app (barra lateral, pílulas, barra de abas) mostra "Sair sem guardar?", e ao fechar ou
 * recarregar o separador usa o aviso do navegador. Mudanças só de `?query` (ex.: trocar de perfil
 * com `?id=`) não são bloqueadas.
 *
 * Devolve o diálogo, para pôr na página: `const aviso = useConfirmarSaida(sujo)` … `{aviso}`.
 */
export function useConfirmarSaida(sujo: boolean): ReactNode {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => sujo && currentLocation.pathname !== nextLocation.pathname)

  useEffect(() => {
    if (!sujo) return
    const aviso = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [sujo])

  // se as alterações forem guardadas com o diálogo aberto, deixa seguir
  useEffect(() => {
    if (blocker.state === 'blocked' && !sujo) blocker.proceed()
  }, [blocker, sujo])

  const ficar = () => {
    if (blocker.state === 'blocked') blocker.reset()
  }
  const sair = () => {
    if (blocker.state === 'blocked') blocker.proceed()
  }
  return createElement(Modal, {
    open: blocker.state === 'blocked',
    onClose: ficar,
    title: 'Sair sem guardar?',
    footer: createElement(
      Fragment,
      null,
      createElement(Button, { variant: 'subtle', onClick: ficar }, 'Continuar a editar'),
      createElement(Button, { variant: 'primary', onClick: sair }, 'Descartar alterações'),
    ),
    children: createElement('p', { className: 'text-ink-soft' }, 'As alterações que fez ainda não foram guardadas. Se sair agora, perdem-se.'),
  })
}
