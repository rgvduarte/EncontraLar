/**
 * Datas no calendário de Lisboa (Europe/Lisbon), independentes do fuso do processo (as Edge Functions correm
 * em UTC; os testes provam a igualdade com o protótipo a correr em Lisboa).
 *
 * - Prazo de contestação: 14 dias de calendário, à mesma hora de Lisboa, depois da confirmação da família.
 *   Em SQL: (familia_em at time zone 'Europe/Lisbon' + interval '14 days') at time zone 'Europe/Lisbon'.
 * - Janela de atribuição: a entrada (dia) até ao dia do pedido em Lisboa + 365 dias (inclusive), igual a
 *   entradaAtribuida() em src/lib/negocio.ts e a private.entradas_faturacao (v1).
 * - Fim do compromisso da mensalidade: plano_desde + 12 meses na hora de Lisboa, com a aritmética do
 *   Date#setMonth (29 de fevereiro → 1 de março), igual a compromissoAte() em src/lib/acesso.ts e a
 *   private.compromisso_ate em SQL.
 */
import { COMPROMISSO_MENSAL_MESES, JANELA_ATRIBUICAO_DIAS, PRAZO_CONTESTACAO_DIAS } from './planos.ts'

export const FUSO = 'Europe/Lisbon'
const DIA_MS = 86_400_000

const formato = new Intl.DateTimeFormat('en-GB', {
  timeZone: FUSO,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export interface PartesData {
  ano: number
  /** 1–12 */
  mes: number
  dia: number
  hora: number
  minuto: number
  segundo: number
  ms: number
}

function instante(v: string | number | Date): number {
  const t = typeof v === 'number' ? v : typeof v === 'string' ? Date.parse(v) : v.getTime()
  if (!Number.isFinite(t)) throw new RangeError('Data inválida.')
  return t
}

/** Hora de parede em Lisboa de um instante. */
export function partesLisboa(v: string | number | Date): PartesData {
  const t = instante(v)
  const p: Record<string, number> = {}
  for (const x of formato.formatToParts(new Date(t))) if (x.type !== 'literal') p[x.type] = Number(x.value)
  return { ano: p.year!, mes: p.month!, dia: p.day!, hora: p.hour!, minuto: p.minute!, segundo: p.second!, ms: ((t % 1000) + 1000) % 1000 }
}

/** Diferença (ms) entre a hora de Lisboa e UTC nesse instante: 0 (inverno) ou 3 600 000 (verão). */
function desvio(t: number): number {
  const p = partesLisboa(t)
  return Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo, p.ms) - t
}

/**
 * Instante (ms UTC) de uma hora de parede em Lisboa. Normaliza excessos como o Date (mês 13, 31 de
 * fevereiro…). Numa hora que não existe (salto de março) usa o desvio de antes da mudança (avança uma hora);
 * numa hora repetida (outubro) escolhe a primeira — as duas regras do Date local do ECMAScript.
 */
export function deLisboa(ano: number, mes: number, dia: number, hora = 0, minuto = 0, segundo = 0, ms = 0): number {
  const parede = Date.UTC(ano, mes - 1, dia, hora, minuto, segundo, ms)
  const antes = desvio(parede - 12 * 3_600_000)
  const depois = desvio(parede + 12 * 3_600_000)
  const candidatos = [...new Set([antes, depois])].map((d) => parede - d).filter((t) => t + desvio(t) === parede)
  if (candidatos.length) return Math.min(...candidatos)
  return parede - antes
}

const iso = (t: number) => new Date(t).toISOString()

/** 'AAAA-MM-DD' do dia em Lisboa. */
export function diaLisboa(v: string | number | Date): string {
  const p = partesLisboa(v)
  return `${p.ano}-${String(p.mes).padStart(2, '0')}-${String(p.dia).padStart(2, '0')}`
}

/** Soma dias de calendário mantendo a hora de Lisboa. */
export function somarDiasLisboa(v: string | number | Date, dias: number): string {
  const p = partesLisboa(v)
  return iso(deLisboa(p.ano, p.mes, p.dia + dias, p.hora, p.minuto, p.segundo, p.ms))
}

/** Soma meses mantendo a hora de Lisboa, com a aritmética do Date#setMonth. */
export function somarMesesLisboa(v: string | number | Date, meses: number): string {
  const p = partesLisboa(v)
  return iso(deLisboa(p.ano, p.mes + meses, p.dia, p.hora, p.minuto, p.segundo, p.ms))
}

const DATA = /^(\d{4})-(\d{2})-(\d{2})$/

function partesData(ymd: string): [number, number, number] {
  const m = DATA.exec(ymd)
  if (!m) throw new RangeError(`Data inválida: esperava AAAA-MM-DD.`)
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

/** 'AAAA-MM-DD' + n dias (calendário puro). */
export function somarDiasData(ymd: string, dias: number): string {
  const [a, m, d] = partesData(ymd)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

/** Fim do prazo de contestação (14 dias à mesma hora de Lisboa). */
export const fimContestacao = (familiaEm: string): string => somarDiasLisboa(familiaEm, PRAZO_CONTESTACAO_DIAS)

/** A entrada cai dentro da janela de atribuição de 12 meses a contar do pedido? */
export function dentroDaJanela(pedidoCriadoEm: string, entradaData: string): boolean {
  partesData(entradaData)
  return entradaData <= somarDiasData(diaLisboa(pedidoCriadoEm), JANELA_ATRIBUICAO_DIAS)
}

/** Fim do compromisso de 12 meses da mensalidade (ISO). */
export const compromissoAte = (planoDesde: string, meses = COMPROMISSO_MENSAL_MESES): string => somarMesesLisboa(planoDesde, meses)

/** '2026-10-13' → '13/10/2026' */
export function dataCurta(ymd: string): string {
  const [a, m, d] = partesData(ymd)
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** Instante → '13 de outubro de 2027' (dia de Lisboa), igual a private.data_longa em SQL. */
export function dataLonga(v: string | number | Date): string {
  const p = partesLisboa(v)
  return `${p.dia} de ${MESES[p.mes - 1]} de ${p.ano}`
}

/** Período de faturação (dia 1 do mês, em Lisboa): 'AAAA-MM-01'. */
export const periodoDe = (v: string | number | Date): string => `${diaLisboa(v).slice(0, 7)}-01`

/** 'AAAA-MM-01' → 'outubro de 2026' */
export function mesPorExtenso(periodo: string): string {
  const [a, m] = partesData(periodo)
  return `${MESES[m - 1]} de ${a}`
}

/** 00:00 de Lisboa do dia de `v` + `dias` (ISO). Ex.: débito SEPA = início do dia do fim do pré-aviso. */
export function inicioDoDiaLisboa(v: string | number | Date, dias = 0): string {
  const p = partesLisboa(v)
  return iso(deLisboa(p.ano, p.mes, p.dia + dias))
}

/** Dia 1 do mês seguinte em Lisboa, às 00:00 (ISO). */
export function proximoDiaUm(v: string | number | Date): string {
  const p = partesLisboa(v)
  return iso(deLisboa(p.ano, p.mes + 1, 1))
}

/** Segundos Unix (Stripe) → ISO; null/undefined → null. */
export const deSegundos = (s: number | null | undefined): string | null => (typeof s === 'number' ? iso(s * 1000) : null)

/** ISO/ms → segundos Unix (Stripe). */
export const paraSegundos = (v: string | number | Date): number => Math.floor(instante(v) / 1000)

/** Soma n×24 h (para prazos técnicos, ex.: expiração da sessão do Checkout). */
export const somarHoras = (v: string | number | Date, horas: number): string => iso(instante(v) + horas * 3_600_000)

export { DIA_MS }
