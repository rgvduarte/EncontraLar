import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import {
  Bell,
  BellRing,
  CalendarCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  Info,
  LayoutDashboard,
  LogOut,
  Search,
} from 'lucide-react'
import { Logo } from './Logo'
import { terminarSessao } from './RequireAuth'
import { ultimaPesquisa } from './MobileTabBar'
import { ButtonLink, buttonClasses } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { useLenis } from '@/components/motion/SmoothScroll'
import { loginDemo, marcarNotificacaoLida, marcarTodasLidas, useCurrentUser, useLares, useNotificacoes } from '@/lib/store'
import { useDismiss } from '@/lib/hooks'
import { tempoRelativo } from '@/lib/format'
import { vagaParaNovos } from '@/lib/forecast'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { DEMO_LAR_EMAIL } from '@/data/seed'
import type { Distrito, Notificacao, Role } from '@/types'

export function painelPath(role: Role) {
  return role === 'lar' ? '/gestao' : role === 'profissional' ? '/casos' : '/familia'
}

// ————————————————————————————————————————— conteúdo dos menus

interface MenuLink {
  to: string
  label: string
  /** texto secundário (ex.: contagem) */
  meta?: string
  action?: 'demo-lar'
}
interface MenuColumn {
  titulo: string
  /** ligações grandes (primeira coluna, estilo Apple) */
  big?: boolean
  links: MenuLink[]
}
interface MenuDef {
  id: string
  label: string
  to: string
  columns: MenuColumn[]
}

const DISTRITOS_MENU: Distrito[] = ['Porto', 'Lisboa', 'Braga', 'Coimbra', 'Setúbal', 'Faro', 'Évora']

function useMenus(): MenuDef[] {
  const lares = useLares()
  return useMemo(() => {
    // o mesmo critério do filtro "Com vaga agora" da pesquisa: lugar livre para quem pede hoje
    const comVaga = lares.filter((l) => vagaParaNovos(l)).length
    return [
      {
        id: 'mapa',
        label: 'Mapa de vagas',
        to: '/pesquisa',
        columns: [
          {
            titulo: 'Explorar',
            big: true,
            links: [
              { to: '/pesquisa', label: 'Mapa de vagas' },
              { to: '/pesquisa?vaga=agora', label: 'Com vaga agora', meta: String(comVaga) },
              { to: '/pesquisa?vaga=breve', label: 'Vaga em breve' },
            ],
          },
          {
            titulo: 'Por distrito',
            links: DISTRITOS_MENU.map((d) => ({
              to: `/pesquisa?distrito=${encodeURIComponent(d)}`,
              label: d,
              meta: String(lares.filter((l) => l.distrito === d).length),
            })),
          },
          {
            titulo: 'Por necessidade',
            links: [
              { to: '/pesquisa?cuidados=demencia', label: 'Demência e Alzheimer' },
              { to: '/pesquisa?cuidados=acamados', label: 'Pessoas acamadas' },
              { to: '/pesquisa?cuidados=enfermagem24h', label: 'Enfermagem 24 horas' },
              { to: '/pesquisa?ss=1', label: 'Com acordo da Segurança Social' },
              { to: '/pesquisa?tipo=residencia', label: 'Residências seniores' },
            ],
          },
        ],
      },
      {
        id: 'escolher',
        label: 'Ajuda-me a escolher',
        to: '/encontrar',
        columns: [
          {
            titulo: 'Decidir com calma',
            big: true,
            links: [
              { to: '/encontrar', label: 'Responder a 6 perguntas' },
              { to: '/familia/guardados', label: 'Comparar guardados' },
            ],
          },
          {
            titulo: 'Antes de decidir',
            links: [
              { to: '/guia#visita', label: 'O que ver na visita' },
              { to: '/guia#tipos', label: 'Lar, residência ou centro de dia?' },
              { to: '/guia#alerta', label: 'Sinais de alerta' },
            ],
          },
        ],
      },
      {
        id: 'guia',
        label: 'Guia e apoios',
        to: '/guia',
        columns: [
          {
            titulo: 'Guia para famílias',
            big: true,
            links: [
              { to: '/guia', label: 'Guia completo' },
              { to: '/guia#apoios', label: 'Custos e apoios' },
              { to: '/guia#linhas', label: 'Linhas de apoio' },
            ],
          },
          {
            titulo: 'Transparência',
            links: [
              { to: '/sobre#previsao', label: 'Como calculamos a previsão' },
              { to: '/sobre', label: 'Sobre o EncontraLar' },
              { to: '/privacidade', label: 'Privacidade e dados de saúde' },
            ],
          },
        ],
      },
      {
        id: 'inst',
        label: 'Instituições',
        to: '/para-lares',
        columns: [
          {
            titulo: 'Para lares e residências',
            big: true,
            links: [
              { to: '/para-lares', label: 'Porquê o EncontraLar' },
              { to: '/registar?tipo=lar', label: 'Registar instituição' },
              { to: '/gestao', label: 'Ver painel de demonstração', action: 'demo-lar' },
            ],
          },
          { titulo: 'Já tem conta?', links: [{ to: '/entrar', label: 'Entrar no painel' }] },
        ],
      },
    ]
  }, [lares])
}

// ————————————————————————————————————————— notificações e conta

const NOTIF_ICON: Record<Notificacao['tipo'], typeof Bell> = {
  vaga: BellRing,
  candidatura: FileText,
  visita: CalendarCheck,
  sistema: Info,
}

/** As notificações do lar apontam para /gestao: com um pedido associado, abre-se o próprio pedido. */
function destinoDaNotificacao(n: Notificacao): string | undefined {
  if (n.link === '/gestao' && n.candidaturaId) return `/gestao/pedidos?pedido=${encodeURIComponent(n.candidaturaId)}`
  return n.link
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
        className="relative flex size-11 items-center justify-center rounded-full text-ink transition-colors hover:bg-sand"
      >
        <Bell aria-hidden className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex min-w-5 items-center justify-center rounded-full bg-alert-600 px-1 text-xs font-semibold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-[4.25rem] z-[1100] origin-top-right animate-pop-in overflow-hidden rounded-[1.5rem] bg-white/95 shadow-lift ring-1 ring-black/5 backdrop-blur-2xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[26rem]">
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <p className="text-lg font-semibold">Notificações</p>
            {unread > 0 && (
              <button type="button" onClick={() => marcarTodasLidas()} className="min-h-10 text-sm text-terra-600 hover:underline">
                Marcar como lidas
              </button>
            )}
          </div>
          {notifs.length === 0 ? (
            <p className="px-5 pt-4 pb-8 text-center text-ink-mute">Ainda não tem notificações.</p>
          ) : (
            <ul className="max-h-[min(60vh,32rem)] overflow-y-auto px-2 pb-2" data-lenis-prevent>
              {notifs.slice(0, 8).map((n) => {
                const Icon = NOTIF_ICON[n.tipo]
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => {
                        marcarNotificacaoLida(n.id)
                        setOpen(false)
                        const destino = destinoDaNotificacao(n)
                        if (destino) navigate(destino)
                      }}
                      className="flex w-full gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-sand"
                    >
                      <span className={cn('mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full', n.tipo === 'vaga' ? 'bg-leaf-50 text-leaf-600' : 'bg-sand text-ink-soft')}>
                        <Icon aria-hidden className="size-4.5" />
                      </span>
                      <span className="flex-1">
                        <span className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{n.titulo}</span>
                          {!n.lida && <span className="mt-2 size-2 shrink-0 rounded-full bg-terra-600" aria-label="Por ler" />}
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
        className="flex min-h-11 items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition-colors hover:bg-sand"
      >
        <Avatar nome={user.nome} className="size-8 text-xs" />
        <span className="max-w-32 truncate text-[0.9375rem] font-medium">{user.nome.split(' ')[0]}</span>
        <ChevronDown aria-hidden className={cn('size-4 text-ink-mute transition-transform duration-300', open && 'rotate-180')} />
        <span className="sr-only">Menu da conta</span>
      </button>
      {open && (
        <div className="absolute right-0 z-[1100] mt-2 w-72 origin-top-right animate-pop-in overflow-hidden rounded-[1.5rem] bg-white/95 p-2 shadow-lift ring-1 ring-black/5 backdrop-blur-2xl">
          <div className="px-4 py-3">
            <p className="font-semibold">{user.nome}</p>
            <p className="truncate text-sm text-ink-mute">{user.email}</p>
          </div>
          <Link to={painelPath(user.role)} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-2xl px-4 hover:bg-sand">
            <LayoutDashboard aria-hidden className="size-5 text-ink-mute" />
            {user.role === 'lar' ? 'Painel da instituição' : 'O meu painel'}
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              void terminarSessao(navigate)
            }}
            className="flex min-h-12 w-full items-center gap-3 rounded-2xl px-4 hover:bg-sand"
          >
            <LogOut aria-hidden className="size-5 text-ink-mute" />
            Terminar sessão
          </button>
        </div>
      )}
    </div>
  )
}

// ————————————————————————————————————————— cabeçalho

export function Header() {
  const user = useCurrentUser()
  const menus = useMenus()
  const location = useLocation()
  const navigate = useNavigate()
  const lenis = useLenis()
  const [aberto, setAberto] = useState<string | null>(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sub, setSub] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const headerRef = useRef<HTMLElement>(null)
  // limite inferior real do cabeçalho (a faixa de protótipo pode estar por cima)
  const [topo, setTopo] = useState(64)
  useEffect(() => {
    if (!aberto && !mobileOpen) return
    const medir = () => setTopo(Math.max(0, Math.round(headerRef.current?.getBoundingClientRect().bottom ?? 64)))
    medir()
    window.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    return () => {
      window.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
    }
  }, [aberto, mobileOpen])

  // fechar tudo ao mudar de página
  useEffect(() => {
    setAberto(null)
    setMobileOpen(false)
    setSub(null)
  }, [location.pathname, location.search, location.hash])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAberto(null)
        setMobileOpen(false)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // bloquear o scroll do fundo com o menu móvel aberto
  useEffect(() => {
    if (!mobileOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [mobileOpen])

  const abrirComAtraso = (id: string | null, ms = 110) => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setAberto(id), ms)
  }

  const paraOTopo = () => {
    if (lenis) lenis.scrollTo(0)
    else window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }

  const fecharMenus = () => {
    setMobileOpen(false)
    setSub(null)
    setAberto(null)
  }

  const go = (l: MenuLink) => {
    // fechar primeiro: uma ligação para a página onde já se está não muda o endereço (e o menu ficava aberto)
    fecharMenus()
    if (l.action === 'demo-lar') {
      if (!user) {
        // só sem sessão se entra na conta de demonstração da instituição
        loginDemo('lar')
        toast.success('Entrou na conta de demonstração da instituição', 'Pode explorar o painel à vontade: os dados são fictícios.')
        navigate('/gestao')
      } else if (user.email === DEMO_LAR_EMAIL) {
        navigate('/gestao')
      } else {
        // com outra sessão (ex.: uma família) não a trocamos às escondidas: a página para instituições tem o painel em modo de ensaio
        navigate('/para-lares')
      }
      return
    }
    const aqui = location.pathname + location.search + location.hash
    if (l.to === aqui && !location.hash) {
      paraOTopo()
      return
    }
    navigate(l.to)
  }

  // lupa: na pesquisa, sobe e põe o cursor no campo (sem perder os filtros); fora dela, reabre a última pesquisa
  const naPesquisa = location.pathname === '/pesquisa'
  const destinoPesquisa = naPesquisa ? location.pathname + location.search : ultimaPesquisa()
  const abrirPesquisa = (e: React.MouseEvent) => {
    if (!naPesquisa) return
    e.preventDefault()
    fecharMenus()
    paraOTopo()
    document.querySelector<HTMLInputElement>('main input[role="combobox"]')?.focus({ preventScroll: true })
  }

  const menuAtivo = menus.find((m) => m.id === aberto)

  return (
    <>
      {/* véu desfocado sobre a página quando um menu está aberto (desktop) */}
      <div
        aria-hidden
        onClick={() => setAberto(null)}
        style={{ top: topo }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[990] hidden bg-white/35 backdrop-blur-xl transition-opacity duration-500 xl:block',
          menuAtivo ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <header
        ref={headerRef}
        onMouseLeave={() => abrirComAtraso(null, 160)}
        className={cn(
          'sticky top-0 z-[1000] transition-colors duration-300',
          menuAtivo || mobileOpen ? 'bg-white' : 'border-b border-black/[0.06] bg-white/90 backdrop-blur-xl backdrop-saturate-150',
        )}
      >
        {/* na pesquisa (ecrã inteiro) o cabeçalho alinha com a barra de filtros e a lista, de margem a margem */}
        <div className={cn('container-page flex h-16 items-center justify-between gap-4', naPesquisa && 'lg:max-w-none lg:px-6 xl:px-8')}>
          <Link to="/" className="rounded-xl" aria-label="EncontraLar — página inicial" onMouseEnter={() => abrirComAtraso(null)}>
            <Logo />
          </Link>

          <nav aria-label="Principal" className="hidden xl:block">
            <ul className="flex items-center">
              {menus.map((m) => (
                <li key={m.id} className="flex items-center" onMouseEnter={() => abrirComAtraso(m.id)}>
                  <NavLink
                    to={m.to}
                    className={({ isActive }) =>
                      cn(
                        'flex min-h-11 items-center px-3.5 text-[0.9375rem] whitespace-nowrap transition-colors duration-200',
                        // ink-soft (não mute): mantém contraste AA quando o cabeçalho translúcido passa sobre secções pretas
                        isActive || aberto === m.id ? 'text-ink' : 'text-ink-soft hover:text-ink',
                        isActive && 'font-medium',
                      )
                    }
                  >
                    {m.label}
                  </NavLink>
                  <button
                    type="button"
                    aria-expanded={aberto === m.id}
                    aria-controls={`menu-${m.id}`}
                    onClick={() => setAberto((a) => (a === m.id ? null : m.id))}
                    className="-ml-2.5 flex size-7 items-center justify-center rounded-full text-ink-mute opacity-0 focus-visible:opacity-100"
                  >
                    <ChevronDown aria-hidden className="size-3.5" />
                    <span className="sr-only">Abrir menu {m.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2" onMouseEnter={() => abrirComAtraso(null)}>
            <Link
              to={destinoPesquisa}
              onClick={abrirPesquisa}
              aria-label="Pesquisar no mapa de vagas"
              className="flex size-11 items-center justify-center rounded-full text-ink hover:bg-sand xl:hidden"
            >
              <Search aria-hidden className="size-5" />
            </Link>
            {user ? (
              <>
                <NotificationBell />
                {/* conta visível a partir de 1024px (portáteis com zoom, tablets na horizontal), não só em ecrãs largos */}
                <div className="hidden lg:block">
                  <UserMenu />
                </div>
              </>
            ) : (
              <div className="hidden items-center gap-1 lg:flex">
                <Link to="/entrar" className="inline-flex min-h-11 items-center px-3 text-[0.9375rem] text-ink-soft hover:text-ink">
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
              onClick={() => {
                setMobileOpen((o) => !o)
                setSub(null)
              }}
            >
              <span className="relative block h-3.5 w-5" aria-hidden>
                <span className={cn('absolute left-0 h-[1.5px] w-5 rounded bg-ink transition-all duration-300', mobileOpen ? 'top-[6px] rotate-45' : 'top-0.5')} />
                <span className={cn('absolute left-0 h-[1.5px] w-5 rounded bg-ink transition-all duration-300', mobileOpen ? 'top-[6px] -rotate-45' : 'top-[10px]')} />
              </span>
              <span className="sr-only">{mobileOpen ? 'Fechar menu' : 'Abrir menu'}</span>
            </button>
          </div>
        </div>

        {/* painel do menu suspenso (desktop): expande em altura, conteúdo entra escalonado */}
        <div
          className={cn(
            'absolute inset-x-0 top-full hidden overflow-hidden bg-white transition-[grid-template-rows,box-shadow] duration-500 ease-[cubic-bezier(.32,.72,0,1)] xl:grid',
            menuAtivo ? 'grid-rows-[1fr] shadow-[0_30px_40px_-30px_rgba(0,0,0,0.12)]' : 'grid-rows-[0fr]',
          )}
        >
          <div className="min-h-0">
            {menus.map((m) => (
              <div
                key={m.id}
                id={`menu-${m.id}`}
                hidden={aberto !== m.id}
                onMouseEnter={() => abrirComAtraso(m.id, 0)}
                className="container-page flex gap-16 pt-8 pb-14"
              >
                {m.columns.map((c, ci) => (
                  <div key={c.titulo} className={cn(c.big ? 'min-w-64' : 'min-w-48')}>
                    <p className="mb-3 text-xs text-ink-mute">{c.titulo}</p>
                    <ul className="flex flex-col">
                      {c.links.map((l, li) => (
                        <li key={l.label} className="animate-pop-in" style={{ animationDelay: `${60 + ci * 70 + li * 28}ms` }}>
                          <button
                            type="button"
                            onClick={() => go(l)}
                            className={cn(
                              'flex w-full items-baseline gap-2 py-1 text-left transition-colors',
                              c.big ? 'text-2xl font-semibold tracking-tight text-ink hover:text-terra-600' : 'text-[0.9375rem] font-medium text-ink-soft hover:text-ink',
                            )}
                          >
                            {l.label}
                            {l.meta && <span className="text-xs font-normal text-ink-mute tabular">{l.meta}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* menu móvel: ecrã inteiro, entradas escalonadas, subpainéis que deslizam da direita */}
      <div
        id="menu-movel"
        style={{ top: topo }}
        className={cn(
          'fixed inset-x-0 bottom-0 z-[1001] overflow-hidden bg-white transition-[opacity,visibility] duration-300 xl:hidden',
          mobileOpen ? 'visible opacity-100' : 'invisible opacity-0',
        )}
      >
        <nav
          aria-label="Principal (móvel)"
          className={cn(
            'absolute inset-0 flex flex-col overflow-y-auto px-6 pt-4 pb-[calc(2rem+env(safe-area-inset-bottom))] transition-[transform,translate,scale,opacity] duration-500 ease-[cubic-bezier(.32,.72,0,1)]',
            sub ? '-translate-x-1/4 opacity-0' : 'translate-x-0 opacity-100',
          )}
          data-lenis-prevent
        >
          <ul className="flex flex-col">
            {menus.map((m, i) => (
              <li key={m.id} className={mobileOpen ? 'animate-pop-in' : ''} style={{ animationDelay: `${40 + i * 45}ms` }}>
                <button
                  type="button"
                  tabIndex={sub ? -1 : 0}
                  onClick={() => setSub(m.id)}
                  className="flex min-h-16 w-full items-center justify-between text-left text-[1.75rem] font-semibold tracking-tight"
                >
                  {m.label}
                  <ChevronRight aria-hidden className="size-6 text-ink-mute" />
                </button>
              </li>
            ))}
          </ul>
          <div className={cn('mt-auto flex flex-col gap-3 pt-8', mobileOpen && 'animate-pop-in')} style={{ animationDelay: '260ms' }}>
            {user ? (
              <>
                <p className="text-sm text-ink-mute">
                  Sessão iniciada como <span className="font-medium text-ink">{user.nome}</span>
                </p>
                <Link to={painelPath(user.role)} onClick={fecharMenus} className={buttonClasses('primary', 'lg', 'w-full')}>
                  <LayoutDashboard aria-hidden />
                  {user.role === 'lar' ? 'Painel da instituição' : 'O meu painel'}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    fecharMenus()
                    void terminarSessao(navigate)
                  }}
                  className={buttonClasses('subtle', 'lg', 'w-full')}
                >
                  <LogOut aria-hidden /> Terminar sessão
                </button>
              </>
            ) : (
              <>
                <ButtonLink to="/registar" onClick={fecharMenus} variant="primary" size="lg" full>
                  Criar conta gratuita
                </ButtonLink>
                <ButtonLink to="/entrar" onClick={fecharMenus} variant="subtle" size="lg" full>
                  Entrar
                </ButtonLink>
              </>
            )}
          </div>
        </nav>

        {menus.map((m) => (
          <div
            key={m.id}
            className={cn(
              'absolute inset-0 overflow-y-auto bg-white px-6 pt-2 pb-10 transition-transform duration-500 ease-[cubic-bezier(.32,.72,0,1)]',
              sub === m.id ? 'translate-x-0' : 'pointer-events-none translate-x-full',
            )}
            aria-hidden={sub !== m.id}
            data-lenis-prevent
          >
            <button type="button" tabIndex={sub === m.id ? 0 : -1} onClick={() => setSub(null)} className="-ml-2 flex min-h-12 items-center gap-1 text-ink-mute">
              <ChevronLeft aria-hidden className="size-5" /> Voltar
            </button>
            {m.columns.map((c, ci) => (
              <div key={c.titulo} className="mt-5">
                <p className="mb-1 text-sm text-ink-mute">{c.titulo}</p>
                <ul>
                  {c.links.map((l, li) => (
                    <li key={l.label} className={sub === m.id ? 'animate-pop-in' : ''} style={{ animationDelay: `${80 + ci * 60 + li * 35}ms` }}>
                      <button
                        type="button"
                        tabIndex={sub === m.id ? 0 : -1}
                        onClick={() => go(l)}
                        className={cn('flex min-h-12 w-full items-baseline gap-2 text-left', c.big ? 'text-2xl font-semibold tracking-tight' : 'text-lg text-ink-soft')}
                      >
                        {l.label}
                        {l.meta && <span className="text-sm text-ink-mute tabular">{l.meta}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
