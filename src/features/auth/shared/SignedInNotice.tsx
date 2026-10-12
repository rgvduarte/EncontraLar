import type { User } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { logout, useMeuLar } from '@/lib/store'
import { AuthShell } from './AuthShell'
import { Appear, cascade } from './Appear'

/** Já com sessão iniciada: quem é, ir para o painel ou terminar a sessão. */
export function SignedInNotice({ user, destino, contexto }: { user: User; destino: string; contexto: 'entrar' | 'registar' }) {
  const lar = useMeuLar()
  const sair = () => {
    logout()
    toast.info('Sessão terminada')
    // o formulário substitui este aviso: leva o foco para o novo título
    requestAnimationFrame(() => document.querySelector<HTMLElement>('main h1')?.focus())
  }

  return (
    <AuthShell
      mark={<Avatar nome={user.nome} className="size-16 text-xl" />}
      title={<>Sessão iniciada como {user.nome}</>}
      subtitle={<span className="break-words">{user.role === 'lar' && lar ? lar.nome : user.email}</span>}
    >
      {contexto === 'registar' && (
        <Appear delay={cascade(0)} variant="fade">
          <p className="mb-8 text-center text-ink-mute">Para criar outra conta, termine primeiro esta sessão.</p>
        </Appear>
      )}
      <Appear delay={cascade(1)} variant="up" className="flex flex-col gap-3">
        <ButtonLink to={destino} size="lg" full>
          Ir para o painel
        </ButtonLink>
        <Button variant="subtle" size="lg" full onClick={sair}>
          Terminar sessão
        </Button>
      </Appear>
    </AuthShell>
  )
}
