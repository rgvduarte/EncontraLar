/**
 * Passagem do formulário para o ecrã final (/visitas/:larId/feita), só em memória: a palavra-passe provisória da
 * conta criada nunca vai para o endereço, o histórico do navegador nem o armazenamento. Recarregar o ecrã final
 * (ou voltar a ele mais tarde) já não a mostra: é mostrada uma vez.
 */
import type { Mudanca } from './formulario'

export interface Entrega {
  larId: string
  visitaId: string
  mudancas: Mudanca[]
  conta?: { email: string; palavraPasse: string }
}

let atual: Entrega | null = null

export function guardarEntrega(e: Entrega) {
  atual = e
}

/** A entrega desta instituição, se ainda existir (não a apaga: ver `esquecerEntrega`). */
export function lerEntrega(larId: string | undefined): Entrega | null {
  return atual && atual.larId === larId ? atual : null
}

export function esquecerEntrega(visitaId: string) {
  if (atual?.visitaId === visitaId) atual = null
}
