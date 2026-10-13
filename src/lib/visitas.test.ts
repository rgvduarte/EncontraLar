import { beforeEach, describe, expect, it } from 'vitest'
import { DEMO_EQUIPA_EMAIL, DEMO_FAMILIA_EMAIL, DEMO_LAR_EMAIL, DEMO_LAR_ID, DEMO_PASSWORD } from '@/data/seed'
import type { Visita } from '@/types'
import { cobrancaEntradaTexto, compromissoAte, ENTRADAS_ANO_MENSAL_COMPENSA, planoDoLar, podeMudarPlano } from './acesso'
import { niveisVerificacao, taxaPara } from './negocio'
import { escolherPlanoInstituicao, getCurrentUser, getDB, login, logout, marcarEntrada, register, registarVisita, resetDemo, setAlerta } from './store'

const tudo: Visita['verificacao'] = { licencaConfirmada: true, instalacoesVistas: true, vagasConfirmadas: true, precosConfirmados: true }
const nada: Visita['verificacao'] = { licencaConfirmada: false, instalacoesVistas: false, vagasConfirmadas: false, precosConfirmados: false }
const lar = (id: string) => getDB().lares.find((l) => l.id === id)!
/** o formato de moeda pt-PT usa espaço não separável antes do € */
const cobranca = (id: string) => cobrancaEntradaTexto(lar(id)).replace(/\u00a0/g, ' ')
/** um lar sem dono, da natureza pedida, ainda sem visita da equipa */
const semDono = (natureza: 'privado' | 'ipss') =>
  getDB().lares.find((l) => !l.ownerId && l.natureza === natureza && l.verificacao.estado !== 'verificado' && !getDB().visitas.some((v) => v.larId === l.id))!

describe('equipa de terreno: registo de visitas', () => {
  beforeEach(() => {
    logout()
    resetDemo()
  })

  it('o seed traz a equipa e as visitas do piloto no Porto', () => {
    expect(login(DEMO_EQUIPA_EMAIL, DEMO_PASSWORD).ok).toBe(true)
    expect(getCurrentUser()?.role).toBe('equipa')
    const visitas = getDB().visitas
    expect(visitas.length).toBeGreaterThanOrEqual(5)
    expect(new Set(visitas.map((v) => v.resultado))).toEqual(new Set(['aderiu', 'interessado', 'voltar', 'recusou']))
    // quem aderiu como privado tem a modalidade registada na ficha
    for (const v of visitas.filter((x) => x.resultado === 'aderiu' && x.plano)) expect(lar(v.larId).planoInstituicao).toBe(v.plano)
  })

  it('só a equipa regista visitas', () => {
    const alvo = semDono('privado')
    expect(registarVisita({ larId: alvo.id, resultado: 'aderiu', verificacao: tudo }).ok).toBe(false)
    login(DEMO_FAMILIA_EMAIL, DEMO_PASSWORD)
    expect(registarVisita({ larId: alvo.id, resultado: 'aderiu', verificacao: tudo }).ok).toBe(false)
    login(DEMO_LAR_EMAIL, DEMO_PASSWORD)
    expect(registarVisita({ larId: alvo.id, resultado: 'aderiu', verificacao: tudo }).ok).toBe(false)
    expect(getDB().visitas.some((v) => v.larId === alvo.id)).toBe(false)
  })

  it('adesão de um privado: selo da visita, vagas e preços atualizados, modalidade e conta do responsável', () => {
    login(DEMO_EQUIPA_EMAIL, DEMO_PASSWORD)
    const alvo = semDono('privado')
    const [q] = alvo.quartos
    const r = registarVisita({
      larId: alvo.id,
      resultado: 'aderiu',
      verificacao: tudo,
      licenca: '  999/2026 ',
      plano: 'mensal',
      quartos: [{ tipo: q!.tipo, livres: q!.total + 5, precoMin: 1234, precoMax: 1100 }],
      responsavel: { nome: 'Joana Pires', cargo: 'Diretora técnica', email: ' Joana.Pires@Exemplo.pt ' },
      notas: '  Quer começar já.  ',
      proximoContacto: '2026-11-01',
      criarConta: true,
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.selo).toBe(true)
    const depois = lar(alvo.id)
    expect(depois.verificacao).toMatchObject({ estado: 'verificado', licenca: '999/2026' })
    expect(niveisVerificacao(depois)).toMatchObject({ licenca: true, visitado: true })
    expect(depois.planoInstituicao).toBe('mensal')
    expect(cobranca(alvo.id)).toBe('Incluída na mensalidade (29 € + IVA por mês)')
    // vagas limitadas ao total do quarto; o preço máximo nunca fica abaixo do mínimo
    const q2 = depois.quartos.find((x) => x.tipo === q!.tipo)!
    expect(q2.livres).toBe(q2.total)
    expect([q2.precoMin, q2.precoMax]).toEqual([1234, 1234])
    expect(depois.mensalidadeMin).toBe(Math.min(...depois.quartos.flatMap((x) => [x.precoMin, x.precoMax])))
    expect(Date.parse(depois.atualizadoEm)).toBeGreaterThan(Date.parse(alvo.atualizadoEm))
    // a visita: notas aparadas, sem próximo contacto (só para quem fica a pensar)
    expect(r.visita).toMatchObject({ resultado: 'aderiu', plano: 'mensal', notas: 'Quer começar já.', proximoContacto: undefined })
    expect(getDB().visitas.at(-1)?.id).toBe(r.visita.id)

    // a conta do responsável: email normalizado, palavra-passe provisória que funciona, dona da ficha
    expect(r.conta?.email).toBe('joana.pires@exemplo.pt')
    expect(r.conta?.palavraPasse).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/)
    expect(depois.ownerId).toBe(r.visita.contaCriadaId)
    expect(getDB().notificacoes.some((n) => n.userId === depois.ownerId && n.titulo === 'Visitada pela equipa')).toBe(true)
    logout()
    expect(login(r.conta!.email, r.conta!.palavraPasse).ok).toBe(true)
    expect(getCurrentUser()).toMatchObject({ role: 'lar', larId: alvo.id, nome: 'Joana Pires' })
  })

  it('não cria conta sem email válido nem com um email que já existe', () => {
    login(DEMO_EQUIPA_EMAIL, DEMO_PASSWORD)
    const alvo = semDono('privado')
    const base = { larId: alvo.id, resultado: 'aderiu' as const, verificacao: tudo, criarConta: true }
    expect(registarVisita({ ...base, responsavel: { nome: 'X' } })).toMatchObject({ ok: false })
    expect(registarVisita({ ...base, responsavel: { nome: 'X', email: 'sem-arroba' } })).toMatchObject({ ok: false })
    expect(registarVisita({ ...base, responsavel: { nome: 'X', email: DEMO_FAMILIA_EMAIL.toUpperCase() } })).toMatchObject({ ok: false })
    expect(getDB().visitas.some((v) => v.larId === alvo.id)).toBe(false)
  })

  it('licença confirmada sem ver as instalações: 1.º nível, sem o selo; nada confirmado: a ficha não muda', () => {
    login(DEMO_EQUIPA_EMAIL, DEMO_PASSWORD)
    const alvo = getDB().lares.find((l) => !l.ownerId && l.verificacao.estado === 'nao_verificado')
    if (alvo) {
      const r = registarVisita({ larId: alvo.id, resultado: 'interessado', verificacao: { ...nada, licencaConfirmada: true }, licenca: '123/2020', proximoContacto: '2026-11-15' })
      expect(r).toMatchObject({ ok: true, selo: false, visita: { proximoContacto: '2026-11-15', plano: undefined } })
      expect(lar(alvo.id).verificacao).toMatchObject({ estado: 'nao_verificado', licenca: '123/2020', licencaConfirmadaEm: expect.any(String) })
      expect(niveisVerificacao(lar(alvo.id))).toMatchObject({ licenca: true, visitado: false })
    }
    const outro = semDono('privado')
    const antes = JSON.stringify(outro)
    expect(registarVisita({ larId: outro.id, resultado: 'recusou', verificacao: nada, quartos: [{ tipo: outro.quartos[0]!.tipo, livres: 9, precoMin: 1, precoMax: 2 }] }).ok).toBe(true)
    expect(JSON.stringify(lar(outro.id))).toBe(antes)
  })

  it('IPSS que adere: sem modalidade nem custos', () => {
    login(DEMO_EQUIPA_EMAIL, DEMO_PASSWORD)
    const alvo = semDono('ipss')
    const r = registarVisita({ larId: alvo.id, resultado: 'aderiu', verificacao: tudo, plano: 'mensal', responsavel: { nome: 'Rui Matos', email: 'rui.matos@exemplo.pt' }, criarConta: true })
    expect(r).toMatchObject({ ok: true, visita: { plano: undefined } })
    expect(planoDoLar(lar(alvo.id))).toBeNull()
    expect(cobranca(alvo.id)).toBe('Isenta — setor social')
    // a nova gestora (IPSS) não tem modalidade a escolher
    if (!r.ok) return
    login(r.conta!.email, r.conta!.palavraPasse)
    expect(escolherPlanoInstituicao('mensal')).toMatchObject({ ok: false })
  })
})

describe('modalidade das instituições privadas', () => {
  beforeEach(() => {
    logout()
    resetDemo()
  })

  it('o lar privado escolhe entre por entrada e mensalidade; mais ninguém', () => {
    expect(planoDoLar(lar(DEMO_LAR_ID))).toBe('por_entrada')
    expect(cobranca(DEMO_LAR_ID)).toBe('Taxa fixa: 150 € + IVA por entrada')
    expect(ENTRADAS_ANO_MENSAL_COMPENSA).toBe(3)
    expect(escolherPlanoInstituicao('mensal').ok).toBe(false)
    login(DEMO_FAMILIA_EMAIL, DEMO_PASSWORD)
    expect(escolherPlanoInstituicao('mensal').ok).toBe(false)
    login(DEMO_LAR_EMAIL, DEMO_PASSWORD)
    expect(escolherPlanoInstituicao('por_entrada').ok).toBe(true) // já está: nada muda
    expect(escolherPlanoInstituicao('mensal').ok).toBe(true)
    expect(planoDoLar(lar(DEMO_LAR_ID))).toBe('mensal')
    expect(cobranca(DEMO_LAR_ID)).toBe('Incluída na mensalidade (29 € + IVA por mês)')
  })

  it('mensalidade: compromisso de 12 meses e entradas incluídas, sem taxa', () => {
    login(DEMO_LAR_EMAIL, DEMO_PASSWORD)
    escolherPlanoInstituicao('mensal')
    const l = lar(DEMO_LAR_ID)
    const ate = compromissoAte(l)!
    expect(Math.round((Date.parse(ate) - Date.parse(l.planoDesde!)) / 86_400_000)).toBeGreaterThanOrEqual(365)
    expect(podeMudarPlano(l)).toBe(false)
    expect(podeMudarPlano(l, Date.parse(ate) + 1)).toBe(true)
    // voltar já à taxa por entrada não dá (senão mudava-se só no mês de uma entrada)
    const r = escolherPlanoInstituicao('por_entrada')
    expect(r.ok).toBe(false)
    expect(!r.ok && r.erro).toMatch(/compromisso de 12 meses/)
    expect(planoDoLar(lar(DEMO_LAR_ID))).toBe('mensal')
    // a entrada fica com a taxa da modalidade em vigor quando é confirmada
    expect(taxaPara(lar(DEMO_LAR_ID))).toBe('incluida')
    const c = getDB().candidaturas.find((x) => x.larId === DEMO_LAR_ID && x.estado === 'aceite' && !x.entrada)
    expect(c).toBeDefined()
    marcarEntrada(c!.id, '2026-10-20')
    expect(getDB().candidaturas.find((x) => x.id === c!.id)?.entrada?.taxa).toBe('incluida')
  })
})

describe('alertas de vaga (Acesso Família)', () => {
  beforeEach(() => {
    logout()
    resetDemo()
  })

  it('sem passe não se liga o alerta; desligar fica sempre à mão', () => {
    register({ role: 'familia', nome: 'Rita Teste', email: 'rita.alerta@exemplo.pt', password: 'palavrapasse1' })
    const user = getCurrentUser()!
    expect(setAlerta(DEMO_LAR_ID, true)).toBe(false)
    expect(getDB().favoritos.some((f) => f.userId === user.id && f.alerta)).toBe(false)
    expect(setAlerta(DEMO_LAR_ID, false)).toBe(true)
    login(DEMO_FAMILIA_EMAIL, DEMO_PASSWORD)
    expect(setAlerta(DEMO_LAR_ID, true)).toBe(true)
  })
})
