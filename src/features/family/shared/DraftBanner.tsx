import { useState } from 'react'
import { useNavigate } from 'react-router'
import { ClipboardList, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { savePerfil, usePerfis } from '@/lib/store'
import { CUIDADO_LABEL, GRAU_LABEL, QUARTO_CURTO, URGENCIA_LABEL } from '@/lib/labels'
import { euro } from '@/lib/format'
import { apagarRascunho, lerRascunho } from '../perfil/perfilModel'

/**
 * Oferece-se para guardar o perfil preenchido no questionário "Ajuda-me a escolher"
 * (sessionStorage['encontralar:perfil-rascunho']). Se já existir um perfil com o mesmo nome, atualiza-o.
 */
export function DraftBanner() {
  const [draft, setDraft] = useState(lerRascunho)
  const [nome, setNome] = useState(() => draft?.nome ?? '')
  const [erro, setErro] = useState<string | null>(null)
  const perfis = usePerfis()
  const navigate = useNavigate()
  if (!draft) return null

  const existente = nome.trim() ? perfis.find((p) => p.nome.trim().toLowerCase() === nome.trim().toLowerCase()) : undefined
  const pedirNome = !draft.nome

  const guardar = () => {
    if (!nome.trim()) {
      setErro('Indique o nome para podermos guardar o perfil.')
      return
    }
    const p = savePerfil({ ...draft, nome: nome.trim(), id: existente?.id })
    apagarRascunho()
    setDraft(null)
    if (p) {
      toast.success(existente ? 'Perfil atualizado' : 'Perfil guardado', `As sugestões e os alertas passam a usar o perfil de ${p.nome}.`)
      navigate(`/familia/perfil?id=${p.id}`)
    }
  }
  const descartar = () => {
    apagarRascunho()
    setDraft(null)
    toast.info('Respostas do questionário descartadas')
  }

  const linhas: [string, string][] = [
    ['Autonomia', GRAU_LABEL[draft.grau]],
    ['Cuidados', draft.necessidades.length ? draft.necessidades.map((n) => CUIDADO_LABEL[n]).join(', ') : 'Sem cuidados específicos'],
    ['Zona', `${draft.local.label}, até ${draft.raioKm} km`],
    ['Orçamento', `até ${euro(draft.orcamentoMax)}/mês${draft.precisaAcordoSS ? ' · acordo SS' : ''}`],
    ['Quarto', draft.quarto === 'indiferente' ? 'Indiferente' : QUARTO_CURTO[draft.quarto]],
    ['Quando', URGENCIA_LABEL[draft.urgencia]],
  ]

  return (
    <section aria-labelledby="rascunho-perfil" className="relative mb-8 animate-fade-up overflow-hidden rounded-[2rem] border-2 border-pine-200 bg-pine-50 p-6 sm:p-8">
      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div>
          <p className="eyebrow flex items-center gap-2">
            <ClipboardList aria-hidden className="size-4" />
            Do questionário “Ajuda-me a escolher”
          </p>
          <h2 id="rascunho-perfil" className="mt-2 font-display text-3xl font-semibold">
            Guardar o perfil que preencheu <em>no questionário</em>?
          </h2>
          <p className="mt-3 max-w-xl text-ink-soft">
            Assim não precisa de repetir as respostas: as sugestões, os alertas de vaga e os pedidos passam a usar estes dados.
            {existente && <strong className="text-ink"> Já tem um perfil de {existente.nome} — vamos atualizá-lo.</strong>}
          </p>
          {pedirNome && (
            <InputField
              label="Como se chama a pessoa de quem cuida?"
              hint="Basta o primeiro nome. Aparece apenas para si e para as instituições a quem pedir vaga."
              value={nome}
              onChange={(e) => {
                setNome(e.target.value)
                setErro(null)
              }}
              error={erro ?? undefined}
              autoComplete="off"
              wrapperClassName="mt-5 max-w-md"
            />
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={guardar} icon={<Save aria-hidden className="size-5" />}>
              {existente ? 'Atualizar perfil' : 'Guardar perfil'}
            </Button>
            <Button variant="ghost" onClick={descartar} icon={<X aria-hidden className="size-5" />}>
              Descartar respostas
            </Button>
          </div>
        </div>

        <div aria-label="Pré-visualização do perfil" role="group" className="rotate-[-1.2deg] rounded-2xl border border-line bg-white p-5 shadow-card">
          <div className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
            <p className="font-display text-xl font-semibold">{nome.trim() || 'Sem nome'}</p>
            <p className="text-sm text-ink-soft">
              {draft.relacao} · {draft.idade} anos
            </p>
          </div>
          <dl className="text-sm">
            {linhas.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[6.5rem_1fr] gap-3 border-b border-dashed border-line py-2 last:border-b-0">
                <dt className="font-bold text-ink-soft">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
