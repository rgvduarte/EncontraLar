import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { ShieldAlert } from 'lucide-react'
import type { Role } from '@/types'
import { useCurrentUser } from '@/lib/store'
import { ButtonLink } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/misc'
import { painelPath } from './Header'

/** Protege rotas: sem sessão → /entrar?voltar=…; papel errado → aviso com atalho para o painel certo. */
export function RequireAuth({ role, children }: { role: Role; children: ReactNode }) {
  const user = useCurrentUser()
  const location = useLocation()
  if (!user) return <Navigate to={`/entrar?voltar=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (user.role !== role) {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon={<ShieldAlert />}
          title={role === 'lar' ? 'Esta área é para instituições' : 'Esta área é para famílias'}
          text={`Tem sessão iniciada com uma conta de ${user.role === 'lar' ? 'instituição' : 'família'}.`}
          action={<ButtonLink to={painelPath(user.role)}>Ir para o meu painel</ButtonLink>}
        />
      </div>
    )
  }
  return <>{children}</>
}
