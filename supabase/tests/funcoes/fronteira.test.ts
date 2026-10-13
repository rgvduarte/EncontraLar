/**
 * Fronteira entre o TypeScript puro e o Deno:
 * - em _shared (fora de _shared/deno) não há npm:, jsr:, Deno., node:, require, process nem Buffer, as
 *   importações relativas terminam em .ts e o 'stripe' só entra como tipo;
 * - as versões fixadas nas importações npm: e no deno.json são as do package.json e do pacote instalado;
 * - cada função é um index.ts fino (só importa de ../_shared/ e chama servir);
 * - o código Deno (adaptadores e index.ts), que o tsc do projeto exclui, compila contra os tipos verdadeiros
 *   do SDK do Stripe e do supabase-js, com um shim mínimo para Deno.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import Stripe from 'stripe'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { EVENTOS_TRATADOS } from '../../functions/_shared/stripe/eventos.ts'
import { STRIPE_API_VERSION, STRIPE_VERSAO_PACOTE } from '../../functions/_shared/stripe/versao.ts'

const RAIZ = join(__dirname, '..', '..', '..')
const FUNCOES = join(RAIZ, 'supabase', 'functions')
const SHARED = join(FUNCOES, '_shared')
const pacote = JSON.parse(readFileSync(join(RAIZ, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> }

function ficheiros(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? ficheiros(p) : p.endsWith('.ts') ? [p] : []
  })
}

const puros = ficheiros(SHARED).filter((f) => !f.includes(`${join('_shared', 'deno')}`))
const deno = ficheiros(join(SHARED, 'deno'))
const NOMES_FUNCOES = ['acesso-checkout', 'faturacao-checkout', 'faturacao-portal', 'faturacao-documento', 'plano-instituicao', 'stripe-webhook', 'faturar-mes']
const entradas = NOMES_FUNCOES.map((n) => join(FUNCOES, n, 'index.ts'))

/** Código sem comentários (os comentários podem falar de Deno.serve). */
const codigo = (f: string) =>
  readFileSync(f, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')

describe('_shared é TypeScript puro', () => {
  it('há ficheiros a verificar', () => {
    expect(puros.length).toBeGreaterThan(20)
    expect(deno.map((f) => relative(SHARED, f)).sort()).toEqual(['deno/arranque.ts', 'deno/stripe.ts', 'deno/supabase.ts'])
  })

  it.each(puros.map((f) => [relative(FUNCOES, f), f]))('%s: sem npm:, jsr:, Deno., node:, require, process, Buffer', (_n, f) => {
    const c = codigo(f)
    expect(c).not.toMatch(/['"](npm|jsr):/)
    expect(c).not.toMatch(/\bDeno\./)
    expect(c).not.toMatch(/\bEdgeRuntime\b/)
    expect(c).not.toMatch(/from\s+['"]node:/)
    expect(c).not.toMatch(/\brequire\(/)
    expect(c).not.toMatch(/\bprocess\./)
    expect(c).not.toMatch(/\bBuffer\b/)
  })

  it.each(puros.map((f) => [relative(FUNCOES, f), f]))('%s: importações relativas com .ts; stripe só como tipo', (_n, f) => {
    const c = codigo(f)
    for (const m of c.matchAll(/(import|export)\s+(type\s+)?[^'"]*?from\s+['"]([^'"]+)['"]/g)) {
      const [, , tipo, alvo] = m
      if (alvo!.startsWith('.')) expect(alvo, `${f}: ${alvo}`).toMatch(/\.ts$/)
      else {
        expect(alvo).toBe('stripe')
        expect(tipo, `${f}: 'stripe' tem de ser import type`).toBeTruthy()
      }
    }
  })
})

describe('versões fixadas', () => {
  const stripeExato = pacote.devDependencies.stripe!
  const supabaseExato = pacote.dependencies['@supabase/supabase-js']!

  it('package.json fixa versões exatas', () => {
    expect(stripeExato).toMatch(/^\d+\.\d+\.\d+$/)
    expect(supabaseExato).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('stripe: package.json = pacote instalado = versao.ts; API do pacote = STRIPE_API_VERSION', () => {
    const instalado = JSON.parse(readFileSync(join(RAIZ, 'node_modules', 'stripe', 'package.json'), 'utf8')).version
    expect(instalado).toBe(stripeExato)
    expect(STRIPE_VERSAO_PACOTE).toBe(stripeExato)
    expect(Stripe.API_VERSION).toBe(STRIPE_API_VERSION)
    // MB WAY exige 2025-10-29.clover ou posterior
    expect(STRIPE_API_VERSION >= '2025-10-29').toBe(true)
  })

  it('as importações npm: do Deno usam essas versões (e só essas)', () => {
    const especificadores = [...deno, ...entradas].flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/['"](npm:[^'"]+)['"]/g)].map((m) => m[1]))
    expect(new Set(especificadores)).toEqual(new Set([`npm:stripe@${stripeExato}`, `npm:@supabase/supabase-js@${supabaseExato}`]))
  })

  it('deno.json mapeia os mesmos pacotes nas mesmas versões', () => {
    const d = JSON.parse(readFileSync(join(FUNCOES, 'deno.json'), 'utf8')) as { imports: Record<string, string> }
    expect(d.imports).toEqual({ stripe: `npm:stripe@${stripeExato}`, '@supabase/supabase-js': `npm:@supabase/supabase-js@${supabaseExato}` })
  })
})

describe('funções finas', () => {
  it.each(NOMES_FUNCOES)('%s/index.ts só importa de ../_shared/ e chama servir', (nome) => {
    const c = codigo(join(FUNCOES, nome, 'index.ts'))
    const importacoes = [...c.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]!)
    expect(importacoes.length).toBeGreaterThan(0)
    for (const i of importacoes) expect(i).toMatch(/^\.\.\/_shared\/.+\.ts$/)
    expect(c).toMatch(new RegExp(`servir\\('${nome}'`))
    expect(c.split('\n').filter((l) => l.trim()).length).toBeLessThan(30)
  })

  it('README: secção "Faturação: funções", todas as funções, todos os eventos do webhook e a versão da API', () => {
    const r = readFileSync(join(FUNCOES, 'README.md'), 'utf8')
    expect(r).toMatch(/^## Faturação: funções/m)
    for (const n of NOMES_FUNCOES) expect(r).toContain(n)
    for (const e of EVENTOS_TRATADOS) expect(r).toContain(e)
    expect(r).toContain(STRIPE_API_VERSION)
  })
})

describe('o código Deno compila contra os SDK verdadeiros', () => {
  it('adaptadores e index.ts sem erros de tipos (shim mínimo de Deno)', () => {
    const shim = join(FUNCOES, '__shim_deno__.d.ts')
    const conteudoShim = `
      declare namespace Deno {
        const env: { get(k: string): string | undefined; toObject(): Record<string, string> }
        function serve(h: (req: Request) => Response | Promise<Response>): unknown
      }`
    const opcoes: ts.CompilerOptions = {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ['lib.es2023.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      allowImportingTsExtensions: true,
      isolatedModules: true,
      noUnusedLocals: true,
      noUnusedParameters: true,
      types: [],
      baseUrl: RAIZ,
      // como o deno.json: 'stripe' (importação de tipos em _shared) e npm:stripe@x são o MESMO módulo
      paths: {
        stripe: ['node_modules/stripe'],
        [`npm:stripe@${pacote.devDependencies.stripe}`]: ['node_modules/stripe'],
        [`npm:@supabase/supabase-js@${pacote.dependencies['@supabase/supabase-js']}`]: ['node_modules/@supabase/supabase-js'],
      },
    }
    const host = ts.createCompilerHost(opcoes)
    const original = { getSourceFile: host.getSourceFile, fileExists: host.fileExists, readFile: host.readFile }
    host.fileExists = (f) => f === shim || original.fileExists(f)
    host.readFile = (f) => (f === shim ? conteudoShim : original.readFile(f))
    host.getSourceFile = (f, v, ...r) => (f === shim ? ts.createSourceFile(f, conteudoShim, v) : original.getSourceFile(f, v, ...r))
    const programa = ts.createProgram([shim, ...deno, ...entradas], opcoes, host)
    const erros = ts.getPreEmitDiagnostics(programa).map((d) => `${d.file ? relative(RAIZ, d.file.fileName) : ''}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
    expect(erros).toEqual([])
  }, 60_000)
})
