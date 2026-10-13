/**
 * Aritmética do IVA, exata ao cêntimo e só com inteiros (cêntimos).
 *
 * - B2B (lares): o valor é líquido; o IVA de cada linha é round(líquido × taxa), arredondado por linha
 *   (meio cêntimo para cima, como Math.round e como round() do Postgres em numeric para valores positivos).
 * - B2C (famílias): o preço inclui IVA. Separa-se o bruto em líquido + IVA de forma a que
 *   líquido + round(líquido × taxa) == bruto, que é o que o Moloni volta a calcular a partir do líquido.
 *
 * f(n) = n + round(n × taxa) é estritamente crescente (cada passo soma 1 ou 2 cêntimos), por isso para cada
 * bruto há no máximo um líquido. Há brutos sem solução (quando f salta 2): por exemplo 1490 a 16 %
 * (f(1284) = 1489, f(1285) = 1491). Nesses casos separarIvaIncluido devolve null e quem vende tem de
 * escolher outro preço ou outra taxa — nunca se arredonda "à mão".
 */

export type TaxaIva = 23 | 22 | 16
export const TAXAS_IVA: readonly TaxaIva[] = [23, 22, 16]

export const eTaxaIva = (v: unknown): v is TaxaIva => v === 23 || v === 22 || v === 16

function assegurarInteiro(n: number, nome: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${nome} tem de ser um número inteiro de cêntimos.`)
}

/** round(base × pct / 100), meio cêntimo afastado de zero, só com inteiros. */
export function ivaCentimos(baseCentimos: number, pct: number): number {
  assegurarInteiro(baseCentimos, 'O valor')
  assegurarInteiro(pct, 'A taxa')
  const produto = Math.abs(baseCentimos) * pct
  const arredondado = Math.floor((2 * produto + 100) / 200)
  return baseCentimos < 0 ? -arredondado : arredondado
}

export interface LinhaValores {
  liquidoCentimos: number
  ivaPercent: TaxaIva
  ivaCentimos: number
  totalCentimos: number
}

/** B2B: líquido + IVA da linha. */
export function linhaLiquida(liquidoCentimos: number, ivaPercent: TaxaIva): LinhaValores {
  const iva = ivaCentimos(liquidoCentimos, ivaPercent)
  return { liquidoCentimos, ivaPercent, ivaCentimos: iva, totalCentimos: liquidoCentimos + iva }
}

/**
 * B2C: separa um preço com IVA incluído. Devolve null se não existir líquido inteiro n com
 * n + round(n × taxa) == bruto (ver o cabeçalho).
 */
export function separarIvaIncluido(brutoCentimos: number, ivaPercent: TaxaIva): LinhaValores | null {
  assegurarInteiro(brutoCentimos, 'O preço')
  if (brutoCentimos < 0) return null
  const estimativa = Math.round((brutoCentimos * 100) / (100 + ivaPercent))
  for (let n = Math.max(0, estimativa - 2); n <= estimativa + 2; n++) {
    const iva = ivaCentimos(n, ivaPercent)
    if (n + iva === brutoCentimos) return { liquidoCentimos: n, ivaPercent, ivaCentimos: iva, totalCentimos: brutoCentimos }
  }
  return null
}

export class ErroIvaInexato extends Error {
  constructor(readonly brutoCentimos: number, readonly ivaPercent: number) {
    super(`O preço ${centimosParaDecimal(brutoCentimos)} € não se separa em líquido + IVA ${ivaPercent} % ao cêntimo.`)
    this.name = 'ErroIvaInexato'
  }
}

export function separarIvaIncluidoOuFalhar(brutoCentimos: number, ivaPercent: TaxaIva): LinhaValores {
  const r = separarIvaIncluido(brutoCentimos, ivaPercent)
  if (!r) throw new ErroIvaInexato(brutoCentimos, ivaPercent)
  return r
}

export interface TotaisDocumento {
  subtotalCentimos: number
  ivaCentimos: number
  totalCentimos: number
  /** base e IVA por taxa (ordem decrescente de taxa) — um item de IVA por taxa no Stripe */
  porTaxa: { ivaPercent: TaxaIva; baseCentimos: number; ivaCentimos: number }[]
}

/** Soma de linhas já arredondadas (o IVA é sempre por linha). */
export function totaisDocumento(linhas: readonly LinhaValores[]): TotaisDocumento {
  const porTaxa = new Map<TaxaIva, { baseCentimos: number; ivaCentimos: number }>()
  let subtotal = 0
  let iva = 0
  for (const l of linhas) {
    subtotal += l.liquidoCentimos
    iva += l.ivaCentimos
    const t = porTaxa.get(l.ivaPercent) ?? { baseCentimos: 0, ivaCentimos: 0 }
    t.baseCentimos += l.liquidoCentimos
    t.ivaCentimos += l.ivaCentimos
    porTaxa.set(l.ivaPercent, t)
  }
  return {
    subtotalCentimos: subtotal,
    ivaCentimos: iva,
    totalCentimos: subtotal + iva,
    porTaxa: [...porTaxa.entries()].sort((a, b) => b[0] - a[0]).map(([ivaPercent, v]) => ({ ivaPercent, ...v })),
  }
}

/** 1211 → '12.11' (formato decimal das APIs). */
export function centimosParaDecimal(c: number): string {
  assegurarInteiro(c, 'O valor')
  const sinal = c < 0 ? '-' : ''
  const a = Math.abs(c)
  return `${sinal}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`
}

/** '12.11' | 12.11 | '12,11' → 1211. Lança se tiver mais de 2 casas decimais significativas. */
export function decimalParaCentimos(v: string | number): number {
  const s = (typeof v === 'number' ? v.toFixed(6) : v).trim().replace(',', '.')
  const m = /^(-?)(\d+)(?:\.(\d+))?$/.exec(s)
  if (!m) throw new RangeError('Valor decimal inválido.')
  const decimais = (m[3] ?? '').replace(/0+$/, '')
  if (decimais.length > 2) throw new RangeError('Valor com mais de 2 casas decimais.')
  const c = Number(m[2]) * 100 + Number(decimais.padEnd(2, '0'))
  return m[1] === '-' ? -c : c
}

/** "14,90 €" (só para mensagens; o formato pt-PT com espaço fino é feito à mão para não depender do ICU). */
export function euros(c: number): string {
  return `${centimosParaDecimal(c).replace('.', ',')} €`
}
