import type { Role, User } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { painelPath } from '@/components/layout/Header'
import { logout, useAcesso, useLares, useMeuLar } from '@/lib/store'
import { AuthShell } from './AuthShell'
import { Appear, cascade } from './Appear'
import { ehAcesso, motivoDoDestino, precisaDeAcesso } from './redirect'

/** O botão para o painel diz o que lá está. */
const IR_PARA_PAINEL: Record<Role, string> = {
  familia: 'Ir para o painel',
  lar: 'Ir para o painel',
  profissional: 'Ir para os casos',
}

/** Quem é, por baixo do nome: a instituição (lar), a organização (profissional) ou o email. */
function identificacao(user: User, nomeLar: string | undefined): string {
  if (user.role === 'lar' && nomeLar) return nomeLar
  const org = user.organizacao
  if (user.role === 'profissional' && org?.nome) return org.servico ? `${org.nome} · ${org.servico}` : org.nome
  return user.email
}

/**
 * "Já pode …" só quando é verdade. O Acesso Família é das famílias: outra conta a caminho de /acesso segue sem
 * frase (a página explica-lhe o seu caso). Numa família sem passe, pedir vaga, visita e alertas precisam dele.
 */
function fraseDoMotivo(motivo: string | null, destino: string, role: Role, completo: boolean): string | null {
  if (!motivo) return null
  if (ehAcesso(destino)) return role === 'familia' ? `Já pode ${motivo}.` : null
  if (role === 'familia' && !completo && precisaDeAcesso(destino)) return `Para ${motivo}, precisa do Acesso Família.`
  return `Já pode ${motivo}.`
}

/**
 * Já com sessão iniciada: quem é, continuar (para o painel ou para onde ia) ou terminar a sessão.
 * O botão diz para onde leva: "Ir para o painel" só quando o destino é o painel; senão "Continuar",
 * com uma frase a lembrar o que estava a fazer (ex.: pedir vaga num lar).
 */
export function SignedInNotice({ user, destino, contexto }: { user: User; destino: string; contexto: 'entrar' | 'registar' }) {
  const lar = useMeuLar()
  const lares = useLares()
  const { completo } = useAcesso()
  const paraPainel = destino === painelPath(user.role)
  const motivo = paraPainel ? null : motivoDoDestino(destino, lares)
  const frase = contexto === 'registar' ? 'Para criar outra conta, termine primeiro esta sessão.' : fraseDoMotivo(motivo, destino, user.role, completo)
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
      subtitle={<span className="break-words">{identificacao(user, lar?.nome)}</span>}
    >
      {frase && (
        <Appear delay={cascade(0)} variant="fade">
          <p className="mb-8 text-center text-balance text-ink-mute">{frase}</p>
        </Appear>
      )}
      <Appear delay={cascade(1)} variant="up" className="flex flex-col gap-3">
        <ButtonLink to={destino} size="lg" full>
          {paraPainel ? IR_PARA_PAINEL[user.role] : 'Continuar'}
        </ButtonLink>
        <Button variant="subtle" size="lg" full onClick={sair}>
          Terminar sessão
        </Button>
      </Appear>
    </AuthShell>
  )
}
