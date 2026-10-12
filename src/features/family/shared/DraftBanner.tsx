import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { savePerfil, usePerfis } from '@/lib/store'
import { GRAU_LABEL } from '@/lib/labels'
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
      setErro('Indique o nome para guardarmos o perfil.')
      return
    }
    const p = savePerfil({ ...draft, nome: nome.trim(), id: existente?.id })
    apagarRascunho()
    setDraft(null)
    if (p) {
      toast.success(existente ? 'Perfil atualizado' : 'Perfil guardado', 'As sugestões e os avisos de vaga já usam estes dados.')
      navigate(`/familia/perfil?id=${p.id}`)
    }
  }
  const descartar = () => {
    apagarRascunho()
    setDraft(null)
    toast.info('Respostas do questionário descartadas')
  }

  const resumo = [
    `${draft.relacao}, ${draft.idade} anos`,
    GRAU_LABEL[draft.grau],
    `${draft.local.label}, até ${draft.raioKm} km`,
    `até ${euro(draft.orcamentoMax)}/mês`,
  ].join(' · ')

  return (
    <section aria-labelledby="rascunho-perfil" className="tile mb-14 animate-fade-up">
      <p className="eyebrow">Do questionário “Ajuda-me a escolher”</p>
      <h2 id="rascunho-perfil" className="mt-2 text-3xl font-semibold">
        Guardar o perfil do questionário?
      </h2>
      <p className="mt-3 max-w-2xl text-lg text-ink-mute">{resumo}</p>
      {existente && <p className="mt-2 text-ink-soft">Já tem um perfil de {existente.nome}: vamos atualizá-lo.</p>}
      {pedirNome && (
        <InputField
          label="Como se chama a pessoa de quem cuida?"
          hint="Basta o primeiro nome."
          value={nome}
          onChange={(e) => {
            setNome(e.target.value)
            setErro(null)
          }}
          error={erro ?? undefined}
          autoComplete="off"
          wrapperClassName="mt-6 max-w-md"
        />
      )}
      <div className="mt-7 flex flex-wrap gap-3">
        <Button onClick={guardar}>{existente ? 'Atualizar perfil' : 'Guardar perfil'}</Button>
        <Button variant="ghost" onClick={descartar}>
          Descartar
        </Button>
      </div>
    </section>
  )
}
