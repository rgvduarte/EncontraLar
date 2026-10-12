import { useMemo } from 'react'
import { HeartHandshake, Lightbulb, ShieldCheck } from 'lucide-react'
import type { Cuidado } from '@/types'
import { ChoiceCard } from '@/components/ui/Field'
import { CUIDADO_ICON } from '@/components/lar/icons'
import { CUIDADO_LABEL, CUIDADOS_ORDEM } from '@/lib/labels'
import { distanceKm } from '@/lib/geo'
import { residenciais } from '../area'
import { deLocal } from '../language'
import type { StepProps } from './types'

const DESCRICAO: Record<Cuidado, string> = {
  enfermagem24h: 'Enfermeiro(a) presente de dia e de noite — pensos, injetáveis, sondas.',
  demencia: 'Equipa preparada para Alzheimer e outras demências, em espaço seguro.',
  acamados: 'Passa a maior parte do dia na cama e precisa de ser posicionado(a).',
  paliativos: 'Conforto e controlo da dor numa doença avançada.',
  oxigenio: 'Usa oxigénio em casa, de dia ou durante a noite.',
  fisioterapia: 'Recuperar ou manter a marcha — por exemplo, depois de uma queda ou AVC.',
  terapia_ocupacional: 'Manter as capacidades para as tarefas do dia a dia.',
  terapia_fala: 'Dificuldade em falar ou em engolir.',
  psicologia: 'Tristeza, ansiedade ou dificuldade em adaptar-se à mudança.',
  medico: 'Médico que acompanha regularmente na própria instituição.',
  diabetes: 'Controlo da glicemia, insulina e alimentação adaptada.',
  nutricao: 'Dietas especiais, perda de peso ou alimentação triturada.',
}

const GRUPOS: { id: string; titulo: string; nota: string; itens: Cuidado[]; essencial?: boolean }[] = [
  {
    id: 'permanentes',
    titulo: 'Cuidados permanentes',
    nota: 'Essenciais: só sugerimos lares que os asseguram.',
    itens: CUIDADOS_ORDEM.filter((c) => ['enfermagem24h', 'demencia', 'acamados', 'paliativos', 'oxigenio'].includes(c)),
    essencial: true,
  },
  {
    id: 'terapias',
    titulo: 'Terapias',
    nota: 'Contam a favor na ordenação.',
    itens: CUIDADOS_ORDEM.filter((c) => ['fisioterapia', 'terapia_ocupacional', 'terapia_fala', 'psicologia'].includes(c)),
  },
  {
    id: 'outros',
    titulo: 'Outros cuidados',
    nota: 'Contam a favor na ordenação.',
    itens: CUIDADOS_ORDEM.filter((c) => ['medico', 'diabetes', 'nutricao'].includes(c)),
  },
]

export function StepSaude({ r, patch, erros, lares, p }: StepProps) {
  // se a zona já é conhecida, as contagens são da zona; senão, do país
  const { base, onde } = useMemo(() => {
    const res = residenciais(lares)
    if (r.local) {
      const loc = r.local
      const perto = res.filter((l) => distanceKm(loc, l) <= r.raioKm)
      if (perto.length) return { base: perto, onde: `num raio de ${r.raioKm} km` }
    }
    return { base: res, onde: 'no país' }
  }, [lares, r.local, r.raioKm])

  const conta = (c: Cuidado) => base.filter((l) => l.cuidados.includes(c)).length

  const alternar = (c: Cuidado) => {
    const tem = r.necessidades.includes(c)
    patch({
      necessidades: tem ? r.necessidades.filter((n) => n !== c) : CUIDADOS_ORDEM.filter((n) => n === c || r.necessidades.includes(n)),
      semNecessidades: false,
    })
  }

  const sugerirAcamado = r.grau === 'grave' && !r.necessidades.includes('acamados') && !r.semNecessidades

  return (
    <div className="flex flex-col gap-10" aria-describedby={erros.necessidades ? 'saude-err' : undefined}>
      <div className="max-w-3xl">
        <ChoiceCard
          type="checkbox"
          checked={r.semNecessidades}
          onChange={() => patch({ semNecessidades: !r.semNecessidades, necessidades: r.semNecessidades ? r.necessidades : [] })}
          aria-invalid={erros.necessidades ? true : undefined}
          icon={<HeartHandshake aria-hidden />}
          label="Nenhuma necessidade especial"
          description="Está bem de saúde, ou só precisa da medicação habitual e de alguém atento."
          className="border-dashed p-5"
        />
      </div>

      {sugerirAcamado && (
        <p className="flex max-w-3xl items-start gap-3 rounded-2xl border border-sun-200 bg-sun-50 px-5 py-4 text-base text-sun-800">
          <Lightbulb aria-hidden className="mt-1 size-5 shrink-0" />
          <span>
            Indicou dependência grave. Se {p.proprio ? 'passa' : `${p.pronome} passa`} a maior parte do dia na cama, marque{' '}
            <strong>Pessoas acamadas</strong> — nem todos os lares estão preparados para isso.
          </span>
        </p>
      )}

      {GRUPOS.map((g) => (
        <fieldset key={g.id} className="flex flex-col gap-4">
          <legend className="mb-4 w-full">
            <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-display text-2xl font-semibold text-ink">{g.titulo}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft">
                {g.essencial && <ShieldCheck aria-hidden className="size-4 text-pine-700" />}
                {g.nota}
              </span>
            </span>
          </legend>
          <div className="grid gap-3 md:grid-cols-2">
            {g.itens.map((c) => {
              const Icon = CUIDADO_ICON[c]
              const n = conta(c)
              return (
                <ChoiceCard
                  key={c}
                  type="checkbox"
                  checked={r.necessidades.includes(c)}
                  onChange={() => alternar(c)}
                  icon={<Icon aria-hidden />}
                  label={CUIDADO_LABEL[c]}
                  description={
                    <>
                      <span className="block">{DESCRICAO[c]}</span>
                      <span className="mt-1 block text-sm font-semibold text-ink-mute">
                        {n === 0 ? `Nenhuma instituição ${onde}` : `${n} ${n === 1 ? 'instituição' : 'instituições'} ${onde}`}
                        {onde !== 'no país' && r.local ? ` ${deLocal(r.local.label)}` : ''}
                      </span>
                    </>
                  }
                />
              )
            })}
          </div>
        </fieldset>
      ))}

      {erros.necessidades && (
        <p id="saude-err" role="alert" className="text-sm font-bold text-alert-700">
          {erros.necessidades}
        </p>
      )}
    </div>
  )
}
