import type { Candidatura, Urgencia } from '@/types'
import { CUIDADO_LABEL, GRAU_LABEL, QUARTO_CURTO } from '@/lib/labels'
import { euro } from '@/lib/format'

/** Urgência em texto simples — só a imediata é destacada. */
export const URGENCIA_CURTA: Record<Urgencia, string> = {
  imediata: 'Urgente — alta hospitalar',
  '1-3meses': 'Dentro de 1 a 3 meses',
  '3-6meses': 'Dentro de 3 a 6 meses',
  planeamento: 'A planear com tempo',
}

/** "Pai de Rui Sousa" — relação do perfil com quem fez o pedido. */
export function relacaoTexto(c: Candidatura): string {
  const r = c.perfil.relacao
  if (!r || r === 'Eu próprio(a)') return 'Pedido feito pela própria pessoa'
  return `${r} de ${c.contacto.nome}`
}

const listaHumana = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/** "pessoas acamadas, enfermagem 24 horas e gestão de diabetes" (ou null) */
export function necessidadesTexto(c: Candidatura, max = 99): string | null {
  const nec = c.perfil.necessidades.map((n) => CUIDADO_LABEL[n].toLowerCase())
  if (!nec.length) return null
  const vis = nec.slice(0, max)
  const mais = nec.length - vis.length
  return mais > 0 ? `${vis.join(', ')} e mais ${mais}` : listaHumana(vis)
}

/** "Dependência grave · pessoas acamadas, enfermagem 24 horas e mais 1" */
export function perfilLinha(c: Candidatura, maxCuidados = 2): string {
  const nec = necessidadesTexto(c, maxCuidados)
  return [GRAU_LABEL[c.perfil.grau], nec].filter(Boolean).join(' · ')
}

/** "Qualquer quarto · até 2100 €/mês" */
export function procuraTexto(c: Candidatura): string {
  const q = c.perfil.quarto === 'indiferente' ? 'Qualquer quarto' : `Quarto ${QUARTO_CURTO[c.perfil.quarto].toLowerCase()}`
  return `${q} · até ${euro(c.perfil.orcamentoMax)}/mês`
}

export const telHref = (tel: string) => `tel:${tel.replace(/\s/g, '')}`

export const excerto = (s: string, n = 180) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s)

export const verPedidoHref = (c: Candidatura) => `/gestao/pedidos?pedido=${encodeURIComponent(c.id)}`
