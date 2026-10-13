/** NIF (mod 11), região fiscal → IVA e referência EL-XXXXXXXX. */
import { describe, expect, it } from 'vitest'
import { digitoControloValido, erroNIF, NIF_CONSUMIDOR_FINAL, normalizarNIF, validarNIF } from '../../functions/_shared/faturacao/nif.ts'
import { IVA_POR_REGIAO, ivaDaRegiao, regiaoFiscal, regiaoFiscalDaRegiao, regiaoFiscalDoCodigoPostal } from '../../functions/_shared/faturacao/regiao.ts'
import { REFERENCIA_PEDIDO, referenciaPedido, referenciaValida } from '../../functions/_shared/faturacao/referencia.ts'

/** Gera o dígito de controlo de 8 dígitos (para criar NIF válidos de teste). */
function comControlo(oito: string): string {
  let soma = 0
  for (let i = 0; i < 8; i++) soma += Number(oito[i]) * (9 - i)
  const r = soma % 11
  return oito + String(r < 2 ? 0 : 11 - r)
}

describe('NIF', () => {
  it('valores de referência do v1: 599999993 e 123456789 válidos, 123456788 inválido', () => {
    expect(digitoControloValido('599999993')).toBe(true)
    expect(digitoControloValido('123456789')).toBe(true)
    expect(digitoControloValido('123456788')).toBe(false)
    expect(validarNIF('599999993', 'b2b')).toEqual({ ok: true, nif: '599999993', consumidorFinal: false })
  })

  it('999999990 passa o mod 11, mas é recusado em B2B e quer dizer consumidor final em B2C', () => {
    expect(digitoControloValido(NIF_CONSUMIDOR_FINAL)).toBe(true)
    const b2b = validarNIF('999999990', 'b2b')
    expect(b2b.ok).toBe(false)
    expect(erroNIF('999999990', 'b2b')).toMatch(/consumidor final/)
    expect(validarNIF('999999990', 'b2c')).toEqual({ ok: true, nif: '999999990', consumidorFinal: true })
  })

  it('normaliza espaços, pontos e o prefixo PT', () => {
    expect(normalizarNIF(' PT 599 999 993 ')).toBe('599999993')
    expect(normalizarNIF('599.999.993')).toBe('599999993')
    expect(validarNIF('PT599999993', 'b2b').ok).toBe(true)
  })

  it('recusa comprimento errado, letras e prefixos não atribuídos (com mensagens em PT-PT)', () => {
    expect(erroNIF('59999999', 'b2b')).toBe('O NIF tem 9 algarismos.')
    expect(erroNIF('5999999A3', 'b2c')).toBe('O NIF tem 9 algarismos.')
    expect(erroNIF('123456788', 'b2c')).toBe('Este NIF não é válido. Confirme os algarismos.')
    // prefixo 4x (só 45 existe), 0, 73, 76, 78, 92–97: mesmo com o dígito certo são recusados
    for (const p of ['40', '41', '04', '73', '76', '78', '92', '93', '95', '97']) {
      const nif = comControlo(`${p}123456`)
      expect(digitoControloValido(nif)).toBe(true)
      expect(validarNIF(nif, 'b2c').ok).toBe(false)
    }
  })

  it('aceita todos os prefixos atribuídos quando o controlo está certo', () => {
    for (const p of ['10', '25', '30', '45', '50', '60', '80', '70', '71', '72', '74', '75', '77', '79', '90', '91', '98', '99']) {
      const nif = comControlo(`${p}100200`)
      expect(validarNIF(nif, 'b2b').ok).toBe(nif !== NIF_CONSUMIDOR_FINAL)
    }
  })

  it('200 NIF aleatórios: exatamente um dígito de controlo é válido para cada base', () => {
    let semente = 7
    const aleatorio = () => (semente = (semente * 1103515245 + 12345) % 2 ** 31)
    for (let k = 0; k < 200; k++) {
      const base = `5${String(aleatorio() % 10_000_000).padStart(7, '0')}`
      const validos = [...'0123456789'].filter((d) => digitoControloValido(base + d))
      expect(validos).toEqual([comControlo(base).slice(-1)])
    }
  })
})

describe('região fiscal e IVA', () => {
  it('código postal: Madeira 9000–9499 (22 %), Açores 9500–9999 (16 %), resto Continente (23 %)', () => {
    expect(regiaoFiscalDoCodigoPostal('4200-187')).toBe('continente')
    expect(regiaoFiscalDoCodigoPostal('1000-001')).toBe('continente')
    expect(regiaoFiscalDoCodigoPostal('8999-999')).toBe('continente')
    expect(regiaoFiscalDoCodigoPostal('9000-018')).toBe('madeira') // Funchal
    expect(regiaoFiscalDoCodigoPostal('9400-123')).toBe('madeira') // Porto Santo
    expect(regiaoFiscalDoCodigoPostal('9499-999')).toBe('madeira')
    expect(regiaoFiscalDoCodigoPostal('9500-150')).toBe('acores') // Ponta Delgada
    expect(regiaoFiscalDoCodigoPostal('9700-011')).toBe('acores') // Angra
    expect(regiaoFiscalDoCodigoPostal('9980-024')).toBe('acores') // Corvo
    expect(IVA_POR_REGIAO).toEqual({ continente: 23, madeira: 22, acores: 16 })
    expect(ivaDaRegiao('madeira')).toBe(22)
  })

  it('código postal inválido → null; cai para a região da ficha', () => {
    expect(regiaoFiscalDoCodigoPostal('4200187')).toBeNull()
    expect(regiaoFiscalDoCodigoPostal('0999-000')).toBeNull()
    expect(regiaoFiscalDoCodigoPostal(null)).toBeNull()
    expect(regiaoFiscalDaRegiao('Açores')).toBe('acores')
    expect(regiaoFiscalDaRegiao('Madeira')).toBe('madeira')
    expect(regiaoFiscalDaRegiao('Norte')).toBe('continente')
    expect(regiaoFiscal(null, 'Madeira')).toBe('madeira')
    expect(regiaoFiscal('9500-150', 'Norte')).toBe('acores') // a morada fiscal manda
  })
})

describe('referência do pedido', () => {
  it('uuid → EL- + 8 primeiros hexadecimais em maiúsculas (igual a private.referencia_pedido)', () => {
    expect(referenciaPedido('3f9a2b1c-0000-4000-8000-000000000001')).toBe('EL-3F9A2B1C')
    expect(referenciaValida('EL-3F9A2B1C')).toBe(true)
  })

  it('ids de demonstração usam um hash estável', () => {
    const r = referenciaPedido('c-fam-6')
    expect(r).toMatch(REFERENCIA_PEDIDO)
    expect(referenciaPedido('c-fam-6')).toBe(r)
    expect(referenciaPedido('c-fam-7')).not.toBe(r)
  })

  it('recusa formatos inválidos', () => {
    expect(referenciaValida('EL-3f9a2b1c')).toBe(false)
    expect(referenciaValida('EL-3F9A2B1')).toBe(false)
    expect(referenciaValida('Amélia Rocha')).toBe(false)
  })
})
