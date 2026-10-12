import { useMemo } from 'react'
import type { Candidatura, Caso, PerfilIdoso } from '@/types'
import { useCasos, useCaso, useCurrentUser, useDB, usePerfis } from '@/lib/store'
import { ordenarCasos } from './caso'

export interface CasoComDados {
  caso: Caso
  perfil: PerfilIdoso
  /** pedidos enviados a partir do caso */
  cands: Candidatura[]
}

/** Caso + perfil de cuidados (só os do profissional com sessão iniciada). */
export function useCasoComPerfil(id: string | undefined): { caso?: Caso; perfil?: PerfilIdoso } {
  const caso = useCaso(id)
  const perfis = usePerfis()
  const perfil = useMemo(() => (caso ? perfis.find((p) => p.id === caso.perfilId) : undefined), [caso, perfis])
  return { caso, perfil }
}

/** Todos os casos do profissional, com perfil e pedidos, já ordenados (abertos primeiro, por data de alta). */
export function useCasosComDados(): CasoComDados[] {
  const casos = useCasos()
  const perfis = usePerfis()
  const { candidaturas } = useDB()
  return useMemo(() => {
    const porCaso = new Map<string, Candidatura[]>()
    for (const c of candidaturas) {
      const id = c.encaminhamento?.casoId
      if (!id) continue
      const l = porCaso.get(id)
      if (l) l.push(c)
      else porCaso.set(id, [c])
    }
    const lista: CasoComDados[] = []
    for (const caso of ordenarCasos(casos)) {
      const perfil = perfis.find((p) => p.id === caso.perfilId)
      if (perfil) lista.push({ caso, perfil, cands: porCaso.get(caso.id) ?? [] })
    }
    return lista
  }, [casos, perfis, candidaturas])
}

/** Vagas propostas à espera de resposta, em todos os casos do profissional. */
export function usePropostasPendentes(): number {
  const user = useCurrentUser()
  const { candidaturas } = useDB()
  return useMemo(
    () => (user ? candidaturas.filter((c) => c.estado === 'vaga_proposta' && c.encaminhamento?.profissionalId === user.id).length : 0),
    [candidaturas, user],
  )
}
