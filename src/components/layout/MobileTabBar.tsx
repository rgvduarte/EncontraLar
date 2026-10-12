import { useEffect } from 'react'
import { NavLink, useLocation } from 'react-router'
import {
  BarChart3,
  CircleUserRound,
  Compass,
  FileText,
  Heart,
  House,
  Inbox,
  LayoutGrid,
  Map,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useCandidaturasDoLar, useCurrentUser } from '@/lib/store'
import { cn } from '@/lib/cn'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
  /** regra de ativação própria (ex.: Painel ativo em /familia/* exceto guardados) */
  ativo?: (pathname: string) => boolean
}

/** Rotas de fluxo focado (têm a sua própria barra de ação no fundo) — sem barra de abas. */
const ESCONDER = [/^\/lar\//, /^\/encontrar/, /^\/entrar/, /^\/registar/]

export function useTabBarVisible() {
  const { pathname } = useLocation()
  return !ESCONDER.some((r) => r.test(pathname))
}

/**
 * Barra de navegação inferior (telemóvel e tablet), ao alcance do polegar — como numa app nativa.
 * Define <html data-tabbar="on"> para que --tabbar-h reserve o espaço certo.
 */
export function MobileTabBar() {
  const user = useCurrentUser()
  const visible = useTabBarVisible()
  const { pathname } = useLocation()
  const pedidos = useCandidaturasDoLar(user?.role === 'lar' ? user.larId : undefined)
  const novos = pedidos.filter((c) => c.estado === 'enviada').length

  useEffect(() => {
    document.documentElement.dataset.tabbar = visible ? 'on' : 'off'
  }, [visible])

  if (!visible) return null

  const tabs: Tab[] =
    user?.role === 'lar'
      ? [
          { to: '/gestao', label: 'Resumo', icon: LayoutGrid, end: true },
          { to: '/gestao/vagas', label: 'Vagas', icon: SlidersHorizontal },
          { to: '/gestao/pedidos', label: 'Pedidos', icon: Inbox, badge: novos },
          { to: '/gestao/previsao', label: 'Previsão', icon: BarChart3 },
          { to: '/gestao/ficha', label: 'Ficha', icon: FileText },
        ]
      : [
          { to: '/', label: 'Início', icon: House, end: true },
          { to: '/pesquisa', label: 'Mapa', icon: Map },
          { to: '/encontrar', label: 'Escolher', icon: Compass },
          { to: user ? '/familia/guardados' : '/entrar?voltar=%2Ffamilia%2Fguardados', label: 'Guardados', icon: Heart },
          user
            ? { to: '/familia', label: 'Painel', icon: CircleUserRound, ativo: (p: string) => p.startsWith('/familia') && !p.startsWith('/familia/guardados') }
            : { to: '/entrar', label: 'Entrar', icon: CircleUserRound },
        ]

  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-black/[0.08] bg-white/88 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      <ul className="mx-auto grid h-[4.25rem] max-w-xl grid-cols-5">
        {tabs.map((t) => (
          <li key={t.label}>
            <NavLink
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 text-[0.8125rem] leading-none font-medium transition-colors',
                  (t.ativo ? t.ativo(pathname) : isActive) ? 'text-ink' : 'text-ink-mute active:text-ink',
                )
              }
            >
              {({ isActive: navAtivo }) => {
                const isActive = t.ativo ? t.ativo(pathname) : navAtivo
                return (
                <>
                  <span className="relative">
                    <t.icon aria-hidden className="size-6" strokeWidth={isActive ? 2.3 : 1.8} />
                    {!!t.badge && (
                      <span className="absolute -top-1.5 -right-2.5 flex min-w-[1.15rem] items-center justify-center rounded-full bg-alert-600 px-1 text-[0.6875rem] font-semibold text-white ring-2 ring-white">
                        {t.badge}
                      </span>
                    )}
                  </span>
                  {t.label}
                </>
                )
              }}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
