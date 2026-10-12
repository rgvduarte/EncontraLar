import { LUGARES } from '@/data/localidades'
import { CUIDADOS_CRITICOS } from '@/lib/labels'
import { semLimiteOrcamento, type Rascunho } from '../model'

/**
 * O mesmo perfil, traduzido para o contrato de URL de /pesquisa (docs/DESIGN.md §5), para que o mapa mostre
 * as mesmas instituições que as sugestões:
 * - só lares e residências (as sugestões nunca incluem centros de dia);
 * - só os cuidados essenciais são filtro (os outros contam a favor nas sugestões, mas não excluem);
 * - o teto do preço tem a mesma tolerância das sugestões (até 15% acima do orçamento ainda é "a ponderar"),
 *   senão a melhor sugestão podia desaparecer do mapa por 10 €; "Ainda não sei" não põe teto.
 */
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
  q.set('tipo', 'erpi,residencia')
  if (r.grau) q.set('grau', r.grau)
  const cuidados = r.semNecessidades ? [] : r.necessidades.filter((c) => CUIDADOS_CRITICOS.includes(c))
  if (cuidados.length) q.set('cuidados', cuidados.join(','))
  if (r.orcamentoMax != null && !semLimiteOrcamento(r.orcamentoMax))
    q.set('max', String(Math.ceil((r.orcamentoMax * 1.15) / 50) * 50))
  if (r.precisaAcordoSS) q.set('ss', '1')
  q.set('ordem', 'relevancia')
  return `/pesquisa?${q.toString()}`
}
