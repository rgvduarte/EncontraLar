import { describe, expect, it } from 'vitest'
import { aoLar, doLar, emLar, oLar } from './estado'

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
