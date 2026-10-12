import type { ReactNode } from 'react'
import { Navigate, useLocation, type NavigateFunction } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import type { Role } from '@/types'
import { logout, useCurrentUser } from '@/lib/store'
import { useDocumentTitle } from '@/lib/hooks'
import { ButtonLink } from '@/components/ui/Button'
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

/** Página para quem tem sessão com o tipo de conta errado (ex.: família a abrir /gestao). */
function AreaReservada({ role, atual }: { role: Role; atual: Role }) {
  useDocumentTitle('Área reservada')
  return (
    <div className="container-page py-16">
      <EmptyState
        as="h1"
        icon={<ShieldAlert />}
        title={role === 'lar' ? 'Esta área é para instituições' : 'Esta área é para famílias'}
        text={`Tem sessão iniciada com uma conta de ${atual === 'lar' ? 'instituição' : 'família'}.`}
        action={<ButtonLink to={atual === 'lar' ? '/gestao' : '/familia'}>Ir para o meu painel</ButtonLink>}
      />
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
