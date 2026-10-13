import { useMemo } from 'react'
import type { Lar } from '@/types'
import { useAcesso, useLares } from '@/lib/store'
import { DEMO_LAR_ID } from '@/data/seed'

/** Como a instituição de exemplo aparece na versão grátis. */
export const NOME_EXEMPLO = 'Casa de exemplo'

/**
 * Instituição usada como exemplo nas páginas de conteúdo: a de demonstração
 * (Casa de Repouso Jardins do Douro) ou, se não existir, o primeiro lar com lista de espera e histórico.
 *
 * As páginas mostram o produto a funcionar com os dados dela (vagas, preços, previsão). Na versão grátis
 * (sem o Acesso Família, e também para as instituições) o exemplo fica anónimo, como «Casa de exemplo»:
 * vê-se o produto, nunca de que instituição são as vagas, os preços ou a previsão.
 */
export function useExampleLar(): Lar | undefined {
  const lares = useLares()
  const { completo } = useAcesso()
  return useMemo(() => {
    const lar =
      lares.find((l) => l.id === DEMO_LAR_ID) ??
      lares.find((l) => l.tipo === 'erpi' && l.listaEspera > 0 && l.historicoSaidas.length > 0) ??
      lares[0]
    return lar && !completo ? { ...lar, nome: NOME_EXEMPLO } : lar
  }, [lares, completo])
}
