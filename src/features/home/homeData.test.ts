import { describe, expect, it } from 'vitest'
import type { Distrito, Lar } from '@/types'
import { createSeed } from '@/data/seed'
import { vagaParaNovos } from '@/lib/forecast'
import { contarComVaga, escolherHistoriaGratis, exemploCompatibilidade, MIN_AGREGADO, razoesGratis, vagasPorDistrito } from './homeData'
import { sugerir } from './search'

const lares = createSeed(Date.parse('2026-10-13T10:00:00Z')).lares
const residenciais = lares.filter((l) => l.tipo !== 'centro_dia')

/** Com vaga para quem pede hoje: um lugar livre e ninguém na lista à frente. */
const comVaga = (l: Lar, distrito: Distrito): Lar => ({
  ...l,
  distrito,
  listaEspera: 0,
  quartos: l.quartos.map((q, i) => ({ ...q, livres: i === 0 ? 1 : 0 })),
})
const semVaga = (l: Lar, distrito: Distrito): Lar => ({ ...l, distrito, quartos: l.quartos.map((q) => ({ ...q, livres: 0 })) })

describe('página inicial, versão grátis: o "quantas", nunca o "quais"', () => {
  it('conta os lares e residências com vaga agora (sem centros de dia)', () => {
    expect(contarComVaga(lares)).toBe(residenciais.filter((l) => vagaParaNovos(l)).length)
  })

  it('etiquetas do mapa: só contagens por distrito, por ordem decrescente', () => {
    const d = vagasPorDistrito(lares, 3)
    expect(d.length).toBeGreaterThan(0)
    expect(d.length).toBeLessThanOrEqual(3)
    for (const x of d) {
      // nada que identifique uma instituição
      expect(Object.keys(x).sort()).toEqual(['comVaga', 'distrito', 'lat', 'total'])
      const doDistrito = residenciais.filter((l) => l.distrito === x.distrito)
      expect(x.total).toBe(doDistrito.length)
      expect(x.comVaga).toBe(doDistrito.filter((l) => vagaParaNovos(l)).length)
    }
    expect(d.map((x) => x.comVaga)).toEqual([...d.map((x) => x.comVaga)].sort((a, b) => b - a))
  })

  it('um distrito com poucas casas, ou em que todas têm vaga, não aparece (aí "quantas" diria "quais")', () => {
    const base = residenciais.slice(0, 6)
    const poucas = base.slice(0, MIN_AGREGADO - 1).map((l) => comVaga(l, 'Guarda'))
    const todas = base.map((l) => comVaga(l, 'Beja'))
    expect(vagasPorDistrito([...poucas, ...todas])).toEqual([])
    const metade = base.map((l, i) => (i % 2 ? comVaga(l, 'Évora') : semVaga(l, 'Évora')))
    expect(vagasPorDistrito(metade)).toMatchObject([{ distrito: 'Évora', comVaga: 3, total: 6 }])
  })

  it('compatibilidade de exemplo: sem preço, distância nem vagas nas razões', () => {
    const ex = exemploCompatibilidade(lares)
    expect(ex).not.toBeNull()
    const razoes = razoesGratis(ex!)
    expect(razoes.length).toBeGreaterThan(0)
    for (const r of razoes) expect(r.texto).not.toMatch(/€|km|vaga|lugar|lista de espera|orçamento/i)
    // e na versão completa a razão do orçamento (com o preço) existe — é ela que fica de fora
    expect(ex!.match.razoes.some((r) => r.texto.includes('€'))).toBe(true)
  })

  it('a instituição da história "Como funciona" é escolhida sem olhar para as vagas', () => {
    const id = escolherHistoriaGratis(lares)?.id
    expect(id).toBeTruthy()
    expect(escolherHistoriaGratis(lares.map((l) => semVaga(l, l.distrito)))?.id).toBe(id)
    expect(escolherHistoriaGratis(lares.map((l) => comVaga(l, l.distrito)))?.id).toBe(id)
  })
})

describe('pesquisa da página inicial, versão grátis', () => {
  it('uma instituição sugerida pelo nome não diz se tem vaga', () => {
    const alvo = residenciais.find((l) => vagaParaNovos(l))!
    const q = alvo.nome.slice(0, 12)
    const gratis = sugerir(q, lares, 7, false).filter((o) => o.kind === 'lar')
    expect(gratis.some((o) => o.larId === alvo.id)).toBe(true)
    for (const o of gratis) expect(o.comVaga).toBeNull()
    expect(sugerir(q, lares, 7, true).find((o) => o.larId === alvo.id)?.comVaga).toBe(1)
  })

  it('lugares e distritos mantêm a contagem, só a partir de MIN_AGREGADO instituições', () => {
    const opcoes = ['', 'porto', 'coimbra', 'lisboa', 'braga'].flatMap((q) => sugerir(q, lares, 7, false)).filter((o) => o.kind !== 'lar')
    expect(opcoes.some((o) => o.total < MIN_AGREGADO)).toBe(true)
    expect(opcoes.some((o) => o.total >= MIN_AGREGADO)).toBe(true)
    for (const o of opcoes) {
      if (o.total < MIN_AGREGADO) expect(o.comVaga).toBeNull()
      else expect(o.comVaga).toEqual(expect.any(Number))
    }
  })
})
