import { useState } from 'react'
import type { Candidatura, Caso } from '@/types'
import { atualizarCaso, cancelarCandidatura } from '@/lib/store'
import { Checkbox } from '@/components/ui/Field'
import { toast } from '@/components/ui/Toast'
import { POR_LIBERTAR } from '../shared/caso'
import { Confirmar } from '../shared/ui'

export type AcaoCaso = 'colocado' | 'fechado'

/**
 * Confirmação de "Marcar como colocado" / "Fechar caso". Oferece-se para cancelar os pedidos ainda em curso
 * (as instituições são avisadas e deixam de guardar lugar).
 */
export function MudarEstado({ caso, cands, acao, onClose }: { caso: Caso; cands: Candidatura[]; acao: AcaoCaso | null; onClose: () => void }) {
  const [libertar, setLibertar] = useState(true)
  // mantém o texto durante a animação de fecho (acao volta a null antes de o diálogo desaparecer)
  const [ultima, setUltima] = useState<AcaoCaso>(acao ?? 'colocado')
  if (acao && acao !== ultima) setUltima(acao)
  const [aberta, setAberta] = useState(acao)
  if (acao !== aberta) {
    setAberta(acao)
    if (acao) setLibertar(true)
  }
  const emCurso = cands.filter((c) => POR_LIBERTAR.includes(c.estado))
  const fechar = ultima === 'fechado'

  const confirmar = () => {
    if (!acao) return
    const n = libertar ? emCurso.length : 0
    for (const c of n ? emCurso : []) cancelarCandidatura(c.id)
    atualizarCaso(caso.id, { estado: acao })
    const extra = n ? `${n === 1 ? 'O pedido em curso foi cancelado' : `Os ${n} pedidos em curso foram cancelados`} e as instituições avisadas.` : ''
    if (acao === 'colocado') toast.success('Caso colocado', extra || 'Passa para “Colocados e fechados”.')
    else toast.info('Caso fechado', `Pode reabri-lo quando precisar.${extra ? ` ${extra}` : ''}`)
    onClose()
  }

  return (
    <Confirmar
      open={acao !== null}
      onClose={onClose}
      onConfirm={confirmar}
      title={fechar ? 'Fechar este caso?' : 'Marcar o caso como colocado?'}
      description={caso.referencia ?? undefined}
      confirmLabel={fechar ? 'Fechar caso' : 'Marcar como colocado'}
      cancelLabel="Voltar"
      confirmVariant={fechar ? 'danger' : 'primary'}
    >
      <p>
        {fechar
          ? 'Use quando a pessoa já não precisa de vaga (por exemplo, voltou para casa com apoio). Pode reabrir o caso depois.'
          : 'A pessoa tem lugar numa instituição. O caso passa para “Colocados e fechados”.'}
      </p>
      {emCurso.length > 0 && (
        <Checkbox
          checked={libertar}
          onChange={(e) => setLibertar(e.target.checked)}
          label={emCurso.length === 1 ? 'Cancelar o pedido em curso' : `Cancelar os ${emCurso.length} pedidos em curso`}
          description="As instituições são avisadas e deixam de guardar lugar para esta pessoa."
        />
      )}
    </Confirmar>
  )
}
