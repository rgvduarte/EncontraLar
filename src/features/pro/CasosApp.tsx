import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { FolderOpen, Plus } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell'
import { Avatar } from '@/components/ui/misc'
import { useCurrentUser } from '@/lib/store'
import { diasAteAlta } from '@/lib/negocio'
import { frasePerfil, pessoaCurta } from './shared/caso'
import { useCasoComPerfil, useCasosComDados, usePropostasPendentes } from './shared/data'
import { MaisLink } from './shared/ui'
import CasosPage from './lista/CasosPage'
import NovoCasoPage from './novo/NovoCasoPage'
import CasoPage from './caso/CasoPage'

/** Identidade no topo da barra lateral: quem encaminha e de onde. */
function Identidade() {
  const user = useCurrentUser()
  if (!user) return null
  const org = user.organizacao
  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar nome={user.nome} />
        <p className="min-w-0 truncate font-semibold">{user.nome}</p>
      </div>
      {org && (
        <p className="mt-3 text-sm leading-snug text-ink-mute">
          {org.nome}
          {org.servico && <span className="block">{org.servico}</span>}
        </p>
      )}
    </div>
  )
}

function Ajuda() {
  return (
    <div className="px-3.5 text-sm">
      <p className="text-ink-mute">As instituições veem o perfil sem nome até aceitarem o pedido.</p>
      <MaisLink to="/profissionais" className="text-sm">
        Como funciona
      </MaisLink>
    </div>
  )
}

const decodificar = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Título do painel conforme a rota (o DashboardShell desenha-o como h1). */
function useCabecalho(): { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode } {
  const user = useCurrentUser()
  const { pathname } = useLocation()
  const resto = decodificar(pathname.replace(/^\/casos\/?/, '').replace(/\/$/, ''))
  const casoId = resto && resto !== 'novo' && !resto.includes('/') ? resto : undefined
  const { caso, perfil } = useCasoComPerfil(casoId)
  const casos = useCasosComDados()
  const propostas = usePropostasPendentes()
  const org = user?.organizacao ? `${user.organizacao.nome}${user.organizacao.servico ? ` · ${user.organizacao.servico}` : ''}` : 'Serviço social'

  if (resto === 'novo') return { eyebrow: 'Casos', title: 'Novo caso', subtitle: 'Um perfil de cuidados, sem dados que identifiquem a pessoa.' }
  if (casoId) {
    if (!caso || !perfil) return { eyebrow: 'Casos', title: 'Caso não encontrado' }
    return { eyebrow: caso.referencia ? `Caso · ${caso.referencia}` : 'Caso', title: pessoaCurta(perfil), subtitle: frasePerfil(perfil) }
  }
  const abertos = casos.filter((c) => c.caso.estado === 'aberto')
  const urgentes = abertos.filter((c) => {
    const d = diasAteAlta(c.caso.altaPrevista)
    return d != null && d <= 7
  }).length
  let subtitle: string
  if (propostas) subtitle = propostas === 1 ? 'Há uma vaga proposta à espera da sua resposta.' : `Há ${propostas} vagas propostas à espera da sua resposta.`
  else if (urgentes) subtitle = urgentes === 1 ? 'Um caso com alta nos próximos 7 dias.' : `${urgentes} casos com alta nos próximos 7 dias.`
  else subtitle = 'Um perfil de cuidados, várias instituições, as respostas num só sítio.'
  return { eyebrow: org, title: 'Casos', subtitle }
}

/**
 * Área do profissional (/casos/*): lista de casos, novo caso e detalhe do caso, dentro do DashboardShell.
 * Registada pelo App com RequireAuth role="profissional".
 */
export default function CasosApp() {
  const propostas = usePropostasPendentes()
  const cab = useCabecalho()
  const { pathname } = useLocation()

  // "Casos" só fica ativo na lista (senão acendia também em /casos/novo); o caso tem a ligação "Todos os casos"
  const nav: DashboardNavItem[] = [
    { to: '/casos', label: 'Casos', icon: FolderOpen, end: true, badge: propostas || undefined, badgeLabel: propostas === 1 ? 'vaga por responder' : 'vagas por responder' },
    { to: '/casos/novo', label: 'Novo caso', icon: Plus, end: true },
  ]

  // o título e o conteúdo da secção entram com uma transição curta ao mudar de rota
  const chave = pathname
  const entra = 'block motion-safe:animate-[fade-up_.6s_cubic-bezier(.16,1,.3,1)_both]'

  return (
    <DashboardShell
      eyebrow={cab.eyebrow}
      title={
        <span key={chave} className={entra}>
          {cab.title}
        </span>
      }
      subtitle={
        cab.subtitle && (
          <span key={chave} className={entra} style={{ animationDelay: '60ms' }}>
            {cab.subtitle}
          </span>
        )
      }
      nav={nav}
      identity={<Identidade />}
      aside={<Ajuda />}
    >
      <div key={chave} className="motion-safe:animate-[fade-in_.4s_ease-out_both]">
        <Routes>
          <Route index element={<CasosPage />} />
          <Route path="novo" element={<NovoCasoPage />} />
          <Route path=":id" element={<CasoPage />} />
          <Route path="*" element={<Navigate to="/casos" replace />} />
        </Routes>
      </div>
    </DashboardShell>
  )
}
