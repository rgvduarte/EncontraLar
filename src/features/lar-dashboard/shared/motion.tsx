/**
 * Movimento funcional do painel da instituição — pequeno, rápido e sempre ao serviço do estado:
 * números que contam, barras que enchem, linhas que saem e se reordenam, números que "rolam".
 * Só transform/opacity/filter; com prefers-reduced-motion tudo aparece logo no estado final.
 */
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { easeOut, prefersReducedMotion, useInView } from '@/lib/motion'
import { cn } from '@/lib/cn'

/** Curva das animações (a mesma das primitivas globais). */
export const EASE = 'cubic-bezier(.16,1,.3,1)'

/** element.animate() que respeita o movimento reduzido (devolve null quando não anima). */
export function animar(el: Element | null | undefined, frames: Keyframe[], opts: KeyframeAnimationOptions): Animation | null {
  if (!el || typeof el.animate !== 'function' || prefersReducedMotion()) return null
  return el.animate(frames, { easing: EASE, ...opts })
}

const inteiro = (n: number) => Math.round(n).toLocaleString('pt-PT')

/**
 * Número que conta a partir de 0 quando aparece e, depois, do valor anterior para o novo
 * (ex.: 3 → 4 lugares livres). O leitor de ecrã ouve sempre o valor final.
 */
export function Numero({
  value,
  format = inteiro,
  duration = 1200,
  className,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
}) {
  const [ref, inView] = useInView<HTMLSpanElement>()
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? value : 0))
  const atual = useRef(shown)
  const primeira = useRef(true)

  useEffect(() => {
    if (!inView) return
    const de = atual.current
    if (prefersReducedMotion() || de === value) {
      atual.current = value
      setShown(value)
      primeira.current = false
      return
    }
    const dur = primeira.current ? duration : 650
    primeira.current = false
    let raf = 0
    const t0 = performance.now()
    const passo = (t: number) => {
      const k = Math.min(1, (t - t0) / dur)
      const v = de + (value - de) * easeOut(k)
      atual.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(passo)
    }
    raf = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(raf)
  }, [inView, value, duration])

  return (
    <span ref={ref} className={cn('tabular', className)}>
      <span className="sr-only">{format(value)}</span>
      <span aria-hidden>{format(shown)}</span>
    </span>
  )
}

/** Barra fina (0–1) que enche quando aparece e desliza quando o valor muda (scaleX, sem reflow). */
export function Barra({
  value,
  label,
  className,
  fillClassName = 'bg-ink',
}: {
  value: number
  label?: string
  className?: string
  fillClassName?: string
}) {
  const [ref, inView] = useInView<HTMLDivElement>()
  const v = Math.max(0, Math.min(1, value))
  return (
    <div
      ref={ref}
      role={label ? 'meter' : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-valuenow={label ? Math.round(v * 100) : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('block h-1 w-full overflow-hidden rounded-full bg-sand-deep', className)}
    >
      <div
        className={cn(
          'h-full w-full origin-left rounded-full transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
          fillClassName,
        )}
        style={{ transform: `scaleX(${inView ? v : 0})` }}
      />
    </div>
  )
}

// ————————————————————————————————————————— número que "rola" (conta-quilómetros)

/**
 * Quando o valor muda, o número antigo sai para cima (ou para baixo) e o novo entra do lado oposto.
 * `wrap` = contentor (relative), `atual` = elemento com o valor, `fantasma` = cópia vazia por cima.
 */
export function useRolo<T extends HTMLElement>(value: number | string, direcao?: 1 | -1) {
  const wrap = useRef<HTMLSpanElement>(null)
  const atual = useRef<T>(null)
  const fantasma = useRef<HTMLSpanElement>(null)
  const prev = useRef(value)
  const vez = useRef(0)

  useLayoutEffect(() => {
    const de = prev.current
    prev.current = value
    if (de === value) return
    const w = wrap.current
    const n = atual.current
    const g = fantasma.current
    if (!w || !n || !g || prefersReducedMotion()) return
    const dir = direcao ?? (Number(value) > Number(de) ? 1 : -1)
    const id = ++vez.current
    g.textContent = String(de)
    // recorta só na vertical, e só durante a animação (o anel de foco nunca fica cortado)
    w.style.clipPath = 'inset(0 -16px)'
    const opts: KeyframeAnimationOptions = { duration: 420, easing: EASE }
    g.animate(
      [
        { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
        { transform: `translateY(${-dir * 75}%)`, opacity: 0, filter: 'blur(3px)' },
      ],
      { ...opts, fill: 'forwards' },
    )
    const a = n.animate(
      [
        { transform: `translateY(${dir * 75}%)`, opacity: 0, filter: 'blur(3px)' },
        { transform: 'translateY(0)', opacity: 1, filter: 'blur(0)' },
      ],
      opts,
    )
    const limpar = () => {
      if (vez.current !== id) return
      w.style.clipPath = ''
      g.textContent = ''
    }
    a.onfinish = limpar
    a.oncancel = limpar
  }, [value, direcao])

  return { wrap, atual, fantasma }
}

/** Número só de leitura que rola quando muda (ex.: total de lugares livres, posição na lista). */
export function Rolo({ value, className }: { value: number; className?: string }) {
  const { wrap, atual, fantasma } = useRolo<HTMLSpanElement>(value)
  return (
    <span ref={wrap} className={cn('relative inline-flex', className)}>
      <span ref={atual} className="inline-block">
        {value}
      </span>
      <span ref={fantasma} aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0" />
    </span>
  )
}

/** Pequeno "salto" quando o valor muda (contadores, etiquetas). */
export function useBump<T extends HTMLElement>(valor: unknown) {
  const ref = useRef<T>(null)
  const prev = useRef(valor)
  useEffect(() => {
    if (Object.is(prev.current, valor)) return
    prev.current = valor
    animar(ref.current, [{ transform: 'scale(1)' }, { transform: 'scale(1.32)', offset: 0.35 }, { transform: 'scale(1)' }], { duration: 480 })
  }, [valor])
  return ref
}

/** Anima a entrada do conteúdo quando `chave` muda (não na primeira montagem — a transição de página já trata disso). */
export function useTroca<T extends HTMLElement>(chave: unknown, frames?: Keyframe[], duration = 520) {
  const ref = useRef<T>(null)
  const prev = useRef(chave)
  useLayoutEffect(() => {
    if (Object.is(prev.current, chave)) return
    prev.current = chave
    animar(
      ref.current,
      frames ?? [
        { opacity: 0, transform: 'translateY(10px)', filter: 'blur(4px)' },
        { opacity: 1, transform: 'none', filter: 'blur(0)' },
      ],
      { duration },
    )
    // as frames só contam no momento da troca: a chave é o gatilho
  }, [chave, duration]) // eslint-disable-line
  return ref
}

/** Envolve um texto (ex.: título do cabeçalho) que entra suavemente quando muda de secção. */
export function Troca({ k, children, className }: { k: string; children: ReactNode; className?: string }) {
  const ref = useTroca<HTMLSpanElement>(k)
  return (
    <span ref={ref} className={cn('inline-block', className)}>
      {children}
    </span>
  )
}

// ————————————————————————————————————————— listas: saídas suaves e reordenação (FLIP)

export interface Presenca<T> {
  key: string
  item: T
  /** a sair: mantém-se no sítio enquanto desvanece */
  leaving: boolean
}

/**
 * Mantém por momentos os itens que saíram da lista, no lugar onde estavam, para poderem sair a desvanecer.
 * Combina com useFlip (que anima a saída e o deslizar dos restantes).
 */
export function usePresenca<T>(items: T[], keyOf: (t: T) => string, ms = 340): Presenca<T>[] {
  const ultimo = useRef(items)
  const assinatura = items.map(keyOf).join('\n')
  const [antes, setAntes] = useState(assinatura)
  const [saidos, setSaidos] = useState<{ key: string; item: T; index: number; after: string | null }[]>([])

  // derivado durante a renderização (padrão "estado da renderização anterior"): sem piscar
  if (assinatura !== antes) {
    const agora = new Set(items.map(keyOf))
    const prev = ultimo.current
    const removidos = prefersReducedMotion()
      ? []
      : prev.flatMap((it, i) =>
          agora.has(keyOf(it)) ? [] : [{ key: keyOf(it), item: it, index: i, after: i > 0 ? keyOf(prev[i - 1]!) : null }],
        )
    setAntes(assinatura)
    setSaidos((s) => [...s.filter((x) => !agora.has(x.key) && !removidos.some((r) => r.key === x.key)), ...removidos])
  }

  useLayoutEffect(() => {
    ultimo.current = items
  })

  useEffect(() => {
    if (!saidos.length) return
    const t = setTimeout(() => setSaidos([]), ms)
    return () => clearTimeout(t)
  }, [saidos, ms])

  const out: Presenca<T>[] = items.map((item) => ({ key: keyOf(item), item, leaving: false }))
  for (const s of saidos) {
    if (out.some((o) => o.key === s.key)) continue
    const depois = s.after == null ? -1 : out.findIndex((o) => o.key === s.after)
    const at = s.after == null ? 0 : depois >= 0 ? depois + 1 : Math.min(s.index, out.length)
    out.splice(at, 0, { key: s.key, item: s.item, leaving: true })
  }
  return out
}

/**
 * FLIP para listas: os filhos com data-flip="<chave>" deslizam da posição antiga para a nova quando a
 * lista muda; os que têm data-leaving="true" desvanecem e encolhem ligeiramente. A lista deve ser `relative`.
 */
export function useFlip(ref: RefObject<HTMLElement | null>, presencas: Presenca<unknown>[]) {
  const pos = useRef<Map<string, number> | null>(null)
  const assinatura = presencas.map((p) => `${p.key}${p.leaving ? '·' : ''}`).join('\n')
  const ultima = useRef(assinatura)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const antes = pos.current
    const mudou = ultima.current !== assinatura
    ultima.current = assinatura
    const agora = new Map<string, number>()
    const reduzido = prefersReducedMotion()
    for (const k of Array.from(el.children) as HTMLElement[]) {
      const key = k.dataset.flip
      if (!key) continue
      const top = k.offsetTop
      agora.set(key, top)
      if (!antes || !mudou || reduzido) continue
      if (k.dataset.leaving === 'true') {
        if (k.dataset.saiu !== '1') {
          k.dataset.saiu = '1'
          k.animate(
            [
              { opacity: 1, transform: 'none' },
              { opacity: 0, transform: 'translateX(-14px) scale(0.98)' },
            ],
            { duration: 280, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
          )
        }
        continue
      }
      const de = antes.get(key)
      if (de != null && Math.abs(de - top) > 1) {
        k.animate([{ transform: `translateY(${de - top}px)` }, { transform: 'none' }], { duration: 560, easing: EASE })
      }
    }
    pos.current = agora
  })
}

// ————————————————————————————————————————— visto animado

/** Visto que se desenha (círculo + traço). Decorativo. */
export function VistoAnimado({ className, delay = 0 }: { className?: string; delay?: number }) {
  const circulo = useRef<SVGCircleElement>(null)
  const traco = useRef<SVGPathElement>(null)
  const caixa = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    animar(caixa.current, [{ transform: 'scale(0.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 520, delay, fill: 'backwards' })
    animar(circulo.current, [{ strokeDashoffset: 152 }, { strokeDashoffset: 0 }], { duration: 640, delay, fill: 'backwards' })
    animar(traco.current, [{ strokeDashoffset: 40 }, { strokeDashoffset: 0 }], { duration: 420, delay: delay + 320, fill: 'backwards' })
  }, [delay])
  return (
    <svg ref={caixa} viewBox="0 0 52 52" aria-hidden className={cn('shrink-0 text-leaf-600', className)}>
      <circle ref={circulo} cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="152" strokeDashoffset="0" />
      <path
        ref={traco}
        d="M15 27l7 7 15-16"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="40"
        strokeDashoffset="0"
      />
    </svg>
  )
}
