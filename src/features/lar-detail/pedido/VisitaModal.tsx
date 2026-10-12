import { useId, useState, type FormEvent } from 'react'
import { CalendarCheck } from 'lucide-react'
import type { Candidatura, Lar } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'
import { pedirVisita } from '@/lib/store'
import { diaPorExtenso } from '../helpers'
import { VisitFields, validarVisita, type VisitaEscolha } from './VisitFields'

/** Marcar visita num pedido que já existe (não cria um pedido novo). */
export function VisitaModal({ lar, c, open, onClose }: { lar: Lar; c: Candidatura | null; open: boolean; onClose: () => void }) {
  const formId = `visita-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [visita, setVisita] = useState<VisitaEscolha>({ data: '', hora: '15:00' })
  const [erro, setErro] = useState<string | null>(null)

  const submeter = (e: FormEvent) => {
    e.preventDefault()
    if (!c) return
    const err = validarVisita(visita)
    setErro(err)
    if (err) return
    pedirVisita(c.id, visita.data, visita.hora)
    toast.success('Visita pedida', `${lar.nome} vai confirmar a visita de ${diaPorExtenso(visita.data)}, às ${visita.hora}.`)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Marcar visita"
      description={c ? `No pedido para ${c.perfil.nome}, em ${lar.nome}.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} icon={<CalendarCheck aria-hidden className="size-5" />}>
            Pedir visita
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submeter} noValidate className="flex flex-col gap-4">
        <p className="text-ink-soft">
          Escolha um dia e uma hora que lhe deem jeito. A instituição confirma por telefone ou email e, se não puder, propõe outra hora.
        </p>
        <VisitFields value={visita} onChange={setVisita} erro={erro} />
      </form>
    </Modal>
  )
}
