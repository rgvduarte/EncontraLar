import { describe, expect, it } from 'vitest'
import { procuraDoPerfil } from '@/features/match/results/procura'
import { LABEL_GPS } from '@/features/match/language'
import type { PerfilMatch } from '@/features/match/model'
import { procuraDaPesquisa } from './procura'
import { parseSearch } from './searchState'

const estado = (q: string) => parseSearch(new URLSearchParams(q))

describe('procura sem vaga em /pesquisa', () => {
  it('lugar escolhido: distrito, lugar e filtros — sem coordenadas nem texto livre', () => {
    const p = procuraDaPesquisa(estado('lugar=Bragança&grau=grave&cuidados=paliativos&max=900'), 2, 0)
    expect(p).toEqual({ distrito: 'Bragança', lugar: 'Bragança', grau: 'grave', cuidados: ['paliativos'], orcamentoMax: 900, resultados: 2, comVaga: 0 })
    expect(JSON.stringify(p)).not.toMatch(/lat|lng/)
  })
  it('distrito escolhido: só o distrito', () => {
    expect(procuraDaPesquisa(estado('distrito=Guarda'), 0, 0)).toEqual({ distrito: 'Guarda', cuidados: [], resultados: 0, comVaga: 0 })
  })
  it('não regista com vaga, sem lugar escolhido, por coordenadas, zona do mapa ou nome', () => {
    expect(procuraDaPesquisa(estado('lugar=Porto'), 30, 4)).toBeNull()
    expect(procuraDaPesquisa(estado(''), 0, 0)).toBeNull()
    expect(procuraDaPesquisa(estado('lat=41.1&lng=-8.6'), 0, 0)).toBeNull()
    expect(procuraDaPesquisa(estado('zona=41,-9,42,-8'), 0, 0)).toBeNull()
    expect(procuraDaPesquisa(estado('lugar=Porto&q=santa'), 0, 0)).toBeNull()
    expect(procuraDaPesquisa(estado('lugar=Inexistente'), 0, 0)).toBeNull()
  })
})

describe('procura sem vaga no questionário', () => {
  const perfil: PerfilMatch = {
    grau: 'grave',
    necessidades: ['paliativos', 'acamados'],
    preferencias: [],
    quarto: 'indiferente',
    local: { label: 'Bragança', lat: 41.8, lng: -6.75 },
    raioKm: 15,
    orcamentoMax: 900,
    urgencia: 'imediata',
    precisaAcordoSS: false,
  }
  it('usa o lugar, o grau, os cuidados e o orçamento do perfil', () => {
    expect(procuraDoPerfil(perfil, 1, 0)).toEqual({
      distrito: 'Bragança',
      lugar: 'Bragança',
      grau: 'grave',
      cuidados: ['paliativos', 'acamados'],
      orcamentoMax: 900,
      resultados: 1,
      comVaga: 0,
    })
  })
  it('com vaga agora não regista', () => {
    expect(procuraDoPerfil(perfil, 3, 1)).toBeNull()
  })
  it('"A sua localização": só o distrito; "Ainda não sei" não é orçamento', () => {
    const p = procuraDoPerfil({ ...perfil, local: { label: LABEL_GPS, lat: 41.15, lng: -8.61 }, orcamentoMax: 5000 }, 0, 0)
    expect(p).toEqual({ distrito: 'Porto', grau: 'grave', cuidados: ['paliativos', 'acamados'], resultados: 0, comVaga: 0 })
  })
})
