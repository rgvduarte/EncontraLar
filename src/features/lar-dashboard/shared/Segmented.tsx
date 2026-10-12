import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { animar, useBump } from './motion'

export interface Segmento<T extends string> {
  id: T
  label: string
  /** contador ao lado do nome (salta quando muda) */
  n?: number
  /** contador em azul (ex.: pedidos novos por ler) */
  destaque?: boolean
}

function Contagem({ n, destaque, ativo }: { n: number; destaque?: boolean; ativo: boolean }) {
  const ref = useBump<HTMLSpanElement>(n)
  return (
    <span ref={ref} className={cn('inline-block tabular', destaque && n > 0 ? 'font-semibold text-terra-600' : ativo ? 'text-ink-soft' : 'text-ink-mute')}>
      {n}
    </span>
  )
}

/**
 * Controlo segmentado estilo iOS: a "pílula" branca desliza até ao segmento escolhido.
 * No telemóvel a faixa desliza na horizontal (com snap) e o segmento ativo vem sempre para o centro;
 * as margens esbatem quando há mais segmentos para um dos lados.
 */
export function Segmented<T extends string>({
  itens,
  valor,
  onChange,
  label,
  className,
}: {
  itens: Segmento<T>[]
  valor: T
  onChange: (v: T) => void
  /** rótulo acessível do grupo */
  label: string
  className?: string
}) {
  const faixa = useRef<HTMLDivElement>(null)
  const trilho = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ x: number; w: number } | null>(null)
  const [bordas, setBordas] = useState({ e: false, d: false })
  const montado = useRef(false)
  const contagens = itens.map((i) => i.n ?? '').join(',')

  const medirBordas = useCallback(() => {
    const s = faixa.current
    if (!s) return
    const e = s.scrollLeft > 4
    const d = s.scrollLeft + s.clientWidth < s.scrollWidth - 4
    setBordas((b) => (b.e === e && b.d === d ? b : { e, d }))
  }, [])

  const medir = useCallback(() => {
    const b = trilho.current?.querySelector<HTMLElement>(`[data-seg="${valor}"]`)
    if (b) setInd((i) => (i && i.x === b.offsetLeft && i.w === b.offsetWidth ? i : { x: b.offsetLeft, w: b.offsetWidth }))
    medirBordas()
  }, [valor, medirBordas])

  useLayoutEffect(medir, [medir, contagens])

  useEffect(() => {
    const t = trilho.current
    if (!t || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => medir())
    ro.observe(t)
    document.fonts?.ready.then(medir).catch(() => {})
    return () => ro.disconnect()
  }, [medir])

  // o segmento ativo vem para o centro da faixa (só mexe no scroll horizontal da faixa, nunca na página)
  useEffect(() => {
    const s = faixa.current
    const b = trilho.current?.querySelector<HTMLElement>(`[data-seg="${valor}"]`)
    const primeiro = !montado.current
    montado.current = true
    if (!s || !b || s.scrollWidth <= s.clientWidth) return
    const sr = s.getBoundingClientRect()
    const br = b.getBoundingClientRect()
    const left = s.scrollLeft + (br.left - sr.left) - (s.clientWidth - br.width) / 2
    s.scrollTo({ left: Math.max(0, left), behavior: primeiro || prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [valor])

  const mascara =
    bordas.e || bordas.d
      ? `linear-gradient(to right, ${bordas.e ? 'transparent 0, #000 2.25rem' : '#000 0'}, ${bordas.d ? '#000 calc(100% - 2.75rem), transparent 100%' : '#000 100%'})`
      : undefined

  return (
    <div className={cn('-mx-5 sm:mx-0', className)}>
      <div
        ref={faixa}
        role="group"
        aria-label={label}
        data-lenis-prevent
        onScroll={medirBordas}
        className="snap-x scroll-px-5 overflow-x-auto overscroll-x-contain px-5 [scrollbar-width:none] sm:px-0 [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: mascara, WebkitMaskImage: mascara }}
      >
        <div ref={trilho} className="relative inline-flex gap-1 rounded-full bg-sand p-1">
          {ind && (
            <span
              aria-hidden
              className="absolute top-1 bottom-1 left-0 rounded-full bg-white shadow-soft transition-[transform,width] duration-[460ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
              style={{ width: ind.w, transform: `translateX(${ind.x}px)` }}
            />
          )}
          {itens.map((it) => {
            const ativo = it.id === valor
            return (
              <button
                key={it.id}
                type="button"
                data-seg={it.id}
                aria-pressed={ativo}
                onClick={(e) => {
                  if (ativo) return
                  animar(e.currentTarget, [{ transform: 'scale(0.96)' }, { transform: 'scale(1)' }], { duration: 260 })
                  onChange(it.id)
                }}
                className={cn(
                  'relative inline-flex min-h-12 shrink-0 snap-start items-center gap-2 rounded-full px-5 text-[0.9375rem] font-medium whitespace-nowrap transition-colors duration-200',
                  ativo ? 'text-ink' : 'text-ink-mute hover:text-ink',
                  ativo && !ind && 'bg-white shadow-soft',
                )}
              >
                {it.label}
                {it.n != null && <Contagem n={it.n} destaque={it.destaque} ativo={ativo} />}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
