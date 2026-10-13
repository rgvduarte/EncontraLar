/**
 * Acesso Família — o lado das famílias no modelo de dois lados (docs/MODELO-NEGOCIO.md).
 *
 * - Explorar é grátis e genérico: que instituições existem, onde, o tipo, a faixa de preço e a verificação.
 * - O Acesso Família (passe de 30 ou 90 dias, sem renovação automática) abre a camada viva: que instituições
 *   têm vaga e quantos lugares, preços por quarto, previsão de espera, contactos, pedidos a várias casas,
 *   visitas e alertas.
 * - Instituições privadas pagam uma taxa fixa por entrada (por contrato; nunca em páginas públicas);
 *   IPSS e Misericórdias não pagam; profissionais de saúde têm acesso completo, sem custos.
 *
 * Pagar não muda a ordem dos resultados nem dá prioridade nas vagas.
 *
 * Nota: no protótipo os dados vivem no navegador, por isso o bloqueio é só de apresentação. Na versão com
 * servidor, a camada viva não sai da base de dados para quem não tem acesso (ver docs/SUPABASE.md).
 */
import type { AcessoFamilia, Lar, PlanoFamiliaId, User } from '@/types'
import { disponibilidade, estimarEspera, vagaParaNovos } from './forecast'

export interface PlanoFamilia {
  id: PlanoFamiliaId
  /** "30 dias" */
  nome: string
  dias: number
  /** IVA incluído */
  precoCentimos: number
  resumo: string
  destaque?: boolean
}

export const PLANOS_FAMILIA: readonly PlanoFamilia[] = [
  { id: 'acesso_30', nome: '30 dias', dias: 30, precoCentimos: 1490, resumo: 'Para uma procura urgente, como uma alta hospitalar.' },
  { id: 'acesso_90', nome: '90 dias', dias: 90, precoCentimos: 2990, resumo: 'O tempo habitual de uma procura, com folga.', destaque: true },
]

/** IVA incluído nos preços às famílias (Continente). */
export const IVA_FAMILIA_PERCENT = 23

/**
 * Taxa por entrada das instituições privadas (+ IVA, valor de contrato). Não aparece em páginas públicas:
 * serve o painel privado da instituição e a documentação.
 */
export const TAXA_ENTRADA_PRIVADO_CENTIMOS = 15000

export const planoFamilia = (id: PlanoFamiliaId): PlanoFamilia => PLANOS_FAMILIA.find((p) => p.id === id) ?? PLANOS_FAMILIA[0]!

/** "14,90 €" */
export const precoTexto = (centimos: number) => (centimos / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })

/** Preço por dia de um passe (para comparações honestas: "menos de 0,35 € por dia"). */
export const precoPorDia = (p: PlanoFamilia) => p.precoCentimos / p.dias / 100

export function acessoAtivo(a: AcessoFamilia | undefined, agora = Date.now()): boolean {
  return !!a && Date.parse(a.ate) > agora
}

/** Vê a camada completa (vagas, preços, previsão, contactos, pedidos)? Profissionais: sempre; famílias: com passe ativo. */
export function temAcessoCompleto(user: Pick<User, 'role' | 'acesso'> | null | undefined, agora = Date.now()): boolean {
  if (!user) return false
  if (user.role === 'profissional') return true
  if (user.role === 'familia') return acessoAtivo(user.acesso, agora)
  return false
}

/** Dias (inteiros, arredondados para cima) até o passe terminar; 0 se já terminou. */
export function diasRestantes(a: AcessoFamilia | undefined, agora = Date.now()): number {
  if (!a) return 0
  return Math.max(0, Math.ceil((Date.parse(a.ate) - agora) / 86_400_000))
}

/** Novo fim do acesso ao comprar um passe: soma ao que ainda falta (nunca se perdem dias pagos). */
export function novoAte(atual: AcessoFamilia | undefined, plano: PlanoFamilia, agora = Date.now()): string {
  const base = acessoAtivo(atual, agora) ? Date.parse(atual!.ate) : agora
  return new Date(base + plano.dias * 86_400_000).toISOString()
}

/** Faixa de preço genérica (o preço exato por quarto é do Acesso Família). */
export function faixaPreco(lar: Pick<Lar, 'mensalidadeMin' | 'natureza'>): string {
  if (lar.natureza !== 'privado') return 'Conforme os rendimentos'
  const v = lar.mensalidadeMin
  if (v < 1000) return 'Até 1.000 €/mês'
  if (v < 2000) return '1.000 € a 2.000 €/mês'
  return 'Mais de 2.000 €/mês'
}

/** Números agregados de uma zona (o "quantas", nunca o "quais") — o que a versão grátis pode mostrar. */
export function resumoDisponibilidade(lares: Parameters<typeof estimarEspera>[0][]): { total: number; comVaga: number; breve: number } {
  let comVaga = 0
  let breve = 0
  for (const l of lares) {
    const est = estimarEspera(l)
    if (vagaParaNovos(l, est)) comVaga++
    else if (disponibilidade(l, est) === 'breve') breve++
  }
  return { total: lares.length, comVaga, breve }
}

/** Para onde mandar quem bate num bloqueio: a página do Acesso Família, voltando ao sítio onde estava. */
export const linkAcesso = (voltar?: string) => (voltar ? `/acesso?voltar=${encodeURIComponent(voltar)}` : '/acesso')
