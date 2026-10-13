/**
 * Faturação: o SQL calcula exatamente o mesmo que as regras puras das Edge Functions
 * (supabase/functions/_shared/faturacao): valores comerciais, IVA ao cêntimo (por linha e incluído), NIF, região
 * fiscal, referência do pedido, datas de Lisboa (prazo de contestação com as mudanças de hora, janela de
 * atribuição) e o estado de faturação de uma entrada (classificarEntrada), numa matriz de casos.
 */
import type { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { dentroDaJanela, diaLisboa, fimContestacao, somarDiasData } from '../functions/_shared/faturacao/datas.ts'
import { ivaCentimos, separarIvaIncluido } from '../functions/_shared/faturacao/dinheiro.ts'
import { normalizarNIF, validarNIF } from '../functions/_shared/faturacao/nif.ts'
import {
  IVA_FAMILIA_PERCENT,
  JANELA_ATRIBUICAO_DIAS,
  MENSALIDADE_CENTIMOS,
  PLANOS_FAMILIA,
  PRAZO_CONTESTACAO_DIAS,
  TAXA_ENTRADA_CENTIMOS,
} from '../functions/_shared/faturacao/planos.ts'
import { referenciaPedido } from '../functions/_shared/faturacao/referencia.ts'
import { ivaDaRegiao, regiaoFiscal } from '../functions/_shared/faturacao/regiao.ts'
import { classificarEntrada, type EntradaFaturacao, type EstadoContestacao, type TaxaEntrada } from '../functions/_shared/faturacao/regras.ts'
import { configTeste } from './funcoes/fakes.ts'
import { admin, criarBase } from './helpers'

let db: PGlite
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)

beforeAll(async () => {
  db = await criarBase()
}, 120_000)

afterAll(async () => {
  await db.close()
})

// gerador determinístico (os casos repetem-se de execução para execução)
function aleatorio(semente: number) {
  let s = semente >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

describe('valores comerciais: os mesmos de planos.ts e config.ts', () => {
  it('passes, mensalidade, taxa por entrada, IVA das famílias, pré-aviso SEPA', async () => {
    const [r] = await adm<Record<string, number>>(`
      select private.preco_plano_familia('acesso_30') p30, private.preco_plano_familia('acesso_90') p90,
             private.dias_plano_familia('acesso_30') d30, private.dias_plano_familia('acesso_90') d90,
             private.mensalidade_centimos() m, private.taxa_entrada_omissao_centimos() t, private.iva_familia_percent() i,
             private.pre_aviso_sepa_dias() a`)
    expect(r).toEqual({
      p30: PLANOS_FAMILIA.acesso_30.precoCentimos, p90: PLANOS_FAMILIA.acesso_90.precoCentimos,
      d30: PLANOS_FAMILIA.acesso_30.dias, d90: PLANOS_FAMILIA.acesso_90.dias,
      m: MENSALIDADE_CENTIMOS, t: TAXA_ENTRADA_CENTIMOS, i: IVA_FAMILIA_PERCENT, a: configTeste().faturacao.preAvisoDias,
    })
    // a contestação dura 14 dias e a janela 365 (as funções SQL usam estes números)
    expect(PRAZO_CONTESTACAO_DIAS).toBe(14)
    expect(JANELA_ATRIBUICAO_DIAS).toBe(365)
  })
})

describe('dinheiro: IVA ao cêntimo como dinheiro.ts', () => {
  it('iva_centimos = ivaCentimos (meio cêntimo para cima, por linha), positivos e negativos', async () => {
    for (const pct of [23, 22, 16]) {
      const r = await adm<{ b: number; v: number }>('select b, private.iva_centimos(b, $1) v from generate_series(-3000, 6000, 7) b', [pct])
      for (const x of r) expect(x.v, `${x.b} a ${pct} %`).toBe(ivaCentimos(x.b, pct))
      const [m] = await adm<{ v: number }>('select private.iva_centimos(15000, $1) v', [pct])
      expect(m!.v).toBe(ivaCentimos(15000, pct))
    }
  })

  it('separar_iva_incluido = separarIvaIncluido (preços das famílias; null quando não há separação exata)', async () => {
    for (const pct of [23, 22, 16]) {
      const r = await adm<{ b: number; v: number | null }>('select b, private.separar_iva_incluido(b, $1) v from generate_series(0, 4000) b', [pct])
      for (const x of r) expect(x.v, `${x.b} a ${pct} %`).toBe(separarIvaIncluido(x.b, pct as 23)?.ivaCentimos ?? null)
    }
    const [r] = await adm<{ a: number; b: number; c: number | null }>('select private.separar_iva_incluido(1490, 23) a, private.separar_iva_incluido(2990, 23) b, private.separar_iva_incluido(1490, 16) c')
    expect(r).toEqual({ a: 279, b: 559, c: null })
  })

  it('euros e mes_extenso (textos dos avisos)', async () => {
    const [r] = await adm<{ a: string; b: string; c: string }>("select private.euros(36900) a, private.euros(5) b, private.mes_extenso('2026-10-01') c")
    expect(r).toEqual({ a: '369,00 €', b: '0,05 €', c: 'outubro de 2026' })
  })
})

describe('NIF, região fiscal e referência como nif.ts, regiao.ts e referencia.ts', () => {
  it('normalizar_nif + erro_nif = validarNIF (B2B e B2C), em 400 casos e nos de fronteira', async () => {
    const rnd = aleatorio(7)
    const casos = ['PT 599 999 993', ' 123.456.789 ', '123-456-789', '999999990', '999 999 990', '12345678', '1234567890', 'abcdefghi', '', '  ', 'pt123456789', '45 0000000', '700000000']
    for (let i = 0; i < 400; i++) {
      const base = String(Math.floor(rnd() * 1e8)).padStart(8, '0')
      const prefixos = ['1', '2', '3', '45', '5', '6', '70', '71', '74', '75', '77', '79', '8', '90', '91', '98', '99', '4', '0', '72']
      const p = prefixos[Math.floor(rnd() * prefixos.length)]!
      const oito = (p + base).slice(0, 8)
      let soma = 0
      for (let k = 0; k < 8; k++) soma += Number(oito[k]) * (9 - k)
      const resto = soma % 11
      const controlo = resto < 2 ? 0 : 11 - resto
      casos.push(oito + (rnd() < 0.8 ? controlo : (controlo + 1 + Math.floor(rnd() * 9)) % 10))
    }
    const r = await adm<{ v: string; n: string; b2b: string | null; b2c: string | null }>(
      'select v, private.normalizar_nif(v) n, private.erro_nif(private.normalizar_nif(v), true) b2b, private.erro_nif(private.normalizar_nif(v), false) b2c from unnest($1::text[]) v',
      [casos],
    )
    for (const x of r) {
      expect(x.n, x.v).toBe(normalizarNIF(x.v))
      const b2b = validarNIF(x.v, 'b2b')
      const b2c = validarNIF(x.v, 'b2c')
      expect(x.b2b, `b2b ${x.v}`).toBe(b2b.ok ? null : b2b.erro)
      expect(x.b2c, `b2c ${x.v}`).toBe(b2c.ok ? null : b2c.erro)
    }
    // o domínio public.nif aceita exatamente os NIF válidos para B2B
    for (const x of r.filter((y) => /^\d{9}$/.test(y.n))) {
      const aceite = await db.query('select $1::public.nif as n', [x.n]).then(() => true, () => false)
      expect(aceite, x.n).toBe(validarNIF(x.n, 'b2b').ok)
    }
  })

  it('regiao_fiscal_de / iva_da_regiao = regiaoFiscal / ivaDaRegiao', async () => {
    const casos: [string | null, string][] = [
      ['4200-187', 'Norte'], ['9000-001', 'Norte'], ['9499-999', 'Lisboa'], ['9500-001', 'Norte'], ['9999-999', 'Madeira'], ['8999-999', 'Açores'],
      ['0999-000', 'Madeira'], [null, 'Açores'], [null, 'Madeira'], ['abc', 'Centro'], [' 9400-123 ', 'Norte'], ['1000-001', 'Açores'],
    ]
    for (const [cp, regiao] of casos) {
      const [r] = await adm<{ r: string; i: number }>('select private.regiao_fiscal_de($1, $2) r, private.iva_da_regiao(private.regiao_fiscal_de($1, $2)) i', [cp, regiao])
      expect(r, `${cp} ${regiao}`).toEqual({ r: regiaoFiscal(cp, regiao), i: ivaDaRegiao(regiaoFiscal(cp, regiao)) })
    }
  })

  it('referencia_pedido = referenciaPedido (EL- + 8 hexadecimais em maiúsculas)', async () => {
    const r = await adm<{ id: string; r: string }>('select id::text, private.referencia_pedido(id) r from (select gen_random_uuid() id from generate_series(1, 50)) x')
    for (const x of r) expect(x.r).toBe(referenciaPedido(x.id))
  })
})

describe('datas de Lisboa como datas.ts', () => {
  it('fim_contestacao = fimContestacao: 14 dias à mesma hora de Lisboa, também nas mudanças de hora (hora repetida → a primeira)', async () => {
    const instantes = [
      // 01:30 de Lisboa 14 dias antes da hora repetida de outubro (25/10/2026) e do salto de março (29/03/2026)
      '2026-10-11T00:30:00.000Z', '2026-10-11T01:30:00.000Z', '2026-10-11T00:59:59.999Z', '2026-03-15T01:30:00.000Z', '2026-03-15T00:30:00.000Z',
      '2027-10-17T00:15:00.000Z', '2027-03-14T01:45:00.000Z', '2026-10-13T09:00:00.000Z', '2026-12-31T23:59:59.999Z',
    ]
    const rnd = aleatorio(11)
    for (let i = 0; i < 300; i++) instantes.push(new Date(Date.UTC(2026, 0, 1) + Math.floor(rnd() * 3 * 365 * 86_400_000)).toISOString())
    const r = await adm<{ v: string; f: Date }>('select v, private.fim_contestacao(v::timestamptz) f from unnest($1::text[]) v', [instantes])
    for (const x of r) expect(x.f.toISOString(), x.v).toBe(fimContestacao(x.v))
    // o caso da hora repetida: 11/10 01:30 (verão) → 25/10 01:30 da PRIMEIRA passagem (00:30Z), como o Date do ECMAScript
    expect(fimContestacao('2026-10-11T00:30:00.000Z')).toBe('2026-10-25T00:30:00.000Z')
  })

  it('dentro_janela = dentroDaJanela: até ao dia do pedido em Lisboa + 365 (inclusive), perto da meia-noite', async () => {
    const casos: [string, string][] = []
    for (const pedido of ['2026-01-15T23:30:00.000Z', '2026-06-30T23:30:00.000Z', '2026-06-30T22:59:59.000Z', '2027-02-28T12:00:00.000Z', '2028-02-29T00:30:00.000Z']) {
      const d = diaLisboa(pedido)
      for (const n of [0, 364, 365, 366]) casos.push([pedido, somarDiasData(d, n)])
    }
    for (const [pedido, entrada] of casos) {
      const [r] = await adm<{ d: boolean }>('select private.dentro_janela($1::timestamptz, $2::date) d', [pedido, entrada])
      expect(r!.d, `${pedido} → ${entrada}`).toBe(dentroDaJanela(pedido, entrada))
    }
  })
})

describe('estado de faturação de uma entrada: private.classificar_entrada = classificarEntrada', () => {
  it('matriz: taxa × confirmações × contestação × linha × janela × instante (incluindo ±1 ms à volta dos 14 dias)', async () => {
    const T = Date.parse('2026-10-13T09:00:00.000Z')
    const D = 86_400_000
    const iso = (t: number) => new Date(t).toISOString()
    const familias = [null, iso(T - 20 * D), iso(T - 3 * D), '2026-10-11T00:30:00.000Z']
    const casos: { e: EntradaFaturacao; contestacao: EstadoContestacao | null; agora: number; linha: boolean }[] = []
    for (const taxa of ['aplicavel', 'incluida', 'isenta'] as TaxaEntrada[]) {
      for (const lar of [null, iso(T - 19 * D)]) {
        for (const familia of familias) {
          for (const contestacao of [null, 'aberta', 'aceite', 'rejeitada', 'retirada'] as (EstadoContestacao | null)[]) {
            for (const linha of [false, true]) {
              for (const pedido of [iso(T - 60 * D), iso(T - 500 * D)]) {
                const fim = familia ? Date.parse(fimContestacao(familia)) : T
                for (const agora of [T, fim - 1, fim, fim + 1]) {
                  casos.push({
                    contestacao,
                    agora,
                    linha,
                    e: {
                      candidaturaId: 'c',
                      pedidoCriadoEm: pedido,
                      entradaData: diaLisboa(T - 21 * D),
                      confirmadaLarEm: lar,
                      confirmadaFamiliaEm: familia,
                      taxa,
                      contestacao: contestacao ? { estado: contestacao, contestadaEm: iso(T - 2 * D), resolvidaEm: contestacao === 'aberta' ? null : iso(T - D) } : null,
                      linha: linha ? { faturaId: null, documentoNumero: null } : null,
                    },
                  })
                }
              }
            }
          }
        }
      }
    }
    expect(casos).toHaveLength(3 * 2 * 4 * 5 * 2 * 2 * 4)
    // uma só consulta para a matriz inteira
    const col = <T>(f: (c: (typeof casos)[number]) => T) => casos.map(f)
    const r = await adm<{ n: number; estado: string; desde: Date | null; ate: Date | null }>(
      `select x.n::int, (k).estado, (k).desde, (k).ate
         from unnest($1::timestamptz[], $2::date[], $3::text[], $4::timestamptz[], $5::timestamptz[], $6::text[],
                     $7::timestamptz[], $8::timestamptz[], $9::boolean[], $10::timestamptz[]) with ordinality as x (p, d, t, l, f, c, ce, cr, li, a, n)
        cross join lateral (select private.classificar_entrada(x.p, x.d, x.t::public.taxa_entrada, x.l, x.f, x.c::public.estado_contestacao, x.ce, x.cr, x.li, x.a) as k) y
        order by x.n`,
      [col((c) => c.e.pedidoCriadoEm), col((c) => c.e.entradaData), col((c) => c.e.taxa), col((c) => c.e.confirmadaLarEm), col((c) => c.e.confirmadaFamiliaEm),
        col((c) => c.contestacao), col((c) => c.e.contestacao?.contestadaEm ?? null), col((c) => c.e.contestacao?.resolvidaEm ?? null), col((c) => c.linha), col((c) => iso(c.agora))],
    )
    expect(r).toHaveLength(casos.length)
    r.forEach((x, i) => {
      const { e, agora } = casos[i]!
      const esperado = classificarEntrada(e, agora)
      const sql = { estado: x.estado, desde: x.desde?.toISOString() ?? null, ate: x.ate?.toISOString() ?? null }
      const ts = {
        estado: esperado.estado,
        desde: 'desde' in esperado ? new Date(esperado.desde).toISOString() : null,
        ate: 'ate' in esperado ? new Date(esperado.ate).toISOString() : null,
      }
      expect(sql, JSON.stringify({ ...e, agora: iso(agora) })).toEqual(ts)
    })
  })
})
