/**
 * Folha de compra do Acesso Família. É uma SIMULAÇÃO: nesta demonstração nada é cobrado
 * (na versão real é o Stripe Checkout com MB WAY, Multibanco ou cartão, e a fatura-recibo segue por email).
 *
 * - Telemóvel: folha que sobe do fundo; desktop: diálogo (o `Modal` trata disso).
 * - O consentimento para o acesso começar já é obrigatório: num serviço digital que começa de imediato, a pessoa só
 *   deixa de poder exercer o direito de livre resolução de 14 dias se o pedir expressamente e reconhecer essa perda
 *   (DL 24/2014, art. 17.º). Texto a confirmar com apoio jurídico antes de haver pagamentos reais.
 * - Os dados do cartão nunca saem do estado do componente; só o cartão de teste é aceite.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { CircleCheck } from 'lucide-react'
import type { MetodoPagamentoFamilia, PlanoFamiliaId } from '@/types'
import { comprarAcessoDemo, useAcesso, useCurrentUser } from '@/lib/store'
import { novoAte, planoFamilia, PLANOS_FAMILIA, precoTexto } from '@/lib/acesso'
import { prefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/cn'
import { Modal } from '@/components/ui/Modal'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Checkbox, InputField } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import {
  ateExtenso,
  CARTAO_TESTE,
  formatarCartao,
  formatarValidade,
  MULTIBANCO_DEMO,
  telemovelInicial,
  validadeTeste,
  validarCartao,
  validarCvc,
  validarTelemovelMbway,
  validarValidade,
} from './compra'
import { IvaSemRenovacao } from './texto'

type Campo = 'telemovel' | 'numero' | 'validade' | 'cvc' | 'consentimento'
type Erros = Partial<Record<Campo, string>>
/** ordem do formulário: o foco vai para o primeiro erro */
const ORDEM: Campo[] = ['telemovel', 'numero', 'validade', 'cvc', 'consentimento']
/** os campos de cada método (o consentimento vale para todos) */
const CAMPOS: Record<MetodoPagamentoFamilia, Campo[]> = { mbway: ['telemovel'], multibanco: [], cartao: ['numero', 'validade', 'cvc'] }

const METODOS: { id: MetodoPagamentoFamilia; label: string }[] = [
  { id: 'mbway', label: 'MB WAY' },
  { id: 'multibanco', label: 'Multibanco' },
  { id: 'cartao', label: 'Cartão' },
]

const CONSENTIMENTO =
  'Peço que o acesso comece já e sei que, por isso, deixo de poder exercer o direito de livre resolução de 14 dias.'

/** Tempo da "confirmação" simulada (o botão mostra que está a confirmar). */
const ESPERA_MS = 1100

function Spinner() {
  return <span aria-hidden className="inline-block size-[1.1em] animate-spin rounded-full border-2 border-current border-t-transparent opacity-80" />
}

export function CompraModal({
  open,
  plano: planoId,
  onPlano,
  onClose,
  continuar,
}: {
  open: boolean
  plano: PlanoFamiliaId
  /** trocar de passe dentro da folha */
  onPlano: (p: PlanoFamiliaId) => void
  onClose: () => void
  /** para onde segue "Continuar" depois de pagar (caminho interno já validado) */
  continuar: string
}) {
  const navigate = useNavigate()
  const user = useCurrentUser()
  const acesso = useAcesso()
  const plano = planoFamilia(planoId)
  const outro = PLANOS_FAMILIA.find((p) => p.id !== plano.id)
  const preco = precoTexto(plano.precoCentimos)
  // a folha monta-se de novo a cada abertura (key no pai): isto fica como estava ao abrir
  const [somar] = useState(acesso.ativo)

  const [metodo, setMetodo] = useState<MetodoPagamentoFamilia>('mbway')
  const [telemovel, setTelemovel] = useState(() => telemovelInicial(user?.telefone))
  const [cartao, setCartao] = useState({ numero: '', validade: '', cvc: '' })
  const [consentimento, setConsentimento] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [estado, setEstado] = useState<'escolha' | 'a-pagar' | 'feito'>('escolha')
  const [ate, setAte] = useState<string | null>(null)

  const formId = useId()
  const consentErroId = useId()
  const refs = {
    telemovel: useRef<HTMLInputElement>(null),
    numero: useRef<HTMLInputElement>(null),
    validade: useRef<HTMLInputElement>(null),
    cvc: useRef<HTMLInputElement>(null),
    consentimento: useRef<HTMLDivElement>(null),
  }
  const continuarRef = useRef<HTMLButtonElement>(null)
  const temporizador = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(temporizador.current), [])

  // o botão de pagar desaparece: o foco passa para "Continuar" (a mensagem é anunciada pela região viva)
  useEffect(() => {
    if (estado === 'feito') continuarRef.current?.focus()
  }, [estado])

  const ocupado = estado !== 'escolha'
  const feito = estado === 'feito' && ate

  function validarCampo(c: Campo, v: string): string | undefined {
    switch (c) {
      case 'telemovel':
        return validarTelemovelMbway(v)
      case 'numero':
        return validarCartao(v)
      case 'validade':
        return validarValidade(v)
      case 'cvc':
        return validarCvc(v)
      case 'consentimento':
        return v ? undefined : 'Para continuar, confirme que pede que o acesso comece já.'
    }
  }

  /** depois de um erro, o campo volta a ser validado enquanto se escreve (o erro sai assim que fica certo) */
  const revalidar = (c: Campo, v: string) => {
    if (erros[c]) setErros((e) => ({ ...e, [c]: validarCampo(c, v) }))
  }

  function focar(c: Campo) {
    if (c === 'consentimento') refs.consentimento.current?.querySelector('input')?.focus()
    else refs[c].current?.focus()
  }

  const pagar = (ev: FormEvent) => {
    ev.preventDefault()
    if (ocupado) return
    const campos: Campo[] = [...CAMPOS[metodo], 'consentimento']
    const valores: Record<Campo, string> = { telemovel, ...cartao, consentimento: consentimento ? 'sim' : '' }
    const novos: Erros = {}
    for (const c of campos) {
      const e = validarCampo(c, valores[c])
      if (e) novos[c] = e
    }
    setErros(novos)
    setErroGeral(null)
    const primeiro = ORDEM.find((c) => novos[c])
    if (primeiro) {
      focar(primeiro)
      return
    }
    setEstado('a-pagar')
    temporizador.current = window.setTimeout(
      () => {
        const r = comprarAcessoDemo(plano.id, metodo)
        if (!r.ok) {
          setErroGeral(r.erro)
          setEstado('escolha')
          return
        }
        setAte(r.ate)
        setEstado('feito')
      },
      prefersReducedMotion() ? 200 : ESPERA_MS,
    )
  }

  const usarCartaoTeste = () => {
    setCartao({ numero: CARTAO_TESTE, validade: validadeTeste(), cvc: '123' })
    setErros((e) => ({ ...e, numero: undefined, validade: undefined, cvc: undefined }))
  }

  const mudarMetodo = (m: MetodoPagamentoFamilia) => {
    if (ocupado) return
    setMetodo(m)
    setErroGeral(null)
    // os erros dos campos do outro método deixam de estar à vista
    setErros((e) => ({ consentimento: e.consentimento }))
  }

  const titulo = feito ? 'Pagamento confirmado' : somar ? 'Somar dias ao Acesso Família' : 'Ativar o Acesso Família'
  const fimPrevisto = ateExtenso(novoAte(user?.acesso, plano))
  const rotuloPagar = metodo === 'multibanco' ? 'Simular pagamento recebido' : `Pagar ${preco}`

  return (
    <Modal
      open={open}
      // durante a confirmação simulada (1 s) a folha não fecha: o pagamento ficava a meio
      onClose={() => {
        if (estado !== 'a-pagar') onClose()
      }}
      title={titulo}
      description={
        <>
          <strong className="font-semibold text-sun-800">Simulação de pagamento</strong> — nesta demonstração nada é cobrado.
        </>
      }
      footer={
        feito ? (
          <>
            <ButtonLink to="/familia" variant="subtle">
              Ir para o painel
            </ButtonLink>
            <Button ref={continuarRef} onClick={() => navigate(continuar)}>
              Continuar
            </Button>
          </>
        ) : (
          <Button type="submit" form={formId} aria-disabled={ocupado || undefined} aria-busy={estado === 'a-pagar' || undefined} className={cn(ocupado && 'cursor-progress')}>
            {estado === 'a-pagar' ? (
              <>
                <Spinner />A confirmar o pagamento…
              </>
            ) : (
              rotuloPagar
            )}
          </Button>
        )
      }
    >
      {/* região viva: existe desde o início, para o leitor de ecrã anunciar o fim da compra */}
      <div aria-live="polite" aria-atomic="true">
        {feito && (
          <div className="flex flex-col items-center pt-2 text-center">
            <CircleCheck aria-hidden strokeWidth={1.5} className="size-16 text-leaf-600" />
            <p className="mt-4 max-w-[24ch] text-2xl leading-snug font-semibold text-ink">Acesso Família ativo até {ateExtenso(ate)}</p>
          </div>
        )}
      </div>

      {feito ? (
        <div className="flex flex-col items-center pb-3 text-center">
          <p className="mt-3 max-w-[40ch] text-lg text-ink-soft">
            Já vê que instituições têm vaga e quantos lugares, os preços por quarto, a previsão de espera e os contactos.
          </p>
          <p className="mt-3 text-base text-ink-mute">Sem renovação automática. Foi uma simulação: nada foi cobrado.</p>
        </div>
      ) : (
        <form id={formId} noValidate onSubmit={pagar} className="flex flex-col gap-6 pb-1">
          {/* o passe escolhido */}
          <div className="rounded-2xl bg-sand p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-lg font-semibold text-ink">Passe de {plano.nome}</p>
              <p className="text-xl font-semibold text-ink tabular sm:text-2xl">{preco}</p>
            </div>
            <p className="mt-0.5 text-sm text-ink-mute">
              <IvaSemRenovacao />
            </p>
            <p className="mt-2 text-base text-ink-soft sm:mt-3">
              {somar ? `Os ${plano.dias} dias somam-se aos que faltam: fica` : 'Fica'} ativo até{' '}
              <span className="font-semibold text-ink">{fimPrevisto}</span>.
            </p>
            {outro && (
              <button
                type="button"
                disabled={ocupado}
                onClick={() => onPlano(outro.id)}
                className="link -mb-2 inline-flex min-h-11 items-center text-base disabled:cursor-not-allowed disabled:text-ink-mute"
              >
                Mudar para {outro.nome} · {precoTexto(outro.precoCentimos)}
              </button>
            )}
          </div>

          {/* método: controlo segmentado com rádios nativos (setas do teclado, leitor de ecrã) */}
          <fieldset>
            <legend className="text-base font-medium text-ink">Como quer pagar?</legend>
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-sand p-1">
              {METODOS.map((m) => (
                <label
                  key={m.id}
                  className={cn(
                    'relative flex min-h-12 cursor-pointer items-center justify-center rounded-full px-2 text-center text-[0.9375rem] font-medium transition-[background-color,color,box-shadow] duration-200',
                    'text-ink-soft hover:text-ink has-[:checked]:bg-white has-[:checked]:text-ink has-[:checked]:shadow-soft',
                    'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
                  )}
                >
                  <input type="radio" name={`${formId}-metodo`} value={m.id} checked={metodo === m.id} onChange={() => mudarMetodo(m.id)} className="sr-only" />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          {metodo === 'mbway' && (
            <InputField
              ref={refs.telemovel}
              label="Telemóvel associado ao MB WAY"
              hint="Na versão real, recebe o pedido na app MB WAY para confirmar."
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              enterKeyHint="done"
              placeholder="912 345 678"
              value={telemovel}
              onChange={(e) => {
                setTelemovel(e.target.value)
                revalidar('telemovel', e.target.value)
              }}
              error={erros.telemovel}
            />
          )}

          {metodo === 'multibanco' && (
            <div className="rounded-2xl bg-sand p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-semibold text-ink">Referência Multibanco</p>
                <Badge tone="sun" size="md">
                  de demonstração
                </Badge>
              </div>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-lg">
                <dt className="text-ink-mute">Entidade</dt>
                <dd className="font-semibold text-ink tabular">{MULTIBANCO_DEMO.entidade}</dd>
                <dt className="text-ink-mute">Referência</dt>
                <dd className="font-semibold text-ink tabular">{MULTIBANCO_DEMO.referencia}</dd>
                <dt className="text-ink-mute">Valor</dt>
                <dd className="font-semibold text-ink tabular">{preco}</dd>
              </dl>
              <p className="mt-3 text-base text-ink-soft">
                Na versão real, paga no multibanco ou no homebanking, e o acesso começa quando o pagamento chega.
              </p>
            </div>
          )}

          {metodo === 'cartao' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col items-start gap-3 rounded-2xl bg-sand p-4 sm:p-5">
                <p className="text-base text-ink-soft">
                  Só funciona o cartão de teste <span className="font-semibold whitespace-nowrap text-ink tabular">{CARTAO_TESTE}</span>, com
                  qualquer data futura e qualquer CVC. Não escreva os dados de um cartão verdadeiro.
                </p>
                <Button variant="secondary" disabled={ocupado} onClick={usarCartaoTeste} className="w-full sm:w-auto">
                  Usar cartão de teste
                </Button>
              </div>
              <InputField
                ref={refs.numero}
                label="Número do cartão"
                inputMode="numeric"
                autoComplete="off"
                placeholder={CARTAO_TESTE}
                maxLength={19}
                value={cartao.numero}
                onChange={(e) => {
                  const v = formatarCartao(e.target.value)
                  setCartao((c) => ({ ...c, numero: v }))
                  revalidar('numero', v)
                }}
                error={erros.numero}
              />
              <div className="grid grid-cols-2 gap-3">
                <InputField
                  ref={refs.validade}
                  label="Validade"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="MM/AA"
                  maxLength={5}
                  value={cartao.validade}
                  onChange={(e) => {
                    const v = formatarValidade(e.target.value)
                    setCartao((c) => ({ ...c, validade: v }))
                    revalidar('validade', v)
                  }}
                  error={erros.validade}
                />
                <InputField
                  ref={refs.cvc}
                  label="CVC"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="123"
                  maxLength={4}
                  value={cartao.cvc}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 4)
                    setCartao((c) => ({ ...c, cvc: v }))
                    revalidar('cvc', v)
                  }}
                  error={erros.cvc}
                />
              </div>
            </div>
          )}

          <div ref={refs.consentimento} className="flex flex-col gap-1">
            <Checkbox
              label={CONSENTIMENTO}
              checked={consentimento}
              required
              aria-invalid={erros.consentimento ? true : undefined}
              aria-describedby={erros.consentimento ? consentErroId : undefined}
              onChange={(e) => {
                setConsentimento(e.target.checked)
                revalidar('consentimento', e.target.checked ? 'sim' : '')
              }}
            />
            {erros.consentimento && (
              <p id={consentErroId} role="alert" className="pl-10 text-sm font-medium text-alert-700">
                {erros.consentimento}
              </p>
            )}
          </div>

          {erroGeral && (
            <p role="alert" className="rounded-2xl bg-alert-50 px-4 py-3 text-base font-medium text-alert-700">
              {erroGeral}
            </p>
          )}
        </form>
      )}
    </Modal>
  )
}
