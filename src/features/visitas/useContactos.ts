import { useMemo } from 'react'
import { useLares, useVisitas } from '@/lib/store'
import { isoDia } from '@/lib/format'
import { contactosUrgentes } from './pipeline'

/**
 * Contactos da equipa em atraso ou para hoje, em todos os distritos: o número da barra lateral e da barra de abas.
 * 0 para quem não é da equipa (useVisitas só devolve visitas à equipa).
 */
export function useContactosUrgentes(): number {
  const visitas = useVisitas()
  const lares = useLares()
  // recalcula também quando muda o dia (a barra volta a desenhar-se a cada mudança de página)
  const hoje = isoDia(new Date())
  return useMemo(() => (visitas.length ? contactosUrgentes(lares, visitas, new Date()) : 0), [lares, visitas, hoje])
}

/** "1 contacto para hoje ou em atraso" (leitor de ecrã, depois do número). */
export const contactosLabel = (n: number) => (n === 1 ? 'contacto para hoje ou em atraso' : 'contactos para hoje ou em atraso')
