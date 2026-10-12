import type { PerfilInput } from '@/lib/store'

/** Chave onde o questionário /encontrar guarda o perfil ainda sem conta (ver docs/DESIGN.md). */
export const RASCUNHO_KEY = 'encontralar:perfil-rascunho'

export function temRascunho(): boolean {
  try {
    return Boolean(sessionStorage.getItem(RASCUNHO_KEY))
  } catch {
    return false
  }
}

/** Resumo legível do rascunho, para o mostrar antes de criar a conta. */
export function lerRascunho(): { nome?: string; relacao?: string; idade?: number; local?: string } | null {
  try {
    const raw = sessionStorage.getItem(RASCUNHO_KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<PerfilInput>
    return {
      nome: typeof p.nome === 'string' && p.nome.trim() ? p.nome.trim() : undefined,
      relacao: typeof p.relacao === 'string' ? p.relacao : undefined,
      idade: typeof p.idade === 'number' && p.idade > 0 ? p.idade : undefined,
      local: typeof p.local?.label === 'string' ? p.local.label : undefined,
    }
  } catch {
    // existe mas não é JSON válido: ainda assim, o painel decide o que fazer com ele
    return temRascunho() ? {} : null
  }
}
