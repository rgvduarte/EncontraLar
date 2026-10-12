import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { eChaveSecreta } from './supabase'

const jwt = (payload: object) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.assinatura`

describe('eChaveSecreta', () => {
  it('reconhece chaves secretas (novas e JWT legadas service_role)', () => {
    expect(eChaveSecreta('sb_secret_abc123')).toBe(true)
    expect(eChaveSecreta(jwt({ role: 'service_role', iss: 'supabase' }))).toBe(true)
  })

  it('aceita chaves publicáveis e a anon legada', () => {
    expect(eChaveSecreta('sb_publishable_abc123')).toBe(false)
    expect(eChaveSecreta(jwt({ role: 'anon', iss: 'supabase' }))).toBe(false)
    expect(eChaveSecreta('a.b.c')).toBe(false)
  })
})

describe('configuração', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('sem variáveis de ambiente fica em modo demonstração e getSupabase rejeita', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '')
    vi.resetModules()
    const m = await import('./supabase')
    expect(m.isSupabaseConfigured).toBe(false)
    await expect(m.getSupabase()).rejects.toThrow(/não configurado/)
  })

  it('recusa uma chave secreta posta por engano na variável publicável', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://kdyvsxzputvuyauddmwg.supabase.co')
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'sb_secret_nao_usar')
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetModules()
    const m = await import('./supabase')
    expect(m.isSupabaseConfigured).toBe(false)
    expect(erro).toHaveBeenCalled()
    erro.mockRestore()
  })
})

describe('carregamento preguiçoso do supabase-js', () => {
  it('nenhum ficheiro de src importa @supabase/supabase-js estaticamente (só src/lib/supabase.ts, por import dinâmico)', () => {
    const raiz = fileURLToPath(new URL('..', import.meta.url))
    const ficheiros: string[] = []
    const percorrer = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = join(dir, n)
        if (statSync(p).isDirectory()) percorrer(p)
        else if (/\.(ts|tsx)$/.test(n) && !/\.test\.tsx?$/.test(n)) ficheiros.push(p)
      }
    }
    percorrer(raiz)
    const estaticos: string[] = []
    const dinamicos: string[] = []
    for (const f of ficheiros) {
      const src = readFileSync(f, 'utf8')
      for (const linha of src.split('\n')) {
        if (/from\s+['"]@supabase\/supabase-js['"]/.test(linha) && !/^\s*import\s+type\b/.test(linha)) estaticos.push(relative(raiz, f))
        if (/import\(\s*['"]@supabase\/supabase-js['"]\s*\)/.test(linha)) dinamicos.push(relative(raiz, f))
      }
    }
    expect(estaticos).toEqual([])
    expect(dinamicos).toEqual(['lib/supabase.ts'])
  })
})
