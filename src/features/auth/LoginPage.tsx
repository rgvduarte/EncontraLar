import { Link, useNavigate, useSearchParams } from 'react-router'
import { ChevronRight } from 'lucide-react'
import type { User } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { useCurrentUser, useLares } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { LoginForm } from './login/LoginForm'
import { DemoAccess } from './login/DemoAccess'
import { AuthShell } from './shared/AuthShell'
import { SignedInNotice } from './shared/SignedInNotice'
import { PrototypeNote } from './shared/PrototypeNote'
import { primeiroNome } from './shared/EmailExisteErro'
import { descreverDestino, destinoAposEntrar, isInternalPath } from './shared/redirect'

export default function LoginPage() {
  useDocumentTitle('Entrar')
  const user = useCurrentUser()
  const lares = useLares()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const voltar = params.get('voltar')

  if (user) return <SignedInNotice user={user} destino={destinoAposEntrar(voltar, user.role)} contexto="entrar" />

  const destino = descreverDestino(voltar, lares)
  const registar = isInternalPath(voltar) ? `/registar?voltar=${encodeURIComponent(voltar)}` : '/registar'

  const concluir = (u: User) => {
    toast.success(`Olá, ${primeiroNome(u.nome)}.`)
    navigate(destinoAposEntrar(voltar, u.role), { replace: true })
  }

  return (
    <AuthShell title="Entrar no EncontraLar" subtitle={destino ? `Inicie sessão para abrir ${destino}.` : undefined}>
      <LoginForm defaultEmail={params.get('email') ?? ''} onSuccess={concluir} />

      <div className="mt-6 flex flex-col items-center gap-1 text-center">
        <button
          type="button"
          onClick={() =>
            toast.info('Recuperar a palavra-passe', 'Neste protótipo não enviamos emails. Crie uma conta nova ou experimente uma conta de demonstração.')
          }
          className="link min-h-12 text-sm"
        >
          Esqueci-me da palavra-passe
        </button>
        <p className="text-sm text-ink-mute">
          Não tem conta?{' '}
          <Link to={registar} className="link inline-flex min-h-12 items-center">
            Criar conta
            <ChevronRight aria-hidden className="size-4" />
          </Link>
        </p>
      </div>

      <DemoAccess onSuccess={concluir} />
      <PrototypeNote className="mt-10" />
    </AuthShell>
  )
}
