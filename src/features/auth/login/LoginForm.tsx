import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { ArrowRight, Mail, TriangleAlert } from 'lucide-react'
import type { User } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { login } from '@/lib/store'
import { PasswordField } from '../shared/PasswordField'
import { InlineSpinner } from '../shared/InlineSpinner'
import { pausa, useForm, type Rules } from '../shared/useForm'
import { emailValido } from '../shared/validators'

type LoginValues = { email: string; password: string }

const RULES: Rules<LoginValues> = {
  email: (v) => (!v.trim() ? 'Indique o email com que criou a conta.' : !emailValido(v) ? 'Escreva o email completo, por exemplo nome@exemplo.pt.' : undefined),
  password: (v) => (!v ? 'Indique a palavra-passe.' : undefined),
}
const ORDER: (keyof LoginValues)[] = ['email', 'password']

export function LoginForm({ defaultEmail = '', onSuccess }: { defaultEmail?: string; onSuccess: (user: User) => void }) {
  const form = useForm<LoginValues>({ initial: { email: defaultEmail, password: '' }, rules: RULES, order: ORDER })
  const [falha, setFalha] = useState<{ n: number; msg: string } | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const submit = form.handleSubmit(async (v) => {
    setFalha(null)
    await pausa(450)
    const r = login(v.email, v.password)
    if (r.ok) {
      onSuccess(r.user)
      return
    }
    setFalha((f) => ({ n: (f?.n ?? 0) + 1, msg: r.error }))
    passwordRef.current?.focus()
    passwordRef.current?.select()
  })

  const emailField = form.field('email')
  const passwordField = form.field('password')

  return (
    <form noValidate onSubmit={submit} aria-describedby={falha ? 'login-falha' : undefined} className="flex flex-col gap-5">
      {falha && (
        <div
          key={falha.n}
          id="login-falha"
          role="alert"
          className="flex animate-fade-in gap-3 rounded-2xl border-2 border-alert-600/50 bg-alert-50 p-4 sm:p-5"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-6 shrink-0 text-alert-600" />
          <div>
            <p className="font-bold text-alert-700">{falha.msg}</p>
            <p className="mt-1 text-sm text-ink-soft">
              Confirme se as maiúsculas estão desligadas e use «Mostrar» para ver o que escreveu.
              {falha.n > 1 && (
                <>
                  {' '}
                  Se ainda não tem conta,{' '}
                  <Link to="/registar" className="link">
                    crie uma aqui
                  </Link>
                  .
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <InputField
        {...emailField}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        leading={<Mail />}
        placeholder="nome@exemplo.pt"
      />

      <div className="flex flex-col gap-1.5">
        <PasswordField
          {...passwordField}
          ref={(el) => {
            passwordField.ref(el)
            passwordRef.current = el
          }}
          label="Palavra-passe"
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={() =>
            toast.info(
              'Recuperar a palavra-passe',
              'Neste protótipo não enviamos emails. Crie uma conta nova ou entre com uma das contas de demonstração — os dados ficam apenas neste navegador.',
            )
          }
          className="link min-h-12 self-start text-sm"
        >
          Esqueci-me da palavra-passe
        </button>
      </div>

      <Button
        type="submit"
        size="lg"
        full
        disabled={form.submitting}
        aria-busy={form.submitting || undefined}
        iconRight={form.submitting ? <InlineSpinner /> : <ArrowRight aria-hidden className="size-5" />}
      >
        {form.submitting ? 'A entrar…' : 'Entrar'}
      </Button>
    </form>
  )
}
