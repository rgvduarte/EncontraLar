import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { AppearGateProvider, useAppearGate, type AppearGate } from './Appear'

export interface SlidePanel {
  key: string
  content: ReactNode
}

const EASE_OUT = 'cubic-bezier(.16,1,.3,1)'
const EASE_IOS = 'cubic-bezier(.32,.72,0,1)'
const DURACAO = 540
/** atraso da entrada: o painel que sai quase desaparece antes de o novo chegar (sem sobreposição confusa) */
const ATRASO = 130
/** Duração total de uma troca (para quem precisa de esperar por ela antes de levar o foco). */
export const SLIDE_MS = ATRASO + DURACAO

/**
 * Troca entre painéis (separadores, passos) como numa app iOS: o painel que sai desvanece e desliza
 * para um lado, o que entra chega do outro, e a altura do contentor acompanha suavemente (sem salto).
 *
 * Todos os painéis ficam montados — mudar de painel não apaga o que já se escreveu. Os inativos ficam
 * `hidden`; o que está a sair fica `inert` durante a transição. Com movimento reduzido: troca imediata.
 */
export function SlideSwitch({ active, panels, className }: { active: string; panels: SlidePanel[]; className?: string }) {
  const box = useRef<HTMLDivElement>(null)
  const nodes = useRef(new Map<string, HTMLDivElement | null>())
  const lastHeight = useRef(0)
  const running = useRef<Animation[]>([])
  const parentGate = useAppearGate()
  const gates = useRef(new Map<string, AppearGate>())
  const gateFor = (k: string) => {
    let g = gates.current.get(k)
    if (!g) gates.current.set(k, (g = { until: 0, parent: parentGate }))
    return g
  }

  // "estado a partir de props": guarda o painel anterior para o animar a sair
  const [prev, setPrev] = useState(active)
  const [leaving, setLeaving] = useState<{ key: string; dir: number } | null>(null)
  if (prev !== active) {
    setPrev(active)
    if (!prefersReducedMotion()) {
      const order = panels.map((p) => p.key)
      setLeaving({ key: prev, dir: Math.sign(order.indexOf(active) - order.indexOf(prev)) || 1 })
    }
  }

  // altura pintada mais recente (inclui a meio de uma transição, para trocas rápidas sucessivas)
  useEffect(() => {
    const b = box.current
    if (!b || !('ResizeObserver' in window)) return
    const ro = new ResizeObserver(() => {
      lastHeight.current = b.getBoundingClientRect().height
    })
    ro.observe(b)
    return () => ro.disconnect()
  }, [])

  useLayoutEffect(() => {
    if (!leaving) {
      // já escondido no mesmo commit: pode largar o estado final das animações sem "piscar"
      running.current.forEach((a) => a.cancel())
      running.current = []
      return
    }
    const b = box.current
    const inc = nodes.current.get(active)
    const out = nodes.current.get(leaving.key)
    if (!b || !inc || !out || typeof b.animate !== 'function') {
      setLeaving(null)
      return
    }
    gateFor(active).until = performance.now() + SLIDE_MS + 200
    running.current.forEach((a) => a.cancel())

    const h0 = lastHeight.current || out.getBoundingClientRect().height
    const h1 = inc.getBoundingClientRect().height
    const d = leaving.dir * 40
    const anims = [
      b.animate([{ height: `${h0}px` }, { height: `${h1}px` }], { duration: SLIDE_MS - 60, easing: EASE_IOS }),
      out.animate(
        [
          { opacity: 1, transform: 'none' },
          { opacity: 0, transform: `translate3d(${-d * 0.6}px,0,0)` },
        ],
        { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' },
      ),
      inc.animate(
        [
          { opacity: 0, transform: `translate3d(${d}px,0,0)` },
          { opacity: 1, transform: 'none' },
        ],
        { duration: DURACAO, delay: ATRASO, easing: EASE_OUT, fill: 'backwards' },
      ),
    ]
    running.current = anims
    const atual = leaving
    Promise.all(anims.map((a) => a.finished))
      .then(() => setLeaving((l) => (l === atual ? null : l)))
      .catch(() => {
        /* cancelada por uma troca mais recente */
      })
  }, [leaving, active])

  return (
    <div ref={box} className={cn('relative', leaving && 'overflow-y-clip', className)}>
      {panels.map((p) => {
        const isActive = p.key === active
        const isLeaving = leaving?.key === p.key && !isActive
        return (
          <div
            key={p.key}
            ref={(el) => {
              nodes.current.set(p.key, el)
            }}
            hidden={!isActive && !isLeaving}
            inert={isLeaving || undefined}
            aria-hidden={isLeaving || undefined}
            className={cn(isLeaving && 'absolute inset-x-0 top-0')}
          >
            <AppearGateProvider value={gateFor(p.key)}>{p.content}</AppearGateProvider>
          </div>
        )
      })}
    </div>
  )
}
