#!/usr/bin/env node
/**
 * Cria as contas de demonstração (supabase/demo/contas-demo.json) num projeto Supabase pela
 * Auth Admin API — com o e-mail já confirmado e o papel em app_metadata, que é o que
 * supabase/demo/utilizadores-demo.sql exige antes de lhes ligar os dados de demonstração.
 *
 * SÓ PARA BASES DE DEMONSTRAÇÃO (ramo do Supabase ou projeto à parte): as contas lar@ e familia@
 * têm a palavra-passe pública do ecrã de entrada. Recusa o projeto principal (kdyvsxzputvuyauddmwg)
 * a menos que se passe --projeto-principal de propósito.
 *
 * Uso (a chave SECRETA nunca vai para o front-end nem para o repositório):
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_… node scripts/criar-contas-demo.mjs
 *   … --simular              → mostra o que faria, sem rede
 *
 * Contas que já existam NÃO são alteradas (nem o papel): uma conta registada por outra pessoa com o
 * mesmo e-mail não pode passar a gerir o lar de demonstração. Apague-a no painel e volte a correr.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const REF_PROJETO_PRINCIPAL = 'kdyvsxzputvuyauddmwg'
const CONTAS = fileURLToPath(new URL('../supabase/demo/contas-demo.json', import.meta.url))

/** @typedef {{ nome: string, tipo: 'hospital' | 'centro_saude' | 'autarquia' | 'outro', servico?: string }} Organizacao */
/** @typedef {{ email: string, role: 'familia' | 'lar' | 'profissional', nome: string, telefone: string | null, palavraPasse: string | null, organizacao?: Organizacao }} ContaDemo */

const PAPEIS = ['familia', 'lar', 'profissional']

/** @returns {ContaDemo[]} */
export function lerContas(caminho = CONTAS) {
  const contas = JSON.parse(readFileSync(caminho, 'utf8'))
  if (!Array.isArray(contas) || contas.some((c) => !c.email || !PAPEIS.includes(c.role) || (c.role === 'profissional') !== !!c.organizacao)) {
    throw new Error(`${caminho}: formato inválido`)
  }
  return contas
}

/**
 * Corpo do pedido auth.admin.createUser. As contas sem palavra-passe pública recebem uma aleatória.
 * O papel e a organização (contas 'profissional') vão em app_metadata — definidos pelo administrador,
 * não editáveis pelo utilizador (o trigger de registo copia-os para perfis_utilizador).
 */
export function pedidoCriacao(/** @type {ContaDemo} */ c) {
  return {
    email: c.email,
    password: c.palavraPasse ?? randomBytes(24).toString('base64url'),
    email_confirm: true,
    app_metadata: { role: c.role, ...(c.organizacao ? { organizacao: c.organizacao } : {}) },
    user_metadata: { nome: c.nome, ...(c.telefone ? { telefone: c.telefone } : {}) },
  }
}

/** Recusa chaves públicas e o projeto principal (salvo --projeto-principal). Devolve o ref do projeto. */
export function verificarDestino(url, chave, args = []) {
  let host
  try {
    host = new URL(url).hostname
  } catch {
    throw new Error('Defina SUPABASE_URL (ex.: https://<ref>.supabase.co).')
  }
  if (!chave) throw new Error('Defina SUPABASE_SECRET_KEY (chave secreta do projeto de demonstração).')
  if (chave.startsWith('sb_publishable_')) throw new Error('A Auth Admin API exige a chave SECRETA, não a publicável.')
  const ref = host.split('.')[0]
  if (ref === REF_PROJETO_PRINCIPAL && !args.includes('--projeto-principal')) {
    throw new Error(
      `Recusado: ${ref} é o projeto principal. As contas de demonstração têm palavra-passe pública — use um ramo ou ` +
        'um projeto de demonstração (ou passe --projeto-principal se for mesmo essa a decisão).',
    )
  }
  return ref
}

async function main(args) {
  const contas = lerContas()
  const url = process.env.SUPABASE_URL ?? ''
  const chave = process.env.SUPABASE_SECRET_KEY ?? ''
  if (args.includes('--simular')) {
    for (const c of contas) {
      const p = pedidoCriacao(c)
      console.log(`[simular] criar ${p.email} (app_metadata.role=${c.role}, palavra-passe ${c.palavraPasse ? 'pública' : 'aleatória'})`)
    }
    return
  }
  const ref = verificarDestino(url, chave, args)
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
  let falhas = 0
  for (const c of contas) {
    const { data, error } = await sb.auth.admin.createUser(pedidoCriacao(c))
    if (!error) {
      console.log(`criada  ${c.email} → ${data.user?.id}`)
    } else if (/already|registered|exists/i.test(error.message)) {
      console.warn(`existe  ${c.email} — NÃO alterada (confirme no painel que foi criada por este script)`)
    } else {
      falhas++
      console.error(`ERRO    ${c.email}: ${error.message}`)
    }
  }
  console.log(`\nProjeto ${ref}: corra agora supabase/demo/utilizadores-demo.sql (como postgres).`)
  if (falhas) process.exitCode = 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e instanceof Error ? e.message : e)
    process.exitCode = 1
  })
}
