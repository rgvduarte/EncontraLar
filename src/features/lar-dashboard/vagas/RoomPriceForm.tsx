import { useState, type FormEvent } from 'react'
import { Euro, Trash2 } from 'lucide-react'
import type { RoomOffer } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { atualizarLar, getDB } from '@/lib/store'
import { QUARTO_LABEL } from '@/lib/labels'

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
  if (Number.isNaN(min) || min < 1) e.precoMin = 'Indique a mensalidade mínima, em euros.'
  if (Number.isNaN(max) || max < 1) e.precoMax = 'Indique a mensalidade máxima, em euros.'
  else if (!Number.isNaN(min) && max < min) e.precoMax = 'A máxima não pode ser inferior à mínima.'
  return e
}

/** Lugares e mensalidades de um tipo de quarto (o número de livres muda-se no contador, acima). */
export function RoomPriceForm({ larId, quarto, podeRemover }: { larId: string; quarto: RoomOffer; podeRemover: boolean }) {
  const [valores, setValores] = useState<Valores | null>(null)
  const [tentou, setTentou] = useState(false)
  const [remover, setRemover] = useState(false)
  const v = valores ?? deQuarto(quarto)
  const erros = tentou ? validarQuarto(v) : {}
  const sujo = valores != null && (v.total !== String(quarto.total) || v.precoMin !== String(quarto.precoMin) || v.precoMax !== String(quarto.precoMax))
  const nome = QUARTO_LABEL[quarto.tipo].toLowerCase()

  const mudar = (k: keyof Valores) => (e: React.ChangeEvent<HTMLInputElement>) => setValores({ ...v, [k]: e.target.value })

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
    setValores(null)
    setTentou(false)
    toast.success('Preços guardados', `${QUARTO_LABEL[quarto.tipo]}: as famílias já veem os novos valores.`)
  }

  const confirmarRemocao = () => {
    const lar = getDB().lares.find((l) => l.id === larId)
    if (!lar) return
    atualizarLar(larId, { quartos: lar.quartos.filter((q) => q.tipo !== quarto.tipo) })
    setRemover(false)
    toast.info('Tipo de quarto removido', `O ${nome} deixou de aparecer na sua ficha.`)
  }

  return (
    <form onSubmit={guardar} noValidate className="border-t border-line bg-sand/40 px-6 py-5 sm:px-7">
      <p className="mb-3 flex items-center gap-2 font-bold">
        <Euro aria-hidden className="size-5 text-pine-700" /> Lugares e mensalidade
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        <InputField label="Total de lugares" inputMode="numeric" value={v.total} onChange={mudar('total')} error={erros.total} />
        <InputField label="Mensalidade desde" inputMode="numeric" value={v.precoMin} onChange={mudar('precoMin')} error={erros.precoMin} leading={<span className="font-bold">€</span>} />
        <InputField label="Mensalidade até" inputMode="numeric" value={v.precoMax} onChange={mudar('precoMax')} error={erros.precoMax} leading={<span className="font-bold">€</span>} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        {sujo && (
          <>
            <Button type="submit" variant="primary">
              Guardar preços
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setValores(null)
                setTentou(false)
              }}
            >
              Repor
            </Button>
          </>
        )}
        {!sujo && <p className="text-sm text-ink-soft">Por pessoa e por mês. Os valores aparecem na ficha e nos filtros de orçamento.</p>}
        {podeRemover && (
          <Button variant="ghost" size="sm" className="ml-auto text-alert-700 hover:bg-alert-50" icon={<Trash2 aria-hidden className="size-4" />} onClick={() => setRemover(true)}>
            Remover este tipo
          </Button>
        )}
      </div>

      <Modal
        open={remover}
        onClose={() => setRemover(false)}
        title={`Remover o ${nome}?`}
        description="Deixa de aparecer na ficha pública e nos filtros. Pode voltar a adicioná-lo mais tarde."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRemover(false)}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={confirmarRemocao} icon={<Trash2 aria-hidden className="size-5" />}>
              Remover
            </Button>
          </>
        }
      >
        <p className="text-ink-soft">
          Os pedidos já recebidos para este tipo de quarto mantêm-se. Os {quarto.total} lugares deixam de contar para as vagas deste tipo de quarto.
        </p>
      </Modal>
    </form>
  )
}
