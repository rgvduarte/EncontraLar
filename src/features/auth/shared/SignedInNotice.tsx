import type { User } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { painelPath } from '@/components/layout/Header'
import { logout, useLares, useMeuLar } from '@/lib/store'
import { AuthShell } from './AuthShell'
import { Appear, cascade } from './Appear'
import { motivoDoDestino } from './redirect'

/**
 * Já com sessão iniciada: quem é, continuar (para o painel ou para onde ia) ou terminar a sessão.
 * O botão diz para onde leva: "Ir para o painel" só quando o destino é o painel; senão "Continuar",
 * com uma frase a lembrar o que estava a fazer (ex.: pedir vaga num lar).
 */
export function SignedInNotice({ user, destino, contexto }: { user: User; destino: string; contexto: 'entrar' | 'registar' }) {
  const lar = useMeuLar()
  const lares = useLares()
  const paraPainel = destino === painelPath(user.role)
  const motivo = paraPainel ? null : motivoDoDestino(destino, lares)
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
      {(contexto === 'registar' || motivo) && (
        <Appear delay={cascade(0)} variant="fade">
          <p className="mb-8 text-center text-balance text-ink-mute">
            {contexto === 'registar' ? 'Para criar outra conta, termine primeiro esta sessão.' : `Já pode ${motivo}.`}
          </p>
        </Appear>
      )}
      <Appear delay={cascade(1)} variant="up" className="flex flex-col gap-3">
        <ButtonLink to={destino} size="lg" full>
          {paraPainel ? 'Ir para o painel' : 'Continuar'}
        </ButtonLink>
        <Button variant="subtle" size="lg" full onClick={sair}>
          Terminar sessão
        </Button>
      </Appear>
    </AuthShell>
  )
}
