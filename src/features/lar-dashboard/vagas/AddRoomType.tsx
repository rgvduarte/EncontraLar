import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import type { Lar, TipoQuarto } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { atualizarLar, getDB } from '@/lib/store'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { validarQuarto } from './RoomPriceForm'

const TIPOS: TipoQuarto[] = ['individual', 'duplo', 'casal']

/** Para instituições acabadas de registar (só com um tipo de quarto) ou que mudaram a oferta. */
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
    toast.success(`${QUARTO_LABEL[tipo]} adicionado`, 'Indique agora quantos lugares deste tipo estão livres.')
    setTipo(null)
  }

  return (
    <div className="rounded-3xl border-2 border-dashed border-line-strong p-5">
      <p className="font-bold">Tem outro tipo de quarto?</p>
      <p className="mt-1 text-sm text-ink-soft">As famílias filtram pelo tipo de quarto. Acrescente os que faltam na sua ficha.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {emFalta.map((t) => (
          <Button key={t} variant="subtle" icon={<Plus aria-hidden className="size-5" />} onClick={() => abrir(t)}>
            {QUARTO_CURTO[t]}
          </Button>
        ))}
      </div>

      <Modal
        open={tipo != null}
        onClose={() => setTipo(null)}
        title={tipo ? `Adicionar ${QUARTO_LABEL[tipo].toLowerCase()}` : ''}
        description="Começa com 0 lugares livres. Muda o número no contador, depois de guardar."
      >
        <form onSubmit={adicionar} noValidate className="flex flex-col gap-4">
          <InputField label="Lugares no total" inputMode="numeric" value={v.total} onChange={(e) => setV({ ...v, total: e.target.value })} error={erros.total} autoFocus />
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Mensalidade mínima" inputMode="numeric" leading={<span className="font-bold">€</span>} value={v.precoMin} onChange={(e) => setV({ ...v, precoMin: e.target.value })} error={erros.precoMin} />
            <InputField label="Mensalidade máxima" inputMode="numeric" leading={<span className="font-bold">€</span>} value={v.precoMax} onChange={(e) => setV({ ...v, precoMax: e.target.value })} error={erros.precoMax} />
          </div>
          <div className="mt-2 flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setTipo(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" icon={<Plus aria-hidden className="size-5" />}>
              Adicionar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
