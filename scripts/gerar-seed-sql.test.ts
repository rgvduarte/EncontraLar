/**
 * Gera (GERAR_SEED=1) ou verifica os ficheiros SQL de demonstração derivados de src/data/seed.ts.
 *   npm run db:seed-sql      → escreve supabase/seed.sql e supabase/demo/utilizadores-demo.sql
 *   npx vitest run           → falha se os ficheiros commitados estiverem desatualizados
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { gerarDemoSql, gerarSeedSql } from './gerar-seed-sql'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))

const FICHEIROS: Record<string, () => string> = {
  'supabase/seed.sql': () => gerarSeedSql(),
  'supabase/demo/utilizadores-demo.sql': () => gerarDemoSql(),
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
