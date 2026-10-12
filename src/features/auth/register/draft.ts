/** Chave onde o questionário /encontrar guarda o perfil ainda sem conta (ver docs/DESIGN.md). */
export const RASCUNHO_KEY = 'encontralar:perfil-rascunho'

/**
 * true se há respostas do questionário por guardar (mesmo que não sirvam para um perfil completo).
 * O perfil em si lê-se com `lerRascunho` de features/family/perfil/perfilModel.
 */
export function temRascunho(): boolean {
  try {
    return Boolean(sessionStorage.getItem(RASCUNHO_KEY))
  } catch {
    return false
  }
}
