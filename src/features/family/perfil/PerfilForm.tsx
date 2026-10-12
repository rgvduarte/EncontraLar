import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { PerfilIdoso, TipoQuarto, Urgencia } from '@/types'
import { deletePerfil, savePerfil, useLares, type PerfilInput } from '@/lib/store'
import { Button } from '@/components/ui/Button'
import { ChoiceCard, InputField, SelectField, Switch, TextareaField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
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
import { recomendar } from '@/lib/matching'
import { useDebounced } from '@/lib/hooks'
import { euro } from '@/lib/format'
import { cn } from '@/lib/cn'
import { pesquisaUrl } from '../shared/data'
import { ConfirmModal, MoreLink } from '../shared/ui'
import { Tween, useChangeAnimation } from '../shared/motion'
import { FormSection, Pill, PillGroup } from './controls'
import { mesmoPerfil, ORCAMENTO_MAX, ORCAMENTO_MIN, perfilParaInput, perfilVazio, RAIOS_KM, validarPerfil, type ErrosPerfil } from './perfilModel'

const LUGARES_POR_DISTRITO = DISTRITOS.map((d) => ({ d, lugares: LUGARES.filter((l) => l.distrito === d) })).filter((x) => x.lugares.length)
const QUARTOS: (TipoQuarto | 'indiferente')[] = ['indiferente', 'individual', 'duplo', 'casal']
// só a 1.ª letra em minúscula: os nomes ficam iguais às pílulas ("demência e Alzheimer")
const ESSENCIAIS = CUIDADOS_CRITICOS.map((c) => CUIDADO_LABEL[c].charAt(0).toLowerCase() + CUIDADO_LABEL[c].slice(1))
const essenciaisTxt = `${ESSENCIAIS.slice(0, -1).join(', ')} e ${ESSENCIAIS[ESSENCIAIS.length - 1]}`

/** Quantas instituições servem estes critérios — feedback imediato enquanto edita. */
function useContagem(form: PerfilInput) {
  const lares = useLares()
  const f = useDebounced(form, 300)
  return useMemo(() => {
    const dentro = recomendar(lares, f, 500).filter((m) => m.compativel && m.distanciaKm <= f.raioKm)
    // "com vaga" = lugar livre para quem pede hoje (um lugar livre que a lista de espera vai ocupar não conta)
    return { compativeis: dentro.length, comVaga: dentro.filter((m) => m.espera.imediata).length, f }
  }, [lares, f])
}

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
  const dirty = !mesmoPerfil(form, inicial)
  const contagem = useContagem(form)
  // a barra de gravação fica fixa (por cima da barra de abas) quando há algo por guardar — e sobe ao aparecer
  const fixa = dirty || !perfil
  const barra = useRef<HTMLDivElement>(null)
  useChangeAnimation(
    barra,
    fixa,
    fixa
      ? [
          { opacity: 0, transform: 'translateY(calc(100% + 1.5rem))' },
          { opacity: 1, transform: 'none' },
        ]
      : [{ opacity: 0 }, { opacity: 1 }],
    { duration: 550 },
  )

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])
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
  const lugarConhecido = LUGARES.some((l) => l.label === form.local.label)
  const raios = RAIOS_KM.includes(form.raioKm as (typeof RAIOS_KM)[number]) ? [...RAIOS_KM] : [...RAIOS_KM, form.raioKm].sort((a, b) => a - b)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const v = validarPerfil(form)
    setErros(v)
    const campo = Object.keys(v)[0]
    if (campo) {
      toast.error('Falta completar o perfil', Object.values(v)[0])
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
    setApagar(false)
    deletePerfil(perfil.id)
    toast.info('Perfil apagado', `Os dados de ${perfil.nome} foram apagados.`)
    onDeleted()
  }

  return (
    <form onSubmit={submit} noValidate aria-label={perfil ? `Perfil de ${perfil.nome}` : 'Novo perfil de cuidados'} className="max-w-3xl">
      <div className="flex flex-col gap-14">
        <FormSection title="Quem é">
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
          <SelectField label="Relação consigo" value={form.relacao} onChange={(e) => set('relacao', e.target.value)} wrapperClassName="sm:max-w-xs">
            {!RELACOES.includes(form.relacao as (typeof RELACOES)[number]) && <option value={form.relacao}>{form.relacao}</option>}
            {RELACOES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </SelectField>
          <PillGroup label="Género" hint="Ajuda a propor quarto partilhado." radio>
            {(
              [
                ['F', 'Feminino'],
                ['M', 'Masculino'],
                ['', 'Prefiro não indicar'],
              ] as const
            ).map(([v, l]) => (
              <Pill key={l} type="radio" name="genero" checked={(form.genero ?? '') === v} onChange={() => set('genero', v || undefined)}>
                {l}
              </Pill>
            ))}
          </PillGroup>
        </FormSection>

        <FormSection title="Autonomia" hint="Decide que instituições podem acolher.">
          <div role="radiogroup" aria-label="Grau de autonomia" className="grid gap-3 sm:grid-cols-2">
            {GRAUS_ORDEM.map((g) => (
              <ChoiceCard key={g} name="grau" checked={form.grau === g} onChange={() => set('grau', g)} label={GRAU_LABEL[g]} description={GRAU_DESCRICAO[g]} />
            ))}
          </div>
        </FormSection>

        <FormSection title="Cuidados de saúde" hint={`Os essenciais (${essenciaisTxt}) excluem quem não os assegura.`}>
          <PillGroup label="De que cuidados precisa?">
            {CUIDADOS_ORDEM.map((c) => (
              <Pill key={c} checked={form.necessidades.includes(c)} onChange={(on) => set('necessidades', toggle(form.necessidades, c, on))}>
                {CUIDADO_LABEL[c]}
              </Pill>
            ))}
          </PillGroup>
        </FormSection>

        <FormSection title="Preferências" hint="Contam para a compatibilidade, sem excluir ninguém.">
          <PillGroup label="Quarto" radio>
            {QUARTOS.map((q) => (
              <Pill key={q} type="radio" name="quarto" checked={form.quarto === q} onChange={() => set('quarto', q)}>
                {q === 'indiferente' ? 'Indiferente' : q === 'duplo' ? 'Duplo, partilhado' : QUARTO_CURTO[q]}
              </Pill>
            ))}
          </PillGroup>
          <PillGroup label="O que gostaria que tivesse">
            {COMODIDADES_ORDEM.map((c) => (
              <Pill key={c} checked={form.preferencias.includes(c)} onChange={(on) => set('preferencias', toggle(form.preferencias, c, on))}>
                {COMODIDADE_LABEL[c]}
              </Pill>
            ))}
          </PillGroup>
        </FormSection>

        <FormSection title="Onde e quanto">
          <SelectField
            label="Perto de onde?"
            hint="Normalmente, perto de quem visita mais vezes."
            value={form.local.label}
            onChange={(e) => {
              const l = LUGARES.find((x) => x.label === e.target.value)
              if (l) set('local', { label: l.label, lat: l.lat, lng: l.lng })
            }}
            wrapperClassName="sm:max-w-md"
          >
            {!lugarConhecido && <option value={form.local.label}>{form.local.label}</option>}
            {LUGARES_POR_DISTRITO.map((x) => (
              <optgroup key={x.d} label={x.d}>
                {x.lugares.map((l) => (
                  <option key={l.label} value={l.label}>
                    {l.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </SelectField>
          <PillGroup label="Distância máxima" radio>
            {raios.map((r) => (
              <Pill key={r} type="radio" name="raio" checked={form.raioKm === r} onChange={() => set('raioKm', r)}>
                {r} km
              </Pill>
            ))}
          </PillGroup>

          <div data-campo="orcamentoMax">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label htmlFor="perfil-orcamento" className="font-medium">
                Orçamento mensal máximo
              </label>
              <p aria-hidden className="text-4xl font-semibold tracking-tight tabular">
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
              className="mt-2 h-12 w-full cursor-pointer accent-ink"
            />
            <div aria-hidden className="flex justify-between text-sm text-ink-mute">
              <span>{euro(ORCAMENTO_MIN)}</span>
              <span>{euro(ORCAMENTO_MAX)}+</span>
            </div>
            {erros.orcamentoMax && (
              <p role="alert" className="mt-2 text-sm font-medium text-alert-700">
                {erros.orcamentoMax}
              </p>
            )}
          </div>
          <Switch
            checked={form.precisaAcordoSS}
            onChange={(v) => set('precisaAcordoSS', v)}
            label="Precisa de vaga comparticipada"
            description="Só instituições com acordo com a Segurança Social."
          />
          <PillGroup label="Para quando?" radio>
            {(Object.keys(URGENCIA_LABEL) as Urgencia[]).map((u) => (
              <Pill key={u} type="radio" name="urgencia" checked={form.urgencia === u} onChange={() => set('urgencia', u)}>
                {URGENCIA_LABEL[u]}
              </Pill>
            ))}
          </PillGroup>
        </FormSection>

        <FormSection title="Notas para a instituição">
          <TextareaField
            label="O que a equipa deve saber"
            optional
            hint="Diagnósticos, medicação, rotinas, do que gosta."
            value={form.notas ?? ''}
            onChange={(e) => set('notas', e.target.value)}
            rows={4}
          />
        </FormSection>

        {perfil && (
          <div className="border-t border-line pt-8">
            <button type="button" onClick={() => setApagar(true)} className="inline-flex min-h-12 items-center font-medium text-alert-700 hover:underline">
              Apagar este perfil
            </button>
          </div>
        )}
      </div>

      {/* barra de gravação: feedback imediato + ação (fixa ao fundo só quando há algo por guardar) */}
      <div
        ref={barra}
        className={cn(
          fixa ? 'sticky shadow-lift' : 'relative',
          'bottom-[calc(var(--tabbar-h)+0.75rem)] z-20 mt-10 rounded-[1.5rem] bg-white/95 p-3 ring-1 ring-black/[0.06] backdrop-blur-xl backdrop-saturate-150',
          'sm:rounded-full sm:py-3 sm:pr-3 sm:pl-7',
          fixa && 'sm:shadow-card',
        )}
      >
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <p className="min-w-0 px-2 text-sm leading-snug text-ink-mute sm:px-0" aria-live="polite">
            <Tween value={contagem.compativeis} className="font-semibold text-ink" /> compatíveis ·{' '}
            <span className="whitespace-nowrap">
              <Tween value={contagem.comVaga} className="font-semibold text-ink" /> com vaga
            </span>
            <span className="ml-3 hidden sm:inline">
              <MoreLink to={pesquisaUrl(contagem.f)}>Ver no mapa</MoreLink>
            </span>
          </p>
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-2 sm:flex sm:shrink-0 sm:items-center sm:gap-1">
            {dirty && perfil && (
              <Button
                variant="ghost"
                className="max-sm:bg-sand max-sm:text-ink"
                onClick={() => {
                  setForm(inicial)
                  setErros({})
                }}
              >
                Repor
              </Button>
            )}
            <Button type="submit" disabled={!dirty && Boolean(perfil)} className={cn(!(dirty && perfil) && 'col-span-2')}>
              {perfil ? (dirty ? 'Guardar alterações' : 'Guardado') : 'Criar perfil'}
            </Button>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={apagar}
        onClose={() => setApagar(false)}
        onConfirm={confirmarApagar}
        title="Apagar este perfil?"
        description={perfil?.nome}
        confirmLabel="Apagar perfil"
        cancelLabel="Manter"
        confirmVariant="danger"
      >
        <p>Os dados de saúde e as preferências são apagados da sua conta. Não é possível desfazer.</p>
        <p className="mt-3">Os pedidos já enviados não são cancelados: as instituições mantêm a cópia que receberam.</p>
      </ConfirmModal>
    </form>
  )
}
