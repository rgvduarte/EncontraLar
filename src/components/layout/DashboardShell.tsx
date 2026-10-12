import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { azulejoBg } from '@/components/brand/patterns'

export interface DashboardNavItem {
  /** caminho absoluto, ex.: "/familia/pedidos" */
  to: string
  label: string
  icon: LucideIcon
  /** contador (ex.: pedidos novos) */
  badge?: number
  /** só ativo em correspondência exata (para a rota índice) */
  end?: boolean
}

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
  return (
    <div className="flex flex-1 flex-col bg-sand/40">
      <div className="relative overflow-hidden border-b border-line bg-cream">
        <div aria-hidden className="absolute inset-y-0 right-0 hidden w-1/3 opacity-[0.07] lg:block" style={azulejoBg('#1d564e', 1, 64)} />
        <div className="container-page relative py-7 sm:py-9">
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 max-w-2xl text-lg text-ink-soft">{subtitle}</p>}
        </div>
      </div>

      {/* navegação móvel */}
      <nav aria-label="Secções do painel" className="sticky top-18 z-[900] border-b border-line bg-cream/95 backdrop-blur lg:hidden">
        <ul className="container-page flex gap-2 overflow-x-auto py-3 [scrollbar-width:none]">
          {nav.map((n) => (
            <li key={n.to} className="shrink-0">
              <NavLink
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex min-h-11 items-center gap-2 rounded-full border-2 px-4 font-semibold whitespace-nowrap',
                    isActive ? 'border-pine-700 bg-pine-700 text-white' : 'border-line bg-white text-ink-soft',
                  )
                }
              >
                <n.icon aria-hidden className="size-4.5" />
                {n.label}
                {!!n.badge && <span className="rounded-full bg-terra-600 px-2 text-xs font-bold text-white">{n.badge}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="container-page grid flex-1 gap-8 py-8 lg:grid-cols-[17rem_1fr] lg:py-10">
        <aside className="hidden lg:block">
          <div className="sticky top-24 flex flex-col gap-5">
            {identity && <div className="rounded-3xl border border-line bg-white p-5 shadow-soft">{identity}</div>}
            <nav aria-label="Secções do painel">
              <ul className="flex flex-col gap-1">
                {nav.map((n) => (
                  <li key={n.to}>
                    <NavLink
                      to={n.to}
                      end={n.end}
                      className={({ isActive }) =>
                        cn(
                          'flex min-h-12 items-center gap-3 rounded-2xl px-4 font-semibold transition-colors',
                          isActive ? 'bg-pine-800 text-white shadow-soft' : 'text-ink-soft hover:bg-white hover:text-ink',
                        )
                      }
                    >
                      <n.icon aria-hidden className="size-5" />
                      <span className="flex-1">{n.label}</span>
                      {!!n.badge && (
                        <span className="flex min-w-6 items-center justify-center rounded-full bg-terra-600 px-1.5 text-xs font-bold text-white">
                          {n.badge}
                        </span>
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
