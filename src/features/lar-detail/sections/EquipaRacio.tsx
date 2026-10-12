import { useId } from 'react'
import type { Lar } from '@/types'
import { cn } from '@/lib/cn'

/** Figura humana simples; `fill` entre 0 e 1 preenche da esquerda para a direita. */
function Pessoa({ fill = 1, tom, className }: { fill?: number; tom: 'pine' | 'mute'; className?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  const cor = tom === 'pine' ? '#22695e' : '#cbbda7'
  const forma = (
    <>
      <circle cx="12" cy="7" r="5.5" />
      <path d="M2.5 38V24.5C2.5 18.7 6.7 15 12 15s9.5 3.7 9.5 9.5V38Z" />
    </>
  )
  return (
    <svg viewBox="0 0 24 40" aria-hidden className={cn('h-10 w-6 shrink-0', className)}>
      <defs>
        <clipPath id={`c${id}`}>
          <rect x="0" y="0" width={24 * Math.max(0, Math.min(1, fill))} height="40" />
        </clipPath>
      </defs>
      {fill < 1 && (
        <g fill="none" stroke={cor} strokeWidth="1.5" strokeDasharray="2.5 2.5">
          {forma}
        </g>
      )}
      <g fill={cor} clipPath={`url(#c${id})`}>
        {forma}
      </g>
    </svg>
  )
}

const dec = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 1 })

export function EquipaRacio({ lar }: { lar: Lar }) {
  const { cuidadoresPor10, enfermeiros, medicoHorasSemana } = lar.equipa
  const temEnf24 = lar.cuidados.includes('enfermagem24h')
  const inteiros = Math.floor(cuidadoresPor10)
  const resto = cuidadoresPor10 - inteiros
  const glifos = Array.from({ length: Math.ceil(cuidadoresPor10) }, (_, i) => (i < inteiros ? 1 : resto))

  return (
    <div className="mt-5 overflow-hidden rounded-3xl border border-line bg-white">
      {cuidadoresPor10 > 0 ? (
        <figure className="p-5 sm:p-7">
          <figcaption className="max-w-xl">
            <span className="font-display text-4xl font-semibold text-pine-800 tabular">{dec(cuidadoresPor10)}</span>{' '}
            <span className="text-lg font-semibold text-ink">cuidadores por cada 10 residentes</span>
            <span className="mt-1 block text-sm text-ink-soft">Ajudantes de ação direta e auxiliares, em média ao longo do dia.</span>
          </figcaption>
          <div className="mt-5 grid gap-3" role="img" aria-label={`${dec(cuidadoresPor10)} cuidadores para cada 10 residentes`}>
            <div className="flex items-end gap-3">
              <span className="w-24 shrink-0 text-sm font-semibold text-ink-soft">Residentes</span>
              <div className="flex flex-wrap gap-1">
                {Array.from({ length: 10 }, (_, i) => (
                  <Pessoa key={i} tom="mute" />
                ))}
              </div>
            </div>
            <div className="flex items-end gap-3">
              <span className="w-24 shrink-0 text-sm font-semibold text-pine-800">Cuidadores</span>
              <div className="flex flex-wrap gap-1">
                {glifos.map((f, i) => (
                  <Pessoa key={i} tom="pine" fill={f} />
                ))}
              </div>
            </div>
          </div>
        </figure>
      ) : (
        <p className="p-5 text-ink-soft sm:p-7">A instituição ainda não indicou quantos cuidadores tem por residente.</p>
      )}

      <dl className="grid border-t border-line sm:grid-cols-2">
        <div className="flex flex-col gap-1 p-5 sm:p-7">
          <dt className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Enfermagem</dt>
          <dd className="font-display text-3xl font-semibold text-ink tabular">
            {enfermeiros > 0 ? (
              <>
                {enfermeiros} <span className="font-sans text-lg font-semibold">{enfermeiros === 1 ? 'enfermeiro(a)' : 'enfermeiros'}</span>
              </>
            ) : (
              <span className="font-sans text-lg text-ink-soft">Não indicado</span>
            )}
          </dd>
          <dd className="text-sm text-ink-soft">{temEnf24 ? 'Presença de enfermagem 24 horas por dia.' : 'Sem enfermagem permanente durante a noite.'}</dd>
        </div>
        <div className="flex flex-col gap-1 border-t border-line p-5 sm:border-t-0 sm:border-l sm:p-7">
          <dt className="text-xs font-bold tracking-[0.12em] text-ink-mute uppercase">Médico</dt>
          <dd className="font-display text-3xl font-semibold text-ink tabular">
            {medicoHorasSemana > 0 ? (
              <>
                {dec(medicoHorasSemana)} h <span className="font-sans text-lg font-semibold">por semana</span>
              </>
            ) : (
              <span className="font-sans text-lg text-ink-soft">Não indicado</span>
            )}
          </dd>
          <dd className="text-sm text-ink-soft">
            {medicoHorasSemana > 0 ? 'Presença do médico assistente na instituição.' : 'Sem horas de médico próprio indicadas — pergunte como é feito o acompanhamento.'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
