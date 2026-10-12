/**
 * Movimento funcional da pesquisa (subtil, estilo app): contagens que deslizam, entradas/saídas
 * com presença, e cartões da lista que se revelam ao entrar no ecrã. Tudo respeita
 * prefers-reduced-motion (estado final imediato). As animações em si estão em search.css.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { easeOut, prefersReducedMotion } from '@/lib/motion'

/** Número que desliza do valor anterior para o novo (ex.: "162 → 46 instituições"). */
export function useNumeroAnimado(valor: number, ms = 560): number {
  const [n, setN] = useState(valor)
  const atual = useRef(valor)
  useEffect(() => {
    const de = atual.current
    if (de === valor) return
    if (prefersReducedMotion()) {
      atual.current = valor
      setN(valor)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const v = de + (valor - de) * easeOut(k)
      atual.current = k === 1 ? valor : v
      setN(Math.round(v))
      if (k < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [valor, ms])
  return n
}

/**
 * Mantém um elemento montado durante a animação de saída.
 * `item` é o último valor presente; `saindo` fica true durante `ms` depois de `valor` passar a null.
 */
export function useSaida<T>(valor: T | null | undefined, ms = 260): { item: T | undefined; saindo: boolean } {
  const presente = valor != null
  const [ultimo, setUltimo] = useState<T | undefined>(valor ?? undefined)
  // guardar o último valor presente (padrão "estado a partir do render anterior")
  if (presente && valor !== ultimo) setUltimo(valor)
  useEffect(() => {
    if (presente || ultimo === undefined) return
    if (prefersReducedMotion()) {
      setUltimo(undefined)
      return
    }
    const t = window.setTimeout(() => setUltimo(undefined), ms)
    return () => window.clearTimeout(t)
  }, [presente, ultimo, ms])
  return { item: presente ? valor : ultimo, saindo: !presente && ultimo !== undefined }
}

export interface Presente<T> {
  key: string
  item: T
  saindo: boolean
}

/** Lista com saídas animadas: os itens retirados ficam `ms` no lugar onde estavam, marcados como `saindo`. */
export function usePresenca<T>(itens: T[], chave: (t: T) => string, ms = 220): Presente<T>[] {
  const assinatura = itens.map(chave).join('\u0001')
  const [vistos, setVistos] = useState<Presente<T>[]>(() => itens.map((item) => ({ key: chave(item), item, saindo: false })))
  const latest = useRef(itens)
  latest.current = itens

  useLayoutEffect(() => {
    setVistos((prev) => {
      const agora = latest.current.map((item) => ({ key: chave(item), item, saindo: false }))
      if (prefersReducedMotion()) return agora
      const chaves = new Set(agora.map((p) => p.key))
      prev.forEach((p, i) => {
        if (!chaves.has(p.key)) agora.splice(Math.min(i, agora.length), 0, { ...p, saindo: true })
      })
      return agora
    })
    // a assinatura resume as chaves; `chave` é estável por convenção
  }, [assinatura]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!vistos.some((v) => v.saindo)) return
    const t = window.setTimeout(() => setVistos((prev) => prev.filter((v) => !v.saindo)), ms)
    return () => window.clearTimeout(t)
  }, [vistos, ms])

  // conteúdo sempre atualizado (ex.: "Até 1200 €" → "Até 1500 €" mantém a mesma chave)
  return useMemo(() => {
    const atual = new Map(itens.map((i) => [chave(i), i]))
    return vistos.map((v) => (atual.has(v.key) ? { ...v, item: atual.get(v.key)!, saindo: false } : v))
  }, [vistos, itens, chave])
}

/** true quando o movimento está permitido e o navegador sabe observar interseções. */
export function podeAnimar(): boolean {
  return typeof window !== 'undefined' && !prefersReducedMotion() && 'IntersectionObserver' in window
}

/**
 * Cartões da lista que entram no ecrã (fade + leve subida), escalonados por "lote":
 * os que aparecem juntos (ao carregar, ao mudar filtros, ao fazer scroll, "Mostrar mais") entram em cascata.
 * Os itens marcam-se com data-item; o contentor com data-revelar (só quando podeAnimar()).
 */
export function useRevelarItens(ref: RefObject<HTMLElement | null>, deps: readonly unknown[], passo = 70) {
  useEffect(() => {
    const raiz = ref.current
    if (!raiz || !raiz.hasAttribute('data-revelar')) return
    const io = new IntersectionObserver(
      (entries) => {
        const novos = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        novos.forEach((e, i) => {
          const el = e.target as HTMLElement
          el.style.setProperty('--d', `${Math.min(i, 5) * passo}ms`)
          el.classList.add('is-in')
          io.unobserve(el)
        })
      },
      { rootMargin: '0px 0px -6% 0px' },
    )
    raiz.querySelectorAll<HTMLElement>('[data-item]:not(.is-in)').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
