import { useCallback, useEffect, useRef, useState } from 'react'
import type { LatLng } from '@/lib/geo'

/**
 * Localização para ordenar "Por visitar" por distância. Só a pedido (botão): nunca pergunta sozinha.
 * Se a pessoa já a ligou nesta sessão e o navegador já a autorizou, volta a usá-la ao regressar à lista (sem pergunta).
 * Recusada ou indisponível: a lista fica por ordem alfabética.
 */
export type EstadoPosicao = 'inativo' | 'a_pedir' | 'ativo' | 'negado' | 'indisponivel'

const PREF = 'encontralar:visitas:ordem'
/** posição recente reaproveitada ao voltar à lista (5 minutos) */
const VALIDADE_MS = 5 * 60_000
let cache: { origem: LatLng; em: number } | null = null

const suportado = () => typeof navigator !== 'undefined' && 'geolocation' in navigator

function lerPref(): boolean {
  try {
    return sessionStorage.getItem(PREF) === 'distancia'
  } catch {
    return false
  }
}
function gravarPref(distancia: boolean) {
  try {
    if (distancia) sessionStorage.setItem(PREF, 'distancia')
    else sessionStorage.removeItem(PREF)
  } catch {
    /* sem armazenamento: só nesta visita à página */
  }
}

export function usePosicao() {
  const [estado, setEstado] = useState<EstadoPosicao>(() => (lerPref() && cache && Date.now() - cache.em < VALIDADE_MS ? 'ativo' : 'inativo'))
  const [origem, setOrigem] = useState<LatLng | null>(() => (lerPref() && cache && Date.now() - cache.em < VALIDADE_MS ? cache.origem : null))
  const vivo = useRef(true)
  useEffect(() => {
    vivo.current = true
    return () => {
      vivo.current = false
    }
  }, [])

  const localizar = useCallback(() => {
    if (!suportado()) {
      setEstado('indisponivel')
      return
    }
    setEstado('a_pedir')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if (!vivo.current) return
        const o = { lat: p.coords.latitude, lng: p.coords.longitude }
        cache = { origem: o, em: Date.now() }
        gravarPref(true)
        setOrigem(o)
        setEstado('ativo')
      },
      (err) => {
        if (!vivo.current) return
        gravarPref(false)
        setOrigem(null)
        setEstado(err.code === err.PERMISSION_DENIED ? 'negado' : 'indisponivel')
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: VALIDADE_MS },
    )
  }, [])

  // de volta à lista com a ordem por distância ligada: só volta a localizar se o navegador já autorizou (sem perguntar)
  useEffect(() => {
    if (estado !== 'inativo' || !lerPref() || !suportado() || !navigator.permissions?.query) return
    let cancelado = false
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        if (!cancelado && s.state === 'granted') localizar()
      })
      .catch(() => {})
    return () => {
      cancelado = true
    }
    // só ao entrar na página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const alfabetica = useCallback(() => {
    gravarPref(false)
    setOrigem(null)
    setEstado('inativo')
  }, [])

  return { estado, origem, suportado: suportado(), localizar, alfabetica }
}
