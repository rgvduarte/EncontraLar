import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import type { Lar, TipoQuarto } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { atualizarLar, getDB } from '@/lib/store'
import { QUARTO_CURTO } from '@/lib/labels'
import { nomeQuarto } from '../lib/derive'
import { capitalizar } from '../shared/ui'
import { validarQuarto } from './RoomPriceForm'

const TIPOS: TipoQuarto[] = ['individual', 'duplo', 'casal']

/** Acrescentar um tipo de quarto (útil para instituições acabadas de registar). */
export function AddRoomType({ lar }: { lar: Lar }) {
  const emFalta = TIPOS.filter((t) => !lar.quartos.some((q) => q.tipo === t))
  const [tipo, setTipo] = useState<TipoQuarto | null>(null)
  const [v, setV] = useState({ total: '', precoMin: '', precoMax: '' })
  const [tentou, setTentou] = useState(false)
  if (emFalta.length === 0) return null
  const erros = tentou ? validarQuarto(v) : {}

  const abrir = (t: TipoQuarto) => {
    const ref = lar.quartos[0]
    setTipo(t)
    setV({ total: '', precoMin: ref ? String(ref.precoMin) : '', precoMax: ref ? String(ref.precoMax) : '' })
    setTentou(false)
  }

  const adicionar = (e: FormEvent) => {
    e.preventDefault()
    setTentou(true)
    if (!tipo || Object.keys(validarQuarto(v)).length) return
    const atual = getDB().lares.find((l) => l.id === lar.id)
    if (!atual) return
    atualizarLar(lar.id, {
      quartos: [...atual.quartos, { tipo, total: Number(v.total), livres: 0, precoMin: Number(v.precoMin), precoMax: Number(v.precoMax) }],
    })
    toast.success(`${capitalizar(nomeQuarto(tipo))} adicionado`, 'Indique agora quantos lugares deste tipo estão livres.')
    setTipo(null)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-line pt-8">
      <p className="text-ink-mute">{lar.quartos.length ? 'Tem outro tipo de quarto?' : 'Que tipos de quarto tem?'}</p>
      <div className="flex flex-wrap gap-2">
        {emFalta.map((t) => (
          <Button key={t} variant="subtle" icon={<Plus aria-hidden />} onClick={() => abrir(t)}>
            {QUARTO_CURTO[t]}
          </Button>
        ))}
      </div>

      <Modal
        open={tipo != null}
        onClose={() => setTipo(null)}
        title={tipo ? `Adicionar ${nomeQuarto(tipo)}` : ''}
        description="Começa com 0 lugares livres. Depois, mude o número no contador."
      >
        <form onSubmit={adicionar} noValidate className="flex flex-col gap-4">
          <InputField
            label="Lugares no total"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="off"
            value={v.total}
            onChange={(e) => setV({ ...v, total: e.target.value })}
            error={erros.total}
            autoFocus
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Mensalidade desde" inputMode="numeric" pattern="[0-9]*" autoComplete="off" leading="€" value={v.precoMin} onChange={(e) => setV({ ...v, precoMin: e.target.value })} error={erros.precoMin} />
            <InputField label="Mensalidade até" inputMode="numeric" pattern="[0-9]*" autoComplete="off" leading="€" value={v.precoMax} onChange={(e) => setV({ ...v, precoMax: e.target.value })} error={erros.precoMax} />
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-3 max-sm:flex-col-reverse">
            <Button variant="subtle" onClick={() => setTipo(null)} className="max-sm:w-full">
              Cancelar
            </Button>
            <Button type="submit" className="max-sm:w-full">
              Adicionar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
