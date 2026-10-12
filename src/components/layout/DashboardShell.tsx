import { useEffect, useRef, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useCurrentUser } from '@/lib/store'

export interface DashboardNavItem {
  /** caminho absoluto, ex.: "/familia/pedidos" */
  to: string
  label: string
  icon: LucideIcon
  /** contador (ex.: pedidos novos) */
  badge?: number
  /** como o leitor de ecrã lê o contador, depois do número (ex.: "por tratar"); por omissão "novo"/"novos" */
  badgeLabel?: string
  /** só ativo em correspondência exata (para a rota índice) */
  end?: boolean
}

/** Como o leitor de ecrã lê o contador ("Pedidos, 2 novos" e não "Pedidos2"). */
const contagem = (n: DashboardNavItem) => `${n.badge} ${n.badgeLabel ?? (n.badge === 1 ? 'novo' : 'novos')}`

/**
 * Estrutura comum dos painéis (família e instituição): barra lateral fixa no desktop,
 * navegação em pílulas deslizáveis no telemóvel.
 */
export function DashboardShell({
  eyebrow,
  title,
  subtitle,
  identity,
  nav,
  aside,
  children,
}: {
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** bloco de identidade no topo da barra lateral (ex.: nome do lar + selo) */
  identity?: ReactNode
  nav: DashboardNavItem[]
  /** conteúdo extra no fundo da barra lateral (ajuda, atalhos) */
  aside?: ReactNode
  children: ReactNode
}) {
  // no telemóvel, a conta de instituição já navega pelo painel na barra inferior
  const user = useCurrentUser()
  const pilulasMoveis = user?.role !== 'lar'
  // manter a pílula ativa visível (centrada) na fila deslizável
  const fila = useRef<HTMLUListElement>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    const row = fila.current
    const ativo = row?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!row || !ativo) return
    row.scrollTo({ left: ativo.offsetLeft - row.clientWidth / 2 + ativo.clientWidth / 2, behavior: 'smooth' })
  }, [pathname])
  return (
    <div className="flex flex-1 flex-col bg-white">
      <div className="border-b border-line">
        <div className="container-page py-5 sm:py-10">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
          {/* 3xl: os subtítulos dos painéis cabem numa linha (a barra lateral não salta ao mudar de secção) */}
          {subtitle ? <p className="mt-2 max-w-3xl text-lg text-ink-mute">{subtitle}</p> : null}
        </div>
      </div>

      {/* navegação móvel */}
      <nav aria-label="Secções do painel" className={cn('sticky top-16 z-[900] border-b border-line bg-white/85 backdrop-blur-xl lg:hidden', !pilulasMoveis && 'hidden')}>
        {/* overflow-y-hidden: a fila não pode ter scroll vertical próprio, senão "agarra" o gesto vertical da página */}
        <ul ref={fila} className="container-page relative flex snap-x scroll-px-5 gap-2 overflow-x-auto overflow-y-hidden py-3 [scrollbar-width:none]" data-lenis-prevent-horizontal>
          {nav.map((n) => (
            <li key={n.to} className="shrink-0 snap-start">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-medium whitespace-nowrap transition-colors',
                    isActive ? 'bg-ink text-white' : 'bg-sand text-ink-soft hover:bg-sand-deep',
                  )
                }
              >
                <n.icon aria-hidden className="size-4.5" />
                {n.label}
                {!!n.badge && (
                  <>
                    <span aria-hidden className="rounded-full bg-alert-600 px-2 text-xs font-semibold text-white">
                      {n.badge}
                    </span>
                    <span className="sr-only">, {contagem(n)}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="container-page grid flex-1 gap-10 py-8 lg:grid-cols-[15.5rem_1fr] lg:py-12">
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-6">
            {identity && <div className="rounded-[1.5rem] bg-sand p-5">{identity}</div>}
            <nav aria-label="Secções do painel">
              <ul className="flex flex-col gap-1">
                {nav.map((n) => (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      end={n.end}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-[0.9375rem] transition-colors',
                          isActive ? 'bg-sand font-semibold text-ink' : 'text-ink-mute hover:bg-sand/70 hover:text-ink',
                        )
                      }
                    >
                      <n.icon aria-hidden className="size-[1.15rem]" />
                      <span className="flex-1">{n.label}</span>
                      {!!n.badge && (
                        <>
                          <span aria-hidden className="flex min-w-6 items-center justify-center rounded-full bg-alert-600 px-1.5 text-xs font-semibold text-white">
                            {n.badge}
                          </span>
                          <span className="sr-only">, {contagem(n)}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>
            {aside}
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
