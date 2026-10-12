import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { SECOES } from './helpers'
import { useIrParaSecao, useScrollSpy } from './hooks'

const IDS = SECOES.map((s) => s.id)

/**
 * Navegação local fixa por baixo do cabeçalho (como nas páginas de produto da Apple):
 * nome à esquerda, secções à direita, com scroll-spy e um indicador que desliza para a secção ativa.
 * No telemóvel é uma faixa deslizável com snap (a secção ativa fica centrada) e esbate nas pontas.
 * Botões + Lenis/scrollIntoView: links "#id" não funcionam com o HashRouter.
 */
export function SectionNav({ nome }: { nome: string }) {
  const ativo = useScrollSpy(IDS, 150)
  const irParaSecao = useIrParaSecao()
  const faixa = useRef<HTMLDivElement>(null)
  const [barra, setBarra] = useState<{ x: number; w: number } | null>(null)

  // posição do indicador: mede o botão ativo (ou o primeiro, escondido, para entrar já no sítio certo)
  useLayoutEffect(() => {
    const ul = faixa.current
    if (!ul) return
    const medir = () => {
      const btn = ul.querySelector<HTMLElement>(`[data-id="${ativo || IDS[0]}"]`)
      if (btn) setBarra({ x: btn.offsetLeft + 10, w: Math.max(0, btn.offsetWidth - 20) })
    }
    medir()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(medir) : null
    ro?.observe(ul)
    return () => ro?.disconnect()
  }, [ativo])

  // mantém a secção ativa visível (centrada) na faixa deslizante do telemóvel
  useEffect(() => {
    const ul = faixa.current
    if (!ul || ul.scrollWidth <= ul.clientWidth) return
    const btn = ativo ? ul.querySelector<HTMLElement>(`[data-id="${ativo}"]`) : null
    const alvo = btn ? btn.offsetLeft - ul.clientWidth / 2 + btn.offsetWidth / 2 : 0
    ul.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' })
  }, [ativo])

  return (
    <nav
      aria-label="Secções da ficha"
      className="sticky top-16 z-[900] border-b border-black/[0.06] bg-white/80 backdrop-blur-xl backdrop-saturate-150"
    >
      <div className="container-page flex items-center gap-8">
        <p className="hidden min-w-0 shrink truncate text-lg font-semibold tracking-tight text-ink lg:block">{nome}</p>
        {/* a faixa é o contentor que desliza; a lista e o indicador deslizam juntos */}
        <div
          ref={faixa}
          className={cn(
            'relative -mx-5 flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] sm:-mx-8 [&::-webkit-scrollbar]:hidden',
            'max-lg:[mask-image:linear-gradient(90deg,transparent_0,#000_1rem,#000_calc(100%_-_2.5rem),transparent_100%)]',
            'lg:mx-0 lg:ml-auto lg:flex-none',
          )}
        >
          <ul className="flex w-max gap-1 px-3 sm:px-6 lg:px-0">
            {SECOES.map((s) => {
              const on = s.id === ativo
              return (
                <li key={s.id} className="shrink-0 snap-center">
                  <button
                    type="button"
                    data-id={s.id}
                    aria-current={on ? 'location' : undefined}
                    onClick={() => irParaSecao(s.id)}
                    className={cn(
                      'flex min-h-12 items-center px-2.5 text-sm transition-colors duration-300',
                      on ? 'text-ink' : 'text-ink-mute hover:text-ink',
                    )}
                  >
                    {s.label}
                  </button>
                </li>
              )
            })}
          </ul>
          {/* indicador deslizante (só transform/opacity) */}
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 block h-0.5 w-px origin-left rounded-full bg-ink transition-[transform,translate,scale,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
            style={{
              transform: barra ? `translateX(${barra.x}px) scaleX(${barra.w})` : 'scaleX(0)',
              opacity: ativo && barra ? 1 : 0,
            }}
          />
        </div>
      </div>
    </nav>
  )
}
