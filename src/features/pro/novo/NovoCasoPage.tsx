import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Building2 } from 'lucide-react'
import { criarCaso, useLar, useLares } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { useAvisoAlteracoes } from '@/components/ui/useAvisoAlteracoes'
import { useDocumentTitle } from '@/lib/hooks'
import { plural } from '@/lib/format'
import { aoLar } from '@/features/family/shared/estado'
import { CamposCaso, focarCampo } from '../form/CamposCaso'
import { casoInput, casoVazio, mesmoCaso, ORDEM_CAMPOS, validarCaso, type CasoForm, type ErrosCaso } from '../form/casoModel'
import { useContagem } from '../form/useContagem'

/** Novo caso (/casos/novo[?lar=<id>]): o perfil de cuidados, a alta prevista e o consentimento. */
export default function NovoCasoPage() {
  useDocumentTitle('Novo caso')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const larId = params.get('lar') ?? undefined
  const lar = useLar(larId)
  const lares = useLares()
  const [inicial] = useState<CasoForm>(() => casoVazio(lar))
  const [form, setForm] = useState<CasoForm>(inicial)
  const [erros, setErros] = useState<ErrosCaso>({})
  const [criado, setCriado] = useState<string | null>(null)
  const contagem = useContagem(form, lares)
  const sujo = !mesmoCaso(form, inicial) && !criado
  useAvisoAlteracoes(sujo)

  // navega só depois de o aviso de alterações por guardar já saber que o caso foi criado
  useEffect(() => {
    if (criado) navigate(`/casos/${encodeURIComponent(criado)}${lar ? `?lar=${encodeURIComponent(lar.id)}` : ''}`)
  }, [criado, lar, navigate])

  const set = <K extends keyof CasoForm>(k: K, v: CasoForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k in erros) setErros((e) => ({ ...e, [k]: undefined }))
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = validarCaso(form, { novo: true })
    setErros(v)
    const campo = ORDEM_CAMPOS.find((c) => v[c])
    if (campo) {
      toast.error('Falta completar o caso', v[campo])
      focarCampo(campo)
      return
    }
    const caso = criarCaso(casoInput(form))
    if (!caso) {
      toast.error('Não foi possível criar o caso', 'Confirme que tem sessão iniciada com a conta de profissional.')
      return
    }
    toast.success('Caso criado', lar ? `${lar.nome} já está na lista de envio. Junte outras instituições, se quiser.` : 'Escolha agora as instituições a quem o enviar.')
    setCriado(caso.id)
  }

  return (
    <form onSubmit={submit} noValidate aria-label="Novo caso" className="max-w-3xl">
      {lar && (
        <p className="mb-12 flex items-start gap-3 rounded-[1.25rem] bg-sand p-5 text-ink-soft">
          <Building2 aria-hidden className="mt-0.5 size-5 shrink-0 text-ink" />
          <span>
            Depois de criar o caso, pode enviá-lo {aoLar(lar.nome).split(' ')[0]} <strong className="font-semibold text-ink">{lar.nome}</strong> e a outras
            instituições compatíveis, de uma só vez.
          </span>
        </p>
      )}

      <CamposCaso form={form} set={set} erros={erros} lares={lares} novo />

      {/* barra de ação ao alcance do polegar (por cima da barra de abas); data-match-barra: a lista de localidades não fica por baixo dela */}
      <div
        data-match-barra
        className="sticky bottom-[calc(var(--tabbar-h)+0.75rem)] z-20 mt-12 rounded-[1.5rem] bg-white/95 p-3 shadow-lift ring-1 ring-black/[0.06] backdrop-blur-xl backdrop-saturate-150 sm:rounded-full sm:py-3 sm:pr-3 sm:pl-7"
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="min-w-0 px-2 text-sm leading-snug text-ink-mute sm:px-0" aria-live="polite">
            {contagem ? (
              <>
                <span className="font-semibold text-ink">{plural(contagem.compativeis, 'compatível', 'compatíveis')}</span> no raio ·{' '}
                <span className="whitespace-nowrap">
                  <span className="font-semibold text-ink">{contagem.comVaga}</span> com vaga agora
                </span>
              </>
            ) : (
              'Escolha a localidade para ver quantas instituições servem.'
            )}
          </p>
          <Button type="submit" className="w-full sm:w-auto">
            Criar caso
          </Button>
        </div>
      </div>
    </form>
  )
}
