import { Check } from 'lucide-react'
import type { Lar } from '@/types'
import { CUIDADOS_CRITICOS, CUIDADOS_ORDEM, CUIDADO_LABEL, GRAUS_ORDEM, GRAU_DESCRICAO, GRAU_LABEL } from '@/lib/labels'
import { cn } from '@/lib/cn'
import { Numero, Secao, Subtitulo } from '../Secao'

const dec = (v: number) => v.toLocaleString('pt-PT', { maximumFractionDigits: 1 })

/** Só a primeira letra em minúscula ("Demência e Alzheimer" → "demência e Alzheimer"). */
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** "a, b e c" */
const juntar = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

export function CuidadosSection({ lar }: { lar: Lar }) {
  const { cuidadoresPor10, enfermeiros, medicoHorasSemana } = lar.equipa
  const oferecidos = CUIDADOS_ORDEM.filter((c) => lar.cuidados.includes(c))
  const criticosEmFalta = CUIDADOS_CRITICOS.filter((c) => !lar.cuidados.includes(c))
  const enf24 = lar.cuidados.includes('enfermagem24h')
  const temEquipa = cuidadoresPor10 > 0 || enfermeiros > 0 || medicoHorasSemana > 0

  return (
    <Secao
      id="ficha-cuidados"
      rotulo="Cuidados e equipa"
      titulo="Quem cuida, e de quê"
      intro="O que a instituição assegura no dia a dia e para que graus de dependência."
    >
      {temEquipa ? (
        <dl className="grid grid-cols-2 gap-x-8 gap-y-10 sm:grid-cols-3 sm:gap-12">
          <Numero
            valor={cuidadoresPor10 > 0 ? dec(cuidadoresPor10) : '—'}
            rotulo="cuidadores por 10 residentes"
            nota={cuidadoresPor10 > 0 ? 'em média, ao longo do dia' : 'não indicado'}
          />
          <Numero
            valor={enfermeiros > 0 ? enfermeiros : '—'}
            rotulo={enfermeiros === 1 ? 'enfermeiro(a)' : 'enfermeiros'}
            nota={enf24 ? 'enfermagem 24 horas' : 'sem enfermagem à noite'}
          />
          <Numero
            valor={medicoHorasSemana > 0 ? dec(medicoHorasSemana) : '—'}
            unidade={medicoHorasSemana > 0 ? 'h' : undefined}
            rotulo="de médico por semana"
            nota={medicoHorasSemana > 0 ? 'na instituição' : 'pergunte como é feito'}
          />
        </dl>
      ) : (
        <p className="text-lg text-ink-mute">A instituição ainda não indicou a composição da equipa.</p>
      )}

      <div className="mt-16">
        <Subtitulo>Cuidados assegurados</Subtitulo>
        {oferecidos.length ? (
          <ul className="mt-4 grid border-t border-line sm:grid-cols-2 sm:gap-x-10">
            {oferecidos.map((c) => (
              <li key={c} className="flex items-center justify-between gap-3 border-b border-line py-3.5 text-ink">
                {CUIDADO_LABEL[c]}
                <Check aria-hidden className="size-4.5 shrink-0 text-ink-mute" strokeWidth={2} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-ink-mute">A instituição ainda não indicou os cuidados de saúde que assegura.</p>
        )}
        {criticosEmFalta.length > 0 && (
          <p className="mt-5 max-w-[65ch] text-ink-mute">
            <span className="font-medium text-ink">Não assegura:</span> {juntar(criticosEmFalta.map((c) => minuscula(CUIDADO_LABEL[c])))}. Se a
            pessoa precisar, confirme diretamente com a instituição.
          </p>
        )}
      </div>

      <div className="mt-16">
        <Subtitulo>Graus de dependência</Subtitulo>
        <ul className="mt-4 border-t border-line">
          {GRAUS_ORDEM.map((g) => {
            const aceita = lar.graus.includes(g)
            return (
              <li key={g} className="flex items-start justify-between gap-6 border-b border-line py-4">
                <div className="min-w-0">
                  <p className={cn('font-medium', aceita ? 'text-ink' : 'text-ink-mute')}>{GRAU_LABEL[g]}</p>
                  <p className="mt-0.5 text-sm text-ink-mute">{GRAU_DESCRICAO[g]}</p>
                </div>
                <p className={cn('flex shrink-0 items-center gap-1.5 text-sm font-medium', aceita ? 'text-leaf-700' : 'text-ink-mute')}>
                  {aceita && <Check aria-hidden className="size-4" strokeWidth={2.5} />}
                  {aceita ? 'Aceita' : 'Não aceita'}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </Secao>
  )
}
