import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { SECOES, irParaSecao } from './helpers'
import { useScrollSpy } from './hooks'

const IDS = SECOES.map((s) => s.id)

/**
 * Navegação interna fixa (por baixo do cabeçalho) com scroll-spy.
 * Usa botões + scrollIntoView: links "#id" não funcionam com o HashRouter.
 */
export function SectionNav() {
  const ativo = useScrollSpy(IDS, 170)
  const lista = useRef<HTMLUListElement>(null)

  // mantém o separador ativo visível na faixa deslizante (telemóvel)
  useEffect(() => {
    const ul = lista.current
    const btn = ul?.querySelector<HTMLElement>(`[data-id="${ativo}"]`)
    if (!ul || !btn || ul.scrollWidth <= ul.clientWidth) return
    const alvo = btn.offsetLeft - ul.clientWidth / 2 + btn.offsetWidth / 2
    ul.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' })
  }, [ativo])

  return (
    <nav
      aria-label="Secções da ficha"
      className="sticky top-18 z-[900] -mx-4 border-b border-line bg-cream/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0"
    >
      <ul ref={lista} className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SECOES.map((s) => {
          const on = s.id === ativo
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                data-id={s.id}
                aria-current={on ? 'location' : undefined}
                onClick={() => irParaSecao(s.id)}
                className={cn(
                  'relative flex min-h-13 items-center px-3 text-sm font-bold transition-colors',
                  'after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-full after:transition-colors',
                  on ? 'text-ink after:bg-terra-500' : 'text-ink-soft after:bg-transparent hover:text-ink hover:after:bg-line-strong',
                )}
              >
                {s.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
