import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import type { TipoOrganizacao } from '@/types'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { register } from '@/lib/store'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { EmailExisteErro, primeiroNome } from '../shared/EmailExisteErro'
import { ErrorSummary } from '../shared/ErrorSummary'
import { PasswordField } from '../shared/PasswordField'
import { PasswordStrength } from '../shared/PasswordStrength'
import { ActionButton } from '../shared/ActionButton'
import { StickyAction } from '../shared/StickyAction'
import { Appear, cascade } from '../shared/Appear'
import { enterAvanca } from '../shared/keyboard'
import { destinoAposRegistoProfissional } from '../shared/redirect'
import { errorNode, pausa, useForm, type Rules } from '../shared/useForm'
import {
  MSG_EMAIL_EXISTE,
  formatarTelefone,
  validarEmail,
  validarNome,
  validarPalavraPasseNova,
  validarTelefone,
} from '../shared/validators'
import { ConsentFields } from './ConsentFields'
import { CondicoesPrototipo } from './CondicoesPrototipo'

type ProValues = {
  nome: string
  email: string
  telefone: string
  orgTipo: string
  orgNome: string
  servico: string
  password: string
  termos: boolean
}

const TIPOS_ORGANIZACAO: { value: TipoOrganizacao; label: string }[] = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'centro_saude', label: 'Centro de saúde' },
  { value: 'autarquia', label: 'Câmara municipal' },
  { value: 'outro', label: 'Outro' },
]

const RULES: Rules<ProValues> = {
  nome: (v) => validarNome(v),
  email: (v) => validarEmail(v, { novo: true }),
  telefone: (v) => (!v.trim() ? 'Indique um telefone para as instituições lhe responderem.' : validarTelefone(v)),
  orgTipo: (v) => (!v ? 'Escolha o tipo de organização.' : undefined),
  orgNome: (v) => validarNome(v, 'o nome da organização'),
  password: (v) => validarPalavraPasseNova(v),
  termos: (v) => (v ? undefined : 'Para criar a conta, confirme que trabalha nesta organização e aceite as condições deste protótipo.'),
}
const ORDER: (keyof ProValues)[] = ['nome', 'email', 'telefone', 'orgTipo', 'orgNome', 'servico', 'password', 'termos']
const INITIAL: ProValues = {
  nome: '',
  email: '',
  telefone: '',
  orgTipo: 'hospital',
  orgNome: '',
  servico: '',
  password: '',
  termos: false,
}

/** Tempo do visto verde no botão antes de mudar de página. */
const PAUSA_SUCESSO = 420

/** Tipo de organização em pílulas (rádios nativos: setas para mudar). Escolhida = preenchida a preto, não só outra cor. */
function TipoOrganizacaoField({
  value,
  onChange,
  inputRef,
  error,
}: {
  value: string
  onChange: (v: TipoOrganizacao) => void
  inputRef: (el: HTMLElement | null) => void
  error?: string
}) {
  const errId = `${useId()}-err`
  return (
    <fieldset className="min-w-0" aria-describedby={error ? errId : undefined}>
      <legend className="mb-2 text-base font-medium text-ink">Tipo</legend>
      <div className="flex flex-wrap gap-2">
        {TIPOS_ORGANIZACAO.map((t) => {
          const ativo = value === t.value
          return (
            <label
              key={t.value}
              className={cn(
                'relative inline-flex min-h-12 cursor-pointer items-center rounded-full border px-4.5 text-base font-medium select-none',
                'transition-[background-color,border-color,color,scale] duration-200 active:scale-[0.97] motion-reduce:transition-none',
                'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
                ativo ? 'border-ink bg-ink text-white' : 'border-pine-400 bg-white text-ink hover:border-pine-500',
              )}
            >
              <input
                ref={ativo ? inputRef : undefined}
                type="radio"
                name="org-tipo"
                value={t.value}
                checked={ativo}
                onChange={() => onChange(t.value)}
                className="sr-only"
              />
              {t.label}
            </label>
          )
        })}
      </div>
      {error && (
        <p id={errId} role="alert" className="mt-2 text-sm font-medium text-alert-700">
          {errorNode(error, error)}
        </p>
      )}
    </fieldset>
  )
}

/**
 * Registo de profissional de saúde (assistente social de um hospital, centro de saúde ou câmara municipal).
 * Uma só página: os seus dados, onde trabalha (aparece nos pedidos: «Encaminhado por …») e a palavra-passe.
 * Destino: o `voltar` quando é da área dos casos ou uma página pública a retomar; senão, /casos.
 */
export function ProfissionalForm({ voltar, onPending }: { voltar: string | null; onPending?: (pending: boolean) => void }) {
  const navigate = useNavigate()
  const form = useForm<ProValues>({ initial: INITIAL, rules: RULES, order: ORDER })
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [criada, setCriada] = useState(false)
  const v = form.values
  const pessoal = useMemo(() => [v.nome, v.email, v.orgNome], [v.nome, v.email, v.orgNome])

  const submit = form.handleSubmit(async (vals) => {
    setErroGeral(null)
    await pausa(500)
    onPending?.(true)
    const r = register({
      role: 'profissional',
      nome: vals.nome,
      email: vals.email,
      password: vals.password,
      telefone: formatarTelefone(vals.telefone),
      organizacao: {
        nome: vals.orgNome.trim(),
        tipo: vals.orgTipo as TipoOrganizacao,
        servico: vals.servico.trim() || undefined,
      },
    })
    if (!r.ok) {
      onPending?.(false)
      if (/email/i.test(r.error)) {
        form.setFieldError('email', r.error)
        requestAnimationFrame(() => form.focusField('email'))
      } else setErroGeral(r.error)
      return
    }
    form.freeze()
    setCriada(true)
    await pausa(prefersReducedMotion() ? 0 : PAUSA_SUCESSO)
    const destino = destinoAposRegistoProfissional(voltar)
    toast.success(
      `Conta criada. Bem-vindo(a), ${primeiroNome(r.user.nome)}.`,
      destino === '/casos' ? 'Já pode criar o primeiro caso.' : undefined,
    )
    navigate(destino, { replace: true })
  })

  const email = form.field('email')
  const tipo = form.field('orgTipo')
  let i = 2 // a cascata continua depois do seletor e da frase da página

  return (
    <form
      noValidate
      onSubmit={submit}
      onKeyDown={(e) => enterAvanca(e)}
      aria-label="Criar conta de profissional de saúde"
      className="flex flex-col gap-5"
    >
      {form.attempts > 0 && (form.visibleErrors.length > 0 || erroGeral) && (
        <ErrorSummary key={form.attempts} errors={form.visibleErrors} onSelect={form.focusField} extra={erroGeral} />
      )}

      <Appear delay={cascade(i++)}>
        <InputField {...form.field('nome')} label="Nome" autoComplete="name" autoCapitalize="words" enterKeyHint="next" />
      </Appear>
      <Appear delay={cascade(i++)}>
        <InputField
          {...email}
          error={form.errorOf('email') === MSG_EMAIL_EXISTE ? errorNode(<EmailExisteErro email={v.email} />, 'existe') : email.error}
          label="Email profissional"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
        />
      </Appear>
      <Appear delay={cascade(i++)}>
        <InputField
          {...form.field('telefone')}
          label="Telefone"
          hint="Direto ou do serviço. As instituições usam-no para lhe responder."
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
        />
      </Appear>

      <Appear delay={cascade(i++)} className="mt-3">
        <fieldset className="min-w-0">
          <legend className="text-xl font-semibold tracking-[-0.01em] text-ink">Onde trabalha</legend>
          <p className="mt-1 text-pretty text-ink-mute">Aparece nos pedidos que enviar às instituições.</p>
          <div className="mt-5 flex flex-col gap-5">
            <TipoOrganizacaoField
              value={tipo.value}
              onChange={(t) => form.setValue('orgTipo', t)}
              inputRef={tipo.ref}
              error={form.errorOf('orgTipo')}
            />
            <InputField
              {...form.field('orgNome')}
              label="Nome da organização"
              autoComplete="organization"
              autoCapitalize="words"
              enterKeyHint="next"
            />
            <InputField
              {...form.field('servico')}
              label="Serviço"
              optional
              hint="Por exemplo, Serviço Social."
              autoCapitalize="words"
              enterKeyHint="next"
            />
          </div>
        </fieldset>
      </Appear>

      <Appear delay={cascade(i++)} className="mt-3">
        <PasswordField
          {...form.field('password')}
          label="Palavra-passe"
          hint="Pelo menos 8 caracteres."
          autoComplete="new-password"
          enterKeyHint="done"
          below={<PasswordStrength password={v.password} pessoal={pessoal} />}
        />
      </Appear>

      <Appear delay={cascade(i++)} className="mt-1">
        <ConsentFields
          legend="Declaração"
          items={[
            {
              key: 'termos',
              props: form.checkbox('termos'),
              error: form.errorOf('termos'),
              label: (
                <>
                  Trabalho nesta organização e aceito as <CondicoesPrototipo onAceitar={() => form.setValue('termos', true)} />
                </>
              ),
              description: 'Só envio os dados de uma pessoa com o consentimento dela ou de quem a representa.',
            },
          ]}
        />
      </Appear>

      {/* último filho do formulário: no telemóvel cola ao fundo do ecrã até chegar ao seu lugar */}
      <StickyAction>
        <Appear delay={cascade(i++)} variant="up">
          <ActionButton
            state={criada ? 'done' : form.submitting ? 'loading' : 'idle'}
            labels={{ idle: 'Criar conta', loading: 'A criar a conta…', done: 'Conta criada' }}
          />
        </Appear>
      </StickyAction>
    </form>
  )
}
