import { useRef, useState } from 'react'
import type { User } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { login } from '@/lib/store'
import { PasswordField } from '../shared/PasswordField'
import { InlineSpinner } from '../shared/InlineSpinner'
import { pausa, useForm, type Rules } from '../shared/useForm'
import { emailValido } from '../shared/validators'

type LoginValues = { email: string; password: string }

const RULES: Rules<LoginValues> = {
  email: (v) => (!v.trim() ? 'Indique o seu email.' : !emailValido(v) ? 'Escreva o email completo, por exemplo nome@exemplo.pt.' : undefined),
  password: (v) => (!v ? 'Indique a palavra-passe.' : undefined),
}
const ORDER: (keyof LoginValues)[] = ['email', 'password']

export function LoginForm({ defaultEmail = '', onSuccess }: { defaultEmail?: string; onSuccess: (user: User) => void }) {
  const form = useForm<LoginValues>({ initial: { email: defaultEmail, password: '' }, rules: RULES, order: ORDER })
  const [falha, setFalha] = useState<{ n: number; msg: string } | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)

  const submit = form.handleSubmit(async (v) => {
    setFalha(null)
    await pausa(400)
    const r = login(v.email, v.password)
    if (r.ok) {
      onSuccess(r.user)
      return
    }
    setFalha((f) => ({ n: (f?.n ?? 0) + 1, msg: r.error }))
    passwordRef.current?.focus()
    passwordRef.current?.select()
  })

  const passwordField = form.field('password')

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-5">
      <InputField
        {...form.field('email')}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
      />
      <PasswordField
        {...passwordField}
        ref={(el) => {
          passwordField.ref(el)
          passwordRef.current = el
        }}
        label="Palavra-passe"
        autoComplete="current-password"
      />

      {falha && (
        <p key={falha.n} role="alert" className="animate-fade-in rounded-2xl bg-alert-50 px-4 py-3 text-sm text-alert-700">
          {falha.msg}
          {falha.n > 1 && ' Confirme se as maiúsculas estão desligadas ou use «Mostrar» para ver o que escreveu.'}
        </p>
      )}

      <Button
        type="submit"
        size="lg"
        full
        className="mt-1"
        disabled={form.submitting}
        aria-busy={form.submitting || undefined}
        iconRight={form.submitting ? <InlineSpinner /> : undefined}
      >
        {form.submitting ? 'A entrar…' : 'Entrar'}
      </Button>
    </form>
  )
}
