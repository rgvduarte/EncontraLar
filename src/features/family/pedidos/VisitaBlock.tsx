import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { BookOpenText, CalendarCheck, CalendarClock, CalendarPlus, Pencil } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField, SelectField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { pedirVisita } from '@/lib/store'
import { cn } from '@/lib/cn'
import { descarregarVisita } from '../shared/ics'
import { amanhaISO, dataLocal, quando, visitaPorExtenso } from '../shared/text'

/** Horários habituais de visita (a instituição confirma ou propõe outro). */
const HORAS = ['10:00', '10:30', '11:00', '11:30', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']

function VisitaForm({ c, lar, onDone, inicial }: { c: Candidatura; lar: Lar; onDone?: () => void; inicial?: { data: string; hora: string } }) {
  const [data, setData] = useState(inicial?.data ?? '')
  const [hora, setHora] = useState(inicial?.hora ?? '15:00')
  const [erro, setErro] = useState<string | null>(null)
  const min = amanhaISO()

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!data) return setErro('Escolha o dia da visita.')
    if (data < min) return setErro('Escolha um dia a partir de amanhã.')
    pedirVisita(c.id, data, hora)
    toast.success('Pedido de visita enviado', `${lar.nome} vai confirmar ${visitaPorExtenso(data, hora)} ou propor outro horário.`)
    onDone?.()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,11rem)_auto] sm:items-end">
      <InputField
        type="date"
        label="Dia"
        min={min}
        value={data}
        onChange={(e) => {
          setData(e.target.value)
          setErro(null)
        }}
        error={erro ?? undefined}
        required
      />
      <SelectField label="Hora" value={hora} onChange={(e) => setHora(e.target.value)}>
        {HORAS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </SelectField>
      <Button type="submit" icon={<CalendarClock aria-hidden className="size-5" />} className={cn(erro && 'sm:mb-8')}>
        Pedir visita
      </Button>
    </form>
  )
}

/** Bloco da visita num pedido: marcada (com calendário), pedida, realizada ou formulário para pedir. */
export function VisitaBlock({ c, lar }: { c: Candidatura; lar: Lar }) {
  const [editar, setEditar] = useState(false)
  const v = c.visita

  if (v && v.estado === 'realizada') {
    return (
      <p className="flex items-center gap-3 text-ink-soft">
        <CalendarCheck aria-hidden className="size-5 text-pine-600" />
        Visitou a instituição {quando(dataLocal(v.data, v.hora))} ({visitaPorExtenso(v.data, v.hora)}).
      </p>
    )
  }

  if (v && !editar) {
    const confirmada = v.estado === 'confirmada'
    const passou = dataLocal(v.data, v.hora).getTime() < Date.now()
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <span
            aria-hidden
            className={cn('flex size-12 shrink-0 items-center justify-center rounded-2xl', confirmada ? 'bg-leaf-100 text-leaf-700' : 'bg-sun-100 text-sun-800')}
          >
            {confirmada ? <CalendarCheck className="size-6" /> : <CalendarClock className="size-6" />}
          </span>
          <div>
            <p className="font-bold">
              {confirmada ? 'Visita confirmada' : 'Visita pedida — a aguardar confirmação'}
              {passou && <span className="font-normal text-ink-soft"> (já passou)</span>}
            </p>
            <p className="text-ink-soft first-letter:uppercase">
              {visitaPorExtenso(v.data, v.hora)} · {quando(dataLocal(v.data, v.hora))}
            </p>
            <Link to="/guia#visita" className="link mt-1 inline-flex min-h-11 items-center gap-1.5 text-sm">
              <BookOpenText aria-hidden className="size-4" />O que observar e perguntar
            </Link>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!passou && (
            <Button
              variant="secondary"
             
              icon={<CalendarPlus aria-hidden className="size-4.5" />}
              onClick={() => descarregarVisita(c, lar) && toast.success('Ficheiro de calendário descarregado', 'Abra-o para juntar a visita ao seu calendário.')}
            >
              Adicionar ao calendário
            </Button>
          )}
          <Button variant="ghost" icon={<Pencil aria-hidden className="size-4.5" />} onClick={() => setEditar(true)}>
            {passou ? 'Marcar outra visita' : 'Alterar data'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="font-bold">{editar ? 'Escolher outro dia' : 'Marcar uma visita'}</p>
      <p className="mb-4 text-sm text-ink-soft">
        {editar
          ? 'O novo pedido substitui o anterior; a instituição volta a confirmar.'
          : 'Ver as instalações ao vivo é o melhor teste. A instituição confirma por telefone ou email.'}
      </p>
      <VisitaForm c={c} lar={lar} inicial={editar && v ? { data: v.data, hora: v.hora } : undefined} onDone={() => setEditar(false)} />
      {editar && (
        <Button variant="ghost" className="mt-3" onClick={() => setEditar(false)}>
          Manter a data atual
        </Button>
      )}
    </div>
  )
}
