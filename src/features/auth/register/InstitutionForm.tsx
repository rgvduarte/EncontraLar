import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { ArrowRight, BadgeCheck, Mail, Phone, UserRound } from 'lucide-react'
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
import { PrototypeNote } from '../shared/PrototypeNote'
import { guardarCargo } from '../shared/cargo'
import { pausa, useForm } from '../shared/useForm'
import { MSG_EMAIL_EXISTE, formatarTelefone } from '../shared/validators'
import { ConsentFields } from './ConsentFields'
import { FormSection } from './FormSection'
import { InstituicaoFields } from './InstituicaoFields'
import { InstitutionPreview, type InstitutionDraft } from './InstitutionPreview'
import { lugarCanonico } from './LugarCombobox'
import { INST_INITIAL, INST_ORDER, INST_RULES, type InstValues } from './institutionSchema'

/** Formulário de registo de instituição: responsável (2), instituição (3) e confirmação (4). */
export function InstitutionForm({ onDraftChange }: { onDraftChange?: (d: InstitutionDraft) => void }) {
  const navigate = useNavigate()
  const form = useForm<InstValues>({ initial: INST_INITIAL, rules: INST_RULES, order: INST_ORDER })
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const v = form.values
  const pessoal = useMemo(() => [v.nome, v.email, v.instNome], [v.nome, v.email, v.instNome])

  const draft = useMemo<InstitutionDraft>(
    () => ({ instNome: v.instNome, tipo: v.tipo, natureza: v.natureza, lugar: v.lugar, capacidade: v.capacidade, precoDesde: v.precoDesde }),
    [v.instNome, v.tipo, v.natureza, v.lugar, v.capacidade, v.precoDesde],
  )
  useEffect(() => onDraftChange?.(draft), [draft, onDraftChange])

  const submit = form.handleSubmit(async (vals) => {
    setErroGeral(null)
    await pausa(600)
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
    toast.success(`Instituição registada. Bem-vindo(a), ${primeiroNome(r.user.nome)}.`, 'A ficha fica com «verificação em curso» até à visita.')
    navigate('/gestao?bemvindo=1', { replace: true })
  })

  const email = form.field('email')

  return (
    <form noValidate onSubmit={submit} aria-labelledby="passo-responsavel" className="flex flex-col gap-12">
      {form.attempts > 0 && (form.visibleErrors.length > 0 || erroGeral) && (
        <ErrorSummary key={form.attempts} errors={form.visibleErrors} onSelect={form.focusField} extra={erroGeral} />
      )}

      <FormSection
        n={2}
        id="passo-responsavel"
        title={<>Quem é o <em>responsável</em></>}
        intro="A pessoa que vai gerir a ficha, atualizar as vagas e responder aos pedidos das famílias."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <InputField {...form.field('nome')} label="Nome" autoComplete="name" leading={<UserRound />} placeholder="Ex.: Helena Marques" />
          <InputField
            {...form.field('cargo')}
            label="Cargo"
            autoComplete="organization-title"
            leading={<BadgeCheck />}
            placeholder="Ex.: Diretora técnica"
          />
          <InputField
            {...email}
            error={email.error === MSG_EMAIL_EXISTE ? <EmailExisteErro email={v.email} /> : email.error}
            label="Email profissional"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            leading={<Mail />}
            hint="Recebe aqui os pedidos das famílias."
          />
          <InputField
            {...form.field('telefone')}
            label="Telefone da instituição"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            leading={<Phone />}
            hint="Aparece na ficha pública."
            placeholder="220 000 000"
          />
          <div className="flex flex-col gap-3 sm:col-span-2">
            <PasswordField {...form.field('password')} label="Palavra-passe" autoComplete="new-password" hint="Pelo menos 8 caracteres." />
            <PasswordStrength password={v.password} pessoal={pessoal} />
          </div>
        </div>
      </FormSection>

      <FormSection
        n={3}
        id="passo-instituicao"
        title={<>A <em>instituição</em></>}
        intro="O essencial para aparecer no mapa. Quartos, cuidados, equipa e vagas completam-se depois, no painel."
      >
        <InstituicaoFields form={form} />
        <div className="mt-10 lg:hidden">
          <p className="eyebrow mb-3">Assim vai aparecer</p>
          <InstitutionPreview draft={draft} />
        </div>
      </FormSection>

      <FormSection n={4} id="passo-confirmar-inst" title={<>Confirmar e <em>registar</em></>}>
        <ConsentFields
          legend="Declarações e consentimentos"
          items={[
            {
              key: 'autorizacao',
              props: form.checkbox('autorizacao'),
              error: form.errorOf('autorizacao'),
              label: 'Represento esta instituição e posso publicar informação em nome dela',
              description: 'Confirmamos este ponto na visita de verificação.',
            },
            {
              key: 'termos',
              props: form.checkbox('termos'),
              error: form.errorOf('termos'),
              label: 'Aceito os termos de utilização',
              description: 'Comprometo-me a manter as vagas e as mensalidades atualizadas e a responder aos pedidos das famílias.',
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
              description: 'Os perfis clínicos que as famílias partilham servem apenas para avaliar o pedido de vaga.',
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
            {form.submitting ? 'A registar…' : 'Registar instituição'}
          </Button>
        </div>
      </FormSection>
    </form>
  )
}
