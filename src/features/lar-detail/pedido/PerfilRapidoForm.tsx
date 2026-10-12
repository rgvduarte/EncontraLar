import { useEffect, useState, type FormEvent } from 'react'
import { Euro } from 'lucide-react'
import type { Cuidado, GrauDependencia, Lar, PerfilIdoso, TipoQuarto, Urgencia } from '@/types'
import { Checkbox, ChoiceCard, InputField, SelectField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { savePerfil } from '@/lib/store'
import { LUGARES } from '@/data/localidades'
import { CUIDADOS_ORDEM, CUIDADO_LABEL, GRAUS_ORDEM, GRAU_DESCRICAO, GRAU_LABEL, QUARTO_LABEL, RELACOES, URGENCIA_LABEL } from '@/lib/labels'
import { generoDaRelacao } from '../helpers'

/** Cuidados mais determinantes para a escolha (o perfil completo edita-se no painel). */
const NECESSIDADES: Cuidado[] = CUIDADOS_ORDEM.slice(0, 8)

function lugarInicial(lar: Lar) {
  return (
    LUGARES.find((l) => l.label === lar.concelho) ??
    LUGARES.find((l) => l.label === lar.localidade) ??
    LUGARES.find((l) => l.distrito === lar.distrito) ??
    null
  )
}

interface Erros {
  nome?: string
  idade?: string
  grau?: string
  orcamento?: string
}

/** Perfil rápido da pessoa idosa, para quem ainda não tem nenhum. */
export function PerfilRapidoForm({ lar, formId, onGuardado }: { lar: Lar; formId: string; onGuardado: (p: PerfilIdoso) => void }) {
  const inicial = lugarInicial(lar)
  const [nome, setNome] = useState('')
  const [idade, setIdade] = useState('')
  const [relacao, setRelacao] = useState<string>('Mãe')
  const [grau, setGrau] = useState<GrauDependencia | ''>('')
  const [necessidades, setNecessidades] = useState<Cuidado[]>([])
  const [quarto, setQuarto] = useState<TipoQuarto | 'indiferente'>('indiferente')
  const [orcamento, setOrcamento] = useState(() => String(Math.max(800, Math.round((lar.mensalidadeMin || 1200) / 100) * 100)))
  const [urgencia, setUrgencia] = useState<Urgencia>('1-3meses')
  const [lugar, setLugar] = useState(inicial?.label ?? '')
  const [ss, setSS] = useState(false)
  const [erros, setErros] = useState<Erros>({})
  const [tentativa, setTentativa] = useState(0)

  // depois de mostrar os erros, leva o foco ao primeiro campo por corrigir
  useEffect(() => {
    if (!tentativa) return
    const form = document.getElementById(formId)
    form?.querySelector<HTMLElement>('[aria-invalid="true"], fieldset[data-erro="true"] input')?.focus()
  }, [tentativa, formId])

  const submeter = (e: FormEvent) => {
    e.preventDefault()
    const idadeN = Number(idade)
    const orcN = Number(orcamento)
    const novos: Erros = {}
    if (!nome.trim()) novos.nome = 'Indique o nome da pessoa.'
    if (!idade || !Number.isFinite(idadeN) || idadeN < 50 || idadeN > 115) novos.idade = 'Indique uma idade entre 50 e 115 anos.'
    if (!grau) novos.grau = 'Escolha a opção que melhor descreve o dia a dia.'
    if (!Number.isFinite(orcN) || orcN < 200) novos.orcamento = 'Indique um valor mensal em euros (por exemplo, 1500).'
    setErros(novos)
    if (Object.keys(novos).length) {
      setTentativa((t) => t + 1)
      return
    }
    const l = LUGARES.find((x) => x.label === lugar) ?? inicial
    const perfil = savePerfil({
      nome: nome.trim(),
      idade: Math.round(idadeN),
      relacao,
      genero: generoDaRelacao(relacao),
      grau: grau as GrauDependencia,
      necessidades,
      preferencias: [],
      quarto,
      local: l ? { label: l.label, lat: l.lat, lng: l.lng } : { label: lar.localidade, lat: lar.lat, lng: lar.lng },
      raioKm: l?.raio ?? 15,
      orcamentoMax: Math.round(orcN),
      urgencia,
      precisaAcordoSS: ss,
    })
    if (!perfil) {
      toast.error('Não foi possível guardar o perfil', 'A sessão pode ter terminado. Entre de novo e tente outra vez.')
      return
    }
    toast.success('Perfil guardado', `Pode editá-lo quando quiser no seu painel.`)
    onGuardado(perfil)
  }

  return (
    <form id={formId} onSubmit={submeter} noValidate className="flex flex-col gap-6">
      <p className="text-ink-soft">
        Para a instituição avaliar o pedido, precisamos de saber um pouco sobre a pessoa. Fica guardado para outros pedidos — e pode completá-lo mais tarde.
      </p>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <InputField label="Nome da pessoa" autoComplete="off" value={nome} onChange={(e) => setNome(e.target.value)} error={erros.nome} />
        <InputField label="Idade" type="number" inputMode="numeric" min={50} max={115} value={idade} onChange={(e) => setIdade(e.target.value)} error={erros.idade} />
      </div>
      <SelectField label="Quem é para si?" value={relacao} onChange={(e) => setRelacao(e.target.value)}>
        {RELACOES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </SelectField>

      <fieldset data-erro={Boolean(erros.grau)} aria-describedby={erros.grau ? `${formId}-grau-erro` : undefined}>
        <legend className="text-base font-bold text-ink">Como é o dia a dia?</legend>
        <p className="mt-1 text-sm text-ink-soft">Escolha o grau de dependência mais próximo.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {GRAUS_ORDEM.map((g) => (
            <ChoiceCard
              key={g}
              name={`${formId}-grau`}
              value={g}
              checked={grau === g}
              onChange={() => setGrau(g)}
              label={GRAU_LABEL[g]}
              description={GRAU_DESCRICAO[g]}
            />
          ))}
        </div>
        {erros.grau && (
          <p id={`${formId}-grau-erro`} role="alert" className="mt-2 text-sm font-bold text-alert-700">
            {erros.grau}
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-base font-bold text-ink">Precisa de algum destes cuidados?</legend>
        <p className="mt-1 text-sm text-ink-soft">Assinale os que se aplicam. Se nenhum se aplicar, avance.</p>
        <div className="mt-2 grid gap-x-6 sm:grid-cols-2">
          {NECESSIDADES.map((c) => (
            <Checkbox
              key={c}
              label={CUIDADO_LABEL[c]}
              checked={necessidades.includes(c)}
              onChange={(e) => setNecessidades((n) => (e.target.checked ? [...n, c] : n.filter((x) => x !== c)))}
            />
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Quarto preferido" value={quarto} onChange={(e) => setQuarto(e.target.value as TipoQuarto | 'indiferente')}>
          <option value="indiferente">Indiferente</option>
          {(['individual', 'duplo', 'casal'] as TipoQuarto[]).map((q) => (
            <option key={q} value={q}>
              {QUARTO_LABEL[q]}
            </option>
          ))}
        </SelectField>
        <InputField
          label="Orçamento mensal máximo"
          type="number"
          inputMode="numeric"
          min={200}
          step={50}
          value={orcamento}
          onChange={(e) => setOrcamento(e.target.value)}
          error={erros.orcamento}
          leading={<Euro aria-hidden />}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Para quando?" value={urgencia} onChange={(e) => setUrgencia(e.target.value as Urgencia)}>
          {(Object.keys(URGENCIA_LABEL) as Urgencia[]).map((u) => (
            <option key={u} value={u}>
              {URGENCIA_LABEL[u]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Zona onde procura" value={lugar} onChange={(e) => setLugar(e.target.value)}>
          {!inicial && <option value="">{lar.localidade}</option>}
          {LUGARES.map((l) => (
            <option key={l.label} value={l.label}>
              {l.label}
            </option>
          ))}
        </SelectField>
      </div>
      <Checkbox
        label="Precisa de vaga comparticipada pela Segurança Social"
        description="Assinale se a mensalidade tiver de depender dos rendimentos."
        checked={ss}
        onChange={(e) => setSS(e.target.checked)}
      />
    </form>
  )
}
