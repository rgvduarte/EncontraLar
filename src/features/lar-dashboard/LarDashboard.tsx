import { useMemo } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { BedDouble, Building2, ChartLine, FileText, Inbox, LayoutGrid } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { useCandidaturasDoLar, useCurrentUser, useMeuLar } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { assuntosPendentes, numerosResumo, passosArranque } from './lib/derive'
import { useAgora } from './lib/hooks'
import { cabecalho, seccaoDoCaminho } from './shell/cabecalhos'
import { PublicStatus, SidebarIdentity } from './shell/Identity'
import { useTroca } from './shared/motion'
import ResumoPage from './resumo/ResumoPage'
import VagasPage from './vagas/VagasPage'
import PedidosPage from './pedidos/PedidosPage'
import PrevisaoPage from './previsao/PrevisaoPage'
import FichaPage from './ficha/FichaPage'

/**
 * Painel da instituição (/gestao/*).
 * Para quem gere a casa e tem pouco tempo: vagas num toque, pedidos já triados, nada escondido.
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
  const emFalta = lar ? passosArranque(lar, user).filter((p) => !p.feito).length : 0
  const cab = lar && assuntos ? cabecalho(seccao, lar, user, assuntos, emFalta, new Date(agora)) : null
  useDocumentTitle(cab?.doc ?? 'Painel da instituição')
  // ao trocar de separador (barra lateral ou barra de abas), a nova secção entra a subir com um leve desfoque
  const palco = useTroca<HTMLDivElement>(seccao, undefined, 560)

  if (!lar || !n || !cab) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<Building2 />}
          title="Não encontrámos a instituição desta conta"
          text="A sessão está iniciada como instituição, mas sem ficha associada. Registar a instituição demora cerca de dois minutos."
          action={<ButtonLink to="/registar?tipo=lar">Registar a instituição</ButtonLink>}
        />
      </div>
    )
  }

  const nav: DashboardNavItem[] = [
    { to: '/gestao', label: 'Resumo', icon: LayoutGrid, end: true },
    { to: '/gestao/vagas', label: 'Vagas', icon: BedDouble },
    { to: '/gestao/pedidos', label: 'Pedidos', icon: Inbox, badge: n.novos + n.visitas },
    { to: '/gestao/previsao', label: 'Previsão', icon: ChartLine },
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
      <div ref={palco}>
        <Routes>
          <Route index element={<ResumoPage lar={lar} cands={cands} user={user} n={n} />} />
          <Route path="vagas" element={<VagasPage lar={lar} />} />
          <Route path="pedidos" element={<PedidosPage lar={lar} cands={cands} />} />
          <Route path="previsao" element={<PrevisaoPage lar={lar} n={n} />} />
          <Route path="ficha" element={<FichaPage lar={lar} />} />
          <Route path="*" element={<Navigate to="/gestao" replace />} />
        </Routes>
      </div>
    </DashboardShell>
  )
}
