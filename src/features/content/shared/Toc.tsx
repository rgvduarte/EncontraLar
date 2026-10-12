/**
 * Índice de uma página longa: lista de texto fixa ao lado (desktop), com um indicador que desliza
 * para a secção atual (scroll-spy), e barra compacta fixa que abre a lista numa folha inferior (telemóvel).
 */
import { useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/cn'

export interface TocItem {
  id: string
  label: string
}

interface TocProps {
  items: readonly TocItem[]
  active: string | null
  onGo: (id: string) => void
  pathname: string
  label: string
}

/** Desktop: lista de texto fixa, sem caixas. O traço da secção atual desliza de item em item. */
export function TocSidebar({ items, active, onGo, pathname, label }: TocProps) {
  const lista = useRef<HTMLUListElement>(null)
  const [marca, setMarca] = useState<{ y: number; h: number } | null>(null)

  useLayoutEffect(() => {
    const ul = lista.current
    const li = active ? ul?.querySelector<HTMLElement>(`li[data-id="${CSS.escape(active)}"]`) : null
    setMarca(li ? { y: li.offsetTop, h: li.offsetHeight } : null)
  }, [active, items])

  return (
    <nav aria-label={label} className="sticky top-24 hidden self-start lg:block print:hidden">
      <p className="mb-3 text-sm font-semibold text-ink">{label}</p>
      <ul ref={lista} className="relative flex flex-col border-l border-line text-sm">
        <span
          aria-hidden
          className="absolute top-0 -left-px w-0.5 rounded-full bg-ink transition-[transform,opacity] duration-500 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none"
          style={{ height: marca?.h ?? 0, transform: `translate3d(0, ${marca?.y ?? 0}px, 0)`, opacity: marca ? 1 : 0 }}
        />
        {items.map((it) => {
          const atual = active === it.id
          return (
            <li key={it.id} data-id={it.id}>
              <Link
                to={{ pathname, hash: it.id }}
                onClick={(e) => {
                  e.preventDefault()
                  onGo(it.id)
                }}
                aria-current={atual ? 'location' : undefined}
                className={cn('flex min-h-11 items-center pl-4 transition-colors duration-300', atual ? 'font-medium text-ink' : 'text-ink-mute hover:text-ink')}
              >
                {it.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * Telemóvel e tablet: barra fixa por baixo do cabeçalho que mostra a secção atual;
 * um toque abre o índice numa folha inferior (ao alcance do polegar), com alvos grandes.
 */
export function TocBar({ items, active, onGo, pathname, label }: TocProps) {
  const [open, setOpen] = useState(false)
  const idx = items.findIndex((i) => i.id === active)
  const atual = idx >= 0 ? items[idx] : undefined

  const ir = (id: string) => {
    setOpen(false)
    onGo(id)
    // o diálogo devolve o foco ao botão quando acaba de fechar: passamo-lo para a secção escolhida
    window.setTimeout(() => document.getElementById(id)?.focus({ preventScroll: true }), 260)
  }

  return (
    <div className="sticky top-16 z-[900] -mx-5 border-b border-line bg-white/85 backdrop-blur-xl backdrop-saturate-150 sm:-mx-8 lg:hidden print:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex min-h-13 w-full items-center justify-between gap-3 px-5 text-left sm:px-8"
      >
        <span className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 font-semibold text-ink">{label}</span>
          {atual && (
            <span key={atual.id} className="min-w-0 animate-pop-in truncate text-ink-mute">
              <span className="tabular">
                {idx + 1}/{items.length}
              </span>{' '}
              · {atual.label}
            </span>
          )}
        </span>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sand">
          <ChevronDown aria-hidden className="size-5 text-ink-soft" />
        </span>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title={label} description={`${items.length} secções. Toque para ir.`}>
        <nav aria-label={label}>
          <ol className="-mx-2 flex flex-col pb-[env(safe-area-inset-bottom)]">
            {items.map((it, i) => {
              const aqui = it.id === active
              return (
                <li key={it.id}>
                  <Link
                    to={{ pathname, hash: it.id }}
                    onClick={(e) => {
                      e.preventDefault()
                      ir(it.id)
                    }}
                    aria-current={aqui ? 'location' : undefined}
                    className={cn(
                      'flex min-h-14 items-center gap-4 rounded-2xl px-3 text-lg transition-colors duration-200',
                      aqui ? 'bg-sand font-semibold text-ink' : 'text-ink-soft hover:bg-sand active:bg-sand-deep',
                    )}
                  >
                    <span aria-hidden className="w-6 shrink-0 text-base text-ink-mute tabular">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">{it.label}</span>
                    {aqui && <span className="shrink-0 text-sm font-medium text-terra-600">Está aqui</span>}
                  </Link>
                </li>
              )
            })}
          </ol>
        </nav>
      </Modal>
    </div>
  )
}
