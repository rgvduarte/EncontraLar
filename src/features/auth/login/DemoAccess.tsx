import { useId, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import type { Role, User } from '@/types'
import { loginDemo } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { DEMO_FAMILIA_EMAIL, DEMO_LAR_EMAIL, DEMO_PASSWORD } from '@/data/seed'
import { cn } from '@/lib/cn'
import { InlineSpinner } from '../shared/InlineSpinner'
import { pausa } from '../shared/useForm'

const CONTAS: { role: Role; titulo: string; descricao: string; email: string }[] = [
  {
    role: 'familia',
    titulo: 'Entrar como família',
    descricao: 'Pedidos, lista de espera e alertas de vaga.',
    email: DEMO_FAMILIA_EMAIL,
  },
  {
    role: 'lar',
    titulo: 'Entrar como instituição',
    descricao: 'Vagas, pedidos recebidos e previsão.',
    email: DEMO_LAR_EMAIL,
  },
]

function DemoButton({
  titulo,
  descricao,
  email,
  state,
  onClick,
}: {
  titulo: string
  descricao: string
  email: string
  state: 'idle' | 'loading' | 'disabled'
  onClick: () => void
}) {
  const id = useId()
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state !== 'idle'}
      aria-busy={state === 'loading' || undefined}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      className={cn(
        'group flex w-full items-center gap-4 rounded-[1.25rem] bg-sand px-5 py-4 text-left',
        'transition-[background-color,transform,opacity] duration-200 ease-[cubic-bezier(.25,.1,.25,1)] hover:bg-sand-deep active:scale-[0.99]',
        'disabled:cursor-not-allowed disabled:active:scale-100',
        state === 'disabled' && 'opacity-60',
      )}
    >
      <span className="min-w-0 flex-1">
        <span id={`${id}-t`} className="block font-medium text-ink">
          {state === 'loading' ? 'A entrar…' : titulo} <span className="font-normal text-ink-mute">(demonstração)</span>
        </span>
        <span id={`${id}-d`} className="block">
          <span className="mt-0.5 block text-sm text-ink-soft">{descricao}</span>
          <span className="mt-1.5 block text-xs break-all text-ink-mute">
            {email} · {DEMO_PASSWORD}
          </span>
        </span>
      </span>
      {state === 'loading' ? (
        <InlineSpinner className="text-ink-mute" />
      ) : (
        <ChevronRight
          aria-hidden
          className="size-5 shrink-0 text-ink-mute transition-transform duration-200 group-hover:translate-x-0.5 group-disabled:translate-x-0"
        />
      )}
    </button>
  )
}

/** "ou experimente sem conta": duas contas fictícias, um toque e está dentro. */
export function DemoAccess({ onSuccess }: { onSuccess: (user: User) => void }) {
  const [loading, setLoading] = useState<Role | null>(null)

  const entrar = async (role: Role) => {
    if (loading) return
    setLoading(role)
    await pausa(300)
    const r = loginDemo(role)
    if (r.ok) {
      onSuccess(r.user)
      return
    }
    setLoading(null)
    toast.error(
      'Não foi possível entrar na conta de demonstração',
      'Os dados foram alterados neste navegador. Use «Repor dados de demonstração», no rodapé, e tente de novo.',
    )
  }

  return (
    <section aria-labelledby="demo-titulo" className="mt-12">
      <div className="flex items-center gap-4">
        <span aria-hidden className="h-px flex-1 bg-line" />
        <h2 id="demo-titulo" className="font-sans text-sm font-normal tracking-normal text-ink-mute">
          ou experimente sem conta
        </h2>
        <span aria-hidden className="h-px flex-1 bg-line" />
      </div>
      <ul className="mt-6 flex flex-col gap-3">
        {CONTAS.map((c) => (
          <li key={c.role}>
            <DemoButton
              titulo={c.titulo}
              descricao={c.descricao}
              email={c.email}
              state={loading === c.role ? 'loading' : loading ? 'disabled' : 'idle'}
              onClick={() => entrar(c.role)}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}
