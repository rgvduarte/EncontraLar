import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { FileText, Heart, LayoutGrid, Settings, UserRound } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell'
import { useCurrentUser } from '@/lib/store'
import { usePedidos, usePerfisOrdenados } from './shared/data'
import { DraftBanner } from './shared/DraftBanner'
import { FamilyIdentity, SidebarHelp } from './shared/Identity'
import { comArtigo, primeiroNome, saudacao } from './shared/text'
import ResumoPage from './resumo/ResumoPage'
import PedidosPage from './pedidos/PedidosPage'
import GuardadosPage from './guardados/GuardadosPage'
import PerfilPage from './perfil/PerfilPage'
import ContaPage from './conta/ContaPage'

type Seccao = '' | 'pedidos' | 'guardados' | 'perfil' | 'conta'

const TITULOS: Record<Exclude<Seccao, ''>, { title: string; subtitle: string }> = {
  pedidos: { title: 'Pedidos', subtitle: 'Em que ponto está cada pedido e quanto deverá esperar.' },
  guardados: { title: 'Guardados', subtitle: 'Compare lado a lado e saiba logo quando abre vaga.' },
  perfil: { title: 'Perfil de cuidados', subtitle: 'Quem precisa de cuidados, de quais e onde.' },
  conta: { title: 'Conta', subtitle: 'Contactos, avisos e sessão.' },
}

/** Painel da família: rotas aninhadas em /familia/*, dentro do DashboardShell (que desenha o h1). */
export default function FamilyDashboard() {
  const user = useCurrentUser()!
  const { pathname } = useLocation()
  const { principal } = usePerfisOrdenados()
  const { ativos } = usePedidos()
  const seccao = (pathname.replace(/^\/familia\/?/, '').split('/')[0] ?? '') as Seccao
  const propostas = ativos.filter((p) => p.c.estado === 'vaga_proposta').length

  const nav: DashboardNavItem[] = [
    { to: '/familia', label: 'Resumo', icon: LayoutGrid, end: true },
    { to: '/familia/pedidos', label: 'Pedidos', icon: FileText, badge: propostas || undefined },
    { to: '/familia/guardados', label: 'Guardados', icon: Heart },
    { to: '/familia/perfil', label: 'Perfil de cuidados', icon: UserRound },
    { to: '/familia/conta', label: 'Conta', icon: Settings },
  ]

  let title: ReactNode
  let subtitle: ReactNode
  if (seccao && seccao in TITULOS) {
    title = TITULOS[seccao].title
    subtitle = TITULOS[seccao].subtitle
  } else {
    title = (
      <>
        {saudacao()}, <em>{primeiroNome(user.nome)}</em>.
      </>
    )
    if (propostas) subtitle = propostas === 1 ? 'Há uma vaga à espera da sua resposta.' : `Há ${propostas} vagas à espera da sua resposta.`
    else if (principal && ativos.length)
      subtitle = `${ativos.length === 1 ? 'Um pedido' : `${ativos.length} pedidos`} em curso para ${comArtigo(principal)}.`
    else if (principal) subtitle = `A procurar lar para ${comArtigo(principal)}.`
    else subtitle = 'Comece por descrever a pessoa de quem cuida.'
  }

  return (
    <DashboardShell
      eyebrow="Painel da família"
      title={title}
      subtitle={subtitle}
      nav={nav}
      identity={<FamilyIdentity user={user} perfil={principal} />}
      aside={<SidebarHelp />}
    >
      <DraftBanner />
      <Routes>
        <Route index element={<ResumoPage />} />
        <Route path="pedidos" element={<PedidosPage />} />
        <Route path="guardados" element={<GuardadosPage />} />
        <Route path="perfil" element={<PerfilPage />} />
        <Route path="conta" element={<ContaPage />} />
        <Route path="*" element={<Navigate to="/familia" replace />} />
      </Routes>
    </DashboardShell>
  )
}
