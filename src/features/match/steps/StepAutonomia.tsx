import { GRAU_DESCRICAO, GRAU_LABEL, GRAUS_ORDEM } from '@/lib/labels'
import type { StepProps } from './types'
import { ChoiceTile } from '../controls/ChoiceTile'

export function StepAutonomia({ r, patch, erros }: StepProps) {
  return (
    <fieldset aria-describedby={erros.grau ? 'grau-err' : undefined}>
      <legend className="sr-only">Grau de autonomia</legend>
      <div className="flex flex-col gap-3">
        {GRAUS_ORDEM.map((g, i) => (
          <ChoiceTile
            key={g}
            name="grau"
            value={g}
            checked={r.grau === g}
            onChange={() => patch({ grau: g })}
            aria-invalid={erros.grau && i === 0 ? true : undefined}
            label={GRAU_LABEL[g]}
            description={GRAU_DESCRICAO[g]}
          />
        ))}
      </div>
      {erros.grau && (
        <p id="grau-err" role="alert" className="mt-4 text-sm font-medium text-alert-700">
          {erros.grau}
        </p>
      )}
    </fieldset>
  )
}
