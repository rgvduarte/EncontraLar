import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, ClipboardCheck, Mail, Phone, UserRound } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { register } from '@/lib/store'
import { EmailExisteErro, primeiroNome } from '../shared/EmailExisteErro'
import { ErrorSummary } from '../shared/ErrorSummary'
import { InlineSpinner } from '../shared/InlineSpinner'
import { PasswordField } from '../shared/PasswordField'
import { PasswordStrength } from '../shared/PasswordStrength'
import { PrototypeNote } from '../shared/PrototypeNote'
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
import { FormSection } from './FormSection'
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

/** Formulário de registo da família (passos 2 e 3). */
export function FamilyForm() {
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
    navigate(temRascunho() ? '/familia?importar=1' : '/familia?bemvindo=1', { replace: true })
  })

  const email = form.field('email')
  const quemRascunho = rascunho?.nome
    ? `${rascunho.nome.split(' ')[0]}${rascunho.relacao ? ` (${rascunho.relacao.toLowerCase()}${rascunho.idade ? `, ${rascunho.idade} anos` : ''})` : ''}`
    : null

  return (
    <form noValidate onSubmit={submit} aria-labelledby="passo-dados" className="flex flex-col gap-12">
      {form.attempts > 0 && (form.visibleErrors.length > 0 || erroGeral) && (
        <ErrorSummary
          key={form.attempts}
          errors={form.visibleErrors}
          onSelect={form.focusField}
          extra={erroGeral}
        />
      )}

      <FormSection
        n={2}
        id="passo-dados"
        title={<>Os seus <em>dados</em></>}
        intro="Usamos o nome e o contacto apenas nos pedidos que decidir enviar às instituições."
      >
        {rascunho && (
          <div className="mb-6 flex gap-3 rounded-2xl border border-leaf-200 bg-leaf-50 p-4 text-ink">
            <ClipboardCheck aria-hidden className="mt-0.5 size-6 shrink-0 text-leaf-700" />
            <p>
              <strong>As respostas do questionário estão guardadas.</strong>{' '}
              {quemRascunho
                ? `Ao criar a conta, o perfil de cuidados de ${quemRascunho} fica pronto no seu painel.`
                : 'Ao criar a conta, o perfil de cuidados fica pronto no seu painel.'}
            </p>
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2">
          <InputField
            {...form.field('nome')}
            label="Nome"
            autoComplete="name"
            leading={<UserRound />}
            wrapperClassName="sm:col-span-2"
            placeholder="Ex.: Ana Ferreira"
          />
          <InputField
            {...email}
            error={email.error === MSG_EMAIL_EXISTE ? <EmailExisteErro email={form.values.email} /> : email.error}
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            leading={<Mail />}
            hint="É com ele que entra na conta e recebe os alertas de vaga."
          />
          <InputField
            {...form.field('telefone')}
            label="Telemóvel"
            optional
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            leading={<Phone />}
            hint="Facilita o contacto das instituições a quem enviar pedidos."
            placeholder="912 345 678"
          />
          <div className="flex flex-col gap-3 sm:col-span-2">
            <PasswordField {...form.field('password')} label="Palavra-passe" autoComplete="new-password" hint="Pelo menos 8 caracteres." />
            <PasswordStrength password={form.values.password} pessoal={pessoal} />
          </div>
        </div>
      </FormSection>

      <FormSection n={3} id="passo-confirmar" title={<>Confirmar e <em>criar conta</em></>}>
        <ConsentFields
          legend="Consentimentos"
          items={[
            {
              key: 'termos',
              props: form.checkbox('termos'),
              error: form.errorOf('termos'),
              label: 'Aceito os termos de utilização',
              description:
                'O serviço é gratuito para famílias. As vagas são indicadas pelas instituições e a previsão é uma estimativa, não uma garantia.',
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
              description: 'Os dados de saúde de quem procura lar só são partilhados com as instituições a quem enviar um pedido.',
            },
          ]}
        />
        <div className="mt-8 flex flex-col gap-5 border-t border-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <PrototypeNote className="max-w-sm" />
          <Button
            type="submit"
            size="lg"
            disabled={form.submitting}
            aria-busy={form.submitting || undefined}
            iconRight={form.submitting ? <InlineSpinner /> : <ArrowRight aria-hidden className="size-5" />}
            className="sm:min-w-64"
          >
            {form.submitting ? 'A criar a conta…' : 'Criar conta de família'}
          </Button>
        </div>
      </FormSection>
    </form>
  )
}
