import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeed, DEMO_LAR_ID, SEED_VERSION } from '@/data/seed'
import type { Candidatura, DB, User } from '@/types'
import { lerDB, rebaseDemo } from './store'

const DIA = 86_400_000
const DB_KEY = 'encontralar:db'
const SESSION_KEY = 'encontralar:sessao'

function memoria(): Storage {
  const m = new Map<string, string>()
  return {
    get length() {
      return m.size
    },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, String(v)),
  }
}

/** Seed com 10 dias, mais uma conta e um pedido criados pelo visitante. */
function dbAntiga(agora: number): { db: DB; user: User; cand: Candidatura } {
  const db = createSeed(agora - 10 * DIA)
  const user: User = {
    id: 'u_teste123',
    role: 'familia',
    nome: 'Marta Teste',
    email: 'marta@exemplo.pt',
    passwordHash: 'x',
    criadoEm: new Date(agora - 3 * DIA).toISOString(),
  }
  const perfil = { ...db.perfis[0]!, id: 'p_teste123', userId: user.id }
  const cand: Candidatura = {
    id: 'c_teste123',
    larId: DEMO_LAR_ID,
    userId: user.id,
    perfilId: perfil.id,
    perfil,
    contacto: { nome: user.nome, email: user.email },
    estado: 'enviada',
    criadaEm: user.criadoEm,
    atualizadaEm: user.criadoEm,
    historico: [{ data: user.criadoEm, estado: 'enviada' }],
  }
  db.users.push(user)
  db.perfis.push(perfil)
  db.candidaturas.push(cand)
  db.favoritos.push({ userId: user.id, larId: DEMO_LAR_ID, alerta: true, criadoEm: user.criadoEm })
  return { db, user, cand }
}

describe('dados de demonstração antigos', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('ao carregar, refresca o seed com mais de 12 horas e mantém o que o visitante criou', async () => {
    const agora = Date.now()
    const { db, user, cand } = dbAntiga(agora)
    const local = memoria()
    local.setItem(DB_KEY, JSON.stringify(db))
    local.setItem(SESSION_KEY, user.id)
    vi.stubGlobal('localStorage', local)
    vi.stubGlobal('sessionStorage', memoria())
    vi.resetModules()

    const store = await import('./store')
    const novo = store.getDB()

    expect(novo.version).toBe(SEED_VERSION)
    expect(agora - Date.parse(novo.seededAt)).toBeLessThan(60_000)
    expect(novo.users.some((u) => u.id === user.id)).toBe(true)
    expect(novo.candidaturas.some((c) => c.id === cand.id)).toBe(true)
    expect(novo.favoritos.filter((f) => f.userId === user.id)).toHaveLength(1)
    // a sessão do visitante continua válida
    expect(store.getCurrentUser()?.id).toBe(user.id)
    // as vagas das instituições do seed voltam a estar "atualizadas há pouco"
    const seed = createSeed(agora)
    const idsSeed = new Set(seed.lares.map((l) => l.id))
    for (const l of novo.lares.filter((x) => idsSeed.has(x.id))) {
      expect(agora - Date.parse(l.atualizadoEm), l.id).toBeLessThan(30 * DIA)
    }
    // sem duplicados
    expect(new Set(novo.lares.map((l) => l.id)).size).toBe(novo.lares.length)
    expect(new Set(novo.users.map((u) => u.id)).size).toBe(novo.users.length)
    // e ficou gravado
    expect(JSON.parse(local.getItem(DB_KEY)!).seededAt).toBe(novo.seededAt)
  })

  it('não mexe em dados com menos de 12 horas', () => {
    const agora = Date.now()
    const db = createSeed(agora - 2 * 3_600_000)
    const r = lerDB(JSON.stringify(db), agora)
    expect(r.mudou).toBe(false)
    expect(r.db.seededAt).toBe(db.seededAt)
  })

  it('dados com outra forma ou corrompidos dão um seed novo', () => {
    const agora = Date.now()
    const db = createSeed(agora)
    ;(db.lares[0] as { quartos: unknown }).quartos = null
    expect(lerDB(JSON.stringify(db), agora).db.lares[0]!.quartos).toBeInstanceOf(Array)
    expect(lerDB('{nada', agora).mudou).toBe(true)
    expect(lerDB(JSON.stringify({ ...createSeed(agora), version: SEED_VERSION - 1 }), agora).db.version).toBe(SEED_VERSION)
  })

  it('rebaseDemo não duplica favoritos do seed', () => {
    const agora = Date.now()
    const { db } = dbAntiga(agora)
    const fresco = createSeed(agora)
    const r = rebaseDemo(db, fresco)
    const chaves = r.favoritos.map((f) => `${f.userId}|${f.larId}`)
    expect(new Set(chaves).size).toBe(chaves.length)
    expect(r.favoritos.length).toBe(fresco.favoritos.length + 1)
  })
})
