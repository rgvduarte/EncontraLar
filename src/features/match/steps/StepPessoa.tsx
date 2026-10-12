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
    <div className="flex flex-col gap-10">
      <RadioChips
        name="relacao"
        legend="A pessoa é"
        value={r.relacao}
        onChange={(relacao) =>
          patch({ relacao, genero: GENERO_DA_RELACAO[relacao] ?? (GENERO_DA_RELACAO[r.relacao] ? '' : r.genero) })
        }
        options={RELACOES.map((v) => ({ value: v, label: v }))}
        error={erros.relacao}
      />

      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-start">
        <div data-campo>
          <InputField
            label={p.proprio ? 'O seu nome' : 'Nome'}
            optional
            autoComplete={p.proprio ? 'given-name' : 'off'}
            autoCapitalize="words"
            enterKeyHint="next"
            value={r.nome}
            maxLength={60}
            onChange={(e) => patch({ nome: e.target.value })}
            placeholder={p.proprio ? 'Ex.: António' : 'Ex.: Maria do Carmo'}
          />
        </div>
        <div data-campo>
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
                  enterKeyHint="next"
                  value={r.idade}
                  onChange={(e) => patch({ idade: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                  aria-describedby={describedBy}
                  aria-invalid={invalid || undefined}
                  aria-required="true"
                  placeholder="Ex.: 84"
                  className={cn(
                    'min-h-13 w-full rounded-2xl border bg-white py-3 pr-16 pl-4 text-base text-ink tabular placeholder:text-ink-mute',
                    'transition-[border-color,box-shadow] duration-200 hover:border-pine-400 focus:border-terra-500 focus:ring-4 focus:ring-terra-100 focus:outline-none',
                    invalid ? 'border-alert-600' : 'border-line-strong',
                  )}
                />
                <span
                  aria-hidden
                  className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-base text-ink-mute"
                >
                  anos
                </span>
              </div>
            )}
          </FieldShell>
        </div>
      </div>

      {idade != null && idade >= IDADE_MIN && idade < 65 && (
        <p className="-mt-4 animate-fade-in text-sm text-ink-mute">
          Os lares recebem, em regra, pessoas a partir dos 65 anos. Alguns admitem pessoas mais novas em situação de dependência —
          vale a pena perguntar.
        </p>
      )}

      {perguntarGenero && (
        <RadioChips
          name="genero"
          legend="Género"
          optional
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
