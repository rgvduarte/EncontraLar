import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import type { User } from '@/types'
import { useDocumentTitle } from '@/lib/hooks'
import { useCurrentUser, useLares } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { TextLink } from '@/components/ui/Button'
import { LoginForm } from './login/LoginForm'
import { DemoAccess } from './login/DemoAccess'
import { AuthShell } from './shared/AuthShell'
import { SignedInNotice } from './shared/SignedInNotice'
import { PrototypeNote } from './shared/PrototypeNote'
import { Appear, cascade } from './shared/Appear'
import { primeiroNome } from './shared/EmailExisteErro'
import { descreverDestino, destinoAposEntrar, isInternalPath } from './shared/redirect'

export default function LoginPage() {
  useDocumentTitle('Entrar')
  const user = useCurrentUser()
  const lares = useLares()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const voltar = params.get('voltar')
  // a sessão é iniciada antes do visto verde no botão: não trocar a página pelo aviso "Sessão iniciada"
  const [aEntrar, setAEntrar] = useState(false)

  if (user && !aEntrar) return <SignedInNotice user={user} destino={destinoAposEntrar(voltar, user.role)} contexto="entrar" />

  const destino = descreverDestino(voltar, lares)
  const registar = isInternalPath(voltar) ? `/registar?voltar=${encodeURIComponent(voltar)}` : '/registar'

  const concluir = (u: User) => {
    toast.success(`Olá, ${primeiroNome(u.nome)}.`)
    navigate(destinoAposEntrar(voltar, u.role), { replace: true })
  }

  return (
    <AuthShell title="Entrar no EncontraLar" subtitle={destino ? `Inicie sessão para abrir ${destino}.` : undefined}>
      <LoginForm defaultEmail={params.get('email') ?? ''} onPending={setAEntrar} onSuccess={concluir} />

      <Appear delay={cascade(3)} variant="fade" className="mt-5 flex flex-col items-center gap-2 text-center">
        <button
          type="button"
          onClick={() =>
            toast.info('Recuperar a palavra-passe', 'Neste protótipo não enviamos emails. Crie uma conta nova ou experimente uma conta de demonstração.')
          }
          className="link min-h-12 px-3 text-sm"
        >
          Esqueci-me da palavra-passe
        </button>
        <p className="flex flex-wrap items-center justify-center gap-x-1.5 text-sm text-ink-mute">
          Não tem conta?
          <TextLink to={registar} className="min-h-12">
            Criar conta
          </TextLink>
        </p>
      </Appear>

      <DemoAccess onSuccess={concluir} onPending={setAEntrar} delay={cascade(4)} />
      <Appear delay={cascade(6)} variant="fade">
        <PrototypeNote className="mt-10" />
      </Appear>
    </AuthShell>
  )
}
