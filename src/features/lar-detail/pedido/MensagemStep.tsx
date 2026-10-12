import { Link } from 'react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { Lar, PerfilIdoso, User } from '@/types'
import { Checkbox, Switch, TextareaField } from '@/components/ui/Field'
import { mensagemSugerida } from '../helpers'
import { VisitFields, validarVisita, type VisitaEscolha } from './VisitFields'

export interface DadosEnvio {
  mensagem: string
  visita?: VisitaEscolha
}

/** Mensagem para a instituição, visita opcional e consentimento RGPD. */
export function MensagemStep({
  lar,
  perfil,
  user,
  formId,
  comVisitaInicial,
  onEnviar,
}: {
  lar: Lar
  perfil: PerfilIdoso
  user: User
  formId: string
  comVisitaInicial: boolean
  onEnviar: (d: DadosEnvio) => void
}) {
  const [mensagem, setMensagem] = useState(() => mensagemSugerida(perfil, lar, user.nome))
  const [comVisita, setComVisita] = useState(comVisitaInicial)
  const [visita, setVisita] = useState<VisitaEscolha>({ data: '', hora: '15:00' })
  const [consentimento, setConsentimento] = useState(false)
  const [erroVisita, setErroVisita] = useState<string | null>(null)
  const [erroConsent, setErroConsent] = useState(false)
  const [tentativa, setTentativa] = useState(0)
  const consentRef = useRef<HTMLDivElement>(null)
  const visitaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!tentativa) return
    if (erroVisita) visitaRef.current?.querySelector<HTMLElement>('input')?.focus()
    else if (erroConsent) consentRef.current?.querySelector<HTMLElement>('input')?.focus()
  }, [tentativa, erroVisita, erroConsent])

  const submeter = (e: FormEvent) => {
    e.preventDefault()
    const ev = comVisita ? validarVisita(visita) : null
    setErroVisita(ev)
    setErroConsent(!consentimento)
    if (ev || !consentimento) {
      setTentativa((t) => t + 1)
      return
    }
    onEnviar({ mensagem, visita: comVisita ? visita : undefined })
  }

  return (
    <form id={formId} onSubmit={submeter} noValidate className="flex flex-col gap-6">
      <TextareaField
        label={`Mensagem para ${lar.nome}`}
        hint="Já escrevemos um rascunho com base no perfil. Acrescente o que a equipa deve saber (por exemplo, uma alta hospitalar)."
        rows={9}
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        maxLength={1500}
      />

      <div ref={visitaRef} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
        <Switch
          checked={comVisita}
          onChange={(v) => {
            setComVisita(v)
            if (!v) setErroVisita(null)
          }}
          label="Quero também marcar uma visita"
          description="Conhecer a casa antes de decidir é o passo mais importante."
        />
        {comVisita && (
          <div className="mt-4 border-t border-line pt-4">
            <VisitFields value={visita} onChange={(v) => setVisita(v)} erro={erroVisita} />
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-sand/60 p-4 sm:p-5">
        <p className="text-sm font-bold text-ink">A instituição vai receber</p>
        <ul className="mt-2 space-y-1 text-sm text-ink-soft">
          <li>
            O perfil de <strong className="text-ink">{perfil.nome}</strong> ({perfil.idade} anos): grau de dependência, cuidados necessários, orçamento e
            urgência.
          </li>
          <li>
            O seu contacto: {user.nome} · {user.email}
            {user.telefone ? ` · ${user.telefone}` : ''}.
          </li>
        </ul>
        <div ref={consentRef} className="mt-3 border-t border-line pt-2">
          <Checkbox
            checked={consentimento}
            onChange={(e) => {
              setConsentimento(e.target.checked)
              if (e.target.checked) setErroConsent(false)
            }}
            aria-invalid={erroConsent || undefined}
            aria-describedby={erroConsent ? `${formId}-consent-erro` : undefined}
            label="Autorizo a partilha do perfil de saúde com esta instituição"
            description={
              <>
                Só para avaliar este pedido. Pode retirá-lo a qualquer momento.{' '}
                <Link to="/privacidade" className="link text-sm" target="_blank">
                  Privacidade e dados<span className="sr-only"> (abre numa nova janela)</span>
                </Link>
              </>
            }
          />
          {erroConsent && (
            <p id={`${formId}-consent-erro`} role="alert" className="mt-1 flex items-center gap-2 text-sm font-bold text-alert-700">
              <ShieldCheck aria-hidden className="size-4" />
              Para enviar o pedido precisamos da sua autorização.
            </p>
          )}
        </div>
      </div>
    </form>
  )
}
