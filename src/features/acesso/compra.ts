/**
 * Regras da página /acesso e da folha de compra (simulação do pagamento; na versão real é o Stripe Checkout).
 * Funções puras: testadas em compra.test.ts.
 */
import type { PlanoFamiliaId, Role } from '@/types'
import { PLANOS_FAMILIA, precoPorDia, precoTexto, type PlanoFamilia } from '@/lib/acesso'
import { diaPorExtenso, isoDia } from '@/lib/format'

/** O passe recomendado (o que vem escolhido quando não há `?plano=`). */
export const PLANO_PADRAO: PlanoFamiliaId = PLANOS_FAMILIA.find((p) => p.destaque)?.id ?? 'acesso_90'

/** `?plano=` válido, ou null. */
export function planoDoParam(v: string | null | undefined): PlanoFamiliaId | null {
  return PLANOS_FAMILIA.find((p) => p.id === v)?.id ?? null
}

/**
 * Quem está a ver a página decide as ações:
 * - convidado: criar conta (ou entrar) e voltar aqui;
 * - família sem passe: abre a folha de compra; família com passe: "Somar" dias;
 * - instituição ou profissional: só a explicação (o passe é para famílias).
 */
export type Visitante = 'convidado' | 'familia' | 'familia-ativa' | 'lar' | 'profissional'

export function tipoVisitante(role: Role | undefined, ativo: boolean): Visitante {
  if (!role) return 'convidado'
  if (role === 'familia') return ativo ? 'familia-ativa' : 'familia'
  return role
}

/** "menos de 0,34 € por dia": arredonda para cima ao cêntimo (se a conta for certa, sem o "menos de"). */
export function porDiaTexto(p: PlanoFamilia): string {
  const centimos = precoPorDia(p) * 100
  const teto = Math.ceil(centimos - 1e-9)
  const exato = Math.abs(teto - centimos) < 1e-9
  return `${exato ? '' : 'menos de '}${precoTexto(teto)} por dia`
}

/** "segunda-feira, 11 de janeiro" (com o ano quando não é o ano corrente). */
export function ateExtenso(iso: string, agora = new Date()): string {
  const d = new Date(iso)
  const dia = diaPorExtenso(isoDia(d))
  return d.getFullYear() === agora.getFullYear() ? dia : `${dia} de ${d.getFullYear()}`
}

/** "faltam 80 dias" / "falta 1 dia" */
export const faltamTexto = (n: number) => (n === 1 ? 'falta 1 dia' : `faltam ${n} dias`)

/** "faltam 80 dias" → "Faltam 80 dias" */
export const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

// ————————————————————————————————————————— caminhos

/**
 * Para onde segue "Continuar" depois de comprar: só um caminho interno ("/…", nunca "//…" nem "/\…"),
 * e nunca a própria página do Acesso Família nem as páginas de entrar ou criar conta.
 */
export function voltarSeguro(v: string | null | undefined): string | null {
  if (!v || !v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null
  if (/^\/(acesso|entrar|registar)(?=$|[/?#])/.test(v)) return null
  return v
}

/** "/acesso?plano=acesso_90&voltar=%2Flar%2Fx": o regresso a esta página depois de criar conta ou entrar. */
export function linkAcessoPlano(plano: PlanoFamiliaId | null, voltar: string | null): string {
  const q = new URLSearchParams()
  if (plano) q.set('plano', plano)
  if (voltar) q.set('voltar', voltar)
  const s = q.toString()
  return s ? `/acesso?${s}` : '/acesso'
}

/** Criar conta de família e voltar aqui, com o passe escolhido (a folha abre sozinha ao regressar). */
export const linkRegisto = (plano: PlanoFamiliaId, voltar: string | null) =>
  `/registar?tipo=familia&voltar=${encodeURIComponent(linkAcessoPlano(plano, voltar))}`

/** Entrar e voltar aqui (com o passe, se já tiver sido escolhido). */
export const linkEntrar = (plano: PlanoFamiliaId | null, voltar: string | null) =>
  `/entrar?voltar=${encodeURIComponent(linkAcessoPlano(plano, voltar))}`

// ————————————————————————————————————————— pagamento (simulação)

export const digitos = (v: string) => v.replace(/\D/g, '')

/** Número de telemóvel sem espaços nem indicativo (+351 / 00351). */
function telemovelNacional(v: string): string {
  let d = v.replace(/[\s.()-]/g, '')
  if (d.startsWith('+351')) d = d.slice(4)
  else if (d.startsWith('00351')) d = d.slice(5)
  return d
}

/** MB WAY: telemóvel português, 9 dígitos a começar por 9. */
export function validarTelemovelMbway(v: string): string | undefined {
  const d = telemovelNacional(v)
  if (!d) return 'Indique o número de telemóvel associado ao MB WAY.'
  if (!/^9\d{8}$/.test(d)) return 'O número deve ter 9 dígitos e começar por 9, por exemplo 912 345 678.'
  return undefined
}

/** O telemóvel da conta, para começar preenchido (só se servir para MB WAY): "912 345 678". */
export function telemovelInicial(telefone: string | undefined): string {
  if (!telefone || validarTelemovelMbway(telefone)) return ''
  const d = telemovelNacional(telefone)
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`
}

/** O único cartão aceite na demonstração (o cartão de teste habitual dos pagamentos online). */
export const CARTAO_TESTE = '4242 4242 4242 4242'

/** "4242424242424242" → "4242 4242 4242 4242" (no máximo 16 dígitos). */
export const formatarCartao = (v: string) =>
  digitos(v)
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ')

export function validarCartao(v: string): string | undefined {
  const d = digitos(v)
  if (!d) return 'Indique o número do cartão de teste.'
  if (d !== digitos(CARTAO_TESTE)) return `Nesta demonstração só funciona o cartão de teste ${CARTAO_TESTE}.`
  return undefined
}

/** "1229" → "12/29" */
export function formatarValidade(v: string): string {
  const d = digitos(v).slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d
}

/** Validade MM/AA: o cartão vale até ao último dia desse mês. */
export function validarValidade(v: string, agora = new Date()): string | undefined {
  const t = v.trim()
  if (!t) return 'Indique a validade do cartão.'
  const m = /^(\d{2})\/(\d{2})$/.exec(t)
  if (!m) return 'Escreva a validade como MM/AA, por exemplo 12/29.'
  const mes = Number(m[1])
  if (mes < 1 || mes > 12) return 'O mês da validade vai de 01 a 12.'
  const fimDoMes = new Date(2000 + Number(m[2]), mes, 1) // 1.º dia do mês seguinte
  if (fimDoMes.getTime() <= agora.getTime()) return 'Esta validade já passou. Use uma data futura.'
  return undefined
}

export function validarCvc(v: string): string | undefined {
  const t = v.trim()
  if (!t) return 'Indique o CVC, os 3 dígitos no verso do cartão.'
  if (!/^\d{3,4}$/.test(t)) return 'O CVC tem 3 ou 4 dígitos.'
  return undefined
}

/** Validade de exemplo para o cartão de teste: dezembro, daqui a 3 anos ("12/29"). */
export const validadeTeste = (agora = new Date()) => `12/${String((agora.getFullYear() + 3) % 100).padStart(2, '0')}`

/** Referência Multibanco fictícia (na versão real é gerada pelo prestador de pagamentos). */
export const MULTIBANCO_DEMO = { entidade: '12345', referencia: '123 456 789' } as const
