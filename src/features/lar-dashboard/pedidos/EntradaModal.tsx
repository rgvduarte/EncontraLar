import { useEffect, useState } from 'react'
import type { Candidatura, Lar, TaxaEntrada } from '@/types'
import { Button } from '@/components/ui/Button'
import { InputField } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { marcarEntrada } from '@/lib/store'
import { isoDia } from '@/lib/format'
import { taxaPara } from '@/lib/negocio'
import { diaCurto } from '../shared/pedidoBits'
import type { Acao } from './acoes'

/** Linha da taxa de uma entrada (fixada quando a entrada é confirmada). */
export const TAXA_TEXTO: Record<TaxaEntrada, string> = {
  aplicavel: 'Taxa fixa por entrada · conforme contrato',
  incluida: 'Incluída na mensalidade',
  isenta: 'Isenta — setor social',
}

/**
 * "Marcar entrada": o dia em que a pessoa entrou (hoje, por omissão). Se a família já confirmou do lado dela,
 * o dia é o que ela indicou e basta confirmar. Fica montado enquanto fecha, para a folha descer com animação.
 */
export function EntradaModal({ c, lar, acao, open, onClose }: { c: Candidatura; lar: Lar; acao: Acao; open: boolean; onClose: () => void }) {
  const hoje = isoDia(new Date())
  const [data, setData] = useState(hoje)
  const [erro, setErro] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setData(isoDia(new Date()))
      setErro(null)
    }
  }, [open])

  const diaFamilia = c.entrada?.confirmadaFamiliaEm ? c.entrada.data : null
  const confirmar = () => {
    if (!diaFamilia) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return setErro('Indique o dia da entrada.')
      if (data > hoje) return setErro('O dia da entrada não pode ser depois de hoje. Marque a entrada no próprio dia.')
    }
    marcarEntrada(c.id, diaFamilia ?? data)
    toast.success(acao.sucesso.titulo, acao.sucesso.texto)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={acao.titulo}
      description="A entrada fica registada no pedido e na página Entradas."
      footer={
        <>
          <Button variant="subtle" onClick={onClose} className="max-sm:min-h-13">
            Cancelar
          </Button>
          <Button variant={acao.confirmVariant} onClick={confirmar} className="max-sm:min-h-13">
            {acao.confirmar}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {diaFamilia ? (
          <p className="text-lg">
            Entrou a <span className="font-semibold">{diaCurto(diaFamilia)}</span>, segundo a família.
          </p>
        ) : (
          <InputField
            label="Dia da entrada"
            type="date"
            value={data}
            max={hoje}
            required
            error={erro ?? undefined}
            onChange={(e) => {
              setData(e.target.value)
              setErro(null)
            }}
          />
        )}
        <p className="text-ink-soft">{acao.explica}</p>
        <p className="text-sm text-ink-mute">{TAXA_TEXTO[taxaPara(lar)]}.</p>
      </div>
    </Modal>
  )
}
