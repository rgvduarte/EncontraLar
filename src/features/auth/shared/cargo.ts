/**
 * O modelo `User` ainda não tem campo para o cargo do responsável de uma instituição.
 * Enquanto não existir, guardamos o cargo localmente, associado ao id do utilizador
 * (ver "alterações partilhadas propostas" no relatório da área de contas).
 */
const KEY = 'encontralar:cargos'

export function guardarCargo(userId: string, cargo: string) {
  try {
    const atual = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string>
    atual[userId] = cargo.trim()
    localStorage.setItem(KEY, JSON.stringify(atual))
  } catch {
    /* modo privado: o cargo não é essencial para o funcionamento */
  }
}
