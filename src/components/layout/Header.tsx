import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import {
  Bell,
  Building2,
  BellRing,
  CalendarCheck,
  ChevronDown,
  FileText,
  Info,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  X,
} from 'lucide-react'
import { Logo } from './Logo'
import { ButtonLink, buttonClasses } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/misc'
import { logout, marcarNotificacaoLida, marcarTodasLidas, useCurrentUser, useNotificacoes } from '@/lib/store'
import { useDismiss } from '@/lib/hooks'
import { tempoRelativo } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Notificacao } from '@/types'

/** Navegação para famílias (público principal). A área das instituições fica à parte, à direita. */
const NAV = [
  { to: '/pesquisa', label: 'Mapa de vagas' },
  { to: '/encontrar', label: 'Ajuda-me a escolher' },
  { to: '/guia', label: 'Guia e apoios' },
]

export function painelPath(role: 'familia' | 'lar') {
  return role === 'lar' ? '/gestao' : '/familia'
}

const NOTIF_ICON: Record<Notificacao['tipo'], typeof Bell> = {
  vaga: BellRing,
  candidatura: FileText,
  visita: CalendarCheck,
  sistema: Info,
}

function NotificationBell() {
  const notifs = useNotificacoes()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, ref, close)
  const unread = notifs.filter((n) => !n.lida).length

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label={unread ? `Notificações: ${unread} por ler` : 'Notificações'}
        className="relative flex size-11 items-center justify-center rounded-full text-ink hover:bg-sand"
      >
        <Bell aria-hidden className="size-5.5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-alert-600 px-1 text-xs font-semibold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-[1100] mt-2 w-[min(26rem,calc(100vw-2rem))] animate-fade-up overflow-hidden rounded-[1.5rem] bg-white shadow-lift ring-1 ring-black/5">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <p className="text-lg font-semibold">Notificações</p>
            {unread > 0 && (
              <button type="button" onClick={() => marcarTodasLidas()} className="link min-h-10 text-sm">
                Marcar todas como lidas
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <p className="px-5 py-8 text-center text-ink-soft">Ainda não tem notificações.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-line overflow-y-auto">
              {notifs.slice(0, 8).map((n) => {
                const Icon = NOTIF_ICON[n.tipo]
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        marcarNotificacaoLida(n.id)
                        setOpen(false)
                        if (n.link) navigate(n.link)
                      }}
                      className={cn('flex w-full gap-3 px-5 py-4 text-left hover:bg-sand/70', !n.lida && 'bg-terra-50/50')}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full',
                          n.tipo === 'vaga' ? 'bg-leaf-50 text-leaf-600' : 'bg-sand text-ink-soft',
                        )}
                      >
                        <Icon aria-hidden className="size-5" />
                      </span>
                      <span className="flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{n.titulo}</span>
                          {!n.lida && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-terra-600" aria-label="Por ler" />}
                        </span>
                        <span className="mt-0.5 block text-sm text-ink-soft">{n.texto}</span>
                        <span className="mt-1 block text-xs text-ink-mute">{tempoRelativo(n.criadaEm)}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

function UserMenu() {
  const user = useCurrentUser()!
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, ref, close)
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex min-h-12 items-center gap-2 rounded-full py-1 pr-3 pl-1 hover:bg-sand"
      >
        <Avatar nome={user.nome} className="size-8 text-xs" />
        <span className="hidden max-w-36 truncate text-[0.9375rem] font-medium xl:inline">{user.nome.split(' ')[0]}</span>
        <ChevronDown aria-hidden className="size-5 text-ink-soft" />
        <span className="sr-only">Menu da conta</span>
      </button>
      {open && (
        <div className="absolute right-0 z-[1100] mt-2 w-72 animate-fade-up overflow-hidden rounded-[1.5rem] bg-white p-2 shadow-lift ring-1 ring-black/5">
          <div className="px-4 py-3">
            <p className="font-semibold">{user.nome}</p>
            <p className="truncate text-sm text-ink-soft">{user.email}</p>
            <p className="mt-1 text-xs font-medium text-ink-mute">
              {user.role === 'lar' ? 'Conta de instituição' : 'Conta de família'}
            </p>
          </div>
          <Link
            to={painelPath(user.role)}
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center gap-3 rounded-2xl px-4 font-medium hover:bg-sand"
          >
            <LayoutDashboard aria-hidden className="size-5 text-ink-mute" />
            {user.role === 'lar' ? 'Painel da instituição' : 'O meu painel'}
          </Link>
          <button
            type="button"
            onClick={() => {
              logout()
              setOpen(false)
              navigate('/')
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 font-medium hover:bg-sand"
          >
            <LogOut aria-hidden className="size-5 text-ink-mute" />
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

export function Header() {
  const user = useCurrentUser()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => setMobileOpen(false), [location.pathname])

  return (
    <header className="sticky top-0 z-[1000] border-b border-black/[0.06] bg-white/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Link to="/" className="rounded-xl" aria-label="EncontraLar — página inicial">
          <Logo />
        </Link>

        <nav aria-label="Principal" className="hidden xl:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => (
              <li key={n.to}>
                <NavLink
                  to={n.to}
                  className={({ isActive }) =>
                    cn(
                      'flex min-h-11 items-center px-3.5 text-[0.9375rem] whitespace-nowrap transition-colors',
                      isActive ? 'font-medium text-ink' : 'text-ink-mute hover:text-ink',
                    )
                  }
                >
                  {n.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <NotificationBell />
              <div className="hidden xl:block">
                <UserMenu />
              </div>
            </>
          ) : (
            <div className="hidden items-center gap-2 xl:flex">
              <Link to="/para-lares" className="inline-flex min-h-11 items-center gap-1.5 px-3 text-[0.9375rem] text-ink-mute hover:text-ink">
                <Building2 aria-hidden className="size-4" /> Sou uma instituição
              </Link>
              <Link to="/entrar" className="inline-flex min-h-11 items-center px-3 text-[0.9375rem] text-ink-mute hover:text-ink">
                Entrar
              </Link>
              <ButtonLink to="/registar" variant="primary" size="sm" className="ml-1">
                Criar conta
              </ButtonLink>
            </div>
          )}
          <button
            type="button"
            className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-sand xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="menu-movel"
            onClick={() => setMobileOpen((o) => !o)}
          >
            {mobileOpen ? <X aria-hidden className="size-6" /> : <Menu aria-hidden className="size-6" />}
            <span className="sr-only">{mobileOpen ? 'Fechar menu' : 'Abrir menu'}</span>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="menu-movel" className="animate-fade-in border-t border-black/[0.06] bg-white xl:hidden">
          <nav aria-label="Principal (móvel)" className="container-page flex flex-col gap-1 py-6">
            <Link to="/pesquisa" className={buttonClasses('primary', 'lg', 'mb-4 w-full')}>
              <Search aria-hidden className="size-5" /> Procurar no mapa de vagas
            </Link>
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  cn('flex min-h-14 items-center border-b border-line px-1 text-2xl font-semibold tracking-tight', isActive ? 'text-ink' : 'text-ink-soft hover:text-ink')
                }
              >
                {n.label}
              </NavLink>
            ))}
            <NavLink
              to="/para-lares"
              className={({ isActive }) =>
                cn('flex min-h-14 items-center gap-3 px-1 text-lg font-medium', isActive ? 'text-ink' : 'text-ink-mute hover:text-ink')
              }
            >
              <Building2 aria-hidden className="size-5" /> Sou uma instituição
            </NavLink>
            <div className="mt-3 border-t border-line pt-4">
              {user ? (
                <div className="flex flex-col gap-2">
                  <p className="px-4 text-sm text-ink-soft">
                    Sessão iniciada como <strong className="text-ink">{user.nome}</strong>
                  </p>
                  <Link to={painelPath(user.role)} className={buttonClasses('secondary', 'lg', 'w-full')}>
                    <LayoutDashboard aria-hidden className="size-5" />
                    {user.role === 'lar' ? 'Painel da instituição' : 'O meu painel'}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      navigate('/')
                    }}
                    className={buttonClasses('ghost', 'lg', 'w-full')}
                  >
                    <LogOut aria-hidden className="size-5" /> Terminar sessão
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <ButtonLink to="/entrar" variant="secondary" size="lg">
                    Entrar
                  </ButtonLink>
                  <ButtonLink to="/registar" variant="primary" size="lg">
                    Criar conta
                  </ButtonLink>
                </div>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
