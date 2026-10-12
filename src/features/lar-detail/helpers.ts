/**
 * Utilitários da ficha da instituição (formatação, textos e derivações a partir do store).
 */
import { useMemo } from 'react'
import type { Lar, PerfilIdoso, RoomOffer, TipoQuarto } from '@/types'
import { disponibilidade, estimarEspera, previsaoMensal, vagasLivres, type EstimativaEspera } from '@/lib/forecast'
import { euro, intervaloMeses, num } from '@/lib/format'
import { GRAU_LABEL, QUARTO_CURTO } from '@/lib/labels'

// ————————————————————————————————————————— nome

const PREFIXOS = [
  'Casa de Repouso',
  'Lar Residencial',
  'Residência Sénior',
  'Centro Social',
  'Centro de Dia',
  'Residências',
  'Residência',
  'Casa',
  'Lar',
]

/**
 * "Casa de Repouso Jardins do Douro" → { prefixo: "Casa de Repouso", nucleo: "Jardins do Douro" }.
 * Só divide quando o resto é um nome próprio ("Lar das Hortênsias" fica inteiro).
 */
export function dividirNome(nome: string): { prefixo: string | null; nucleo: string } {
  for (const p of PREFIXOS) {
    const resto = nome.slice(p.length + 1)
    if (nome.startsWith(`${p} `) && resto.length > 3 && /^\p{Lu}/u.test(resto)) return { prefixo: p, nucleo: resto }
  }
  return { prefixo: null, nucleo: nome }
}

// ————————————————————————————————————————— secções

export const SECOES = [
  { id: 'ficha-sobre', label: 'Sobre' },
  { id: 'ficha-cuidados', label: 'Cuidados' },
  { id: 'ficha-precos', label: 'Preços' },
  { id: 'ficha-previsao', label: 'Previsão' },
  { id: 'ficha-transparencia', label: 'Transparência' },
  { id: 'ficha-avaliacoes', label: 'Avaliações' },
  { id: 'ficha-localizacao', label: 'Localização' },
] as const

export type SecaoId = (typeof SECOES)[number]['id']

export const prefereMenosMovimento = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ————————————————————————————————————————— frescura das vagas

export type Frescura = 'recente' | 'normal' | 'antiga'

export function frescura(iso: string, agora = Date.now()): Frescura {
  const dias = (agora - new Date(iso).getTime()) / 86_400_000
  return dias <= 7 ? 'recente' : dias <= 30 ? 'normal' : 'antiga'
}

// ————————————————————————————————————————— preços

export const semPreco = (q: Pick<RoomOffer, 'precoMin' | 'precoMax'>) => q.precoMin <= 0 && q.precoMax <= 0

/** "1550–2200 €" · "1850 €" · "Sob consulta" */
export function intervaloPreco(min: number, max: number): string {
  if (min <= 0 && max <= 0) return 'Sob consulta'
  if (max <= min) return euro(min)
  return `${num(min)}–${euro(max)}`
}

export const precoSocial = (lar: Pick<Lar, 'natureza'>) => lar.natureza !== 'privado'

/** Preço mais baixo anunciado (ignora quartos sem preço). */
export function precoDesde(lar: Lar): number | null {
  const precos = lar.quartos.filter((q) => !semPreco(q)).map((q) => q.precoMin)
  if (precos.length) return Math.min(...precos)
  return lar.mensalidadeMin > 0 ? lar.mensalidadeMin : null
}

export const QUARTO_TABELA: Record<TipoQuarto, string> = {
  individual: 'Individual',
  duplo: 'Duplo (partilhado)',
  casal: 'Casal',
}

// ————————————————————————————————————————— previsão

/** "2 a 7 meses", "mais de 2 anos", "sem espera" — espera estimada a partir da estimativa. */
export function esperaEstimada(est: EstimativaEspera): string {
  if (est.imediata) return 'sem espera'
  if (est.diasOtimista == null) return 'mais de 2 anos'
  const fim = est.diasPessimista ?? 24 * 31
  // intervalos curtos: evita "menos de 1 a 1 mês"
  if (Math.round(fim / 30) <= 1) return fim < 30 ? 'menos de 1 mês' : 'cerca de 1 mês'
  return intervaloMeses(est.diasOtimista, fim)
}

/** Preço para cartões e barras: "desde 1550 €" (privado) ou "450–1100 €" (IPSS/Misericórdia). */
export function precoResumo(lar: Lar): { valor: string; desde: boolean } | null {
  if (precoSocial(lar)) {
    const com = lar.quartos.filter((q) => !semPreco(q))
    const min = com.length ? Math.min(...com.map((q) => q.precoMin)) : lar.mensalidadeMin
    const max = com.length ? Math.max(...com.map((q) => q.precoMax)) : lar.mensalidadeMax
    if (min <= 0 && max <= 0) return null
    return { valor: intervaloPreco(min, max), desde: false }
  }
  const d = precoDesde(lar)
  return d == null ? null : { valor: euro(d), desde: true }
}

export interface DadosLar {
  est: EstimativaEspera
  disp: ReturnType<typeof disponibilidade>
  livres: number
  previsao: ReturnType<typeof previsaoMensal>
  centroDia: boolean
  /** palavra para os lugares: "vaga"/"lugar" */
  unidade: { um: string; varios: string }
}

export function useDadosLar(lar: Lar): DadosLar {
  return useMemo(() => {
    const est = estimarEspera(lar)
    const centroDia = lar.tipo === 'centro_dia'
    return {
      est,
      disp: disponibilidade(lar, est),
      livres: vagasLivres(lar),
      previsao: previsaoMensal(lar, 12),
      centroDia,
      unidade: centroDia ? { um: 'lugar', varios: 'lugares' } : { um: 'vaga', varios: 'vagas' },
    }
  }, [lar])
}

// ————————————————————————————————————————— pedido: mensagem e visita

const POSSESSIVO: Record<string, string> = {
  Mãe: 'a minha mãe',
  Pai: 'o meu pai',
  Avó: 'a minha avó',
  Avô: 'o meu avô',
  Sogra: 'a minha sogra',
  Sogro: 'o meu sogro',
  Tia: 'a minha tia',
  Tio: 'o meu tio',
  Cônjuge: 'o meu cônjuge',
  'Outro familiar': 'um familiar',
}

export function generoDaRelacao(relacao: string): 'F' | 'M' | undefined {
  if (['Mãe', 'Avó', 'Sogra', 'Tia'].includes(relacao)) return 'F'
  if (['Pai', 'Avô', 'Sogro', 'Tio'].includes(relacao)) return 'M'
  return undefined
}

const URGENCIA_FRASE: Record<PerfilIdoso['urgencia'], string> = {
  imediata: 'A situação é urgente: precisamos de uma solução o mais depressa possível.',
  '1-3meses': 'Procuramos uma vaga para os próximos 1 a 3 meses.',
  '3-6meses': 'Procuramos uma vaga dentro de 3 a 6 meses.',
  planeamento: 'Ainda estamos a planear com tempo, mas gostaríamos de conhecer a instituição.',
}

/** Mensagem inicial sugerida à instituição — a família pode editá-la. */
export function mensagemSugerida(perfil: PerfilIdoso, lar: Lar, remetente: string): string {
  const proprio = perfil.relacao === 'Eu próprio(a)'
  const amigo = perfil.relacao === 'Amigo(a)'
  const fem = perfil.genero === 'F'
  const autonomo = perfil.grau === 'autonomo'
  const estado = autonomo
    ? fem ? 'autónoma' : perfil.genero === 'M' ? 'autónomo' : 'autónomo(a)'
    : `com ${GRAU_LABEL[perfil.grau].toLowerCase()}`
  const quarto = perfil.quarto !== 'indiferente' && lar.tipo !== 'centro_dia' ? ` em quarto ${QUARTO_CURTO[perfil.quarto].toLowerCase()}` : ''
  const linhas: string[] = ['Bom dia,', '']
  if (proprio) {
    linhas.push(`Escrevo para pedir uma vaga para mim. Tenho ${perfil.idade} anos e sou ${autonomo ? estado : `uma pessoa ${estado}`}.`)
  } else {
    const quem = amigo ? (fem ? 'uma amiga' : perfil.genero === 'M' ? 'um amigo' : 'um(a) amigo(a)') : (POSSESSIVO[perfil.relacao] ?? 'um familiar')
    linhas.push(`Escrevo a propósito de ${quem}, ${perfil.nome}, de ${perfil.idade} anos, ${estado}.`)
  }
  linhas.push(URGENCIA_FRASE[perfil.urgencia])
  linhas.push(`Gostaria de saber se há possibilidade de vaga${quarto} e quais são os próximos passos.`)
  linhas.push('', 'Com os melhores cumprimentos,', remetente)
  return linhas.join('\n')
}

const pad = (n: number) => String(n).padStart(2, '0')
export const isoLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function amanhaISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return isoLocal(d)
}

/** 10:00, 10:30, …, 17:30 */
export const HORAS_VISITA = Array.from({ length: 16 }, (_, i) => `${pad(10 + Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`)

/** "terça-feira, 14 de outubro" a partir de "2026-10-14" (sem desvios de fuso horário). */
export function diaPorExtenso(dataISO: string): string {
  const [a, m, d] = dataISO.split('-').map(Number)
  if (!a || !m || !d) return ''
  return new Date(a, m - 1, d).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })
}

export const fimDeSemana = (dataISO: string) => {
  const [a, m, d] = dataISO.split('-').map(Number)
  if (!a || !m || !d) return false
  const w = new Date(a, m - 1, d).getDay()
  return w === 0 || w === 6
}

export const telHref = (tel: string) => `tel:+351${tel.replace(/\D/g, '')}`
