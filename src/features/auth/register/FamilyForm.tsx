import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Check } from 'lucide-react'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { register, savePerfil } from '@/lib/store'
import { prefersReducedMotion } from '@/lib/motion'
import { EmailExisteErro, primeiroNome } from '../shared/EmailExisteErro'
import { ErrorSummary } from '../shared/ErrorSummary'
import { PasswordField } from '../shared/PasswordField'
import { PasswordStrength } from '../shared/PasswordStrength'
import { ActionButton } from '../shared/ActionButton'
import { StickyAction } from '../shared/StickyAction'
import { Appear, cascade } from '../shared/Appear'
import { enterAvanca } from '../shared/keyboard'
import { voltarPublico } from '../shared/redirect'
import { errorNode, pausa, useForm, type Rules } from '../shared/useForm'
import {
  MSG_EMAIL_EXISTE,
  formatarTelefone,
  validarEmail,
  validarNome,
  validarPalavraPasseNova,
  validarTelemovel,
} from '../shared/validators'
import { apagarRascunho, lerRascunho } from '@/features/family/perfil/perfilModel'
import { ConsentFields } from './ConsentFields'
import { CondicoesPrototipo } from './CondicoesPrototipo'
import { temRascunho } from './draft'

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
  termos: (v) => (v ? undefined : 'Para criar a conta, aceite as condições deste protótipo.'),
  privacidade: (v) => (v ? undefined : 'Confirme que leu a política de privacidade.'),
}
const ORDER: (keyof FamilyValues)[] = ['nome', 'email', 'telefone', 'password', 'termos', 'privacidade']
const INITIAL: FamilyValues = { nome: '', email: '', telefone: '', password: '', termos: false, privacidade: false }

/** Tempo do visto verde no botão antes de mudar de página. */
const PAUSA_SUCESSO = 420

/**
 * Registo da família.
 * - Perfil do questionário "Ajuda-me a escolher" com nome → fica guardado na conta logo ao criá-la, sem mais cliques.
 * - Destino: vindo de uma página pública (ex.: a ficha de um lar, a meio de um pedido: `/lar/x?acao=pedir`) → volta lá,
 *   com a intenção intacta; senão, com respostas do questionário ainda por guardar (sem nome) → /familia?importar=1;
 *   senão → /familia?bemvindo=1.
 */
export function FamilyForm({ voltar, onPending }: { voltar: string | null; onPending?: (pending: boolean) => void }) {
  const navigate = useNavigate()
  const form = useForm<FamilyValues>({ initial: INITIAL, rules: RULES, order: ORDER })
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [criada, setCriada] = useState(false)
  // o perfil completo do questionário (o mesmo que o painel guardaria), lido uma vez
  const rascunho = useMemo(() => lerRascunho(), [])
  const haRespostas = useMemo(() => temRascunho(), [])
  const pessoal = useMemo(() => [form.values.nome, form.values.email], [form.values.nome, form.values.email])

  const submit = form.handleSubmit(async (v) => {
    setErroGeral(null)
    await pausa(500)
    onPending?.(true)
    const r = register({
      role: 'familia',
      nome: v.nome,
      email: v.email,
      password: v.password,
      telefone: v.telefone.trim() ? formatarTelefone(v.telefone) : undefined,
    })
    if (!r.ok) {
      onPending?.(false)
      if (/email/i.test(r.error)) {
        form.setFieldError('email', r.error)
        requestAnimationFrame(() => form.focusField('email'))
      } else setErroGeral(r.error)
      return
    }
    // o perfil do questionário fica guardado já (é o que prometemos acima); sem nome, o painel pede-o depois
    const perfil = lerRascunho()
    const guardado = perfil?.nome.trim() ? savePerfil({ ...perfil, nome: perfil.nome.trim() }) : null
    if (guardado) apagarRascunho()
    form.freeze()
    setCriada(true)
    await pausa(prefersReducedMotion() ? 0 : PAUSA_SUCESSO)
    toast.success(
      `Conta criada. Bem-vindo(a), ${primeiroNome(r.user.nome)}.`,
      guardado ? `O perfil de ${primeiroNome(guardado.nome)} ficou guardado.` : undefined,
    )
    // o caminho de volta ganha: quem estava a pedir vaga num lar regressa lá (com ?acao=… para retomar)
    navigate(voltarPublico(voltar) ?? (temRascunho() ? '/familia?importar=1' : '/familia?bemvindo=1'), { replace: true })
  })

  const email = form.field('email')
  let i = 2 // a cascata continua depois do seletor e da frase da página

  return (
    <form noValidate onSubmit={submit} onKeyDown={(e) => enterAvanca(e)} aria-label="Criar conta de família" className="flex flex-col gap-5">
      {form.attempts > 0 && (form.visibleErrors.length > 0 || erroGeral) && (
        <ErrorSummary key={form.attempts} errors={form.visibleErrors} onSelect={form.focusField} extra={erroGeral} />
      )}

      {haRespostas && (
        <Appear delay={cascade(i++)}>
          <p className="flex gap-2.5 rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
            <Check aria-hidden className="mt-0.5 size-4.5 shrink-0 text-leaf-600" />
            <span>
              {rascunho?.nome.trim()
                ? `O perfil de ${primeiroNome(rascunho.nome)} que preencheu no questionário fica guardado na conta.`
                : 'Depois de criar a conta, pode guardar as respostas do questionário no seu painel.'}
            </span>
          </p>
        </Appear>
      )}

      <Appear delay={cascade(i++)}>
        <InputField {...form.field('nome')} label="Nome" autoComplete="name" autoCapitalize="words" enterKeyHint="next" />
      </Appear>
      <Appear delay={cascade(i++)}>
        <InputField
          {...email}
          error={form.errorOf('email') === MSG_EMAIL_EXISTE ? errorNode(<EmailExisteErro email={form.values.email} />, 'existe') : email.error}
          label="Email"
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
          label="Telemóvel"
          optional
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          enterKeyHint="next"
        />
      </Appear>
      <Appear delay={cascade(i++)}>
        <PasswordField
          {...form.field('password')}
          label="Palavra-passe"
          hint="Pelo menos 8 caracteres."
          autoComplete="new-password"
          enterKeyHint="done"
          below={<PasswordStrength password={form.values.password} pessoal={pessoal} />}
        />
      </Appear>

      <Appear delay={cascade(i++)} className="mt-1">
        <ConsentFields
          legend="Consentimentos"
          items={[
            {
              key: 'termos',
              props: form.checkbox('termos'),
              error: form.errorOf('termos'),
              label: (
                <>
                  Aceito as <CondicoesPrototipo onAceitar={() => form.setValue('termos', true)} />
                </>
              ),
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
