import { useMemo } from 'react'
import { Accessibility, Bed, HandHelping, PersonStanding, type LucideIcon } from 'lucide-react'
import type { GrauDependencia } from '@/types'
import { ChoiceCard } from '@/components/ui/Field'
import { GRAU_DESCRICAO, GRAU_LABEL, GRAUS_ORDEM } from '@/lib/labels'
import { contagemPorGrau, residenciais } from '../area'
import type { StepProps } from './types'

const ICONE: Record<GrauDependencia, LucideIcon> = {
  autonomo: PersonStanding,
  ligeira: HandHelping,
  moderada: Accessibility,
  grave: Bed,
}

export function StepAutonomia({ r, patch, erros, lares }: StepProps) {
  const contagem = useMemo(() => contagemPorGrau(lares), [lares])
  const total = useMemo(() => residenciais(lares).length, [lares])

  return (
    <fieldset className="flex max-w-3xl flex-col gap-4" aria-describedby={`grau-hint${erros.grau ? ' grau-err' : ''}`}>
      <legend className="sr-only">Grau de autonomia</legend>
      <p id="grau-hint" className="mb-1 flex items-center gap-2 text-base font-semibold text-pine-800">
        <span aria-hidden className="h-px w-6 bg-pine-400" />
        Não tem a certeza? Escolha o mais próximo — pode mudar depois.
      </p>
      <ol className="flex flex-col gap-3">
        {GRAUS_ORDEM.map((g, i) => {
          const Icon = ICONE[g]
          return (
            <li key={g} className="relative">
              <ChoiceCard
                name="grau"
                value={g}
                checked={r.grau === g}
                onChange={() => patch({ grau: g })}
                aria-invalid={erros.grau && i === 0 ? true : undefined}
                icon={<Icon aria-hidden />}
                label={GRAU_LABEL[g]}
                description={
                  <>
                    <span className="block">{GRAU_DESCRICAO[g]}</span>
                    <span className="mt-1.5 block text-sm font-semibold text-ink-mute">
                      Admitido em {contagem[g]} das {total} instituições
                    </span>
                  </>
                }
                className="p-5"
              />
            </li>
          )
        })}
      </ol>
      {erros.grau && (
        <p id="grau-err" role="alert" className="text-sm font-bold text-alert-700">
          {erros.grau}
        </p>
      )}
    </fieldset>
  )
}
