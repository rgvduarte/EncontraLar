/** lerConfig: configuração tipada ou a lista de problemas (sem valores secretos), e as combinações proibidas. */
import { describe, expect, it } from 'vitest'
import { lerConfig } from '../../functions/_shared/config.ts'
import { AMBIENTE_TESTE } from './fakes.ts'

const TODAS = ['utilizador', 'webhook', 'cron', 'emissor'] as const

const MOLONI = {
  MOLONI_CLIENT_ID: 'cliente',
  MOLONI_CLIENT_SECRET: 'segredo-moloni',
  MOLONI_USERNAME: 'api@encontralar.pt',
  MOLONI_PASSWORD: 'palavra-passe-moloni',
  MOLONI_COMPANY_ID: '12345',
  MOLONI_DOCUMENT_SET_ID: '678',
  MOLONI_PRODUCT_ID_ENTRADA: '1',
  MOLONI_PRODUCT_ID_MENSALIDADE: '2',
  MOLONI_PRODUCT_ID_ACESSO: '3',
  MOLONI_TAX_ID_23: '11',
  MOLONI_TAX_ID_22: '12',
  MOLONI_TAX_ID_16: '13',
  MOLONI_PAYMENT_METHOD_ID_DEBITO: '21',
  MOLONI_PAYMENT_METHOD_ID_CARTAO: '22',
  MOLONI_PAYMENT_METHOD_ID_TRANSFERENCIA: '23',
  MOLONI_PAYMENT_METHOD_ID_MBWAY: '24',
  MOLONI_PAYMENT_METHOD_ID_MULTIBANCO: '25',
  MOLONI_COUNTRY_ID_PT: '1',
  MOLONI_LANGUAGE_ID_PT: '1',
  MOLONI_MATURITY_DATE_ID: '31',
}

const PRODUCAO = { ...AMBIENTE_TESTE, STRIPE_MODO: 'producao', STRIPE_SECRET_KEY: 'rk_live_51Real', FATURACAO_EMISSOR: 'moloni', ...MOLONI }

const problemas = (env: Record<string, string | undefined>, n: readonly (typeof TODAS)[number][] = TODAS) => {
  const r = lerConfig(env, n)
  return r.ok ? [] : r.problemas
}

describe('lerConfig', () => {
  it('ambiente de teste completo → configuração tipada', () => {
    const r = lerConfig(AMBIENTE_TESTE, TODAS)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.config).toEqual({
      supabase: { url: 'https://abcdefghijklmnop.supabase.co', chaveServico: 'chave-servico-de-teste', chaveAnonima: 'chave-anonima-de-teste' },
      stripe: { modo: 'teste', chaveSecreta: 'sk_test_51Teste', segredoWebhook: 'whsec_teste_0123456789abcdef', paisTransferencia: null },
      app: { url: 'https://encontralar.example/app/', origens: ['https://encontralar.example', 'http://localhost:5173'] },
      faturacao: { modo: 'fatura_por_entrada', emissor: 'falso', preAvisoDias: 3, diasPagamento: 15, segredoCron: 'segredo-do-cron-com-mais-de-32-caracteres!' },
      moloni: null,
    })
  })

  it('RECUSA FATURACAO_EMISSOR=falso com STRIPE_MODO=producao', () => {
    expect(problemas({ ...PRODUCAO, FATURACAO_EMISSOR: 'falso' })).toContain('FATURACAO_EMISSOR=falso só é permitido com STRIPE_MODO=teste.')
    // mesmo numa função que não emite documentos, se a variável estiver definida (os segredos são do projeto)
    expect(problemas({ ...PRODUCAO, FATURACAO_EMISSOR: 'falso' }, ['utilizador'])).toContain('FATURACAO_EMISSOR=falso só é permitido com STRIPE_MODO=teste.')
  })

  it('produção com Moloni completo → ok, com os ids numéricos', () => {
    const r = lerConfig(PRODUCAO, TODAS)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.config.moloni).toMatchObject({ companyId: 12345, impostos: { 23: 11, 22: 12, 16: 13 }, metodosPagamento: { mb_way: 24, multibanco: 25 } })
  })

  it('a chave do Stripe tem de ser do mesmo modo', () => {
    expect(problemas({ ...AMBIENTE_TESTE, STRIPE_SECRET_KEY: 'sk_live_51Real' })).toContain('STRIPE_SECRET_KEY não é uma chave de teste (STRIPE_MODO=teste).')
    expect(problemas({ ...PRODUCAO, STRIPE_SECRET_KEY: 'sk_test_x' })).toContain('STRIPE_SECRET_KEY não é uma chave de produção (STRIPE_MODO=producao).')
    expect(problemas({ ...AMBIENTE_TESTE, STRIPE_SECRET_KEY: 'rk_test_restrita' })).toEqual([])
  })

  it('variáveis em falta: cada função só exige o que usa', () => {
    const { STRIPE_WEBHOOK_SECRET: _w, FATURACAO_CRON_SECRET: _c, SUPABASE_ANON_KEY: _a, APP_ORIGENS: _o, ...minimo } = AMBIENTE_TESTE
    expect(problemas(minimo, [])).toEqual([])
    expect(problemas(minimo, ['webhook'])).toEqual(['STRIPE_WEBHOOK_SECRET em falta.'])
    expect(problemas(minimo, ['cron'])).toEqual(['FATURACAO_CRON_SECRET em falta.'])
    expect(problemas(minimo, ['utilizador'])).toEqual(['SUPABASE_ANON_KEY em falta.', 'APP_ORIGENS em falta.'])
    expect(problemas({}, [])).toEqual(['SUPABASE_URL em falta.', 'SUPABASE_SERVICE_ROLE_KEY em falta.', 'STRIPE_MODO em falta.', 'STRIPE_SECRET_KEY em falta.', 'APP_URL em falta.'])
  })

  it('valores inválidos', () => {
    expect(problemas({ ...AMBIENTE_TESTE, STRIPE_MODO: 'live' })).toContain("STRIPE_MODO tem de ser 'teste' ou 'producao'.")
    expect(problemas({ ...AMBIENTE_TESTE, STRIPE_WEBHOOK_SECRET: 'segredo' })).toContain('STRIPE_WEBHOOK_SECRET tem de começar por whsec_.')
    expect(problemas({ ...AMBIENTE_TESTE, FATURACAO_CRON_SECRET: 'curto' })).toContain('FATURACAO_CRON_SECRET tem de ter pelo menos 32 caracteres.')
    expect(problemas({ ...AMBIENTE_TESTE, FATURACAO_MODO: 'anual' })[0]).toMatch(/^FATURACAO_MODO tem de ser um de/)
    expect(problemas({ ...AMBIENTE_TESTE, FATURACAO_SEPA_PRE_AVISO_DIAS: '0' })).toContain('FATURACAO_SEPA_PRE_AVISO_DIAS tem de ser um inteiro entre 1 e 30.')
    expect(problemas({ ...AMBIENTE_TESTE, STRIPE_PAIS_TRANSFERENCIA: 'PT' })[0]).toMatch(/^STRIPE_PAIS_TRANSFERENCIA tem de ser um de/)
    expect(problemas({ ...AMBIENTE_TESTE, APP_ORIGENS: 'encontralar.pt' })[0]).toMatch(/^APP_ORIGENS: origem inválida/)
    expect(problemas({ ...PRODUCAO, MOLONI_COMPANY_ID: 'abc' })).toContain('MOLONI_COMPANY_ID tem de ser um id numérico do Moloni.')
    expect(problemas({ ...PRODUCAO, MOLONI_PASSWORD: '' })).toContain('MOLONI_PASSWORD em falta.')
  })

  it('APP_URL: https; http só em localhost e em teste; nunca # nem ?', () => {
    expect(problemas({ ...AMBIENTE_TESTE, APP_URL: 'http://localhost:5173/' })).toEqual([])
    expect(problemas({ ...PRODUCAO, APP_URL: 'http://localhost:5173/' })).toContain('APP_URL tem de ser https (http só para localhost em modo teste).')
    expect(problemas({ ...AMBIENTE_TESTE, APP_URL: 'http://encontralar.pt/' })).toContain('APP_URL tem de ser https (http só para localhost em modo teste).')
    expect(problemas({ ...AMBIENTE_TESTE, APP_URL: 'https://encontralar.pt/#/' })[0]).toMatch(/não pode ter '#'/)
  })

  it('os problemas nunca contêm valores secretos', () => {
    const env = { ...PRODUCAO, STRIPE_SECRET_KEY: 'sk_test_SEGREDO123', STRIPE_WEBHOOK_SECRET: 'SEGREDOWEBHOOK', FATURACAO_CRON_SECRET: 'SEGREDOCRON', MOLONI_COMPANY_ID: 'SEGREDOMOLONI' }
    const texto = problemas(env).join(' ')
    expect(texto).not.toMatch(/SEGREDO/)
  })
})
