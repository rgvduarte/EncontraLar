import { useEffect, useRef, type ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/cn'

export interface TocItem {
  id: string
  label: string
  /** etiqueta curta para as pílulas no telemóvel */
  short?: string
}

interface TocProps {
  items: readonly TocItem[]
  active: string | null
  onGo: (id: string) => void
  pathname: string
}

/** Índice lateral fixo (desktop), com a secção atual destacada. */
export function TocSidebar({ items, active, onGo, pathname, title = 'Neste guia', footer }: TocProps & { title?: string; footer?: ReactNode }) {
  return (
    <nav aria-label={title} className="sticky top-28 flex flex-col gap-5 print:hidden">
      <p className="eyebrow">{title}</p>
      <ol className="relative flex flex-col border-l-2 border-line">
        {items.map((it, i) => {
          const isActive = active === it.id
          return (
            <li key={it.id}>
              <Link
                to={{ pathname, hash: it.id }}
                onClick={(e) => {
                  e.preventDefault()
                  onGo(it.id)
                }}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  '-ml-0.5 flex min-h-12 items-center gap-3 border-l-2 py-1.5 pr-2 pl-4 leading-snug transition-colors',
                  isActive
                    ? 'border-terra-500 font-bold text-ink'
                    : 'border-transparent text-ink-soft hover:border-line-strong hover:text-ink',
                )}
              >
                <span aria-hidden className={cn('font-display w-6 shrink-0 text-sm tabular', isActive ? 'text-terra-600' : 'text-ink-mute')}>
                  {String(i + 1).padStart(2, '0')}
                </span>
                {it.label}
              </Link>
            </li>
          )
        })}
      </ol>
      {footer}
    </nav>
  )
}

/** Pílulas horizontais fixas por baixo do cabeçalho (telemóvel e tablet). */
export function TocChips({ items, active, onGo, pathname, label = 'Secções desta página' }: TocProps & { label?: string }) {
  const scroller = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const box = scroller.current
    if (!box || !active) return
    const chip = box.querySelector<HTMLElement>(`[data-id="${active}"]`)
    if (!chip) return
    const left = chip.offsetLeft - box.clientWidth / 2 + chip.clientWidth / 2
    box.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
  }, [active])

  return (
    <nav aria-label={label} className="sticky top-18 z-[900] -mx-4 border-b border-line bg-cream/95 backdrop-blur-md sm:-mx-6 lg:hidden print:hidden">
      <ol ref={scroller} className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden">
        {items.map((it) => {
          const isActive = active === it.id
          return (
            <li key={it.id} data-id={it.id} className="shrink-0">
              <Link
                to={{ pathname, hash: it.id }}
                onClick={(e) => {
                  e.preventDefault()
                  onGo(it.id)
                }}
                aria-current={isActive ? 'location' : undefined}
                className={cn(
                  'inline-flex min-h-12 items-center rounded-full border px-4 text-sm font-bold whitespace-nowrap transition-colors',
                  isActive ? 'border-pine-800 bg-pine-800 text-white' : 'border-line-strong bg-white text-ink-soft hover:border-pine-600',
                )}
              >
                {it.short ?? it.label}
              </Link>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
