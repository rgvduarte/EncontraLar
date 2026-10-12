import { useState, type FormEvent } from 'react'
import { CalendarPlus } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { pedirVisita } from '@/lib/store'
import { cn } from '@/lib/cn'
import { descarregarVisita } from '../shared/ics'
import { amanhaISO, dataLocal, isoDia, quando, visitaPorExtenso } from '../shared/text'

/** Horários habituais de visita (a instituição confirma ou propõe outro). */
const HORAS = ['10:00', '10:30', '11:00', '11:30', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']

/** Próximos 14 dias, a começar amanhã. */
function proximosDias(extra?: string): string[] {
  const dias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return isoDia(d)
  })
  if (extra && extra >= amanhaISO() && !dias.includes(extra)) dias.push(extra)
  return dias
}

const rotuloDia = (iso: string) =>
  dataLocal(iso).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

function VisitaForm({ c, lar, inicial, onDone }: { c: Candidatura; lar: Lar; inicial?: { data: string; hora: string }; onDone?: () => void }) {
  const dias = proximosDias(inicial?.data)
  const [data, setData] = useState(inicial?.data ?? dias[0]!)
  const [hora, setHora] = useState(inicial?.hora ?? '15:00')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    pedirVisita(c.id, data, hora)
    toast.success('Pedido de visita enviado', `${lar.nome} vai confirmar ${visitaPorExtenso(data, hora)}.`)
    onDone?.()
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <SelectField label="Dia" value={data} onChange={(e) => setData(e.target.value)}>
        {dias.map((d) => (
          <option key={d} value={d}>
            {rotuloDia(d)}
          </option>
        ))}
      </SelectField>
      <div className="flex flex-wrap items-end gap-4">
        <SelectField label="Hora" value={hora} onChange={(e) => setHora(e.target.value)} wrapperClassName="w-32">
          {HORAS.map((h) => (
            <option key={h}>{h}</option>
          ))}
        </SelectField>
        <Button type="submit">Pedir visita</Button>
      </div>
    </form>
  )
}

/** Visita de um pedido: marcada (com calendário), pedida, realizada — ou o formulário para a pedir. */
export function VisitaBlock({ c, lar }: { c: Candidatura; lar: Lar }) {
  const [editar, setEditar] = useState(false)
  const v = c.visita

  if (v && v.estado === 'realizada') {
    return <p className="text-ink-soft">Visitou a instituição {quando(dataLocal(v.data, v.hora))}.</p>
  }

  if (v && !editar) {
    const confirmada = v.estado === 'confirmada'
    const passou = dataLocal(v.data, v.hora).getTime() < Date.now()
    return (
      <div>
        <p className="flex items-center gap-2 text-sm text-ink-mute">
          <span aria-hidden className={cn('size-2 rounded-full', confirmada ? 'bg-leaf-500' : 'bg-sun-500')} />
          {confirmada ? 'Confirmada' : 'Pedida — a aguardar confirmação'}
        </p>
        <p className="mt-1 text-xl font-semibold first-letter:uppercase">{visitaPorExtenso(v.data, v.hora)}</p>
        <p className="text-ink-mute">{passou ? 'Já passou' : quando(dataLocal(v.data, v.hora))}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {!passou && (
            <Button
              variant="subtle"
              size="sm"
              icon={<CalendarPlus aria-hidden />}
              onClick={() => descarregarVisita(c, lar) && toast.success('Visita no calendário', 'Abra o ficheiro descarregado para a juntar ao seu calendário.')}
            >
              Adicionar ao calendário
            </Button>
          )}
          <button type="button" className="link min-h-12" onClick={() => setEditar(true)}>
            {passou ? 'Marcar outra visita' : 'Alterar data'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="mb-4 text-ink-mute">
        {editar ? 'O novo pedido substitui o anterior.' : 'Ver as instalações ao vivo é o melhor teste. A instituição confirma por telefone ou email.'}
      </p>
      <VisitaForm c={c} lar={lar} inicial={editar && v ? { data: v.data, hora: v.hora } : undefined} onDone={() => setEditar(false)} />
      {editar && (
        <button type="button" className="link mt-3 min-h-12" onClick={() => setEditar(false)}>
          Manter a data atual
        </button>
      )}
    </div>
  )
}
