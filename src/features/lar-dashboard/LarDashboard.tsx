import { useMemo } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { BedDouble, Building2, CloudSun, FileText, Inbox, LayoutDashboard } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { useCandidaturasDoLar, useCurrentUser, useMeuLar } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { assuntosPendentes, numerosResumo } from './lib/derive'
import { useAgora } from './lib/hooks'
import { cabecalho, seccaoDoCaminho } from './shell/cabecalhos'
import { MobileIdentity, PublicStatus, SidebarIdentity } from './shell/Identity'
import ResumoPage from './resumo/ResumoPage'
import VagasPage from './vagas/VagasPage'
import PedidosPage from './pedidos/PedidosPage'
import PrevisaoPage from './previsao/PrevisaoPage'
import FichaPage from './ficha/FichaPage'

/**
 * Painel da instituição (/gestao/*).
 * Promessa para quem gere a casa: preencher vagas mais depressa com as famílias certas,
 * e deixar de atender telefonemas só para dizer "não há vaga".
 */
export default function LarDashboard() {
  const user = useCurrentUser()
  const lar = useMeuLar()
  const cands = useCandidaturasDoLar(lar?.id)
  const { pathname } = useLocation()
  const agora = useAgora()
  const seccao = seccaoDoCaminho(pathname)
  const n = useMemo(() => (lar ? numerosResumo(lar, cands) : null), [lar, cands])
  const assuntos = useMemo(() => (lar ? assuntosPendentes(lar, cands, agora) : null), [lar, cands, agora])
  const cab = lar && assuntos ? cabecalho(seccao, lar, user, assuntos, new Date(agora)) : null
  useDocumentTitle(cab?.doc ?? 'Painel da instituição')

  if (!lar || !n || !cab) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<Building2 />}
          title="Não encontrámos a instituição desta conta"
          text="A conta tem sessão iniciada como instituição, mas não está associada a nenhuma ficha. Pode registar a instituição de novo — demora cerca de dois minutos."
          action={<ButtonLink to="/registar?tipo=lar">Registar a instituição</ButtonLink>}
        />
      </div>
    )
  }

  const nav: DashboardNavItem[] = [
    { to: '/gestao', label: 'Resumo', icon: LayoutDashboard, end: true },
    { to: '/gestao/vagas', label: 'Vagas', icon: BedDouble },
    { to: '/gestao/pedidos', label: 'Pedidos', icon: Inbox, badge: n.novos + n.visitas },
    { to: '/gestao/previsao', label: 'Previsão', icon: CloudSun },
    { to: '/gestao/ficha', label: 'Ficha pública', icon: FileText },
  ]

  return (
    <DashboardShell
      eyebrow={cab.eyebrow}
      title={cab.title}
      subtitle={cab.subtitle}
      identity={<SidebarIdentity lar={lar} />}
      nav={nav}
      aside={<PublicStatus lar={lar} />}
    >
      <MobileIdentity lar={lar} className="lg:hidden" />
      <Routes>
        <Route index element={<ResumoPage lar={lar} cands={cands} user={user} n={n} />} />
        <Route path="vagas" element={<VagasPage lar={lar} cands={cands} />} />
        <Route path="pedidos" element={<PedidosPage lar={lar} cands={cands} />} />
        <Route path="previsao" element={<PrevisaoPage lar={lar} cands={cands} />} />
        <Route path="ficha" element={<FichaPage lar={lar} />} />
        <Route path="*" element={<Navigate to="/gestao" replace />} />
      </Routes>
    </DashboardShell>
  )
}
