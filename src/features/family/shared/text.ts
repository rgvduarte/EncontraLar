/**
 * Pequenas ajudas de linguagem para o painel da família (PT-PT): nomes, artigos, datas locais.
 */
import type { PerfilIdoso } from '@/types'
import { dataLocal, isoDia } from '@/lib/format'

const PARTICULAS = new Set(['de', 'do', 'da', 'dos', 'das'])

/** "Maria do Carmo Ferreira" → "Maria do Carmo"; "Joaquim Sousa" → "Joaquim". */
export function nomeCurto(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (p.length >= 3 && PARTICULAS.has(p[1]!.toLowerCase())) return p.slice(0, 3).join(' ')
  return p[0] ?? nome
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome

type ComGenero = Pick<PerfilIdoso, 'nome' | 'genero'>

/** "a Maria do Carmo", "o Joaquim" ou só o nome quando o género não foi indicado. */
export function comArtigo(p: ComGenero): string {
  const n = nomeCurto(p.nome)
  return p.genero === 'F' ? `a ${n}` : p.genero === 'M' ? `o ${n}` : n
}

/** "da Maria do Carmo", "do Joaquim", "de Alex". */
export function deNome(p: ComGenero): string {
  const n = nomeCurto(p.nome)
  return p.genero === 'F' ? `da ${n}` : p.genero === 'M' ? `do ${n}` : `de ${n}`
}

/** "para a Maria do Carmo". */
export const paraNome = (p: ComGenero) => `para ${comArtigo(p)}`

export function saudacao(d = new Date()): string {
  const h = d.getHours()
  if (h >= 5 && h < 12) return 'Bom dia'
  if (h >= 12 && h < 20) return 'Boa tarde'
  return 'Boa noite'
}

// datas "AAAA-MM-DD" das visitas: sempre no fuso local (a mesma função das notificações)
export { dataLocal, isoDia }

export function amanhaISO(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return isoDia(d)
}

/** Diferença em dias de calendário (0 = hoje). */
export function diasAte(alvo: Date, agora = new Date()): number {
  const a = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime()
  const b = new Date(alvo.getFullYear(), alvo.getMonth(), alvo.getDate()).getTime()
  return Math.round((b - a) / 86_400_000)
}

/** "hoje", "amanhã", "daqui a 5 dias", "há 2 dias". */
export function quando(alvo: Date, agora = new Date()): string {
  const d = diasAte(alvo, agora)
  if (d === 0) return 'hoje'
  if (d === 1) return 'amanhã'
  if (d > 1) return `daqui a ${d} dias`
  if (d === -1) return 'ontem'
  return `há ${-d} dias`
}

/** "sábado, 17 de outubro" */
export const diaPorExtenso = (d: Date) => d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })

/** "sábado, 17 de outubro, às 11:00" */
export const visitaPorExtenso = (data: string, hora: string) => `${diaPorExtenso(dataLocal(data, hora))}, às ${hora}`

/** "19 set." */
export const diaCurto = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })

/** "19 set. 2026, 14:05" */
export const diaHora = (iso: string) =>
  new Date(iso).toLocaleString('pt-PT', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export const ordinal = (n: number) => `${n}.º`

/** Telefone para href tel: */
export const telHref = (t: string) => `tel:${t.replace(/[^\d+]/g, '')}`

/** Artigo definido com espaço ("a ", "o ") ou vazio quando o género não foi indicado. */
export const artigo = (p: Pick<PerfilIdoso, 'genero'>) => (p.genero === 'F' ? 'a ' : p.genero === 'M' ? 'o ' : '')

/** Concordância de género: g(p, 'avisada', 'avisado') → "avisado(a)" se não indicado. */
export function g(p: Pick<PerfilIdoso, 'genero'>, fem: string, masc: string): string {
  if (p.genero === 'F') return fem
  if (p.genero === 'M') return masc
  return `${masc}(${fem.slice(-1)})`
}

/** Preposição contraída: "da", "do" ou "de". */
export const prepDe = (p: Pick<PerfilIdoso, 'genero'>) => (p.genero === 'F' ? 'da' : p.genero === 'M' ? 'do' : 'de')
