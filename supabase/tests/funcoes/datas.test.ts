/**
 * Datas em Europe/Lisbon (faturacao/datas.ts) e paridade com o protótipo: compromissoAte (src/lib/acesso.ts)
 * e entradaAtribuida (src/lib/negocio.ts) correm no fuso do processo; aqui o processo corre em Lisboa (como o
 * browser das famílias e dos lares), e as funções do servidor dão o mesmo resultado em qualquer fuso.
 */
const TZ_ORIGINAL = process.env.TZ
process.env.TZ = 'Europe/Lisbon'

import { afterAll, describe, expect, it } from 'vitest'
import { compromissoAte as compromissoAteProto, podeMudarPlano } from '@/lib/acesso'
import { entradaAtribuida } from '@/lib/negocio'
import {
  compromissoAte,
  dataCurta,
  dataLonga,
  deLisboa,
  dentroDaJanela,
  diaLisboa,
  fimContestacao,
  inicioDoDiaLisboa,
  mesPorExtenso,
  partesLisboa,
  periodoDe,
  proximoDiaUm,
  somarDiasData,
  somarDiasLisboa,
} from '../../functions/_shared/faturacao/datas.ts'

afterAll(() => {
  if (TZ_ORIGINAL === undefined) delete process.env.TZ
  else process.env.TZ = TZ_ORIGINAL
})

const H = 3_600_000
const DIA = 24 * H

describe('o processo de teste corre mesmo em Lisboa', () => {
  it('desvio de verão (+1 h) e de inverno (0 h)', () => {
    expect(new Date(2026, 6, 1).getTimezoneOffset()).toBe(-60)
    expect(new Date(2026, 0, 1).getTimezoneOffset()).toBe(0)
  })
})

describe('hora de parede em Lisboa', () => {
  it('partesLisboa no inverno e no verão', () => {
    expect(partesLisboa('2026-01-15T23:30:00Z')).toMatchObject({ ano: 2026, mes: 1, dia: 15, hora: 23, minuto: 30 })
    expect(partesLisboa('2026-07-15T23:30:00Z')).toMatchObject({ ano: 2026, mes: 7, dia: 16, hora: 0, minuto: 30 })
    expect(diaLisboa('2026-07-15T23:30:00Z')).toBe('2026-07-16')
  })

  it('deLisboa: hora que não existe (29/03/2026 01:30) avança uma hora, como o Date', () => {
    const t = deLisboa(2026, 3, 29, 1, 30)
    expect(new Date(t).toISOString()).toBe('2026-03-29T01:30:00.000Z') // = 02:30 WEST
    expect(t).toBe(new Date(2026, 2, 29, 1, 30).getTime())
  })

  it('deLisboa: hora repetida (25/10/2026 01:30) escolhe a primeira, como o Date', () => {
    const t = deLisboa(2026, 10, 25, 1, 30)
    expect(new Date(t).toISOString()).toBe('2026-10-25T00:30:00.000Z') // 01:30 WEST
    expect(t).toBe(new Date(2026, 9, 25, 1, 30).getTime())
  })

  it('deLisboa coincide com o construtor local do Date em 2000 instantes aleatórios', () => {
    let s = 42
    const r = (m: number) => (s = (s * 1103515245 + 12345) % 2 ** 31) % m
    for (let k = 0; k < 2000; k++) {
      const a = 2024 + r(5)
      const m = r(12) + 1
      const d = r(31) + 1
      const h = r(24)
      const mi = r(60)
      expect(deLisboa(a, m, d, h, mi)).toBe(new Date(a, m - 1, d, h, mi).getTime())
    }
  })
})

describe('prazo de contestação: 14 dias à mesma hora de Lisboa', () => {
  it('sem mudança de hora: exatamente 14 × 24 h', () => {
    expect(fimContestacao('2026-06-01T09:00:00.000Z')).toBe('2026-06-15T09:00:00.000Z')
  })

  it('atravessa o fim da hora de verão (25/10): 14 × 24 h + 1 h', () => {
    const fim = fimContestacao('2026-10-20T10:00:00.000Z') // 11:00 WEST
    expect(fim).toBe('2026-11-03T11:00:00.000Z') // 11:00 WET
    expect(Date.parse(fim) - Date.parse('2026-10-20T10:00:00.000Z')).toBe(14 * DIA + H)
  })

  it('atravessa o início da hora de verão (29/03): 14 × 24 h − 1 h', () => {
    const fim = fimContestacao('2026-03-20T10:00:00.000Z') // 10:00 WET
    expect(fim).toBe('2026-04-03T09:00:00.000Z') // 10:00 WEST
  })

  it('somarDiasLisboa mantém a hora de parede', () => {
    const antes = partesLisboa('2026-10-20T22:30:00.000Z') // 23:30 WEST
    const p = partesLisboa(somarDiasLisboa('2026-10-20T22:30:00.000Z', 14))
    expect(antes).toMatchObject({ dia: 20, hora: 23, minuto: 30 })
    expect(p).toMatchObject({ dia: 3, mes: 11, hora: 23, minuto: 30 }) // 23:30 WET
  })
})

describe('janela de atribuição de 12 meses = entradaAtribuida() do protótipo', () => {
  it('o dia do pedido + 365 dias ainda conta; o dia seguinte já não', () => {
    expect(dentroDaJanela('2025-10-13T15:00:00.000Z', '2026-10-13')).toBe(true)
    expect(dentroDaJanela('2025-10-13T15:00:00.000Z', '2026-10-14')).toBe(false)
    // ano bissexto no meio: 2027-03-01 + 365 dias = 2028-02-29
    expect(dentroDaJanela('2027-03-01T10:00:00.000Z', '2028-02-29')).toBe(true)
    expect(dentroDaJanela('2027-03-01T10:00:00.000Z', '2028-03-01')).toBe(false)
  })

  it('o dia do pedido é o de Lisboa (23:30 UTC no verão já é o dia seguinte)', () => {
    expect(dentroDaJanela('2025-07-15T23:30:00.000Z', '2026-07-16')).toBe(true)
  })

  it('coincide com entradaAtribuida em 3000 casos aleatórios, incluindo os limites', () => {
    let s = 11
    const r = (m: number) => (s = (s * 1103515245 + 12345) % 2 ** 31) % m
    const divergencias: string[] = []
    for (let k = 0; k < 3000; k++) {
      const criada = Date.UTC(2024, 0, 1) + r(900) * DIA + r(24 * 60) * 60_000
      const desvio = 360 + r(10) // à volta do limite
      const entrada = somarDiasData(diaLisboa(criada), desvio)
      const iso = new Date(criada).toISOString()
      if (dentroDaJanela(iso, entrada) !== entradaAtribuida({ criadaEm: iso, entrada: { data: entrada, taxa: 'aplicavel' } })) divergencias.push(`${iso} ${entrada}`)
    }
    expect(divergencias).toEqual([])
  })
})

describe('fim do compromisso de 12 meses = compromissoAte() do protótipo', () => {
  const lar = (planoDesde: string) => ({ natureza: 'privado' as const, planoInstituicao: 'mensal' as const, planoDesde })

  it('exemplos: mesmo dia e hora de Lisboa no ano seguinte; 29/02 passa a 01/03', () => {
    expect(compromissoAte('2026-10-13T09:00:00.000Z')).toBe('2027-10-13T09:00:00.000Z')
    expect(compromissoAte('2028-02-29T12:00:00.000Z')).toBe('2029-03-01T12:00:00.000Z')
    expect(compromissoAte('2028-02-29T12:00:00.000Z')).toBe(compromissoAteProto(lar('2028-02-29T12:00:00.000Z')))
  })

  it('coincide com compromissoAte() em 3000 instantes aleatórios (todas as horas, incluindo as das mudanças de hora)', () => {
    let s = 3
    const r = (m: number) => (s = (s * 1103515245 + 12345) % 2 ** 31) % m
    for (let k = 0; k < 3000; k++) {
      const t = Date.UTC(2024, 0, 1) + r(1500) * DIA + r(24 * 60) * 60_000 + r(60) * 1000
      const iso = new Date(t).toISOString()
      expect(compromissoAte(iso)).toBe(compromissoAteProto(lar(iso)))
    }
  })

  it('coincide nas horas das mudanças de hora (último domingo de março e de outubro)', () => {
    for (const base of ['2026-03-28', '2026-03-29', '2027-03-28', '2026-10-24', '2026-10-25', '2027-10-31', '2025-10-26']) {
      for (let m = -120; m <= 240; m += 15) {
        const iso = new Date(Date.parse(`${base}T00:00:00Z`) + m * 60_000).toISOString()
        expect(compromissoAte(iso)).toBe(compromissoAteProto(lar(iso)))
      }
    }
  })

  it('podeMudarPlano do protótipo concorda com a fronteira (um ms antes não, no instante sim)', () => {
    const desde = '2026-10-13T09:00:00.000Z'
    const ate = Date.parse(compromissoAte(desde))
    expect(podeMudarPlano(lar(desde), ate - 1)).toBe(false)
    expect(podeMudarPlano(lar(desde), ate)).toBe(true)
  })
})

describe('formatos', () => {
  it('datas curtas, longas e períodos', () => {
    expect(dataCurta('2026-09-30')).toBe('30/09/2026')
    expect(dataLonga('2027-10-13T09:00:00Z')).toBe('13 de outubro de 2027')
    expect(dataLonga('2026-12-31T23:30:00Z')).toBe('31 de dezembro de 2026') // inverno: ainda dia 31
    expect(dataLonga('2026-08-31T23:30:00Z')).toBe('1 de setembro de 2026') // verão: já dia 1
    expect(periodoDe('2026-10-31T23:30:00Z')).toBe('2026-10-01') // 23:30 WET (31/10 é inverno)
    expect(periodoDe('2026-09-30T23:30:00Z')).toBe('2026-10-01') // 00:30 WEST de 1/10
    expect(mesPorExtenso('2026-10-01')).toBe('outubro de 2026')
    expect(proximoDiaUm('2026-10-13T09:00:00Z')).toBe('2026-11-01T00:00:00.000Z')
    expect(proximoDiaUm('2026-09-13T09:00:00Z')).toBe('2026-09-30T23:00:00.000Z') // 1/10 00:00 WEST
    expect(inicioDoDiaLisboa('2026-11-01T07:07:00Z', 3)).toBe('2026-11-04T00:00:00.000Z')
    expect(somarDiasData('2026-12-30', 3)).toBe('2027-01-02')
    expect(() => dataCurta('30/09/2026')).toThrow(RangeError)
  })
})
