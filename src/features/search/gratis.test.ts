import { describe, expect, it } from 'vitest'
import type { Disponibilidade, Lar } from '@/types'
import { faixaPreco } from '@/lib/acesso'
import { estimarEspera } from '@/lib/forecast'
import { calcularAlivios, filtrar, ordenar, type Entrada } from './filtering'
import { agregadoVisivel, cabeNaFaixa, estadoGratis, faixaDoOrcamento, ignoradosGratis, indiceFaixa } from './gratis'
import { pilulasAtivas } from './ResultsSummary'
import { FILTROS_VAZIOS, parseSearch, type SearchState } from './searchState'

const estado = (q: string): SearchState => parseSearch(new URLSearchParams(q))

let seq = 0
/** Instituição mínima para filtrar e ordenar (só os campos que as regras leem). */
function lar(p: Partial<Lar> = {}): Lar {
  seq++
  return {
    id: `l-${seq}`,
    nome: `Casa ${String(seq).padStart(2, '0')}`,
    tipo: 'erpi',
    natureza: 'privado',
    localidade: 'Porto',
    concelho: 'Porto',
    distrito: 'Porto',
    lat: 41.15,
    lng: -8.61,
    capacidade: 40,
    quartos: [{ tipo: 'individual', total: 40, livres: 0, precoMin: 1500, precoMax: 1800 }],
    listaEspera: 5,
    estadiaMediaMeses: 30,
    historicoSaidas: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    mensalidadeMin: 1500,
    mensalidadeMax: 1800,
    acordoSS: false,
    graus: ['autonomo', 'ligeira', 'moderada', 'grave'],
    cuidados: [],
    avaliacao: 4.5,
    numAvaliacoes: 10,
    atualizadoEm: '2026-10-01T10:00:00Z',
    ...p,
  } as unknown as Lar
}

/** Entrada com um estado de vaga forçado (o que a versão grátis não pode usar). */
const entrada = (l: Lar, novos: Disponibilidade): Entrada => ({ lar: l, est: estimarEspera(l), disp: novos, novos })

const pais = (patch: Partial<SearchState> = {}): SearchState => ({ ...estado(''), ...patch })
const ids = (es: Entrada[]) => es.map((e) => e.lar.id)

describe('versão grátis — estado efetivo', () => {
  it('ignora o filtro e a ordem por vaga, e diz o que ficou de fora', () => {
    const pedido = estado('lugar=Porto&vaga=agora&ordem=disponibilidade&tipo=erpi')
    const s = estadoGratis(pedido)
    expect(s.vaga).toBeNull()
    expect(s.ordem).toBe('relevancia')
    expect(s.tipos).toEqual(['erpi'])
    expect(ignoradosGratis(pedido)).toEqual({ vaga: 'agora', ordem: true })
    expect(ignoradosGratis(estado('lugar=Porto&vaga=breve'))).toEqual({ vaga: 'breve', ordem: false })
    expect(ignoradosGratis(estado('lugar=Porto&ordem=preco'))).toBeNull()
    expect(estadoGratis(estado('ordem=preco')).ordem).toBe('preco')
  })

  it('o orçamento passa para a faixa que o contém (nunca um valor exato)', () => {
    expect(faixaDoOrcamento(null)).toBeNull()
    expect(faixaDoOrcamento(800)).toBe(1000)
    expect(faixaDoOrcamento(1000)).toBe(1000)
    expect(faixaDoOrcamento(1550)).toBe(2000)
    expect(faixaDoOrcamento(2000)).toBe(2000)
    expect(faixaDoOrcamento(2500)).toBeNull()
    expect(estadoGratis(estado('max=1550')).max).toBe(2000)
  })

  it('as faixas são as mesmas dos cartões (faixaPreco)', () => {
    const nomes = ['Até 1.000 €/mês', '1.000 € a 2.000 €/mês', 'Mais de 2.000 €/mês']
    for (const v of [0, 450, 999, 1000, 1001, 1550, 1999, 2000, 2001, 4800]) {
      expect(faixaPreco({ natureza: 'privado', mensalidadeMin: v })).toBe(nomes[indiceFaixa(v)])
      expect(cabeNaFaixa(v, 1000)).toBe(indiceFaixa(v) === 0)
      expect(cabeNaFaixa(v, 2000)).toBe(indiceFaixa(v) <= 1)
      expect(cabeNaFaixa(v, null)).toBe(true)
    }
  })

  it('a pílula do filtro mostra a faixa', () => {
    expect(pilulasAtivas(estadoGratis(estado('max=1550')), false).find((p) => p.id === 'max')?.texto).toBe('Até 2.000 €')
    expect(pilulasAtivas(estado('max=1550')).find((p) => p.id === 'max')?.texto).toMatch(/^Até 1550/)
  })

  it('só diz quantas têm vaga a partir de 5 instituições', () => {
    expect(agregadoVisivel(1)).toBe(false)
    expect(agregadoVisivel(4)).toBe(false)
    expect(agregadoVisivel(5)).toBe(true)
  })
})

describe('versão grátis — filtrar e ordenar sem saber quais têm vaga', () => {
  const a = lar({ avaliacao: 4.9, numAvaliacoes: 40, mensalidadeMin: 1900 })
  const b = lar({ avaliacao: 4.2, numAvaliacoes: 8, mensalidadeMin: 950, natureza: 'ipss' })
  const c = lar({ avaliacao: 4.6, numAvaliacoes: 12, mensalidadeMin: 1000 })
  const d = lar({ avaliacao: 4.6, numAvaliacoes: 30, mensalidadeMin: 2400, atualizadoEm: '2026-01-01T00:00:00Z' })
  const estados: Disponibilidade[] = ['disponivel', 'breve', 'espera']
  /** todas as combinações de estado para as 4 casas: a ordem e os resultados grátis nunca mudam */
  const combinacoes = (fn: (es: Entrada[]) => unknown) => {
    const vistos = new Set<string>()
    for (let i = 0; i < 81; i++) {
      const es = [a, b, c, d].map((l, k) => entrada(l, estados[Math.floor(i / 3 ** k) % 3]!))
      vistos.add(JSON.stringify(fn(es)))
    }
    return vistos
  }

  it('a camada completa põe primeiro quem tem vaga', () => {
    const es = [entrada(a, 'espera'), entrada(b, 'disponivel'), entrada(c, 'breve'), entrada(d, 'espera')]
    expect(ids(ordenar(es, 'relevancia'))[0]).toBe(b.id)
  })

  it('relevância, distância, preço e avaliação não dependem das vagas', () => {
    for (const ordem of ['relevancia', 'distancia', 'preco', 'avaliacao', 'disponibilidade'] as const) {
      expect(combinacoes((es) => ids(ordenar(es, ordem, false))).size).toBe(1)
    }
    const es = [a, b, c, d].map((l) => entrada(l, 'espera'))
    // relevância grátis: avaliação, depois nº de avaliações (nem vaga nem data de confirmação)
    expect(ids(ordenar(es, 'relevancia', false))).toEqual([a.id, d.id, c.id, b.id])
    // preço grátis: por faixa (b e c são da faixa de baixo e da do meio; a ordem exata não conta), depois relevância
    expect(ids(ordenar(es, 'preco', false))).toEqual([b.id, a.id, c.id, d.id])
  })

  it('o filtro por vaga não se aplica e o orçamento é por faixa', () => {
    const agora = pais({ ...FILTROS_VAZIOS, vaga: 'agora' })
    expect(combinacoes((es) => ids(filtrar(es, agora, false))).size).toBe(1)
    expect(ids(filtrar([a, b, c, d].map((l) => entrada(l, 'espera')), agora, false))).toHaveLength(4)
    // "Até 1.000 €": 1.000 € já é a faixa seguinte, como no cartão
    const ate1000 = filtrar([a, b, c, d].map((l) => entrada(l, 'espera')), pais({ max: 1000 }), false)
    expect(ids(ate1000)).toEqual([b.id])
    // um orçamento exato (vindo de um endereço) conta como a faixa inteira
    const ate1600 = filtrar([a, b, c, d].map((l) => entrada(l, 'espera')), pais({ max: 1600 }), false)
    expect(ids(ate1600)).toEqual([a.id, b.id, c.id])
  })

  it('as sugestões do estado vazio sobem o orçamento por faixas', () => {
    const es = [entrada(d, 'espera')]
    const alivios = calcularAlivios(es, pais({ max: 1000 }), false)
    expect(alivios.find((x) => x.id.startsWith('max'))).toMatchObject({ acao: 'Retirar o limite de orçamento', patch: { max: null } })
    const subir = calcularAlivios([entrada(a, 'espera')], pais({ max: 1000 }), false)
    expect(subir.find((x) => x.id === 'max')).toMatchObject({ acao: 'Subir o orçamento até 2.000 €', patch: { max: 2000 } })
    // nada sobre vagas (na versão grátis o filtro nem chega ao estado, mas a regra não depende disso)
    expect(calcularAlivios(es, pais({ vaga: 'agora' }), false).some((x) => x.id.startsWith('vaga'))).toBe(false)
    expect(calcularAlivios(es, pais({ vaga: 'agora' })).some((x) => x.id.startsWith('vaga'))).toBe(true)
  })
})
