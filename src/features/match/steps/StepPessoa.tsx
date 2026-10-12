import { Info } from 'lucide-react'
import { FieldShell, InputField } from '@/components/ui/Field'
import { cn } from '@/lib/cn'
import { RELACOES } from '@/lib/labels'
import { RadioChips } from '../controls/Chips'
import { GENERO_DA_RELACAO, IDADE_MIN, idadeNum } from '../model'
import type { StepProps } from './types'

export function StepPessoa({ r, patch, erros, p }: StepProps) {
  const idade = idadeNum(r)
  const perguntarGenero = Boolean(r.relacao) && !GENERO_DA_RELACAO[r.relacao]

  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <RadioChips
        name="relacao"
        legend="A pessoa é…"
        value={r.relacao}
        onChange={(relacao) => patch({ relacao, genero: GENERO_DA_RELACAO[relacao] ?? (GENERO_DA_RELACAO[r.relacao] ? '' : r.genero) })}
        options={RELACOES.map((v) => ({ value: v, label: v }))}
        error={erros.relacao}
      />

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_13rem] sm:items-end">
        <InputField
          label={p.proprio ? 'O seu nome' : 'Como se chama?'}
          optional
          hint="Só para personalizarmos as perguntas. Não é partilhado."
          autoComplete="off"
          value={r.nome}
          maxLength={60}
          onChange={(e) => patch({ nome: e.target.value })}
          placeholder={p.proprio ? 'Ex.: António' : 'Ex.: Maria do Carmo'}
        />
        <FieldShell label="Idade" error={erros.idade}>
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <input
                id={id}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={3}
                value={r.idade}
                onChange={(e) => patch({ idade: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                aria-describedby={describedBy}
                aria-invalid={invalid || undefined}
                aria-required="true"
                placeholder="84"
                className={cn(
                  'min-h-15 w-full rounded-2xl border-2 bg-white py-2 pr-18 pl-5 font-display text-3xl font-semibold text-ink tabular placeholder:text-ink-mute/40',
                  'transition-colors hover:border-pine-400 focus:border-pine-600 focus:outline-none focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-terra-500',
                  invalid ? 'border-alert-600' : 'border-line-strong',
                )}
              />
              <span aria-hidden className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-lg text-ink-mute">
                anos
              </span>
            </div>
          )}
        </FieldShell>
      </div>

      {idade != null && idade >= IDADE_MIN && idade < 65 && (
        <p className="flex max-w-2xl items-start gap-3 rounded-2xl border border-pine-200 bg-pine-50 px-5 py-4 text-base text-pine-900">
          <Info aria-hidden className="mt-1 size-5 shrink-0 text-pine-700" />
          <span>
            Os lares (ERPI) destinam-se, em regra, a pessoas com 65 ou mais anos. Alguns admitem pessoas mais novas em situação
            de dependência — vale a pena perguntar diretamente.
          </span>
        </p>
      )}

      {perguntarGenero && (
        <RadioChips
          name="genero"
          legend="Género (opcional)"
          hint="Para escrevermos corretamente nas próximas perguntas."
          value={r.genero}
          onChange={(genero) => patch({ genero })}
          options={[
            { value: 'F', label: 'Feminino' },
            { value: 'M', label: 'Masculino' },
          ]}
          className="animate-fade-in"
        />
      )}
    </div>
  )
}
