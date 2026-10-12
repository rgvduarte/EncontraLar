import { ArrowRight, Building2, HeartHandshake, LogOut } from 'lucide-react'
import type { User } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/misc'
import { toast } from '@/components/ui/Toast'
import { logout, useMeuLar } from '@/lib/store'
import { azulejoBg } from '@/components/brand/patterns'
import { lerCargo } from './cargo'

/** Já com sessão iniciada: mostra quem é e oferece ir para o painel ou terminar a sessão. */
export function SignedInNotice({ user, destino, contexto }: { user: User; destino: string; contexto: 'entrar' | 'registar' }) {
  const lar = useMeuLar()
  const cargo = user.role === 'lar' ? lerCargo(user.id) : undefined
  const instituicao = user.role === 'lar'
  return (
    <section
      aria-labelledby="sessao-ativa"
      className="relative overflow-hidden rounded-[1.75rem] border border-line bg-white shadow-card"
    >
      <div aria-hidden className="h-4 opacity-60" style={azulejoBg('#1d564e', 1, 32)} />
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <Avatar nome={user.nome} className="size-14 text-lg" />
          <div className="min-w-0">
            <p className="eyebrow inline-flex items-center gap-1.5">
              {instituicao ? <Building2 aria-hidden className="size-4" /> : <HeartHandshake aria-hidden className="size-4" />}
              {instituicao ? 'Conta de instituição' : 'Conta de família'}
            </p>
            <h2 id="sessao-ativa" className="mt-1 font-display text-2xl font-semibold text-ink">
              Sessão iniciada como <em>{user.nome.split(' ')[0]}</em>
            </h2>
            <p className="mt-1 text-ink-soft">
              {user.nome} · <span className="break-all">{user.email}</span>
            </p>
            {instituicao && lar && (
              <p className="text-ink-soft">
                {cargo ? `${cargo} · ` : ''}
                {lar.nome}
              </p>
            )}
          </div>
        </div>
        <p className="text-ink-soft">
          {contexto === 'registar'
            ? 'Para criar uma conta nova, termine primeiro esta sessão. Se só queria continuar, o seu painel está à distância de um clique.'
            : 'Já está tudo pronto. Pode continuar para o painel ou terminar a sessão para entrar com outra conta.'}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <ButtonLink to={destino} iconRight={<ArrowRight aria-hidden className="size-5" />}>
            Ir para o painel
          </ButtonLink>
          <Button
            variant="secondary"
            icon={<LogOut aria-hidden className="size-5" />}
            onClick={() => {
              logout()
              toast.info('Sessão terminada', 'Pode entrar com outra conta ou criar uma nova.')
            }}
          >
            Terminar sessão
          </Button>
        </div>
      </div>
    </section>
  )
}
