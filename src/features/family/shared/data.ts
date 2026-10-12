import { useMemo } from 'react'
import type { Candidatura, Lar, PerfilIdoso } from '@/types'
import { jaAvaliou, useLares, useMinhasCandidaturas, usePerfis } from '@/lib/store'
import { LUGARES } from '@/data/localidades'
import { dataLocal } from './text'
import { emCurso, isAtiva, ordenarPedidos } from './estado'

/** Índice id → instituição (para não procurar em listas a cada linha). */
export function useLarIndex(): Map<string, Lar> {
  const lares = useLares()
  return useMemo(() => new Map(lares.map((l) => [l.id, l])), [lares])
}

/** Perfis ordenados (mais antigo primeiro) e o perfil principal: o que tem mais pedidos ativos. */
export function usePerfisOrdenados(): { perfis: PerfilIdoso[]; principal: PerfilIdoso | undefined } {
  const perfis = usePerfis()
  const cands = useMinhasCandidaturas()
  return useMemo(() => {
    const ord = [...perfis].sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
    const ativos = (id: string) => cands.filter((c) => c.perfilId === id && isAtiva(c)).length
    const principal = [...ord].sort((a, b) => ativos(b.id) - ativos(a.id))[0]
    return { perfis: ord, principal }
  }, [perfis, cands])
}

export interface PedidoComLar {
  c: Candidatura
  lar: Lar
}

/**
 * Pedidos do utilizador com a instituição já resolvida (ignora fichas apagadas).
 * - ativos: tudo o que não terminou, incluindo as entradas ("admitida", um fim feliz);
 * - emCurso: ainda à procura (ativos sem entrada);
 * - admitidos: com entrada registada ou confirmada;
 * - terminados: recusados ou cancelados.
 */
export function usePedidos(): {
  ativos: PedidoComLar[]
  emCurso: PedidoComLar[]
  admitidos: PedidoComLar[]
  terminados: PedidoComLar[]
  todos: PedidoComLar[]
} {
  const cands = useMinhasCandidaturas()
  const idx = useLarIndex()
  return useMemo(() => {
    const todos = ordenarPedidos(cands, jaAvaliou)
      .map((c) => ({ c, lar: idx.get(c.larId) }))
      .filter((x): x is PedidoComLar => Boolean(x.lar))
    return {
      todos,
      ativos: todos.filter((x) => isAtiva(x.c)),
      emCurso: todos.filter((x) => emCurso(x.c)),
      admitidos: todos.filter((x) => x.c.estado === 'admitida'),
      terminados: todos.filter((x) => !isAtiva(x.c)),
    }
  }, [cands, idx])
}

export interface VisitaMarcada extends PedidoComLar {
  quando: Date
}

/** Próximas visitas (hoje ou futuras), por ordem de data. */
export function visitasFuturas(pedidos: PedidoComLar[], agora = new Date()): VisitaMarcada[] {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  return pedidos
    .filter((p) => p.c.visita && p.c.visita.estado !== 'realizada' && emCurso(p.c))
    .map((p) => ({ ...p, quando: dataLocal(p.c.visita!.data, p.c.visita!.hora) }))
    .filter((v) => v.quando.getTime() >= hoje)
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())
}

const RAIOS = [5, 10, 15, 25, 50]

/** Liga o perfil ao mapa de vagas (contrato de URL de /pesquisa). */
export function pesquisaUrl(p: Pick<PerfilIdoso, 'local' | 'raioKm' | 'grau' | 'necessidades' | 'orcamentoMax' | 'precisaAcordoSS'>, extra?: Record<string, string>): string {
  const q = new URLSearchParams()
  if (LUGARES.some((l) => l.label === p.local.label)) q.set('lugar', p.local.label)
  else {
    q.set('lat', p.local.lat.toFixed(4))
    q.set('lng', p.local.lng.toFixed(4))
  }
  q.set('raio', String(RAIOS.find((r) => r >= p.raioKm) ?? 50))
  q.set('grau', p.grau)
  if (p.necessidades.length) q.set('cuidados', p.necessidades.join(','))
  if (p.orcamentoMax > 0) q.set('max', String(p.orcamentoMax))
  if (p.precisaAcordoSS) q.set('ss', '1')
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v)
  return `/pesquisa?${q.toString()}`
}
