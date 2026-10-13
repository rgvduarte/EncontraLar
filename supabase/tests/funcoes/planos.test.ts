/**
 * Os valores comerciais do servidor (faturacao/planos.ts) são iguais aos do protótipo (src/lib/acesso.ts e
 * src/lib/negocio.ts). O Deno não importa src/; se alguém mudar um preço só de um lado, este teste falha.
 */
import { describe, expect, it } from 'vitest'
import * as proto from '@/lib/acesso'
import { JANELA_ATRIBUICAO_DIAS as JANELA_PROTO, taxaPara } from '@/lib/negocio'
import {
  COMPROMISSO_MENSAL_MESES,
  CONSENTIMENTO_ACESSO,
  IVA_FAMILIA_PERCENT,
  JANELA_ATRIBUICAO_DIAS,
  MENSALIDADE_CENTIMOS,
  PLANOS_FAMILIA,
  PRAZO_CONTESTACAO_DIAS,
  TAXA_ENTRADA_CENTIMOS,
  planoFamilia,
} from '../../functions/_shared/faturacao/planos.ts'

describe('paridade com o protótipo', () => {
  it('passes do Acesso Família: ids, dias e preços com IVA', () => {
    expect(Object.values(PLANOS_FAMILIA).map((p) => [p.id, p.dias, p.precoCentimos])).toEqual(proto.PLANOS_FAMILIA.map((p) => [p.id, p.dias, p.precoCentimos]))
    for (const p of proto.PLANOS_FAMILIA) expect(PLANOS_FAMILIA[p.id].produto).toBe(`Acesso Família — ${p.nome}`)
  })

  it('IVA das famílias, taxa por entrada, mensalidade e compromisso', () => {
    expect(IVA_FAMILIA_PERCENT).toBe(proto.IVA_FAMILIA_PERCENT)
    expect(TAXA_ENTRADA_CENTIMOS).toBe(proto.TAXA_ENTRADA_PRIVADO_CENTIMOS)
    expect(TAXA_ENTRADA_CENTIMOS).toBe(proto.PLANOS_INSTITUICAO.por_entrada.valorCentimos)
    expect(MENSALIDADE_CENTIMOS).toBe(proto.PLANOS_INSTITUICAO.mensal.valorCentimos)
    expect(COMPROMISSO_MENSAL_MESES).toBe(proto.COMPROMISSO_MENSAL_MESES)
    expect(JANELA_ATRIBUICAO_DIAS).toBe(JANELA_PROTO)
    expect(PRAZO_CONTESTACAO_DIAS).toBe(14)
  })

  it('taxaPara: mensalidade → incluida, IPSS → isenta (as regras do servidor assumem isto)', () => {
    expect(taxaPara({ natureza: 'privado', planoInstituicao: 'mensal' })).toBe('incluida')
    expect(taxaPara({ natureza: 'ipss' })).toBe('isenta')
    expect(taxaPara({ natureza: 'privado' })).toBe('aplicavel')
  })
})

describe('planoFamilia', () => {
  it('só aceita ids conhecidos (nada de protótipos nem __proto__)', () => {
    expect(planoFamilia('acesso_90')?.precoCentimos).toBe(2990)
    expect(planoFamilia('acesso_365')).toBeNull()
    expect(planoFamilia('__proto__')).toBeNull()
    expect(planoFamilia('toString')).toBeNull()
    expect(planoFamilia(30)).toBeNull()
  })

  it('o consentimento tem versão e texto em PT-PT sobre a perda da livre resolução', () => {
    expect(CONSENTIMENTO_ACESSO.versao).toMatch(/^acesso-familia-\d{4}-\d{2}-\d{2}$/)
    expect(CONSENTIMENTO_ACESSO.texto).toMatch(/livre resolução de 14 dias/)
  })
})
