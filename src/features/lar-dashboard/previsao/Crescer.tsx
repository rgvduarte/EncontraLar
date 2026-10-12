import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { prefersReducedMotion, useInView } from '@/lib/motion'
import { EASE } from '../shared/motion'

/**
 * Faz "crescer" as barras do gráfico de previsão (ForecastChart, componente partilhado) quando ele entra
 * no ecrã: cada barra sobe do eixo, da esquerda para a direita, e só depois aparecem os intervalos.
 * Atua por fora, nos elementos SVG já desenhados — sem tocar no componente. Só transform/opacity.
 */
export function Crescer({ children, className }: { children: ReactNode; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.25 })
  const feito = useRef(false)

  const partes = () => {
    const grupos = Array.from(ref.current?.querySelectorAll<SVGGElement>('svg g[role="img"]') ?? [])
    return grupos.map((g) => ({ barra: g.querySelectorAll<SVGRectElement>('rect')[1], linhas: Array.from(g.querySelectorAll<SVGLineElement>('line')) }))
  }

  // antes de aparecer: barras rasas e intervalos invisíveis (aplicado antes da primeira pintura)
  useLayoutEffect(() => {
    if (prefersReducedMotion() || feito.current) return
    for (const { barra, linhas } of partes()) {
      if (barra) {
        barra.style.transformBox = 'fill-box'
        barra.style.transformOrigin = '50% 100%'
        barra.style.transform = 'scaleY(0)'
      }
      for (const l of linhas) l.style.opacity = '0'
    }
  }, [])

  useLayoutEffect(() => {
    if (!inView || feito.current || prefersReducedMotion()) return
    feito.current = true
    partes().forEach(({ barra, linhas }, i) => {
      if (barra) {
        barra.style.transform = ''
        barra.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: 900, delay: 60 + i * 55, easing: EASE, fill: 'backwards' })
      }
      for (const l of linhas) {
        l.style.opacity = ''
        l.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, delay: 560 + i * 55, easing: 'ease-out', fill: 'backwards' })
      }
    })
  }, [inView])

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  )
}
