import { useCallback, useEffect, useRef, useState } from 'react'
import type { TipoQuarto } from '@/types'
import { definirVagas, getDB } from '@/lib/store'
import { toast } from '@/components/ui/Toast'
import { QUARTO_LABEL } from '@/lib/labels'

export type EstadoGravacao = 'idle' | 'pendente' | 'guardado'

const ESPERA_MS = 1100

/**
 * Lugares livres de um tipo de quarto, com gravação automática.
 * Vários toques seguidos em "+" juntam-se numa só gravação (e num só aviso às famílias);
 * o valor pendente é gravado se a pessoa sair da página antes do tempo.
 */
export function useVagasDraft(larId: string, tipo: TipoQuarto, livres: number) {
  const [draft, setDraft] = useState<number | null>(null)
  const [estado, setEstado] = useState<EstadoGravacao>('idle')
  const pendente = useRef<number | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const alvo = useRef({ larId, tipo })
  alvo.current = { larId, tipo }

  const flush = useCallback(() => {
    clearTimeout(timer.current)
    const v = pendente.current
    if (v == null) return
    pendente.current = null
    const { larId: id, tipo: t } = alvo.current
    const atual = getDB().lares.find((l) => l.id === id)?.quartos.find((q) => q.tipo === t)?.livres
    setDraft(null)
    if (atual === v) {
      setEstado('idle')
      return
    }
    const avisadas = definirVagas(id, t, v)
    setEstado('guardado')
    const linha = `${QUARTO_LABEL[t]}: ${v === 0 ? 'nenhum lugar livre' : v === 1 ? '1 lugar livre' : `${v} lugares livres`}.`
    if (avisadas > 0) toast.success(avisadas === 1 ? '1 família foi avisada' : `${avisadas} famílias foram avisadas`, linha)
    else toast.success('Vagas atualizadas', `${linha} As famílias já veem a alteração.`)
  }, [])

  const set = useCallback(
    (v: number) => {
      setDraft(v)
      pendente.current = v
      setEstado('pendente')
      clearTimeout(timer.current)
      timer.current = setTimeout(flush, ESPERA_MS)
    },
    [flush],
  )

  // grava o que ficou pendente ao sair da página
  useEffect(() => () => flush(), [flush])

  return { value: draft ?? livres, set, estado, flush }
}
