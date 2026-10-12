/**
 * A verificação em quatro passos: pedido → licença → visita → selo.
 * Uma linha "desenha-se" com o scroll e acende cada passo quando lá chega
 * (horizontal no desktop, vertical no telemóvel — segue a linha de leitura).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLares } from '@/lib/store'
import { num } from '@/lib/format'
import { range, subscribeScroll, usePrefersReducedMotion } from '@/lib/motion'
import { SeloVerificado } from '@/components/brand/SeloVerificado'
import { Reveal } from '@/components/motion'
import { cn } from '@/lib/cn'
import { SectionTitle } from '../shared/ui'

const PASSOS = [
  { t: 'Pedido', d: 'Regista a instituição e o número da licença.' },
  { t: 'Licença', d: 'Confirmamos a licença emitida pela Segurança Social.' },
  { t: 'Visita', d: 'Visitamos a casa, em data combinada consigo.' },
  { t: 'Selo', d: 'Aparece na ficha, com a data. Renova-se todos os anos.' },
] as const

/** Liga a linha ao scroll: posiciona a calha entre o 1.º e o último ponto e enche-a até à linha de leitura. */
function useLinha(n: number) {
  const reduced = usePrefersReducedMotion()
  const lista = useRef<HTMLOListElement>(null)
  const calha = useRef<HTMLSpanElement>(null)
  const enchimento = useRef<HTMLSpanElement>(null)
  const pontos = useRef<(HTMLSpanElement | null)[]>([])
  const [chegou, setChegou] = useState(reduced ? n : 0)

  useEffect(() => {
    let geo = ''
    const medir = () => {
      const ol = lista.current
      const a = pontos.current[0]
      const b = pontos.current[n - 1]
      if (!ol || !a || !b || !calha.current || !enchimento.current) return null
      const ro = ol.getBoundingClientRect()
      const ra = a.getBoundingClientRect()
      const rb = b.getBoundingClientRect()
      const ax = ra.left + ra.width / 2
      const ay = ra.top + ra.height / 2
      const bx = rb.left + rb.width / 2
      const by = rb.top + rb.height / 2
      const horizontal = Math.abs(bx - ax) > Math.abs(by - ay)
      const g = horizontal
        ? `left:${ax - ro.left}px;top:${ay - ro.top - 1}px;width:${bx - ax}px;height:2px`
        : `left:${ax - ro.left - 1}px;top:${ay - ro.top}px;width:2px;height:${by - ay}px`
      if (g !== geo) {
        geo = g
        calha.current.style.cssText = g
      }
      return { horizontal, ay, by, ro }
    }

    return subscribeScroll(() => {
      const m = medir()
      if (!m) return
      if (reduced) {
        // movimento reduzido: linha completa e todos os passos acesos (só se mantém a geometria certa)
        if (enchimento.current) enchimento.current.style.transform = 'none'
        setChegou(n)
        return
      }
      const vh = window.innerHeight
      const leitura = vh * 0.72
      let v: number
      let k: number
      if (m.horizontal) {
        // no desktop a linha desenha-se enquanto a lista sobe ~25% do ecrã (acaba antes do meio)
        v = range(vh * 0.82 - m.ro.top, 0, Math.max(160, vh * 0.25))
        k = v >= 0.999 ? n : Math.floor(v * (n - 1) + 0.0001) + (v > 0 ? 1 : 0)
      } else {
        v = range(leitura - m.ay, 0, m.by - m.ay)
        k = pontos.current.filter((p) => p && p.getBoundingClientRect().top + 10 <= leitura).length
      }
      if (enchimento.current) enchimento.current.style.transform = m.horizontal ? `scaleX(${v})` : `scaleY(${v})`
      setChegou((prev) => (prev === k ? prev : k))
    })
  }, [n, reduced])

  return { lista, calha, enchimento, pontos, chegou }
}

export function Verificacao() {
  const lares = useLares()
  const verificadas = useMemo(() => lares.filter((l) => l.verificacao.estado === 'verificado').length, [lares])
  const { lista, calha, enchimento, pontos, chegou } = useLinha(PASSOS.length)
  const selo = chegou >= PASSOS.length

  return (
    <section aria-labelledby="pl-verificacao" className="bg-sand">
      <div className="container-page py-20 sm:py-32 lg:py-40">
        <div className="flex flex-col items-center">
          <Reveal variant="scale" duration={900}>
            <SeloVerificado size={84} className="mb-8" />
          </Reveal>
          <Reveal variant="blur" delay={120}>
            <SectionTitle
              id="pl-verificacao"
              title="Verificadas, uma a uma."
              subtitle={`O selo não se compra: as regras são as mesmas para todas as instituições. ${num(verificadas)} das ${num(lares.length)} instituições do mapa já o têm.`}
            />
          </Reveal>
        </div>

        <ol ref={lista} className="relative mx-auto mt-14 grid max-w-5xl grid-cols-1 gap-10 sm:mt-20 md:grid-cols-4 md:gap-6">
          <span ref={calha} aria-hidden className="absolute overflow-hidden rounded-full bg-line-strong">
            <span ref={enchimento} className="absolute inset-0 origin-top-left bg-ink will-change-transform" style={{ transform: 'scale(0)' }} />
          </span>
          {PASSOS.map((p, i) => {
            const ok = i < chegou
            const ultimo = i === PASSOS.length - 1
            return (
              <li key={p.t} className="relative flex gap-5 md:flex-col md:items-center md:gap-5 md:text-center">
                <span
                  ref={(el) => {
                    pontos.current[i] = el
                  }}
                  aria-hidden
                  className={cn(
                    'relative mt-1 size-5 shrink-0 rounded-full border shadow-[0_0_0_8px_var(--color-sand)] transition-[background-color,border-color,scale] duration-500 ease-[cubic-bezier(.34,1.56,.64,1)]',
                    ok ? (ultimo ? 'scale-125 border-terra-600 bg-terra-600' : 'border-ink bg-ink') : 'scale-90 border-line-strong bg-white',
                  )}
                >
                  {ultimo && selo && <span className="absolute inset-0 animate-ping rounded-full bg-terra-600/40 [animation-iteration-count:2] motion-reduce:hidden" />}
                </span>
                <div className={cn('transition-[opacity,translate] duration-700 ease-[cubic-bezier(.16,1,.3,1)]', ok ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-60')}>
                  <h3 className="text-xl font-semibold text-ink">
                    <span className="sr-only">Passo {i + 1}: </span>
                    {p.t}
                  </h3>
                  <p className="mt-1.5 text-base text-ink-mute md:mx-auto md:max-w-[22ch]">{p.d}</p>
                </div>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
