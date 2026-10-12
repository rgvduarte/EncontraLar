import { useState, type ChangeEvent, type FormEvent } from 'react'
import type { RoomOffer } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { atualizarLar, getDB } from '@/lib/store'
import { nomeQuarto } from '../lib/derive'
import { capitalizar } from '../shared/ui'

interface Valores {
  total: string
  precoMin: string
  precoMax: string
}

const deQuarto = (q: RoomOffer): Valores => ({ total: String(q.total), precoMin: String(q.precoMin), precoMax: String(q.precoMax) })
const inteiro = (s: string) => (/^\s*\d+\s*$/.test(s) ? Number(s) : NaN)

export function validarQuarto(v: Valores): Partial<Record<keyof Valores, string>> {
  const e: Partial<Record<keyof Valores, string>> = {}
  const total = inteiro(v.total)
  const min = inteiro(v.precoMin)
  const max = inteiro(v.precoMax)
  if (Number.isNaN(total) || total < 1) e.total = 'Indique pelo menos 1 lugar.'
  else if (total > 500) e.total = 'Confirme o número: parece demasiado alto.'
  if (Number.isNaN(min) || min < 1) e.precoMin = 'Indique o valor, em euros.'
  if (Number.isNaN(max) || max < 1) e.precoMax = 'Indique o valor, em euros.'
  else if (!Number.isNaN(min) && max < min) e.precoMax = 'Não pode ser inferior ao mínimo.'
  return e
}

/** Lugares e mensalidades de um tipo de quarto (os livres mudam-se no contador). */
export function RoomPriceForm({
  id,
  larId,
  quarto,
  podeRemover,
  onDone,
}: {
  id: string
  larId: string
  quarto: RoomOffer
  podeRemover: boolean
  onDone: () => void
}) {
  const [v, setV] = useState<Valores>(() => deQuarto(quarto))
  const [tentou, setTentou] = useState(false)
  const [remover, setRemover] = useState(false)
  const erros = tentou ? validarQuarto(v) : {}
  const nome = nomeQuarto(quarto.tipo)

  const mudar = (k: keyof Valores) => (e: ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value })

  const guardar = (e: FormEvent) => {
    e.preventDefault()
    setTentou(true)
    if (Object.keys(validarQuarto(v)).length) return
    const lar = getDB().lares.find((l) => l.id === larId)
    if (!lar) return
    const total = inteiro(v.total)
    atualizarLar(larId, {
      quartos: lar.quartos.map((q) =>
        q.tipo === quarto.tipo ? { ...q, total, livres: Math.min(q.livres, total), precoMin: inteiro(v.precoMin), precoMax: inteiro(v.precoMax) } : q,
      ),
    })
    toast.success('Lugares e preços guardados', `${capitalizar(nome)}: as famílias já veem os novos valores.`)
    onDone()
  }

  const confirmarRemocao = () => {
    const lar = getDB().lares.find((l) => l.id === larId)
    if (!lar) return
    atualizarLar(larId, { quartos: lar.quartos.filter((q) => q.tipo !== quarto.tipo) })
    setRemover(false)
    toast.info('Tipo de quarto removido', `O ${nome} deixou de aparecer na sua ficha.`)
  }

  return (
    <form id={id} onSubmit={guardar} noValidate className="mt-4 origin-top animate-[pop-in_.42s_cubic-bezier(.16,1,.3,1)_both] rounded-[1.75rem] bg-sand p-5 sm:p-7">
      <div className="grid gap-4 sm:grid-cols-3">
        <InputField label="Total de lugares" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="next" value={v.total} onChange={mudar('total')} error={erros.total} />
        <InputField label="Mensalidade desde" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="next" value={v.precoMin} onChange={mudar('precoMin')} error={erros.precoMin} leading="€" />
        <InputField label="Mensalidade até" inputMode="numeric" pattern="[0-9]*" autoComplete="off" enterKeyHint="done" value={v.precoMax} onChange={mudar('precoMax')} error={erros.precoMax} leading="€" />
      </div>
      <p className="mt-3 text-sm text-ink-mute">Por pessoa e por mês. Aparecem na ficha e nos filtros de orçamento.</p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="submit" className="max-sm:flex-1">
          Guardar
        </Button>
        <Button variant="secondary" onClick={onDone} className="max-sm:flex-1">
          Cancelar
        </Button>
        {podeRemover && (
          <button type="button" onClick={() => setRemover(true)} className="min-h-12 text-sm font-medium text-alert-700 hover:underline max-sm:w-full sm:ml-auto">
            Remover este tipo de quarto
          </button>
        )}
      </div>

      <Modal
        open={remover}
        onClose={() => setRemover(false)}
        title={`Remover o ${nome}?`}
        description="Deixa de aparecer na ficha pública e nos filtros. Pode voltar a adicioná-lo."
        footer={
          <>
            <Button variant="subtle" onClick={() => setRemover(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarRemocao}>
              Remover
            </Button>
          </>
        }
      >
        <p className="text-ink-mute">
          Os pedidos já recebidos mantêm-se. Os {quarto.total} lugares deste tipo deixam de contar para as vagas.
        </p>
      </Modal>
    </form>
  )
}
