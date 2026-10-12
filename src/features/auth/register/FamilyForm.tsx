import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { register } from '@/lib/store'
import { EmailExisteErro, primeiroNome } from '../shared/EmailExisteErro'
import { ErrorSummary } from '../shared/ErrorSummary'
import { InlineSpinner } from '../shared/InlineSpinner'
import { PasswordField } from '../shared/PasswordField'
import { PasswordStrength } from '../shared/PasswordStrength'
import { voltarPublico } from '../shared/redirect'
import { pausa, useForm, type Rules } from '../shared/useForm'
import {
  MSG_EMAIL_EXISTE,
  formatarTelefone,
  validarEmail,
  validarNome,
  validarPalavraPasseNova,
  validarTelemovel,
} from '../shared/validators'
import { ConsentFields } from './ConsentFields'
import { lerRascunho, temRascunho } from './draft'

type FamilyValues = {
  nome: string
  email: string
  telefone: string
  password: string
  termos: boolean
  privacidade: boolean
}

const RULES: Rules<FamilyValues> = {
  nome: (v) => validarNome(v),
  email: (v) => validarEmail(v, { novo: true }),
  telefone: (v) => validarTelemovel(v),
  password: (v) => validarPalavraPasseNova(v),
  termos: (v) => (v ? undefined : 'Para criar a conta, aceite os termos de utilização.'),
  privacidade: (v) => (v ? undefined : 'Confirme que leu a política de privacidade.'),
}
const ORDER: (keyof FamilyValues)[] = ['nome', 'email', 'telefone', 'password', 'termos', 'privacidade']
const INITIAL: FamilyValues = { nome: '', email: '', telefone: '', password: '', termos: false, privacidade: false }

/**
 * Registo da família. Destino: com respostas do questionário por guardar → /familia?importar=1;
 * vindo de uma página pública (ex.: a ficha de um lar) → volta lá; senão → /familia?bemvindo=1.
 */
export function FamilyForm({ voltar }: { voltar: string | null }) {
  const navigate = useNavigate()
  const form = useForm<FamilyValues>({ initial: INITIAL, rules: RULES, order: ORDER })
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const rascunho = useMemo(() => lerRascunho(), [])
  const pessoal = useMemo(() => [form.values.nome, form.values.email], [form.values.nome, form.values.email])

  const submit = form.handleSubmit(async (v) => {
    setErroGeral(null)
    await pausa(500)
    const r = register({
      role: 'familia',
      nome: v.nome,
      email: v.email,
      password: v.password,
      telefone: v.telefone.trim() ? formatarTelefone(v.telefone) : undefined,
    })
    if (!r.ok) {
      if (/email/i.test(r.error)) {
        form.setFieldError('email', r.error)
        requestAnimationFrame(() => form.focusField('email'))
      } else setErroGeral(r.error)
      return
    }
    toast.success(`Conta criada. Bem-vindo(a), ${primeiroNome(r.user.nome)}.`)
    navigate(temRascunho() ? '/familia?importar=1' : (voltarPublico(voltar) ?? '/familia?bemvindo=1'), { replace: true })
  })

  const email = form.field('email')

  return (
    <form noValidate onSubmit={submit} aria-label="Criar conta de família" className="flex flex-col gap-5">
      {form.attempts > 0 && (form.visibleErrors.length > 0 || erroGeral) && (
        <ErrorSummary key={form.attempts} errors={form.visibleErrors} onSelect={form.focusField} extra={erroGeral} />
      )}

      {rascunho && (
        <p className="flex gap-2.5 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
          <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-leaf-600" />
          <span>
            {rascunho.nome
              ? `O perfil de ${rascunho.nome.split(' ')[0]} que preencheu no questionário fica guardado na conta.`
              : 'As respostas do questionário ficam guardadas na conta.'}
          </span>
        </p>
      )}

      <InputField {...form.field('nome')} label="Nome" autoComplete="name" />
      <InputField
        {...email}
        error={email.error === MSG_EMAIL_EXISTE ? <EmailExisteErro email={form.values.email} /> : email.error}
        label="Email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
      />
      <InputField {...form.field('telefone')} label="Telemóvel" optional type="tel" inputMode="tel" autoComplete="tel-national" />
      <PasswordField
        {...form.field('password')}
        label="Palavra-passe"
        hint="Pelo menos 8 caracteres."
        autoComplete="new-password"
        below={<PasswordStrength password={form.values.password} pessoal={pessoal} />}
      />

      <ConsentFields
        legend="Consentimentos"
        items={[
          {
            key: 'termos',
            props: form.checkbox('termos'),
            error: form.errorOf('termos'),
            label: 'Aceito os termos de utilização',
            description: 'A previsão de vagas é uma estimativa, não uma garantia.',
          },
          {
            key: 'privacidade',
            props: form.checkbox('privacidade'),
            error: form.errorOf('privacidade'),
            label: (
              <>
                Li a{' '}
                <Link to="/privacidade" target="_blank" className="link">
                  política de privacidade
                  <span className="sr-only"> (abre num novo separador)</span>
                </Link>
              </>
            ),
          },
        ]}
      />

      <Button
        type="submit"
        size="lg"
        full
        className="mt-1"
        disabled={form.submitting}
        aria-busy={form.submitting || undefined}
        iconRight={form.submitting ? <InlineSpinner /> : undefined}
      >
        {form.submitting ? 'A criar a conta…' : 'Criar conta'}
      </Button>
    </form>
  )
}
