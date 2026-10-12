import { Link, useSearchParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { Role } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { useCurrentUser } from '@/lib/store'
import { painelPath } from '@/components/layout/Header'
import { AccountSwitch } from './register/AccountSwitch'
import { FamilyForm } from './register/FamilyForm'
import { InstitutionForm } from './register/InstitutionForm'
import { AuthShell } from './shared/AuthShell'
import { PrototypeNote } from './shared/PrototypeNote'
import { SignedInNotice } from './shared/SignedInNotice'
import { isInternalPath } from './shared/redirect'

const DESCRICAO: Record<Role, string> = {
  familia: 'Gratuita. Guarde lares, peça vaga e receba alertas.',
  lar: 'Publique as vagas e receba pedidos de famílias.',
}

export default function RegisterPage() {
  const [params, setParams] = useSearchParams()
  const tipo: Role = params.get('tipo') === 'lar' ? 'lar' : 'familia'
  useDocumentTitle(tipo === 'lar' ? 'Registar instituição' : 'Criar conta')
  const user = useCurrentUser()
  const voltar = params.get('voltar')

  if (user) return <SignedInNotice user={user} destino={painelPath(user.role)} contexto="registar" />

  const escolher = (r: Role) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        next.set('tipo', r)
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  const entrar = isInternalPath(voltar) ? `/entrar?voltar=${encodeURIComponent(voltar)}` : '/entrar'

  return (
    <AuthShell title="Criar conta">
      <AccountSwitch value={tipo} onChange={escolher} />
      <p aria-live="polite" className="mt-4 mb-10 text-center text-ink-mute">
        {DESCRICAO[tipo]}
      </p>

      {/* os dois formulários ficam montados: mudar de separador não apaga o que já escreveu */}
      <div hidden={tipo !== 'familia'}>
        <FamilyForm voltar={voltar} />
      </div>
      <div hidden={tipo !== 'lar'}>
        <InstitutionForm />
      </div>

      <p className="mt-8 text-center text-sm text-ink-mute">
        Já tem conta?{' '}
        <Link to={entrar} className="link inline-flex min-h-12 items-center">
          Entrar
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </p>
      <PrototypeNote className="mt-6" />
    </AuthShell>
  )
}
