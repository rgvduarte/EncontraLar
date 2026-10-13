/**
 * Modelo de negócio (docs/MODELO-NEGOCIO.md) na base de dados — 20261012190700/0800:
 * privacidade em duas fases, entradas e taxa, profissionais e casos, avaliações verificadas,
 * procura anónima e link de confirmação das vagas. Cada teste prova uma regra pelo lado de quem
 * a tentaria contornar (Data API: anon / authenticated).
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { admin, aplicarMigracoes, cenarioBase, codigoErro, criarBase, criarUtilizador, erro, json, q } from './helpers'

let db: PGlite
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)

interface Cand {
  id: string
  estado: string
  user_id: string | null
  contacto: Record<string, unknown>
  perfil_snapshot: Record<string, unknown>
  mensagem: string | null
  desbloqueada_em: string | null
  entrada_taxa: string | null
  entrada_data: string | null
  entrada_confirmada_lar_em: string | null
  entrada_confirmada_familia_em: string | null
}

const MENSAGEM = 'A minha mãe tem Alzheimer avançado e é VIH+. Liguem para o 912 000 000.'
const candidatar = async (familia: string, instituicao: string, perfil: string, mensagem: string | null = MENSAGEM) =>
  (await q<Cand>(db, familia, 'select * from public.candidatar($1, $2, true, $3)', [instituicao, perfil, mensagem]))[0]!
const mudarEstado = async (lar: string, id: string, estado: string) =>
  (await q<Cand>(db, lar, 'select * from public.atualizar_estado_candidatura($1, $2)', [id, estado]))[0]!
const aceitar = async (lar: string, id: string) => (await q<Cand>(db, lar, 'select * from public.aceitar_candidatura($1)', [id]))[0]!
const hoje = async () => (await adm<{ d: string }>("select (now() at time zone 'Europe/Lisbon')::date::text d"))[0]!.d

/** Pedido com a vaga aceite pela família (aceitar → em análise → vaga proposta → família aceita). */
async function pedidoAceite(b: Awaited<ReturnType<typeof cenarioBase>>) {
  const c = await candidatar(b.familia, b.instituicao, b.perfil)
  await aceitar(b.lar, c.id)
  await mudarEstado(b.lar, c.id, 'vaga_proposta')
  await q(db, b.familia, 'select public.responder_vaga($1, true)', [c.id])
  return c
}

const PERFIL_CASO = {
  nome: 'Albano Teixeira', idade: 83, relacao: 'Utente', genero: 'M', grau: 'grave', necessidades: ['acamados', 'enfermagem24h'],
  preferencias: [], quarto: 'indiferente', local_label: 'Porto — Paranhos', local_lat: 41.1705, local_lng: -8.6045, raio_km: 20,
  orcamento_max: 1800, urgencia: 'imediata', precisa_acordo_ss: false, notas: 'Internado após fratura do colo do fémur.',
}
const ORGANIZACAO = { nome: 'Hospital de Teste', tipo: 'hospital', servico: 'Serviço Social' }

async function profissional(email: string) {
  return criarUtilizador(db, { email, nome: 'Marta Correia', telefone: '225 000 310', roleAdmin: 'profissional', appExtra: { organizacao: ORGANIZACAO } })
}
async function novoCaso(pro: string, alta = 'current_date + 4') {
  const [k] = await q<{ id: string; perfil_id: string }>(db, pro, `select * from public.criar_caso($1::jsonb, 'SS-1', ${alta}, true)`, [JSON.stringify(PERFIL_CASO)])
  return k!
}

beforeAll(async () => {
  db = await criarBase()
}, 120_000)

describe('privacidade em duas fases (RGPD art. 9.º)', () => {
  it('antes de aceitar, o lar não lê contacto, nome, notas, mensagem nem histórico — por select direto, histórico ou RPC', async () => {
    const b = await cenarioBase(db, { sufixo: 'd1' })
    const c = await candidatar(b.familia, b.instituicao, b.perfil)

    // seleção direta (com ou sem filtro, coluna a coluna): nenhuma linha
    expect(await q(db, b.lar, 'select * from public.candidaturas')).toEqual([])
    expect(await q(db, b.lar, 'select contacto, perfil_snapshot, mensagem from public.candidaturas where id = $1', [c.id])).toEqual([])
    expect(await q(db, b.lar, 'select estado, nota from public.candidatura_eventos where candidatura_id = $1', [c.id])).toEqual([])
    // a cópia do perfil também não chega por embutir (PostgREST) nem por agregação
    expect(await q(db, b.lar, 'select count(*)::int n from public.candidaturas where instituicao_id = $1', [b.instituicao])).toEqual([{ n: 0 }])

    // RPC do painel: só o resumo sem identificação
    const [p] = await q<Record<string, unknown>>(db, b.lar, 'select * from public.pedidos_recebidos()')
    expect(p).toMatchObject({
      id: c.id, estado: 'enviada', origem: 'familia', faixa_etaria: '80–84', grau: 'grave', necessidades: ['demencia', 'diabetes', 'paliativos'],
      zona: 'Porto', urgencia: '1-3meses', quarto: 'individual', precisa_acordo_ss: true, desbloqueada_em: null,
      user_id: null, perfil_id: null, contacto: null, perfil_snapshot: null, mensagem: null, historico: null,
    })
    expect(Number(p!.orcamento_max)).toBe(2000)
    const tudo = JSON.stringify(await q(db, b.lar, 'select * from public.pedidos_recebidos()'))
    for (const segredo of ['Maria', 'Famíliad1', 'fam' + 'd1@teste.pt', 'Alzheimer', 'VIH', '912 000 000', b.familia]) expect(tudo).not.toContain(segredo)

    // o aviso ao lar não identifica ninguém
    const avisos = await q<{ titulo: string; texto: string; link: string }>(db, b.lar, 'select titulo, texto, link from public.notificacoes where candidatura_id = $1', [c.id])
    expect(avisos).toEqual([{
      titulo: 'Novo pedido de vaga',
      texto: 'Pedido de vaga de uma família (pessoa de 80–84 anos). Abra o pedido para o aceitar e ver o contacto.',
      link: `/gestao/pedidos?pedido=${c.id}`,
    }])

    // a família lê sempre o seu pedido completo
    const [f] = await q<Cand>(db, b.familia, 'select * from public.candidaturas where id = $1', [c.id])
    expect(f).toMatchObject({ mensagem: MENSAGEM, contacto: { nome: 'Famíliad1' } })
    expect(f!.perfil_snapshot.nome).toBe('Maria')
  })

  it('aceitar_candidatura desbloqueia (em análise, desbloqueada_em) e avisa a família; só então o lar lê tudo', async () => {
    const b = await cenarioBase(db, { sufixo: 'd2' })
    const c = await candidatar(b.familia, b.instituicao, b.perfil)
    const outro = await cenarioBase(db, { sufixo: 'd2b' })
    // outra instituição não aceita nem lê
    expect(await codigoErro(db, outro.lar, 'select public.aceitar_candidatura($1)', [c.id])).toBe('42501')
    expect(await codigoErro(db, b.familia, 'select public.aceitar_candidatura($1)', [c.id])).toBe('42501')
    expect(await codigoErro(db, 'anon', 'select public.aceitar_candidatura($1)', [c.id])).toBe('42501')

    const a = await aceitar(b.lar, c.id)
    expect(a.estado).toBe('em_analise')
    expect(a.desbloqueada_em).not.toBeNull()
    expect(a.contacto).toMatchObject({ nome: 'Famíliad2', email: 'famd2@teste.pt' })
    const [r] = await q<Cand>(db, b.lar, 'select * from public.candidaturas where id = $1', [c.id])
    expect(r).toMatchObject({ mensagem: MENSAGEM, estado: 'em_analise' })
    expect(r!.perfil_snapshot).toMatchObject({ nome: 'Maria', notas: 'Alzheimer avançado; VIH+; historial psiquiátrico' })
    expect(await q(db, b.lar, 'select estado from public.candidatura_eventos where candidatura_id = $1 order by id', [c.id])).toEqual([{ estado: 'enviada' }, { estado: 'em_analise' }])
    const [p] = await q<{ contacto: unknown; historico: unknown[] }>(db, b.lar, 'select contacto, historico from public.pedidos_recebidos() where id = $1', [c.id])
    expect(p!.contacto).toMatchObject({ nome: 'Famíliad2' })
    expect(p!.historico).toHaveLength(2)
    expect(await q(db, b.familia, "select titulo from public.notificacoes where candidatura_id = $1 and titulo = 'Em análise'", [c.id])).toHaveLength(1)
    // idempotente; outra instituição continua sem ver
    expect((await aceitar(b.lar, c.id)).estado).toBe('em_analise')
    expect(await q(db, outro.lar, 'select id from public.candidaturas')).toEqual([])
  })

  it('fazer o pedido avançar (lista de espera) também desbloqueia; recusar ou cancelar sem aceitar NÃO', async () => {
    const b = await cenarioBase(db, { sufixo: 'd3' })
    const p2 = (await q<{ id: string }>(db, b.familia, `insert into public.perfis_cuidados (nome, idade, grau, local_lat, local_lng, notas)
      values ('Rosa Secreta', 91, 'moderada', 41.1, -8.6, 'Esquizofrenia') returning id`))[0]!.id
    const p3 = (await q<{ id: string }>(db, b.familia, `insert into public.perfis_cuidados (nome, idade, grau, local_lat, local_lng)
      values ('Joaquim Secreto', 70, 'ligeira', 41.1, -8.6) returning id`))[0]!.id
    const lista = await candidatar(b.familia, b.instituicao, b.perfil)
    const recusada = await candidatar(b.familia, b.instituicao, p2)
    const cancelada = await candidatar(b.familia, b.instituicao, p3)

    expect((await mudarEstado(b.lar, lista.id, 'lista_espera')).desbloqueada_em).not.toBeNull()
    expect(await q(db, b.lar, 'select id from public.candidaturas where id = $1', [lista.id])).toHaveLength(1)

    // recusar sem aceitar: o valor devolvido não identifica a pessoa, e a linha continua fechada
    const r = await mudarEstado(b.lar, recusada.id, 'recusada')
    expect(r).toMatchObject({ estado: 'recusada', desbloqueada_em: null, user_id: null, contacto: {}, mensagem: null })
    expect(r.perfil_snapshot).toEqual(expect.objectContaining({ faixa_etaria: '90–94', grau: 'moderada' }))
    expect(JSON.stringify(r)).not.toMatch(/Rosa|Esquizofrenia|Famíliad3/)
    expect(await q(db, b.lar, 'select id from public.candidaturas where id = $1', [recusada.id])).toEqual([])
    expect(await erro(db, b.lar, 'select public.aceitar_candidatura($1)', [recusada.id])).toMatch(/já não pode ser aceite/)

    // a família cancela antes de o lar aceitar: o aviso não tem nomes e o pedido nunca se desbloqueia
    await q(db, b.familia, 'select public.cancelar_candidatura($1)', [cancelada.id])
    const [aviso] = await adm<{ texto: string }>("select texto from public.notificacoes where candidatura_id = $1 and titulo = 'Pedido cancelado'", [cancelada.id])
    expect(aviso!.texto).toBe('O pedido de uma família (pessoa de 70–74 anos) foi cancelado.')
    expect(await erro(db, b.lar, 'select public.aceitar_candidatura($1)', [cancelada.id])).toMatch(/já não pode ser aceite/)
    expect(await q(db, b.lar, 'select id from public.candidaturas where id = $1', [cancelada.id])).toEqual([])
  })

  it('pedidos de visita e confirmação de visita de um pedido por aceitar não revelam quem é', async () => {
    const b = await cenarioBase(db, { sufixo: 'd4' })
    const c = await candidatar(b.familia, b.instituicao, b.perfil)
    await q(db, b.familia, "select public.pedir_visita($1, current_date + 3, '15:00')", [c.id])
    const [aviso] = await adm<{ texto: string }>("select texto from public.notificacoes where candidatura_id = $1 and tipo = 'visita'", [c.id])
    expect(aviso!.texto).toMatch(/^Uma família \(pessoa de 80–84 anos\) pediu uma visita para .+, às 15:00\.$/)
    const [v] = await q<Cand>(db, b.lar, 'select * from public.confirmar_visita($1)', [c.id])
    expect(v).toMatchObject({ user_id: null, contacto: {}, mensagem: null })
    expect(JSON.stringify(v)).not.toMatch(/Maria|Famíliad4|Alzheimer/)
  })

  it('a regra está na base de dados: não há pedido "à frente" sem aceitação (restrição)', async () => {
    const b = await cenarioBase(db, { sufixo: 'd5' })
    const c = await candidatar(b.familia, b.instituicao, b.perfil)
    expect(await erro(db, 'service_role', "update public.candidaturas set estado = 'em_analise' where id = $1", [c.id])).toMatch(/candidaturas_desbloqueio/)
  })
})

describe('entrada na instituição e taxa', () => {
  for (const [natureza, taxa] of [['privado', 'aplicavel'], ['ipss', 'isenta'], ['misericordia', 'isenta']] as const) {
    it(`${natureza}: a entrada marcada pelo lar fica com a taxa "${taxa}" e avisa a família`, async () => {
      const b = await cenarioBase(db, { sufixo: `t${natureza.slice(0, 2)}`, natureza })
      const c = await pedidoAceite(b)
      const dia = await hoje()
      const [e] = await json<Cand>(db, b.lar, 'select * from public.marcar_entrada($1, $2::date)', [c.id, dia])
      expect(e).toMatchObject({ estado: 'admitida', entrada_taxa: taxa, entrada_data: dia, entrada_confirmada_familia_em: null })
      expect(e!.entrada_confirmada_lar_em).not.toBeNull()
      expect(await q(db, b.familia, "select 1 from public.notificacoes where candidatura_id = $1 and titulo = 'Entrada registada'", [c.id])).toHaveLength(1)
      const [p] = await q<{ entrada_taxa: string }>(db, b.lar, 'select entrada_taxa from public.pedidos_recebidos() where id = $1', [c.id])
      expect(p!.entrada_taxa).toBe(taxa)
    })
  }

  it('só a partir de "aceite"; só o dono; datas válidas; a família pode confirmar primeiro (a data dela fica)', async () => {
    const b = await cenarioBase(db, { sufixo: 'e1' })
    const outro = await cenarioBase(db, { sufixo: 'e1b' })
    const dia = await hoje()
    const emAnalise = await candidatar(b.familia, b.instituicao, b.perfil)
    await aceitar(b.lar, emAnalise.id)
    expect(await erro(db, b.lar, 'select public.marcar_entrada($1, $2::date)', [emAnalise.id, dia])).toMatch(/depois de a vaga ser aceite/)
    await q(db, b.familia, 'select public.cancelar_candidatura($1)', [emAnalise.id])

    const c = await pedidoAceite(b)
    expect(await codigoErro(db, outro.lar, 'select public.marcar_entrada($1, $2::date)', [c.id, dia])).toBe('42501')
    expect(await erro(db, b.lar, "select public.marcar_entrada($1, current_date + 10)", [c.id])).toMatch(/não pode ser futura/)
    expect(await erro(db, b.lar, "select public.marcar_entrada($1, current_date - 400)", [c.id])).toMatch(/anterior ao pedido/)
    // só o autor do pedido confirma do lado da família
    expect(await erro(db, outro.familia, 'select public.confirmar_entrada_familia($1, $2::date)', [c.id, dia])).toMatch(/não encontrado/)
    expect(await erro(db, b.lar, 'select public.confirmar_entrada_familia($1, $2::date)', [c.id, dia])).toMatch(/não encontrado/)

    const [f] = await json<Cand>(db, b.familia, 'select * from public.confirmar_entrada_familia($1, $2::date)', [c.id, dia])
    expect(f).toMatchObject({ estado: 'admitida', entrada_taxa: 'aplicavel', entrada_data: dia, entrada_confirmada_lar_em: null })
    expect(await q(db, b.lar, "select 1 from public.notificacoes where candidatura_id = $1 and titulo = 'Entrada confirmada pela família'", [c.id])).toHaveLength(1)
    const [l] = await json<Cand>(db, b.lar, "select * from public.marcar_entrada($1, current_date - 1)", [c.id])
    expect(l!.entrada_data).toBe(dia)
    expect(l!.entrada_confirmada_lar_em && l!.entrada_confirmada_familia_em).toBeTruthy()
    // a família já confirmou: sem aviso "Entrada registada" repetido; e a entrada não se cancela
    expect(await q(db, b.familia, "select 1 from public.notificacoes where candidatura_id = $1 and titulo = 'Entrada registada'", [c.id])).toEqual([])
    expect(await erro(db, b.familia, 'select public.cancelar_candidatura($1)', [c.id])).toMatch(/concluído/)
  })
})

describe('profissionais e casos', () => {
  it('a organização vem do registo (validada) ou do administrador, e o utilizador não a muda', async () => {
    const pro = await criarUtilizador(db, {
      email: 'registo-pro@x.pt', roleRegisto: 'profissional',
      metadados: { organizacao: { nome: '  Centro de Saúde X ', tipo: 'centro_saude', servico: '' } },
    })
    const [r] = await q<{ role: string; organizacao: unknown }>(db, pro, 'select role, organizacao from public.perfis_utilizador')
    expect(r).toEqual({ role: 'profissional', organizacao: { nome: 'Centro de Saúde X', tipo: 'centro_saude' } })
    expect(await erro(db, pro, `update public.perfis_utilizador set organizacao = '{"nome":"Hospital de Santa Maria","tipo":"hospital"}' where id = $1`, [pro])).toMatch(/permission denied/)
    // o nome e o telefone continuam editáveis (a restrição da organização só usa funções do sistema)
    expect(await q(db, pro, "update public.perfis_utilizador set nome = 'Marta C.' where id = $1 returning nome", [pro])).toEqual([{ nome: 'Marta C.' }])
    // organização inválida no registo → nenhuma (fica "Serviço social" nos pedidos)
    const mal = await criarUtilizador(db, { email: 'registo-pro2@x.pt', roleRegisto: 'profissional', metadados: { organizacao: { nome: 'X'.repeat(500), tipo: 'hospital' } } })
    expect((await adm<{ o: unknown }>('select organizacao o from public.perfis_utilizador where id = $1', [mal]))[0]!.o).toBeNull()
    // contas anónimas nunca são profissionais
    const anonima = await criarUtilizador(db, { email: null, anonimo: true, roleRegisto: 'profissional' })
    expect((await adm<{ role: string }>('select role from public.perfis_utilizador where id = $1', [anonima]))[0]!.role).toBe('familia')
  })

  it('criar_caso: só profissionais, com consentimento; o caso e o perfil só são lidos pelo próprio', async () => {
    const pro = await profissional('pro-c1@x.pt')
    const outroPro = await profissional('pro-c1b@x.pt')
    const b = await cenarioBase(db, { sufixo: 'k1' })
    expect(await codigoErro(db, b.familia, 'select public.criar_caso($1::jsonb, null, null, true)', [JSON.stringify(PERFIL_CASO)])).toBe('42501')
    expect(await erro(db, pro, 'select public.criar_caso($1::jsonb, null, null, false)', [JSON.stringify(PERFIL_CASO)])).toMatch(/consentimento/)
    expect(await erro(db, pro, `select public.criar_caso('{"nome":"Sem idade"}'::jsonb, null, null, true)`)).toMatch(/Perfil incompleto/)
    const k = await novoCaso(pro)
    expect(await q(db, pro, 'select id, referencia, estado from public.casos')).toEqual([{ id: k.id, referencia: 'SS-1', estado: 'aberto' }])
    expect(await q(db, pro, 'select nome from public.perfis_cuidados where id = $1', [k.perfil_id])).toEqual([{ nome: 'Albano Teixeira' }])
    for (const quem of [outroPro, b.lar, b.familia]) {
      expect(await q(db, quem, 'select id from public.casos')).toEqual([])
      expect(await q(db, quem, 'select id from public.perfis_cuidados where id = $1', [k.perfil_id])).toEqual([])
    }
    expect(await erro(db, 'anon', 'select id from public.casos')).toMatch(/permission denied/)
    // clientes não escrevem casos diretamente
    expect(await erro(db, pro, "update public.casos set estado = 'fechado' where id = $1", [k.id])).toMatch(/permission denied/)
  })

  it('atualizar_caso: só as chaves indicadas, só o próprio profissional; os pedidos enviados mantêm a cópia', async () => {
    const pro = await profissional('pro-c2@x.pt')
    const outroPro = await profissional('pro-c2b@x.pt')
    const k = await novoCaso(pro)
    expect(await erro(db, outroPro, `select public.atualizar_caso($1, '{"estado":"fechado"}')`, [k.id])).toMatch(/Caso não encontrado/)
    const [r] = await q<{ referencia: string | null; estado: string; alta_prevista: string | null }>(db, pro,
      `select referencia, estado, alta_prevista from public.atualizar_caso($1, '{"estado":"colocado","perfil":{"orcamento_max":2000}}')`, [k.id])
    expect(r).toMatchObject({ referencia: 'SS-1', estado: 'colocado' })
    expect(r!.alta_prevista).not.toBeNull()
    expect(await q(db, pro, 'select orcamento_max::int o, nome from public.perfis_cuidados where id = $1', [k.perfil_id])).toEqual([{ o: 2000, nome: 'Albano Teixeira' }])
    await q(db, pro, `select public.atualizar_caso($1, '{"referencia":null}')`, [k.id])
    expect((await q<{ referencia: string | null }>(db, pro, 'select referencia from public.casos where id = $1', [k.id]))[0]!.referencia).toBeNull()
  })

  it('enviar_caso: um pedido por instituição elegível, sem duplicados, avisos anónimos; só o profissional e (depois de aceitar) o lar leem', async () => {
    const pro = await profissional('pro-c3@x.pt')
    const outroPro = await profissional('pro-c3b@x.pt')
    const a = await cenarioBase(db, { sufixo: 'k3a' })
    const b = await cenarioBase(db, { sufixo: 'k3b' })
    const pendente = await cenarioBase(db, { sufixo: 'k3c' })
    await adm("update public.instituicoes set verificacao_estado = 'pendente' where id = $1", [pendente.instituicao])
    const k = await novoCaso(pro)

    const enviados = await q<Cand & { instituicao_id: string; origem: string; organizacao: string; caso_id: string; alta_prevista: string }>(db, pro,
      'select * from public.enviar_caso($1, $2, $3)', [k.id, [a.instituicao, b.instituicao, a.instituicao, pendente.instituicao, 'lar-inexistente'], 'Relatório clínico depois de aceitarem.'])
    expect(enviados.map((c) => c.instituicao_id)).toEqual([a.instituicao, b.instituicao])
    expect(enviados[0]).toMatchObject({
      estado: 'enviada', origem: 'profissional', organizacao: 'Hospital de Teste · Serviço Social', caso_id: k.id,
      contacto: { nome: 'Marta Correia (Hospital de Teste · Serviço Social)', email: 'pro-c3@x.pt', telefone: '225 000 310' },
    })
    expect(enviados[0]!.alta_prevista).not.toBeNull()
    // segunda vez: nada de novo (já há pedidos ativos deste caso nessas instituições)
    expect(await q(db, pro, 'select * from public.enviar_caso($1, $2)', [k.id, [a.instituicao, b.instituicao]])).toEqual([])

    // aviso ao gestor: organização, faixa etária e alta — sem o nome da pessoa nem do profissional
    const [aviso] = await adm<{ titulo: string; texto: string }>('select titulo, texto from public.notificacoes where user_id = $1 and candidatura_id = $2', [a.lar, enviados[0]!.id])
    expect(aviso!.titulo).toBe('Novo encaminhamento')
    expect(aviso!.texto).toMatch(/^Encaminhamento do Hospital de Teste · Serviço Social \(pessoa de 80–84 anos\), com alta prevista para .+\. Abra o pedido para o aceitar e ver o contacto\.$/)
    expect(aviso!.texto).not.toMatch(/Albano|Marta|fémur/)

    // quem lê: o profissional (completo); outro profissional e outra instituição, nada
    expect(await q(db, pro, 'select id from public.candidaturas where caso_id = $1', [k.id])).toHaveLength(2)
    expect(await q(db, outroPro, 'select id from public.candidaturas')).toEqual([])
    expect(await q(db, pendente.lar, 'select id from public.candidaturas')).toEqual([])
    // a instituição de destino: só o resumo (com a origem, a organização e a alta) até aceitar
    expect(await q(db, a.lar, 'select id from public.candidaturas')).toEqual([])
    const [resumo] = await q<Record<string, unknown>>(db, a.lar, 'select origem, organizacao, alta_prevista, faixa_etaria, contacto, mensagem from public.pedidos_recebidos()')
    expect(resumo).toMatchObject({ origem: 'profissional', organizacao: 'Hospital de Teste · Serviço Social', faixa_etaria: '80–84', contacto: null, mensagem: null })
    await aceitar(a.lar, enviados[0]!.id)
    const [lido] = await q<Cand>(db, a.lar, 'select * from public.candidaturas where id = $1', [enviados[0]!.id])
    expect(lido).toMatchObject({ mensagem: 'Relatório clínico depois de aceitarem.', contacto: { email: 'pro-c3@x.pt' } })
    // o aviso de "em análise" vai para o caso do profissional
    const [link] = await q<{ link: string }>(db, pro, "select link from public.notificacoes where candidatura_id = $1 and titulo = 'Em análise'", [enviados[0]!.id])
    expect(link!.link).toBe(`/casos/${k.id}`)
  })

  it('enviar_caso: famílias não usam, casos fechados não se enviam, no máximo 20 instituições de cada vez', async () => {
    const pro = await profissional('pro-c4@x.pt')
    const b = await cenarioBase(db, { sufixo: 'k4' })
    const k = await novoCaso(pro)
    expect(await codigoErro(db, b.familia, 'select * from public.enviar_caso($1, $2)', [k.id, [b.instituicao]])).toBe('42501')
    expect(await erro(db, pro, 'select * from public.enviar_caso($1, $2)', [k.id, Array.from({ length: 21 }, (_, i) => `lar-${i}`)])).toMatch(/no máximo 20/)
    await q(db, pro, `select public.atualizar_caso($1, '{"estado":"fechado"}')`, [k.id])
    expect(await erro(db, pro, 'select * from public.enviar_caso($1, $2)', [k.id, [b.instituicao]])).toMatch(/caso está fechado/)
    // o profissional também não usa candidatar (os pedidos dele saem dos casos)
    expect(await codigoErro(db, pro, 'select public.candidatar($1, $2, true)', [b.instituicao, k.perfil_id])).toBe('42501')
  })
})

describe('profissional: entrada, avaliação e avisos', () => {
  /** encaminhamento aceite pelo lar e com a vaga aceite pelo profissional */
  async function encaminhamentoAceite(sufixo: string) {
    const pro = await profissional(`pro-${sufixo}@x.pt`)
    const b = await cenarioBase(db, { sufixo, livres: { individual: 2 } })
    const k = await novoCaso(pro)
    const [c] = await q<{ id: string }>(db, pro, 'select id from public.enviar_caso($1, $2)', [k.id, [b.instituicao]])
    await aceitar(b.lar, c!.id)
    return { pro, b, k, c: c!.id }
  }

  it('o profissional confirma a entrada mas não avalia (só famílias)', async () => {
    const { pro, b, c } = await encaminhamentoAceite('p1')
    await mudarEstado(b.lar, c, 'vaga_proposta')
    await q(db, pro, 'select public.responder_vaga($1, true)', [c])
    await q(db, b.lar, 'select public.marcar_entrada($1, current_date)', [c])
    const [e] = await json<Cand>(db, pro, 'select * from public.confirmar_entrada_familia($1, current_date)', [c])
    expect(e!.entrada_confirmada_familia_em).not.toBeNull()
    const ev = await q<{ autor: string }>(db, pro, "select autor from public.candidatura_eventos where candidatura_id = $1 and nota = 'Entrada confirmada pela família.'", [c])
    expect(ev).toEqual([{ autor: 'profissional' }])
    expect(await codigoErro(db, pro, `select public.avaliar_lar($1, 5, 'Excelente acolhimento do utente.', '{"cuidados":5,"alimentacao":5,"instalacoes":5,"comunicacao":5}')`, [c])).toBe('42501')
    expect(await erro(db, pro, `select public.avaliar_lar($1, 5, 'Excelente acolhimento do utente.', '{"cuidados":5,"alimentacao":5,"instalacoes":5,"comunicacao":5}')`, [c])).toMatch(/Só as famílias/)
    expect(await q(db, pro, 'select * from public.minhas_avaliacoes()')).toEqual([])
    expect((await adm<{ n: number }>('select num_avaliacoes n from public.instituicoes where id = $1', [b.instituicao]))[0]!.n).toBe(0)
  })

  it('avisos de vaga e de prazo terminado levam o profissional ao caso; o do lar abre o pedido', async () => {
    const { pro, b, k, c } = await encaminhamentoAceite('p2')
    // na lista de espera: abre uma vaga → aviso com a rota do caso
    await mudarEstado(b.lar, c, 'lista_espera')
    await q(db, b.lar, "select public.definir_vagas($1, 'duplo', 3)", [b.instituicao])
    const [vaga] = await q<{ link: string }>(db, pro, "select link from public.notificacoes where candidatura_id = $1 and tipo = 'vaga'", [c])
    expect(vaga!.link).toBe(`/casos/${k.id}`)
    // vaga proposta sem resposta no prazo (pg_cron)
    await mudarEstado(b.lar, c, 'vaga_proposta')
    await adm("update public.candidaturas set prazo_resposta = now() - interval '1 minute' where id = $1", [c])
    await adm('select private.expirar_propostas()')
    const [prazo] = await q<{ link: string }>(db, pro, "select link from public.notificacoes where candidatura_id = $1 and titulo = 'Prazo da vaga terminado'", [c])
    expect(prazo!.link).toBe(`/casos/${k.id}`)
    const [lar] = await q<{ link: string }>(db, b.lar, "select link from public.notificacoes where candidatura_id = $1 and titulo = 'Proposta sem resposta'", [c])
    expect(lar!.link).toBe(`/gestao/pedidos?pedido=${c}`)
    // e para uma família continua a ser o painel da família
    const f = await cenarioBase(db, { sufixo: 'p2f', livres: { individual: 0 } })
    const cf = await candidatar(f.familia, f.instituicao, f.perfil)
    await mudarEstado(f.lar, cf.id, 'lista_espera')
    await q(db, f.lar, "select public.definir_vagas($1, 'individual', 1)", [f.instituicao])
    expect(await q(db, f.familia, "select link from public.notificacoes where candidatura_id = $1 and tipo = 'vaga'", [cf.id])).toEqual([{ link: '/familia' }])
  })
})

describe('avaliações verificadas', () => {
  const avaliar = (quem: string, candidatura: string, nota = 5, texto = 'Equipa atenta e muito carinhosa com o meu pai.') =>
    q<{ id: number; verificada: boolean; autor: string; relacao: string }>(db, quem,
      `select id, verificada, autor, relacao from public.avaliar_lar($1, $2, $3, '{"cuidados":5,"alimentacao":4,"instalacoes":4,"comunicacao":5}')`, [candidatura, nota, texto])

  it('sem entrada confirmada pela família não há avaliação; com ela, uma (verificada) por pedido, e os agregados acompanham', async () => {
    const b = await cenarioBase(db, { sufixo: 'a1' })
    await adm("update public.perfis_utilizador set nome = 'Teresa Maria Matos' where id = $1", [b.familia])
    const c = await pedidoAceite(b)
    expect(await erro(db, b.familia, 'select public.avaliar_lar($1, 5, $2, $3)', [c.id, 'Texto suficientemente longo', '{}'])).toMatch(/depois de confirmar a entrada/)
    // o lar marcou a entrada mas a família ainda não confirmou: continua sem poder avaliar
    await q(db, b.lar, 'select public.marcar_entrada($1, current_date)', [c.id])
    expect(await erro(db, b.familia, 'select public.avaliar_lar($1, 5, $2, $3)', [c.id, 'Texto suficientemente longo', '{}'])).toMatch(/depois de confirmar a entrada/)
    await q(db, b.familia, 'select public.confirmar_entrada_familia($1, current_date)', [c.id])

    expect(await erro(db, b.familia, `select public.avaliar_lar($1, 6, 'Texto suficientemente longo', '{"cuidados":5,"alimentacao":4,"instalacoes":4,"comunicacao":5}')`, [c.id])).toMatch(/vão de 1 a 5/)
    expect(await erro(db, b.familia, `select public.avaliar_lar($1, 4, 'Curto', '{"cuidados":5,"alimentacao":4,"instalacoes":4,"comunicacao":5}')`, [c.id])).toMatch(/pelo menos 10/)
    // outra família não usa o pedido de outra pessoa
    const outra = await cenarioBase(db, { sufixo: 'a1b' })
    expect(await erro(db, outra.familia, `select public.avaliar_lar($1, 1, 'Avaliação de quem não entrou', '{"cuidados":1,"alimentacao":1,"instalacoes":1,"comunicacao":1}')`, [c.id])).toMatch(/não encontrado/)

    const [av] = await avaliar(b.familia, c.id)
    expect(av).toMatchObject({ verificada: true, autor: 'Teresa M.', relacao: 'Familiar de residente' })
    expect(await erro(db, b.familia, 'select public.avaliar_lar($1, 1, $2, $3)', [c.id, 'Mudei de ideias, quero outra.', '{"cuidados":1,"alimentacao":1,"instalacoes":1,"comunicacao":1}'])).toMatch(/Já avaliou/)
    expect((await adm<{ n: number; m: string }>('select num_avaliacoes n, avaliacao_media::text m from public.instituicoes where id = $1', [b.instituicao]))[0]).toEqual({ n: 1, m: '5.00' })
    // a família sabe que já avaliou (minhas_avaliacoes); ninguém lê candidatura_id/user_id na tabela
    expect(await q(db, b.familia, 'select candidatura_id, verificada from public.minhas_avaliacoes()')).toEqual([{ candidatura_id: c.id, verificada: true }])
    expect(await erro(db, b.familia, 'select candidatura_id from public.avaliacoes')).toMatch(/permission denied/)
    // a versão grátis (anon) não lê a tabela: só o excerto de avaliacoes_instituicao (acesso.test.ts)
    expect(await erro(db, 'anon', 'select autor from public.avaliacoes')).toMatch(/permission denied/)
    expect(await q(db, 'anon', 'select autor, verificada, excerto from public.avaliacoes_instituicao($1)', [b.instituicao])).toEqual([{ autor: 'Teresa M.', verificada: true, excerto: true }])
    expect(await q(db, b.familia, 'select autor, verificada from public.avaliacoes where instituicao_id = $1', [b.instituicao])).toEqual([{ autor: 'Teresa M.', verificada: true }])
    // o autor pode apagar a sua (os agregados voltam atrás)
    expect(await q(db, b.familia, 'delete from public.avaliacoes where id = $1 returning id', [av!.id])).toHaveLength(1)
    expect((await adm<{ n: number }>('select num_avaliacoes n from public.instituicoes where id = $1', [b.instituicao]))[0]!.n).toBe(0)
  })

  it('não se escrevem avaliações diretamente na tabela (nem "verificadas")', async () => {
    const b = await cenarioBase(db, { sufixo: 'a2' })
    expect(await erro(db, b.familia, `insert into public.avaliacoes (instituicao_id, autor, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes, aspeto_comunicacao, texto)
      values ($1, 'Família', 5, 5, 5, 5, 5, 'Avaliação sem ter entrado na instituição')`, [b.instituicao])).toMatch(/permission denied/)
  })
})

describe('procura sem resposta (anónima)', () => {
  const registar = (quem: string, distrito: string | null, extra: { lugar?: string | null; grau?: string | null; cuidados?: string[]; orcamento?: number | null } = {}) =>
    q<{ ok: boolean }>(db, quem, 'select public.registar_procura($1, $2, $3::public.grau_dependencia, $4, $5, 3, 0) as ok',
      [distrito, extra.lugar ?? null, extra.grau ?? null, extra.cuidados ?? [], extra.orcamento ?? null]).then((r) => r[0]!.ok)

  it('anon regista (validado, sem repetir a mesma pesquisa) mas ninguém lê as linhas', async () => {
    expect(await registar('anon', 'Braga', { lugar: 'Braga', grau: 'moderada', cuidados: ['demencia', 'demencia'], orcamento: 1500 })).toBe(true)
    expect(await registar('anon', 'Braga', { lugar: 'Braga', grau: 'moderada', cuidados: ['demencia'], orcamento: 1500 })).toBe(false)
    const b = await cenarioBase(db, { sufixo: 'q1' })
    for (const quem of ['anon', b.familia, b.lar]) {
      expect(await erro(db, quem, 'select * from public.procuras_anonimas')).toMatch(/permission denied/)
      expect(await erro(db, quem, "insert into public.procuras_anonimas (distrito) values ('Braga')")).toMatch(/permission denied/)
    }
    // dados pessoais ou valores fora do domínio são recusados
    for (const extra of [{ lugar: 'Rua das Flores 12, 4000-123' }, { lugar: 'maria@exemplo.pt' }, { cuidados: ['inventado'] }, { orcamento: 10_000_000 }]) {
      expect(await erro(db, 'anon', 'select public.registar_procura($1, $2, null, $3, $4)', ['Braga', extra.lugar ?? null, extra.cuidados ?? [], extra.orcamento ?? null])).toMatch(/Pesquisa inválida/)
    }
    expect(await erro(db, 'anon', "select public.registar_procura('Narnia')")).toMatch(/Pesquisa inválida/)
    expect(await erro(db, 'anon', 'select public.registar_procura($1, null, null, $2)', ['Braga', Array.from({ length: 13 }, () => 'medico')])).toMatch(/Pesquisa inválida/)
    const [r] = await adm<{ cuidados: string[]; lugar: string }>("select cuidados, lugar from public.procuras_anonimas where distrito = 'Braga'")
    expect(r).toEqual({ cuidados: ['demencia'], lugar: 'Braga' })
  })

  it('limite global por minuto: um robô não inunda a tabela', async () => {
    await adm('delete from public.procuras_anonimas')
    const resultados: boolean[] = []
    for (let i = 0; i < 65; i++) resultados.push(await registar('anon', 'Faro', { orcamento: 1000 + i }))
    expect(resultados.filter(Boolean)).toHaveLength(60)
    expect(resultados.slice(60).every((x) => !x)).toBe(true)
    await adm('delete from public.procuras_anonimas')
  })

  it('procura_na_zona: só agregados e só do distrito da instituição de quem pergunta', async () => {
    await adm('delete from public.procuras_anonimas')
    await adm(`insert into public.procuras_anonimas (distrito, lugar, grau, cuidados, orcamento_max, resultados, created_at) values
      ('Porto', 'Porto', 'grave', '{demencia,acamados}', 1200, 2, now() - interval '1 day'),
      ('Porto', 'Porto', 'grave', '{demencia}', 1800, 0, now() - interval '2 days'),
      ('Porto', 'Porto', 'moderada', '{}', null, 1, now() - interval '3 days'),
      ('Porto', 'Porto', 'ligeira', '{diabetes}', 900, 0, now() - interval '3 days'),
      ('Porto', 'Porto', 'grave', '{paliativos}', 3000, 0, now() - interval '60 days'),
      ('Lisboa', 'Lisboa', 'grave', '{oxigenio}', 5000, 0, now() - interval '1 day')`)
    const b = await cenarioBase(db, { sufixo: 'q2' })
    const [z] = await q<Record<string, unknown>>(db, b.lar, 'select * from public.procura_na_zona(30)')
    expect(z).toMatchObject({
      distrito: 'Porto', dias: 30, total: 4,
      cuidados: [{ cuidado: 'demencia', total: 2 }, { cuidado: 'acamados', total: 1 }, { cuidado: 'diabetes', total: 1 }],
      graus: [{ grau: 'grave', total: 2 }, { grau: 'ligeira', total: 1 }, { grau: 'moderada', total: 1 }],
    })
    // mediana como resumirProcuras: ordenados [900, 1200, 1800] → índice floor(3/2) = 1200
    expect(Number(z!.orcamento_mediano)).toBe(1200)
    expect((await q<{ total: number }>(db, b.lar, 'select total from public.procura_na_zona(90)'))[0]!.total).toBe(5)
    expect((await q<{ dias: number }>(db, b.lar, 'select dias from public.procura_na_zona(100000)'))[0]!.dias).toBe(365)
    // Lisboa nunca aparece a um lar do Porto; quem não gere uma ficha não recebe nada; anon não executa
    expect(JSON.stringify(await q(db, b.lar, 'select * from public.procura_na_zona(365)'))).not.toMatch(/oxigenio|Lisboa/)
    expect(await q(db, b.familia, 'select * from public.procura_na_zona()')).toEqual([])
    expect(await erro(db, 'anon', 'select * from public.procura_na_zona()')).toMatch(/permission denied/)
  })
})

describe('link de confirmação das vagas (sem sessão)', () => {
  it('o token certo confirma (sim → frescura; não → vagas a 0); um token errado falha sempre da mesma forma', async () => {
    const b = await cenarioBase(db, { sufixo: 'l1', livres: { individual: 3, duplo: 2 } })
    const outro = await cenarioBase(db, { sufixo: 'l1b', livres: { individual: 4 } })
    const [{ token }] = (await q<{ token: string }>(db, b.lar, 'select public.renovar_token_confirmacao() as token')) as [{ token: string }]
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/)
    await adm("update public.instituicoes set atualizado_em = now() - interval '20 days' where id = $1", [b.instituicao])

    const [v] = await q<{ instituicao_id: string; nome: string; vagas_livres: number }>(db, 'anon', 'select * from public.vagas_por_token($1)', [token])
    expect(v).toMatchObject({ instituicao_id: b.instituicao, nome: 'Real L1', vagas_livres: 5 })
    const [sim] = await q<{ atualizado_em: string; vagas_livres: number }>(db, 'anon', 'select * from public.confirmar_vagas_por_token($1, true)', [token])
    expect(sim!.vagas_livres).toBe(5)
    expect(Date.now() - Date.parse(sim!.atualizado_em)).toBeLessThan(3_600_000)
    const [nao] = await q<{ vagas_livres: number }>(db, 'anon', 'select * from public.confirmar_vagas_por_token($1, false)', [token])
    expect(nao!.vagas_livres).toBe(0)
    expect((await adm<{ n: number }>('select sum(livres)::int n from public.quartos where instituicao_id = $1', [outro.instituicao]))[0]!.n).toBe(4)

    // errado, vazio, enorme ou quase igual: o mesmo erro e nada sobre outras instituições
    const erros = new Set<string>()
    for (const t of ['token-errado', '', 'x'.repeat(5000), token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A'), null]) {
      erros.add(await erro(db, 'anon', 'select * from public.confirmar_vagas_por_token($1, false)', [t]))
      expect(await q(db, 'anon', 'select * from public.vagas_por_token($1)', [t])).toEqual([])
    }
    expect([...erros]).toEqual(['Link de confirmação inválido ou expirado.'])
    expect((await adm<{ n: number }>('select sum(livres)::int n from public.quartos where instituicao_id = $1', [outro.instituicao]))[0]!.n).toBe(4)

    // renovar invalida o anterior; prazo expirado também falha
    await q(db, b.lar, 'select public.renovar_token_confirmacao()')
    expect(await erro(db, 'anon', 'select * from public.confirmar_vagas_por_token($1, true)', [token])).toBe('Link de confirmação inválido ou expirado.')
    const [{ token: novo }] = (await q<{ token: string }>(db, b.lar, 'select public.renovar_token_confirmacao() as token')) as [{ token: string }]
    await adm("update public.instituicoes set confirmacao_token_expira_em = now() - interval '1 minute' where id = $1", [b.instituicao])
    expect(await erro(db, 'anon', 'select * from public.confirmar_vagas_por_token($1, true)', [novo])).toBe('Link de confirmação inválido ou expirado.')
    // quem não gere uma ficha não gera links
    expect(await codigoErro(db, b.familia, 'select public.renovar_token_confirmacao()')).toBe('42501')
  })

  it('só o hash fica guardado e ninguém o lê pela Data API (nem o dono)', async () => {
    const b = await cenarioBase(db, { sufixo: 'l2' })
    const [{ token }] = (await q<{ token: string }>(db, b.lar, 'select public.renovar_token_confirmacao() as token')) as [{ token: string }]
    for (const quem of ['anon', b.lar, b.familia]) {
      expect(await erro(db, quem, 'select confirmacao_token_hash from public.instituicoes')).toMatch(/permission denied/)
      expect(await erro(db, quem, 'select confirmacao_token_expira_em from public.instituicoes')).toMatch(/permission denied/)
    }
    const [r] = await adm<{ ok: boolean; bruto: number }>(
      `select confirmacao_token_hash = sha256(convert_to($2, 'UTF8')) as ok,
              (select count(*)::int from public.instituicoes i where row_to_json(i)::text like '%' || $2 || '%') as bruto
         from public.instituicoes where id = $1`, [b.instituicao, token])
    expect(r).toEqual({ ok: true, bruto: 0 })
    // a vista pública também não o expõe
    const cols = await adm<{ c: string }>("select column_name c from information_schema.columns where table_name = 'instituicoes_publicas'")
    expect(cols.map((x) => x.c).filter((c) => c.includes('token'))).toEqual([])
  })
})

describe('migração sobre dados existentes (projeto já em uso antes do modelo de negócio)', () => {
  it('pedidos que já avançaram ficam desbloqueados (sem mexer em updated_at); os por aceitar fecham-se e os avisos perdem os nomes', async () => {
    const antiga = await criarBase({ ate: '20261012190700' })
    const b = await cenarioBase(antiga, { sufixo: 'm' })
    const perfil2 = (await q<{ id: string }>(antiga, b.familia, `insert into public.perfis_cuidados (nome, idade, grau, local_lat, local_lng)
      values ('Rosa Antiga', 77, 'ligeira', 41.1, -8.6) returning id`))[0]!.id
    const porAceitar = (await q<{ id: string }>(antiga, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, b.perfil]))[0]!.id
    const emAnalise = (await q<{ id: string }>(antiga, b.familia, 'select id from public.candidatar($1, $2, true)', [b.instituicao, perfil2]))[0]!.id
    await q(antiga, b.lar, "select public.atualizar_estado_candidatura($1, 'em_analise')", [emAnalise])
    const antes = await admin<{ id: string; u: string }>(antiga, 'select id, updated_at::text u from public.candidaturas order by id')

    await aplicarMigracoes(antiga, '20261012190700')

    const [d] = await admin<{ a: string | null; b: boolean }>(antiga, `select
        (select desbloqueada_em::text from public.candidaturas where id = $1) a,
        (select desbloqueada_em = (select e.created_at from public.candidatura_eventos e where e.candidatura_id = $2 and e.estado = 'em_analise')
           from public.candidaturas where id = $2) b`, [porAceitar, emAnalise])
    expect(d).toEqual({ a: null, b: true })
    expect(await admin(antiga, 'select id, updated_at::text u from public.candidaturas order by id')).toEqual(antes)
    expect((await q<{ id: string }>(antiga, b.lar, 'select id from public.candidaturas')).map((x) => x.id)).toEqual([emAnalise])
    const avisos = await q<{ texto: string }>(antiga, b.lar, "select texto from public.notificacoes where titulo = 'Novo pedido de vaga' order by id")
    expect(avisos.map((a) => a.texto)).toEqual([
      'Pedido de vaga de uma família (pessoa de 80–84 anos). Abra o pedido para o aceitar e ver o contacto.',
      'Famíliam enviou um pedido para Rosa Antiga (77 anos).',
    ])
    await antiga.close()
  }, 120_000) // cria uma segunda base (todas as migrações) dentro do teste
})
