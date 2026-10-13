import type { ReactNode } from 'react'
import { Navigate, useLocation, useNavigate, type NavigateFunction } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import type { Role } from '@/types'
import { logout, useCurrentUser } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { Button, ButtonLink, TextLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'

/**
 * Termina a sessão e leva à página inicial (com um aviso).
 * Primeiro sai da página (de forma síncrona), só depois termina a sessão: se fosse ao contrário,
 * o RequireAuth da página atual voltava a desenhar-se primeiro e mandava para /entrar?voltar=….
 */
export async function terminarSessao(navigate: NavigateFunction): Promise<void> {
  await navigate('/', { replace: true, flushSync: true })
  logout()
  toast.info('Sessão terminada')
}

/** Como cada tipo de conta é nomeado ("uma conta de …") e para onde vai o seu painel. */
const CONTA: Record<Role, { nome: string; painel: string; acao: string }> = {
  familia: { nome: 'família', painel: '/familia', acao: 'Ir para o meu painel' },
  lar: { nome: 'instituição', painel: '/gestao', acao: 'Ir para o painel da instituição' },
  profissional: { nome: 'profissional de saúde', painel: '/casos', acao: 'Ir para os meus casos' },
  equipa: { nome: 'equipa de terreno', painel: '/visitas', acao: 'Ir para as visitas' },
}

const AREA: Record<Role, string> = {
  familia: 'Esta área é para famílias',
  lar: 'Esta área é para instituições',
  profissional: 'Esta área é para profissionais de saúde',
  equipa: 'Esta área é para a equipa de terreno do EncontraLar',
}

/** Página para quem tem sessão com o tipo de conta errado (ex.: família a abrir /gestao ou /casos). */
function AreaReservada({ role, atual }: { role: Role; atual: Role }) {
  useDocumentTitle('Área reservada')
  const navigate = useNavigate()
  const location = useLocation()
  const conta = CONTA[atual]
  // trocar de conta: sai primeiro da página (como terminarSessao) e só depois termina a sessão, com regresso a esta área
  const outraConta = async () => {
    await navigate(`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`, { replace: true, flushSync: true })
    logout()
    toast.info('Sessão terminada', 'Entre com a conta certa para abrir esta área.')
  }
  return (
    <div className="container-page py-16">
      <EmptyState
        as="h1"
        icon={<ShieldAlert />}
        title={AREA[role]}
        text={
          role === 'profissional'
            ? `Tem sessão iniciada com uma conta de ${conta.nome}. Os casos são geridos por assistentes sociais de hospitais, centros de saúde e autarquias.`
            : `Tem sessão iniciada com uma conta de ${conta.nome}.`
        }
        action={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <ButtonLink to={conta.painel}>{conta.acao}</ButtonLink>
            {/* branco sobre o cinza do cartão (o "subtle" cinza desaparecia) */}
            <Button variant="inverse" onClick={() => void outraConta()}>
              Entrar com outra conta
            </Button>
          </div>
        }
      />
      {role === 'profissional' && (
        <p className="mt-6 text-center">
          <TextLink to="/profissionais">Como funciona para profissionais</TextLink>
        </p>
      )}
    </div>
  )
}

/** Protege rotas: sem sessão → /entrar?voltar=…; papel errado → aviso com atalho para o painel certo. */
export function RequireAuth({ role, children }: { role: Role; children: ReactNode }) {
  const user = useCurrentUser()
  const location = useLocation()
  if (!user) return <Navigate to={`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (user.role !== role) return <AreaReservada role={role} atual={user.role} />
  return <>{children}</>
}
