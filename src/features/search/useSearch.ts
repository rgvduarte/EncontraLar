import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { Disponibilidade } from '@/types'
import { useLares } from '@/lib/store'
import { disponibilidade, estimarEspera, type EstimativaEspera } from '@/lib/forecast'
import { comVagaAgora, construirEntradas, filtrar, ordenar, type Entrada } from './filtering'
import { centroDe, parseSearch, toSearchParams, withPatch, type SearchState } from './searchState'

export interface SearchModel {
  state: SearchState
  /** todas as instituições com previsão e distância ao centro atual */
  entradas: Entrada[]
  /** resultados filtrados e ordenados */
  resultados: Entrada[]
  /** resultados com vaga para quem pede hoje */
  comVaga: number
  update: (patch: Partial<SearchState>) => void
  /** substitui o estado (usado pelo "Limpar tudo") */
  replace: (next: SearchState) => void
}

/** Estado da pesquisa a partir do URL + resultados calculados a partir do store. */
export function useSearch(): SearchModel {
  const [params, setParams] = useSearchParams()
  const lares = useLares()
  const key = params.toString()
  const state = useMemo(() => parseSearch(new URLSearchParams(key)), [key])

  // previsão por instituição: calculada uma vez por versão dos dados
  const previsoes = useMemo(() => {
    const m = new Map<string, { est: EstimativaEspera; disp: Disponibilidade }>()
    for (const l of lares) {
      const est = estimarEspera(l)
      m.set(l.id, { est, disp: disponibilidade(l, est) })
    }
    return m
  }, [lares])

  const centro = centroDe(state.local)
  const cLat = centro?.lat
  const cLng = centro?.lng
  const entradas = useMemo(
    () => construirEntradas(lares, previsoes, cLat != null && cLng != null ? { lat: cLat, lng: cLng } : null),
    [lares, previsoes, cLat, cLng],
  )

  const resultados = useMemo(() => ordenar(filtrar(entradas, state), state.ordem), [entradas, state])
  // "com vaga agora" = vaga para quem pede hoje (um lugar livre já prometido à lista de espera não conta)
  const comVaga = useMemo(() => resultados.filter(comVagaAgora).length, [resultados])

  const replace = useCallback(
    (next: SearchState) => {
      setParams(toSearchParams(next), { replace: true })
    },
    [setParams],
  )
  const update = useCallback(
    (patch: Partial<SearchState>) => {
      replace(withPatch(state, patch))
    },
    [replace, state],
  )

  return { state, entradas, resultados, comVaga, update, replace }
}
