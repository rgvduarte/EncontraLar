import type { Candidatura, Urgencia } from '@/types'
import { CUIDADO_FRASE, GRAU_LABEL } from '@/lib/labels'
import { dataLocal, euro } from '@/lib/format'
import { contactoVisivel, diasAteAlta, faixaEtaria, origemDe } from '@/lib/negocio'
import { minuscula, nomeQuarto } from '../lib/derive'
import { capitalizar } from './ui'

/** Urgência em texto simples — só a imediata é destacada. */
export const URGENCIA_CURTA: Record<Urgencia, string> = {
  imediata: 'Urgente — alta hospitalar',
  '1-3meses': 'Dentro de 1 a 3 meses',
  '3-6meses': 'Dentro de 3 a 6 meses',
  planeamento: 'A planear com tempo',
}

// ————————————————————————————————————————— privacidade em duas fases (RGPD art. 9.º)

/** Pedido novo ainda não aceite: o lar vê só o resumo anónimo (sem nome, contacto, notas nem mensagem). */
export const bloqueado = (c: Candidatura) => !contactoVisivel(c)

/** "Pessoa de 80–84 anos" — como se nomeia um pedido ainda não aceite. */
export const pessoaAnonima = (c: Candidatura) => `Pessoa de ${faixaEtaria(c.perfil.idade)} anos`

/** "Albano Teixeira, 83 anos" ou, antes de aceitar, "Pessoa de 80–84 anos". */
export const nomePedido = (c: Candidatura) => (bloqueado(c) ? pessoaAnonima(c) : `${c.perfil.nome}, ${c.perfil.idade} anos`)

/** Nome de quem fez o pedido sem a organização ("Marta Correia (Hospital …)" → "Marta Correia"). */
export const nomeContacto = (c: Candidatura) => c.contacto.nome.replace(/\s*\(.*\)\s*$/, '')

/** A quem se escreve na nota: o nome de quem fez o pedido ou, antes de aceitar, "quem fez o pedido". */
export const quemPediu = (c: Candidatura) => (bloqueado(c) ? 'quem fez o pedido' : nomeContacto(c))

/** "Encaminhado por Hospital … · Serviço Social" (encaminhamentos de profissionais) ou null. */
export const encaminhadoPor = (c: Candidatura) =>
  origemDe(c) === 'profissional' && c.encaminhamento ? `Encaminhado por ${c.encaminhamento.organizacao}` : null

/** "Alta em 4 dias" · "Alta amanhã" · "Alta hoje" · "Alta prevista: 2 de outubro" (já passou). */
export function altaTexto(altaPrevista: string | undefined, agora = Date.now()): { texto: string; dias: number } | null {
  const d = diasAteAlta(altaPrevista, agora)
  if (d == null || !altaPrevista) return null
  if (d === 0) return { texto: 'Alta hoje', dias: d }
  if (d === 1) return { texto: 'Alta amanhã', dias: d }
  if (d > 1) return { texto: `Alta em ${d} dias`, dias: d }
  return { texto: `Alta prevista: ${diaCurto(altaPrevista, agora)}`, dias: d }
}

/** "2 de outubro" (com o ano, se não for o ano corrente) a partir de "AAAA-MM-DD". */
export function diaCurto(ymd: string, agora = Date.now()): string {
  const d = dataLocal(ymd)
  const outroAno = d.getFullYear() !== new Date(agora).getFullYear()
  return d.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', ...(outroAno ? { year: 'numeric' } : {}) })
}

/** "Pai de Rui Sousa" — relação do perfil com quem fez o pedido. */
export function relacaoTexto(c: Candidatura): string {
  if (bloqueado(c)) return encaminhadoPor(c) ?? 'Pedido de uma família'
  if (origemDe(c) === 'profissional') return `Pedido feito por ${nomeContacto(c)}`
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
