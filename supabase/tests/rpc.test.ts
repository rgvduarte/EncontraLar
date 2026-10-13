/**
 * RPC e lógica de negócio — regressões da revisão (2026-10-12): quem recebe dados de saúde,
 * minimização (cancelar, apagar perfil, retenção), avisos sem spam, sobrelotação, prazo de 48 h.
 */
import type { PGlite } from '@electric-sql/pglite'
import { beforeAll, describe, expect, it } from 'vitest'
import { larParaInsercao, quartoInicial } from '@/lib/supabase-mappers'
import { admin, cenarioBase, criarBase, criarUtilizador, erro, q } from './helpers'

let db: PGlite
const adm = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => admin<T>(db, sql, params)

interface Cand {
  id: string
  estado: string
  posicao: number | null
  prazo_resposta: string | null
}

const candidatar = async (familia: string, instituicao: string, perfil: string, mensagem: string | null = null) =>
  (await q<Cand>(db, familia, 'select * from public.candidatar($1, $2, true, $3)', [instituicao, perfil, mensagem]))[0]!
const mudarEstado = async (lar: string, id: string, estado: string, nota: string | null = null) =>
  (await q<Cand>(db, lar, 'select * from public.atualizar_estado_candidatura($1, $2, $3)', [id, estado, nota]))[0]!
const novoPerfil = async (familia: string, nome = 'Joaquim') =>
  (await q<{ id: string }>(db, familia, `insert into public.perfis_cuidados (nome, idade, grau, necessidades, quarto, local_lat, local_lng)
     values ($1, 88, 'moderada', '{demencia}', 'individual', 41.1, -8.6) returning id`, [nome]))[0]!.id
const livres = async (instituicao: string) =>
  (await adm<{ n: number }>('select coalesce(sum(livres), 0)::int n from public.quartos where instituicao_id = $1', [instituicao]))[0]!.n

beforeAll(async () => {
  db = await criarBase()
}, 120_000)

describe('candidatar: quem pode receber dados de saúde', () => {
  it('exige consentimento, ficha verificada e com gestor', async () => {
    const b = await cenarioBase(db, { sufixo: 'c1' })
    expect(await erro(db, b.familia, 'select public.candidatar($1, $2, false)', [b.instituicao, b.perfil])).toMatch(/consentimento/)

    await adm("update public.instituicoes set verificacao_estado = 'pendente' where id = $1", [b.instituicao])
    expect(await erro(db, b.familia, 'select public.candidatar($1, $2, true)', [b.instituicao, b.perfil])).toMatch(/ainda não recebe pedidos/)

    // ficha publicada e "verificada" mas sem gestor (ex.: importada): ninguém leria nem responderia
    await adm("update public.instituicoes set verificacao_estado = 'verificado', owner_id = null where id = $1", [b.instituicao])
    await adm('update public.instituicoes set publicado = true where id = $1', [b.instituicao])
    expect(await erro(db, b.familia, 'select public.candidatar($1, $2, true)', [b.instituicao, b.perfil])).toMatch(/ainda não recebe pedidos/)
    expect(await adm('select 1 from public.candidaturas where instituicao_id = $1', [b.instituicao])).toEqual([])
  })

  it('contas e fichas de demonstração não se cruzam com as reais', async () => {
    const real = await cenarioBase(db, { sufixo: 'c2' })
    const demo = await cenarioBase(db, { sufixo: 'c3' })
    await adm('update public.instituicoes set demonstracao = true where id = $1', [demo.instituicao])
    await adm('update public.perfis_utilizador set demonstracao = true where id = $1', [demo.familia])
    expect(await erro(db, real.familia, 'select public.candidatar($1, $2, true)', [demo.instituicao, real.perfil])).toMatch(/ficha é de demonstração/)
    expect(await erro(db, demo.familia, 'select public.candidatar($1, $2, true)', [real.instituicao, demo.perfil])).toMatch(/contas de demonstração não enviam/)
    expect((await candidatar(demo.familia, demo.instituicao, demo.perfil)).estado).toBe('enviada')
  })

  it('a cópia enviada tem só os campos necessários (sem coordenadas exatas, raio, id nem datas)', async () => {
    const b = await cenarioBase(db, { sufixo: 'c4' })
    const c = await candidatar(b.familia, b.instituicao, b.perfil)
    // (duas fases: antes de aceitar o lar nem a linha vê — ver negocio.test.ts)
    expect(await q(db, b.lar, 'select id from public.candidaturas where id = $1', [c.id])).toEqual([])
    await q(db, b.lar, 'select public.aceitar_candidatura($1)', [c.id])
    const [r] = await q<{ chaves: string[] }>(db, b.lar, 'select array(select jsonb_object_keys(perfil_snapshot) order by 1) as chaves from public.candidaturas where id = $1', [c.id])
    expect(r!.chaves).toEqual([
      'genero', 'grau', 'idade', 'local_label', 'necessidades', 'nome', 'notas', 'orcamento_max', 'precisa_acordo_ss',
      'preferencias', 'quarto', 'relacao', 'urgencia',
    ])
  })

  it('limita pedidos repetidos (cancelar e voltar a pedir não inunda a instituição)', async () => {
    const b = await cenarioBase(db, { sufixo: 'c5' })
    for (let i = 0; i < 3; i++) {
      const c = await candidatar(b.familia, b.instituicao, b.perfil)
      await q(db, b.familia, 'select public.cancelar_candidatura($1)', [c.id])
    }
    expect(await erro(db, b.familia, 'select public.candidatar($1, $2, true)', [b.instituicao, b.perfil])).toMatch(/limite de pedidos/)
  })
})

describe('minimização (RGPD)', () => {
  it('cancelar retira de imediato os dados de saúde à instituição (cópia, contacto, mensagem, notas)', async () => {
    const b = await cenarioBase(db, { sufixo: 'm1' })
    const c = await candidatar(b.familia, b.instituicao, b.perfil, 'A minha mãe tem Alzheimer avançado e é VIH+.')
    await mudarEstado(b.lar, c.id, 'em_analise', 'Não aceitamos Alzheimer avançado nem diabetes insulinodependente')
    const [antes] = await adm<{ texto: string }>("select texto from public.notificacoes where user_id = $1 and candidatura_id = $2 and texto like '%Nota:%'", [b.familia, c.id])
    expect(antes!.texto).toMatch(/Nota: Não aceitamos Alzheimer/)

    await q(db, b.familia, 'select public.cancelar_candidatura($1)', [c.id])

    const [r] = await q<{ estado: string; snap: Record<string, unknown>; contacto: Record<string, unknown>; mensagem: string | null }>(
      db, b.lar, 'select estado, perfil_snapshot as snap, contacto, mensagem from public.candidaturas where id = $1', [c.id],
    )
    expect(r!.estado).toBe('cancelada')
    expect(Object.keys(r!.snap).sort()).toEqual(['idade', 'minimizado_em', 'nome'])
    expect(r!.contacto).toEqual({ nome: 'Famíliam1' })
    expect(r!.mensagem).toBeNull()
    const notas = await q<{ nota: string | null }>(db, b.lar, 'select nota from public.candidatura_eventos where candidatura_id = $1', [c.id])
    expect(notas.every((e) => e.nota == null)).toBe(true)
    const textos = await adm<{ texto: string }>('select texto from public.notificacoes where candidatura_id = $1', [c.id])
    expect(textos.some((t) => /Alzheimer|VIH/.test(t.texto))).toBe(false)
    // a instituição continua a saber que o pedido foi cancelado (nome apenas)
    expect(textos.some((t) => t.texto === 'Famíliam1 cancelou o pedido para Maria.')).toBe(true)
  })

  it('apagar o perfil minimiza os pedidos já encerrados; os ativos mantêm a cópia (como a interface promete)', async () => {
    const b = await cenarioBase(db, { sufixo: 'm2' })
    const outra = await cenarioBase(db, { sufixo: 'm3' })
    const ativa = await candidatar(b.familia, b.instituicao, b.perfil)
    await mudarEstado(b.lar, ativa.id, 'em_analise')
    // pedido a outra instituição, analisado e recusado por ela
    const recusada = await candidatar(b.familia, outra.instituicao, b.perfil)
    await mudarEstado(outra.lar, recusada.id, 'em_analise')
    await mudarEstado(outra.lar, recusada.id, 'recusada', 'Sem resposta para demência avançada')

    expect(await q(db, b.familia, 'delete from public.perfis_cuidados where id = $1 returning id', [b.perfil])).toHaveLength(1)

    const [a] = await q<{ grau: string | null; perfil_id: string | null }>(db, b.lar, "select perfil_snapshot ->> 'grau' as grau, perfil_id from public.candidaturas where id = $1", [ativa.id])
    expect(a).toEqual({ grau: 'grave', perfil_id: null })
    const [rr] = await q<{ grau: string | null; nota: string | null }>(db, outra.lar, `select c.perfil_snapshot ->> 'grau' as grau,
        (select e.nota from public.candidatura_eventos e where e.candidatura_id = c.id and e.estado = 'recusada') as nota
       from public.candidaturas c where c.id = $1`, [recusada.id])
    expect(rr).toEqual({ grau: null, nota: null })
  })

  it('retenção: pedidos recusados há mais de 30 dias são minimizados pelo trabalho diário', async () => {
    const b = await cenarioBase(db, { sufixo: 'm4' })
    const p2 = await novoPerfil(b.familia, 'Albertina')
    const velha = await candidatar(b.familia, b.instituicao, b.perfil)
    const recente = await candidatar(b.familia, b.instituicao, p2)
    for (const c of [velha, recente]) await mudarEstado(b.lar, c.id, 'em_analise')
    await mudarEstado(b.lar, velha.id, 'recusada', 'Grau de dependência grave')
    await mudarEstado(b.lar, recente.id, 'recusada')
    await adm('alter table public.candidaturas disable trigger candidaturas_updated_at')
    await adm("update public.candidaturas set updated_at = now() - interval '31 days' where id = $1", [velha.id])
    await adm("update public.candidaturas set updated_at = now() - interval '10 days' where id = $1", [recente.id])
    await adm('alter table public.candidaturas enable trigger candidaturas_updated_at')

    const [n] = await adm<{ n: number }>('select private.minimizar_candidaturas_encerradas(30) as n')
    expect(n!.n).toBeGreaterThanOrEqual(1)
    const r = await q<{ id: string; minimizado: boolean; nota: string | null }>(db, b.lar, `select c.id, c.perfil_snapshot ? 'minimizado_em' as minimizado,
        (select e.nota from public.candidatura_eventos e where e.candidatura_id = c.id and e.estado = 'recusada') as nota
       from public.candidaturas c where c.id = any($1::uuid[])`, [[velha.id, recente.id]])
    expect(r.find((x) => x.id === velha.id)).toMatchObject({ minimizado: true, nota: null })
    expect(r.find((x) => x.id === recente.id)).toMatchObject({ minimizado: false })
    // a manutenção não é invocável pela Data API
    expect(await erro(db, 'service_role', 'select private.minimizar_candidaturas_encerradas(0)')).toMatch(/permission denied/)
  })

  it('apagar a conta inteira continua a funcionar (cascata) e a fila da instituição encurta', async () => {
    const b = await cenarioBase(db, { sufixo: 'm5' })
    const outra = await criarUtilizador(db, { email: 'atras@x.pt', roleAdmin: 'familia', acesso: true })
    const pOutra = await novoPerfil(outra)
    const c1 = await candidatar(b.familia, b.instituicao, b.perfil)
    const c2 = await candidatar(outra, b.instituicao, pOutra)
    await mudarEstado(b.lar, c1.id, 'lista_espera')
    await mudarEstado(b.lar, c2.id, 'lista_espera')
    await adm('delete from auth.users where id = $1', [b.familia])
    const [r] = await adm<{ posicao: number }>('select posicao from public.candidaturas where id = $1', [c2.id])
    expect(r!.posicao).toBe(1)
  })
})

describe('avisos sem spam', () => {
  it('200 alternâncias de vagas geram no máximo um aviso por família e instituição em 24 h', async () => {
    const b = await cenarioBase(db, { sufixo: 'n1', livres: { individual: 0 } })
    const seguidor = await criarUtilizador(db, { email: 'segue-n1@x.pt', roleAdmin: 'familia', acesso: true })
    await q(db, seguidor, 'insert into public.favoritos (instituicao_id) values ($1)', [b.instituicao])
    const c = await candidatar(b.familia, b.instituicao, b.perfil)
    await mudarEstado(b.lar, c.id, 'lista_espera')
    let avisadas = 0
    for (let i = 0; i < 200; i++) {
      await q(db, b.lar, "select public.definir_vagas($1, 'individual', 0)", [b.instituicao])
      avisadas += (await q<{ n: number }>(db, b.lar, "select public.definir_vagas($1, 'individual', 10) as n", [b.instituicao]))[0]!.n
    }
    expect(avisadas).toBe(2)
    const [n] = await adm<{ seg: number; fam: number }>(`select
        (select count(*)::int from public.notificacoes where user_id = $1 and tipo = 'vaga') seg,
        (select count(*)::int from public.notificacoes where user_id = $2 and tipo = 'vaga') fam`, [seguidor, b.familia])
    expect(n).toEqual({ seg: 1, fam: 1 })
  })

  it('pedir a mesma visita não avisa; mais de 3 alterações por dia são recusadas', async () => {
    const b = await cenarioBase(db, { sufixo: 'n2' })
    const c = await candidatar(b.familia, b.instituicao, b.perfil)
    const pedir = (dias: number, hora = '10:00') =>
      q(db, b.familia, `select public.pedir_visita($1, current_date + ${dias}, $2::time)`, [c.id, hora])
    const avisos = async () =>
      (await adm<{ n: number }>("select count(*)::int n from public.notificacoes where user_id = $1 and tipo = 'visita'", [b.lar]))[0]!.n
    await pedir(3)
    for (let i = 0; i < 50; i++) await pedir(3)
    expect(await avisos()).toBe(1)
    await pedir(4)
    await pedir(5)
    expect(await avisos()).toBe(3)
    expect(await erro(db, b.familia, "select public.pedir_visita($1, current_date + 6, '10:00')", [c.id])).toMatch(/várias alterações/)
  })
})

describe('vagas: sem sobrelotação e com prazo', () => {
  it('um lugar livre só pode ser proposto a uma família de cada vez e só aceite uma vez', async () => {
    const b = await cenarioBase(db, { sufixo: 'v1', livres: { individual: 1 } })
    const outra = await criarUtilizador(db, { email: 'v1b@x.pt', roleAdmin: 'familia', acesso: true })
    const pOutra = await novoPerfil(outra)
    const a = await candidatar(b.familia, b.instituicao, b.perfil)
    const c = await candidatar(outra, b.instituicao, pOutra)
    await mudarEstado(b.lar, a.id, 'em_analise')
    await mudarEstado(b.lar, c.id, 'em_analise')
    expect((await mudarEstado(b.lar, a.id, 'vaga_proposta')).estado).toBe('vaga_proposta')
    expect(await erro(db, b.lar, "select public.atualizar_estado_candidatura($1, 'vaga_proposta')", [c.id])).toMatch(/cada vaga proposta reserva um lugar/)
    expect((await q<Cand>(db, b.familia, 'select * from public.responder_vaga($1, true)', [a.id]))[0]!.estado).toBe('aceite')
    expect(await livres(b.instituicao)).toBe(0)
    expect((await adm<{ n: number }>("select count(*)::int n from public.candidaturas where instituicao_id = $1 and estado = 'aceite'", [b.instituicao]))[0]!.n).toBe(1)
  })

  it('aceitar sem lugar livre falha sem alterar nada (família e instituição)', async () => {
    const b = await cenarioBase(db, { sufixo: 'v2', livres: { individual: 1 } })
    const a = await candidatar(b.familia, b.instituicao, b.perfil)
    await mudarEstado(b.lar, a.id, 'em_analise')
    await mudarEstado(b.lar, a.id, 'vaga_proposta')
    await q(db, b.lar, "select public.definir_vagas($1, 'individual', 0)", [b.instituicao])
    expect(await erro(db, b.familia, 'select public.responder_vaga($1, true)', [a.id])).toMatch(/Já não há lugar livre/)
    expect(await erro(db, b.lar, "select public.atualizar_estado_candidatura($1, 'aceite')", [a.id])).toMatch(/Já não há lugar livre/)
    expect((await adm<{ estado: string }>('select estado from public.candidaturas where id = $1', [a.id]))[0]!.estado).toBe('vaga_proposta')
  })

  it('a família não aceita depois do prazo de 48 h (pode recusar)', async () => {
    const b = await cenarioBase(db, { sufixo: 'v3', livres: { individual: 2 } })
    const p2 = await novoPerfil(b.familia, 'Rosa')
    const a = await candidatar(b.familia, b.instituicao, b.perfil)
    const c = await candidatar(b.familia, b.instituicao, p2)
    for (const x of [a, c]) {
      await mudarEstado(b.lar, x.id, 'em_analise')
      await mudarEstado(b.lar, x.id, 'vaga_proposta')
    }
    await adm("update public.candidaturas set prazo_resposta = now() - interval '10 days' where id = any($1::uuid[])", [[a.id, c.id]])
    expect(await erro(db, b.familia, 'select public.responder_vaga($1, true)', [a.id])).toMatch(/prazo para responder/)
    expect(await livres(b.instituicao)).toBe(2)
    expect((await q<Cand>(db, b.familia, 'select * from public.responder_vaga($1, false)', [c.id]))[0]!.estado).toBe('lista_espera')
  })

  it('o trabalho agendado devolve à lista as propostas fora de prazo e avisa as duas partes', async () => {
    const b = await cenarioBase(db, { sufixo: 'v4', livres: { individual: 1 } })
    const a = await candidatar(b.familia, b.instituicao, b.perfil)
    await mudarEstado(b.lar, a.id, 'lista_espera')
    const proposta = await mudarEstado(b.lar, a.id, 'vaga_proposta')
    await adm("update public.candidaturas set prazo_resposta = now() - interval '1 minute' where id = $1", [a.id])

    const [n] = await adm<{ n: number }>('select private.expirar_propostas() as n')
    expect(n!.n).toBeGreaterThanOrEqual(1)
    const [r] = await adm<Cand>('select * from public.candidaturas where id = $1', [a.id])
    expect(r).toMatchObject({ estado: 'lista_espera', posicao: proposta.posicao, prazo_resposta: null })
    const [ev] = await adm<{ autor: string }>("select autor from public.candidatura_eventos where candidatura_id = $1 order by id desc limit 1", [a.id])
    expect(ev!.autor).toBe('sistema')
    const avisos = await adm<{ user_id: string }>("select user_id from public.notificacoes where candidatura_id = $1 and titulo in ('Prazo da vaga terminado', 'Proposta sem resposta')", [a.id])
    expect(avisos.map((x) => x.user_id).sort()).toEqual([b.familia, b.lar].sort())
    // o lugar volta a poder ser proposto
    expect((await mudarEstado(b.lar, a.id, 'vaga_proposta')).estado).toBe('vaga_proposta')
  })
})

describe('saídas no calendário português', () => {
  it('registar_vaga_libertada conta a saída no mês corrente de Lisboa', async () => {
    const b = await cenarioBase(db, { sufixo: 's1', livres: { individual: 0 } })
    await q(db, b.lar, "select public.registar_vaga_libertada($1, 'individual')", [b.instituicao])
    const [r] = await adm<{ ok: boolean }>(
      "select mes = date_trunc('month', now() at time zone 'Europe/Lisbon')::date as ok from public.saidas_mensais where instituicao_id = $1", [b.instituicao],
    )
    expect(r!.ok).toBe(true)
  })
})

describe('registo de uma instituição (mappers → PostgREST)', () => {
  /** Como o PostgREST insere: INSERT … SELECT colunas FROM json_populate_recordset(null::tabela, corpo). */
  const inserirComoPostgrest = (quem: string, tabela: string, corpo: Record<string, unknown>) => {
    const cols = Object.keys(corpo).join(', ')
    return q<{ id: string }>(db, quem, `insert into public.${tabela} (${cols}) select ${cols} from json_populate_recordset(null::public.${tabela}, $1::json) returning id`, [JSON.stringify([corpo])])
  }

  it('a ficha e o primeiro quarto gerados por larParaInsercao/quartoInicial são aceites e nascem por publicar', async () => {
    const lar = await criarUtilizador(db, { email: 'registo@lar.pt', roleRegisto: 'lar' })
    const inst = { nome: 'Lar Registo', tipo: 'erpi' as const, natureza: 'ipss' as const, lugar: 'Lisboa — Alvalade', capacidade: 30, licenca: '1/2026', precoDesde: 1200 }
    const [f] = await inserirComoPostgrest(lar, 'instituicoes', { ...larParaInsercao(inst, { email: 'registo@lar.pt', telefone: '210 000 000' }) })
    expect(f!.id).toBe('lar-lar-registo')
    await inserirComoPostgrest(lar, 'quartos', { ...quartoInicial(f!.id, inst) })
    const [r] = await q<Record<string, unknown>>(db, lar, 'select publicado, verificacao_estado, capacidade, regiao from public.instituicoes where id = $1', [f!.id])
    expect(r).toEqual({ publicado: false, verificacao_estado: 'pendente', capacidade: 30, regiao: 'Lisboa e Vale do Tejo' })
    // a morada e os contactos não se leem na tabela (são do Acesso Família): o dono lê a sua ficha inteira por instituicoes_completas
    expect(await erro(db, lar, 'select codigo_postal from public.instituicoes where id = $1', [f!.id])).toMatch(/permission denied/)
    const [c] = await q<Record<string, unknown>>(db, lar, 'select codigo_postal, telefone, publicado from public.instituicoes_completas()')
    expect(c).toEqual({ codigo_postal: '1700-000', telefone: '210 000 000', publicado: false })
  })
})
