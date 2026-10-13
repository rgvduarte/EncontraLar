import { useCallback, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import type { Disponibilidade } from '@/types'
import { useAcesso, useLares } from '@/lib/store'
import { disponibilidade, estimarEspera, type EstimativaEspera } from '@/lib/forecast'
import { comVagaAgora, construirEntradas, filtrar, ordenar, type Entrada } from './filtering'
import { estadoGratis, ignoradosGratis, type Ignorados } from './gratis'
import { centroDe, parseSearch, toSearchParams, withPatch, type SearchState } from './searchState'

export interface SearchModel {
  /** estado efetivo (na versão grátis: sem vaga nem ordem por vaga, orçamento por faixas — gratis.ts) */
  state: SearchState
  /** todas as instituições com previsão e distância ao centro atual */
  entradas: Entrada[]
  /** resultados filtrados e ordenados */
  resultados: Entrada[]
  /** resultados com vaga para quem pede hoje (na versão grátis só se mostra o total, nunca quais) */
  comVaga: number
  update: (patch: Partial<SearchState>) => void
  /** substitui o estado (usado pelo "Limpar tudo") */
  replace: (next: SearchState) => void
  /** vê a camada completa (`useAcesso().completo`): famílias com Acesso Família e profissionais de saúde */
  completo: boolean
  /** versão grátis: o que o endereço pedia e não se aplica (vaga, ordem por vaga), para o aviso; senão null */
  ignorados: Ignorados | null
  /** versão grátis: alguém tocou num filtro fechado; abre o AcessoNecessarioModal a voltar com ele aplicado */
  pedirAcesso: (patch: Partial<SearchState>) => void
  /** pedido de acesso em curso: `aberto` e o endereço para onde voltar (o da pesquisa com o filtro pedido) */
  pedidoAcesso: { aberto: boolean; voltar: string }
  fecharAcesso: () => void
}

/** Estado da pesquisa a partir do URL + resultados calculados a partir do store. */
export function useSearch(): SearchModel {
  const [params, setParams] = useSearchParams()
  const { pathname } = useLocation()
  const lares = useLares()
  const { completo } = useAcesso()
  const key = params.toString()
  const pedido = useMemo(() => parseSearch(new URLSearchParams(key)), [key])
  // versão grátis: o que não se aplica sai do estado (e do URL, à próxima mudança); o aviso diz o que ficou de fora
  const state = useMemo(() => (completo ? pedido : estadoGratis(pedido)), [completo, pedido])
  const ignorados = useMemo(() => (completo ? null : ignoradosGratis(pedido)), [completo, pedido])

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

  const resultados = useMemo(() => ordenar(filtrar(entradas, state, completo), state.ordem, completo), [entradas, state, completo])
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

  const [pedidoAcesso, setPedidoAcesso] = useState({ aberto: false, voltar: '' })
  const pedirAcesso = useCallback(
    (patch: Partial<SearchState>) => setPedidoAcesso({ aberto: true, voltar: `${pathname}?${toSearchParams(withPatch(state, patch))}` }),
    [pathname, state],
  )
  const fecharAcesso = useCallback(() => setPedidoAcesso((p) => ({ ...p, aberto: false })), [])

  return { state, entradas, resultados, comVaga, update, replace, completo, ignorados, pedirAcesso, pedidoAcesso, fecharAcesso }
}
