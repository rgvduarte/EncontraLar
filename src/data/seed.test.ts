import { describe, expect, it } from 'vitest'
import { createSeed, DEMO_LAR_ID } from './seed'
import { recomendar } from '@/lib/matching'
import { disponibilidade } from '@/lib/forecast'

const AGORA = new Date('2026-10-12T10:00:00Z').getTime()

describe('seed', () => {
  const db = createSeed(AGORA)

  it('é determinístico', () => {
    const b = createSeed(AGORA)
    expect(b.lares.map((l) => l.id)).toEqual(db.lares.map((l) => l.id))
    expect(JSON.stringify(b.lares[20])).toEqual(JSON.stringify(db.lares[20]))
  })

  it('gera ~160 instituições com ids únicos e dados coerentes', () => {
    expect(db.lares.length).toBeGreaterThan(150)
    expect(new Set(db.lares.map((l) => l.id)).size).toBe(db.lares.length)
    expect(new Set(db.lares.map((l) => l.nome)).size).toBe(db.lares.length)
    for (const l of db.lares) {
      const continente = l.lat > 36.9 && l.lat < 42.2 && l.lng > -9.6 && l.lng < -6.1
      const madeira = l.distrito === 'Madeira' && l.lat > 32.6 && l.lat < 32.9
      const acores = l.distrito === 'Açores' && l.lat > 36.9 && l.lat < 39.8 && l.lng < -24
      expect(continente || madeira || acores, `${l.nome} ${l.lat},${l.lng}`).toBe(true)
      expect(l.quartos.length).toBeGreaterThan(0)
      for (const q of l.quartos) {
        expect(q.livres).toBeLessThanOrEqual(q.total)
        expect(q.precoMin).toBeGreaterThan(0)
        expect(q.precoMax).toBeGreaterThanOrEqual(q.precoMin)
      }
      expect(l.quartos.reduce((s, q) => s + q.total, 0)).toBe(l.capacidade)
      expect(l.historicoSaidas).toHaveLength(12)
    }
  })

  it('tem mistura realista de disponibilidade', () => {
    const c = { disponivel: 0, breve: 0, espera: 0 }
    for (const l of db.lares) c[disponibilidade(l)]++
    expect(c.disponivel).toBeGreaterThan(20)
    expect(c.breve).toBeGreaterThan(10)
    expect(c.espera).toBeGreaterThan(20)
  })

  it('o lar de demonstração e a família de demonstração estão ligados', () => {
    const lar = db.lares.find((l) => l.id === DEMO_LAR_ID)!
    expect(lar.ownerId).toBeDefined()
    expect(db.users.find((u) => u.id === lar.ownerId)?.role).toBe('lar')
    expect(db.candidaturas.filter((c) => c.larId === DEMO_LAR_ID).length).toBeGreaterThanOrEqual(6)
  })

  it('a recomendação para a Maria do Carmo devolve opções compatíveis perto do Porto', () => {
    const maria = db.perfis.find((p) => p.id === 'p-maria-carmo')!
    const recs = recomendar(db.lares, maria)
    const compat = recs.filter((r) => r.compativel)
    expect(compat.length).toBeGreaterThan(3)
    expect(compat[0]!.distanciaKm).toBeLessThan(maria.raioKm * 1.5)
    expect(compat[0]!.score).toBeGreaterThan(60)
  })
})
