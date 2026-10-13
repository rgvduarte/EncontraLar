/**
 * Gera (GERAR_SEED=1) ou verifica os ficheiros SQL de demonstração derivados de src/data/seed.ts.
 *   npm run db:seed-sql      → escreve supabase/seed.sql, supabase/demo/utilizadores-demo.sql e contas-demo.json
 *   npx vitest run           → falha se os ficheiros commitados estiverem desatualizados
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createSeed, DEMO_FAMILIA_ID, DEMO_LAR_USER_ID } from '@/data/seed'
import { AGORA_SEED, gerarContasDemoJson, gerarDemoSql, gerarSeedSql } from './gerar-seed-sql'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

const FICHEIROS: Record<string, () => string> = {
  'supabase/seed.sql': () => gerarSeedSql(),
  'supabase/demo/utilizadores-demo.sql': () => gerarDemoSql(),
  'supabase/demo/contas-demo.json': () => gerarContasDemoJson(),
}

describe('SQL de demonstração gerado a partir de src/data/seed.ts', () => {
  for (const [relativo, gerar] of Object.entries(FICHEIROS)) {
    it(`${relativo} está atualizado`, () => {
      const esperado = gerar()
      const caminho = join(RAIZ, relativo)
      if (process.env.GERAR_SEED) {
        mkdirSync(dirname(caminho), { recursive: true })
        writeFileSync(caminho, esperado)
      }
      let atual = ''
      try {
        atual = readFileSync(caminho, 'utf8')
      } catch {
        /* ficheiro em falta */
      }
      expect(atual === esperado, `${relativo} desatualizado — corra \`npm run db:seed-sql\``).toBe(true)
    })
  }
})

describe('Acesso Família das contas de demonstração', () => {
  it('a família de demonstração fica com o passe do protótipo (plano e fim relativo), antes da saída "já ligados"', () => {
    const proto = createSeed(AGORA_SEED)
    const ana = proto.users.find((u) => u.id === DEMO_FAMILIA_ID)!
    expect(ana.acesso?.plano).toBe('acesso_90')
    const sql = gerarDemoSql(AGORA_SEED, proto)
    const segundos = (Date.parse(ana.acesso!.ate) - AGORA_SEED) / 1000
    expect(sql).toContain(`values (v_familia, 'acesso_90', now() + interval '${segundos} seconds'`)
    // só ela: as outras contas do protótipo não têm passe
    expect(sql.match(/insert into public\.acessos_familia/g)).toHaveLength(proto.users.filter((u) => u.acesso).length)
    expect(sql.indexOf('insert into public.acessos_familia')).toBeLessThan(sql.indexOf('Dados de demonstração já ligados'))
  })

  it('recusa um passe numa conta que não é de família ou que já terminou', () => {
    const proto = createSeed(AGORA_SEED)
    const ana = proto.users.find((u) => u.id === DEMO_FAMILIA_ID)!
    const lar = proto.users.find((u) => u.id === DEMO_LAR_USER_ID)!
    expect(() => gerarDemoSql(AGORA_SEED, { ...proto, users: proto.users.map((u) => (u === lar ? { ...u, acesso: ana.acesso } : u)) })).toThrow(/só as famílias/)
    const terminado = { ...ana.acesso!, ate: new Date(AGORA_SEED - 1000).toISOString() }
    expect(() => gerarDemoSql(AGORA_SEED, { ...proto, users: proto.users.map((u) => (u === ana ? { ...u, acesso: terminado } : u)) })).toThrow(/já terminou/)
  })
})
