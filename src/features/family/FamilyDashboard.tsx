import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { FileText, Heart, LayoutDashboard, Settings, UserRoundPen } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell'
import { useCurrentUser } from '@/lib/store'
import { usePedidos, usePerfisOrdenados, visitasFuturas } from './shared/data'
import { DraftBanner } from './shared/DraftBanner'
import { FamilyIdentity, HelpCard } from './shared/SidebarBits'
import { comArtigo, diaPorExtenso, primeiroNome, saudacao } from './shared/text'
import ResumoPage from './resumo/ResumoPage'
import PedidosPage from './pedidos/PedidosPage'
import GuardadosPage from './guardados/GuardadosPage'
import PerfilPage from './perfil/PerfilPage'
import ContaPage from './conta/ContaPage'

type Seccao = '' | 'pedidos' | 'guardados' | 'perfil' | 'conta'

/** Painel da família: rotas aninhadas em /familia/*, dentro do DashboardShell (que desenha o h1). */
export default function FamilyDashboard() {
  const user = useCurrentUser()!
  const { pathname } = useLocation()
  const { principal } = usePerfisOrdenados()
  const { ativos } = usePedidos()
  const seccao = (pathname.replace(/^\/familia\/?/, '').split('/')[0] ?? '') as Seccao
  const propostas = ativos.filter((p) => p.c.estado === 'vaga_proposta').length

  const nav: DashboardNavItem[] = [
    { to: '/familia', label: 'Resumo', icon: LayoutDashboard, end: true },
    { to: '/familia/pedidos', label: 'Pedidos', icon: FileText, badge: propostas || undefined },
    { to: '/familia/guardados', label: 'Guardados', icon: Heart },
    { to: '/familia/perfil', label: 'Perfil de cuidados', icon: UserRoundPen },
    { to: '/familia/conta', label: 'Conta', icon: Settings },
  ]

  let title: ReactNode
  let subtitle: ReactNode
  switch (seccao) {
    case 'pedidos':
      title = (
        <>
          Os seus <em>pedidos</em>
        </>
      )
      subtitle = 'Em que ponto está cada pedido de vaga, o lugar na lista de espera e quanto tempo deverá esperar.'
      break
    case 'guardados':
      title = (
        <>
          Instituições <em>guardadas</em>
        </>
      )
      subtitle = 'Compare-as lado a lado e receba um aviso assim que abrir vaga numa delas.'
      break
    case 'perfil':
      title = (
        <>
          Perfil de <em>cuidados</em>
        </>
      )
      subtitle = 'Quem precisa de cuidados, de quais, onde e com que orçamento. É daqui que saem a compatibilidade e as sugestões.'
      break
    case 'conta':
      title = (
        <>
          A sua <em>conta</em>
        </>
      )
      subtitle = 'Contactos, avisos e os seus dados.'
      break
    default: {
      title = (
        <>
          {saudacao()}, <em>{primeiroNome(user.nome)}</em>.
        </>
      )
      const prox = visitasFuturas(ativos)[0]
      const partes: string[] = []
      if (propostas) partes.push(propostas === 1 ? 'Tem uma vaga à espera de resposta.' : `Tem ${propostas} vagas à espera de resposta.`)
      if (ativos.length && principal) {
        partes.push(`Está a acompanhar ${ativos.length === 1 ? 'um pedido' : `${ativos.length} pedidos`} para ${comArtigo(principal)}.`)
      } else if (principal) {
        partes.push(`A procurar lar para ${comArtigo(principal)}, ${principal.idade} anos.`)
      }
      if (prox) partes.push(`A próxima visita é ${diaPorExtenso(prox.quando)}, às ${prox.c.visita!.hora}.`)
      subtitle = partes.length ? partes.join(' ') : 'Comece por descrever a pessoa de quem cuida — o resto do painel organiza-se a partir daí.'
    }
  }

  return (
    <DashboardShell
      eyebrow="Painel da família"
      title={title}
      subtitle={subtitle}
      nav={nav}
      identity={<FamilyIdentity user={user} perfil={principal} />}
      aside={<HelpCard />}
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
