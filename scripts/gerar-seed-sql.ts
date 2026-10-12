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
import { createSeed, DEMO_FAMILIA_ID, DEMO_LAR_ID, DEMO_LAR_USER_ID, DEMO_PASSWORD } from '@/data/seed'
import type { Candidatura, DB, Lar, Notificacao, PerfilIdoso, User } from '@/types'

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
  'atualizado_em', 'capa', 'visualizacoes_30d',
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
    `-- ${lares.length} instituições, os seus quartos, 12 meses de saídas e avaliações.`,
    '-- As datas são relativas ao momento em que este ficheiro corre (now() − intervalo).',
    '-- Contas de utilizador NÃO são criadas aqui (no Supabase alojado criam-se pela Auth Admin API);',
    '-- todas as fichas ficam sem dono (owner_id null). Para ligar as contas de demonstração ao lar',
    `-- "${DEMO_LAR_ID}" corra depois supabase/demo/utilizadores-demo.sql (ver docs/SUPABASE.md).`,
    '-- Idempotente: pode ser executado mais do que uma vez.',
    '-- =====================================================================================',
    '',
  )

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

  return out.join('\n')
}

// ————————————————————————————————————————— contas de demonstração

/** Conta a criar pela Auth Admin API (scripts/criar-contas-demo.mjs lê supabase/demo/contas-demo.json). */
export interface ContaDemo {
  email: string
  role: User['role']
  nome: string
  telefone: string | null
  /** só as duas contas mostradas no login têm palavra-passe conhecida (pública); as outras são aleatórias */
  palavraPasse: string | null
}

/** Variável PL/pgSQL de cada conta do protótipo ('u-fam-0' → v_fam_0). */
function variavelConta(u: User): string {
  if (u.id === DEMO_LAR_USER_ID) return 'v_lar'
  if (u.id === DEMO_FAMILIA_ID) return 'v_familia'
  return `v_${u.id.replace(/^u-/, '').replace(/[^a-z0-9]+/g, '_')}`
}

export function contasDemo(db: DB = createSeed(AGORA_SEED)): ContaDemo[] {
  return db.users.map((u) => ({
    email: u.email.toLowerCase(),
    role: u.role,
    nome: u.nome,
    telefone: u.telefone ?? null,
    palavraPasse: u.demo ? DEMO_PASSWORD : null,
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

function blocoCandidatura(c: Candidatura, agora: number, varDe: Map<string, string>): string[] {
  const dias = c.visita ? Math.round((Date.parse(c.visita.data) - agora) / 86_400_000) : null
  const familia = varDe.get(c.userId)
  if (!familia) throw new Error(`candidatura ${c.id}: conta ${c.userId} sem variável`)
  // eventos do lar: autor = gestora, só no lar de demonstração (os outros não têm gestor)
  const autorLar = c.larId === DEMO_LAR_ID ? 'v_lar' : 'null'
  const linhas = [
    '  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,',
    '    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at)',
    `  select ${uuidDe(c.id)}, ${lit(c.larId)}, ${familia}, p.id, private.snapshot_perfil(p), ${jsonb(c.contacto)},`,
    `    ${lit(c.estado)}, ${lit(c.posicao ?? null)}, ${lit(c.mensagem ?? null)},`,
    `    ${dias == null ? 'null' : `current_date + ${dias}`}, ${lit(c.visita?.hora ?? null)}, ${lit(c.visita?.estado ?? null)},`,
    `    ${c.prazoResposta ? rel(c.prazoResposta, agora) : 'null'}, ${rel(c.criadaEm, agora)}, ${rel(c.criadaEm, agora)}, ${rel(c.atualizadaEm, agora)}`,
    `  from public.perfis_cuidados p where p.id = ${uuidDe(c.perfilId)};`,
  ]
  for (const h of c.historico) {
    const daFamilia = h.estado === 'enviada'
    linhas.push(
      `  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (${uuidDe(c.id)}, ${lit(h.estado)}, ${lit(h.nota ?? null)}, ${lit(daFamilia ? 'familia' : 'lar')}, ${daFamilia ? familia : autorLar}, ${rel(h.data, agora)});`,
    )
  }
  return linhas
}

const DATA_EXTENSO: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long' }

/**
 * Texto da notificação. Se mencionar a data de uma visita (escrita como no protótipo), a data é
 * recalculada no SQL (private.data_extenso) para acompanhar visita_data = current_date + N.
 */
function textoNotificacao(n: Notificacao, agora: number, porId: Map<string, Candidatura>): string {
  const c = n.candidaturaId ? porId.get(n.candidaturaId) : undefined
  if (c?.visita) {
    const escrita = new Date(c.visita.data).toLocaleDateString('pt-PT', DATA_EXTENSO)
    const i = n.texto.indexOf(escrita)
    if (i >= 0) {
      const dias = Math.round((Date.parse(c.visita.data) - agora) / 86_400_000)
      return `${lit(n.texto.slice(0, i))} || private.data_extenso(current_date + ${dias}) || ${lit(n.texto.slice(i + escrita.length))}`
    }
  }
  return lit(n.texto)
}

function linhaNotificacao(n: Notificacao, agora: number, userVar: string, porId: Map<string, Candidatura>): string {
  const cand = n.candidaturaId && porId.has(n.candidaturaId) ? uuidDe(n.candidaturaId) : 'null'
  const v = [userVar, lit(n.tipo), lit(n.titulo), textoNotificacao(n, agora, porId), lit(n.larId ?? null), cand, lit(n.link ?? null), lit(n.lida), rel(n.criadaEm, agora)]
  return `  (${v.join(', ')})`
}

/**
 * Liga as contas de demonstração (criadas antes pela Auth Admin API) aos dados de demonstração:
 * a gestora fica dona de DEMO_LAR_ID; Ana e as 6 famílias fictícias recebem os perfis, pedidos,
 * histórico, favoritos e notificações do protótipo — o painel do lar fica igual ao modo demonstração.
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
  for (const c of db.candidaturas) if (!varDe.has(c.userId)) throw new Error(`candidatura ${c.id} de conta desconhecida`)
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
        `  update public.perfis_utilizador set demonstracao = true, nome = ${lit(u.nome)}, telefone = ${lit(u.telefone ?? null)} where id = ${varDe.get(u.id)};`,
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
    '  -- candidaturas (com consentimento registado na data de envio) e histórico',
  ]
  for (const c of db.candidaturas) out.push(...blocoCandidatura(c, agora, varDe))
  out.push(
    '',
    '  -- favoritos com alerta de vaga',
    '  insert into public.favoritos (user_id, instituicao_id, alerta, created_at) values',
    db.favoritos.map((f) => `  (${varDe.get(f.userId)}, ${lit(f.larId)}, ${lit(f.alerta)}, ${rel(f.criadoEm, agora)})`).join(',\n'),
    '  on conflict do nothing;',
    '',
    '  -- notificações de exemplo',
    '  insert into public.notificacoes (user_id, tipo, titulo, texto, instituicao_id, candidatura_id, link, lida, created_at) values',
    db.notificacoes.map((n) => linhaNotificacao(n, agora, varDe.get(n.userId)!, porId)).join(',\n') + ';',
    'end;',
    '$demo$;',
    '',
  )
  return out.join('\n')
}
