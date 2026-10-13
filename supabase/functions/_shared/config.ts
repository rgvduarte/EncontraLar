/**
 * Configuração das funções a partir das variáveis de ambiente (segredos do Supabase). lerConfig devolve a
 * configuração tipada ou a lista de problemas — os problemas nomeiam a variável, nunca o valor.
 *
 * Regras de segurança:
 * - STRIPE_MODO=teste exige chaves sk_test_/rk_test_; producao exige sk_live_/rk_live_;
 * - FATURACAO_EMISSOR=falso só com STRIPE_MODO=teste (o emissor falso não tem valor fiscal);
 * - FATURACAO_CRON_SECRET com pelo menos 32 caracteres;
 * - APP_URL em https (http só para localhost em modo teste), sem '#'.
 */
import type { ModoDocumento } from './portas.ts'

export type ModoStripe = 'teste' | 'producao'
export type TipoEmissor = 'moloni' | 'falso'

/** O que cada função precisa além do básico (Supabase de serviço, Stripe e APP_URL). */
export type Necessidade = 'utilizador' | 'webhook' | 'cron' | 'emissor'

export interface ConfigMoloni {
  clientId: string
  clientSecret: string
  username: string
  password: string
  companyId: number
  documentSetId: number
  produtos: { entrada: number; mensalidade: number; acesso: number }
  impostos: { 23: number; 22: number; 16: number }
  metodosPagamento: { sepa_debit: number; card: number; customer_balance: number; mb_way: number; multibanco: number }
  paisId: number
  idiomaId: number
  prazoVencimentoId: number
}

export interface Config {
  supabase: { url: string; chaveServico: string; chaveAnonima: string | null }
  stripe: { modo: ModoStripe; chaveSecreta: string; segredoWebhook: string | null; paisTransferencia: string | null }
  app: { url: string; origens: string[] }
  faturacao: {
    modo: ModoDocumento
    emissor: TipoEmissor
    preAvisoDias: number
    diasPagamento: number
    segredoCron: string | null
  }
  moloni: ConfigMoloni | null
}

export type ResultadoConfig = { ok: true; config: Config } | { ok: false; problemas: string[] }

export type Ambiente = Readonly<Record<string, string | undefined>>

const MODOS_DOCUMENTO: readonly ModoDocumento[] = ['fatura_por_entrada', 'fatura_mensal', 'fatura_recibo_mensal']
const PAISES_TRANSFERENCIA = ['BE', 'DE', 'ES', 'FR', 'IE', 'NL']

export function lerConfig(env: Ambiente, necessidades: readonly Necessidade[] = []): ResultadoConfig {
  const problemas: string[] = []
  const precisa = (n: Necessidade) => necessidades.includes(n)
  const txt = (k: string) => {
    const v = env[k]?.trim()
    return v ? v : null
  }
  const obrigatorio = (k: string) => {
    const v = txt(k)
    if (!v) problemas.push(`${k} em falta.`)
    return v ?? ''
  }
  const inteiro = (k: string, omissao: number, min: number, max: number) => {
    const v = txt(k)
    if (v === null) return omissao
    const n = Number(v)
    if (!Number.isInteger(n) || n < min || n > max) {
      problemas.push(`${k} tem de ser um inteiro entre ${min} e ${max}.`)
      return omissao
    }
    return n
  }

  // ——— Supabase
  const url = obrigatorio('SUPABASE_URL')
  if (url && !/^https?:\/\/[^\s/]+\/?$/.test(url)) problemas.push('SUPABASE_URL inválido.')
  const chaveServico = obrigatorio('SUPABASE_SERVICE_ROLE_KEY')
  const chaveAnonima = precisa('utilizador') ? obrigatorio('SUPABASE_ANON_KEY') : txt('SUPABASE_ANON_KEY')

  // ——— Stripe
  const modoTxt = obrigatorio('STRIPE_MODO')
  let modo: ModoStripe = 'teste'
  if (modoTxt === 'teste' || modoTxt === 'producao') modo = modoTxt
  else if (modoTxt) problemas.push("STRIPE_MODO tem de ser 'teste' ou 'producao'.")
  const chaveSecreta = obrigatorio('STRIPE_SECRET_KEY')
  if (chaveSecreta && (modoTxt === 'teste' || modoTxt === 'producao')) {
    const prefixo = modo === 'teste' ? /^(sk|rk)_test_/ : /^(sk|rk)_live_/
    if (!prefixo.test(chaveSecreta)) problemas.push(`STRIPE_SECRET_KEY não é uma chave de ${modo === 'teste' ? 'teste' : 'produção'} (STRIPE_MODO=${modo}).`)
  }
  const segredoWebhook = precisa('webhook') ? obrigatorio('STRIPE_WEBHOOK_SECRET') : txt('STRIPE_WEBHOOK_SECRET')
  if (segredoWebhook && !segredoWebhook.startsWith('whsec_')) problemas.push('STRIPE_WEBHOOK_SECRET tem de começar por whsec_.')
  const paisTransferencia = txt('STRIPE_PAIS_TRANSFERENCIA')
  if (paisTransferencia && !PAISES_TRANSFERENCIA.includes(paisTransferencia)) problemas.push(`STRIPE_PAIS_TRANSFERENCIA tem de ser um de ${PAISES_TRANSFERENCIA.join(', ')}.`)

  // ——— app
  const appUrl = obrigatorio('APP_URL')
  if (appUrl) {
    const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(appUrl)
    if (appUrl.includes('#') || appUrl.includes('?')) problemas.push("APP_URL não pode ter '#' nem '?' (o regresso do Stripe usa a query).")
    else if (!/^https:\/\/[^\s]+$/.test(appUrl) && !(local && modo === 'teste')) problemas.push('APP_URL tem de ser https (http só para localhost em modo teste).')
  }
  const origensTxt = precisa('utilizador') ? obrigatorio('APP_ORIGENS') : txt('APP_ORIGENS') ?? ''
  const origens = origensTxt.split(',').map((o) => o.trim()).filter(Boolean)
  for (const o of origens) if (!/^https?:\/\/[^\s/]+$/.test(o)) problemas.push(`APP_ORIGENS: origem inválida (${o.slice(0, 60)}).`)

  // ——— faturação
  const modoDocTxt = txt('FATURACAO_MODO') ?? 'fatura_por_entrada'
  const modoDoc = MODOS_DOCUMENTO.find((m) => m === modoDocTxt)
  if (!modoDoc) problemas.push(`FATURACAO_MODO tem de ser um de ${MODOS_DOCUMENTO.join(', ')}.`)
  const emissorTxt = precisa('emissor') ? obrigatorio('FATURACAO_EMISSOR') : txt('FATURACAO_EMISSOR') ?? 'falso'
  let emissor: TipoEmissor = 'falso'
  if (emissorTxt === 'moloni' || emissorTxt === 'falso') emissor = emissorTxt
  else if (emissorTxt) problemas.push("FATURACAO_EMISSOR tem de ser 'moloni' ou 'falso'.")
  if (emissor === 'falso' && modo === 'producao' && (precisa('emissor') || txt('FATURACAO_EMISSOR'))) {
    problemas.push('FATURACAO_EMISSOR=falso só é permitido com STRIPE_MODO=teste.')
  }
  const preAvisoDias = inteiro('FATURACAO_SEPA_PRE_AVISO_DIAS', 3, 1, 30)
  const diasPagamento = inteiro('FATURACAO_DIAS_PAGAMENTO', 15, 1, 60)
  const segredoCron = precisa('cron') ? obrigatorio('FATURACAO_CRON_SECRET') : txt('FATURACAO_CRON_SECRET')
  if (segredoCron && segredoCron.length < 32) problemas.push('FATURACAO_CRON_SECRET tem de ter pelo menos 32 caracteres.')

  // ——— Moloni (só quando é o emissor)
  let moloni: ConfigMoloni | null = null
  if (emissor === 'moloni' && (precisa('emissor') || txt('FATURACAO_EMISSOR') === 'moloni')) {
    const id = (k: string) => {
      const v = obrigatorio(k)
      if (!v) return 0
      const n = Number(v)
      if (!Number.isInteger(n) || n <= 0) {
        problemas.push(`${k} tem de ser um id numérico do Moloni.`)
        return 0
      }
      return n
    }
    moloni = {
      clientId: obrigatorio('MOLONI_CLIENT_ID'),
      clientSecret: obrigatorio('MOLONI_CLIENT_SECRET'),
      username: obrigatorio('MOLONI_USERNAME'),
      password: obrigatorio('MOLONI_PASSWORD'),
      companyId: id('MOLONI_COMPANY_ID'),
      documentSetId: id('MOLONI_DOCUMENT_SET_ID'),
      produtos: { entrada: id('MOLONI_PRODUCT_ID_ENTRADA'), mensalidade: id('MOLONI_PRODUCT_ID_MENSALIDADE'), acesso: id('MOLONI_PRODUCT_ID_ACESSO') },
      impostos: { 23: id('MOLONI_TAX_ID_23'), 22: id('MOLONI_TAX_ID_22'), 16: id('MOLONI_TAX_ID_16') },
      metodosPagamento: {
        sepa_debit: id('MOLONI_PAYMENT_METHOD_ID_DEBITO'),
        card: id('MOLONI_PAYMENT_METHOD_ID_CARTAO'),
        customer_balance: id('MOLONI_PAYMENT_METHOD_ID_TRANSFERENCIA'),
        mb_way: id('MOLONI_PAYMENT_METHOD_ID_MBWAY'),
        multibanco: id('MOLONI_PAYMENT_METHOD_ID_MULTIBANCO'),
      },
      paisId: id('MOLONI_COUNTRY_ID_PT'),
      idiomaId: id('MOLONI_LANGUAGE_ID_PT'),
      prazoVencimentoId: id('MOLONI_MATURITY_DATE_ID'),
    }
  }

  if (problemas.length) return { ok: false, problemas }
  return {
    ok: true,
    config: {
      supabase: { url: url.replace(/\/$/, ''), chaveServico, chaveAnonima },
      stripe: { modo, chaveSecreta, segredoWebhook, paisTransferencia },
      // mantém a barra final (GitHub Pages serve a app em /<repo>/)
      app: { url: appUrl, origens },
      faturacao: { modo: modoDoc!, emissor, preAvisoDias, diasPagamento, segredoCron },
      moloni,
    },
  }
}
