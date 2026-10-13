import { useEffect, type ComponentType, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { FileText, Heart, LayoutGrid, Settings, UserRound } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell'
import { useAcesso, useCurrentUser } from '@/lib/store'
import { prefersReducedMotion } from '@/lib/motion'
import { usePedidos, usePerfisOrdenados } from './shared/data'
import { DraftBanner } from './shared/DraftBanner'
import { FamilyIdentity, SidebarHelp } from './shared/Identity'
import { comArtigo, primeiroNome, saudacao } from './shared/text'
import { emLar, entradaPorConfirmar } from './shared/estado'
import ResumoPage from './resumo/ResumoPage'
import PedidosPage from './pedidos/PedidosPage'
import GuardadosPage from './guardados/GuardadosPage'
import PerfilPage from './perfil/PerfilPage'
import ContaPage from './conta/ContaPage'

type Seccao = '' | 'pedidos' | 'guardados' | 'perfil' | 'conta'

/**
 * Secções do painel. Escolhem-se pelo caminho, sem <Routes> aninhadas: dentro de <Routes> descendentes o
 * useNavigate() não é o do router de dados (ignora `flushSync` e não devolve promessa), e o
 * "Terminar sessão" e o "Repor dados" da Conta precisam dele para sair antes de a sessão acabar.
 */
const PAGINAS = new Map<Seccao, ComponentType>([
  ['', ResumoPage],
  ['pedidos', PedidosPage],
  ['guardados', GuardadosPage],
  ['perfil', PerfilPage],
  ['conta', ContaPage],
])

const TITULOS: Record<Exclude<Seccao, ''>, { title: string; subtitle: string }> = {
  pedidos: { title: 'Pedidos', subtitle: 'Em que ponto está cada pedido e quanto deverá esperar.' },
  guardados: { title: 'Guardados', subtitle: 'Compare lado a lado e saiba logo quando abre vaga.' },
  perfil: { title: 'Perfil de cuidados', subtitle: 'Quem precisa de cuidados, de quais e onde.' },
  conta: { title: 'Conta', subtitle: 'Contactos, Acesso Família, avisos e sessão.' },
}

/** Versão grátis: sem prometer o que é do Acesso Família (previsão, comparação, avisos de vaga). */
const SUBTITULOS_GRATIS: Partial<Record<Exclude<Seccao, ''>, string>> = {
  pedidos: 'Em que ponto está cada pedido.',
  guardados: 'As instituições que guardou, sempre à mão.',
}

/** Painel da família: rotas aninhadas em /familia/*, dentro do DashboardShell (que desenha o h1). */
export default function FamilyDashboard() {
  const user = useCurrentUser()!
  const { completo } = useAcesso()
  const { pathname } = useLocation()
  const { principal } = usePerfisOrdenados()
  const { ativos, emCurso, admitidos } = usePedidos()
  const resto = pathname.replace(/^\/familia\/?/, '').replace(/\/$/, '')
  const seccao = (resto.split('/')[0] ?? '') as Seccao
  // /familia/<secção> exato; qualquer outro caminho volta ao resumo
  const Pagina = resto.includes('/') ? undefined : PAGINAS.get(seccao)
  const propostas = ativos.filter((p) => p.c.estado === 'vaga_proposta').length
  // a instituição registou a entrada e espera a confirmação da família
  const porConfirmar = admitidos.filter((p) => entradaPorConfirmar(p.c)).length
  const entrada = principal && admitidos.find((p) => p.c.perfilId === principal.id)

  const nav: DashboardNavItem[] = [
    { to: '/familia', label: 'Resumo', icon: LayoutGrid, end: true },
    { to: '/familia/pedidos', label: 'Pedidos', icon: FileText, badge: propostas + porConfirmar || undefined, badgeLabel: 'por responder' },
    { to: '/familia/guardados', label: 'Guardados', icon: Heart },
    { to: '/familia/perfil', label: 'Perfil de cuidados', icon: UserRound },
    { to: '/familia/conta', label: 'Conta', icon: Settings },
  ]

  let title: ReactNode
  let subtitle: ReactNode
  if (seccao && Pagina) {
    title = TITULOS[seccao].title
    subtitle = (!completo && SUBTITULOS_GRATIS[seccao]) || TITULOS[seccao].subtitle
  } else {
    title = (
      <>
        {saudacao()}, <em>{primeiroNome(user.nome)}</em>.
      </>
    )
    if (propostas) subtitle = propostas === 1 ? 'Há uma vaga à espera da sua resposta.' : `Há ${propostas} vagas à espera da sua resposta.`
    else if (porConfirmar) subtitle = porConfirmar === 1 ? 'Há uma entrada por confirmar.' : `Há ${porConfirmar} entradas por confirmar.`
    else if (principal && entrada) {
      const quem = comArtigo(principal)
      subtitle = `${quem.charAt(0).toUpperCase()}${quem.slice(1)} entrou ${emLar(entrada.lar.nome)}.`
    } else if (principal && emCurso.length)
      subtitle = `${emCurso.length === 1 ? 'Um pedido' : `${emCurso.length} pedidos`} em curso para ${comArtigo(principal)}.`
    else if (principal) subtitle = `A procurar lar para ${comArtigo(principal)}.`
    else subtitle = 'Comece por descrever a pessoa de quem cuida.'
  }

  // telemóvel: a pílula da secção ativa fica sempre à vista na faixa deslizável
  useEffect(() => {
    const ul = document.querySelector<HTMLElement>('nav.sticky[aria-label="Secções do painel"] ul')
    const ativo = ul?.querySelector<HTMLElement>('a[aria-current="page"]')
    if (!ul || !ativo || ul.scrollWidth <= ul.clientWidth) return
    const a = ativo.getBoundingClientRect()
    const u = ul.getBoundingClientRect()
    ul.scrollBy({ left: a.left + a.width / 2 - (u.left + u.width / 2), behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }, [seccao])

  // a moldura (barra lateral, pílulas) fica; o título e o conteúdo da secção mudam com uma transição curta
  const chave = seccao || 'resumo'
  const entra = 'block motion-safe:animate-[fade-up_.6s_cubic-bezier(.16,1,.3,1)_both]'

  return (
    <DashboardShell
      eyebrow="Painel da família"
      title={
        <span key={chave} className={entra}>
          {title}
        </span>
      }
      subtitle={
        subtitle && (
          <span key={chave} className={entra} style={{ animationDelay: '60ms' }}>
            {subtitle}
          </span>
        )
      }
      nav={nav}
      identity={<FamilyIdentity user={user} perfil={principal} entrou={Boolean(entrada)} />}
      aside={<SidebarHelp />}
    >
      <DraftBanner />
      <div key={chave} className="motion-safe:animate-[fade-in_.4s_ease-out_both]">
        {Pagina ? <Pagina /> : <Navigate to="/familia" replace />}
      </div>
    </DashboardShell>
  )
}
