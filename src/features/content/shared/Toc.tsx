/**
 * Índice de uma página longa: lista de texto fixa ao lado (desktop) e barra compacta
 * que abre uma lista (telemóvel), com a secção atual destacada (scroll-spy).
 */
import { useCallback, useId, useRef, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown } from 'lucide-react'
import { useDismiss } from '@/lib/hooks'
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

function TocLink({ item, active, onGo, pathname, className }: { item: TocItem; active: boolean; onGo: (id: string) => void; pathname: string; className?: string }) {
  return (
    <Link
      to={{ pathname, hash: item.id }}
      onClick={(e) => {
        e.preventDefault()
        onGo(item.id)
      }}
      aria-current={active ? 'location' : undefined}
      className={cn('flex min-h-11 items-center transition-colors duration-200', active ? 'font-medium text-ink' : 'text-ink-mute hover:text-ink', className)}
    >
      {item.label}
    </Link>
  )
}

/** Desktop: lista de texto fixa, sem caixas. */
export function TocSidebar({ items, active, onGo, pathname, label }: TocProps) {
  return (
    <nav aria-label={label} className="sticky top-24 hidden self-start lg:block print:hidden">
      <p className="mb-3 text-sm font-semibold text-ink">{label}</p>
      <ul className="flex flex-col border-l border-line text-sm">
        {items.map((it) => (
          <li key={it.id}>
            <TocLink
              item={it}
              active={active === it.id}
              onGo={onGo}
              pathname={pathname}
              className={cn('-ml-px border-l pl-4', active === it.id ? 'border-ink' : 'border-transparent')}
            />
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Telemóvel e tablet: barra fixa por baixo do cabeçalho que mostra a secção atual e abre o índice. */
export function TocBar({ items, active, onGo, pathname, label }: TocProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listId = useId()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, ref, close)
  const atual = items.find((i) => i.id === active)

  return (
    <div ref={ref} className="sticky top-16 z-[900] -mx-5 border-b border-line bg-white/85 backdrop-blur-xl backdrop-saturate-150 sm:-mx-8 lg:hidden print:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        className="flex min-h-13 w-full items-center justify-between gap-3 px-5 text-left sm:px-8"
      >
        <span className="min-w-0 truncate text-sm">
          <span className="font-semibold text-ink">{label}</span>
          {atual && <span className="text-ink-mute"> · {atual.label}</span>}
        </span>
        <ChevronDown aria-hidden className={cn('size-5 shrink-0 text-ink-mute transition-transform duration-300', open && 'rotate-180')} />
      </button>
      <nav
        id={listId}
        aria-label={label}
        hidden={!open}
        className="absolute inset-x-0 top-full animate-pop-in border-y border-line bg-white px-5 pt-1 pb-3 shadow-card sm:px-8"
      >
        <ul className="flex flex-col">
          {items.map((it) => (
            <li key={it.id}>
              <TocLink
                item={it}
                active={active === it.id}
                pathname={pathname}
                className="min-h-12 text-base"
                onGo={(id) => {
                  setOpen(false)
                  onGo(id)
                }}
              />
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
