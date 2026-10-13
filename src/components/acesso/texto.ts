import { PLANOS_FAMILIA, precoTexto } from '@/lib/acesso'

/**
 * Palavras fixas do Acesso Família (docs/DESIGN.md, "Acesso Família"). Usar exatamente estas, em todo o lado:
 * tom calmo e honesto, sem "premium", sem urgência nem contagens decrescentes.
 */
export const ACESSO_DISPONIVEL = 'Disponível com o Acesso Família'
export const ACESSO_CTA = 'Ver o Acesso Família'
/** O que uma instituição (role 'lar') vê no lugar do convite: o Acesso Família é para famílias. */
export const ACESSO_PARA_LARES = 'Informação para famílias com Acesso Família.'
export const ACESSO_SEM_PRIORIDADE = 'Pagar não muda a ordem dos resultados nem dá prioridade nas vagas.'
export const ACESSO_CONDICOES = 'IVA incluído. Sem renovação automática.'

/** "desde 14,90 €" (o passe mais barato, IVA incluído). */
export const ACESSO_DESDE = `desde ${precoTexto(Math.min(...PLANOS_FAMILIA.map((p) => p.precoCentimos)))}`

/** Ações pagas que abrem o `AcessoNecessarioModal` quando a pessoa está na versão grátis. */
export type AcaoAcesso = 'pedir' | 'visita' | 'alerta' | 'comparar' | 'filtro' | 'contactos'

/** O que cada ação pede, numa linha. */
export const ACAO_ACESSO_TEXTO: Record<AcaoAcesso, string> = {
  pedir: 'Para enviar pedidos com o perfil de cuidados a várias casas de uma vez.',
  visita: 'Para marcar visitas às instituições, com dia e hora.',
  alerta: 'Para receber um aviso quando abrir uma vaga nas casas que escolher.',
  comparar: 'Para comparar vagas, preços por quarto e previsão de espera, lado a lado.',
  filtro: 'Para filtrar pelas casas com vaga e pelo preço de cada quarto.',
  contactos: 'Para ver o telefone e o email de cada instituição.',
}
