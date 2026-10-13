import { beforeEach, describe, expect, it } from 'vitest'
import type { Lar, Visita } from '@/types'
import { DEMO_EQUIPA_EMAIL, DEMO_PASSWORD } from '@/data/seed'
import { getDB, login, logout, registarVisita, resetDemo } from '@/lib/store'
import { formInicial, maisDias, mudancaResultado, registoDe, resumirMudancas, soAlgarismos, validarVisita, type FormVisita } from './formulario'
import { juntarRascunho, mesmoFormulario } from './rascunho'

// "agora" fixo: terça-feira, 13 de outubro de 2026, 10h00 (hora local)
const AGORA = new Date(2026, 9, 13, 10, 0)
/** o formato de moeda pt-PT usa espaço não separável antes do € */
const sp = (s: string | undefined) => s?.replace(/ /g, ' ')

const nada: Visita['verificacao'] = { licencaConfirmada: false, instalacoesVistas: false, vagasConfirmadas: false, precosConfirmados: false }

const lar = (extra: Partial<Lar> = {}): Lar =>
  ({
    id: 'lar-x',
    nome: 'Residência X',
    natureza: 'privado',
    distrito: 'Porto',
    quartos: [
      { tipo: 'individual', total: 10, livres: 2, precoMin: 1500, precoMax: 1800 },
      { tipo: 'duplo', total: 6, livres: 0, precoMin: 1200, precoMax: 1400 },
    ],
    cuidados: ['oxigenio', 'enfermagem24h'],
    verificacao: { estado: 'nao_verificado', licenca: '12/2019' },
    reviews: [],
    ...extra,
  }) as Lar

const visita = (extra: Partial<Visita> = {}): Visita => ({
  id: 'v-1',
  larId: 'lar-x',
  equipaId: 'u-equipa',
  data: AGORA.toISOString(),
  resultado: 'interessado',
  verificacao: nada,
  ...extra,
})

const comResultado = (f: FormVisita, patch: Partial<FormVisita>): FormVisita => ({ ...f, ...patch })

describe('formulário da visita: valores iniciais', () => {
  it('começa com a ficha de hoje; o responsável vem da última visita que o registou; contacto daqui a 7 dias', () => {
    const anteriores = [
      visita({ id: 'v-2', responsavel: undefined }),
      visita({ id: 'v-1', responsavel: { nome: 'Paulo Antunes', cargo: 'Sócio-gerente', email: 'paulo@exemplo.pt' } }),
    ]
    const f = formInicial(lar({ planoInstituicao: 'mensal' }), anteriores, AGORA)
    expect(f.licenca).toBe('12/2019')
    expect(f.quartos).toEqual([
      { tipo: 'individual', livres: 2, precoMin: '1500', precoMax: '1800' },
      { tipo: 'duplo', livres: 0, precoMin: '1200', precoMax: '1400' },
    ])
    // pela ordem da lista de cuidados (a mesma dos botões)
    expect(f.cuidados).toEqual(['enfermagem24h', 'oxigenio'])
    expect(f.responsavel).toEqual({ nome: 'Paulo Antunes', cargo: 'Sócio-gerente', telefone: '', email: 'paulo@exemplo.pt' })
    expect(f.resultado).toBeNull()
    expect(f.plano).toBe('mensal')
    expect(f.criarConta).toBe(false)
    expect(f.proximoContacto).toBe('2026-10-20')
    expect(Object.values(f.verificacao).every((v) => v === false)).toBe(true)
    expect(maisDias(new Date(2026, 11, 28), 7)).toBe('2027-01-04')
    expect(soAlgarismos('1.250 €')).toBe('1250')
  })
})

describe('validação suave', () => {
  const base = formInicial(lar(), [], AGORA)

  it('pede só o resultado quando nada mais é preciso', () => {
    expect(validarVisita(base, lar(), AGORA)).toEqual({ resultado: 'Escolha o resultado da visita.' })
    expect(validarVisita(comResultado(base, { resultado: 'recusou' }), lar(), AGORA)).toEqual({})
  })

  it('o email só quando se cria a conta (e só se ninguém gere a ficha)', () => {
    const aderiu = comResultado(base, { resultado: 'aderiu', criarConta: true })
    expect(validarVisita(aderiu, lar(), AGORA).email).toBe('Indique o email do responsável para criar a conta.')
    const mau = { ...aderiu, responsavel: { ...aderiu.responsavel, email: 'joana@' } }
    expect(validarVisita(mau, lar(), AGORA).email).toBe('O email não parece válido.')
    const bom = { ...aderiu, responsavel: { ...aderiu.responsavel, email: ' joana@exemplo.pt ' } }
    expect(validarVisita(bom, lar(), AGORA)).toEqual({})
    // já tem dono: o interruptor não conta
    expect(validarVisita(aderiu, lar({ ownerId: 'u-1' }), AGORA)).toEqual({})
    // sem o interruptor, o email é livre
    expect(validarVisita({ ...mau, criarConta: false }, lar(), AGORA)).toEqual({})
  })

  it('a data só quando fica a acompanhar: hoje ou depois', () => {
    const f = comResultado(base, { resultado: 'voltar' })
    expect(validarVisita(f, lar(), AGORA)).toEqual({})
    expect(validarVisita({ ...f, proximoContacto: '2026-10-13' }, lar(), AGORA)).toEqual({})
    expect(validarVisita({ ...f, proximoContacto: '2026-10-12' }, lar(), AGORA).proximoContacto).toBe('Escolha uma data a partir de hoje.')
    expect(validarVisita({ ...f, proximoContacto: '' }, lar(), AGORA).proximoContacto).toBe('Escolha a data do próximo contacto.')
    expect(validarVisita({ ...f, resultado: 'aderiu', proximoContacto: '' }, lar(), AGORA)).toEqual({})
  })

  it('preços confirmados: inteiros e o máximo nunca abaixo do mínimo', () => {
    const quartos = [
      { tipo: 'individual' as const, livres: 2, precoMin: '1900', precoMax: '1800' },
      { tipo: 'duplo' as const, livres: 0, precoMin: '', precoMax: '1400' },
    ]
    const f = comResultado(base, { resultado: 'recusou', quartos })
    expect(validarVisita(f, lar(), AGORA)).toEqual({})
    const confirmados = { ...f, verificacao: { ...f.verificacao, precosConfirmados: true } }
    expect(validarVisita(confirmados, lar(), AGORA)).toEqual({
      'precoMax:individual': 'Não pode ser inferior ao mínimo.',
      'precoMin:duplo': 'Indique o valor, em euros.',
    })
  })

  it('dentro do compromisso da mensalidade, «Por entrada» não se pode escolher', () => {
    const mensal = lar({ planoInstituicao: 'mensal', planoDesde: new Date(2026, 8, 1).toISOString() })
    const f = comResultado(formInicial(mensal, [], AGORA), { resultado: 'aderiu' })
    expect(validarVisita(f, mensal, AGORA)).toEqual({})
    expect(validarVisita({ ...f, plano: 'por_entrada' }, mensal, AGORA).plano).toMatch(/compromisso de 12 meses/)
    // no fim do compromisso, já pode
    const antigo = { ...mensal, planoDesde: new Date(2025, 8, 1).toISOString() }
    expect(validarVisita({ ...f, plano: 'por_entrada' }, antigo, AGORA)).toEqual({})
  })
})

describe('o pedido a registarVisita', () => {
  const base = formInicial(lar(), [], AGORA)

  it('envia só o que foi confirmado ou mudou', () => {
    const r = registoDe(comResultado(base, { resultado: 'recusou', notas: '  ' }), lar())
    expect(r).toMatchObject({ larId: 'lar-x', resultado: 'recusou', verificacao: nada })
    for (const k of ['licenca', 'responsavel', 'plano', 'notas', 'proximoContacto', 'quartos', 'cuidados', 'criarConta'] as const) expect(r[k]).toBeUndefined()
  })

  it('adesão de um privado: modalidade, quartos, cuidados, responsável e conta', () => {
    const f: FormVisita = {
      ...base,
      verificacao: { licencaConfirmada: true, instalacoesVistas: true, vagasConfirmadas: true, precosConfirmados: false },
      licenca: ' 99/2026 ',
      quartos: [
        { tipo: 'individual', livres: 3, precoMin: '1', precoMax: '2' },
        { tipo: 'duplo', livres: 9, precoMin: '1200', precoMax: '1400' },
      ],
      cuidados: ['enfermagem24h', 'fisioterapia'],
      responsavel: { nome: ' Joana Pires ', cargo: '', telefone: '', email: 'joana@exemplo.pt' },
      resultado: 'aderiu',
      plano: 'mensal',
      criarConta: true,
      notas: ' Quer começar já. ',
    }
    expect(registoDe(f, lar())).toEqual({
      larId: 'lar-x',
      resultado: 'aderiu',
      verificacao: f.verificacao,
      licenca: '99/2026',
      responsavel: { nome: 'Joana Pires', cargo: undefined, telefone: undefined, email: 'joana@exemplo.pt' },
      plano: 'mensal',
      notas: 'Quer começar já.',
      proximoContacto: undefined,
      // os livres nunca passam do total do quarto (o store só aplica os preços se tiverem sido confirmados)
      quartos: [
        { tipo: 'individual', livres: 3, precoMin: 1, precoMax: 2 },
        { tipo: 'duplo', livres: 6, precoMin: 1200, precoMax: 1400 },
      ],
      cuidados: ['enfermagem24h', 'fisioterapia'],
      criarConta: true,
    })
  })

  it('IPSS: sem modalidade; quem fica a acompanhar leva a data; com dono, nunca cria conta', () => {
    const ipss = lar({ natureza: 'ipss', ownerId: 'u-1' })
    const f = comResultado(formInicial(ipss, [], AGORA), { resultado: 'aderiu', plano: 'mensal', criarConta: true })
    expect(registoDe(f, ipss)).toMatchObject({ plano: undefined, criarConta: undefined })
    expect(registoDe({ ...f, resultado: 'interessado' }, ipss)).toMatchObject({ proximoContacto: '2026-10-20', plano: undefined })
    expect(() => registoDe(base, lar())).toThrow()
  })
})

describe('o que mudou', () => {
  it('selo, vagas, preços, cuidados e o resultado', () => {
    const antes = lar()
    const depois = lar({
      verificacao: { estado: 'verificado', data: AGORA.toISOString(), licenca: '99/2026' },
      quartos: [
        { tipo: 'individual', total: 10, livres: 3, precoMin: 1550, precoMax: 1850 },
        { tipo: 'duplo', total: 6, livres: 0, precoMin: 1200, precoMax: 1400 },
      ],
      cuidados: ['enfermagem24h', 'fisioterapia'],
    })
    const v = visita({ resultado: 'aderiu', plano: 'mensal', verificacao: { licencaConfirmada: true, instalacoesVistas: true, vagasConfirmadas: true, precosConfirmados: true } })
    const m = resumirMudancas(antes, depois, v).map((x) => [x.id, x.titulo, sp(x.detalhe)])
    expect(m).toEqual([
      ['selo', 'Selo «Visitada pela equipa» atribuído', 'Licença n.º 99/2026 e instalações confirmadas.'],
      ['vagas', 'Vagas atualizadas', 'Individual: 2 → 3 livres'],
      ['precos', 'Preços atualizados', 'Individual: 1500–1800 € → 1550–1850 €'],
      ['cuidados', 'Cuidados atualizados', 'Junta Fisioterapia. Retira Oxigenoterapia.'],
      ['resultado', 'Aderiu · Mensalidade', '29 € + IVA por mês · compromisso de 12 meses.'],
    ])
  })

  it('selo renovado, licença sozinha, confirmações sem alterações e ecrã recarregado (sem o "antes")', () => {
    const comSelo = lar({ verificacao: { estado: 'verificado', data: '2026-03-01T10:00:00.000Z', licenca: '12/2019' } })
    const tudo = { licencaConfirmada: true, instalacoesVistas: true, vagasConfirmadas: true, precosConfirmados: true }
    expect(resumirMudancas(comSelo, comSelo, visita({ verificacao: tudo }))[0]!.titulo).toBe('Selo «Visitada pela equipa» renovado')
    expect(resumirMudancas(comSelo, comSelo, visita({ verificacao: tudo })).map((x) => x.titulo)).toEqual([
      'Selo «Visitada pela equipa» renovado',
      'Vagas confirmadas',
      'Preços confirmados',
      'Interessado',
    ])
    const soLicenca = resumirMudancas(lar(), lar(), visita({ verificacao: { ...nada, licencaConfirmada: true } }))
    expect(soLicenca[0]).toEqual({ id: 'licenca', titulo: 'Licença confirmada', detalhe: 'N.º 12/2019. Para o selo «Visitada pela equipa» falta ver as instalações.' })
    const semAntes = resumirMudancas(undefined, comSelo, visita({ verificacao: tudo, resultado: 'recusou' }))
    expect(semAntes.map((x) => [x.titulo, x.detalhe])).toEqual([
      ['Selo «Visitada pela equipa» atribuído', 'Licença n.º 12/2019 e instalações confirmadas.'],
      ['Vagas confirmadas', undefined],
      ['Preços confirmados', undefined],
      ['Recusou', 'Fica na lista «Recusaram».'],
    ])
  })

  it('a linha do resultado', () => {
    expect(sp(mudancaResultado({ resultado: 'aderiu', plano: 'por_entrada' }, { natureza: 'privado' }).detalhe)).toBe('150 € + IVA por entrada · só paga quando alguém entra.')
    expect(mudancaResultado({ resultado: 'aderiu' }, { natureza: 'misericordia' })).toEqual({ id: 'resultado', titulo: 'Aderiu', detalhe: 'Sem custos — setor social.' })
    expect(mudancaResultado({ resultado: 'voltar', proximoContacto: '2026-10-20' }, { natureza: 'privado' }).detalhe).toBe('Próximo contacto: terça-feira, 20 de outubro.')
  })
})

describe('rascunho', () => {
  const base = formInicial(lar(), [], AGORA)

  it('recupera o que é válido e ignora o resto', () => {
    const guardado = {
      ...base,
      verificacao: { ...base.verificacao, licencaConfirmada: true, instalacoesVistas: 'sim' },
      quartos: [
        { tipo: 'duplo', livres: 4, precoMin: '1250', precoMax: 'abc' },
        { tipo: 'casal', livres: 1, precoMin: '900', precoMax: '950' }, // a ficha já não tem este tipo
      ],
      cuidados: ['fisioterapia', 'voar'],
      resultado: 'aderiu',
      plano: 'gratis',
      proximoContacto: 'amanhã',
      notas: 'A diretora volta segunda.',
    }
    const f = juntarRascunho(base, guardado)!
    expect(f.verificacao).toEqual({ licencaConfirmada: true, instalacoesVistas: false, vagasConfirmadas: false, precosConfirmados: false })
    expect(f.quartos).toEqual([
      { tipo: 'individual', livres: 2, precoMin: '1500', precoMax: '1800' },
      { tipo: 'duplo', livres: 4, precoMin: '1250', precoMax: '1400' },
    ])
    expect(f.cuidados).toEqual(['fisioterapia'])
    expect(f.resultado).toBe('aderiu')
    expect(f.plano).toBe(base.plano)
    expect(f.proximoContacto).toBe(base.proximoContacto)
    expect(f.notas).toBe('A diretora volta segunda.')
    expect(juntarRascunho(base, null)).toBeNull()
    expect(juntarRascunho(base, 'texto')).toBeNull()
    expect(mesmoFormulario(juntarRascunho(base, base)!, base)).toBe(true)
  })
})

describe('com o store: da visita à conta do responsável', () => {
  beforeEach(() => {
    logout()
    resetDemo()
  })

  it('um privado por visitar adere com mensalidade e conta; o resumo diz o que mudou', () => {
    login(DEMO_EQUIPA_EMAIL, DEMO_PASSWORD)
    const db = getDB()
    const alvo = db.lares.find((l) => l.distrito === 'Porto' && l.natureza === 'privado' && !l.ownerId && !db.visitas.some((v) => v.larId === l.id))!
    const agora = new Date()
    const q = alvo.quartos[0]!
    const f: FormVisita = {
      ...formInicial(alvo, [], agora),
      verificacao: { licencaConfirmada: true, instalacoesVistas: true, vagasConfirmadas: true, precosConfirmados: true },
      quartos: formInicial(alvo, [], agora).quartos.map((x) => (x.tipo === q.tipo ? { ...x, livres: Math.min(q.total, q.livres + 1), precoMax: String(q.precoMax + 50) } : x)),
      responsavel: { nome: 'Joana Pires', cargo: 'Diretora técnica', telefone: '912 345 678', email: 'joana.pires@exemplo.pt' },
      resultado: 'aderiu',
      plano: 'mensal',
      criarConta: true,
    }
    expect(validarVisita(f, alvo, agora)).toEqual({})
    const r = registarVisita(registoDe(f, alvo))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.selo).toBe(true)
    expect(r.conta?.email).toBe('joana.pires@exemplo.pt')
    const depois = getDB().lares.find((l) => l.id === alvo.id)!
    const titulos = resumirMudancas(alvo, depois, r.visita).map((x) => x.titulo)
    expect(titulos[0]).toMatch(/^Selo «Visitada pela equipa»/)
    expect(titulos).toContain('Preços atualizados')
    expect(titulos.at(-1)).toBe('Aderiu · Mensalidade')
  })
})
