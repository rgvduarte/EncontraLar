import { Link } from 'react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { Lar, PerfilIdoso, User } from '@/types'
import { Checkbox, Switch, TextareaField } from '@/components/ui/Field'
import { mensagemSugerida } from '../helpers'
import { VisitFields, validarVisita, type VisitaEscolha } from './VisitFields'

export interface DadosEnvio {
  mensagem: string
  visita?: VisitaEscolha
}

/** Mensagem para a instituição, visita opcional e consentimento RGPD (obrigatório). */
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

  // depois de uma tentativa falhada, leva o foco ao primeiro campo por corrigir
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
    <form id={formId} onSubmit={submeter} noValidate className="flex flex-col gap-8">
      <TextareaField
        label={`Mensagem para ${lar.nome}`}
        hint="Escrevemos um rascunho a partir do perfil. Acrescente o que a equipa deve saber, como uma alta hospitalar."
        rows={8}
        value={mensagem}
        onChange={(e) => setMensagem(e.target.value)}
        maxLength={1500}
      />

      <div ref={visitaRef} className="border-t border-line pt-4">
        <Switch
          checked={comVisita}
          onChange={(v) => {
            setComVisita(v)
            if (!v) setErroVisita(null)
          }}
          label="Marcar também uma visita"
          description="Conhecer a casa antes de decidir é o passo mais importante."
        />
        {comVisita && (
          <div className="mt-5">
            <VisitFields value={visita} onChange={setVisita} erro={erroVisita} />
          </div>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <p className="font-medium text-ink">A instituição vai receber</p>
        <p className="mt-1 text-ink-mute">
          O perfil de {perfil.nome} (dependência, cuidados, orçamento e urgência) e o seu contacto: {user.email}
          {user.telefone ? ` · ${user.telefone}` : ''}.
        </p>
        <div ref={consentRef} className="mt-3">
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
                Só para avaliar este pedido. Pode retirar a autorização a qualquer momento.{' '}
                <Link to="/privacidade" className="text-terra-600 hover:underline" target="_blank">
                  Privacidade<span className="sr-only"> (abre numa nova janela)</span>
                </Link>
              </>
            }
          />
          {erroConsent && (
            <p id={`${formId}-consent-erro`} role="alert" className="mt-1 text-sm font-medium text-alert-700">
              Para enviar o pedido precisamos da sua autorização.
            </p>
          )}
        </div>
      </div>
    </form>
  )
}
