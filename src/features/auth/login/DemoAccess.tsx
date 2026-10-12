import { useId, useState } from 'react'
import { Check, ChevronRight } from 'lucide-react'
import type { Role, User } from '@/types'
import { loginDemo } from '@/lib/store'
import { prefersReducedMotion, useInView } from '@/lib/motion'
import { toast } from '@/components/ui/Toast'
import { DEMO_FAMILIA_EMAIL, DEMO_LAR_EMAIL, DEMO_PASSWORD } from '@/data/seed'
import { cn } from '@/lib/cn'
import { InlineSpinner } from '../shared/InlineSpinner'
import { Appear } from '../shared/Appear'
import { pausa } from '../shared/useForm'
import { PAUSA_SUCESSO } from './LoginForm'

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

type Estado = 'idle' | 'loading' | 'done' | 'disabled'

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
  state: Estado
  onClick: () => void
}) {
  const id = useId()
  const ocupado = state !== 'idle'
  return (
    <button
      type="button"
      onClick={() => !ocupado && onClick()}
      aria-disabled={ocupado || undefined}
      aria-busy={state === 'loading' || undefined}
      aria-labelledby={`${id}-t`}
      aria-describedby={`${id}-d`}
      className={cn(
        'group flex min-h-20 w-full items-center gap-4 rounded-[1.25rem] bg-sand px-5 py-4 text-left',
        'transition-[background-color,scale,opacity] duration-200 ease-[cubic-bezier(.25,.1,.25,1)]',
        // premir: encolhe e escurece um pouco, como um botão de iOS
        'hover:bg-sand-deep active:scale-[0.98] active:bg-line active:duration-100',
        ocupado && 'cursor-default active:scale-100',
        state === 'disabled' && 'opacity-50',
      )}
    >
      <span className="min-w-0 flex-1">
        <span id={`${id}-t`} className="block font-medium text-ink">
          {state === 'loading' ? 'A entrar…' : state === 'done' ? 'Sessão iniciada' : titulo}{' '}
          <span className="font-normal text-ink-mute">(demonstração)</span>
        </span>
        <span id={`${id}-d`} className="block">
          <span className="mt-0.5 block text-sm text-ink-soft">{descricao}</span>
          <span className="mt-1.5 block text-xs break-all text-ink-mute">
            {email} · {DEMO_PASSWORD}
          </span>
        </span>
      </span>
      <span aria-hidden className="relative grid size-6 shrink-0 place-items-center">
        <ChevronRight
          className={cn(
            'col-start-1 row-start-1 size-5 text-ink-mute transition-[translate,opacity] duration-200 group-hover:translate-x-0.5',
            state !== 'idle' && state !== 'disabled' && 'opacity-0',
          )}
        />
        {state === 'loading' && <InlineSpinner className="col-start-1 row-start-1 text-ink-mute" />}
        {state === 'done' && (
          <Check strokeWidth={2.6} className="col-start-1 row-start-1 size-5 animate-[pop-in_.3s_cubic-bezier(.16,1,.3,1)_both] text-leaf-600" />
        )}
      </span>
    </button>
  )
}

/** Divisória "ou experimente sem conta": as duas linhas desenham-se a partir do texto quando aparece. */
function Divisoria() {
  const [ref, inView] = useInView<HTMLDivElement>()
  const linha = 'h-px flex-1 bg-line transition-transform duration-[900ms] ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none'
  return (
    <div ref={ref} className="flex items-center gap-4">
      <span aria-hidden className={cn(linha, 'origin-right', inView ? 'scale-x-100' : 'scale-x-0')} />
      <h2 id="demo-titulo" className="font-sans text-sm font-normal tracking-normal text-ink-mute">
        ou experimente sem conta
      </h2>
      <span aria-hidden className={cn(linha, 'origin-left', inView ? 'scale-x-100' : 'scale-x-0')} />
    </div>
  )
}

/** "ou experimente sem conta": duas contas fictícias, um toque e está dentro. */
export function DemoAccess({ onSuccess, delay = 0 }: { onSuccess: (user: User) => void; delay?: number }) {
  const [loading, setLoading] = useState<Role | null>(null)
  const [done, setDone] = useState(false)

  const entrar = async (role: Role) => {
    if (loading) return
    setLoading(role)
    await pausa(300)
    const r = loginDemo(role)
    if (r.ok) {
      setDone(true)
      await pausa(prefersReducedMotion() ? 0 : PAUSA_SUCESSO)
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
      <Appear delay={delay} variant="fade">
        <Divisoria />
      </Appear>
      <ul className="mt-6 flex flex-col gap-3">
        {CONTAS.map((c, i) => (
          <Appear as="li" key={c.role} delay={delay + 80 + i * 80} variant="up">
            <DemoButton
              titulo={c.titulo}
              descricao={c.descricao}
              email={c.email}
              state={loading === c.role ? (done ? 'done' : 'loading') : loading ? 'disabled' : 'idle'}
              onClick={() => entrar(c.role)}
            />
          </Appear>
        ))}
      </ul>
    </section>
  )
}
