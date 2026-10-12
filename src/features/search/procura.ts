/**
 * Procura sem resposta (anónima): uma pesquisa num lugar ou distrito escolhido que não encontrou nenhuma
 * instituição com vaga agora fica registada para as instituições da zona verem ("procura na sua zona").
 *
 * Só sai o que se procurou: distrito, nome do lugar, grau, cuidados e orçamento. Nunca coordenadas,
 * nunca texto livre (nome pesquisado), nunca quem procurou. O store guarda no máximo uma por combinação e por sessão.
 */
import { useEffect } from 'react'
import type { ProcuraAnonima } from '@/types'
import { registarProcura } from '@/lib/store'
import type { SearchState } from './searchState'

export type ProcuraSemVaga = Omit<ProcuraAnonima, 'id' | 'criadaEm'>

/** Tempo sem mudanças até a pesquisa contar como "assente" (quem ainda está a mexer nos filtros não conta). */
export const ESPERA_PROCURA_MS = 1500

/**
 * O registo de uma pesquisa de /pesquisa, ou null quando não há nada a registar:
 * há vaga agora, não há lugar nem distrito escolhido (país, a minha localização, zona do mapa)
 * ou é uma pesquisa pelo nome de uma instituição.
 */
export function procuraDaPesquisa(s: SearchState, total: number, comVaga: number): ProcuraSemVaga | null {
  if (comVaga > 0 || s.q) return null
  const sitio =
    s.local.tipo === 'lugar'
      ? { distrito: s.local.lugar.distrito, lugar: s.local.lugar.label }
      : s.local.tipo === 'distrito'
        ? { distrito: s.local.distrito }
        : null
  if (!sitio) return null
  return {
    ...sitio,
    ...(s.grau ? { grau: s.grau } : {}),
    cuidados: [...s.cuidados],
    ...(s.max != null ? { orcamentoMax: s.max } : {}),
    resultados: total,
    comVaga: 0,
  }
}

/**
 * Regista a procura quando fica parada `ESPERA_PROCURA_MS` (o temporizador recomeça sempre que `gatilho` muda,
 * ex.: o URL da pesquisa). Sair da página antes disso não regista nada.
 */
export function useRegistoProcura(p: ProcuraSemVaga | null, gatilho: string) {
  // a chave descreve a procura toda: o efeito só recomeça quando ela ou o gatilho mudam
  const chave = p ? JSON.stringify(p) : ''
  useEffect(() => {
    if (!chave) return
    const t = window.setTimeout(() => registarProcura(JSON.parse(chave) as ProcuraSemVaga), ESPERA_PROCURA_MS)
    return () => window.clearTimeout(t)
  }, [chave, gatilho])
}
