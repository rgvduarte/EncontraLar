import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { SECOES } from './helpers'
import { useIrParaSecao, useScrollSpy } from './hooks'

const IDS = SECOES.map((s) => s.id)

/**
 * Navegação local fixa por baixo do cabeçalho (como nas páginas de produto da Apple):
 * nome à esquerda, secções à direita, com scroll-spy.
 * Botões + scrollIntoView: links "#id" não funcionam com o HashRouter.
 */
export function SectionNav({ nome }: { nome: string }) {
  const ativo = useScrollSpy(IDS, 150)
  const irParaSecao = useIrParaSecao()
  const lista = useRef<HTMLUListElement>(null)

  // mantém a secção ativa visível na faixa deslizante (telemóvel)
  useEffect(() => {
    const ul = lista.current
    if (!ul || ul.scrollWidth <= ul.clientWidth) return
    const btn = ativo ? ul.querySelector<HTMLElement>(`[data-id="${ativo}"]`) : null
    if (!btn) {
      ul.scrollTo({ left: 0, behavior: 'smooth' })
      return
    }
    const alvo = btn.offsetLeft - ul.clientWidth / 2 + btn.offsetWidth / 2
    ul.scrollTo({ left: Math.max(0, alvo), behavior: 'smooth' })
  }, [ativo])

  return (
    <nav aria-label="Secções da ficha" className="sticky top-16 z-[900] border-b border-black/[0.06] bg-white/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="container-page flex items-center gap-8">
        <p className="hidden min-w-0 shrink truncate text-lg font-semibold tracking-tight text-ink lg:block">{nome}</p>
        <ul
          ref={lista}
          className="-mx-5 flex flex-1 gap-1 overflow-x-auto px-3 [scrollbar-width:none] sm:-mx-8 sm:px-6 lg:mx-0 lg:flex-none lg:justify-end lg:px-0 lg:ml-auto [&::-webkit-scrollbar]:hidden"
        >
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
                    'relative flex min-h-12 items-center px-2.5 text-sm transition-colors duration-200',
                    'after:absolute after:inset-x-2.5 after:-bottom-px after:h-0.5 after:rounded-full after:transition-colors after:duration-200',
                    on ? 'text-ink after:bg-ink' : 'text-ink-mute after:bg-transparent hover:text-ink',
                  )}
                >
                  {s.label}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}
