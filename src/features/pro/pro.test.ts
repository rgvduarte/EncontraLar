import { describe, expect, it } from 'vitest'
import type { Candidatura, EstadoCandidatura } from '@/types'
import { isoDia } from '@/lib/format'
import { contagemAlta, frasePerfil, nomeAbreviado, ordenarCasos, resumirRespostas, ultimaNotaDoLar, urgenciaDaAlta } from './shared/caso'
import { casoVazio, validarCaso, type CasoForm } from './form/casoModel'

const DIA = 86_400_000
const hoje = new Date(2026, 9, 12, 10).getTime()
const daqui = (n: number) => isoDia(new Date(hoje + n * DIA))

const cand = (estado: EstadoCandidatura, extra: Partial<Candidatura> = {}) =>
  ({ id: `c-${estado}-${Math.random()}`, estado, historico: [], atualizadaEm: '2026-10-10T10:00:00Z', ...extra }) as Candidatura

describe('nomeAbreviado', () => {
  it('primeiro nome + inicial do apelido', () => {
    expect(nomeAbreviado('José Barbosa')).toBe('José B.')
    expect(nomeAbreviado('Maria do Carmo Ferreira')).toBe('Maria F.')
    expect(nomeAbreviado('  albano  teixeira ')).toBe('albano T.')
  })
  it('um só nome ou iniciais ficam como estão', () => {
    expect(nomeAbreviado('Albano')).toBe('Albano')
    expect(nomeAbreviado('J. B.')).toBe('J. B.')
    expect(nomeAbreviado('JB')).toBe('JB')
    expect(nomeAbreviado('')).toBe('Sem nome')
  })
})

describe('contagemAlta', () => {
  it('conta os dias e destaca a alta próxima (≤ 2 dias) num caso aberto', () => {
    expect(contagemAlta(daqui(4), 'aberto', hoje)).toMatchObject({ texto: 'Alta em 4 dias', urgente: false, dias: 4 })
    expect(contagemAlta(daqui(2), 'aberto', hoje)).toMatchObject({ texto: 'Alta em 2 dias', urgente: true })
    expect(contagemAlta(daqui(1), 'aberto', hoje).texto).toBe('Alta amanhã')
    expect(contagemAlta(daqui(0), 'aberto', hoje).texto).toBe('Alta hoje')
  })
  it('longe ou já passada: "Alta prevista: <dia>"; só é urgente se o caso estiver aberto', () => {
    expect(contagemAlta(daqui(20), 'aberto', hoje).texto).toMatch(/^Alta prevista: \d+ [a-z]+\.$/)
    expect(contagemAlta(daqui(-3), 'aberto', hoje)).toMatchObject({ urgente: true, passou: true })
    expect(contagemAlta(daqui(-3), 'colocado', hoje)).toMatchObject({ urgente: false, passou: true })
    expect(contagemAlta(undefined, 'aberto', hoje)).toMatchObject({ texto: 'Sem data de alta', dias: null, urgente: false })
  })
})

describe('urgenciaDaAlta', () => {
  it('alta próxima ou sem data → imediata', () => {
    expect(urgenciaDaAlta(undefined, hoje)).toBe('imediata')
    expect(urgenciaDaAlta(daqui(9), hoje)).toBe('imediata')
    expect(urgenciaDaAlta(daqui(60), hoje)).toBe('1-3meses')
    expect(urgenciaDaAlta(daqui(120), hoje)).toBe('3-6meses')
  })
})

describe('resumirRespostas', () => {
  it('"3 instituições · 1 em análise · 1 recusou" (sem contar os cancelados)', () => {
    const r = resumirRespostas([cand('enviada'), cand('em_analise'), cand('recusada'), cand('cancelada')])
    expect(r.texto).toBe('3 instituições · 1 em análise · 1 recusou')
    expect(r.enviados).toBe(3)
    expect(r.propostas).toHaveLength(0)
  })
  it('só por abrir, nada enviado e vagas propostas (prazo mais curto primeiro)', () => {
    expect(resumirRespostas([cand('enviada'), cand('enviada')]).texto).toBe('2 instituições · 2 por abrir')
    expect(resumirRespostas([]).texto).toBe('Ainda não enviado')
    const a = cand('vaga_proposta', { prazoResposta: '2026-10-14T10:00:00Z' })
    const b = cand('vaga_proposta', { prazoResposta: '2026-10-13T10:00:00Z' })
    expect(resumirRespostas([a, b]).propostas[0]).toBe(b)
  })
})

describe('ordenarCasos', () => {
  it('abertos primeiro, pela data de alta (sem data no fim); depois os outros, mais recentes primeiro', () => {
    const casos = [
      { id: 'f', estado: 'fechado' as const, altaPrevista: daqui(1), atualizadoEm: '2026-10-01' },
      { id: 'a9', estado: 'aberto' as const, altaPrevista: daqui(9), atualizadoEm: '2026-10-01' },
      { id: 'sem', estado: 'aberto' as const, altaPrevista: undefined, atualizadoEm: '2026-10-11' },
      { id: 'a4', estado: 'aberto' as const, altaPrevista: daqui(4), atualizadoEm: '2026-10-01' },
      { id: 'c', estado: 'colocado' as const, altaPrevista: daqui(-20), atualizadoEm: '2026-10-05' },
    ]
    expect(ordenarCasos(casos).map((c) => c.id)).toEqual(['a4', 'a9', 'sem', 'c', 'f'])
  })
})

describe('frasePerfil e notas', () => {
  it('descreve o perfil numa frase, sem nome', () => {
    const f = frasePerfil({
      grau: 'grave',
      necessidades: ['acamados', 'enfermagem24h'],
      local: { label: 'Porto — Paranhos', lat: 0, lng: 0 },
      raioKm: 20,
      orcamentoMax: 1800,
      precisaAcordoSS: true,
      quarto: 'indiferente',
    })
    expect(f).toContain('Dependência grave.')
    expect(f).toContain('Precisa de cuidados de pessoa acamada e enfermagem 24 horas.')
    expect(f).toContain('até 20 km')
    expect(f).toContain('acordo da Segurança Social')
  })
  it('a última nota é a da instituição (não a do encaminhamento nem a da família)', () => {
    const c = {
      historico: [
        { data: '1', estado: 'enviada' as const, nota: 'Encaminhado por Hospital X.' },
        { data: '2', estado: 'em_analise' as const, nota: 'Vamos ligar amanhã.' },
        { data: '3', estado: 'aceite' as const, nota: 'Vaga aceite pela família.' },
      ],
    }
    expect(ultimaNotaDoLar(c)).toEqual({ nota: 'Vamos ligar amanhã.', data: '2' })
    expect(ultimaNotaDoLar({ historico: [] })).toBeNull()
  })
})

describe('validarCaso', () => {
  const valido = (): CasoForm => ({ ...casoVazio(), nome: 'José B.', idade: 90, local: { label: 'Matosinhos', lat: 41.18, lng: -8.69 }, consentimento: true })
  it('aceita um caso completo', () => {
    expect(validarCaso(valido(), { novo: true, hoje: '2026-10-12' })).toEqual({})
  })
  it('exige nome, idade, local e consentimento (só no caso novo)', () => {
    const e = validarCaso({ ...casoVazio(), consentimento: false }, { novo: true, hoje: '2026-10-12' })
    expect(Object.keys(e).sort()).toEqual(['consentimento', 'idade', 'local', 'nome'])
    expect(validarCaso({ ...valido(), consentimento: false }, { novo: false }).consentimento).toBeUndefined()
  })
  it('alta no passado só é erro quando a data é nova', () => {
    expect(validarCaso({ ...valido(), altaPrevista: '2026-10-01' }, { novo: true, hoje: '2026-10-12' }).altaPrevista).toBeTruthy()
    expect(validarCaso({ ...valido(), altaPrevista: '2026-10-01' }, { novo: false, altaInicial: '2026-10-01', hoje: '2026-10-12' }).altaPrevista).toBeUndefined()
  })
  it('a referência não pode parecer um NIF ou número de utente', () => {
    expect(validarCaso({ ...valido(), referencia: '123456789' }, { novo: true }).referencia).toBeTruthy()
    expect(validarCaso({ ...valido(), referencia: 'NIF 123 456 789' }, { novo: true }).referencia).toBeTruthy()
    expect(validarCaso({ ...valido(), referencia: 'SS-2026-0418' }, { novo: true }).referencia).toBeUndefined()
  })
})
