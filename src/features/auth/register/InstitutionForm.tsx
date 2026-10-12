import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import type { Natureza, TipoResposta } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { register } from '@/lib/store'
import { EmailExisteErro, primeiroNome } from '../shared/EmailExisteErro'
import { ErrorSummary } from '../shared/ErrorSummary'
import { InlineSpinner } from '../shared/InlineSpinner'
import { PasswordField } from '../shared/PasswordField'
import { PasswordStrength } from '../shared/PasswordStrength'
import { guardarCargo } from '../shared/cargo'
import { pausa, useForm } from '../shared/useForm'
import { MSG_EMAIL_EXISTE, formatarTelefone } from '../shared/validators'
import { ConsentFields } from './ConsentFields'
import { InstituicaoFields } from './InstituicaoFields'
import { lugarCanonico } from './LugarCombobox'
import { INST_INITIAL, INST_ORDER, INST_RULES, type InstValues } from './institutionSchema'

function Grupo({ legend, children }: { legend: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-5 font-display text-2xl font-semibold tracking-[-0.02em] text-ink">{legend}</legend>
      {children}
    </fieldset>
  )
}

/** Registo de instituição: dois grupos curtos (responsável e instituição) e confirmação. */
export function InstitutionForm() {
  const navigate = useNavigate()
  const form = useForm<InstValues>({ initial: INST_INITIAL, rules: INST_RULES, order: INST_ORDER })
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const v = form.values
  const pessoal = useMemo(() => [v.nome, v.email, v.instNome], [v.nome, v.email, v.instNome])

  const submit = form.handleSubmit(async (vals) => {
    setErroGeral(null)
    await pausa(500)
    const r = register({
      role: 'lar',
      nome: vals.nome,
      email: vals.email,
      password: vals.password,
      telefone: formatarTelefone(vals.telefone),
      instituicao: {
        nome: vals.instNome,
        tipo: vals.tipo as TipoResposta,
        natureza: vals.natureza as Natureza,
        lugar: lugarCanonico(vals.lugar) ?? vals.lugar,
        morada: vals.morada,
        capacidade: Number(vals.capacidade.trim()),
        licenca: vals.licenca,
        precoDesde: Number(vals.precoDesde.trim()),
      },
    })
    if (!r.ok) {
      if (/email/i.test(r.error)) {
        form.setFieldError('email', r.error)
        requestAnimationFrame(() => form.focusField('email'))
      } else setErroGeral(r.error)
      return
    }
    guardarCargo(r.user.id, vals.cargo)
    toast.success(`Instituição registada. Bem-vindo(a), ${primeiroNome(r.user.nome)}.`)
    navigate('/gestao?bemvindo=1', { replace: true })
  })

  const email = form.field('email')

  return (
    <form noValidate onSubmit={submit} aria-label="Registar instituição" className="flex flex-col gap-12">
      {form.attempts > 0 && (form.visibleErrors.length > 0 || erroGeral) && (
        <ErrorSummary key={form.attempts} errors={form.visibleErrors} onSelect={form.focusField} extra={erroGeral} />
      )}

      <Grupo legend="Responsável">
        <div className="flex flex-col gap-5">
          <InputField {...form.field('nome')} label="Nome" autoComplete="name" />
          <InputField {...form.field('cargo')} label="Cargo" autoComplete="organization-title" />
          <InputField
            {...email}
            error={email.error === MSG_EMAIL_EXISTE ? <EmailExisteErro email={v.email} /> : email.error}
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
          <InputField
            {...form.field('telefone')}
            label="Telefone"
            hint="Aparece na ficha pública."
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
          />
          <PasswordField
            {...form.field('password')}
            label="Palavra-passe"
            hint="Pelo menos 8 caracteres."
            autoComplete="new-password"
            below={<PasswordStrength password={v.password} pessoal={pessoal} />}
          />
        </div>
      </Grupo>

      <Grupo legend="Instituição">
        <InstituicaoFields form={form} />
      </Grupo>

      <div className="flex flex-col gap-6">
        <ConsentFields
          legend="Declarações"
          items={[
            {
              key: 'termos',
              props: form.checkbox('termos'),
              error: form.errorOf('termos'),
              label: 'Represento esta instituição e aceito os termos de utilização',
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
          disabled={form.submitting}
          aria-busy={form.submitting || undefined}
          iconRight={form.submitting ? <InlineSpinner /> : undefined}
        >
          {form.submitting ? 'A registar…' : 'Registar instituição'}
        </Button>
      </div>
    </form>
  )
}
