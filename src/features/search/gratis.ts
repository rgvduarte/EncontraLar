/**
 * Versão grátis da pesquisa (sem Acesso Família) — genérica de propósito (docs/MODELO-NEGOCIO.md, modelo de dois lados).
 *
 * A página porta-se como se a camada viva não estivesse no navegador (na versão com servidor não está):
 * - sem filtro nem ordenação por vaga: um endereço com `vaga=` ou `ordem=disponibilidade` é ignorado, com um aviso;
 * - orçamento por faixas, as mesmas de `faixaPreco` (lib/acesso): até 1.000 €, até 2.000 € ou sem limite;
 * - a ordem por omissão não usa as vagas (nem a data em que foram confirmadas): ver `ordenar` em filtering.ts;
 * - só contagens agregadas ("43 com vaga agora": quantas, nunca quais), e só a partir de `MIN_AGREGADO` instituições,
 *   para que um conjunto pequeno (uma pesquisa pelo nome, um raio curto) não diga qual tem vaga.
 *
 * Quem tem o Acesso Família (e os profissionais de saúde) vê a pesquisa completa, sem nada disto.
 */
import type { SearchState, VagaFiltro } from './searchState'

/** Fronteiras das faixas de preço, as de `faixaPreco`: abaixo de 1.000 €, abaixo de 2.000 € e o resto. */
export const FAIXAS_ORCAMENTO = [1000, 2000] as const
export type FaixaOrcamento = (typeof FAIXAS_ORCAMENTO)[number]

/** O mesmo número escrito como nos cartões ("1.000 € a 2.000 €/mês"). */
export const ROTULO_FAIXA: Record<FaixaOrcamento, string> = {
  1000: 'Até 1.000 €',
  2000: 'Até 2.000 €',
}

/** Faixa de uma mensalidade: 0 (abaixo de 1.000 €), 1 (abaixo de 2.000 €) ou 2 (o resto). */
export function indiceFaixa(mensalidade: number): number {
  const i = FAIXAS_ORCAMENTO.findIndex((f) => mensalidade < f)
  return i < 0 ? FAIXAS_ORCAMENTO.length : i
}

/** Orçamento máximo → a faixa que o contém (1.000 € ou 2.000 €); acima de 2.000 € não há teto (null). */
export function faixaDoOrcamento(max: number | null): FaixaOrcamento | null {
  if (max == null) return null
  return FAIXAS_ORCAMENTO.find((f) => max <= f) ?? null
}

/** A mensalidade de partida cabe na faixa escolhida (a mesma regra dos rótulos: 1.000 € já é "1.000 € a 2.000 €"). */
export function cabeNaFaixa(mensalidadeMin: number, max: number | null): boolean {
  const teto = faixaDoOrcamento(max)
  return teto == null || mensalidadeMin < teto
}

/** Estado efetivo da versão grátis: sem vaga, sem ordem por vaga, orçamento na faixa. */
export function estadoGratis(s: SearchState): SearchState {
  return {
    ...s,
    vaga: null,
    ordem: s.ordem === 'disponibilidade' ? 'relevancia' : s.ordem,
    max: faixaDoOrcamento(s.max),
  }
}

/** O que o endereço pedia e a versão grátis não aplica (para o aviso), ou null. */
export interface Ignorados {
  vaga: VagaFiltro | null
  ordem: boolean
}

export function ignoradosGratis(s: SearchState): Ignorados | null {
  const ordem = s.ordem === 'disponibilidade'
  return s.vaga || ordem ? { vaga: s.vaga, ordem } : null
}

/** O limite das contagens agregadas é um só, em @/lib/acesso (aqui reexportado para a pesquisa). */
export { agregadoVisivel, MIN_AGREGADO } from '@/lib/acesso'
