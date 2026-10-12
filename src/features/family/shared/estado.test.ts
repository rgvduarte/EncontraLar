import { describe, expect, it } from 'vitest'
import type { Candidatura } from '@/types'
import { aoLar, diaMes, doLar, emCurso, emLar, entradaPorConfirmar, isAtiva, oLar, ordenarPedidos } from './estado'

describe('contrações com nomes de instituições', () => {
  it('concorda com o género e o número do nome', () => {
    expect(aoLar('Lar Residencial Rainha Santa')).toBe('ao Lar Residencial Rainha Santa')
    expect(aoLar('Casa de Repouso Jardins do Douro')).toBe('à Casa de Repouso Jardins do Douro')
    expect(aoLar('Residências Miradouro')).toBe('às Residências Miradouro')
    expect(doLar('Centro de Dia Colina Verde')).toBe('do Centro de Dia Colina Verde')
    expect(doLar('Residência Sénior Aconchego')).toBe('da Residência Sénior Aconchego')
    expect(emLar('Residências Miradouro')).toBe('nas Residências Miradouro')
    expect(emLar('Santa Casa da Misericórdia de Braga')).toBe('na Santa Casa da Misericórdia de Braga')
    expect(oLar('Lar Santa Teresa')).toBe('o Lar Santa Teresa')
  })
})

describe('pedidos com entrada (admitida)', () => {
  const agora = new Date('2026-10-12T12:00:00Z').getTime()
  const base = (id: string, estado: Candidatura['estado'], extra: Partial<Candidatura> = {}) =>
    ({ id, estado, atualizadaEm: '2026-10-01T10:00:00Z', historico: [], ...extra }) as unknown as Candidatura

  it('não conta como terminada, mas já não está em curso', () => {
    const c = base('a', 'admitida')
    expect(isAtiva(c)).toBe(true)
    expect(emCurso(c)).toBe(false)
    expect(isAtiva(base('b', 'recusada'))).toBe(false)
  })

  it('pede resposta quando a instituição registou a entrada e a família ainda não confirmou', () => {
    const c = base('a', 'admitida', { entrada: { data: '2026-10-09', confirmadaLarEm: '2026-10-09T10:00:00Z', taxa: 'aplicavel' } })
    expect(entradaPorConfirmar(c)).toBe(true)
    expect(entradaPorConfirmar(base('b', 'admitida', { entrada: { data: '2026-10-09', confirmadaFamiliaEm: '2026-10-09T10:00:00Z', taxa: 'isenta' } }))).toBe(false)
  })

  it('ordena: resposta pedida primeiro, entrada recente por avaliar junto da vaga aceite, entrada antiga no fim dos ativos', () => {
    const lista = [
      base('cancelada', 'cancelada'),
      base('antiga', 'admitida', {
        entrada: { data: '2026-06-01', confirmadaLarEm: '2026-06-01T10:00:00Z', confirmadaFamiliaEm: '2026-06-02T10:00:00Z', taxa: 'aplicavel' },
        atualizadaEm: '2026-10-11T10:00:00Z',
      }),
      base('espera', 'lista_espera'),
      base('recente', 'admitida', { entrada: { data: '2026-10-10', confirmadaFamiliaEm: '2026-10-10T10:00:00Z', taxa: 'aplicavel' } }),
      base('porConfirmar', 'admitida', { entrada: { data: '2026-10-09', confirmadaLarEm: '2026-10-09T10:00:00Z', taxa: 'aplicavel' } }),
      base('proposta', 'vaga_proposta'),
    ]
    expect(ordenarPedidos(lista, () => false, agora).map((c) => c.id)).toEqual(['proposta', 'porConfirmar', 'recente', 'espera', 'antiga', 'cancelada'])
    // depois de avaliada, a entrada recente também deixa de subir
    expect(ordenarPedidos(lista, (c) => c.id === 'recente', agora).map((c) => c.id)).toEqual(['proposta', 'porConfirmar', 'espera', 'antiga', 'recente', 'cancelada'])
  })

  it('escreve o dia da entrada sem o ano quando é do ano atual', () => {
    const hoje = new Date(2026, 9, 12)
    expect(diaMes('2026-10-09', hoje)).toBe('9 de outubro')
    expect(diaMes('2025-12-30', hoje)).toBe('30 de dezembro de 2025')
  })
})
