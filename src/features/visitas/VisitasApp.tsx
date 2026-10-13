import { useMemo, type ReactNode } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router'
import { CircleUserRound, ClipboardCheck } from 'lucide-react'
import { DashboardShell, type DashboardNavItem } from '@/components/layout/DashboardShell'
import { Avatar } from '@/components/ui/misc'
import { useCurrentUser, useLar, useLares, useVisitas } from '@/lib/store'
import { NATUREZA_LABEL, noDistrito, TIPO_LABEL } from '@/lib/labels'
import { plural } from '@/lib/format'
import { MaisLink } from '@/features/pro/shared/ui'
import { contactoAFazer, linhasDoDistrito, RESULTADO_LABEL, DISTRITO_PILOTO } from './pipeline'
import { distritoDosParams } from './lista/params'
import { contactosLabel, useContactosUrgentes } from './useContactos'
import PipelinePage from './lista/PipelinePage'
import VisitaPage from './visita/VisitaPage'
import FeitaPage from './feita/FeitaPage'
import ContaPage from './conta/ContaPage'

/** Quem está no terreno, no topo da barra lateral. */
function Identidade() {
  const user = useCurrentUser()
  if (!user) return null
  return (
    <div>
      <div className="flex items-center gap-3">
        <Avatar nome={user.nome} />
        <p className="min-w-0 truncate font-semibold">{user.nome}</p>
      </div>
      <p className="mt-3 text-sm leading-snug text-ink-mute">
        Equipa de terreno
        <span className="block">Piloto {noDistrito(DISTRITO_PILOTO)}</span>
      </p>
    </div>
  )
}

function Ajuda() {
  return (
    <div className="px-3.5 text-sm">
      <p className="text-ink-mute">Licença e instalações confirmadas na visita dão o selo «Visitada pela equipa».</p>
      <MaisLink to="/pesquisa" className="text-sm">
        Mapa de vagas
      </MaisLink>
    </div>
  )
}

/** Título do painel conforme a rota (o DashboardShell desenha-o como h1). */
type Rota = { pagina: 'lista' } | { pagina: 'conta' } | { pagina: 'visita' | 'feita'; larId: string } | { pagina: 'outra' }

/**
 * A secção pelo caminho, sem <Routes> aninhadas: dentro de <Routes> descendentes o useNavigate() não é o do router de
 * dados (ignora `flushSync` e não devolve promessa) e o "Terminar sessão" da Conta precisa dele para sair antes de a
 * sessão acabar (como no painel da família).
 */
function useRota(): Rota {
  const { pathname } = useLocation()
  const partes = pathname.replace(/^\/visitas\/?/, '').replace(/\/$/, '').split('/').filter(Boolean)
  if (partes.length === 0) return { pagina: 'lista' }
  if (partes[0] === 'conta') return partes.length === 1 ? { pagina: 'conta' } : { pagina: 'outra' }
  const larId = decodificar(partes[0]!)
  if (partes.length === 1) return { pagina: 'visita', larId }
  if (partes.length === 2 && partes[1] === 'feita') return { pagina: 'feita', larId }
  return { pagina: 'outra' }
}

function useCabecalho(rota: Rota): { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode } {
  const [params] = useSearchParams()
  const user = useCurrentUser()
  const lares = useLares()
  const visitas = useVisitas()
  const larId = rota.pagina === 'visita' || rota.pagina === 'feita' ? rota.larId : undefined
  const lar = useLar(larId)
  const naLista = rota.pagina === 'lista'
  const distrito = distritoDosParams(params)
  const linhas = useMemo(() => (naLista ? linhasDoDistrito(lares, visitas, distrito, new Date()) : []), [naLista, lares, visitas, distrito])

  if (rota.pagina === 'conta') return { eyebrow: 'Equipa de terreno', title: 'A sua conta', subtitle: user?.email }
  if (larId) {
    if (!lar) return { eyebrow: 'Visitas', title: 'Instituição não encontrada' }
    const ultima = visitas.find((v) => v.larId === lar.id)
    if (rota.pagina === 'feita' && ultima) {
      return { eyebrow: lar.nome, title: 'Visita registada', subtitle: RESULTADO_LABEL[ultima.resultado] }
    }
    return { eyebrow: 'Registar visita', title: lar.nome, subtitle: `${TIPO_LABEL[lar.tipo]} · ${NATUREZA_LABEL[lar.natureza]} · ${lar.localidade}` }
  }
  const porVisitar = linhas.filter((l) => l.segmento === 'por_visitar').length
  const aFazer = linhas.filter((l) => l.segmento === 'acompanhar' && contactoAFazer(l.contacto))
  const atrasados = aFazer.filter((l) => l.contacto?.tipo === 'atrasado').length
  const onde = distrito === 'todos' ? 'em todos os distritos' : noDistrito(distrito)
  let subtitle: string
  if (atrasados) subtitle = atrasados === 1 ? 'Há um contacto em atraso.' : `Há ${atrasados} contactos em atraso.`
  else if (aFazer.length) subtitle = aFazer.length === 1 ? 'Um contacto nos próximos 7 dias.' : `${aFazer.length} contactos nos próximos 7 dias.`
  else if (porVisitar) subtitle = `${plural(porVisitar, 'instituição', 'instituições')} por visitar ${onde}.`
  else subtitle = 'Verificar, apresentar e registar: uma instituição de cada vez.'
  return { eyebrow: 'Equipa de terreno', title: 'Visitas', subtitle }
}

const decodificar = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Esconde, no telemóvel, as pílulas de navegação do DashboardShell: a equipa navega pela barra de abas (MobileTabBar). */
const SEM_PILULAS = 'contents max-lg:[&>div>nav]:hidden'

/**
 * Modo visita (/visitas/*): o pipeline da equipa de terreno, o formulário de cada visita e o ecrã final.
 * Registado pelo App com RequireAuth role="equipa". Pensado para o telemóvel, à porta da instituição.
 */
export default function VisitasApp() {
  const rota = useRota()
  const cab = useCabecalho(rota)
  const { pathname } = useLocation()
  const urgentes = useContactosUrgentes()

  // "Visitas" só fica ativo na lista; o formulário tem a ligação de volta
  const nav: DashboardNavItem[] = [
    { to: '/visitas', label: 'Visitas', icon: ClipboardCheck, end: true, badge: urgentes || undefined, badgeLabel: contactosLabel(urgentes) },
    { to: '/visitas/conta', label: 'Conta', icon: CircleUserRound, end: true },
  ]

  // o título e o conteúdo entram com uma transição curta ao mudar de rota
  const entra = 'block motion-safe:animate-[fade-up_.6s_cubic-bezier(.16,1,.3,1)_both]'

  return (
    <div className={SEM_PILULAS}>
      <DashboardShell
        eyebrow={cab.eyebrow}
        title={
          <span key={pathname} className={entra}>
            {cab.title}
          </span>
        }
        subtitle={
          cab.subtitle && (
            <span key={pathname} className={entra} style={{ animationDelay: '60ms' }}>
              {cab.subtitle}
            </span>
          )
        }
        nav={nav}
        identity={<Identidade />}
        aside={<Ajuda />}
      >
        <div key={pathname} className="motion-safe:animate-[fade-in_.4s_ease-out_both]">
          {rota.pagina === 'lista' && <PipelinePage />}
          {rota.pagina === 'conta' && <ContaPage />}
          {/* uma instância do formulário por instituição: mudar de instituição começa do zero (ou do seu rascunho) */}
          {rota.pagina === 'visita' && <VisitaPage key={rota.larId} larId={rota.larId} />}
          {rota.pagina === 'feita' && <FeitaPage key={rota.larId} larId={rota.larId} />}
          {rota.pagina === 'outra' && <Navigate to="/visitas" replace />}
        </div>
      </DashboardShell>
    </div>
  )
}
