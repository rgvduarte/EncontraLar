import { describe, expect, it } from 'vitest'
import { planoFamilia } from '@/lib/acesso'
import {
  ateExtenso,
  faltamTexto,
  formatarCartao,
  formatarValidade,
  linkAcessoPlano,
  linkEntrar,
  linkRegisto,
  planoDoParam,
  PLANO_PADRAO,
  porDiaTexto,
  telemovelInicial,
  tipoVisitante,
  validadeTeste,
  validarCartao,
  validarCvc,
  validarTelemovelMbway,
  validarValidade,
  voltarSeguro,
} from './compra'

/** O que o /registar e o /entrar recebem em `voltar`, e o que a página /acesso lê de volta. */
function lerVoltar(link: string) {
  const voltar = new URLSearchParams(link.slice(link.indexOf('?') + 1)).get('voltar')!
  const dentro = new URLSearchParams(voltar.slice(voltar.indexOf('?') + 1))
  return { voltar, plano: dentro.get('plano'), destino: dentro.get('voltar') }
}

describe('passes', () => {
  it('o recomendado é o de 90 dias', () => {
    expect(PLANO_PADRAO).toBe('acesso_90')
    expect(planoDoParam('acesso_30')).toBe('acesso_30')
    expect(planoDoParam('acesso_365')).toBeNull()
    expect(planoDoParam(null)).toBeNull()
  })

  it('preço por dia honesto: arredonda para cima e diz "menos de"', () => {
    expect(porDiaTexto(planoFamilia('acesso_90'))).toBe('menos de 0,34 € por dia')
    expect(porDiaTexto(planoFamilia('acesso_30'))).toBe('menos de 0,50 € por dia')
    // conta certa: sem "menos de"
    expect(porDiaTexto({ ...planoFamilia('acesso_30'), precoCentimos: 900 })).toBe('0,30 € por dia')
  })

  it('quem vê o quê', () => {
    expect(tipoVisitante(undefined, false)).toBe('convidado')
    expect(tipoVisitante('familia', false)).toBe('familia')
    expect(tipoVisitante('familia', true)).toBe('familia-ativa')
    expect(tipoVisitante('lar', false)).toBe('lar')
    expect(tipoVisitante('profissional', false)).toBe('profissional')
  })

  it('datas e dias por extenso', () => {
    const agora = new Date(2026, 9, 13, 10)
    expect(ateExtenso(new Date(2026, 11, 31, 12).toISOString(), agora)).toBe('quinta-feira, 31 de dezembro')
    expect(ateExtenso(new Date(2027, 0, 11, 12).toISOString(), agora)).toBe('segunda-feira, 11 de janeiro de 2027')
    expect(faltamTexto(1)).toBe('falta 1 dia')
    expect(faltamTexto(80)).toBe('faltam 80 dias')
  })
})

describe('caminhos', () => {
  it('só segue para caminhos internos, nunca de volta às páginas de conta', () => {
    expect(voltarSeguro('/lar/lar-jardins-do-douro')).toBe('/lar/lar-jardins-do-douro')
    expect(voltarSeguro('/lar/x?acao=pedir')).toBe('/lar/x?acao=pedir')
    expect(voltarSeguro('//exemplo.com')).toBeNull()
    expect(voltarSeguro('/\\exemplo.com')).toBeNull()
    expect(voltarSeguro('https://exemplo.com')).toBeNull()
    expect(voltarSeguro('/acesso?plano=acesso_90')).toBeNull()
    expect(voltarSeguro('/entrar')).toBeNull()
    expect(voltarSeguro('/registar?tipo=familia')).toBeNull()
    expect(voltarSeguro('/acessorios')).toBe('/acessorios')
    expect(voltarSeguro(null)).toBeNull()
  })

  it('criar conta e entrar voltam ao /acesso com o passe e o destino intactos', () => {
    const r = lerVoltar(linkRegisto('acesso_90', '/lar/x?acao=pedir'))
    expect(linkRegisto('acesso_90', null).startsWith('/registar?tipo=familia&voltar=')).toBe(true)
    expect(r.voltar).toBe('/acesso?plano=acesso_90&voltar=%2Flar%2Fx%3Facao%3Dpedir')
    expect(r.plano).toBe('acesso_90')
    expect(r.destino).toBe('/lar/x?acao=pedir')

    const e = lerVoltar(linkEntrar(null, '/pesquisa?lugar=Porto'))
    expect(e.plano).toBeNull()
    expect(e.destino).toBe('/pesquisa?lugar=Porto')
    expect(linkAcessoPlano(null, null)).toBe('/acesso')
    expect(linkAcessoPlano('acesso_30', null)).toBe('/acesso?plano=acesso_30')
  })
})

describe('pagamento simulado', () => {
  it('MB WAY: 9 dígitos a começar por 9', () => {
    expect(validarTelemovelMbway('912 345 678')).toBeUndefined()
    expect(validarTelemovelMbway('+351 912345678')).toBeUndefined()
    expect(validarTelemovelMbway('')).toMatch(/Indique/)
    expect(validarTelemovelMbway('212 345 678')).toMatch(/começar por 9/)
    expect(validarTelemovelMbway('91234567')).toMatch(/9 dígitos/)
    expect(telemovelInicial('912000101')).toBe('912 000 101')
    expect(telemovelInicial('220 000 042')).toBe('')
    expect(telemovelInicial(undefined)).toBe('')
  })

  it('cartão: só o de teste, validade futura, qualquer CVC', () => {
    const agora = new Date(2026, 9, 13)
    expect(formatarCartao('4242424242424242999')).toBe('4242 4242 4242 4242')
    expect(validarCartao('4242 4242 4242 4242')).toBeUndefined()
    expect(validarCartao('4000 0000 0000 0002')).toMatch(/cartão de teste/)
    expect(validarCartao('')).toMatch(/Indique/)
    expect(formatarValidade('1229')).toBe('12/29')
    expect(formatarValidade('1')).toBe('1')
    expect(validarValidade('12/29', agora)).toBeUndefined()
    expect(validarValidade('10/26', agora)).toBeUndefined() // vale até ao fim do mês
    expect(validarValidade('09/26', agora)).toMatch(/já passou/)
    expect(validarValidade('13/29', agora)).toMatch(/01 a 12/)
    expect(validarValidade('1229', agora)).toMatch(/MM\/AA/)
    expect(validarValidade(validadeTeste(agora), agora)).toBeUndefined()
    expect(validarCvc('123')).toBeUndefined()
    expect(validarCvc('1234')).toBeUndefined()
    expect(validarCvc('12')).toMatch(/3 ou 4/)
  })
})
