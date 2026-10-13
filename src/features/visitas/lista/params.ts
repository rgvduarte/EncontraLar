import type { Distrito } from '@/types'
import { DISTRITOS } from '@/data/localidades'
import { DISTRITO_PILOTO, SEGMENTOS, type FiltroDistrito, type Segmento } from '../pipeline'

/**
 * Estado da lista no endereço (/visitas?seg=acompanhar&distrito=Braga&q=maia): o botão "voltar" e a "Próxima visita"
 * regressam à mesma vista. O distrito escolhido fica também guardado neste navegador (conveniência; pode falhar).
 */
const CHAVE_DISTRITO = 'encontralar:visitas:distrito'
const CHAVE_LISTA = 'encontralar:visitas:lista'

const valido = (d: string | null | undefined): d is FiltroDistrito => d === 'todos' || DISTRITOS.includes(d as Distrito)

export function distritoGuardado(): FiltroDistrito | null {
  try {
    const d = localStorage.getItem(CHAVE_DISTRITO)
    return valido(d) ? d : null
  } catch {
    return null
  }
}

export function guardarDistrito(d: FiltroDistrito) {
  try {
    localStorage.setItem(CHAVE_DISTRITO, d)
  } catch {
    /* sem armazenamento: só no endereço */
  }
}

/** O distrito da lista: o do endereço, o último escolhido neste navegador, ou o da região piloto. */
export function distritoDosParams(params: URLSearchParams): FiltroDistrito {
  const d = params.get('distrito')
  return valido(d) ? d : (distritoGuardado() ?? DISTRITO_PILOTO)
}

export function segmentoDosParams(params: URLSearchParams): Segmento {
  const s = params.get('seg')
  return SEGMENTOS.includes(s as Segmento) ? (s as Segmento) : 'por_visitar'
}

/** Lembra a vista da lista (para "Próxima visita" voltar ao mesmo sítio). */
export function lembrarLista(search: string) {
  try {
    sessionStorage.setItem(CHAVE_LISTA, search)
  } catch {
    /* sem armazenamento: volta à lista por omissão */
  }
}

/** "/visitas?seg=…" — a última vista da lista neste separador, ou "/visitas". */
export function ultimaLista(): string {
  try {
    const s = sessionStorage.getItem(CHAVE_LISTA)
    return s && s.startsWith('?') && !s.includes('//') ? `/visitas${s}` : '/visitas'
  } catch {
    return '/visitas'
  }
}
