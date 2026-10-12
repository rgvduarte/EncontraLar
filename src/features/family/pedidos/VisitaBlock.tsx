import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { BookOpenText, CalendarCheck, CalendarClock, CalendarPlus, Pencil } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Button } from '@/components/ui/Button'
import { SelectField } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { pedirVisita } from '@/lib/store'
import { cn } from '@/lib/cn'
import { descarregarVisita } from '../shared/ics'
import { amanhaISO, dataLocal, diaPorExtenso, isoDia, quando, visitaPorExtenso } from '../shared/text'

/** Horários habituais de visita (a instituição confirma ou propõe outro). */
const HORAS = ['10:00', '10:30', '11:00', '11:30', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']

/** Próximos 14 dias, a começar amanhã (o dia atual raramente é possível). */
function proximosDias(extra?: string): string[] {
  const dias = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return isoDia(d)
  })
  if (extra && extra >= amanhaISO() && !dias.includes(extra)) dias.push(extra)
  return dias
}

function VisitaForm({ c, lar, onDone, inicial }: { c: Candidatura; lar: Lar; onDone?: () => void; inicial?: { data: string; hora: string } }) {
  const [data, setData] = useState(inicial?.data ?? '')
  const [hora, setHora] = useState(inicial?.hora ?? '15:00')
  const [erro, setErro] = useState<string | null>(null)
  const dias = proximosDias(inicial?.data)
  const erroId = `visita-erro-${c.id}`

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!data) return setErro('Escolha o dia da visita.')
    pedirVisita(c.id, data, hora)
    toast.success('Pedido de visita enviado', `${lar.nome} vai confirmar ${visitaPorExtenso(data, hora)} ou propor outro horário.`)
    onDone?.()
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <fieldset aria-describedby={erro ? erroId : undefined}>
        <legend className="mb-2 text-base font-bold">Dia</legend>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pt-1 pb-2 [scrollbar-width:thin] md:grid md:grid-cols-7 md:overflow-visible">
          {dias.map((iso, i) => {
            const d = dataLocal(iso)
            const fimDeSemana = d.getDay() === 0 || d.getDay() === 6
            const novoMes = i === 0 || d.getDate() === 1
            return (
              <label
                key={iso}
                className={cn(
                  'group flex min-h-20 min-w-16 shrink-0 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 px-2 py-2 text-center transition-colors',
                  'border-line bg-white hover:border-pine-400 has-[:checked]:border-pine-700 has-[:checked]:bg-pine-700 has-[:checked]:text-white',
                  'has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-terra-500',
                )}
              >
                <input
                  type="radio"
                  name={`visita-dia-${c.id}`}
                  value={iso}
                  checked={data === iso}
                  onChange={() => {
                    setData(iso)
                    setErro(null)
                  }}
                  className="sr-only"
                  aria-label={diaPorExtenso(d)}
                />
                <span aria-hidden className={cn('text-xs font-bold uppercase', fimDeSemana ? 'text-terra-700 group-has-[:checked]:text-terra-200' : 'text-ink-soft group-has-[:checked]:text-pine-100')}>
                  {d.toLocaleDateString('pt-PT', { weekday: 'short' }).replace('.', '')}
                </span>
                <span aria-hidden className="font-display text-2xl leading-none font-semibold tabular">
                  {d.getDate()}
                </span>
                <span aria-hidden className={cn('text-xs', novoMes ? 'font-bold' : 'opacity-0')}>
                  {d.toLocaleDateString('pt-PT', { month: 'short' }).replace('.', '')}
                </span>
              </label>
            )
          })}
        </div>
        {erro && (
          <p id={erroId} role="alert" className="mt-1 text-sm font-bold text-alert-700">
            {erro}
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap items-end gap-4">
        <SelectField label="Hora" value={hora} onChange={(e) => setHora(e.target.value)} wrapperClassName="w-40">
          {HORAS.map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </SelectField>
        <Button type="submit" icon={<CalendarClock aria-hidden className="size-5" />}>
          {data ? `Pedir visita para ${dataLocal(data).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}, ${hora}` : 'Pedir visita'}
        </Button>
      </div>
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
