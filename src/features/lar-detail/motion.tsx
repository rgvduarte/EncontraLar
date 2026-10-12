/**
 * Movimento local da ficha (complementa src/components/motion). Os estilos vivem em ficha.css:
 * o estado "escondido" só se aplica sem [data-in] e com prefers-reduced-motion: no-preference.
 */
import { useLayoutEffect, useRef, type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from 'react'
import { CountUp } from '@/components/motion'
import { useInView } from '@/lib/motion'
import { cn } from '@/lib/cn'

/** Dispara quando o topo do bloco passa ~88% da altura do ecrã (funciona em blocos mais altos do que o ecrã). */
const NO_ECRA = { threshold: 0, rootMargin: '0px 0px -12% 0px' } as const

/**
 * Contentor cujos filhos diretos entram em cascata (60–90ms entre cada um) quando o contentor entra no ecrã.
 * Mantém a semântica: <Cascata as="ul"> com <li> diretamente lá dentro.
 */
export function Cascata({
  as: As = 'ul',
  passo,
  efeito = 'up',
  className,
  style,
  children,
  ...rest
}: {
  as?: ElementType
  /** ms entre filhos */
  passo?: number
  efeito?: 'up' | 'blur' | 'fade'
  children: ReactNode
} & HTMLAttributes<HTMLElement>) {
  const [ref, inView] = useInView<HTMLElement>(NO_ECRA)
  return (
    <As
      ref={ref}
      data-in={inView ? '' : undefined}
      data-efeito={efeito}
      className={cn('ficha-cascata', className)}
      style={passo ? ({ '--passo': `${passo}ms`, ...style } as CSSProperties) : style}
      {...rest}
    >
      {children}
    </As>
  )
}

/** Número que conta até ao valor ao aparecer. O leitor de ecrã lê só o valor final. */
export function Contador({ valor, casas = 0, className }: { valor: number; casas?: number; className?: string }) {
  const fmt = (n: number) => n.toLocaleString('pt-PT', { minimumFractionDigits: casas, maximumFractionDigits: casas })
  const final = fmt(valor)
  return (
    <span className={className}>
      <span className="sr-only">{final}</span>
      {/* o valor final (invisível) reserva a largura: os dígitos a contar não empurram a unidade */}
      <span aria-hidden className="relative inline-block tabular">
        <span className="invisible">{final}</span>
        <CountUp value={valor} format={fmt} duration={1600} className="absolute inset-y-0 left-0 whitespace-nowrap" />
      </span>
    </span>
  )
}

/**
 * Frase-chave que se acende palavra a palavra quando entra no ecrã (por tempo, não pelo scroll:
 * os números nunca ficam apagados depois de a frase estar à vista).
 */
export function PalavrasAcesas({
  partes,
  as: As = 'p',
  className,
  ...rest
}: {
  partes: { texto: string; className?: string }[]
  as?: ElementType
  className?: string
} & HTMLAttributes<HTMLElement>) {
  const [ref, inView] = useInView<HTMLElement>(NO_ECRA)
  // só espaços normais separam palavras: os espaços inseparáveis (3 meses) mantêm-se juntos
  const palavras = partes.flatMap((p) => p.texto.split(' ').filter(Boolean).map((w) => ({ w, className: p.className })))
  return (
    <As ref={ref} data-in={inView ? '' : undefined} className={cn('ficha-palavras', className)} {...rest}>
      {palavras.map((p, i) => (
        <span key={i} className={p.className} style={{ '--d': Math.min(i, 24) } as CSSProperties}>
          {p.w}
          {i < palavras.length - 1 ? ' ' : ''}
        </span>
      ))}
    </As>
  )
}

/**
 * Envolve o ForecastChart (partilhado) sem o alterar: as barras crescem em cascata, os intervalos aparecem
 * e a linha de probabilidade desenha-se quando o gráfico entra no ecrã.
 */
export function GraficoAnimado({ children, className }: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0, rootMargin: '0px 0px -18% 0px' })
  const marcado = useRef(false)

  // escreve o índice de cada mês (--i) e prepara a linha para ser "desenhada"
  useLayoutEffect(() => {
    const el = ref.current
    if (!el || marcado.current) return
    marcado.current = true
    el.querySelectorAll<SVGGElement>('svg > g[tabindex]').forEach((g, i) => g.style.setProperty('--i', String(i)))
    el.querySelectorAll<SVGPathElement>('svg > g > path').forEach((p) => {
      p.setAttribute('pathLength', '1')
      p.classList.add('ficha-linha')
    })
    el.querySelectorAll<SVGCircleElement>('svg > g > circle').forEach((c, i) => {
      c.classList.add('ficha-ponto')
      c.style.setProperty('--i', String(i))
    })
  }, [ref])

  return (
    <div ref={ref} data-in={inView ? '' : undefined} className={cn('ficha-grafico', className)}>
      {children}
    </div>
  )
}

/** Envolve o ForecastStrip (partilhado): os meses entram um a um e a barra de cada um enche. */
export function TiraAnimada({ children, className }: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>(NO_ECRA)
  return (
    <div ref={ref} data-in={inView ? '' : undefined} className={cn('ficha-tira', className)}>
      {children}
    </div>
  )
}
