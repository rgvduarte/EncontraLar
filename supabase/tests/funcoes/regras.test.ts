/** Estado de faturação das entradas e mudança de modalidade (faturacao/regras.ts). */
import { describe, expect, it } from 'vitest'
import { compromissoAte } from '../../functions/_shared/faturacao/datas.ts'
import { classificarEntrada, decidirMudancaPlano, geraLinha, mensagemCompromisso, podeContestar, type ContextoPlano, type EntradaFaturacao } from '../../functions/_shared/faturacao/regras.ts'

const AGORA = Date.parse('2026-10-13T09:00:00Z')
const DIA = 86_400_000
const iso = (t: number) => new Date(t).toISOString()

const base = (extra: Partial<EntradaFaturacao> = {}): EntradaFaturacao => ({
  candidaturaId: 'c1',
  pedidoCriadoEm: iso(AGORA - 60 * DIA),
  entradaData: '2026-09-30',
  confirmadaLarEm: null,
  confirmadaFamiliaEm: iso(AGORA - 3 * DIA),
  taxa: 'aplicavel',
  contestacao: null,
  linha: null,
  ...extra,
})

describe('classificarEntrada', () => {
  it('sem entrada confirmada → por_confirmar', () => {
    expect(classificarEntrada(base({ entradaData: null }), AGORA).estado).toBe('por_confirmar')
    expect(classificarEntrada(base({ confirmadaFamiliaEm: null }), AGORA).estado).toBe('por_confirmar')
  })

  it('isenta (IPSS/Misericórdia) e incluida (mensalidade) NUNCA faturam, nem com o lar a confirmar, nem com linha', () => {
    for (const taxa of ['isenta', 'incluida'] as const) {
      const casos = [
        base({ taxa }),
        base({ taxa, confirmadaLarEm: iso(AGORA - DIA) }),
        base({ taxa, confirmadaFamiliaEm: iso(AGORA - 30 * DIA) }),
        base({ taxa, linha: { faturaId: 'f', documentoNumero: 'FT F2026/1' } }),
      ]
      for (const e of casos) {
        expect(classificarEntrada(e, AGORA).estado).toBe(taxa)
        expect(geraLinha(e, AGORA)).toBe(false)
        expect(podeContestar(e, AGORA)).toBe(false)
      }
    }
  })

  it('confirmada pelo lar → faturavel desde essa confirmação', () => {
    const lar = iso(AGORA - 2 * DIA)
    expect(classificarEntrada(base({ confirmadaLarEm: lar, confirmadaFamiliaEm: null }), AGORA)).toEqual({ estado: 'faturavel', desde: lar })
  })

  it('só a família: a_aguardar até +14 dias; no instante exato passa a faturável (±1 s)', () => {
    const familia = iso(AGORA - 3 * DIA)
    const fim = Date.parse('2026-10-24T09:00:00.000Z')
    expect(classificarEntrada(base({ confirmadaFamiliaEm: familia }), AGORA)).toEqual({ estado: 'a_aguardar', ate: '2026-10-24T09:00:00.000Z' })
    expect(classificarEntrada(base({ confirmadaFamiliaEm: familia }), fim - 1000).estado).toBe('a_aguardar')
    expect(classificarEntrada(base({ confirmadaFamiliaEm: familia }), fim)).toEqual({ estado: 'faturavel', desde: '2026-10-24T09:00:00.000Z' })
    expect(classificarEntrada(base({ confirmadaFamiliaEm: familia }), fim + 1000).estado).toBe('faturavel')
  })

  it('contestações: aberta → contestada; aceite → dispensada; rejeitada → faturável desde a decisão; retirada (o lar confirmou) → faturável', () => {
    const c = (estado: 'aberta' | 'aceite' | 'rejeitada' | 'retirada', resolvidaEm: string | null = null) => ({ estado, contestadaEm: iso(AGORA - DIA), resolvidaEm })
    expect(classificarEntrada(base({ contestacao: c('aberta') }), AGORA + 30 * DIA)).toEqual({ estado: 'contestada', desde: iso(AGORA - DIA) })
    expect(classificarEntrada(base({ contestacao: c('aceite', iso(AGORA)) }), AGORA + 30 * DIA).estado).toBe('dispensada')
    expect(classificarEntrada(base({ contestacao: c('rejeitada', iso(AGORA)) }), AGORA)).toEqual({ estado: 'faturavel', desde: iso(AGORA) })
    const lar = iso(AGORA - 12 * 3_600_000)
    expect(classificarEntrada(base({ contestacao: c('retirada', lar), confirmadaLarEm: lar }), AGORA)).toEqual({ estado: 'faturavel', desde: lar })
  })

  it('fora da janela de 12 meses → fora_janela (mesmo confirmada pelo lar)', () => {
    const e = base({ pedidoCriadoEm: '2025-09-01T10:00:00Z', entradaData: '2026-09-02', confirmadaLarEm: iso(AGORA) })
    expect(classificarEntrada(e, AGORA).estado).toBe('fora_janela')
    expect(classificarEntrada({ ...e, entradaData: '2026-09-01' }, AGORA).estado).toBe('faturavel')
  })

  it('com linha ativa → faturada (não gera outra)', () => {
    const e = base({ confirmadaLarEm: iso(AGORA), linha: { faturaId: 'f1', documentoNumero: 'FT F2026/1' } })
    expect(classificarEntrada(e, AGORA)).toEqual({ estado: 'faturada', faturaId: 'f1', documentoNumero: 'FT F2026/1' })
    expect(geraLinha(e, AGORA)).toBe(false)
  })

  it('podeContestar: só família, dentro dos 14 dias, sem contestação nem linha', () => {
    expect(podeContestar(base(), AGORA)).toBe(true)
    expect(podeContestar(base({ confirmadaLarEm: iso(AGORA) }), AGORA)).toBe(false)
    expect(podeContestar(base(), AGORA + 11 * DIA)).toBe(false)
    expect(podeContestar(base({ contestacao: { estado: 'aberta', contestadaEm: iso(AGORA), resolvidaEm: null } }), AGORA)).toBe(false)
  })
})

describe('decidirMudancaPlano (espelha escolher_plano_instituicao)', () => {
  const ctx = (extra: Partial<ContextoPlano> = {}): ContextoPlano => ({
    natureza: 'privado',
    plano: null,
    planoDesde: null,
    demonstracao: false,
    temMetodo: true,
    temClienteStripe: true,
    subscricaoAtiva: null,
    ...extra,
  })

  it('IPSS/Misericórdia: recusado', () => {
    expect(decidirMudancaPlano(ctx({ natureza: 'ipss' }), 'mensal', AGORA, false)).toMatchObject({ tipo: 'recusar', codigo: 'isenta' })
  })

  it('para a mensalidade: com método → muda e cria a subscrição; sem método → 409', () => {
    expect(decidirMudancaPlano(ctx(), 'mensal', AGORA, false)).toEqual({ tipo: 'mudar', depois: 'criar_subscricao' })
    expect(decidirMudancaPlano(ctx({ temMetodo: false }), 'mensal', AGORA, false)).toMatchObject({ tipo: 'recusar', estado: 409, codigo: 'metodo_em_falta' })
  })

  it('sair da mensalidade antes do fim do compromisso: recusado com a mesma mensagem da BD', () => {
    const desde = '2026-01-10T10:00:00.000Z'
    const ate = compromissoAte(desde)
    const d = decidirMudancaPlano(ctx({ plano: 'mensal', planoDesde: desde, subscricaoAtiva: { stripeSubscriptionId: 'sub_1' } }), 'por_entrada', AGORA, false)
    expect(d).toEqual({ tipo: 'recusar', estado: 409, codigo: 'compromisso', mensagem: 'A mensalidade tem um compromisso de 12 meses: pode mudar a partir de 10 de janeiro de 2027.' })
    expect(mensagemCompromisso(ate)).toBe(d.tipo === 'recusar' ? d.mensagem : '')
    // um ms antes do fim continua recusado; no instante do fim já pode
    expect(decidirMudancaPlano(ctx({ plano: 'mensal', planoDesde: desde }), 'por_entrada', Date.parse(ate) - 1, false).tipo).toBe('recusar')
    expect(decidirMudancaPlano(ctx({ plano: 'mensal', planoDesde: desde, subscricaoAtiva: { stripeSubscriptionId: 'sub_1' } }), 'por_entrada', Date.parse(ate), false)).toEqual({
      tipo: 'mudar',
      depois: 'cancelar_subscricao',
    })
  })

  it('repetir a mesma modalidade não muda nada (e repara uma mensalidade sem subscrição)', () => {
    expect(decidirMudancaPlano(ctx(), 'por_entrada', AGORA, false)).toEqual({ tipo: 'manter', depois: 'nada' })
    expect(decidirMudancaPlano(ctx({ plano: 'mensal', planoDesde: iso(AGORA) }), 'mensal', AGORA, false)).toEqual({ tipo: 'manter', depois: 'criar_subscricao' })
    expect(decidirMudancaPlano(ctx({ plano: 'mensal', planoDesde: iso(AGORA), subscricaoAtiva: { stripeSubscriptionId: 's' } }), 'mensal', AGORA, false)).toEqual({ tipo: 'manter', depois: 'nada' })
  })

  it('demonstração: só em modo teste', () => {
    expect(decidirMudancaPlano(ctx({ demonstracao: true }), 'mensal', AGORA, true)).toMatchObject({ tipo: 'recusar', estado: 403, codigo: 'demonstracao' })
    expect(decidirMudancaPlano(ctx({ demonstracao: true }), 'mensal', AGORA, false).tipo).toBe('mudar')
  })
})
