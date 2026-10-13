import { describe, expect, it } from 'vitest'
import type { Candidatura, ProcuraAnonima, Review } from '@/types'
import { faixaEtaria, resumirProcuras, resumoAnonimo } from './negocio'
import { faixaPreco } from './acesso'
import {
  avaliacaoParaRpc,
  candidaturaDeLinha,
  casoDeLinha,
  casoParaAtualizacao,
  casoParaCriacao,
  dadosRegisto,
  eCandidaturaMinimizada,
  idadeDaFaixa,
  larDeLinha,
  larParaAtualizacao,
  larParaInsercao,
  normalizarWebsite,
  organizacaoDeJson,
  pedidoRecebidoDeLinha,
  procuraNaZonaDeLinha,
  procuraParaRpc,
  quartoInicial,
  utilizadorDeLinha,
  vagasPorTokenDeLinha,
  type CandidaturaRow,
  type InstituicaoCompletaRow,
  type InstituicaoPublicaRow,
  acessoDeLinha,
  avaliacaoInstituicaoDeLinha,
  disponibilidadeDeLinha,
  eExcertoAvaliacao,
  excertoAvaliacao,
  faixaPrecoDe,
  faixaPrecoTexto,
  larPublicoDeLinha,
  niveisDeLarPublico,
  type PedidoRecebidoRow,
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
    const linha = { id: 'lar-x', nome: 'X', capa: { hue: 1, variante: 0 } } as unknown as InstituicaoCompletaRow
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
    origem: 'familia', caso_id: null, organizacao: null, alta_prevista: null, desbloqueada_em: null, entrada_data: null,
    entrada_confirmada_lar_em: null, entrada_confirmada_familia_em: null, entrada_taxa: null,
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

describe('modelo de negócio: candidaturas', () => {
  const linha = {
    id: 'c1', instituicao_id: 'lar-x', user_id: 'pro-1', perfil_id: 'p1', estado: 'admitida', posicao: null, mensagem: 'Alta esta semana',
    visita_data: null, visita_hora: null, visita_estado: null, prazo_resposta: null, consentimento_em: '2026-10-01T10:00:00Z',
    created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-02T10:00:00Z', origem: 'profissional', caso_id: 'k1',
    organizacao: 'Hospital X · Serviço Social', alta_prevista: '2026-10-05', desbloqueada_em: '2026-10-01T12:00:00+01:00',
    entrada_data: '2026-10-08', entrada_confirmada_lar_em: '2026-10-08T09:00:00Z', entrada_confirmada_familia_em: null, entrada_taxa: 'isenta',
    perfil_snapshot: { nome: 'Albano', idade: 83, grau: 'grave', necessidades: ['acamados'], local_label: 'Porto — Paranhos', orcamento_max: 1800, quarto: 'indiferente', urgencia: 'imediata', precisa_acordo_ss: false },
    contacto: { nome: 'Marta (Hospital X)', email: 'm@h.pt' },
    candidatura_eventos: [],
  } satisfies CandidaturaRow & { candidatura_eventos: [] }

  it('origem, encaminhamento (o profissional é o autor), desbloqueio e entrada', () => {
    const c = candidaturaDeLinha(linha)
    expect(c).toMatchObject({
      origem: 'profissional',
      encaminhamento: { casoId: 'k1', profissionalId: 'pro-1', organizacao: 'Hospital X · Serviço Social', altaPrevista: '2026-10-05' },
      desbloqueadaEm: '2026-10-01T11:00:00.000Z',
      entrada: { data: '2026-10-08', confirmadaLarEm: '2026-10-08T09:00:00.000Z', confirmadaFamiliaEm: undefined, taxa: 'isenta' },
    })
    const familia = candidaturaDeLinha({ ...linha, origem: 'familia', caso_id: null, organizacao: null, alta_prevista: null })
    expect(familia.origem).toBeUndefined()
    expect(familia.encaminhamento).toBeUndefined()
  })

  const pedido = (extra: Partial<PedidoRecebidoRow>): PedidoRecebidoRow => ({
    id: 'c2', instituicao_id: 'lar-x', estado: 'enviada', posicao: null, origem: 'profissional', organizacao: 'Hospital X · Serviço Social',
    alta_prevista: '2026-10-05', faixa_etaria: '80–84', grau: 'grave', necessidades: ['acamados', 'enfermagem24h'], zona: 'Porto — Paranhos',
    orcamento_max: 1800, urgencia: 'imediata', quarto: 'indiferente', precisa_acordo_ss: false, visita_data: null, visita_hora: null,
    visita_estado: null, prazo_resposta: null, desbloqueada_em: null, entrada_data: null, entrada_confirmada_lar_em: null,
    entrada_confirmada_familia_em: null, entrada_taxa: null, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
    user_id: null, perfil_id: null, contacto: null, perfil_snapshot: null, mensagem: null, historico: null,
    ...extra,
  })

  it('pedido por aceitar (pedidos_recebidos): sem nome, contacto, notas nem mensagem; o resumo é o do protótipo', () => {
    const c = pedidoRecebidoDeLinha(pedido({})) as Candidatura
    expect(c.desbloqueadaEm).toBeUndefined()
    expect(c.perfil.nome).toBe('')
    expect(c.perfil.notas).toBeUndefined()
    expect(c.contacto).toEqual({ nome: '', email: '' })
    expect(c.mensagem).toBeUndefined()
    expect(c.historico).toEqual([])
    expect(resumoAnonimo(c)).toEqual({
      faixaEtaria: '80–84', grau: 'grave', necessidades: ['acamados', 'enfermagem24h'], zona: 'Porto — Paranhos', orcamentoMax: 1800,
      urgencia: 'imediata', precisaAcordoSS: false, quarto: 'indiferente', origem: 'profissional', organizacao: 'Hospital X · Serviço Social',
      altaPrevista: '2026-10-05',
    })
    // cancelado antes de ser aceite (cópia minimizada): sem grau inventado
    expect(eCandidaturaMinimizada(pedidoRecebidoDeLinha(pedido({ estado: 'cancelada', grau: null, necessidades: [] })))).toBe(true)
  })

  it('pedido aceite (pedidos_recebidos): completo, com o histórico', () => {
    const c = pedidoRecebidoDeLinha(pedido({
      estado: 'em_analise', desbloqueada_em: '2026-10-01T11:00:00Z', user_id: 'pro-1', perfil_id: 'p1',
      contacto: { nome: 'Marta', email: 'm@h.pt' }, mensagem: 'Relatório depois de aceitar',
      perfil_snapshot: { nome: 'Albano', idade: 83, grau: 'grave', local_label: 'Porto — Paranhos', notas: 'Fratura do fémur' },
      historico: [{ estado: 'em_analise', nota: null, created_at: '2026-10-01T11:00:00Z' }, { estado: 'enviada', nota: 'Encaminhado', created_at: '2026-10-01T10:00:00Z' }],
    })) as Candidatura
    expect(c).toMatchObject({ userId: 'pro-1', perfilId: 'p1', mensagem: 'Relatório depois de aceitar', contacto: { nome: 'Marta', email: 'm@h.pt' } })
    expect(c.perfil).toMatchObject({ nome: 'Albano', idade: 83, notas: 'Fratura do fémur' })
    expect(c.historico.map((h) => h.estado)).toEqual(['enviada', 'em_analise'])
  })

  it('idadeDaFaixa devolve sempre uma idade da mesma faixa (nunca a real)', () => {
    for (let idade = 18; idade <= 130; idade++) expect(faixaEtaria(idadeDaFaixa(faixaEtaria(idade))), String(idade)).toBe(faixaEtaria(idade))
  })
})

describe('modelo de negócio: casos, avaliações, procura, link e conta', () => {
  const perfil = {
    nome: 'José', idade: 90, relacao: 'Utente', grau: 'ligeira' as const, necessidades: ['diabetes' as const], preferencias: [], quarto: 'indiferente' as const,
    local: { label: 'Matosinhos', lat: 41.1844, lng: -8.6963 }, raioKm: 15, orcamentoMax: 1500, urgencia: 'imediata' as const, precisaAcordoSS: false,
  }

  it('casos: criar, alterar (só as chaves indicadas) e ler', () => {
    expect(casoParaCriacao({ perfil, referencia: ' SS-1 ', altaPrevista: '2026-10-21', consentimento: true })).toEqual({
      p_perfil: { nome: 'José', idade: 90, relacao: 'Utente', genero: null, grau: 'ligeira', necessidades: ['diabetes'], preferencias: [], quarto: 'indiferente',
        local_label: 'Matosinhos', local_lat: 41.1844, local_lng: -8.6963, raio_km: 15, orcamento_max: 1500, urgencia: 'imediata', precisa_acordo_ss: false, notas: null },
      p_referencia: 'SS-1', p_alta_prevista: '2026-10-21', p_consentimento: true,
    })
    expect(casoParaAtualizacao('k1', { estado: 'colocado' })).toEqual({ p_caso_id: 'k1', p_alteracoes: { estado: 'colocado' } })
    expect(casoParaAtualizacao('k1', { referencia: undefined, perfil: { orcamentoMax: 1600, notas: ' ' } }).p_alteracoes)
      .toEqual({ referencia: null, perfil: { orcamento_max: 1600, notas: null } })
    expect(casoDeLinha({ id: 'k1', profissional_id: 'u', perfil_id: 'p', referencia: null, alta_prevista: '2026-10-21', consentimento_em: '2026-10-01T10:00:00Z',
      estado: 'aberto', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-02T10:00:00Z' }))
      .toEqual({ id: 'k1', profissionalId: 'u', perfilId: 'p', referencia: undefined, altaPrevista: '2026-10-21', consentimento: true, estado: 'aberto',
        criadoEm: '2026-10-01T10:00:00.000Z', atualizadoEm: '2026-10-02T10:00:00.000Z' })
  })

  it('avaliação: notas inteiras para a BD', () => {
    expect(avaliacaoParaRpc('c1', { nota: 4.4, texto: '  Muito bom acolhimento. ', aspetos: { cuidados: 5, alimentacao: 4, instalacoes: 4, comunicacao: 3.6 } })).toEqual({
      p_candidatura_id: 'c1', p_nota: 4, p_texto: 'Muito bom acolhimento.', p_aspetos: { cuidados: 5, alimentacao: 4, instalacoes: 4, comunicacao: 4 },
    })
  })

  it('procura: ida (registar_procura) e volta (procura_na_zona) no formato de resumirProcuras', () => {
    const p: Omit<ProcuraAnonima, 'id' | 'criadaEm'> = { distrito: 'Porto', lugar: 'Porto — Bonfim', grau: 'grave', cuidados: ['demencia', 'demencia'], orcamentoMax: 1500, resultados: 4, comVaga: 0 }
    expect(procuraParaRpc(p)).toEqual({ p_distrito: 'Porto', p_lugar: 'Porto — Bonfim', p_grau: 'grave', p_cuidados: ['demencia'], p_orcamento_max: 1500, p_resultados: 4, p_com_vaga: 0 })
    const lista: ProcuraAnonima[] = [
      { ...p, id: '1', criadaEm: '', cuidados: ['demencia'] },
      { ...p, id: '2', criadaEm: '', cuidados: ['demencia', 'acamados'], grau: 'moderada', orcamentoMax: 900 },
    ]
    expect(procuraNaZonaDeLinha({ distrito: 'Porto', dias: 30, total: 2, cuidados: [{ cuidado: 'demencia', total: 2 }, { cuidado: 'acamados', total: 1 }],
      graus: [{ grau: 'grave', total: 1 }, { grau: 'moderada', total: 1 }], orcamento_mediano: 1500 })).toEqual(resumirProcuras(lista))
    expect(procuraNaZonaDeLinha(undefined)).toEqual({ total: 0, cuidados: [], graus: [], orcamentoMediano: null })
  })

  it('link de confirmação: só nome e vagas da instituição do link', () => {
    expect(vagasPorTokenDeLinha({ instituicao_id: 'lar-x', nome: 'Lar X', quartos: [{ tipo: 'duplo', total: 10, livres: 2 }], vagas_livres: 2, atualizado_em: '2026-10-12T10:00:00+00:00' }))
      .toEqual({ larId: 'lar-x', nome: 'Lar X', quartos: [{ tipo: 'duplo', total: 10, livres: 2 }], vagasLivres: 2, atualizadoEm: '2026-10-12T10:00:00.000Z' })
  })

  it('conta de profissional: organização no registo (user_metadata) e na leitura do perfil', () => {
    const org = { nome: ' Hospital X ', tipo: 'hospital' as const, servico: ' ' }
    expect(dadosRegisto({ role: 'profissional', nome: ' Marta ', telefone: '', organizacao: org }))
      .toEqual({ role: 'profissional', nome: 'Marta', organizacao: { nome: 'Hospital X', tipo: 'hospital' } })
    // a organização só se envia para contas de profissionais
    expect(dadosRegisto({ role: 'familia', nome: 'Ana', organizacao: org })).toEqual({ role: 'familia', nome: 'Ana' })
    expect(organizacaoDeJson({ nome: 'Hospital X', tipo: 'inventado' })).toEqual({ nome: 'Hospital X', tipo: 'outro', servico: undefined })
    const u = utilizadorDeLinha({ id: 'u', role: 'profissional', nome: 'Marta', telefone: null, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z',
      organizacao: { nome: 'Hospital X', tipo: 'hospital', servico: 'Serviço Social' } }, 'm@h.pt')
    expect(u.organizacao).toEqual({ nome: 'Hospital X', tipo: 'hospital', servico: 'Serviço Social' })
  })
})

describe('versão grátis do Acesso Família (instituicoes_publicas, avaliacoes_instituicao, acesso_estado)', () => {
  it('a faixa de preço da BD tem o texto de faixaPreco (o mesmo limite: 1.000 € já é a faixa do meio)', () => {
    for (const v of [0, 999, 1000, 1999, 2000, 4800]) {
      const lar = { natureza: 'privado' as const, mensalidadeMin: v }
      expect(faixaPrecoTexto(faixaPrecoDe(lar))).toBe(faixaPreco(lar))
    }
    expect(faixaPrecoDe({ natureza: 'misericordia', mensalidadeMin: 2500 })).toBe('conforme_rendimentos')
    expect(faixaPrecoTexto('conforme_rendimentos')).toBe(faixaPreco({ natureza: 'ipss', mensalidadeMin: 0 }))
  })

  it('larPublicoDeLinha: só a camada grátis (nomes dos extras, faixa, contagens de avaliações) e os níveis de verificação', () => {
    const linha = {
      id: 'lar-x', nome: 'X', tipo: 'erpi', natureza: 'privado', extras_nomes: ['Cabeleireiro'], faixa_preco: '1000_2000',
      avaliacoes_publicadas: 3, avaliacoes_verificadas: 1, licenca: '1/2020', verificacao_estado: 'pendente',
      licenca_confirmada_em: '2026-09-01T10:00:00+00:00', capa: { hue: 10, variante: 1 }, lat: 41.1, lng: -8.6,
    } as unknown as InstituicaoPublicaRow
    const l = larPublicoDeLinha(linha)
    expect(l).toMatchObject({ extras: [{ nome: 'Cabeleireiro' }], faixaPreco: '1000_2000', avaliacoesPublicadas: 3, avaliacoesVerificadas: 1, lat: 41.1 })
    for (const k of ['quartos', 'listaEspera', 'telefone', 'morada', 'mensalidadeMin', 'atualizadoEm', 'historicoSaidas']) expect(l).not.toHaveProperty(k)
    expect(niveisDeLarPublico(l)).toEqual({ licenca: true, visitado: false, avaliacoesVerificadas: true })
  })

  it('avaliacoes_instituicao: excerto (versão grátis) ou opinião completa; excertoAvaliacao corta numa palavra', () => {
    const base = { id: 7, instituicao_id: 'lar-x', autor: 'Ana F.', relacao: 'Filha', nota: 5, texto: 'Bom.', verificada: true, created_at: '2026-10-01T10:00:00+00:00' }
    const ex = avaliacaoInstituicaoDeLinha({ ...base, aspeto_cuidados: null, aspeto_alimentacao: null, aspeto_instalacoes: null, aspeto_comunicacao: null, excerto: true })
    expect(eExcertoAvaliacao(ex) && ex).toMatchObject({ id: '7', excerto: true })
    expect(ex).not.toHaveProperty('aspetos')
    const cheia = avaliacaoInstituicaoDeLinha({ ...base, aspeto_cuidados: 5, aspeto_alimentacao: 4, aspeto_instalacoes: 4, aspeto_comunicacao: 5, excerto: false })
    expect(cheia).toMatchObject({ aspetos: { cuidados: 5, comunicacao: 5 } })
    const longo = `${'palavra '.repeat(40)}fim.`
    const e = excertoAvaliacao(longo)
    expect(e.length).toBeLessThanOrEqual(241)
    expect(e).toMatch(/palavra…$/)
    expect(excertoAvaliacao('curto')).toBe('curto')
  })

  it('disponibilidade_agregada e acesso_estado', () => {
    expect(disponibilidadeDeLinha({ total: 3, com_vaga: null, breve: null })).toEqual({ total: 3, comVaga: null, breve: null })
    expect(disponibilidadeDeLinha(undefined)).toEqual({ total: 0, comVaga: null, breve: null })
    const agora = Date.parse('2026-10-13T10:00:00Z')
    expect(acessoDeLinha({ completo: true, ativo: true, ate: '2026-10-20T10:00:00+00:00', plano: 'acesso_30', pagamentos: [] }, agora)).toEqual({
      completo: true, ativo: true, ate: '2026-10-20T10:00:00.000Z', plano: 'acesso_30', diasRestantes: 7, pagamentos: [],
    })
    expect(acessoDeLinha({ completo: false, ativo: false, ate: null, plano: null, pagamentos: [] }, agora)).toEqual({
      completo: false, ativo: false, ate: undefined, plano: undefined, diasRestantes: 0, pagamentos: [],
    })
  })
})
