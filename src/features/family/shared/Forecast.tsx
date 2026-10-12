import type { ComponentProps } from 'react'
import { ForecastStrip } from '@/components/brand/ForecastStrip'
import { cn } from '@/lib/cn'
import { useViewAnimations } from './motion'

/**
 * ForecastStrip que "enche" ao aparecer: na versão completa, cada mês sobe e a barra cresce da
 * esquerda; na mini, as barrinhas crescem de baixo, uma a uma. Só transform/opacity.
 * (A estrutura interna do ForecastStrip é lida sem a alterar — se mudar, a previsão aparece sem animação.)
 */
export function AnimatedForecast({ wrapperClassName, ...props }: ComponentProps<typeof ForecastStrip> & { wrapperClassName?: string }) {
  const ref = useViewAnimations<HTMLDivElement>((root) => {
    if (props.variant === 'mini') {
      return Array.from(root.querySelectorAll<HTMLElement>('[role="img"] > span > span')).map((el, i) => {
        el.style.transformOrigin = '50% 100%'
        return { el, keyframes: [{ transform: 'scaleY(0)' }, { transform: 'none' }], options: { duration: 800, delay: 120 + i * 70 } }
      })
    }
    return Array.from(root.querySelectorAll<HTMLElement>('li')).flatMap((li, i) => {
      const fill = li.querySelector<HTMLElement>(':scope > span:nth-child(3) > span')
      const specs = [
        { el: li as Element, keyframes: [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], options: { duration: 700, delay: i * 80 } },
      ]
      if (fill) {
        fill.style.transformOrigin = '0 50%'
        specs.push({ el: fill, keyframes: [{ opacity: 1, transform: 'scaleX(0)' }, { opacity: 1, transform: 'none' }], options: { duration: 1100, delay: 200 + i * 80 } })
      }
      return specs
    })
  })
  return (
    <div ref={ref} className={cn(props.variant === 'mini' && 'shrink-0', wrapperClassName)}>
      <ForecastStrip {...props} />
    </div>
  )
}
