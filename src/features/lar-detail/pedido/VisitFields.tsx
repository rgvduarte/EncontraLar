import { InputField, SelectField } from '@/components/ui/Field'
import { HORAS_VISITA, amanhaISO, diaPorExtenso, fimDeSemana } from '../helpers'

export interface VisitaEscolha {
  data: string
  hora: string
}

/** Valida a escolha de visita; devolve a mensagem de erro (ou null). */
export function validarVisita(v: VisitaEscolha): string | null {
  if (!v.data) return 'Escolha o dia da visita.'
  if (v.data < amanhaISO()) return 'Escolha uma data a partir de amanhã.'
  if (!HORAS_VISITA.includes(v.hora)) return 'Escolha uma hora entre as 10:00 e as 17:30.'
  return null
}

/** Dia (a partir de amanhã) + hora (10:00–17:30, de 30 em 30 minutos). */
export function VisitFields({ value, onChange, erro }: { value: VisitaEscolha; onChange: (v: VisitaEscolha) => void; erro?: string | null }) {
  const extenso = value.data ? diaPorExtenso(value.data) : ''
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
        <InputField
          type="date"
          label="Dia"
          min={amanhaISO()}
          value={value.data}
          onChange={(e) => onChange({ ...value, data: e.target.value })}
          hint="A partir de amanhã."
          error={erro ?? undefined}
        />
        <SelectField label="Hora" hint="Das 10:00 às 17:30." value={value.hora} onChange={(e) => onChange({ ...value, hora: e.target.value })}>
          {HORAS_VISITA.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </SelectField>
      </div>
      <p className="min-h-6 text-ink" aria-live="polite">
        {extenso && !erro ? `Visita para ${extenso}, às ${value.hora}.` : ''}
      </p>
      {value.data && fimDeSemana(value.data) && (
        <p className="text-sm text-ink-mute">Ao fim de semana algumas instituições não recebem visitas. Se for o caso, propõem outro dia.</p>
      )}
    </div>
  )
}
