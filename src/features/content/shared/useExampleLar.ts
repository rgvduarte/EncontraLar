import { useMemo } from 'react'
import type { Lar } from '@/types'
import { useLares } from '@/lib/store'
import { DEMO_LAR_ID } from '@/data/seed'

/**
 * Instituição usada como exemplo nas páginas de conteúdo: a de demonstração
 * (Casa de Repouso Jardins do Douro) ou, se não existir, o primeiro lar com lista de espera e histórico.
 */
export function useExampleLar(): Lar | undefined {
  const lares = useLares()
  return useMemo(
    () =>
      lares.find((l) => l.id === DEMO_LAR_ID) ??
      lares.find((l) => l.tipo === 'erpi' && l.listaEspera > 0 && l.historicoSaidas.length > 0) ??
      lares[0],
    [lares],
  )
}
