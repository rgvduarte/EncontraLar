import { useId, type ReactNode } from 'react'
import type { Lar } from '@/types'
import { Checkbox, ChoiceCard, InputField, Switch, TextareaField } from '@/components/ui/Field'
import { CUIDADO_LABEL, CUIDADOS_CRITICOS, CUIDADOS_ORDEM, GRAU_DESCRICAO, GRAU_LABEL, GRAUS_ORDEM, QUARTO_CURTO } from '@/lib/labels'
import { euro } from '@/lib/format'
// controlos já usados no perfil da família e no questionário (só leitura)
import { FormSection, Pill, PillGroup } from '@/features/family/perfil/controls'
import { PlaceCombobox } from '@/features/match/controls/PlaceCombobox'
import { ORCAMENTO_MAX, ORCAMENTO_MIN, QUARTOS, RAIOS_KM, type CasoForm, type ErrosCaso } from './casoModel'

// só a 1.ª letra em minúscula: os nomes ficam iguais às pílulas
const ESSENCIAIS = CUIDADOS_CRITICOS.map((c) => CUIDADO_LABEL[c].charAt(0).toLowerCase() + CUIDADO_LABEL[c].slice(1))
const essenciaisTxt = `${ESSENCIAIS.slice(0, -1).join(', ')} e ${ESSENCIAIS[ESSENCIAIS.length - 1]}`

export const TEXTO_CONSENTIMENTO =
  'Confirmo que a pessoa (ou o seu representante legal) autorizou a partilha deste perfil de cuidados com as instituições que eu escolher.'

/** Mensagem de erro de um campo que não vem do kit (combobox, slider, caixa). */
function Erro({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-alert-700">
      {children}
    </p>
  )
}

/**
 * Campos do caso, por secções (novo caso e folha de edição). `set` muda um campo e limpa o seu erro.
 */
export function CamposCaso({
  form,
  set,
  erros,
  lares,
  novo,
}: {
  form: CasoForm
  set: <K extends keyof CasoForm>(k: K, v: CasoForm[K]) => void
  erros: ErrosCaso
  lares: Lar[]
  /** novo caso: pede o consentimento (na edição já está registado) */
  novo: boolean
}) {
  const uid = useId()
  const nome = (n: string) => `${uid}-${n}`
  const toggle = <T,>(list: T[], v: T, on: boolean) => (on ? [...list, v] : list.filter((x) => x !== v))
  const raios = RAIOS_KM.includes(form.raioKm as (typeof RAIOS_KM)[number]) ? [...RAIOS_KM] : [...RAIOS_KM, form.raioKm].sort((a, b) => a - b)
  const orcId = `${uid}-orcamento`
  const consId = `${uid}-consentimento-erro`

  return (
    <div className="flex flex-col gap-14">
      <FormSection title="A pessoa" hint="Basta o primeiro nome ou as iniciais. A instituição só o vê depois de aceitar o pedido.">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div data-campo="nome">
            <InputField
              label="Nome ou iniciais"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              error={erros.nome}
              autoComplete="off"
              autoCapitalize="words"
              maxLength={80}
            />
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
        <PillGroup label="Género" hint="Ajuda a instituição a propor quarto partilhado." radio>
          {(
            [
              ['F', 'Feminino'],
              ['M', 'Masculino'],
              ['', 'Prefiro não indicar'],
            ] as const
          ).map(([v, l]) => (
            <Pill key={l} type="radio" name={nome('genero')} checked={(form.genero ?? '') === v} onChange={() => set('genero', v || undefined)}>
              {l}
            </Pill>
          ))}
        </PillGroup>
      </FormSection>

      <FormSection title="Grau de dependência" hint="Decide que instituições podem acolher.">
        <div role="radiogroup" aria-label="Grau de dependência" className="grid gap-3 sm:grid-cols-2">
          {GRAUS_ORDEM.map((g) => (
            <ChoiceCard key={g} name={nome('grau')} checked={form.grau === g} onChange={() => set('grau', g)} label={GRAU_LABEL[g]} description={GRAU_DESCRICAO[g]} />
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

      <FormSection title="Onde e quanto">
        <div data-campo="local" className="sm:max-w-md">
          <PlaceCombobox
            label="Perto de onde?"
            hint="Normalmente, perto de quem a vai visitar."
            value={form.local}
            onChange={(l) => set('local', l)}
            lares={lares}
            raioKm={form.raioKm}
            error={erros.local}
          />
        </div>
        <PillGroup label="Distância máxima" radio>
          {raios.map((r) => (
            <Pill key={r} type="radio" name={nome('raio')} checked={form.raioKm === r} onChange={() => set('raioKm', r)}>
              {r} km
            </Pill>
          ))}
        </PillGroup>
        <PillGroup label="Tipo de quarto" radio>
          {QUARTOS.map((q) => (
            <Pill key={q} type="radio" name={nome('quarto')} checked={form.quarto === q} onChange={() => set('quarto', q)}>
              {q === 'indiferente' ? 'Indiferente' : q === 'duplo' ? 'Duplo, partilhado' : QUARTO_CURTO[q]}
            </Pill>
          ))}
        </PillGroup>

        <div data-campo="orcamentoMax">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <label htmlFor={orcId} className="font-medium">
              Orçamento mensal máximo
            </label>
            <p aria-hidden className="text-4xl font-semibold tracking-tight tabular">
              {euro(form.orcamentoMax)}
            </p>
          </div>
          <input
            id={orcId}
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
          {erros.orcamentoMax && <Erro>{erros.orcamentoMax}</Erro>}
        </div>
        <Switch
          checked={form.precisaAcordoSS}
          onChange={(v) => set('precisaAcordoSS', v)}
          label="Precisa de acordo com a Segurança Social"
          description="Só instituições com vagas comparticipadas."
        />
      </FormSection>

      <FormSection title="Alta e referência">
        <div className="grid gap-5 sm:grid-cols-2">
          <div data-campo="altaPrevista">
            <InputField
              label="Alta prevista"
              optional
              hint="Com alta nos próximos 7 dias, o pedido aparece primeiro à instituição."
              type="date"
              value={form.altaPrevista}
              onChange={(e) => set('altaPrevista', e.target.value)}
              error={erros.altaPrevista}
            />
          </div>
          <div data-campo="referencia">
            <InputField
              label="Referência interna"
              optional
              hint="Ex.: o n.º do processo no serviço. Sem nome, NIF nem n.º de utente."
              value={form.referencia}
              onChange={(e) => set('referencia', e.target.value)}
              error={erros.referencia}
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
            />
          </div>
        </div>
      </FormSection>

      <FormSection title="Notas para a instituição">
        <TextareaField
          label="O que a equipa deve saber"
          optional
          hint="Diagnóstico, mobilidade, medicação, rotinas. A instituição só as lê depois de aceitar o pedido."
          value={form.notas}
          onChange={(e) => set('notas', e.target.value)}
          rows={4}
        />
      </FormSection>

      {novo && (
        <FormSection title="Consentimento">
          <div data-campo="consentimento" className="rounded-[1.25rem] bg-sand p-5 sm:p-6">
            <Checkbox
              label={TEXTO_CONSENTIMENTO}
              description="Antes de aceitar o pedido, cada instituição vê só um resumo sem nome: faixa etária, grau de dependência, cuidados, zona, orçamento e a data prevista de alta."
              checked={form.consentimento}
              onChange={(e) => set('consentimento', e.target.checked)}
              required
              aria-invalid={erros.consentimento ? true : undefined}
              aria-describedby={erros.consentimento ? consId : undefined}
            />
            {erros.consentimento && <Erro id={consId}>{erros.consentimento}</Erro>}
          </div>
        </FormSection>
      )}
    </div>
  )
}

/** Foca o primeiro campo com erro (pela ordem do ecrã). */
export function focarCampo(campo: string, raiz: ParentNode = document) {
  raiz.querySelector<HTMLElement>(`[data-campo="${campo}"] input, [data-campo="${campo}"] textarea`)?.focus()
}
