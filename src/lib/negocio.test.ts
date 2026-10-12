import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_LAR_EMAIL, DEMO_LAR_ID, DEMO_PASSWORD, DEMO_PRO_EMAIL } from '@/data/seed'
import {
  aceitarPedido,
  atualizarCandidatura,
  avaliarLar,
  confirmarEntradaFamilia,
  criarCaso,
  enviarCaso,
  getDB,
  login,
  logout,
  marcarEntrada,
  registarProcura,
  resetDemo,
  responderConfirmacao,
  responderVaga,
} from './store'
import { contactoVisivel, entradaAtribuida, entradaVerificada, faixaEtaria, niveisVerificacao, resumoAnonimo, taxaPara, tokenConfirmacao } from './negocio'

const cand = (id: string) => getDB().candidaturas.find((c) => c.id === id)!

describe('regras do modelo de negócio', () => {
  it('só os lares privados pagam a taxa por entrada', () => {
    expect(taxaPara({ natureza: 'privado' })).toBe('aplicavel')
    expect(taxaPara({ natureza: 'ipss' })).toBe('isenta')
    expect(taxaPara({ natureza: 'misericordia' })).toBe('isenta')
  })

  it('faixa etária sem a idade exata', () => {
    expect(faixaEtaria(84)).toBe('80–84')
    expect(faixaEtaria(85)).toBe('85–89')
    expect(faixaEtaria(97)).toBe('95 ou mais')
  })

  it('o contacto só fica visível depois de o lar aceitar o pedido', () => {
    expect(contactoVisivel({ estado: 'enviada' })).toBe(false)
    expect(contactoVisivel({ estado: 'enviada', desbloqueadaEm: '2026-10-01T10:00:00Z' })).toBe(true)
    expect(contactoVisivel({ estado: 'em_analise' })).toBe(true)
  })

  it('a entrada conta até 12 meses depois do pedido', () => {
    const entrada = { data: '2026-06-01', taxa: 'aplicavel' as const }
    expect(entradaAtribuida({ criadaEm: '2026-01-10T10:00:00Z', entrada })).toBe(true)
    expect(entradaAtribuida({ criadaEm: '2025-01-10T10:00:00Z', entrada })).toBe(false)
    expect(entradaAtribuida({ criadaEm: '2026-01-10T10:00:00Z' })).toBe(false)
  })

  it('o token de confirmação é estável e diferente por instituição', () => {
    expect(tokenConfirmacao('lar-a')).toBe(tokenConfirmacao('lar-a'))
    expect(tokenConfirmacao('lar-a')).not.toBe(tokenConfirmacao('lar-b'))
  })
})

describe('fluxos (store)', () => {
  beforeEach(() => {
    logout()
    resetDemo()
  })

  it('o seed traz os casos, a procura sem resposta e os tokens', () => {
    const db = getDB()
    expect(db.casos.length).toBeGreaterThanOrEqual(3)
    expect(db.procuras.length).toBeGreaterThan(20)
    expect(db.lares.every((l) => !!l.confirmacaoToken)).toBe(true)
    // encaminhamento ainda por aceitar no lar de demonstração: só resumo anónimo
    const pro1 = cand('c-pro-1')
    expect(contactoVisivel(pro1)).toBe(false)
    expect(resumoAnonimo(pro1)).not.toHaveProperty('nome')
    expect(resumoAnonimo(pro1).origem).toBe('profissional')
    // IPSS: entrada isenta de taxa
    const pro4 = cand('c-pro-4')
    const ipss = db.lares.find((l) => l.id === pro4.larId)!
    expect(pro4.entrada?.taxa).toBe(taxaPara(ipss))
    // avaliação verificada no lar de demonstração
    expect(niveisVerificacao(db.lares.find((l) => l.id === DEMO_LAR_ID)!).avaliacoesVerificadas).toBe(true)
  })

  it('profissional → vários lares → aceitar → vaga → entrada confirmada pelos dois lados → avaliação verificada', () => {
    expect(login(DEMO_PRO_EMAIL, DEMO_PASSWORD).ok).toBe(true)
    const base = getDB().perfis.find((p) => p.id === 'p-pro-3')!
    const { id: _id, userId: _u, criadoEm: _c, atualizadoEm: _a, ...perfil } = base
    const caso = criarCaso({ perfil, altaPrevista: '2026-12-01', consentimento: true })!
    expect(caso).toBeTruthy()
    const outro = getDB().lares.find((l) => l.id !== DEMO_LAR_ID && l.distrito === 'Porto')!
    const enviados = enviarCaso(caso.id, [DEMO_LAR_ID, outro.id])
    expect(enviados).toHaveLength(2)
    expect(enviarCaso(caso.id, [DEMO_LAR_ID])).toHaveLength(0) // sem duplicados
    const c = enviados.find((x) => x.larId === DEMO_LAR_ID)!
    expect(c.origem).toBe('profissional')
    expect(contactoVisivel(cand(c.id))).toBe(false)

    expect(login(DEMO_LAR_EMAIL, DEMO_PASSWORD).ok).toBe(true)
    aceitarPedido(c.id)
    expect(cand(c.id).estado).toBe('em_analise')
    expect(contactoVisivel(cand(c.id))).toBe(true)
    atualizarCandidatura(c.id, 'vaga_proposta')

    login(DEMO_PRO_EMAIL, DEMO_PASSWORD)
    responderVaga(c.id, true)
    expect(cand(c.id).estado).toBe('aceite')
    expect(avaliarLar(c.id, { nota: 5, texto: 'x', aspetos: { cuidados: 5, alimentacao: 5, instalacoes: 5, comunicacao: 5 } })).toBeNull()

    login(DEMO_LAR_EMAIL, DEMO_PASSWORD)
    marcarEntrada(c.id, '2026-10-20')
    expect(cand(c.id).estado).toBe('admitida')
    expect(cand(c.id).entrada?.taxa).toBe('aplicavel') // o lar de demonstração é privado
    expect(entradaVerificada(cand(c.id))).toBe(false)

    login(DEMO_PRO_EMAIL, DEMO_PASSWORD)
    confirmarEntradaFamilia(c.id, '2026-10-20')
    expect(entradaVerificada(cand(c.id))).toBe(true)
    const r = avaliarLar(c.id, { nota: 4, texto: 'Bom acolhimento.', aspetos: { cuidados: 4, alimentacao: 4, instalacoes: 4, comunicacao: 4 } })
    expect(r?.verificada).toBe(true)
    expect(avaliarLar(c.id, { nota: 4, texto: 'outra', aspetos: { cuidados: 4, alimentacao: 4, instalacoes: 4, comunicacao: 4 } })).toBeNull()
  })

  it('a família não pode confirmar a entrada de um pedido que não é seu', () => {
    login(DEMO_LAR_EMAIL, DEMO_PASSWORD)
    confirmarEntradaFamilia('c-fam-5', '2026-10-20')
    expect(cand('c-fam-5').entrada).toBeUndefined()
  })

  it('procura sem resposta: uma por combinação e por sessão', () => {
    const antes = getDB().procuras.length
    const p = { distrito: 'Braga' as const, lugar: 'Braga', grau: 'moderada' as const, cuidados: ['demencia' as const], orcamentoMax: 1500, resultados: 3, comVaga: 0 }
    registarProcura(p)
    registarProcura(p)
    expect(getDB().procuras.length).toBe(antes + 1)
  })

  it('link de confirmação: "não" põe os lugares livres a zero', () => {
    const lar = getDB().lares.find((l) => l.quartos.some((q) => q.livres > 0))!
    const r = responderConfirmacao(lar.confirmacaoToken!, false)
    expect(r?.quartos.every((q) => q.livres === 0)).toBe(true)
    expect(responderConfirmacao('token-errado', true)).toBeNull()
  })
})
