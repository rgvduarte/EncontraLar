import { useEffect, useRef, useState, type ReactNode } from 'react'
import { subscribeScroll } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { useTecladoAberto } from './keyboard'

/**
 * Ação principal ao alcance do polegar (telemóvel e tablet, < 1024px): o botão "cola" ao fundo do ecrã
 * enquanto o formulário continua por baixo e pousa no seu lugar no fim do formulário — um só botão,
 * sem duplicados. Quando está colado ganha uma barra translúcida (estilo iOS) com a margem de segurança
 * do iPhone; enquanto se escreve (teclado aberto) recolhe para não tapar campos.
 *
 * Tem de ser o ÚLTIMO filho direto do formulário/painel (o `position: sticky` funciona dentro do pai).
 * Estas rotas não têm barra de abas, por isso o fundo é `bottom-0` + safe area.
 */
export function StickyAction({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [preso, setPreso] = useState(false)
  const teclado = useTecladoAberto()

  useEffect(() => {
    const el = ref.current
    const pai = el?.parentElement
    if (!el || !pai) return
    const mq = window.matchMedia('(max-width: 1023.98px)')
    const medir = () => {
      const r = pai.getBoundingClientRect()
      const vh = window.innerHeight
      setPreso(mq.matches && r.top < vh && r.bottom > vh + 2)
    }
    const parar = subscribeScroll(medir)
    const ro = 'ResizeObserver' in window ? new ResizeObserver(medir) : null
    ro?.observe(pai)
    return () => {
      parar()
      ro?.disconnect()
    }
  }, [])

  const recolhido = preso && teclado

  return (
    <div
      ref={ref}
      data-preso={preso || undefined}
      inert={recolhido || undefined}
      className={cn(
        'relative z-20 max-lg:sticky max-lg:bottom-0 max-lg:-mx-5 max-lg:px-5 max-lg:pt-3 max-lg:pb-[calc(1rem+env(safe-area-inset-bottom))]',
        'transition-[translate,opacity] duration-300 ease-[cubic-bezier(.32,.72,0,1)] motion-reduce:transition-none',
        recolhido && 'pointer-events-none translate-y-full opacity-0',
        className,
      )}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2 lg:hidden',
          'border-t border-black/[0.08] bg-white/85 backdrop-blur-xl backdrop-saturate-150 transition-opacity duration-300',
          preso ? 'opacity-100' : 'opacity-0',
        )}
      />
      {children}
    </div>
  )
}
