import { describe, expect, it } from 'vitest'
import type { Lar, Visita } from '@/types'
import {
  contactoAFazer,
  contactosUrgentes,
  contactoTexto,
  correspondePesquisa,
  diaCurto,
  diasAte,
  estadoContacto,
  linhasDoDistrito,
  nivelVerificacao,
  ordenarAcompanhar,
  ordenarPorVisitar,
  pesquisar,
  resumoDoMes,
  segmentoDe,
  separarSegmentos,
  visitasPorLar,
} from './pipeline'

// "agora" fixo: terça-feira, 13 de outubro de 2026, 10h00 (hora local)
const AGORA = new Date(2026, 9, 13, 10, 0)
/** ISO de um dia/hora local de 2026 (mês 1–12) */
const iso = (mes: number, dia: number, hora = 11) => new Date(2026, mes - 1, dia, hora).toISOString()

const nada: Visita['verificacao'] = { licencaConfirmada: false, instalacoesVistas: false, vagasConfirmadas: false, precosConfirmados: false }

const lar = (id: string, extra: Partial<Lar> = {}): Lar =>
  ({
    id,
    nome: id,
    distrito: 'Porto',
    localidade: 'Porto',
    concelho: 'Porto',
    natureza: 'privado',
    lat: 41.15,
    lng: -8.61,
    reviews: [],
    verificacao: { estado: 'nao_verificado', licenca: '' },
    ...extra,
  }) as Lar

let n = 0
const visita = (larId: string, data: string, resultado: Visita['resultado'], extra: Partial<Visita> = {}): Visita => ({
  id: `v-${++n}`,
  larId,
  equipaId: 'u-equipa',
  data,
  resultado,
  verificacao: nada,
  ...extra,
})

describe('visitas por instituição e segmento', () => {
  it('agrupa da visita mais recente para a mais antiga (no empate, a registada depois)', () => {
    const a1 = visita('a', iso(9, 1), 'voltar')
    const a2 = visita('a', iso(10, 2), 'interessado')
    const b1 = visita('b', iso(10, 5), 'recusou')
    const a3 = visita('a', iso(10, 2), 'aderiu') // mesmo instante que a2, mas registada depois
    const m = visitasPorLar([a1, a2, b1, a3])
    expect(m.get('a')?.map((v) => v.id)).toEqual([a3.id, a2.id, a1.id])
    expect(m.get('b')?.map((v) => v.id)).toEqual([b1.id])
    expect(m.has('c')).toBe(false)
  })

  it('o segmento vem do resultado da última visita', () => {
    expect(segmentoDe(undefined)).toBe('por_visitar')
    expect(segmentoDe({ resultado: 'interessado' })).toBe('acompanhar')
    expect(segmentoDe({ resultado: 'voltar' })).toBe('acompanhar')
    expect(segmentoDe({ resultado: 'aderiu' })).toBe('aderiram')
    expect(segmentoDe({ resultado: 'recusou' })).toBe('recusaram')
  })

  it('só entra o distrito escolhido (ou todos); quem recusou e voltou a ser visitado muda de segmento', () => {
    const lares = [lar('a'), lar('b'), lar('c', { distrito: 'Braga' })]
    const visitas = [visita('a', iso(9, 1), 'recusou'), visita('a', iso(10, 10), 'interessado', { proximoContacto: '2026-10-20' })]
    const porto = linhasDoDistrito(lares, visitas, 'Porto', AGORA)
    expect(porto.map((l) => [l.lar.id, l.segmento])).toEqual([
      ['a', 'acompanhar'],
      ['b', 'por_visitar'],
    ])
    expect(porto[0]!.contacto).toEqual({ tipo: 'breve', dias: 7 })
    expect(porto[1]!.contacto).toBeUndefined()
    expect(linhasDoDistrito(lares, visitas, 'todos', AGORA)).toHaveLength(3)
    expect(linhasDoDistrito(lares, visitas, 'Faro', AGORA)).toEqual([])
  })
})

describe('próximo contacto', () => {
  it('conta dias de calendário a partir de hoje', () => {
    expect(diasAte('2026-10-13', AGORA)).toBe(0)
    expect(diasAte('2026-10-12', AGORA)).toBe(-1)
    expect(diasAte('2026-10-20', AGORA)).toBe(7)
    // atravessa a mudança da hora (25 de outubro): continua a ser um número inteiro de dias
    expect(diasAte('2026-11-13', AGORA)).toBe(31)
    expect(diasAte('', AGORA)).toBeNull()
    expect(diasAte('13/10/2026', AGORA)).toBeNull()
    expect(diasAte(undefined, AGORA)).toBeNull()
  })

  it('classifica: em atraso, hoje, nos próximos 7 dias, depois, sem data', () => {
    expect(estadoContacto('2026-10-10', AGORA)).toEqual({ tipo: 'atrasado', dias: -3 })
    expect(estadoContacto('2026-10-13', AGORA)).toEqual({ tipo: 'hoje', dias: 0 })
    expect(estadoContacto('2026-10-20', AGORA)).toEqual({ tipo: 'breve', dias: 7 })
    expect(estadoContacto('2026-10-21', AGORA)).toEqual({ tipo: 'depois', dias: 8 })
    expect(estadoContacto(undefined, AGORA)).toEqual({ tipo: 'sem_data', dias: null })
    expect(contactoAFazer({ tipo: 'breve', dias: 3 })).toBe(true)
    expect(contactoAFazer({ tipo: 'depois', dias: 9 })).toBe(false)
    expect(contactoAFazer({ tipo: 'sem_data', dias: null })).toBe(false)
  })

  it('diz quando, em texto', () => {
    const t = (ymd?: string) => contactoTexto(estadoContacto(ymd, AGORA), ymd, AGORA)
    expect(t('2026-10-12')).toBe('Em atraso desde ontem')
    expect(t('2026-10-10')).toBe('Em atraso há 3 dias')
    expect(t('2026-10-13')).toBe('Contactar hoje')
    expect(t('2026-10-14')).toBe('Contactar amanhã')
    expect(t('2026-10-23')).toBe('Contactar sex., 23 out.')
    expect(t('2027-01-05')).toBe('Contactar ter., 5 jan. 2027')
    expect(t(undefined)).toBe('Sem data marcada')
    expect(diaCurto(iso(10, 7), AGORA)).toBe('7 out.')
  })
})

describe('ordenação', () => {
  it('a acompanhar: os atrasados primeiro, depois pela data; sem data no fim', () => {
    const lares = ['d', 'b', 'a', 'c', 'e'].map((id) => lar(id))
    const visitas = [
      visita('a', iso(10, 1), 'interessado', { proximoContacto: '2026-10-25' }),
      visita('b', iso(10, 2), 'voltar', { proximoContacto: '2026-10-11' }),
      visita('c', iso(10, 3), 'interessado'),
      visita('d', iso(10, 4), 'voltar', { proximoContacto: '2026-10-13' }),
      visita('e', iso(10, 5), 'interessado', { proximoContacto: '2026-10-08' }),
    ]
    const ordem = ordenarAcompanhar(linhasDoDistrito(lares, visitas, 'Porto', AGORA)).map((l) => [l.lar.id, l.contacto?.tipo])
    expect(ordem).toEqual([
      ['e', 'atrasado'],
      ['b', 'atrasado'],
      ['d', 'hoje'],
      ['a', 'depois'],
      ['c', 'sem_data'],
    ])
  })

  it('por visitar: alfabética (com acentos à portuguesa) ou, com a localização, da mais perto para a mais longe', () => {
    const lares = [
      lar('l1', { nome: 'Lar Vila Nova', lat: 41.3, lng: -8.6 }),
      lar('l2', { nome: 'Casa Árvore', lat: 41.16, lng: -8.62 }),
      lar('l3', { nome: 'Casa Azul', lat: 41.5, lng: -8.4 }),
    ]
    const linhas = linhasDoDistrito(lares, [], 'Porto', AGORA)
    expect(ordenarPorVisitar(linhas).map((l) => l.lar.nome)).toEqual(['Casa Árvore', 'Casa Azul', 'Lar Vila Nova'])
    expect(ordenarPorVisitar(linhas).every((l) => l.distanciaKm === undefined)).toBe(true)

    const porDistancia = ordenarPorVisitar(linhas, { lat: 41.15, lng: -8.61 })
    expect(porDistancia.map((l) => l.lar.id)).toEqual(['l2', 'l1', 'l3'])
    expect(porDistancia[0]!.distanciaKm).toBeGreaterThan(0)
    expect(porDistancia[0]!.distanciaKm).toBeLessThan(2)
    // sem localização (recusada ou indisponível): volta à ordem alfabética
    expect(ordenarPorVisitar(linhas, null).map((l) => l.lar.id)).toEqual(['l2', 'l3', 'l1'])
  })

  it('separa nos quatro segmentos; aderiram e recusaram pela visita mais recente', () => {
    const lares = ['a', 'b', 'c', 'd', 'e'].map((id) => lar(id))
    const visitas = [
      visita('a', iso(8, 10), 'aderiu'),
      visita('b', iso(9, 22), 'aderiu'),
      visita('c', iso(10, 1), 'recusou'),
      visita('d', iso(10, 7), 'interessado', { proximoContacto: '2026-10-18' }),
    ]
    const s = separarSegmentos(linhasDoDistrito(lares, visitas, 'Porto', AGORA))
    expect(s.por_visitar.map((l) => l.lar.id)).toEqual(['e'])
    expect(s.acompanhar.map((l) => l.lar.id)).toEqual(['d'])
    expect(s.aderiram.map((l) => l.lar.id)).toEqual(['b', 'a'])
    expect(s.recusaram.map((l) => l.lar.id)).toEqual(['c'])
  })
})

describe('pesquisa', () => {
  it('pelo nome ou pela localidade, sem acentos nem maiúsculas; todas as palavras contam', () => {
    const l = lar('x', { nome: 'Residência São João', localidade: 'Matosinhos', concelho: 'Matosinhos' })
    expect(correspondePesquisa(l, 'sao joao')).toBe(true)
    expect(correspondePesquisa(l, '  MATOSINHOS ')).toBe(true)
    expect(correspondePesquisa(l, 'joão matos')).toBe(true)
    expect(correspondePesquisa(l, 'joão maia')).toBe(false)
    expect(correspondePesquisa(l, '')).toBe(true)
    const linhas = linhasDoDistrito([l, lar('y', { nome: 'Lar da Maia', localidade: 'Maia' })], [], 'Porto', AGORA)
    expect(pesquisar(linhas, 'maia').map((x) => x.lar.id)).toEqual(['y'])
  })
})

describe('números do mês', () => {
  it('visitas, adesões, taxa e contactos a fazer (só no mês corrente)', () => {
    const lares = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => lar(id))
    const visitas = [
      visita('a', iso(9, 30, 23), 'aderiu'), // setembro: não conta
      visita('a', iso(10, 2), 'aderiu'), // renovar a verificação de quem já tinha aderido: visita, mas não adesão
      visita('b', iso(10, 3), 'voltar', { proximoContacto: '2026-10-09' }),
      visita('b', iso(10, 9), 'aderiu'), // estava a acompanhar e aderiu: adesão
      visita('c', iso(10, 5), 'interessado', { proximoContacto: '2026-10-11' }), // em atraso
      visita('d', iso(10, 6), 'voltar', { proximoContacto: '2026-10-16' }), // nos próximos 7 dias
      visita('e', iso(9, 20), 'interessado', { proximoContacto: '2026-11-30' }), // depois (e de setembro)
      visita('f', iso(10, 12), 'recusou'),
    ]
    const r = resumoDoMes(linhasDoDistrito(lares, visitas, 'Porto', AGORA), AGORA)
    expect(r).toEqual({ visitas: 6, adesoes: 1, taxaAdesao: 1 / 6, contactos: 2, atrasados: 1 })
  })

  it('sem visitas este mês: taxa por calcular', () => {
    const r = resumoDoMes(linhasDoDistrito([lar('a')], [visita('a', iso(9, 1), 'aderiu')], 'Porto', AGORA), AGORA)
    expect(r).toEqual({ visitas: 0, adesoes: 0, taxaAdesao: null, contactos: 0, atrasados: 0 })
    expect(resumoDoMes([], AGORA).taxaAdesao).toBeNull()
  })

  it('contactos urgentes (em atraso ou para hoje), em todos os distritos', () => {
    const lares = [lar('a'), lar('b', { distrito: 'Braga' }), lar('c')]
    const visitas = [
      visita('a', iso(10, 1), 'interessado', { proximoContacto: '2026-10-13' }),
      visita('b', iso(10, 1), 'voltar', { proximoContacto: '2026-10-02' }),
      visita('c', iso(10, 1), 'voltar', { proximoContacto: '2026-10-14' }),
    ]
    expect(contactosUrgentes(lares, visitas, AGORA)).toBe(2)
    expect(contactosUrgentes(lares, [], AGORA)).toBe(0)
  })
})

describe('nível de verificação', () => {
  it('visitada pela equipa > licença confirmada > por verificar', () => {
    expect(nivelVerificacao({ verificacao: { estado: 'verificado', data: iso(8, 1), licenca: '1/2020' }, reviews: [] })).toBe('visitada')
    // licença confirmada pela equipa (no registo ou numa visita), ainda sem a visita às instalações
    expect(nivelVerificacao({ verificacao: { estado: 'pendente', licenca: '1/2020', licencaConfirmadaEm: iso(9, 1) }, reviews: [] })).toBe('licenca')
    expect(nivelVerificacao({ verificacao: { estado: 'nao_verificado', licenca: '1/2020', licencaConfirmadaEm: iso(10, 7) }, reviews: [] })).toBe('licenca')
    // o número declarado no registo, sem confirmação, não conta
    expect(nivelVerificacao({ verificacao: { estado: 'pendente', licenca: '1/2020' }, reviews: [] })).toBe('nenhum')
    expect(nivelVerificacao({ verificacao: { estado: 'nao_verificado', licenca: '1/2020' }, reviews: [] })).toBe('nenhum')
  })
})
