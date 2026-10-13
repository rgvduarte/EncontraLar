import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Candidatura, Lar } from '@/types'
import { Modalidade } from './Modalidade'

const DIA = 86_400_000
const agora = Date.parse('2026-10-13T12:00:00.000Z')
const dias = (n: number) => new Date(agora - n * DIA).toISOString()

const lar = (extra: Partial<Lar>) => ({ id: 'lar-1', natureza: 'privado', ...extra }) as Lar
const entrou = (n: number) =>
  ({
    id: `c-${n}`,
    estado: 'admitida',
    criadaEm: dias(n + 20),
    entrada: { data: dias(n).slice(0, 10), confirmadaLarEm: dias(n), taxa: 'aplicavel' },
  }) as unknown as Candidatura

/** HTML do cartão, com os espaços inseparáveis do formato pt-PT trocados por espaços normais. */
const html = (l: Lar, cands: Candidatura[] = []) => renderToStaticMarkup(createElement(Modalidade, { lar: l, cands, agora })).replace(/ /g, ' ')
const radios = (h: string) => h.match(/<input[^>]*type="radio"[^>]*>/g) ?? []

describe('cartão "Modalidade"', () => {
  it('IPSS e Misericórdias: sem escolha, só "Sem custos"', () => {
    for (const natureza of ['ipss', 'misericordia'] as const) {
      const h = html(lar({ natureza }), [entrou(10)])
      expect(h).toContain('Sem custos')
      expect(h).toContain('As IPSS e Misericórdias não pagam taxas nem mensalidades no EncontraLar.')
      expect(radios(h)).toHaveLength(0)
      expect(h).not.toMatch(/€|IVA|Mensalidade/)
    }
  })

  it('privado por entrada: dois rádios, o em vigor marcado com a data, valores com "+ IVA" e a comparação', () => {
    const h = html(lar({ planoInstituicao: 'por_entrada', planoDesde: '2026-08-10T10:00:00.000Z' }), [entrou(12), entrou(70)])
    const [porEntrada, mensal] = radios(h)
    expect(porEntrada).toMatch(/value="por_entrada"/)
    expect(porEntrada).toMatch(/checked=""/)
    expect(mensal).not.toMatch(/checked|disabled/)
    expect(h).toContain('<legend')
    expect(h).toContain('Em vigor desde <span class="whitespace-nowrap">10 de agosto de 2026</span>')
    expect(h).toContain('150 €')
    expect(h).toContain('+ IVA por entrada')
    expect(h).toContain('Só paga quando alguém entra através do EncontraLar')
    expect(h).toContain('29 €')
    expect(h).toContain('+ IVA por mês')
    expect(h).toContain('Sem taxa por entrada · compromisso de 12 meses')
    expect(h).toContain('A mensalidade compensa a partir de 3 entradas por ano.')
    expect(h).toContain('Nos últimos 12 meses: 2 entradas')
    expect(h).toContain('por entrada pagaria 300 € + IVA; com mensalidade, 348 € + IVA.')
    // nenhuma das duas aparece como "recomendada"
    expect(h).not.toMatch(/recomend|popular|poupe/i)
  })

  it('sem entradas: só a regra geral, sem números inventados', () => {
    const h = html(lar({}))
    expect(h).toContain('A mensalidade compensa a partir de 3 entradas por ano.')
    expect(h).not.toContain('Nos últimos 12 meses')
    expect(h).toContain('Em vigor') // sem data registada: só "Em vigor"
  })

  it('mensalidade dentro do compromisso: "Por entrada" indisponível, com a data a partir da qual volta a estar', () => {
    const h = html(lar({ planoInstituicao: 'mensal', planoDesde: dias(21) }), [entrou(12)])
    const [porEntrada, mensal] = radios(h)
    expect(porEntrada).toMatch(/disabled=""/)
    expect(porEntrada).not.toMatch(/checked/)
    expect(mensal).toMatch(/checked=""/)
    expect(h).toMatch(/Disponível a partir de <span class="whitespace-nowrap">\d+ de setembro de 2027<\/span>/)
    expect(h).toContain('Nos últimos 12 meses: 1 entrada')
  })

  it('mensalidade depois do compromisso: as duas disponíveis', () => {
    const h = html(lar({ planoInstituicao: 'mensal', planoDesde: dias(400) }))
    expect(radios(h).filter((r) => r.includes('disabled'))).toHaveLength(0)
    expect(h).not.toContain('Disponível a partir de')
  })
})
