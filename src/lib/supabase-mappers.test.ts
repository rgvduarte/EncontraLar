import { describe, expect, it } from 'vitest'
import type { Review } from '@/types'
import {
  candidaturaDeLinha,
  eCandidaturaMinimizada,
  larDeLinha,
  larParaAtualizacao,
  larParaInsercao,
  normalizarWebsite,
  quartoInicial,
  type CandidaturaRow,
  type InstituicaoPublicaRow,
} from './supabase-mappers'

const REGISTO = {
  nome: '  Lar Teste  ',
  tipo: 'residencia' as const,
  natureza: 'privado' as const,
  lugar: 'Braga',
  capacidade: 12.4,
  licenca: ' 12/2020 ',
  precoDesde: 1499.6,
}

describe('larParaAtualizacao', () => {
  it('acrescenta https:// a sites escritos como o formulário os aceita ("www.exemplo.pt")', () => {
    expect(normalizarWebsite('www.exemplo.pt')).toBe('https://www.exemplo.pt')
    expect(normalizarWebsite('  exemplo.pt/lar ')).toBe('https://exemplo.pt/lar')
    expect(normalizarWebsite('http://exemplo.pt')).toBe('http://exemplo.pt')
    expect(normalizarWebsite('HTTPS://EXEMPLO.PT')).toBe('HTTPS://EXEMPLO.PT')
    expect(normalizarWebsite('   ')).toBeNull()
    expect(normalizarWebsite(undefined)).toBeNull()
    expect(larParaAtualizacao({ website: 'www.exemplo.pt' }).website).toBe('https://www.exemplo.pt')
    expect(larParaAtualizacao({ website: undefined })).toEqual({ website: null })
  })

  it('mantém as décimas das horas de médico e dos cuidadores ("7,5" → 7.5) e arredonda enfermeiros', () => {
    const u = larParaAtualizacao({ equipa: { cuidadoresPor10: 4.5, enfermeiros: 3.2, medicoHorasSemana: 7.5 } })
    expect(u).toEqual({ equipa_cuidadores_por_10: 4.5, equipa_enfermeiros: 3, equipa_medico_horas_semana: 7.5 })
  })

  it('não grava a lista de espera (só o administrador gere as inscrições offline)', () => {
    expect(larParaAtualizacao({ listaEspera: 20, nome: 'X' })).toEqual({ nome: 'X' })
  })
})

describe('larParaInsercao / quartoInicial (registo de uma conta lar, como store.register)', () => {
  it('deriva localização, código postal, região, graus e capa como o protótipo', () => {
    const f = larParaInsercao(REGISTO, { email: ' Gestora@Lar.PT ', telefone: ' 253 000 000 ' }, () => 0.5)
    expect(f).toMatchObject({
      nome: 'Lar Teste',
      tipo: 'residencia',
      natureza: 'privado',
      codigo_postal: '4700-000',
      localidade: 'Braga',
      concelho: 'Braga',
      distrito: 'Braga',
      regiao: 'Norte',
      telefone: '253 000 000',
      email: 'gestora@lar.pt',
      capacidade: 12,
      licenca: '12/2020',
      graus: ['autonomo', 'ligeira'],
      incluido: ['Alojamento e todas as refeições', 'Higiene pessoal e apoio diário', 'Tratamento de roupa'],
      capa: { hue: 180, variante: 2 },
    })
    // +0.004 sobre o centro do concelho, com 5 casas decimais (numeric(8,5))
    expect(f.lat).toBeCloseTo(41.5494, 5)
    expect(f.lng).toBeCloseTo(-8.4225, 5)
    // a ficha nasce sem id, dono, publicação nem verificação (servidor)
    for (const k of ['id', 'owner_id', 'publicado', 'verificacao_estado', 'lista_espera_offline']) expect(f).not.toHaveProperty(k)
    expect(larParaInsercao({ ...REGISTO, tipo: 'erpi' }, { email: 'a@b.pt' }).graus).toEqual(['ligeira', 'moderada'])
  })

  it('o primeiro quarto é individual, com todos os lugares e preço máximo +20 %', () => {
    expect(quartoInicial('lar-x', REGISTO)).toEqual({ instituicao_id: 'lar-x', tipo: 'individual', total: 12, preco_min: 1500, preco_max: 1800 })
  })
})

describe('larDeLinha', () => {
  const review = (id: string, data: string): Review => ({
    id, autor: 'A', relacao: '', data, nota: 4, texto: 'Texto suficientemente longo', verificada: false,
    aspetos: { cuidados: 4, alimentacao: 4, instalacoes: 4, comunicacao: 4 },
  })

  it('ordena as avaliações da mais recente para a mais antiga e só mostra dados do dono quando indicados', () => {
    const linha = { id: 'lar-x', nome: 'X', capa: { hue: 1, variante: 0 } } as unknown as InstituicaoPublicaRow
    const lar = larDeLinha(linha, [review('1', '2026-01-01T00:00:00Z'), review('2', '2026-03-01T00:00:00Z'), review('3', '2026-02-01T00:00:00Z')])
    expect(lar.reviews.map((r) => r.id)).toEqual(['2', '3', '1'])
    expect(lar.ownerId).toBeUndefined()
    expect(lar.visualizacoes30d).toBe(0)
    expect(larDeLinha(linha, [], { ownerId: 'u1', visualizacoes30d: 42 })).toMatchObject({ ownerId: 'u1', visualizacoes30d: 42 })
  })
})

describe('candidaturaDeLinha', () => {
  const base = {
    id: 'c1', instituicao_id: 'lar-x', user_id: 'u1', perfil_id: 'p1', estado: 'cancelada', posicao: null, mensagem: null,
    visita_data: null, visita_hora: null, visita_estado: null, prazo_resposta: null, consentimento_em: '2026-10-01T10:00:00Z',
    created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-02T10:00:00Z',
  } satisfies Partial<CandidaturaRow>

  it('ordena o histórico por instante, não por texto (fusos diferentes)', () => {
    const c = candidaturaDeLinha({
      ...base,
      estado: 'em_analise',
      perfil_snapshot: { nome: 'Maria', idade: 84, grau: 'moderada', quarto: 'individual' },
      contacto: { nome: 'Ana', email: 'a@b.pt' },
      candidatura_eventos: [
        { estado: 'em_analise', nota: null, created_at: '2026-10-12T09:30:00+00:00' },
        { estado: 'enviada', nota: null, created_at: '2026-10-12T10:00:00+01:00' },
      ],
    })
    expect(c.historico.map((h) => h.estado)).toEqual(['enviada', 'em_analise'])
    expect(eCandidaturaMinimizada(c)).toBe(false)
  })

  it('uma cópia minimizada não inventa grau, necessidades nem local', () => {
    const c = candidaturaDeLinha({
      ...base,
      perfil_snapshot: { nome: 'Maria', idade: 84, minimizado_em: '2026-10-12T10:00:00Z' },
      contacto: { nome: 'Ana' },
      candidatura_eventos: [],
    })
    expect(eCandidaturaMinimizada(c)).toBe(true)
    expect(c.perfil).toEqual({ minimizado: true, nome: 'Maria', idade: 84, minimizadoEm: '2026-10-12T10:00:00.000Z' })
    expect(c.contacto).toEqual({ nome: 'Ana' })
  })

  it('a cópia não traz coordenadas: o local fica sem lat/lng (NaN), nunca 0,0', () => {
    const c = candidaturaDeLinha({
      ...base,
      estado: 'enviada',
      perfil_snapshot: { nome: 'Maria', idade: 84, grau: 'grave', local_label: 'Porto', orcamento_max: 2000 },
      contacto: { nome: 'Ana', email: 'a@b.pt' },
      candidatura_eventos: [],
    })
    if (eCandidaturaMinimizada(c)) throw new Error('não devia estar minimizada')
    expect(c.perfil.local.label).toBe('Porto')
    expect(Number.isNaN(c.perfil.local.lat) && Number.isNaN(c.perfil.local.lng)).toBe(true)
    expect(c.perfil).toMatchObject({ grau: 'grave', orcamentoMax: 2000, id: 'p1' })
  })
})
