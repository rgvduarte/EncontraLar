import { describe, expect, it } from 'vitest'
import type { Lar } from '@/types'
import { estimarEspera } from '@/lib/forecast'
import { construirOpcoes } from './placeOptions'
import { dispParaNovos, dividir, filtrar, type Entrada } from './filtering'
import { tituloPesquisa } from './ResultsSummary'
import { FILTROS_VAZIOS, nomeDistrito, noDistrito, parseSearch, pertoDe, rotuloLocal, type SearchState } from './searchState'

const estado = (q: string): SearchState => parseSearch(new URLSearchParams(q))

/** opções de lugar sugeridas para um texto (sem instituições: só interessam os lugares) */
const lugaresPara = (texto: string) =>
  construirOpcoes(texto, [], false).flatMap((g) => g.opcoes.map((o) => (o.kind === 'lugar' ? `${g.titulo}: ${o.lugar.label}` : null))).filter(Boolean)

describe('código postal', () => {
  it('prefixos conhecidos continuam exatos', () => {
    expect(lugaresPara('4200')[0]).toBe('Código postal: Porto — Paranhos')
  })
  it('códigos que não temos dão o lugar conhecido mais próximo da mesma zona', () => {
    expect(lugaresPara('4000')[0]).toBe('Código postal (aproximado): Porto')
    expect(lugaresPara('4000-123')[0]).toBe('Código postal (aproximado): Porto')
    expect(lugaresPara('4710')[0]).toBe('Código postal (aproximado): Braga')
    expect(lugaresPara('1100')[0]).toBe('Código postal (aproximado): Lisboa')
    expect(lugaresPara('4000').length).toBeLessThanOrEqual(3)
  })
})

describe('nomes de sítios em português de Portugal', () => {
  it('distritos e regiões autónomas', () => {
    expect(nomeDistrito('Porto')).toBe('Distrito do Porto')
    expect(nomeDistrito('Guarda')).toBe('Distrito da Guarda')
    expect(nomeDistrito('Braga')).toBe('Distrito de Braga')
    expect(nomeDistrito('Açores')).toBe('Região Autónoma dos Açores')
    expect(noDistrito('Porto')).toBe('no distrito do Porto')
    expect(noDistrito('Madeira')).toBe('na Região Autónoma da Madeira')
    expect(rotuloLocal({ tipo: 'distrito', distrito: 'Porto' })).toBe('Distrito do Porto')
  })
  it('perto de…', () => {
    expect(pertoDe('Porto')).toBe('perto do Porto')
    expect(pertoDe('Amadora')).toBe('perto da Amadora')
    expect(pertoDe('Braga')).toBe('perto de Braga')
    expect(pertoDe('Lisboa — Parque das Nações')).toBe('perto do Parque das Nações, em Lisboa')
  })
  it('título da pesquisa', () => {
    expect(tituloPesquisa(estado('lugar=Porto'))).toBe('Lares e residências perto do Porto')
    expect(tituloPesquisa(estado('distrito=Porto'))).toBe('Lares e residências no distrito do Porto')
    expect(tituloPesquisa(estado('distrito=Guarda&tipo=erpi'))).toBe('Lares no distrito da Guarda')
  })
  it('o campo aceita o nome que ele próprio mostra', () => {
    const ops = construirOpcoes('Distrito do Porto', [], false).flatMap((g) => g.opcoes)
    expect(ops.some((o) => o.kind === 'distrito' && o.distrito === 'Porto')).toBe(true)
  })
})

describe('vaga para quem pede hoje', () => {
  const lar = (livres: number, listaEspera: number) =>
    ({
      id: `l-${livres}-${listaEspera}`,
      capacidade: 40,
      quartos: [{ tipo: 'individual', total: 40, livres, precoMin: 1500, precoMax: 1800 }],
      estadiaMediaMeses: 30,
      historicoSaidas: [1, 2, 1, 1, 0, 1, 1, 2, 1, 1, 2, 2],
      listaEspera,
    }) as unknown as Lar
  const entrada = (l: Lar): Entrada => {
    const est = estimarEspera(l)
    return { lar: l, est, disp: livresDe(l) > 0 ? 'disponivel' : 'espera', novos: dispParaNovos(l, est) }
  }
  const livresDe = (l: Lar) => l.quartos.reduce((s, q) => s + q.livres, 0)

  it('lugar livre já prometido à lista de espera não é «com vaga agora»', () => {
    const livre = entrada(lar(2, 0))
    const comLista = entrada(lar(1, 30))
    expect(livre.novos).toBe('disponivel')
    expect(comLista.disp).toBe('disponivel')
    expect(comLista.novos).not.toBe('disponivel')

    const s = { ...FILTROS_VAZIOS, local: { tipo: 'pais' as const }, raio: 15, vaga: 'agora' as const }
    expect(filtrar([livre, comLista], s).map((e) => e.lar.id)).toEqual([livre.lar.id])

    const grupos = dividir([livre, comLista], [livre, comLista], 'relevancia')
    expect(grupos?.map((g) => [g.id, g.itens.length])).toEqual([
      ['agora', 1],
      ['resto', 1],
    ])
  })
})
