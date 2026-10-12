import { useEffect, useState, type KeyboardEvent, type RefObject } from 'react'
import { useLenis } from '@/components/motion'
import { prefersReducedMotion } from '@/lib/motion'

const SEM_TECLADO = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image', 'hidden'])

/** Campo que abre o teclado do telemóvel (ou a roda de opções, no caso de <select> no iPhone). */
export function abreTeclado(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement {
  if (el instanceof HTMLInputElement) return !SEM_TECLADO.has(el.type)
  return el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
}

const visivel = (el: HTMLElement) => el.getClientRects().length > 0 && !el.closest('[inert]')

/** Controlos de formulário visíveis e ativos, pela ordem do documento. */
export function controlos(root: ParentNode): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'),
  ).filter(visivel)
}

/**
 * Tecla Enter (no telemóvel: "seguinte"/"OK" do teclado) ao estilo iOS, de campo em campo:
 * - enterKeyHint="next" → passa ao campo seguinte; no último, chama `noFim` (ex.: "Continuar");
 * - enterKeyHint="done" → fecha o teclado;
 * - "go"/"send" → submissão normal do formulário.
 * Respeita quem já tratou o Enter (ex.: escolher uma sugestão na lista de localidades).
 */
export function enterAvanca(e: KeyboardEvent<HTMLFormElement>, noFim?: () => void) {
  if (e.key !== 'Enter' || e.defaultPrevented || e.nativeEvent.isComposing || e.shiftKey) return
  const t = e.target
  if (!(t instanceof HTMLInputElement) || !abreTeclado(t)) return
  const hint = t.enterKeyHint || t.getAttribute('enterkeyhint')
  if (hint === 'next') {
    e.preventDefault()
    const lista = controlos(e.currentTarget)
    const seguinte = lista[lista.indexOf(t) + 1]
    if (seguinte && abreTeclado(seguinte)) seguinte.focus()
    else if (noFim) noFim()
    else if (seguinte) seguinte.focus()
    else t.blur()
  } else if (hint === 'done') {
    e.preventDefault()
    t.blur()
  }
}

const toque = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

/**
 * true enquanto, num ecrã tátil, um campo de texto tem o foco (o teclado está, muito provavelmente, aberto).
 * Serve para recolher a barra de ação fixa no fundo, que de outro modo ficaria por cima do teclado/campos.
 */
export function useTecladoAberto(): boolean {
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    let t = 0
    const atualizar = () => {
      window.clearTimeout(t)
      // ao saltar de campo em campo há um instante sem foco: esperar evita a barra "piscar"
      t = window.setTimeout(() => setAberto(toque() && abreTeclado(document.activeElement)), 60)
    }
    document.addEventListener('focusin', atualizar)
    document.addEventListener('focusout', atualizar)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('focusin', atualizar)
      document.removeEventListener('focusout', atualizar)
    }
  }, [])
  return aberto
}

/**
 * Mantém o campo com foco visível por cima do teclado do telemóvel (e abaixo do cabeçalho fixo):
 * depois de o teclado abrir (o visualViewport encolhe), se o campo ficou tapado, desliza-o para ~30% da
 * área visível. Só em ecrãs táteis; o navegador continua a fazer o seu próprio ajuste quando chega.
 */
export function useCampoVisivel(root: RefObject<HTMLElement | null>) {
  const lenis = useLenis()
  useEffect(() => {
    const el = root.current
    const vv = window.visualViewport
    if (!el || !vv || !toque()) return
    let t = 0
    const verificar = () => {
      const f = document.activeElement
      if (!(f instanceof HTMLElement) || !el.contains(f) || !abreTeclado(f)) return
      const r = f.getBoundingClientRect()
      const topo = vv.offsetTop + 80 // cabeçalho (4rem) + folga
      const fundo = vv.offsetTop + vv.height - 16
      if (r.top >= topo && r.bottom <= fundo) return
      const delta = r.top - (vv.offsetTop + vv.height * 0.3)
      const y = window.scrollY + delta
      if (lenis && !prefersReducedMotion()) lenis.scrollTo(y, { duration: 0.5 })
      else window.scrollTo({ top: y, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
    const agendar = () => {
      window.clearTimeout(t)
      t = window.setTimeout(verificar, 320)
    }
    el.addEventListener('focusin', agendar)
    vv.addEventListener('resize', agendar)
    return () => {
      window.clearTimeout(t)
      el.removeEventListener('focusin', agendar)
      vv.removeEventListener('resize', agendar)
    }
  }, [root, lenis])
}
