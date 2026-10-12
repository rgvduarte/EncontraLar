import { useId, useMemo, useRef, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import type { Natureza, TipoResposta } from '@/types'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { useLenis } from '@/components/motion'
import { register } from '@/lib/store'
import { NATUREZA_LABEL, TIPO_LABEL } from '@/lib/labels'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { EmailExisteErro, primeiroNome } from '../shared/EmailExisteErro'
import { ErrorSummary } from '../shared/ErrorSummary'
import { PasswordField } from '../shared/PasswordField'
import { PasswordStrength } from '../shared/PasswordStrength'
import { ActionButton } from '../shared/ActionButton'
import { StickyAction } from '../shared/StickyAction'
import { SLIDE_MS, SlideSwitch } from '../shared/SlideSwitch'
import { Appear, cascade } from '../shared/Appear'
import { controlos, enterAvanca } from '../shared/keyboard'
import { guardarCargo } from '../shared/cargo'
import { errorNode, pausa, useForm } from '../shared/useForm'
import { MSG_EMAIL_EXISTE, formatarTelefone } from '../shared/validators'
import { ConsentFields } from './ConsentFields'
import { CondicoesPrototipo } from './CondicoesPrototipo'
import { InstituicaoFields } from './InstituicaoFields'
import { lugarCanonico } from './LugarCombobox'
import { INST_INITIAL, INST_ORDER, INST_RULES, type InstValues } from './institutionSchema'

/** Três passos curtos em vez de uma página comprida: cada um cabe (quase) num ecrã de telemóvel. */
const PASSOS: { key: string; titulo: string; descricao: string; campos: (keyof InstValues)[] }[] = [
  {
    key: 'responsavel',
    titulo: 'Responsável',
    descricao: 'Quem gere a conta e como falamos consigo.',
    campos: ['nome', 'cargo', 'email', 'telefone', 'password'],
  },
  {
    key: 'instituicao',
    titulo: 'Instituição',
    descricao: 'O essencial para aparecer no mapa. O resto completa-se no painel.',
    campos: ['instNome', 'tipo', 'natureza', 'lugar', 'morada', 'capacidade', 'licenca', 'precoDesde'],
  },
  {
    key: 'confirmacao',
    titulo: 'Confirmação',
    descricao: 'Reveja os dados e confirme.',
    campos: ['termos', 'privacidade'],
  },
]
const ULTIMO = PASSOS.length - 1
const PAUSA_SUCESSO = 420

const passoDe = (k: keyof InstValues) => Math.max(0, PASSOS.findIndex((p) => p.campos.includes(k)))

function CabecalhoPasso({ id, titulo, descricao, delay }: { id: string; titulo: string; descricao: string; delay?: number }) {
  return (
    <Appear delay={delay}>
      <h2 id={id} tabIndex={-1} className="font-display text-[1.75rem] leading-tight font-semibold tracking-[-0.02em] text-ink outline-none sm:text-3xl">
        {titulo}
      </h2>
      <p className="mt-1.5 text-ink-mute">{descricao}</p>
    </Appear>
  )
}

function LinhaResumo({ titulo, linhas, onAlterar }: { titulo: string; linhas: string[][]; onAlterar: () => void }) {
  return (
    <div className="flex items-start gap-3 py-4 pr-2 pl-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-mute">{titulo}</p>
        {linhas
          .map((l) => l.filter(Boolean))
          .filter((l) => l.length)
          .map((partes, i) => (
            <p key={i} className={i === 0 ? 'font-medium text-ink' : 'text-sm text-ink-soft'}>
              {/* cada parte fica inteira (só quebra nos "·"), a não ser que não caiba numa linha */}
              {partes.map((parte, j) => (
                <span key={j}>
                  {j > 0 && ' · '}
                  <span className="inline-block max-w-full break-words">{parte}</span>
                </span>
              ))}
            </p>
          ))}
      </div>
      <button
        type="button"
        onClick={onAlterar}
        className="min-h-12 shrink-0 rounded-full px-4 font-medium text-terra-600 transition-colors hover:bg-terra-50 active:bg-terra-100"
      >
        Alterar<span className="sr-only"> {titulo.toLowerCase()}</span>
      </button>
    </div>
  )
}

/**
 * Registo de instituição em três passos (responsável → instituição → confirmação), como os fluxos de
 * conta do iPhone: o passo seguinte entra a deslizar da direita, a barra de progresso enche-se, o botão
 * "Continuar" fica ao alcance do polegar e a tecla "seguinte" do teclado avança de campo em campo.
 * Todos os campos continuam montados (voltar atrás não apaga nada); um erro num passo anterior leva lá.
 */
export function InstitutionForm({ onPending }: { onPending?: (pending: boolean) => void }) {
  const navigate = useNavigate()
  const lenis = useLenis()
  const uid = useId()
  const [etapa, setEtapa] = useState(0)
  const etapaRef = useRef(0)
  etapaRef.current = etapa
  const topo = useRef<HTMLDivElement>(null)
  const paineis = useRef<(HTMLDivElement | null)[]>([])
  const [registada, setRegistada] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)

  const irPara = (n: number, foco: 'campo' | 'titulo' | null) => {
    flushSync(() => setEtapa(n))
    const t = topo.current
    if (t && t.getBoundingClientRect().top < 72) {
      if (lenis && !prefersReducedMotion()) lenis.scrollTo(t, { offset: -88, duration: 0.8 })
      else t.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
    }
    const painel = paineis.current[n]
    if (!painel || !foco) return
    const alvo = foco === 'campo' ? controlos(painel)[0] : painel.querySelector<HTMLElement>('h2')
    alvo?.focus({ preventScroll: true })
  }

  const form = useForm<InstValues>({
    initial: INST_INITIAL,
    rules: INST_RULES,
    order: INST_ORDER,
    // um erro noutro passo: ir lá primeiro, e só depois levar o foco ao campo
    reveal: (k) => {
      const p = passoDe(k)
      if (p === etapaRef.current) return 0
      irPara(p, null)
      return prefersReducedMotion() ? 30 : SLIDE_MS
    },
  })
  const v = form.values
  const pessoal = useMemo(() => [v.nome, v.email, v.instNome], [v.nome, v.email, v.instNome])

  const continuar = (e?: MouseEvent) => {
    // o botão seguinte é de submissão: não deixar este clique submeter o formulário
    e?.preventDefault()
    const primeiro = form.validate(PASSOS[etapa]!.campos)
    if (primeiro) {
      form.focusField(primeiro)
      return
    }
    irPara(Math.min(ULTIMO, etapa + 1), 'campo')
  }

  const submit = form.handleSubmit(async (vals) => {
    setErroGeral(null)
    await pausa(500)
    onPending?.(true)
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
      onPending?.(false)
      if (/email/i.test(r.error)) {
        form.setFieldError('email', r.error)
        requestAnimationFrame(() => form.focusField('email'))
      } else setErroGeral(r.error)
      return
    }
    guardarCargo(r.user.id, vals.cargo)
    form.freeze()
    setRegistada(true)
    await pausa(prefersReducedMotion() ? 0 : PAUSA_SUCESSO)
    toast.success(`Instituição registada. Bem-vindo(a), ${primeiroNome(r.user.nome)}.`)
    navigate('/gestao?bemvindo=1', { replace: true })
  })

  const email = form.field('email')
  const tid = (n: number) => `${uid}-passo-${n}`
  const painelRef = (n: number) => (el: HTMLDivElement | null) => {
    paineis.current[n] = el
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      onKeyDown={(e) => enterAvanca(e, etapa < ULTIMO ? () => continuar() : undefined)}
      aria-label="Registar instituição"
      className="flex flex-col gap-8"
    >
      {form.attempts > 0 && (form.visibleErrors.length > 0 || erroGeral) && (
        <ErrorSummary key={form.attempts} errors={form.visibleErrors} onSelect={form.focusField} extra={erroGeral} />
      )}

      {/* progresso: "‹ passo anterior" à esquerda, "Passo n de 3" à direita, barra em três segmentos */}
      <Appear delay={cascade(2)} variant="fade">
        <div ref={topo}>
          <div className="flex min-h-12 items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => irPara(etapa - 1, 'titulo')}
              className={cn(
                '-ml-2 inline-flex min-h-12 items-center gap-0.5 rounded-full pr-3 pl-1 font-medium text-terra-600 transition-[opacity,translate] duration-300 hover:text-terra-700',
                etapa === 0 && 'invisible -translate-x-2 opacity-0',
              )}
            >
              <ChevronLeft aria-hidden className="size-5" />
              {PASSOS[Math.max(0, etapa - 1)]!.titulo}
              <span className="sr-only"> (passo anterior)</span>
            </button>
            <p aria-live="polite" className="text-sm text-ink-mute tabular">
              Passo {etapa + 1} de {PASSOS.length}
              <span className="sr-only">: {PASSOS[etapa]!.titulo}</span>
            </p>
          </div>
          <div aria-hidden className="mt-1 grid grid-cols-3 gap-1.5">
            {PASSOS.map((p, n) => (
              <span key={p.key} className="h-1 overflow-hidden rounded-full bg-sand-deep">
                <span
                  className={cn(
                    'block h-full origin-left rounded-full bg-ink transition-[scale] duration-700 ease-[cubic-bezier(.16,1,.3,1)] motion-reduce:transition-none',
                    n <= etapa ? 'scale-x-100' : 'scale-x-0',
                  )}
                />
              </span>
            ))}
          </div>
        </div>
      </Appear>

      <SlideSwitch
        active={PASSOS[etapa]!.key}
        panels={[
          {
            key: 'responsavel',
            content: (
              <section ref={painelRef(0)} aria-labelledby={tid(0)}>
                <CabecalhoPasso id={tid(0)} titulo={PASSOS[0]!.titulo} descricao={PASSOS[0]!.descricao} delay={cascade(3)} />
                <div role="group" aria-labelledby={tid(0)} className="mt-6 flex flex-col gap-5">
                  <Appear delay={cascade(4)}>
                    <InputField {...form.field('nome')} label="Nome" autoComplete="name" autoCapitalize="words" enterKeyHint="next" />
                  </Appear>
                  <Appear delay={cascade(5)}>
                    <InputField {...form.field('cargo')} label="Cargo" autoComplete="organization-title" autoCapitalize="sentences" enterKeyHint="next" />
                  </Appear>
                  <Appear delay={cascade(6)}>
                    <InputField
                      {...email}
                      error={form.errorOf('email') === MSG_EMAIL_EXISTE ? errorNode(<EmailExisteErro email={v.email} />, 'existe') : email.error}
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
                  <Appear delay={cascade(7)}>
                    <InputField
                      {...form.field('telefone')}
                      label="Telefone"
                      hint="Aparece na ficha pública."
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      enterKeyHint="next"
                    />
                  </Appear>
                  <Appear delay={cascade(8)}>
                    <PasswordField
                      {...form.field('password')}
                      label="Palavra-passe"
                      hint="Pelo menos 8 caracteres."
                      autoComplete="new-password"
                      enterKeyHint="next"
                      below={<PasswordStrength password={v.password} pessoal={pessoal} />}
                    />
                  </Appear>
                </div>
              </section>
            ),
          },
          {
            key: 'instituicao',
            content: (
              <section ref={painelRef(1)} aria-labelledby={tid(1)}>
                <CabecalhoPasso id={tid(1)} titulo={PASSOS[1]!.titulo} descricao={PASSOS[1]!.descricao} />
                <div role="group" aria-labelledby={tid(1)} className="mt-6">
                  <InstituicaoFields form={form} />
                </div>
              </section>
            ),
          },
          {
            key: 'confirmacao',
            content: (
              <section ref={painelRef(2)} aria-labelledby={tid(2)}>
                <CabecalhoPasso id={tid(2)} titulo={PASSOS[2]!.titulo} descricao={PASSOS[2]!.descricao} />
                <div className="mt-6 overflow-hidden rounded-[1.25rem] ring-1 ring-line">
                  <LinhaResumo
                    titulo="Responsável"
                    linhas={[[v.nome.trim(), v.cargo.trim()], [v.email.trim(), v.telefone.trim() && formatarTelefone(v.telefone)]]}
                    onAlterar={() => irPara(0, 'campo')}
                  />
                  <div aria-hidden className="ml-4 h-px bg-line" />
                  <LinhaResumo
                    titulo="Instituição"
                    linhas={[
                      [v.instNome.trim(), lugarCanonico(v.lugar) ?? v.lugar.trim()],
                      [TIPO_LABEL[v.tipo as TipoResposta], NATUREZA_LABEL[v.natureza as Natureza]],
                      [
                        v.capacidade.trim() && `${v.capacidade.trim()} lugares`,
                        v.precoDesde.trim() && `desde ${Number(v.precoDesde.trim()).toLocaleString('pt-PT')} €`,
                      ],
                    ]}
                    onAlterar={() => irPara(1, 'campo')}
                  />
                </div>
                <div className="mt-6">
                  <ConsentFields
                    legend="Declarações"
                    items={[
                      {
                        key: 'termos',
                        props: form.checkbox('termos'),
                        error: form.errorOf('termos'),
                        label: (
                          <>
                            Represento esta instituição e aceito as{' '}
                            <CondicoesPrototipo onAceitar={() => form.setValue('termos', true)} />
                          </>
                        ),
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
                </div>
              </section>
            ),
          },
        ]}
      />

      {/* último filho do formulário: no telemóvel cola ao fundo do ecrã, ao alcance do polegar */}
      <StickyAction className="-mt-3">
        <Appear delay={cascade(9)} variant="up">
          {etapa < ULTIMO ? (
            <ActionButton key="continuar" type="button" onClick={continuar} labels={{ idle: 'Continuar' }} />
          ) : (
            <ActionButton
              key="registar"
              state={registada ? 'done' : form.submitting ? 'loading' : 'idle'}
              labels={{ idle: 'Registar instituição', loading: 'A registar…', done: 'Instituição registada' }}
            />
          )}
        </Appear>
      </StickyAction>
    </form>
  )
}
