import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Lar } from '@/types'
import { LarCard } from '@/components/lar/LarCard'
import { prefersReducedMotion } from '@/lib/motion'
import { EASE } from '../shared/motion'

/**
 * Pré-visualização em direto do cartão da pesquisa. Enquanto se escreve, espera uma pausa curta e depois
 * troca de versão com um cross-fade: o cartão antigo desvanece por cima do novo. Decorativo (inert).
 */
export function Previa({ lar, assinatura }: { lar: Lar; assinatura: string }) {
  const [atual, setAtual] = useState({ lar, assinatura })
  const [anterior, setAnterior] = useState<Lar | null>(null)
  const velho = useRef<HTMLDivElement>(null)
  const novo = useRef<HTMLDivElement>(null)
  const ultimo = useRef(lar)
  ultimo.current = lar

  // espera que a pessoa pare de escrever (~300ms) antes de trocar o cartão
  useEffect(() => {
    if (assinatura === atual.assinatura) {
      // mesma ficha (ex.: dados do lar atualizados por fora): atualiza sem animação
      if (ultimo.current !== atual.lar) setAtual({ lar: ultimo.current, assinatura })
      return
    }
    const t = setTimeout(() => {
      if (!prefersReducedMotion()) setAnterior(atual.lar)
      setAtual({ lar: ultimo.current, assinatura })
    }, 300)
    return () => clearTimeout(t)
  }, [assinatura, atual])

  useLayoutEffect(() => {
    if (!anterior) return
    const fim = velho.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 460, easing: EASE, fill: 'forwards' })
    novo.current?.animate(
      [
        { opacity: 0.4, filter: 'blur(2px)' },
        { opacity: 1, filter: 'blur(0)' },
      ],
      { duration: 460, easing: EASE },
    )
    if (fim) fim.onfinish = () => setAnterior(null)
    else setAnterior(null)
  }, [anterior])

  return (
    <div inert className="relative">
      <div ref={novo}>
        <LarCard lar={atual.lar} />
      </div>
      {anterior && (
        <div ref={velho} aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <LarCard lar={anterior} />
        </div>
      )}
    </div>
  )
}
