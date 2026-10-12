import { describe, expect, it } from 'vitest'
import { createSeed, DEMO_LAR_ID } from '@/data/seed'
import { avaliarLar } from './matching'
import { vagaParaNovos } from './forecast'

const db = createSeed(new Date('2026-10-12T10:00:00Z').getTime())
const maria = db.perfis.find((p) => p.id === 'p-maria-carmo')!

describe('avaliarLar', () => {
  it('não diz "Tem vaga disponível agora" quando o lugar livre é da lista de espera', () => {
    const lar = db.lares.find((l) => l.id === DEMO_LAR_ID)!
    expect(vagaParaNovos(lar)).toBe(false)
    const urgente = avaliarLar(lar, { ...maria, urgencia: 'imediata' })
    const textos = urgente.razoes.map((r) => r.texto)
    expect(textos).not.toContain('Tem vaga disponível agora')
    expect(textos).toContain('Tem lugar livre, mas a lista de espera tem prioridade')
    // pontua como "em breve" ou "lista de espera", não como vaga imediata
    expect(urgente.parcelas.disponibilidade).toBeLessThan(15)
  })

  it('usa negativas naturais (sem "Sem visitas sem horário fixo")', () => {
    const semVisitas = db.lares.find((l) => !l.comodidades.includes('visitas_livres') && !l.comodidades.includes('animais'))!
    const r = avaliarLar(semVisitas, { ...maria, preferencias: ['visitas_livres', 'animais'], quarto: 'casal' })
    const textos = r.razoes.map((x) => x.texto)
    expect(textos).toContain('Visitas só em horário fixo')
    expect(textos).toContain('Não aceita animais de estimação')
    expect(textos.join(' ')).not.toMatch(/Sem visitas sem|Sem aceita|quarto casal/)
  })

  it('o grau de dependência lê-se bem quando não é admitido', () => {
    const soDependentes = db.lares.find((l) => !l.graus.includes('autonomo'))!
    const r = avaliarLar(soDependentes, { ...maria, grau: 'autonomo' })
    expect(r.razoes.map((x) => x.texto)).toContain('Não admite pessoas autónomas')
  })
})
