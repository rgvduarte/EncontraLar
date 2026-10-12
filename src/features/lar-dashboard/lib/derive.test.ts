import { describe, expect, it } from 'vitest'
import type { Candidatura, EstadoCandidatura, Lar, PerfilIdoso } from '@/types'
import { entradasEsteAno, entradasUltimos12Meses, ordenarNovos, pedidosPorTratar, vagaAceiteHaPouco, verificarCompatibilidade, DIA_MS } from './derive'
import { altaTexto, necessidadesTexto, nomePedido, perfilLinha, quemPediu, relacaoTexto } from '../shared/pedidoBits'
import { acoesDoPedido } from '../pedidos/acoes'

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

describe('pedidos em duas fases (RGPD)', () => {
  const agora = Date.parse('2026-10-12T12:00:00.000Z')
  const enc = (altaPrevista: string) => ({ casoId: 'caso-1', profissionalId: 'u-pro', organizacao: 'Hospital X · Serviço Social', altaPrevista })

  it('antes de aceitar: sem nome nem contacto, só a faixa etária e a origem', () => {
    const c = cand('enviada', { origem: 'profissional', encaminhamento: enc('2026-10-16'), contacto: { nome: 'Marta (Hospital X)', email: 'm@x.pt' } })
    expect(nomePedido(c)).toBe('Pessoa de 80–84 anos')
    expect(relacaoTexto(c)).toBe('Encaminhado por Hospital X · Serviço Social')
    expect(quemPediu(c)).toBe('quem fez o pedido')
    expect(relacaoTexto(cand('enviada'))).toBe('Pedido de uma família')
    const aceite = { ...c, estado: 'em_analise' as const, desbloqueadaEm: '2026-10-12T11:00:00.000Z' }
    expect(nomePedido(aceite)).toBe('Maria, 84 anos')
    expect(relacaoTexto(aceite)).toBe('Pedido feito por Marta')
  })

  it('ações: "Aceitar e ver contacto" e "Recusar", sem o nome no diálogo', () => {
    const lar = { listaEspera: 0, quartos: [] } as unknown as Lar
    const acoes = acoesDoPedido(cand('enviada'), lar, agora)
    expect(acoes.map((a) => a.label)).toEqual(['Aceitar e ver contacto', 'Recusar'])
    expect(acoes[0]!.tipo).toBe('aceitar')
    expect(acoes[1]!.titulo).not.toContain('Maria')
    expect(acoesDoPedido(cand('aceite'), lar, agora).map((a) => a.label)).toEqual(['Marcar entrada'])
    const entrada = { data: '2026-10-01', confirmadaLarEm: '2026-10-01T10:00:00.000Z', taxa: 'aplicavel' as const }
    expect(acoesDoPedido(cand('admitida', { entrada }), lar, agora)).toEqual([])
  })

  it('alta hospitalar: "Alta em N dias", "Alta amanhã", "Alta hoje"', () => {
    const hoje = new Date(agora)
    const dia = (n: number) => {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + n)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
    expect(altaTexto(dia(4), agora)?.texto).toBe('Alta em 4 dias')
    expect(altaTexto(dia(1), agora)?.texto).toBe('Alta amanhã')
    expect(altaTexto(dia(0), agora)?.texto).toBe('Alta hoje')
    expect(altaTexto(dia(-3), agora)?.texto).toMatch(/^Alta prevista: \d+ de /)
    expect(altaTexto(undefined, agora)).toBeNull()
  })

  it('pedidos novos: alta nos próximos 7 dias primeiro, depois urgentes, depois os mais recentes', () => {
    const d = (n: number) => new Date(agora + n * DIA_MS).toISOString().slice(0, 10)
    const antigoComAlta = cand('enviada', { id: 'alta', criadaEm: '2026-10-01T10:00:00.000Z', encaminhamento: enc(d(3)) })
    const urgente = cand('enviada', { id: 'urgente', criadaEm: '2026-10-05T10:00:00.000Z', perfil: { ...perfil, urgencia: 'imediata' } })
    const recente = cand('enviada', { id: 'recente', criadaEm: '2026-10-11T10:00:00.000Z', perfil: { ...perfil, urgencia: 'planeamento' } })
    const altaLonge = cand('enviada', { id: 'longe', criadaEm: '2026-10-12T10:00:00.000Z', encaminhamento: enc(d(30)), perfil: { ...perfil, urgencia: '1-3meses' } })
    expect(ordenarNovos([recente, altaLonge, urgente, antigoComAlta], agora).map((c) => c.id)).toEqual(['alta', 'urgente', 'longe', 'recente'])
  })
})

describe('entradas', () => {
  const agora = Date.parse('2026-10-12T12:00:00.000Z')
  const comEntrada = (data: string) => cand('admitida', { entrada: { data, confirmadaLarEm: `${data}T10:00:00.000Z`, taxa: 'aplicavel' } })
  it('conta os últimos 12 meses e o ano civil', () => {
    const cands = [comEntrada('2026-09-01'), comEntrada('2025-12-01'), comEntrada('2025-09-01'), cand('aceite')]
    expect(entradasUltimos12Meses(cands, agora).map((c) => c.entrada!.data)).toEqual(['2026-09-01', '2025-12-01'])
    expect(entradasEsteAno(cands, agora)).toHaveLength(1)
  })
})
