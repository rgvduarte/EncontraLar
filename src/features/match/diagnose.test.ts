import { describe, expect, it } from 'vitest'
import { createSeed } from '@/data/seed'
import { precoReferencia, recomendar } from '@/lib/matching'
import { euro } from '@/lib/format'
import { distanceKm } from '@/lib/geo'
import { diagnosticar } from './diagnose'
import { pessoa } from './language'
import { paraPerfilMatch, RASCUNHO_VAZIO, type Rascunho } from './model'

const agora = Date.parse('2026-10-13T10:00:00Z')
const { lares } = createSeed(agora)
const porto = { label: 'Porto', lat: 41.1579, lng: -8.6291 }

const rascunho = (extra: Partial<Rascunho>): Rascunho => ({
  ...RASCUNHO_VAZIO,
  relacao: 'Mãe',
  nome: 'Maria',
  idade: '84',
  genero: 'F',
  grau: 'moderada',
  necessidades: ['demencia'],
  local: porto,
  raioKm: 15,
  orcamentoMax: 2000,
  quarto: 'individual',
  urgencia: '1-3meses',
  ...extra,
})

const diagnostico = (r: Rascunho, ls = lares, generico = false) =>
  diagnosticar(ls, r, pessoa(r), recomendar(ls, paraPerfilMatch(r)!, 80), { generico })

describe('diagnóstico na versão grátis (Acesso Família)', () => {
  it('orçamento abaixo da zona: sem o preço da casa mais barata, só números agregados', () => {
    const r = rascunho({ orcamentoMax: 300 })
    const completo = diagnostico(r)
    const gratis = diagnostico(r, lares, true)
    expect(completo?.chave).toBe('orcamento')
    expect(gratis?.chave).toBe('orcamento')
    // a versão completa diz o mínimo da zona ("o mais acessível"); a grátis não o diz em lado nenhum
    const compativeis = lares.filter(
      (l) => l.tipo !== 'centro_dia' && distanceKm(porto, l) <= r.raioKm && l.graus.includes('moderada') && l.cuidados.includes('demencia'),
    )
    const minimo = Math.min(...compativeis.map((l) => precoReferencia(l, 'individual')))
    expect(completo!.texto).toContain(euro(minimo))
    const textoGratis = [gratis!.texto, ...gratis!.ajustes.map((a) => a.label)].join(' ')
    expect(textoGratis).not.toContain('mais acessível')
    expect(textoGratis).not.toContain(euro(minimo))
    expect(gratis!.texto).toContain(euro(300))
  })

  it('sem vaga hoje tão perto: o alargar do raio não diz a que distância há vaga', () => {
    // nenhuma vaga dentro do raio (lugares livres a 0), fora dele fica tudo como está
    const semVagaPerto = lares.map((l) => (distanceKm(porto, l) <= 15 ? { ...l, quartos: l.quartos.map((q) => ({ ...q, livres: 0 })) } : l))
    const r = rascunho({ urgencia: 'imediata', orcamentoMax: 4000 })
    const completo = diagnostico(r, semVagaPerto)
    const gratis = diagnostico(r, semVagaPerto, true)
    expect(completo?.chave).toBe('urgencia')
    expect(gratis?.chave).toBe('urgencia')
    const labels = gratis!.ajustes.map((a) => a.label).join(' ')
    expect(labels).not.toMatch(/há vaga a/)
    // o mesmo ajuste (o mesmo raio), sem a distância da casa com vaga
    expect(gratis!.ajustes.map((a) => a.patch)).toEqual(completo!.ajustes.map((a) => a.patch))
  })

  it('sem o modo grátis, o diagnóstico fica igual ao de sempre', () => {
    const r = rascunho({ orcamentoMax: 300 })
    expect(diagnostico(r)).toEqual(diagnosticar(lares, r, pessoa(r), recomendar(lares, paraPerfilMatch(r)!, 80)))
  })
})
