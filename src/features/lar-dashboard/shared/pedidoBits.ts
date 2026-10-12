import type { Candidatura, Urgencia } from '@/types'
import { CUIDADO_FRASE, GRAU_LABEL } from '@/lib/labels'
import { euro } from '@/lib/format'
import { minuscula, nomeQuarto } from '../lib/derive'
import { capitalizar } from './ui'

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

/** "cuidados de pessoa acamada, enfermagem 24 horas e controlo da diabetes" (ou null) — para "Precisa de …". */
export function necessidadesTexto(c: Candidatura, max = 99): string | null {
  const nec = c.perfil.necessidades.map((n) => CUIDADO_FRASE[n])
  if (!nec.length) return null
  const vis = nec.slice(0, max)
  const mais = nec.length - vis.length
  return mais > 0 ? `${vis.join(', ')} e mais ${mais}` : listaHumana(vis)
}

/** "dependência grave · precisa de cuidados de pessoa acamada, enfermagem 24 horas e mais 1" (para meio de frase) */
export function perfilLinha(c: Candidatura, maxCuidados = 2): string {
  const nec = necessidadesTexto(c, maxCuidados)
  return [minuscula(GRAU_LABEL[c.perfil.grau]), nec && `precisa de ${nec}`].filter(Boolean).join(' · ')
}

/** "Qualquer quarto · até 2100 €/mês" */
export function procuraTexto(c: Candidatura): string {
  const q = c.perfil.quarto === 'indiferente' ? 'Qualquer quarto' : capitalizar(nomeQuarto(c.perfil.quarto))
  return `${q} · até ${euro(c.perfil.orcamentoMax)}/mês`
}

export const telHref = (tel: string) => `tel:${tel.replace(/\s/g, '')}`

export const excerto = (s: string, n = 180) => (s.length > n ? `${s.slice(0, n).replace(/\s+\S*$/, '')}…` : s)

export const verPedidoHref = (c: Candidatura) => `/gestao/pedidos?pedido=${encodeURIComponent(c.id)}`
