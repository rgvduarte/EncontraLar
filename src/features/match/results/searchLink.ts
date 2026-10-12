import { LUGARES } from '@/data/localidades'
import type { Rascunho } from '../model'

/** O mesmo perfil, traduzido para o contrato de URL de /pesquisa (docs/DESIGN.md §5). */
export function urlPesquisa(r: Rascunho): string {
  const q = new URLSearchParams()
  if (r.local) {
    if (LUGARES.some((l) => l.label === r.local!.label)) q.set('lugar', r.local.label)
    else {
      q.set('lat', r.local.lat.toFixed(4))
      q.set('lng', r.local.lng.toFixed(4))
    }
  }
  q.set('raio', String(r.raioKm))
  if (r.grau) q.set('grau', r.grau)
  const cuidados = r.semNecessidades ? [] : r.necessidades
  if (cuidados.length) q.set('cuidados', cuidados.join(','))
  if (r.orcamentoMax != null) q.set('max', String(r.orcamentoMax))
  if (r.precisaAcordoSS) q.set('ss', '1')
  q.set('ordem', 'relevancia')
  return `/pesquisa?${q.toString()}`
}
