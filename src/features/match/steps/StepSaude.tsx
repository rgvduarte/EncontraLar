import type { Cuidado } from '@/types'
import { CUIDADO_LABEL, CUIDADOS_CRITICOS, CUIDADOS_ORDEM } from '@/lib/labels'
import type { StepProps } from './types'
import { ChoiceTile } from '../controls/ChoiceTile'

/** Uma linha para os cuidados que não são evidentes pelo nome. */
const DESCRICAO: Partial<Record<Cuidado, string>> = {
  enfermagem24h: 'Enfermeiro presente de dia e de noite.',
  demencia: 'Equipa e espaço preparados para Alzheimer.',
  acamados: 'Passa a maior parte do dia na cama.',
  paliativos: 'Conforto e controlo da dor.',
  oxigenio: 'Usa oxigénio de dia ou à noite.',
}

const GRUPOS: { id: string; titulo: string; nota: string; itens: Cuidado[] }[] = [
  {
    id: 'permanentes',
    titulo: 'Cuidados permanentes',
    nota: 'Essenciais: só sugerimos lares que os asseguram.',
    itens: CUIDADOS_ORDEM.filter((c) => CUIDADOS_CRITICOS.includes(c)),
  },
  {
    id: 'apoio',
    titulo: 'Terapias e acompanhamento',
    nota: 'Contam a favor, mas não excluem nenhum lar.',
    itens: CUIDADOS_ORDEM.filter((c) => !CUIDADOS_CRITICOS.includes(c)),
  },
]

export function StepSaude({ r, patch, erros, p }: StepProps) {
  const alternar = (c: Cuidado) => {
    const tem = r.necessidades.includes(c)
    patch({
      necessidades: tem
        ? r.necessidades.filter((n) => n !== c)
        : CUIDADOS_ORDEM.filter((n) => n === c || r.necessidades.includes(n)),
      semNecessidades: false,
    })
  }

  const sugerirAcamado = r.grau === 'grave' && !r.necessidades.includes('acamados') && !r.semNecessidades

  return (
    <div className="flex flex-col gap-12">
      <div data-campo>
        <ChoiceTile
          type="checkbox"
          checked={r.semNecessidades}
          onChange={() => patch({ semNecessidades: !r.semNecessidades, necessidades: r.semNecessidades ? r.necessidades : [] })}
          aria-invalid={erros.necessidades ? true : undefined}
          aria-describedby={erros.necessidades ? 'saude-err' : undefined}
          label="Nenhuma em especial"
          description="Só a medicação habitual e alguém atento."
        />
        {erros.necessidades && (
          <p id="saude-err" role="alert" className="mt-3 text-sm font-medium text-alert-700">
            {erros.necessidades}
          </p>
        )}
      </div>

      {GRUPOS.map((g) => (
        <fieldset key={g.id}>
          <legend className="text-base font-medium text-ink">{g.titulo}</legend>
          <p className="mt-0.5 text-sm text-ink-mute">{g.nota}</p>
          {g.id === 'permanentes' && sugerirAcamado && (
            <p className="mt-2 animate-fade-in text-sm text-ink-soft">
              Indicou dependência grave. Se {p.proprio ? 'passa' : `${p.pronome} passa`} a maior parte do dia na cama, marque{' '}
              <strong className="font-semibold text-ink">Pessoas acamadas</strong>.
            </p>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {g.itens.map((c) => (
              <ChoiceTile
                key={c}
                type="checkbox"
                checked={r.necessidades.includes(c)}
                onChange={() => alternar(c)}
                label={CUIDADO_LABEL[c]}
                description={DESCRICAO[c]}
              />
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}
