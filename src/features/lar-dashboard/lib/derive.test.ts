import { describe, expect, it } from 'vitest'
import type { Candidatura, EstadoCandidatura, Lar, PerfilIdoso } from '@/types'
import { cobrancaEntradaTexto, compromissoAte, ENTRADAS_ANO_MENSAL_COMPENSA, PLANOS_INSTITUICAO, valorPlanoTexto } from '@/lib/acesso'
import {
  comparacaoModalidades,
  comparacaoPartes,
  compromissoSeMudarAgora,
  entradasEsteAno,
  entradasTexto,
  entradasUltimos12Meses,
  estadoModalidade,
  ordenarNovos,
  partesValorPlano,
  pedidosPorTratar,
  TAXA_NAO_CONTA,
  TAXA_TEXTO,
  taxaAoMarcarTexto,
  taxaDaEntradaTexto,
  vagaAceiteHaPouco,
  valorMaisIva,
  verificarCompatibilidade,
  DIA_MS,
} from './derive'
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

// ————————————————————————————————————————— modalidade e taxa das entradas (lares privados)

/** O formato pt-PT põe um espaço inseparável antes do € (e o painel junta "+ IVA" com espaços inseparáveis). */
const txt = (s: string | null) => s?.replace(/ /g, ' ') ?? null

describe('modalidade: comparação dos últimos 12 meses', () => {
  const agora = Date.parse('2026-10-12T12:00:00.000Z')
  const entrou = (data: string, criadaEm = `${data.slice(0, 8)}01T10:00:00.000Z`, taxa: 'aplicavel' | 'incluida' = 'aplicavel') =>
    cand('admitida', { criadaEm, entrada: { data, confirmadaLarEm: `${data}T10:00:00.000Z`, taxa } })

  it('sem entradas que contem: só a regra geral (null)', () => {
    expect(comparacaoModalidades([], agora)).toBeNull()
    // entrada com mais de 12 meses e entrada fora da janela de atribuição (mais de 12 meses depois do pedido)
    const antiga = entrou('2025-09-01')
    const foraDaJanela = entrou('2026-09-01', '2025-08-01T10:00:00.000Z')
    expect(comparacaoModalidades([antiga, foraDaJanela, cand('aceite')], agora)).toBeNull()
  })

  it('conta só as entradas atribuídas dos últimos 12 meses, com os valores das modalidades', () => {
    const cands = [entrou('2026-09-01'), entrou('2025-12-01', '2025-11-20T10:00:00.000Z', 'incluida'), entrou('2025-09-01'), entrou('2026-09-20', '2025-08-01T10:00:00.000Z'), cand('aceite')]
    const c = comparacaoModalidades(cands, agora)!
    expect(c.entradas).toBe(2)
    expect(c.porEntradaCentimos).toBe(2 * PLANOS_INSTITUICAO.por_entrada.valorCentimos)
    expect(c.mensalCentimos).toBe(12 * PLANOS_INSTITUICAO.mensal.valorCentimos)
    const { periodo, valores } = comparacaoPartes(c)
    expect(txt(`${periodo} → ${valores}`)).toBe('Nos últimos 12 meses: 2 entradas → por entrada pagaria 300 € + IVA; com mensalidade, 348 € + IVA.')
  })

  it('uma entrada, no singular; e a regra geral vem da constante (3 entradas por ano)', () => {
    const c = comparacaoModalidades([entrou('2026-10-01')], agora)!
    expect(txt(comparacaoPartes(c).periodo)).toBe('Nos últimos 12 meses: 1 entrada')
    expect(txt(comparacaoPartes(c).valores)).toBe('por entrada pagaria 150 € + IVA; com mensalidade, 348 € + IVA.')
    expect(ENTRADAS_ANO_MENSAL_COMPENSA).toBe(3)
    expect(entradasTexto(ENTRADAS_ANO_MENSAL_COMPENSA)).toBe('3 entradas')
    // na regra geral, a mensalidade compensa mesmo: 12 mensalidades < 3 entradas, mas não < 2
    expect(12 * PLANOS_INSTITUICAO.mensal.valorCentimos).toBeLessThan(ENTRADAS_ANO_MENSAL_COMPENSA * PLANOS_INSTITUICAO.por_entrada.valorCentimos)
    expect(12 * PLANOS_INSTITUICAO.mensal.valorCentimos).toBeGreaterThan((ENTRADAS_ANO_MENSAL_COMPENSA - 1) * PLANOS_INSTITUICAO.por_entrada.valorCentimos)
  })

  it('valores com "+ IVA", sem cêntimos quando redondos, iguais aos da modalidade', () => {
    expect(txt(valorMaisIva(34800))).toBe('348 € + IVA')
    expect(txt(valorMaisIva(1490))).toBe('14,90 € + IVA')
    for (const p of ['por_entrada', 'mensal'] as const) {
      const { valor, resto } = partesValorPlano(p)
      expect(`${valor} ${resto}`).toBe(valorPlanoTexto(p))
    }
    expect(txt(partesValorPlano('por_entrada').valor)).toBe('150 €')
    expect(partesValorPlano('mensal').resto).toBe('+ IVA por mês')
  })
})

describe('modalidade: o que se pode escolher', () => {
  const agora = Date.parse('2026-10-13T12:00:00.000Z')
  const dias = (n: number) => new Date(agora - n * DIA_MS).toISOString()
  const privado = (extra: Partial<Lar> = {}) => ({ natureza: 'privado' as const, ...extra })

  it('IPSS e Misericórdias: nada a escolher (null)', () => {
    expect(estadoModalidade({ natureza: 'ipss' }, agora)).toBeNull()
    expect(estadoModalidade({ natureza: 'misericordia' }, agora)).toBeNull()
  })

  it('privado sem modalidade registada: por entrada, e as duas disponíveis', () => {
    expect(estadoModalidade(privado(), agora)).toEqual({ atual: 'por_entrada', desde: null, compromissoAte: null, disponivel: { por_entrada: true, mensal: true } })
    expect(estadoModalidade(privado({ planoInstituicao: 'por_entrada', planoDesde: dias(64) }), agora)?.desde).toBe(dias(64))
  })

  it('mensalidade dentro do compromisso: "Por entrada" indisponível até ao fim do compromisso', () => {
    const lar = privado({ planoInstituicao: 'mensal', planoDesde: dias(21) })
    const e = estadoModalidade(lar, agora)!
    expect(e.atual).toBe('mensal')
    expect(e.disponivel).toEqual({ por_entrada: false, mensal: true })
    expect(e.compromissoAte).toBe(compromissoAte(lar))
    const ate = Date.parse(e.compromissoAte!)
    expect(Math.round((ate - Date.parse(dias(21))) / DIA_MS)).toBeGreaterThanOrEqual(365)
    // no próprio instante em que o compromisso acaba, já pode voltar (a mesma regra do store)
    expect(estadoModalidade(lar, ate - 1)!.disponivel.por_entrada).toBe(false)
    expect(estadoModalidade(lar, ate)).toEqual({ atual: 'mensal', desde: dias(21), compromissoAte: null, disponivel: { por_entrada: true, mensal: true } })
  })

  it('mensalidade há mais de 12 meses: pode voltar à taxa por entrada', () => {
    const e = estadoModalidade(privado({ planoInstituicao: 'mensal', planoDesde: dias(400) }), agora)!
    expect(e.disponivel.por_entrada).toBe(true)
    expect(e.compromissoAte).toBeNull()
  })

  it('quem muda agora para a mensalidade fica até daqui a 12 meses', () => {
    const ate = compromissoSeMudarAgora(agora)
    expect(ate).toBe(compromissoAte(privado({ planoInstituicao: 'mensal', planoDesde: new Date(agora).toISOString() })))
    expect(new Date(ate).getFullYear()).toBe(2027)
  })
})

describe('taxa de cada entrada', () => {
  it('os textos são os da modalidade correspondente, com "+ IVA" e sem "conforme contrato"', () => {
    expect(TAXA_TEXTO.aplicavel).toBe(cobrancaEntradaTexto({ natureza: 'privado', planoInstituicao: 'por_entrada' }))
    expect(TAXA_TEXTO.incluida).toBe(cobrancaEntradaTexto({ natureza: 'privado', planoInstituicao: 'mensal' }))
    expect(TAXA_TEXTO.isenta).toBe(cobrancaEntradaTexto({ natureza: 'misericordia' }))
    expect(txt(TAXA_TEXTO.aplicavel)).toBe('Taxa fixa: 150 € + IVA por entrada')
    expect(txt(TAXA_TEXTO.incluida)).toBe('Incluída na mensalidade (29 € + IVA por mês)')
    expect(TAXA_TEXTO.isenta).toBe('Isenta — setor social')
    for (const t of Object.values(TAXA_TEXTO)) expect(t).not.toMatch(/contrato|publicad/i)
  })

  it('uma entrada registada mantém a taxa com que ficou, mesmo depois de mudar de modalidade', () => {
    const c = cand('admitida', { criadaEm: '2026-09-01T10:00:00.000Z', entrada: { data: '2026-10-01', confirmadaFamiliaEm: '2026-10-01T18:00:00.000Z', taxa: 'aplicavel' } })
    expect(txt(taxaDaEntradaTexto(c))).toBe('Taxa fixa: 150 € + IVA por entrada')
    // a casa já passou à mensalidade, mas a família registou a entrada antes: ao marcar, a taxa é a dessa altura
    expect(txt(taxaAoMarcarTexto(c, { natureza: 'privado', planoInstituicao: 'mensal' }, '2026-10-01'))).toBe('Taxa fixa: 150 € + IVA por entrada')
    expect(taxaDaEntradaTexto(cand('aceite'))).toBeNull()
  })

  it('por registar: a modalidade em vigor hoje; e não conta se entrou mais de 12 meses depois do pedido', () => {
    const c = cand('aceite', { criadaEm: '2026-09-01T10:00:00.000Z' })
    expect(txt(taxaAoMarcarTexto(c, { natureza: 'privado', planoInstituicao: 'mensal' }, '2026-10-12'))).toBe('Incluída na mensalidade (29 € + IVA por mês)')
    expect(txt(taxaAoMarcarTexto(c, { natureza: 'privado' }, '2026-10-12'))).toBe('Taxa fixa: 150 € + IVA por entrada')
    expect(taxaAoMarcarTexto(c, { natureza: 'ipss' }, '2026-10-12')).toBe('Isenta — setor social')
    expect(taxaAoMarcarTexto(c, { natureza: 'privado' }, '2027-10-12')).toBe(TAXA_NAO_CONTA)
    const tarde = cand('admitida', { criadaEm: '2025-01-10T10:00:00.000Z', entrada: { data: '2026-10-01', confirmadaLarEm: '2026-10-01T10:00:00.000Z', taxa: 'aplicavel' } })
    expect(taxaDaEntradaTexto(tarde)).toBe(TAXA_NAO_CONTA)
  })
})
