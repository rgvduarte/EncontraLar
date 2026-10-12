import { describe, expect, it } from 'vitest'
import {
  disponibilidade,
  estimarEspera,
  poissonAtLeast,
  poissonQuantile,
  previsaoMensal,
  resumoPrevisao,
  SAZONALIDADE,
  vagaParaNovos,
} from './forecast'

const base = {
  capacidade: 40,
  quartos: [{ tipo: 'individual' as const, total: 40, livres: 0, precoMin: 1500, precoMax: 1800 }],
  estadiaMediaMeses: 30,
  historicoSaidas: [1, 2, 1, 1, 0, 1, 1, 2, 1, 1, 2, 2],
  listaEspera: 10,
}

describe('poisson', () => {
  it('P(N≥1) = 1 − e^−λ', () => {
    expect(poissonAtLeast(1, 1)).toBeCloseTo(1 - Math.exp(-1), 10)
    expect(poissonAtLeast(0, 3)).toBe(1)
    expect(poissonAtLeast(3, 0)).toBe(0)
  })
  it('quantis coerentes', () => {
    expect(poissonQuantile(0.5, 4)).toBe(4)
    expect(poissonQuantile(0.1, 0)).toBe(0)
  })
  it('sazonalidade tem média 1', () => {
    expect(SAZONALIDADE.reduce((a, b) => a + b, 0) / 12).toBeCloseTo(1, 10)
  })
})

describe('estimarEspera', () => {
  it('vaga imediata quando há lugares livres e lista curta', () => {
    const e = estimarEspera({ ...base, listaEspera: 1, quartos: [{ ...base.quartos[0]!, livres: 2 }] })
    expect(e.imediata).toBe(true)
    expect(e.p30).toBe(1)
    expect(disponibilidade({ ...base, quartos: [{ ...base.quartos[0]!, livres: 2 }] })).toBe('disponivel')
  })

  it('probabilidades crescem com o tempo e a curva é monótona', () => {
    const e = estimarEspera(base, { inicio: new Date(2026, 9, 12) })
    expect(e.imediata).toBe(false)
    expect(e.p30).toBeLessThan(e.p90)
    expect(e.p90).toBeLessThan(e.p180)
    expect(e.p180).toBeLessThan(e.p365)
    for (let i = 1; i < e.curva.length; i++) expect(e.curva[i]).toBeGreaterThanOrEqual(e.curva[i - 1]!)
    expect(e.diasOtimista!).toBeLessThanOrEqual(e.diasMediana!)
    expect(e.diasMediana!).toBeLessThanOrEqual(e.diasPessimista!)
  })

  it('lista maior → espera mais longa', () => {
    const curta = estimarEspera({ ...base, listaEspera: 3 })
    const longa = estimarEspera({ ...base, listaEspera: 80 })
    expect(longa.diasMediana ?? Infinity).toBeGreaterThan(curta.diasMediana!)
    expect(disponibilidade({ ...base, listaEspera: 120 })).toBe('espera')
  })

  it('posição na lista conta em vez do tamanho total', () => {
    const primeiro = estimarEspera({ ...base, listaEspera: 60 }, { posicao: 1 })
    const ultimo = estimarEspera({ ...base, listaEspera: 60 })
    expect(primeiro.diasMediana!).toBeLessThan(ultimo.diasMediana ?? Infinity)
  })
})

describe('previsaoMensal', () => {
  it('12 meses com intervalo que contém a média', () => {
    const p = previsaoMensal(base, 12, new Date(2026, 9, 1))
    expect(p).toHaveLength(12)
    expect(p[0]!.mes).toBe(9)
    expect(p[3]!.ano).toBe(2027)
    for (const m of p) {
      expect(m.min).toBeLessThanOrEqual(Math.ceil(m.esperado))
      expect(m.max).toBeGreaterThanOrEqual(Math.floor(m.esperado))
    }
    // janeiro tem mais saídas do que junho
    const jan = p.find((m) => m.mes === 0)!
    const jun = p.find((m) => m.mes === 5)!
    expect(jan.esperado).toBeGreaterThan(jun.esperado)
  })
})

describe('vaga para quem pede hoje', () => {
  it('um lugar livre já prometido à lista de espera não é vaga para novos pedidos', () => {
    const lar = { ...base, listaEspera: 14, quartos: [{ ...base.quartos[0]!, livres: 1 }] }
    expect(disponibilidade(lar)).toBe('disponivel')
    expect(vagaParaNovos(lar)).toBe(false)
    expect(resumoPrevisao(lar)).toMatch(/^Espera estimada/)
  })
  it('com lista curta, há vaga agora', () => {
    const lar = { ...base, listaEspera: 1, quartos: [{ ...base.quartos[0]!, livres: 2 }] }
    expect(vagaParaNovos(lar)).toBe(true)
    expect(resumoPrevisao(lar)).toBe('2 vagas disponíveis agora')
  })
  it('a frase de resumo usa "Espera estimada", não "vaga provável"', () => {
    expect(resumoPrevisao(base)).toMatch(/^Espera estimada: (~\d+ (mês|meses)|poucas semanas|mais de 2 anos)$/)
  })
})
