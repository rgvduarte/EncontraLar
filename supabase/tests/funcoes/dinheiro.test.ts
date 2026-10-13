/**
 * IVA exato ao cêntimo (faturacao/dinheiro.ts). B2B: líquido + IVA por linha. B2C: o preço inclui IVA e
 * separa-se em líquido + IVA com líquido + round(líquido × taxa) == preço.
 */
import { describe, expect, it } from 'vitest'
import {
  centimosParaDecimal,
  decimalParaCentimos,
  ErroIvaInexato,
  euros,
  ivaCentimos,
  linhaLiquida,
  separarIvaIncluido,
  separarIvaIncluidoOuFalhar,
  TAXAS_IVA,
  totaisDocumento,
  type TaxaIva,
} from '../../functions/_shared/faturacao/dinheiro.ts'

/** f(n) = n + round(n × taxa): o que o Moloni recalcula a partir do líquido. */
const f = (n: number, pct: TaxaIva) => n + Math.round((n * pct) / 100)

describe('ivaCentimos (B2B, por linha)', () => {
  it('arredonda ao cêntimo, meio cêntimo para cima, igual a Math.round', () => {
    expect(ivaCentimos(15000, 23)).toBe(3450)
    expect(ivaCentimos(2900, 23)).toBe(667)
    expect(ivaCentimos(2900, 22)).toBe(638)
    expect(ivaCentimos(2900, 16)).toBe(464)
    expect(ivaCentimos(50, 23)).toBe(12) // 11,5 → 12
    expect(ivaCentimos(150, 23)).toBe(35) // 34,5 → 35
    for (let n = 0; n <= 20000; n += 7) for (const t of TAXAS_IVA) expect(ivaCentimos(n, t)).toBe(Math.round((n * t) / 100))
  })

  it('é simétrico para valores negativos (notas de crédito)', () => {
    expect(ivaCentimos(-15000, 23)).toBe(-3450)
    expect(ivaCentimos(-50, 23)).toBe(-12)
  })

  it('recusa valores que não são cêntimos inteiros', () => {
    expect(() => ivaCentimos(12.5, 23)).toThrow(RangeError)
    expect(() => ivaCentimos(Number.NaN, 23)).toThrow(RangeError)
  })

  it('linhaLiquida e totais: taxa de entrada 150 € e mensalidade 29 €', () => {
    expect(linhaLiquida(15000, 23)).toEqual({ liquidoCentimos: 15000, ivaPercent: 23, ivaCentimos: 3450, totalCentimos: 18450 })
    const t = totaisDocumento([linhaLiquida(15000, 23), linhaLiquida(15000, 23), linhaLiquida(2900, 16)])
    expect(t).toEqual({
      subtotalCentimos: 32900,
      ivaCentimos: 7364,
      totalCentimos: 40264,
      porTaxa: [
        { ivaPercent: 23, baseCentimos: 30000, ivaCentimos: 6900 },
        { ivaPercent: 16, baseCentimos: 2900, ivaCentimos: 464 },
      ],
    })
  })
})

describe('separarIvaIncluido (B2C, preço com IVA)', () => {
  // A prova pedida: 1490 e 2990 a 23 / 22 / 16 %.
  const esperados: [number, TaxaIva, number, number][] = [
    [1490, 23, 1211, 279],
    [2990, 23, 2431, 559],
    [1490, 22, 1221, 269],
    [2990, 22, 2451, 539],
    [2990, 16, 2578, 412],
  ]
  it.each(esperados)('%i a %i %%: líquido %i + IVA %i, e líquido + round(líquido × taxa) == preço', (bruto, pct, liquido, iva) => {
    const r = separarIvaIncluido(bruto, pct)!
    expect(r).toEqual({ liquidoCentimos: liquido, ivaPercent: pct, ivaCentimos: iva, totalCentimos: bruto })
    expect(r.liquidoCentimos + ivaCentimos(r.liquidoCentimos, pct)).toBe(bruto)
    expect(f(r.liquidoCentimos, pct)).toBe(bruto)
  })

  it('1490 a 16 % NÃO tem separação exata: prova exaustiva (f salta de 1489 para 1491)', () => {
    expect(f(1284, 16)).toBe(1489)
    expect(f(1285, 16)).toBe(1491)
    for (let n = 0; n <= 1490; n++) expect(f(n, 16)).not.toBe(1490)
    expect(separarIvaIncluido(1490, 16)).toBeNull()
    expect(() => separarIvaIncluidoOuFalhar(1490, 16)).toThrow(ErroIvaInexato)
    expect(() => separarIvaIncluidoOuFalhar(1490, 16)).toThrow('14.90 €')
  })

  it('f é estritamente crescente: há no máximo um líquido por preço (a solução, se existe, é única)', () => {
    for (const t of TAXAS_IVA) {
      for (let n = 0; n < 10000; n++) {
        const passo = f(n + 1, t) - f(n, t)
        expect(passo === 1 || passo === 2).toBe(true)
      }
    }
  })

  it('para todos os preços até 100 €, devolve a solução quando existe e null quando não existe', () => {
    for (const t of TAXAS_IVA) {
      const alcancaveis = new Map<number, number>()
      for (let n = 0; n <= 10000; n++) alcancaveis.set(f(n, t), n)
      for (let bruto = 0; bruto <= 10000; bruto++) {
        const r = separarIvaIncluido(bruto, t)
        const n = alcancaveis.get(bruto)
        if (n === undefined) expect(r).toBeNull()
        else expect(r?.liquidoCentimos).toBe(n)
      }
    }
  })

  it('a taxa usada hoje para as famílias (23 %) separa os dois passes', () => {
    expect(separarIvaIncluido(1490, 23)).not.toBeNull()
    expect(separarIvaIncluido(2990, 23)).not.toBeNull()
  })
})

describe('formatos decimais', () => {
  it('cêntimos ↔ decimal das APIs', () => {
    expect(centimosParaDecimal(1211)).toBe('12.11')
    expect(centimosParaDecimal(5)).toBe('0.05')
    expect(centimosParaDecimal(-3450)).toBe('-34.50')
    expect(decimalParaCentimos('12.11')).toBe(1211)
    expect(decimalParaCentimos(14.9)).toBe(1490)
    expect(decimalParaCentimos('184,5')).toBe(18450)
    expect(decimalParaCentimos('29.900')).toBe(2990)
    expect(() => decimalParaCentimos('1.234')).toThrow(RangeError)
    expect(() => decimalParaCentimos('abc')).toThrow(RangeError)
    expect(euros(1490)).toBe('14,90 €')
  })
})
