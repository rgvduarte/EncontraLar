const euroFmt = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const numFmt = new Intl.NumberFormat('pt-PT')
const pctFmt = new Intl.NumberFormat('pt-PT', { style: 'percent', maximumFractionDigits: 0 })

/** 1450 → "1450 €" (pt-PT). Usa espaço inseparável antes do símbolo. */
export const euro = (v: number) => euroFmt.format(Math.round(v))
export const num = (v: number) => numFmt.format(v)
export const pct = (v: number) => pctFmt.format(v)

/** distância com espaço inseparável ("15\u00a0km" não parte entre linhas) */
export const km = (v: number) =>
  v < 1 ? `${Math.round(v * 1000)}\u00a0m` : `${v.toLocaleString('pt-PT', { maximumFractionDigits: v < 10 ? 1 : 0 })}\u00a0km`

/** "12 de outubro de 2026" */
export const dataLonga = (iso: string) =>
  new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })

/** "12/10/2026" */
export const dataCurta = (iso: string) => new Date(iso).toLocaleDateString('pt-PT')

/** "out. 2026" */
export const mesAno = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { month: 'short', year: 'numeric' })

/** "há 3 dias", "hoje", "há 2 meses" */
export function tempoRelativo(iso: string, agora = new Date()): string {
  const diffMs = agora.getTime() - new Date(iso).getTime()
  const min = Math.round(diffMs / 60000)
  if (min < 1) return 'agora mesmo'
  if (min < 60) return `há ${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `há ${h} ${h === 1 ? 'hora' : 'horas'}`
  const d = Math.round(h / 24)
  if (d === 1) return 'ontem'
  if (d < 30) return `há ${d} dias`
  const m = Math.round(d / 30)
  if (m < 12) return `há ${m} ${m === 1 ? 'mês' : 'meses'}`
  const a = Math.round(m / 12)
  return `há ${a} ${a === 1 ? 'ano' : 'anos'}`
}

/** plural(3, 'vaga', 'vagas') → "3 vagas" */
export const plural = (n: number, um: string, varios: string) => `${numFmt.format(n)} ${n === 1 ? um : varios}`

/** Descrição humana de uma duração em dias: "cerca de 3 semanas", "4 a 6 meses"… */
export function duracaoHumana(dias: number): string {
  if (dias <= 10) return 'poucos dias'
  if (dias < 45) return `cerca de ${Math.max(2, Math.round(dias / 7))} semanas`
  const meses = Math.round(dias / 30)
  if (meses < 24) return `cerca de ${meses} ${meses === 1 ? 'mês' : 'meses'}`
  return 'mais de 2 anos'
}

export function intervaloMeses(diasMin: number, diasMax: number): string {
  const a = Math.max(0, Math.round(diasMin / 30))
  const b = Math.max(a + 1, Math.round(diasMax / 30))
  if (b > 24) return a < 1 ? 'menos de 1 mês a mais de 2 anos' : `${a} meses a mais de 2 anos`
  if (a < 1) return `menos de 1 a ${b} ${b === 1 ? 'mês' : 'meses'}`
  return `${a} a ${b} meses`
}

export const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => p.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(p))
    .map((p) => p[0]!.toUpperCase())
    .slice(0, 2)
    .join('')

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const
export const MESES_LONGOS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
] as const
