import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { RotateCcw, Save, Trash2, TriangleAlert } from 'lucide-react'
import type { Cuidado, PerfilIdoso, TipoQuarto, Urgencia } from '@/types'
import { deletePerfil, savePerfil, useMinhasCandidaturas, type PerfilInput } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { ChoiceCard, InputField, SelectField, Switch, TextareaField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { COMODIDADE_ICON, CUIDADO_ICON } from '@/components/lar/icons'
import { DISTRITOS, LUGARES } from '@/data/localidades'
import {
  COMODIDADE_LABEL,
  COMODIDADES_ORDEM,
  CUIDADO_LABEL,
  CUIDADOS_CRITICOS,
  CUIDADOS_ORDEM,
  GRAU_DESCRICAO,
  GRAU_LABEL,
  GRAUS_ORDEM,
  QUARTO_CURTO,
  RELACOES,
  URGENCIA_LABEL,
} from '@/lib/labels'
import { euro } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useLarIndex } from '../shared/data'
import { ConfirmModal } from '../shared/ui'
import { Chip, Grupo, Seccao } from './controls'
import { mesmoPerfil, ORCAMENTO_MAX, ORCAMENTO_MIN, perfilParaInput, perfilVazio, RAIOS_KM, validarPerfil, type ErrosPerfil } from './perfilModel'
import { PerfilPreview, PrivacidadePerfil } from './PerfilPreview'

const LUGARES_POR_DISTRITO = DISTRITOS.map((d) => ({ d, lugares: LUGARES.filter((l) => l.distrito === d) })).filter((g) => g.lugares.length)
const QUARTOS: (TipoQuarto | 'indiferente')[] = ['indiferente', 'individual', 'duplo', 'casal']

export function PerfilForm({
  perfil,
  base,
  onSaved,
  onDeleted,
  onDirtyChange,
}: {
  perfil: PerfilIdoso | undefined
  /** perfil de referência para a zona de um perfil novo */
  base?: PerfilIdoso
  onSaved: (p: PerfilIdoso) => void
  onDeleted: () => void
  onDirtyChange: (dirty: boolean) => void
}) {
  const inicial = useMemo(() => (perfil ? perfilParaInput(perfil) : perfilVazio(base)), [perfil, base])
  const [form, setForm] = useState<PerfilInput>(inicial)
  const [erros, setErros] = useState<ErrosPerfil>({})
  const [apagar, setApagar] = useState(false)
  const cands = useMinhasCandidaturas()
  const idx = useLarIndex()
  const dirty = !mesmoPerfil(form, inicial)

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  // avisar antes de fechar o separador com alterações por guardar
  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const set = <K extends keyof PerfilInput>(k: K, v: PerfilInput[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (k in erros) setErros((e) => ({ ...e, [k]: undefined }))
  }
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v))

  const partilhas = perfil
    ? cands.filter((c) => c.perfilId === perfil.id).map((c) => ({ c, nome: idx.get(c.larId)?.nome ?? 'Instituição' }))
    : []
  const lugarConhecido = LUGARES.some((l) => l.label === form.local.label)
  const raios = RAIOS_KM.includes(form.raioKm as (typeof RAIOS_KM)[number]) ? [...RAIOS_KM] : [...RAIOS_KM, form.raioKm].sort((a, b) => a - b)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = validarPerfil(form)
    setErros(v)
    if (Object.keys(v).length) {
      toast.error('Falta completar o perfil', Object.values(v)[0])
      const campo = Object.keys(v)[0]
      document.querySelector<HTMLElement>(`[data-campo="${campo}"] input`)?.focus()
      return
    }
    const p = savePerfil({ ...form, nome: form.nome.trim(), notas: form.notas?.trim() || undefined })
    if (!p) return
    toast.success(perfil ? 'Perfil atualizado' : 'Perfil criado', 'As sugestões e a compatibilidade já usam estes dados.')
    onSaved(p)
  }

  const confirmarApagar = () => {
    if (!perfil) return
    deletePerfil(perfil.id)
    setApagar(false)
    toast.info('Perfil apagado', `Os dados de ${perfil.nome} foram apagados desta conta.`)
    onDeleted()
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <form onSubmit={submit} noValidate aria-labelledby="perfil-form-titulo" className="min-w-0 rounded-[1.75rem] border border-line bg-white shadow-card">
        <div className="border-b border-line px-5 pt-6 pb-5 sm:px-8">
          <h2 id="perfil-form-titulo" className="font-display text-2xl font-semibold">
            {perfil ? `Perfil de ${perfil.nome}` : 'Novo perfil de cuidados'}
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Tudo o que indicar aqui serve para calcular a compatibilidade e é enviado apenas às instituições a quem pedir vaga.
          </p>
        </div>

        <div className="flex flex-col gap-9 px-5 py-7 sm:px-8">
          <Seccao n={1} titulo="Quem é">
            <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
              <div data-campo="nome">
                <InputField label="Nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} error={erros.nome} autoComplete="off" />
              </div>
              <div data-campo="idade">
                <InputField
                  label="Idade"
                  type="number"
                  inputMode="numeric"
                  min={40}
                  max={120}
                  value={Number.isFinite(form.idade) ? form.idade : ''}
                  onChange={(e) => set('idade', e.target.value === '' ? Number.NaN : Number(e.target.value))}
                  error={erros.idade}
                />
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField label="Relação consigo" value={form.relacao} onChange={(e) => set('relacao', e.target.value)}>
                {!RELACOES.includes(form.relacao as (typeof RELACOES)[number]) && <option value={form.relacao}>{form.relacao}</option>}
                {RELACOES.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </SelectField>
              <Grupo label="Género" hint="Ajuda a propor quarto partilhado.">
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['F', 'Feminino'],
                    ['M', 'Masculino'],
                    ['', 'Não indicar'],
                  ] as const).map(([v, l]) => (
                    <Chip key={l} type="radio" name="genero" checked={(form.genero ?? '') === v} onChange={() => set('genero', v || undefined)} className="px-3 text-sm">
                      {l}
                    </Chip>
                  ))}
                </div>
              </Grupo>
            </div>
          </Seccao>

          <Seccao n={2} titulo="Autonomia" texto="O grau de dependência decide que instituições podem acolher — é um critério eliminatório.">
            <div className="grid gap-3 sm:grid-cols-2">
              {GRAUS_ORDEM.map((g) => (
                <ChoiceCard key={g} name="grau" checked={form.grau === g} onChange={() => set('grau', g)} label={GRAU_LABEL[g]} description={GRAU_DESCRICAO[g]} />
              ))}
            </div>
          </Seccao>

          <Seccao
            n={3}
            titulo="Cuidados de saúde"
            texto="Os marcados como essenciais excluem as instituições que não os asseguram. Os outros contam para a compatibilidade."
          >
            <div className="grid gap-2 sm:grid-cols-2">
              {CUIDADOS_ORDEM.map((c: Cuidado) => {
                const Icon = CUIDADO_ICON[c]
                return (
                  <Chip
                    key={c}
                    checked={form.necessidades.includes(c)}
                    onChange={(on) => set('necessidades', toggle(form.necessidades, c, on))}
                    icon={<Icon aria-hidden />}
                    tag={
                      CUIDADOS_CRITICOS.includes(c) ? (
                        <span className="rounded-full bg-terra-50 px-2 text-xs font-bold text-terra-800 ring-1 ring-terra-200">essencial</span>
                      ) : undefined
                    }
                  >
                    {CUIDADO_LABEL[c]}
                  </Chip>
                )
              })}
            </div>
          </Seccao>

          <Seccao n={4} titulo="Conforto e quarto" texto="Preferências que pesam na compatibilidade, sem excluir instituições.">
            <Grupo label="Tipo de quarto">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {QUARTOS.map((q) => (
                  <Chip key={q} type="radio" name="quarto" checked={form.quarto === q} onChange={() => set('quarto', q)} className="text-sm">
                    {q === 'indiferente' ? 'Indiferente' : q === 'duplo' ? 'Duplo, partilhado' : QUARTO_CURTO[q]}
                  </Chip>
                ))}
              </div>
            </Grupo>
            <Grupo label="O que gostaria que tivesse">
              <div className="grid gap-2 sm:grid-cols-2">
                {COMODIDADES_ORDEM.map((c) => {
                  const Icon = COMODIDADE_ICON[c]
                  return (
                    <Chip key={c} checked={form.preferencias.includes(c)} onChange={(on) => set('preferencias', toggle(form.preferencias, c, on))} icon={<Icon aria-hidden />}>
                      {COMODIDADE_LABEL[c]}
                    </Chip>
                  )
                })}
              </div>
            </Grupo>
          </Seccao>

          <Seccao n={5} titulo="Onde e quanto">
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Perto de onde?"
                hint="Normalmente, perto de quem visita mais vezes."
                value={form.local.label}
                onChange={(e) => {
                  const l = LUGARES.find((x) => x.label === e.target.value)
                  if (l) set('local', { label: l.label, lat: l.lat, lng: l.lng })
                }}
              >
                {!lugarConhecido && <option value={form.local.label}>{form.local.label}</option>}
                {LUGARES_POR_DISTRITO.map((g) => (
                  <optgroup key={g.d} label={g.d}>
                    {g.lugares.map((l) => (
                      <option key={l.label} value={l.label}>
                        {l.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </SelectField>
              <Grupo label="Distância máxima" hint="Raio a partir desse local.">
                <div className="flex flex-wrap gap-2">
                  {raios.map((r) => (
                    <Chip key={r} type="radio" name="raio" checked={form.raioKm === r} onChange={() => set('raioKm', r)} className="min-w-20 px-3 text-sm">
                      {r} km
                    </Chip>
                  ))}
                </div>
              </Grupo>
            </div>

            <div data-campo="orcamentoMax" className="rounded-2xl bg-sand/60 p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <label htmlFor="perfil-orcamento" className="text-base font-bold">
                  Orçamento mensal máximo
                </label>
                <p className="font-display text-3xl font-semibold text-pine-800 tabular" aria-hidden>
                  {euro(form.orcamentoMax)}
                </p>
              </div>
              <input
                id="perfil-orcamento"
                type="range"
                min={ORCAMENTO_MIN}
                max={ORCAMENTO_MAX}
                step={50}
                value={Math.min(ORCAMENTO_MAX, Math.max(ORCAMENTO_MIN, form.orcamentoMax))}
                onChange={(e) => set('orcamentoMax', Number(e.target.value))}
                aria-valuetext={`${form.orcamentoMax} euros por mês`}
                className="mt-3 h-12 w-full cursor-pointer accent-pine-700"
              />
              <div aria-hidden className="flex justify-between text-xs text-ink-mute">
                <span>{euro(ORCAMENTO_MIN)}</span>
                <span>{euro(ORCAMENTO_MAX)}+</span>
              </div>
              {erros.orcamentoMax && (
                <p role="alert" className="mt-2 flex items-center gap-2 text-sm font-bold text-alert-700">
                  <TriangleAlert aria-hidden className="size-4" />
                  {erros.orcamentoMax}
                </p>
              )}
              <Switch
                className="mt-4 border-t border-dashed border-line-strong pt-3"
                checked={form.precisaAcordoSS}
                onChange={(v) => set('precisaAcordoSS', v)}
                label="Precisa de vaga comparticipada"
                description="Só instituições com acordo com a Segurança Social (a mensalidade depende dos rendimentos)."
              />
            </div>

            <Grupo label="Para quando?">
              <div className="grid gap-2 sm:grid-cols-2">
                {(Object.keys(URGENCIA_LABEL) as Urgencia[]).map((u) => (
                  <Chip key={u} type="radio" name="urgencia" checked={form.urgencia === u} onChange={() => set('urgencia', u)}>
                    {URGENCIA_LABEL[u]}
                  </Chip>
                ))}
              </div>
            </Grupo>
          </Seccao>

          <Seccao n={6} titulo="Notas para a instituição">
            <TextareaField
              label="O que a equipa deve saber"
              optional
              hint="Diagnósticos, medicação, rotinas, do que gosta. As instituições a quem pedir vaga leem estas notas."
              value={form.notas ?? ''}
              onChange={(e) => set('notas', e.target.value)}
              rows={5}
            />
          </Seccao>

          {perfil && (
            <div className="border-t border-line pt-6">
              <Button variant="danger" icon={<Trash2 aria-hidden className="size-5" />} onClick={() => setApagar(true)}>
                Apagar este perfil
              </Button>
            </div>
          )}
        </div>

        {/* barra de gravação */}
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-3 rounded-b-[1.75rem] border-t border-line bg-white/95 px-5 py-4 backdrop-blur sm:px-8">
          <p className={cn('flex items-center gap-2 text-sm font-semibold', dirty ? 'text-terra-800' : 'text-ink-soft')} aria-live="polite">
            <span aria-hidden className={cn('size-2.5 rounded-full', dirty ? 'bg-terra-500' : 'bg-leaf-500')} />
            {dirty ? 'Alterações por guardar' : perfil ? 'Tudo guardado' : 'Preencha e guarde'}
          </p>
          <div className="flex flex-wrap gap-2">
            {dirty && perfil && (
              <Button
                variant="ghost"
                icon={<RotateCcw aria-hidden className="size-5" />}
                onClick={() => {
                  setForm(inicial)
                  setErros({})
                }}
              >
                Repor
              </Button>
            )}
            <Button type="submit" disabled={!dirty && Boolean(perfil)} icon={<Save aria-hidden className="size-5" />}>
              {perfil ? 'Guardar alterações' : 'Criar perfil'}
            </Button>
          </div>
        </div>
      </form>

      <div className="flex min-w-0 flex-col gap-6 xl:sticky xl:top-24 xl:self-start">
        <PerfilPreview form={form} />
        <PrivacidadePerfil partilhas={partilhas} />
      </div>

      <ConfirmModal
        open={apagar}
        onClose={() => setApagar(false)}
        onConfirm={confirmarApagar}
        title="Apagar este perfil?"
        description={perfil?.nome}
        confirmLabel="Sim, apagar perfil"
        cancelLabel="Manter perfil"
        confirmVariant="danger"
        confirmIcon={<Trash2 aria-hidden className="size-5" />}
      >
        <p>Os dados de saúde e as preferências deste perfil são apagados da sua conta. Não é possível desfazer.</p>
        {partilhas.some((p) => p.c.estado !== 'cancelada') && (
          <p className="mt-3 rounded-2xl bg-sun-50 p-4 text-sm text-sun-800">
            Os pedidos já enviados não são cancelados: as instituições mantêm a cópia recebida com o pedido. Para os cancelar, vá a
            “Pedidos”.
          </p>
        )}
      </ConfirmModal>
    </div>
  )
}
