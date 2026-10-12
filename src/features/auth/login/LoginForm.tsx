import { useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import type { User } from '@/types'
import { InputField } from '@/components/ui/Field'
import { login } from '@/lib/store'
import { prefersReducedMotion } from '@/lib/motion'
import { PasswordField } from '../shared/PasswordField'
import { ActionButton } from '../shared/ActionButton'
import { Appear, cascade } from '../shared/Appear'
import { enterAvanca } from '../shared/keyboard'
import { pausa, useForm, type Rules } from '../shared/useForm'
import { emailValido } from '../shared/validators'

type LoginValues = { email: string; password: string }

const RULES: Rules<LoginValues> = {
  email: (v) => (!v.trim() ? 'Indique o seu email.' : !emailValido(v) ? 'Escreva o email completo, por exemplo nome@exemplo.pt.' : undefined),
  password: (v) => (!v ? 'Indique a palavra-passe.' : undefined),
}
const ORDER: (keyof LoginValues)[] = ['email', 'password']

/** Tempo do visto verde no botão antes de mudar de página. */
export const PAUSA_SUCESSO = 420

export function LoginForm({
  defaultEmail = '',
  onPending,
  onSuccess,
}: {
  defaultEmail?: string
  /** true imediatamente antes de iniciar sessão (a página mantém o formulário durante o visto verde) */
  onPending?: (pending: boolean) => void
  onSuccess: (user: User) => void
}) {
  const form = useForm<LoginValues>({ initial: { email: defaultEmail, password: '' }, rules: RULES, order: ORDER })
  const [falha, setFalha] = useState<{ n: number; msg: string } | null>(null)
  const [entrou, setEntrou] = useState(false)
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const submit = form.handleSubmit(async (v) => {
    setFalha(null)
    await pausa(400)
    onPending?.(true)
    const r = login(v.email, v.password)
    if (r.ok) {
      setEntrou(true)
      await pausa(prefersReducedMotion() ? 0 : PAUSA_SUCESSO)
      onSuccess(r.user)
      return
    }
    onPending?.(false)
    setFalha((f) => ({ n: (f?.n ?? 0) + 1, msg: r.error }))
    passwordRef.current?.focus()
    passwordRef.current?.select()
  })

  const passwordField = form.field('password')

  return (
    <form noValidate onSubmit={submit} onKeyDown={(e) => enterAvanca(e)} className="flex flex-col gap-5">
      <Appear delay={cascade(0)}>
        <InputField
          {...form.field('email')}
          label="Email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
        />
      </Appear>
      <Appear delay={cascade(1)}>
        <PasswordField
          {...passwordField}
          ref={(el) => {
            passwordField.ref(el)
            passwordRef.current = el
          }}
          label="Palavra-passe"
          autoComplete="current-password"
          enterKeyHint="go"
        />
      </Appear>

      {falha && (
        <p
          key={falha.n}
          role="alert"
          className="flex animate-[pop-in_.34s_cubic-bezier(.16,1,.3,1)_both] gap-2.5 rounded-2xl bg-alert-50 px-4 py-3 text-sm text-alert-700 motion-reduce:animate-none"
        >
          <AlertCircle aria-hidden className="mt-0.5 size-4.5 shrink-0" />
          <span>
            {falha.msg}
            {falha.n > 1 && ' Confirme se as maiúsculas estão desligadas ou use «Mostrar» para ver o que escreveu.'}
          </span>
        </p>
      )}

      <Appear delay={cascade(2)} variant="up" className="mt-1">
        <ActionButton
          state={entrou ? 'done' : form.submitting ? 'loading' : 'idle'}
          labels={{ idle: 'Entrar', loading: 'A entrar…', done: 'Sessão iniciada' }}
        />
      </Appear>
    </form>
  )
}
