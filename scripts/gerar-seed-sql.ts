/**
 * Gera supabase/seed.sql, supabase/demo/utilizadores-demo.sql e supabase/demo/contas-demo.json a
 * partir do seed determinístico do protótipo (src/data/seed.ts → createSeed), para a base de dados
 * de DEMONSTRAÇÃO coincidir com o modo demonstração. Nunca para o projeto de produção: as fichas são
 * fictícias (marcadas demonstracao = true) e as contas de demonstração têm palavra-passe pública.
 *
 * Como correr (resolve o alias '@/' através do Vite/Vitest):
 *   npm run db:seed-sql          → reescreve os ficheiros
 *   npx vitest run scripts       → verifica que os ficheiros commitados estão atualizados
 *
 * As datas são escritas RELATIVAS ao momento em que o SQL corre (now() − intervalo), tal como o
 * protótipo as gera relativas ao momento do seed. O conteúdo é fixado por AGORA_SEED (o RNG do seed
 * depende do mês corrente, por isso fixamos a data para o ficheiro ser estável).
 */
import { createHash } from 'node:crypto'
import { createSeed, DEMO_FAMILIA_ID, DEMO_LAR_ID, DEMO_LAR_USER_ID, DEMO_PASSWORD, DEMO_PRO_ID } from '@/data/seed'
import { diaPorExtenso } from '@/lib/format'
import { taxaPara } from '@/lib/negocio'
import type { Candidatura, Caso, DB, Lar, Notificacao, Organizacao, PerfilIdoso, ProcuraAnonima, User } from '@/types'

/** Data de referência do seed (igual à usada em src/data/seed.test.ts). */
export const AGORA_SEED = Date.UTC(2026, 9, 12, 10, 0, 0)

// ————————————————————————————————————————— literais SQL

export function lit(v: string | number | boolean | null | undefined): string {
  if (v == null) return 'null'
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`número inválido: ${v}`)
    return String(v)
  }
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  const corpo = v.replace(/'/g, "''")
  if (/[\n\r\\]/.test(corpo)) return `E'${corpo.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
  return `'${corpo}'`
}

const arr = (xs: readonly string[], tipo: string) => (xs.length ? `array[${xs.map(lit).join(', ')}]::${tipo}` : `'{}'::${tipo}`)
const jsonb = (v: unknown) => `${lit(JSON.stringify(v))}::jsonb`

/** Data ISO → expressão relativa ao momento em que o SQL corre. */
function rel(iso: string | undefined, agora: number): string {
  if (!iso) return 'null'
  const ms = agora - Date.parse(iso)
  if (!Number.isFinite(ms)) throw new Error(`data inválida: ${iso}`)
  const seg = Math.abs(ms) / 1000
  return `now() ${ms >= 0 ? '-' : '+'} interval '${seg} seconds'`
}

/** Dia local AAAA-MM-DD → expressão relativa ao dia em que o SQL corre (current_date ± N). */
function diaRel(ymd: string | undefined, agora: number): string {
  if (!ymd) return 'null'
  const dias = Math.round((Date.parse(ymd) - agora) / 86_400_000)
  if (!Number.isFinite(dias)) throw new Error(`dia inválido: ${ymd}`)
  return dias === 0 ? 'current_date' : `current_date ${dias > 0 ? '+' : '-'} ${Math.abs(dias)}`
}

/** Hash SHA-256 (o mesmo que private.hash_token) do token do link de confirmação: o token em bruto não vai para o SQL. */
export const hashToken = (token: string) => createHash('sha256').update(token, 'utf8').digest('hex')

/** Mês k (0 = há 11 meses … 11 = mês corrente em Lisboa), igual à janela de historicoSaidas e da vista. */
const mes = (k: number) => `(date_trunc('month', now() at time zone 'Europe/Lisbon') - interval '${11 - k} months')::date`

/** UUID determinístico para ids do protótipo ('p-maria-carmo' → uuid). */
const uuidDe = (id: string) => `md5(${lit(`encontralar:${id}`)})::uuid`

function emLotes<T>(xs: T[], n: number): T[][] {
  const lotes: T[][] = []
  for (let i = 0; i < xs.length; i += n) lotes.push(xs.slice(i, i + n))
  return lotes
}

const ID_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/

// ————————————————————————————————————————— seed.sql

const COLUNAS_INSTITUICAO = [
  'id', 'publicado', 'demonstracao', 'nome', 'tipo', 'natureza', 'resumo', 'descricao', 'morada', 'codigo_postal', 'localidade',
  'concelho', 'distrito', 'regiao', 'lat', 'lng', 'telefone', 'email', 'website', 'capacidade',
  'lista_espera_offline', 'estadia_media_meses', 'acordo_ss', 'incluido', 'extras', 'graus', 'cuidados',
  'comodidades', 'equipa_cuidadores_por_10', 'equipa_enfermeiros', 'equipa_medico_horas_semana', 'licenca',
  'verificacao_estado', 'verificacao_data', 'ultima_inspecao', 'avaliacao_media', 'num_avaliacoes', 'fundacao',
  'atualizado_em', 'capa', 'visualizacoes_30d', 'confirmacao_token_hash',
]

function linhaInstituicao(l: Lar, agora: number): string {
  if (!ID_VALIDO.test(l.id)) throw new Error(`id de instituição inválido para a BD: ${l.id}`)
  const v = [
    lit(l.id), 'true', 'true', lit(l.nome), lit(l.tipo), lit(l.natureza), lit(l.resumo), lit(l.descricao), lit(l.morada),
    lit(l.codigoPostal || null), lit(l.localidade), lit(l.concelho), lit(l.distrito), lit(l.regiao), lit(l.lat), lit(l.lng),
    lit(l.telefone || null), lit(l.email || null), lit(l.website ?? null), lit(l.capacidade),
    // no seed não há candidaturas da plataforma: toda a lista de espera é "offline"
    lit(l.listaEspera), lit(l.estadiaMediaMeses), lit(l.acordoSS), arr(l.incluido, 'text[]'), jsonb(l.extras),
    arr(l.graus, 'public.grau_dependencia[]'), arr(l.cuidados, 'text[]'), arr(l.comodidades, 'text[]'),
    lit(l.equipa.cuidadoresPor10), lit(l.equipa.enfermeiros), lit(l.equipa.medicoHorasSemana), lit(l.verificacao.licenca),
    lit(l.verificacao.estado), rel(l.verificacao.data, agora), rel(l.verificacao.ultimaInspecao, agora),
    lit(l.avaliacao), lit(l.numAvaliacoes), lit(l.fundacao), rel(l.atualizadoEm, agora), jsonb(l.capa),
    lit(l.visualizacoes30d),
    l.confirmacaoToken ? `decode('${hashToken(l.confirmacaoToken)}', 'hex')` : 'null',
  ]
  return `  (${v.join(', ')})`
}

function linhaProcura(p: ProcuraAnonima, agora: number): string {
  if (p.lugar && /[0-9@<>]/.test(p.lugar)) throw new Error(`procura ${p.id}: lugar inválido para a BD (${p.lugar})`)
  const v = [
    lit(p.distrito ?? null), lit(p.lugar ?? null), lit(p.grau ?? null), arr([...new Set(p.cuidados)].sort(), 'text[]'),
    lit(p.orcamentoMax ?? null), lit(p.resultados), lit(p.comVaga), rel(p.criadaEm, agora),
  ]
  return `  (${v.join(', ')})`
}

export function gerarSeedSql(agora = AGORA_SEED, db: DB = createSeed(agora)): string {
  const out: string[] = []
  const lares = db.lares
  out.push(
    '-- =====================================================================================',
    '-- EncontraLar — dados de demonstração (FICTÍCIOS). FICHEIRO GERADO — não editar à mão.',
    '-- Origem: src/data/seed.ts (createSeed) via scripts/gerar-seed-sql.ts → `npm run db:seed-sql`.',
    '--',
    '-- SÓ PARA BASES DE DEMONSTRAÇÃO (local, ramo do Supabase ou projeto à parte) — NUNCA em produção.',
    '-- As fichas ficam marcadas demonstracao = true: só recebem pedidos de contas de demonstração.',
    '--',
    `-- ${lares.length} instituições (com o hash SHA-256 do link de confirmação das vagas), os seus quartos,`,
    `-- 12 meses de saídas, avaliações e ${db.procuras.length} pesquisas sem vagas (procura anónima).`,
    '-- As datas são relativas ao momento em que este ficheiro corre (now() − intervalo).',
    '-- Contas de utilizador NÃO são criadas aqui (no Supabase alojado criam-se pela Auth Admin API);',
    '-- todas as fichas ficam sem dono (owner_id null). Para ligar as contas de demonstração ao lar',
    `-- "${DEMO_LAR_ID}" corra depois supabase/demo/utilizadores-demo.sql (ver docs/SUPABASE.md).`,
    '-- Idempotente: pode ser executado mais do que uma vez.',
    '-- =====================================================================================',
    '',
  )

  const tokens = lares.map((l) => l.confirmacaoToken).filter(Boolean)
  if (new Set(tokens).size !== tokens.length) throw new Error('tokens de confirmação repetidos')

  out.push('-- ————————————————————————————————————————— instituições')
  for (const lote of emLotes(lares, 100)) {
    out.push(`insert into public.instituicoes (${COLUNAS_INSTITUICAO.join(', ')}) values`)
    out.push(lote.map((l) => linhaInstituicao(l, agora)).join(',\n'))
    out.push('on conflict (id) do nothing;', '')
  }

  out.push('-- ————————————————————————————————————————— quartos')
  const quartos = lares.flatMap((l) =>
    l.quartos.map((q) => `  (${[lit(l.id), lit(q.tipo), lit(q.total), lit(q.livres), lit(q.precoMin), lit(q.precoMax)].join(', ')})`),
  )
  for (const lote of emLotes(quartos, 500)) {
    out.push('insert into public.quartos (instituicao_id, tipo, total, livres, preco_min, preco_max) values')
    out.push(lote.join(',\n'))
    out.push('on conflict (instituicao_id, tipo) do nothing;', '')
  }

  out.push('-- ————————————————————————————————————————— saídas mensais (o último mês é o corrente)')
  const saidas = lares.flatMap((l) => {
    if (l.historicoSaidas.length !== 12) throw new Error(`${l.id}: historicoSaidas deve ter 12 meses`)
    return l.historicoSaidas.map((n, k) => `  (${lit(l.id)}, ${mes(k)}, ${lit(n)})`)
  })
  for (const lote of emLotes(saidas, 500)) {
    out.push('insert into public.saidas_mensais (instituicao_id, mes, saidas) values')
    out.push(lote.join(',\n'))
    out.push('on conflict (instituicao_id, mes) do nothing;', '')
  }

  out.push('-- ————————————————————————————————————————— avaliações (importadas: user_id null)')
  const reviews = lares.flatMap((l) =>
    l.reviews.map((r) => {
      const v = [
        lit(l.id), lit(r.autor), lit(r.relacao), lit(r.nota), lit(r.aspetos.cuidados), lit(r.aspetos.alimentacao),
        lit(r.aspetos.instalacoes), lit(r.aspetos.comunicacao), lit(r.texto), lit(r.verificada), rel(r.data, agora),
      ]
      return `  (${v.join(', ')})`
    }),
  )
  for (const lote of emLotes(reviews, 500)) {
    out.push(
      'insert into public.avaliacoes (instituicao_id, autor, relacao, nota, aspeto_cuidados, aspeto_alimentacao,',
      '                               aspeto_instalacoes, aspeto_comunicacao, texto, verificada, created_at)',
      'select v.* from (values',
    )
    out.push(lote.join(',\n'))
    out.push(
      ') as v (instituicao_id, autor, relacao, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes,',
      '        aspeto_comunicacao, texto, verificada, created_at)',
      'where not exists (',
      '  select 1 from public.avaliacoes a',
      '   where a.instituicao_id = v.instituicao_id and a.user_id is null and a.autor = v.autor and a.texto = v.texto',
      ');',
      '',
    )
  }

  out.push('-- ————————————————————————————————————————— procura sem resposta (anónima; só se a tabela estiver vazia)')
  for (const lote of emLotes(db.procuras, 500)) {
    out.push(
      'insert into public.procuras_anonimas (distrito, lugar, grau, cuidados, orcamento_max, resultados, com_vaga, created_at)',
      'select v.distrito, v.lugar, v.grau::public.grau_dependencia, v.cuidados, v.orcamento_max, v.resultados, v.com_vaga, v.created_at',
      'from (values',
    )
    out.push(lote.map((p) => linhaProcura(p, agora)).join(',\n'))
    out.push(
      ') as v (distrito, lugar, grau, cuidados, orcamento_max, resultados, com_vaga, created_at)',
      'where not exists (select 1 from public.procuras_anonimas);',
      '',
    )
  }

  return out.join('\n')
}

// ————————————————————————————————————————— contas de demonstração

/** Conta a criar pela Auth Admin API (scripts/criar-contas-demo.mjs lê supabase/demo/contas-demo.json). */
export interface ContaDemo {
  email: string
  role: User['role']
  nome: string
  telefone: string | null
  /** só as contas mostradas no login têm palavra-passe conhecida (pública); as outras são aleatórias */
  palavraPasse: string | null
  /** contas 'profissional': organização (vai para app_metadata.organizacao) */
  organizacao?: Organizacao
}

/** Variável PL/pgSQL de cada conta do protótipo ('u-fam-0' → v_fam_0). */
function variavelConta(u: User): string {
  if (u.id === DEMO_LAR_USER_ID) return 'v_lar'
  if (u.id === DEMO_FAMILIA_ID) return 'v_familia'
  if (u.id === DEMO_PRO_ID) return 'v_profissional'
  return `v_${u.id.replace(/^u-/, '').replace(/[^a-z0-9]+/g, '_')}`
}

export function contasDemo(db: DB = createSeed(AGORA_SEED)): ContaDemo[] {
  return db.users.map((u) => ({
    email: u.email.toLowerCase(),
    role: u.role,
    nome: u.nome,
    telefone: u.telefone ?? null,
    palavraPasse: u.demo ? DEMO_PASSWORD : null,
    ...(u.organizacao ? { organizacao: u.organizacao } : {}),
  }))
}

export function gerarContasDemoJson(agora = AGORA_SEED, db: DB = createSeed(agora)): string {
  return `${JSON.stringify(contasDemo(db), null, 2)}\n`
}

// ————————————————————————————————————————— demo/utilizadores-demo.sql

function linhaPerfil(p: PerfilIdoso, agora: number, userVar: string): string {
  return [
    uuidDe(p.id), userVar, lit(p.nome), lit(p.idade), lit(p.relacao), lit(p.genero ?? null), lit(p.grau),
    arr(p.necessidades, 'text[]'), arr(p.preferencias, 'text[]'), lit(p.quarto), lit(p.local.label), lit(p.local.lat),
    lit(p.local.lng), lit(p.raioKm), lit(p.orcamentoMax), lit(p.urgencia), lit(p.precisaAcordoSS), lit(p.notas ?? null),
    rel(p.criadoEm, agora), rel(p.atualizadoEm, agora),
  ].join(', ')
}

/**
 * Quando o lar aceitou o pedido (desbloqueada_em). O protótipo regista desbloqueadaEm em aceitarPedido
 * e ao fazer avançar um pedido (atualizarCandidatura); nos pedidos de exemplo que já avançaram sem o
 * campo usa-se o primeiro passo em frente do histórico. Recusar ou cancelar sem aceitar não desbloqueia
 * (na BD é a regra: ver 20261012190800_modelo_negocio.sql).
 */
export function desbloqueioDe(c: Candidatura): string | undefined {
  if (c.desbloqueadaEm) return c.desbloqueadaEm
  const passo = c.historico.find((h) => !['enviada', 'recusada', 'cancelada'].includes(h.estado))
  if (!passo && !['enviada', 'recusada', 'cancelada'].includes(c.estado)) {
    throw new Error(`candidatura ${c.id}: estado ${c.estado} sem data de aceitação (desbloqueadaEm ou histórico)`)
  }
  return passo?.data
}

function blocoCandidatura(c: Candidatura, agora: number, varDe: Map<string, string>, porLar: Map<string, Lar>): string[] {
  const dias = c.visita ? Math.round((Date.parse(c.visita.data) - agora) / 86_400_000) : null
  const autor = varDe.get(c.userId)
  if (!autor) throw new Error(`candidatura ${c.id}: conta ${c.userId} sem variável`)
  const enc = c.encaminhamento
  const origem = c.origem ?? 'familia'
  if ((origem === 'profissional') !== !!enc) throw new Error(`candidatura ${c.id}: origem e encaminhamento incoerentes`)
  if (enc && enc.profissionalId !== c.userId) throw new Error(`candidatura ${c.id}: o encaminhamento é de outra conta`)
  const lar = porLar.get(c.larId)
  if (!lar) throw new Error(`candidatura ${c.id}: instituição ${c.larId} em falta`)
  const e = c.entrada
  if ((c.estado === 'admitida') !== !!e) throw new Error(`candidatura ${c.id}: estado admitida sem entrada (ou o contrário)`)
  if (e && e.taxa !== taxaPara(lar)) throw new Error(`candidatura ${c.id}: taxa ${e.taxa} não corresponde à natureza ${lar.natureza}`)
  // eventos do lar: autor = gestora, só no lar de demonstração (os outros não têm gestor)
  const autorLar = c.larId === DEMO_LAR_ID ? 'v_lar' : 'null'
  const linhas = [
    '  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,',
    '    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,',
    '    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,',
    '    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)',
    `  select ${uuidDe(c.id)}, ${lit(c.larId)}, ${autor}, p.id, private.snapshot_perfil(p), ${jsonb(c.contacto)},`,
    `    ${lit(c.estado)}, ${lit(c.posicao ?? null)}, ${lit(c.mensagem ?? null)},`,
    `    ${dias == null ? 'null' : `current_date + ${dias}`}, ${lit(c.visita?.hora ?? null)}, ${lit(c.visita?.estado ?? null)},`,
    `    ${c.prazoResposta ? rel(c.prazoResposta, agora) : 'null'}, ${rel(c.criadaEm, agora)}, ${rel(c.criadaEm, agora)}, ${rel(c.atualizadaEm, agora)},`,
    `    ${lit(origem)}, ${enc ? uuidDe(enc.casoId) : 'null'}, ${lit(enc?.organizacao ?? null)}, ${diaRel(enc?.altaPrevista, agora)}, ${rel(desbloqueioDe(c), agora)},`,
    `    ${diaRel(e?.data, agora)}, ${rel(e?.confirmadaLarEm, agora)}, ${rel(e?.confirmadaFamiliaEm, agora)}, ${lit(e?.taxa ?? null)}`,
    `  from public.perfis_cuidados p where p.id = ${uuidDe(c.perfilId)};`,
  ]
  const autorPedido = origem === 'profissional' ? 'profissional' : 'familia'
  for (const h of c.historico) {
    const doAutor = h.estado === 'enviada' || h.estado === 'cancelada'
    linhas.push(
      `  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (${uuidDe(c.id)}, ${lit(h.estado)}, ${lit(h.nota ?? null)}, ${lit(doAutor ? autorPedido : 'lar')}, ${doAutor ? autor : autorLar}, ${rel(h.data, agora)});`,
    )
  }
  return linhas
}

function linhaCaso(k: Caso, agora: number, varDe: Map<string, string>): string {
  if (!k.consentimento) throw new Error(`caso ${k.id}: sem consentimento não pode existir na BD`)
  const v = [
    uuidDe(k.id), varDe.get(k.profissionalId) ?? 'null', uuidDe(k.perfilId), lit(k.referencia ?? null), diaRel(k.altaPrevista, agora),
    rel(k.criadoEm, agora), lit(k.estado), rel(k.criadoEm, agora), rel(k.atualizadoEm, agora),
  ]
  return `  (${v.join(', ')})`
}

/**
 * Texto da notificação. Se mencionar uma data do pedido (visita, alta prevista ou entrada, escrita
 * como no protótipo), a data é recalculada no SQL (private.data_extenso) para acompanhar as datas
 * relativas (current_date ± N) do pedido.
 */
function textoNotificacao(n: Notificacao, agora: number, porId: Map<string, Candidatura>): string {
  const c = n.candidaturaId ? porId.get(n.candidaturaId) : undefined
  for (const ymd of [c?.visita?.data, c?.encaminhamento?.altaPrevista, c?.entrada?.data]) {
    if (!ymd) continue
    const escrita = diaPorExtenso(ymd)
    const i = n.texto.indexOf(escrita)
    if (i >= 0) {
      return `${lit(n.texto.slice(0, i))} || private.data_extenso(${diaRel(ymd, agora)}) || ${lit(n.texto.slice(i + escrita.length))}`
    }
  }
  return lit(n.texto)
}

/**
 * Rota da notificação. As que terminam no id de um pedido ou de um caso do protótipo
 * ('/gestao/pedidos?pedido=c-pro-1', '/casos/caso-1') passam a usar o uuid desse registo na BD.
 */
function linkNotificacao(link: string | undefined, ids: Set<string>): string {
  if (!link) return 'null'
  const m = /^(.*[=/])([^=/?&#]+)$/.exec(link)
  const id = m ? decodeURIComponent(m[2]!) : ''
  return m && ids.has(id) ? `${lit(m[1])} || ${uuidDe(id)}::text` : lit(link)
}

function linhaNotificacao(n: Notificacao, agora: number, userVar: string, porId: Map<string, Candidatura>, ids: Set<string>): string {
  const cand = n.candidaturaId && porId.has(n.candidaturaId) ? uuidDe(n.candidaturaId) : 'null'
  const v = [userVar, lit(n.tipo), lit(n.titulo), textoNotificacao(n, agora, porId), lit(n.larId ?? null), cand, linkNotificacao(n.link, ids), lit(n.lida), rel(n.criadaEm, agora)]
  return `  (${v.join(', ')})`
}

/**
 * Liga as contas de demonstração (criadas antes pela Auth Admin API) aos dados de demonstração:
 * a gestora fica dona de DEMO_LAR_ID; Ana, as famílias fictícias e a assistente social recebem os
 * perfis, casos, pedidos (com encaminhamentos e entradas), histórico, favoritos e notificações do
 * protótipo; a avaliação verificada fica ligada ao pedido que lhe dá direito — o painel do lar fica
 * igual ao modo demonstração.
 */
export function gerarDemoSql(agora = AGORA_SEED, db: DB = createSeed(agora)): string {
  const lar = db.lares.find((l) => l.id === DEMO_LAR_ID)
  const familia = db.users.find((u) => u.id === DEMO_FAMILIA_ID)
  const gestora = db.users.find((u) => u.id === DEMO_LAR_USER_ID)
  if (!lar || !familia || !gestora) throw new Error('seed sem lar/contas de demonstração')

  const varDe = new Map(db.users.map((u) => [u.id, variavelConta(u)]))
  if (new Set(varDe.values()).size !== varDe.size) throw new Error('variáveis de conta repetidas')
  const contas = contasDemo(db)

  const porId = new Map(db.candidaturas.map((c) => [c.id, c]))
  const porLar = new Map(db.lares.map((l) => [l.id, l]))
  const idsLigaveis = new Set([...porId.keys(), ...db.casos.map((k) => k.id)])
  for (const c of db.candidaturas) if (!varDe.has(c.userId)) throw new Error(`candidatura ${c.id} de conta desconhecida`)
  for (const k of db.casos) {
    if (!varDe.has(k.profissionalId)) throw new Error(`caso ${k.id} de conta desconhecida`)
    if (!db.perfis.some((p) => p.id === k.perfilId && p.userId === k.profissionalId)) throw new Error(`caso ${k.id}: perfil em falta`)
  }
  // avaliações verificadas (id r-<pedido>, como avaliarLar): ligadas ao pedido e à conta que o fez
  const avaliacoesLigadas = db.lares.flatMap((l) =>
    l.reviews
      .filter((r) => r.id.startsWith('r-') && porId.has(r.id.slice(2)))
      .map((r) => {
        const c = porId.get(r.id.slice(2))!
        if (c.larId !== l.id || !c.entrada?.confirmadaFamiliaEm || !r.verificada) {
          throw new Error(`avaliação ${r.id}: só um pedido com a entrada confirmada pela família dá uma avaliação verificada`)
        }
        return { l, r, c }
      }),
  )
  for (const n of db.notificacoes) {
    if (!varDe.has(n.userId)) throw new Error(`notificação ${n.id} de conta desconhecida`)
    if (n.candidaturaId && !porId.has(n.candidaturaId)) throw new Error(`notificação ${n.id}: candidatura em falta`)
  }
  const online = db.candidaturas.filter((c) => c.larId === DEMO_LAR_ID && (c.estado === 'lista_espera' || c.estado === 'vaga_proposta')).length
  if (lar.listaEspera < online) throw new Error('lista de espera do lar de demonstração menor do que as inscrições online')

  const out: string[] = [
    '-- =====================================================================================',
    '-- EncontraLar — ligar as contas de demonstração aos dados de demonstração. FICHEIRO GERADO.',
    '-- Origem: src/data/seed.ts via scripts/gerar-seed-sql.ts → `npm run db:seed-sql`.',
    '--',
    '-- SÓ PARA BASES DE DEMONSTRAÇÃO (local, ramo do Supabase ou projeto à parte) — NUNCA em produção:',
    '-- as contas lar@ e familia@ têm palavra-passe pública (mostrada no ecrã de entrada).',
    '--',
    '-- Pré-requisitos:',
    '--   1. migrações aplicadas e supabase/seed.sql carregado;',
    `--   2. as ${contas.length} contas de supabase/demo/contas-demo.json criadas pela Auth Admin API`,
    '--      (scripts/criar-contas-demo.mjs — NUNCA por SQL em auth.users), com o e-mail confirmado e o',
    '--      papel em app_metadata. Uma conta registada por outra pessoa com o mesmo e-mail não tem',
    '--      app_metadata.role e é recusada: o script não entrega a ficha a quem só conhece o e-mail.',
    '-- Corre uma única vez (sai sem fazer nada se já tiver sido aplicado). Executar como postgres.',
    '-- =====================================================================================',
    '',
    'do $demo$',
    'declare',
    ...db.users.map((u) => `  ${varDe.get(u.id)} uuid;`),
    '  v_invalidas text;',
    'begin',
    `  if not exists (select 1 from public.instituicoes where id = ${lit(DEMO_LAR_ID)} and demonstracao) then`,
    `    raise exception 'Carregue primeiro supabase/seed.sql: a ficha de demonstração ${DEMO_LAR_ID} não existe.';`,
    '  end if;',
    '',
    '  -- contas: e-mail confirmado e papel definido pelo administrador (app_metadata), nunca só o e-mail',
    "  select string_agg(c.email || ' (' || c.role || ')', ', ' order by c.email) into v_invalidas",
    '    from (values',
    contas.map((c) => `      (${lit(c.email)}, ${lit(c.role)})`).join(',\n'),
    '    ) as c (email, role)',
    '   where not exists (',
    '     select 1 from auth.users u',
    "      where lower(u.email) = c.email and u.raw_app_meta_data ->> 'role' = c.role and u.email_confirmed_at is not null",
    '   );',
    '  if v_invalidas is not null then',
    "    raise exception 'Contas de demonstração em falta ou inválidas (e-mail por confirmar ou sem app_metadata.role): %. Crie-as com scripts/criar-contas-demo.mjs — ver docs/SUPABASE.md.', v_invalidas;",
    '  end if;',
    ...db.users.map((u) => `  ${varDe.get(u.id)} := (select id from auth.users where lower(email) = ${lit(u.email.toLowerCase())});`),
    '',
    `  if exists (select 1 from public.instituicoes where id = ${lit(DEMO_LAR_ID)} and owner_id is not null and owner_id <> v_lar) then`,
    `    raise exception 'A ficha ${DEMO_LAR_ID} já tem outro gestor — nada foi alterado.';`,
    '  end if;',
    `  if exists (select 1 from public.perfis_cuidados where id = ${uuidDe(db.perfis[0]!.id)}) then`,
    "    raise notice 'Dados de demonstração já ligados — nada a fazer.';",
    '    return;',
    '  end if;',
    '',
    '  -- contas de demonstração: só interagem com fichas de demonstração (o papel já veio do app_metadata)',
    ...db.users.map(
      (u) =>
        `  update public.perfis_utilizador set demonstracao = true, nome = ${lit(u.nome)}, telefone = ${lit(u.telefone ?? null)}, organizacao = ${u.organizacao ? jsonb(u.organizacao) : 'null'} where id = ${varDe.get(u.id)};`,
    ),
    '',
    '  -- a gestora passa a ser dona do lar de demonstração; a lista de espera "offline" desconta',
    '  -- as inscrições que agora existem na plataforma',
    `  update public.instituicoes set owner_id = v_lar, lista_espera_offline = ${lar.listaEspera - online} where id = ${lit(DEMO_LAR_ID)};`,
    '',
    '  -- perfis de cuidados (dados de saúde FICTÍCIOS)',
    '  insert into public.perfis_cuidados (id, user_id, nome, idade, relacao, genero, grau, necessidades, preferencias, quarto,',
    '    local_label, local_lat, local_lng, raio_km, orcamento_max, urgencia, precisa_acordo_ss, notas, created_at, updated_at)',
    '  values',
    db.perfis.map((p) => `  (${linhaPerfil(p, agora, varDe.get(p.userId)!)})`).join(',\n') + ';',
    '',
    '  -- casos da assistente social (consentimento registado na criação do caso)',
    '  insert into public.casos (id, profissional_id, perfil_id, referencia, alta_prevista, consentimento_em, estado, created_at, updated_at)',
    '  values',
    db.casos.map((k) => linhaCaso(k, agora, varDe)).join(',\n') + ';',
    '',
    '  -- candidaturas (com consentimento registado na data de envio), encaminhamentos, entradas e histórico',
  ]
  for (const c of db.candidaturas) out.push(...blocoCandidatura(c, agora, varDe, porLar))
  out.push(
    '',
    '  -- avaliação verificada: a importada pelo seed.sql passa a estar ligada à conta e ao pedido com a',
    '  -- entrada confirmada (sem mexer nos agregados, que o seed já traz)',
    ...avaliacoesLigadas.map(
      ({ l, r, c }) =>
        `  update public.avaliacoes set user_id = ${varDe.get(c.userId)}, candidatura_id = ${uuidDe(c.id)} where instituicao_id = ${lit(l.id)} and user_id is null and autor = ${lit(r.autor)} and texto = ${lit(r.texto)};`,
    ),
    '',
    '  -- favoritos com alerta de vaga',
    '  insert into public.favoritos (user_id, instituicao_id, alerta, created_at) values',
    db.favoritos.map((f) => `  (${varDe.get(f.userId)}, ${lit(f.larId)}, ${lit(f.alerta)}, ${rel(f.criadoEm, agora)})`).join(',\n'),
    '  on conflict do nothing;',
    '',
    '  -- notificações de exemplo',
    '  insert into public.notificacoes (user_id, tipo, titulo, texto, instituicao_id, candidatura_id, link, lida, created_at) values',
    db.notificacoes.map((n) => linhaNotificacao(n, agora, varDe.get(n.userId)!, porId, idsLigaveis)).join(',\n') + ';',
    'end;',
    '$demo$;',
    '',
  )
  return out.join('\n')
}
