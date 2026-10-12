import { describe, expect, it } from 'vitest'
import type { Candidatura, EstadoCandidatura, Lar, PerfilIdoso } from '@/types'
import { pedidosPorTratar, vagaAceiteHaPouco, verificarCompatibilidade, DIA_MS } from './derive'
import { necessidadesTexto, perfilLinha } from '../shared/pedidoBits'

const perfil = {
  nome: 'Maria',
  idade: 84,
  grau: 'grave',
  necessidades: ['acamados', 'enfermagem24h', 'diabetes'],
  quarto: 'indiferente',
  orcamentoMax: 3000,
  precisaAcordoSS: false,
} as unknown as PerfilIdoso

const cand = (estado: EstadoCandidatura, extra: Partial<Candidatura> = {}): Candidatura =>
  ({
    id: `c-${Math.random()}`,
    estado,
    perfil,
    contacto: { nome: 'Ana Ferreira', email: 'ana@exemplo.pt' },
    criadaEm: '2026-10-01T10:00:00.000Z',
    atualizadaEm: '2026-10-01T10:00:00.000Z',
    historico: [],
    ...extra,
  }) as Candidatura

describe('pedidosPorTratar', () => {
  it('conta pedidos novos e visitas por confirmar, sem contar duas vezes', () => {
    const visita = { data: '2026-10-20', hora: '15:00', estado: 'pedida' as const }
    const cands = [
      cand('enviada'),
      cand('enviada', { visita }), // novo e com visita: conta uma vez
      cand('em_analise', { visita }),
      cand('em_analise'),
      cand('lista_espera', { visita: { ...visita, estado: 'confirmada' } }),
      cand('aceite', { visita }), // concluído: a visita já não está por tratar
    ]
    expect(pedidosPorTratar(cands)).toBe(3)
    expect(pedidosPorTratar([])).toBe(0)
  })
})

describe('textos de cuidados em frases', () => {
  it('não usa os rótulos das categorias dentro de frases', () => {
    const c = cand('enviada')
    expect(necessidadesTexto(c)).toBe('cuidados de pessoa acamada, enfermagem 24 horas e controlo da diabetes')
    expect(perfilLinha(c)).toBe('dependência grave · precisa de cuidados de pessoa acamada, enfermagem 24 horas e mais 1')
    expect(necessidadesTexto(cand('enviada', { perfil: { ...perfil, necessidades: [] } }))).toBeNull()
  })

  it('compatibilidade: "Assegura cuidados de pessoa acamada…" e "Admite pessoas com dependência grave"', () => {
    const lar = { graus: ['grave'], cuidados: ['acamados', 'enfermagem24h'], quartos: [], acordoSS: false } as unknown as Lar
    const checks = verificarCompatibilidade(lar, { ...perfil, necessidades: ['acamados', 'enfermagem24h'] })
    expect(checks.find((x) => x.id === 'grau')?.texto).toBe('Admite pessoas com dependência grave')
    expect(checks.find((x) => x.id === 'cuidados')?.texto).toBe('Assegura cuidados de pessoa acamada e enfermagem 24 horas')
    const falta = verificarCompatibilidade({ ...lar, cuidados: [] } as Lar, { ...perfil, necessidades: ['demencia'] })
    expect(falta.find((x) => x.id === 'cuidados')?.texto).toBe('Não assegura cuidados na demência')
  })
})

describe('vagaAceiteHaPouco', () => {
  const agora = Date.parse('2026-10-12T12:00:00.000Z')
  const historico = [
    { data: '2026-10-10T10:00:00.000Z', estado: 'vaga_proposta' as const },
    { data: '2026-10-12T10:00:00.000Z', estado: 'aceite' as const },
  ]
  it('só a vaga proposta que a família aceitou nos últimos dois dias', () => {
    expect(vagaAceiteHaPouco(cand('aceite', { atualizadaEm: '2026-10-12T10:00:00.000Z', historico }), agora)).toBe(true)
    expect(vagaAceiteHaPouco(cand('aceite', { atualizadaEm: new Date(agora - 3 * DIA_MS).toISOString(), historico }), agora)).toBe(false)
    expect(
      vagaAceiteHaPouco(cand('aceite', { atualizadaEm: '2026-10-12T10:00:00.000Z', historico: [{ data: '', estado: 'em_analise' }, historico[1]!] }), agora),
    ).toBe(false)
    expect(vagaAceiteHaPouco(cand('vaga_proposta', { atualizadaEm: '2026-10-12T10:00:00.000Z', historico }), agora)).toBe(false)
  })
})
