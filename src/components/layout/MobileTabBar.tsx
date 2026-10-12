import { useEffect } from 'react'
import { Link, useLocation } from 'react-router'
import {
  BarChart3,
  CircleUserRound,
  Compass,
  FileText,
  FolderOpen,
  Heart,
  House,
  Inbox,
  LayoutGrid,
  Map,
  SquarePlus,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import { useCandidaturasDoLar, useCurrentUser } from '@/lib/store'
import { pedidosPorTratar } from '@/features/lar-dashboard/lib/derive'
import { useLenis } from '@/components/motion/SmoothScroll'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'

interface Tab {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  badge?: number
  /** como o número é lido pelo leitor de ecrã (ex.: "por tratar") */
  badgeLabel?: string
  /** regra de ativação própria (ex.: Painel ativo em /familia/* exceto guardados) */
  ativo?: (pathname: string) => boolean
}

/**
 * Rotas de fluxo focado (têm a sua própria barra de ação no fundo) — sem barra de abas.
 * /confirmar/:token é o link de confirmação de vagas, aberto sem sessão a partir de um SMS ou email: um só ecrã, sem navegação.
 */
const ESCONDER = [/^\/lar\//, /^\/encontrar/, /^\/entrar/, /^\/registar/, /^\/confirmar(\/|$)/]

export function useTabBarVisible() {
  const { pathname } = useLocation()
  return !ESCONDER.some((r) => r.test(pathname))
}

/** A página de pesquisa guarda aqui o seu último endereço (para o separador Mapa e a lupa a reabrirem). */
export const CHAVE_ULTIMA_PESQUISA = 'encontralar:ultima-pesquisa'

/** Endereço da última pesquisa desta sessão ("/pesquisa?distrito=Porto&vaga=agora"), ou "/pesquisa". */
export function ultimaPesquisa(): string {
  let v: string | null = null
  try {
    v = sessionStorage.getItem(CHAVE_ULTIMA_PESQUISA)
  } catch {
    /* sem armazenamento: pesquisa nova */
  }
  if (!v) return '/pesquisa'
  v = v.trim().replace(/^#/, '')
  if (v.startsWith('/pesquisa')) return v
  if (v.startsWith('?')) return `/pesquisa${v}`
  if (v && !v.startsWith('/') && !v.includes('//')) return `/pesquisa?${v}`
  return '/pesquisa'
}

/**
 * Barra de navegação inferior (telemóvel e tablet), ao alcance do polegar — como numa app nativa.
 * Define <html data-tabbar="on"> para que --tabbar-h reserve o espaço certo.
 * Tocar no separador já ativo (na sua página inicial) volta ao topo, sem perder a pesquisa ou os filtros.
 */
export function MobileTabBar() {
  const user = useCurrentUser()
  const visible = useTabBarVisible()
  const { pathname } = useLocation()
  const lenis = useLenis()
  const pedidos = useCandidaturasDoLar(user?.role === 'lar' ? user.larId : undefined)
  // o mesmo número que a barra lateral do painel: pedidos novos + visitas por confirmar (sem contar duas vezes)
  const porTratar = user?.role === 'lar' ? pedidosPorTratar(pedidos) : 0

  useEffect(() => {
    document.documentElement.dataset.tabbar = visible ? 'on' : 'off'
  }, [visible])

  if (!visible) return null

  const tabs: Tab[] =
    user?.role === 'profissional'
      ? [
          // Casos fica ativo na lista e no detalhe de um caso, mas não em "Novo caso" (que tem separador próprio)
          { to: '/casos', label: 'Casos', icon: FolderOpen, end: true, ativo: (p: string) => /^\/casos(\/|$)/.test(p) && !/^\/casos\/novo(\/|$)/.test(p) },
          { to: '/casos/novo', label: 'Novo caso', icon: SquarePlus },
          // a pesquisa serve para escolher instituições a quem enviar o caso: volta à última desta sessão
          { to: ultimaPesquisa(), label: 'Mapa', icon: Map },
          { to: '/', label: 'Início', icon: House, end: true },
        ]
      : user?.role === 'lar'
      ? [
          { to: '/gestao', label: 'Resumo', icon: LayoutGrid, end: true },
          { to: '/gestao/vagas', label: 'Vagas', icon: SlidersHorizontal },
          { to: '/gestao/pedidos', label: 'Pedidos', icon: Inbox, badge: porTratar, badgeLabel: 'por tratar' },
          { to: '/gestao/previsao', label: 'Previsão', icon: BarChart3 },
          { to: '/gestao/ficha', label: 'Ficha', icon: FileText },
        ]
      : [
          { to: '/', label: 'Início', icon: House, end: true },
          // volta à última pesquisa desta sessão (com os filtros), não a uma pesquisa em branco
          { to: ultimaPesquisa(), label: 'Mapa', icon: Map },
          { to: '/encontrar', label: 'Escolher', icon: Compass },
          { to: user ? '/familia/guardados' : '/entrar?voltar=%2Ffamilia%2Fguardados', label: 'Guardados', icon: Heart },
          user
            ? { to: '/familia', label: 'Painel', icon: CircleUserRound, ativo: (p: string) => p.startsWith('/familia') && !p.startsWith('/familia/guardados') }
            : { to: '/entrar', label: 'Entrar', icon: CircleUserRound },
        ]

  const paraOTopo = () => {
    if (lenis) lenis.scrollTo(0)
    else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  return (
    <nav
      aria-label="Navegação principal"
      data-fundo-do-menu
      className="fixed inset-x-0 bottom-0 z-[1000] border-t border-black/[0.08] bg-white/88 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
    >
      {/* uma coluna por separador (5 para famílias e instituições, 4 para profissionais) */}
      <ul className="mx-auto grid h-[4.25rem] max-w-xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((t) => {
          const raiz = t.to.split('?')[0]!
          // um só estado ativo (visual e aria-current), calculado uma vez
          const ativo = t.ativo ? t.ativo(pathname) : t.end ? pathname === raiz : pathname === raiz || pathname.startsWith(`${raiz}/`)
          return (
            <li key={t.label}>
              <Link
                to={t.to}
                aria-current={ativo ? 'page' : undefined}
                onClick={(e) => {
                  if (ativo && pathname === raiz) {
                    e.preventDefault()
                    paraOTopo()
                  }
                }}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 text-[0.8125rem] leading-none font-medium transition-colors',
                  ativo ? 'text-ink' : 'text-ink-mute active:text-ink',
                )}
              >
                <span className="relative">
                  <t.icon aria-hidden className="size-6" strokeWidth={ativo ? 2.3 : 1.8} />
                  {!!t.badge && (
                    <span
                      aria-hidden
                      className="absolute -top-1.5 -right-2.5 flex min-w-[1.15rem] items-center justify-center rounded-full bg-alert-600 px-1 text-[0.6875rem] font-semibold text-white ring-2 ring-white"
                    >
                      {t.badge}
                    </span>
                  )}
                </span>
                {t.label}
                {!!t.badge && (
                  <span className="sr-only">
                    , {t.badge} {t.badgeLabel ?? (t.badge === 1 ? 'novo' : 'novos')}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
