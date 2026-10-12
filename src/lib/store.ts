/**
 * "Base de dados" do protótipo: vive no localStorage do navegador e sincroniza entre separadores
 * (abra o painel da família e o painel do lar em dois separadores para ver as notificações em direto).
 *
 * Numa versão de produção isto é substituído por uma API + base de dados com autenticação real.
 */
import { useMemo, useSyncExternalStore } from 'react'
import type {
  Candidatura,
  DB,
  EstadoCandidatura,
  Favorito,
  Lar,
  Natureza,
  Notificacao,
  PerfilIdoso,
  Role,
  TipoQuarto,
  TipoResposta,
  User,
} from '@/types'
import { createSeed, DEMO_FAMILIA_EMAIL, DEMO_LAR_EMAIL, DEMO_PASSWORD, SEED_VERSION } from '@/data/seed'
import { LOCALIDADES, LUGARES } from '@/data/localidades'
import { hashPassword } from './hash'
import { uid } from './random'
import { ESTADO_CANDIDATURA_LABEL } from './labels'
import { diaPorExtenso, horaPt } from './format'
import { aoLar, doLar, larPlural, maiuscula, noLar, oLar } from './artigos'

const DB_KEY = 'encontralar:db'
const SESSION_KEY = 'encontralar:sessao'

// ————————————————————————————————————————— persistência

function safeGet(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key)
  } catch {
    return null
  }
}
function safeSet(storage: () => Storage, key: string, value: string | null) {
  try {
    if (value == null) storage().removeItem(key)
    else storage().setItem(key, value)
  } catch {
    /* modo privado / quota — o protótipo continua a funcionar em memória */
  }
}

/** Os dados de demonstração "envelhecem": vagas atualizadas "há 10 dias", visitas no passado. */
const IDADE_MAX_SEED_MS = 12 * 3_600_000

/** Confirma a forma dos dados guardados (um campo em falta faria a app rebentar logo no cabeçalho). */
function dbValida(d: unknown): d is DB {
  const x = d as Partial<DB> | null
  return (
    !!x &&
    x.version === SEED_VERSION &&
    Array.isArray(x.users) &&
    Array.isArray(x.lares) &&
    Array.isArray(x.perfis) &&
    Array.isArray(x.candidaturas) &&
    Array.isArray(x.favoritos) &&
    Array.isArray(x.notificacoes) &&
    x.lares.every((l) => !!l && Array.isArray(l.quartos) && Array.isArray(l.historicoSaidas))
  )
}

/**
 * Junta a um seed acabado de gerar os registos criados neste navegador (contas, instituições,
 * perfis, pedidos, notificações e favoritos que não fazem parte do seed). As alterações feitas a
 * registos do seed perdem-se, como em "Repor dados"; os ids do seed são estáveis (gerador determinístico).
 */
export function rebaseDemo(antigo: DB, fresco: DB = createSeed()): DB {
  const juntar = <T extends { id: string }>(velhos: T[], novos: T[]) => {
    const ids = new Set(novos.map((x) => x.id))
    return [...novos, ...velhos.filter((x) => x && !ids.has(x.id))]
  }
  const chave = (f: Favorito) => `${f.userId}|${f.larId}`
  const favSeed = new Set(fresco.favoritos.map(chave))
  return {
    ...fresco,
    users: juntar(antigo.users, fresco.users),
    lares: juntar(antigo.lares, fresco.lares),
    perfis: juntar(antigo.perfis, fresco.perfis),
    candidaturas: juntar(antigo.candidaturas, fresco.candidaturas),
    notificacoes: juntar(antigo.notificacoes, fresco.notificacoes),
    favoritos: [...fresco.favoritos, ...antigo.favoritos.filter((f) => f && !favSeed.has(chave(f)))],
  }
}

/**
 * Lê a base de dados guardada. Devolve um seed novo se não houver dados válidos, e "refresca" o seed
 * (mantendo o que o visitante criou) quando tem mais de 12 horas.
 */
export function lerDB(raw: string | null, agora = Date.now()): { db: DB; mudou: boolean } {
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (dbValida(parsed)) {
        const idade = agora - Date.parse(parsed.seededAt)
        if (idade >= 0 && idade <= IDADE_MAX_SEED_MS) return { db: parsed, mudou: false }
        return { db: rebaseDemo(parsed, createSeed(agora)), mudou: true }
      }
    } catch {
      /* dados corrompidos → novo seed */
    }
  }
  return { db: createSeed(agora), mudou: true }
}

function load(): DB {
  const { db: lido, mudou } = lerDB(safeGet(() => localStorage, DB_KEY))
  if (mudou) safeSet(() => localStorage, DB_KEY, JSON.stringify(lido))
  return lido
}

let db: DB = load()
let sessionUserId: string | null = safeGet(() => sessionStorage, SESSION_KEY) ?? safeGet(() => localStorage, SESSION_KEY)
const listeners = new Set<() => void>()

function emit() {
  for (const l of listeners) l()
}

function commit(next: DB) {
  db = next
  safeSet(() => localStorage, DB_KEY, JSON.stringify(db))
  emit()
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === DB_KEY && e.newValue) {
      try {
        const parsed: unknown = JSON.parse(e.newValue)
        if (dbValida(parsed)) {
          db = parsed
          emit()
        }
      } catch {
        /* ignorar */
      }
    }
  })
}

const nowIso = () => new Date().toISOString()

/** Notificações da instituição abrem o pedido em causa, não o resumo genérico. */
const linkPedido = (candidaturaId: string) => `/gestao/pedidos?pedido=${encodeURIComponent(candidaturaId)}`

// ————————————————————————————————————————— hooks de leitura

export function useDB(): DB {
  return useSyncExternalStore(subscribe, () => db, () => db)
}

export function useLares(): Lar[] {
  return useDB().lares
}

export function useLar(id: string | undefined): Lar | undefined {
  const lares = useLares()
  return useMemo(() => (id ? lares.find((l) => l.id === id) : undefined), [lares, id])
}

/** Utilizador com sessão iniciada neste separador (ou null). */
export function useCurrentUser(): User | null {
  const d = useDB()
  const id = useSyncExternalStore(subscribe, () => sessionUserId, () => sessionUserId)
  return useMemo(() => (id ? (d.users.find((u) => u.id === id) ?? null) : null), [d.users, id])
}

export function useFavoritos(): Favorito[] {
  const d = useDB()
  const user = useCurrentUser()
  return useMemo(() => (user ? d.favoritos.filter((f) => f.userId === user.id) : []), [d.favoritos, user])
}

export function useFavorito(larId: string): Favorito | undefined {
  const favs = useFavoritos()
  return useMemo(() => favs.find((f) => f.larId === larId), [favs, larId])
}

export function useNotificacoes(): Notificacao[] {
  const d = useDB()
  const user = useCurrentUser()
  return useMemo(
    () =>
      user
        ? d.notificacoes.filter((n) => n.userId === user.id).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm))
        : [],
    [d.notificacoes, user],
  )
}

export function usePerfis(): PerfilIdoso[] {
  const d = useDB()
  const user = useCurrentUser()
  return useMemo(() => (user ? d.perfis.filter((p) => p.userId === user.id) : []), [d.perfis, user])
}

/** Candidaturas feitas pelo utilizador atual (família). */
export function useMinhasCandidaturas(): Candidatura[] {
  const d = useDB()
  const user = useCurrentUser()
  return useMemo(
    () =>
      user
        ? d.candidaturas.filter((c) => c.userId === user.id).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))
        : [],
    [d.candidaturas, user],
  )
}

/** Candidaturas recebidas por uma instituição. */
export function useCandidaturasDoLar(larId: string | undefined): Candidatura[] {
  const d = useDB()
  return useMemo(
    () => (larId ? d.candidaturas.filter((c) => c.larId === larId).sort((a, b) => b.criadaEm.localeCompare(a.criadaEm)) : []),
    [d.candidaturas, larId],
  )
}

/** Instituição gerida pelo utilizador atual (role 'lar'). */
export function useMeuLar(): Lar | undefined {
  const user = useCurrentUser()
  return useLar(user?.role === 'lar' ? user.larId : undefined)
}

export const getDB = () => db
export const getCurrentUser = () => (sessionUserId ? (db.users.find((u) => u.id === sessionUserId) ?? null) : null)

// ————————————————————————————————————————— autenticação

function setSession(userId: string | null) {
  sessionUserId = userId
  safeSet(() => sessionStorage, SESSION_KEY, userId)
  safeSet(() => localStorage, SESSION_KEY, userId)
  emit()
}

export type AuthResult = { ok: true; user: User } | { ok: false; error: string }

export function login(email: string, password: string): AuthResult {
  const e = email.trim().toLowerCase()
  const user = db.users.find((u) => u.email.toLowerCase() === e)
  if (!user || user.passwordHash !== hashPassword(password, e)) {
    return { ok: false, error: 'O email ou a palavra-passe não estão corretos.' }
  }
  setSession(user.id)
  return { ok: true, user }
}

export function loginDemo(role: Role): AuthResult {
  return login(role === 'familia' ? DEMO_FAMILIA_EMAIL : DEMO_LAR_EMAIL, DEMO_PASSWORD)
}

export function logout() {
  setSession(null)
}

export interface RegisterInput {
  role: Role
  nome: string
  email: string
  password: string
  telefone?: string
  instituicao?: {
    nome: string
    tipo: TipoResposta
    natureza: Natureza
    /** label de LUGARES (ex.: "Braga", "Lisboa — Alvalade") */
    lugar: string
    morada?: string
    capacidade: number
    licenca: string
    precoDesde: number
  }
}

const DISTRITO_REGIAO = Object.fromEntries(LOCALIDADES.map((l) => [l.distrito, l.regiao])) as Record<Lar['distrito'], Lar['regiao']>

export function register(input: RegisterInput): AuthResult {
  const email = input.email.trim().toLowerCase()
  if (!input.nome.trim()) return { ok: false, error: 'Indique o seu nome.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'O email não parece válido.' }
  if (input.password.length < 8) return { ok: false, error: 'A palavra-passe deve ter pelo menos 8 caracteres.' }
  if (db.users.some((u) => u.email.toLowerCase() === email)) {
    return { ok: false, error: 'Já existe uma conta com este email. Experimente entrar.' }
  }

  const user: User = {
    id: uid('u'),
    role: input.role,
    nome: input.nome.trim(),
    email,
    passwordHash: hashPassword(input.password, email),
    telefone: input.telefone?.trim() || undefined,
    criadoEm: nowIso(),
  }

  let lares = db.lares
  if (input.role === 'lar') {
    const inst = input.instituicao
    if (!inst || !inst.nome.trim()) return { ok: false, error: 'Indique o nome da instituição.' }
    const lugar = LUGARES.find((l) => l.label === inst.lugar) ?? LUGARES[0]!
    const loc = LOCALIDADES.find((l) => l.concelho === lugar.label || l.nome === lugar.label)
    const capacidade = Math.max(1, Math.round(inst.capacidade || 1))
    const preco = Math.max(0, Math.round(inst.precoDesde || 0))
    const lar: Lar = {
      id: uid('lar'),
      nome: inst.nome.trim(),
      tipo: inst.tipo,
      natureza: inst.natureza,
      resumo: '',
      descricao: '',
      morada: inst.morada?.trim() || '',
      codigoPostal: loc ? `${loc.cp}-000` : '',
      localidade: lugar.label.split(' — ')[0]!,
      concelho: loc?.concelho ?? lugar.label.split(' — ')[0]!,
      distrito: lugar.distrito,
      regiao: DISTRITO_REGIAO[lugar.distrito] ?? 'Norte',
      lat: lugar.lat + 0.004,
      lng: lugar.lng + 0.004,
      telefone: user.telefone ?? '',
      email,
      capacidade,
      quartos: [{ tipo: 'individual', total: capacidade, livres: 0, precoMin: preco, precoMax: Math.round(preco * 1.2) }],
      listaEspera: 0,
      estadiaMediaMeses: 36,
      historicoSaidas: [],
      mensalidadeMin: preco,
      mensalidadeMax: Math.round(preco * 1.2),
      acordoSS: false,
      incluido: ['Alojamento e todas as refeições', 'Higiene pessoal e apoio diário', 'Tratamento de roupa'],
      extras: [],
      graus: inst.tipo === 'residencia' ? ['autonomo', 'ligeira'] : ['ligeira', 'moderada'],
      cuidados: [],
      comodidades: [],
      equipa: { cuidadoresPor10: 0, enfermeiros: 0, medicoHorasSemana: 0 },
      verificacao: { estado: 'pendente', licenca: inst.licenca.trim() },
      avaliacao: 0,
      numAvaliacoes: 0,
      reviews: [],
      // o registo não pergunta o ano de fundação: 0 = por indicar (a ficha esconde-o)
      fundacao: 0,
      atualizadoEm: nowIso(),
      capa: { hue: Math.floor(Math.random() * 360), variante: Math.floor(Math.random() * 4) },
      ownerId: user.id,
      visualizacoes30d: 0,
    }
    user.larId = lar.id
    lares = [...lares, lar]
  }

  commit({
    ...db,
    users: [...db.users, user],
    lares,
    notificacoes: [
      ...db.notificacoes,
      {
        id: uid('n'),
        userId: user.id,
        tipo: 'sistema',
        titulo: 'Bem-vindo(a) ao EncontraLar',
        texto:
          input.role === 'lar'
            ? 'A sua ficha foi criada e está pendente de verificação. Complete a informação e mantenha as vagas atualizadas.'
            : 'Crie o perfil da pessoa de quem cuida para receber sugestões compatíveis e alertas de vaga.',
        link: input.role === 'lar' ? '/gestao' : '/familia',
        lida: false,
        criadaEm: nowIso(),
      },
    ],
  })
  setSession(user.id)
  return { ok: true, user }
}

export function updateUser(patch: Partial<Pick<User, 'nome' | 'telefone'>>) {
  const user = getCurrentUser()
  if (!user) return
  commit({ ...db, users: db.users.map((u) => (u.id === user.id ? { ...u, ...patch } : u)) })
}

// ————————————————————————————————————————— notificações

function novaNotificacao(n: Omit<Notificacao, 'id' | 'lida' | 'criadaEm'>): Notificacao {
  return { ...n, id: uid('n'), lida: false, criadaEm: nowIso() }
}

export function marcarNotificacaoLida(id: string) {
  commit({ ...db, notificacoes: db.notificacoes.map((n) => (n.id === id ? { ...n, lida: true } : n)) })
}

export function marcarTodasLidas() {
  const user = getCurrentUser()
  if (!user) return
  commit({ ...db, notificacoes: db.notificacoes.map((n) => (n.userId === user.id && !n.lida ? { ...n, lida: true } : n)) })
}

// ————————————————————————————————————————— favoritos e alertas

/** Devolve o novo estado (true = guardado). Requer sessão de família. */
export function toggleFavorito(larId: string): boolean {
  const user = getCurrentUser()
  if (!user) return false
  const existe = db.favoritos.some((f) => f.userId === user.id && f.larId === larId)
  commit({
    ...db,
    favoritos: existe
      ? db.favoritos.filter((f) => !(f.userId === user.id && f.larId === larId))
      : [...db.favoritos, { userId: user.id, larId, alerta: true, criadoEm: nowIso() }],
  })
  return !existe
}

export function setAlerta(larId: string, alerta: boolean) {
  const user = getCurrentUser()
  if (!user) return
  const existe = db.favoritos.some((f) => f.userId === user.id && f.larId === larId)
  commit({
    ...db,
    favoritos: existe
      ? db.favoritos.map((f) => (f.userId === user.id && f.larId === larId ? { ...f, alerta } : f))
      : [...db.favoritos, { userId: user.id, larId, alerta, criadoEm: nowIso() }],
  })
}

// ————————————————————————————————————————— perfis

export type PerfilInput = Omit<PerfilIdoso, 'id' | 'userId' | 'criadoEm' | 'atualizadoEm'> & { id?: string }

export function savePerfil(input: PerfilInput): PerfilIdoso | null {
  const user = getCurrentUser()
  if (!user) return null
  const existente = input.id ? db.perfis.find((p) => p.id === input.id && p.userId === user.id) : undefined
  const perfil: PerfilIdoso = existente
    ? { ...existente, ...input, id: existente.id, userId: user.id, atualizadoEm: nowIso() }
    : { ...input, id: uid('p'), userId: user.id, criadoEm: nowIso(), atualizadoEm: nowIso() }
  commit({
    ...db,
    perfis: existente ? db.perfis.map((p) => (p.id === perfil.id ? perfil : p)) : [...db.perfis, perfil],
  })
  return perfil
}

export function deletePerfil(id: string) {
  const user = getCurrentUser()
  if (!user) return
  commit({ ...db, perfis: db.perfis.filter((p) => !(p.id === id && p.userId === user.id)) })
}

// ————————————————————————————————————————— candidaturas (lado da família)

function patchLar(lares: Lar[], larId: string, fn: (l: Lar) => Lar): Lar[] {
  return lares.map((l) => (l.id === larId ? fn(l) : l))
}

/** Retira uma candidatura da lista de espera, encurtando a fila. */
function sairDaLista(state: DB, c: Candidatura): DB {
  if (c.posicao == null || (c.estado !== 'lista_espera' && c.estado !== 'vaga_proposta')) return state
  const p = c.posicao
  return {
    ...state,
    lares: patchLar(state.lares, c.larId, (l) => ({ ...l, listaEspera: Math.max(0, l.listaEspera - 1) })),
    candidaturas: state.candidaturas.map((x) =>
      x.id !== c.id && x.larId === c.larId && x.posicao != null && x.posicao > p &&
      (x.estado === 'lista_espera' || x.estado === 'vaga_proposta')
        ? { ...x, posicao: x.posicao - 1 }
        : x,
    ),
  }
}

export interface CandidatarInput {
  larId: string
  perfilId: string
  mensagem?: string
  visita?: { data: string; hora: string }
}

export function candidatar(input: CandidatarInput): Candidatura | null {
  const user = getCurrentUser()
  const perfil = db.perfis.find((p) => p.id === input.perfilId)
  const lar = db.lares.find((l) => l.id === input.larId)
  if (!user || !perfil || !lar) return null
  const ativa = db.candidaturas.find(
    (c) => c.userId === user.id && c.larId === lar.id && c.perfilId === perfil.id && !['cancelada', 'recusada'].includes(c.estado),
  )
  if (ativa) return ativa
  const agora = nowIso()
  const c: Candidatura = {
    id: uid('c'),
    larId: lar.id,
    userId: user.id,
    perfilId: perfil.id,
    perfil,
    contacto: { nome: user.nome, email: user.email, telefone: user.telefone },
    estado: 'enviada',
    mensagem: input.mensagem?.trim() || undefined,
    visita: input.visita ? { ...input.visita, estado: 'pedida' } : undefined,
    criadaEm: agora,
    atualizadaEm: agora,
    historico: [{ data: agora, estado: 'enviada' }],
  }
  const notifs: Notificacao[] = []
  if (lar.ownerId) {
    notifs.push(
      novaNotificacao({
        userId: lar.ownerId,
        tipo: 'candidatura',
        titulo: 'Novo pedido de vaga',
        texto: `${user.nome} enviou um pedido para ${perfil.nome} (${perfil.idade} anos).${input.visita ? ' Pediu também uma visita.' : ''}`,
        candidaturaId: c.id,
        larId: lar.id,
        link: linkPedido(c.id),
      }),
    )
  }
  commit({ ...db, candidaturas: [...db.candidaturas, c], notificacoes: [...db.notificacoes, ...notifs] })
  return c
}

export function pedirVisita(candidaturaId: string, data: string, hora: string) {
  const c = db.candidaturas.find((x) => x.id === candidaturaId)
  if (!c) return
  const lar = db.lares.find((l) => l.id === c.larId)
  const notifs = lar?.ownerId
    ? [
        novaNotificacao({
          userId: lar.ownerId,
          tipo: 'visita',
          titulo: 'Pedido de visita',
          texto: `${c.contacto.nome} pediu uma visita para ${diaPorExtenso(data)}, às ${horaPt(hora)}.`,
          candidaturaId: c.id,
          larId: c.larId,
          link: linkPedido(c.id),
        }),
      ]
    : []
  commit({
    ...db,
    candidaturas: db.candidaturas.map((x) =>
      x.id === candidaturaId ? { ...x, visita: { data, hora, estado: 'pedida' }, atualizadaEm: nowIso() } : x,
    ),
    notificacoes: [...db.notificacoes, ...notifs],
  })
}

export function cancelarCandidatura(id: string) {
  const c = db.candidaturas.find((x) => x.id === id)
  if (!c) return
  let state = sairDaLista(db, c)
  const agora = nowIso()
  state = {
    ...state,
    candidaturas: state.candidaturas.map((x) =>
      x.id === id
        ? { ...x, estado: 'cancelada', posicao: undefined, atualizadaEm: agora, historico: [...x.historico, { data: agora, estado: 'cancelada' }] }
        : x,
    ),
  }
  const lar = db.lares.find((l) => l.id === c.larId)
  if (lar?.ownerId) {
    state.notificacoes = [
      ...state.notificacoes,
      novaNotificacao({
        userId: lar.ownerId,
        tipo: 'candidatura',
        titulo: 'Pedido cancelado',
        texto: `${c.contacto.nome} cancelou o pedido para ${c.perfil.nome}.`,
        candidaturaId: c.id,
        larId: c.larId,
        link: linkPedido(c.id),
      }),
    ]
  }
  commit(state)
}

/** A família responde a uma vaga proposta. Recusar mantém a posição na lista. */
export function responderVaga(id: string, aceitar: boolean) {
  const c = db.candidaturas.find((x) => x.id === id)
  if (!c || c.estado !== 'vaga_proposta') return
  const agora = nowIso()
  let state: DB = db
  if (aceitar) {
    state = sairDaLista(state, c)
    state = {
      ...state,
      lares: patchLar(state.lares, c.larId, (l) => {
        const pref = c.perfil.quarto !== 'indiferente' ? c.perfil.quarto : null
        const alvo = l.quartos.find((q) => q.tipo === pref && q.livres > 0) ?? l.quartos.find((q) => q.livres > 0)
        return alvo
          ? { ...l, quartos: l.quartos.map((q) => (q === alvo ? { ...q, livres: q.livres - 1 } : q)), atualizadoEm: agora }
          : l
      }),
    }
  }
  const novoEstado: EstadoCandidatura = aceitar ? 'aceite' : 'lista_espera'
  state = {
    ...state,
    candidaturas: state.candidaturas.map((x) =>
      x.id === id
        ? {
            ...x,
            estado: novoEstado,
            posicao: aceitar ? undefined : x.posicao,
            prazoResposta: undefined,
            atualizadaEm: agora,
            historico: [...x.historico, { data: agora, estado: novoEstado, nota: aceitar ? 'Vaga aceite pela família.' : 'A família recusou esta vaga e mantém-se na lista.' }],
          }
        : x,
    ),
  }
  const lar = db.lares.find((l) => l.id === c.larId)
  if (lar?.ownerId) {
    state.notificacoes = [
      ...state.notificacoes,
      novaNotificacao({
        userId: lar.ownerId,
        tipo: 'candidatura',
        titulo: aceitar ? 'Vaga aceite' : 'Vaga recusada',
        texto: aceitar
          ? `${c.contacto.nome} aceitou a vaga para ${c.perfil.nome}. Combine a data de entrada.`
          : `${c.contacto.nome} recusou a vaga proposta para ${c.perfil.nome}. Pode propô-la à próxima pessoa da lista.`,
        candidaturaId: c.id,
        larId: c.larId,
        link: linkPedido(c.id),
      }),
    ]
  }
  commit(state)
}

// ————————————————————————————————————————— operações da instituição

export function atualizarLar(larId: string, patch: Partial<Omit<Lar, 'id' | 'ownerId'>>) {
  commit({
    ...db,
    lares: patchLar(db.lares, larId, (l) => {
      const next = { ...l, ...patch }
      if (patch.quartos) {
        const precos = next.quartos.flatMap((q) => [q.precoMin, q.precoMax])
        if (precos.length) {
          next.mensalidadeMin = Math.min(...precos)
          next.mensalidadeMax = Math.max(...precos)
        }
        next.capacidade = Math.max(next.capacidade, next.quartos.reduce((s, q) => s + q.total, 0))
        next.atualizadoEm = nowIso()
      }
      return next
    }),
  })
}

/** Confirma que a informação de vagas está correta (renova o selo de atualização). */
export function confirmarVagasAtualizadas(larId: string) {
  commit({ ...db, lares: patchLar(db.lares, larId, (l) => ({ ...l, atualizadoEm: nowIso() })) })
}

/** Notifica famílias que seguem a instituição e as que estão em lista de espera. Devolve nº de famílias avisadas. */
function avisarNovaVaga(state: DB, lar: Lar, tipo: TipoQuarto): { state: DB; avisadas: number } {
  const destinatarios = new Map<string, Notificacao>()
  const quarto = `quarto ${tipo === 'casal' ? 'de casal' : tipo}`
  for (const c of state.candidaturas) {
    if (c.larId === lar.id && c.estado === 'lista_espera') {
      destinatarios.set(
        c.userId,
        novaNotificacao({
          userId: c.userId,
          tipo: 'vaga',
          titulo: 'Abriu uma vaga onde está inscrito(a)',
          texto: `Abriu uma vaga ${noLar(lar.nome)} (${quarto}). A instituição contacta as famílias pela ordem da lista${c.posicao != null ? `: ${c.perfil.nome} está na posição ${c.posicao}` : ''}.`,
          larId: lar.id,
          candidaturaId: c.id,
          link: '/familia',
        }),
      )
    }
  }
  for (const f of state.favoritos) {
    if (f.larId === lar.id && f.alerta && f.userId !== lar.ownerId && !destinatarios.has(f.userId)) {
      destinatarios.set(
        f.userId,
        novaNotificacao({
          userId: f.userId,
          tipo: 'vaga',
          titulo: 'Nova vaga disponível',
          texto: `Há uma vaga livre ${noLar(lar.nome)} (${quarto}). Contacte a instituição se ainda tiver interesse.`,
          larId: lar.id,
          link: `/lar/${lar.id}`,
        }),
      )
    }
  }
  return { state: { ...state, notificacoes: [...state.notificacoes, ...destinatarios.values()] }, avisadas: destinatarios.size }
}

/** Define o nº de lugares livres de um tipo de quarto. Se aumentar, avisa as famílias. */
export function definirVagas(larId: string, tipo: TipoQuarto, livres: number): number {
  const lar = db.lares.find((l) => l.id === larId)
  const quarto = lar?.quartos.find((q) => q.tipo === tipo)
  if (!lar || !quarto) return 0
  const novo = Math.max(0, Math.min(quarto.total, Math.round(livres)))
  const agora = nowIso()
  const atualizado: Lar = {
    ...lar,
    quartos: lar.quartos.map((q) => (q.tipo === tipo ? { ...q, livres: novo } : q)),
    atualizadoEm: agora,
  }
  let state: DB = { ...db, lares: db.lares.map((l) => (l.id === larId ? atualizado : l)) }
  let avisadas = 0
  if (novo > quarto.livres) {
    const r = avisarNovaVaga(state, atualizado, tipo)
    state = r.state
    avisadas = r.avisadas
  }
  commit(state)
  return avisadas
}

/** Atalho: mais um lugar livre (saída de um residente). Devolve nº de famílias avisadas. */
export function registarVagaLibertada(larId: string, tipo: TipoQuarto): number {
  const lar = db.lares.find((l) => l.id === larId)
  const q = lar?.quartos.find((x) => x.tipo === tipo)
  if (!lar || !q || q.livres >= q.total) return 0
  // regista a saída no histórico do mês corrente (último elemento)
  const historicoSaidas = lar.historicoSaidas.length
    ? lar.historicoSaidas.map((v, i, arr) => (i === arr.length - 1 ? v + 1 : v))
    : Array.from({ length: 12 }, (_, i) => (i === 11 ? 1 : 0))
  commit({ ...db, lares: patchLar(db.lares, larId, (l) => ({ ...l, historicoSaidas })) })
  return definirVagas(larId, tipo, q.livres + 1)
}

/** Atalho: um lugar ocupado (entrada de um novo residente). */
export function registarEntrada(larId: string, tipo: TipoQuarto) {
  const lar = db.lares.find((l) => l.id === larId)
  const q = lar?.quartos.find((x) => x.tipo === tipo)
  if (!q || q.livres <= 0) return
  definirVagas(larId, tipo, q.livres - 1)
}

/** A instituição muda o estado de uma candidatura (com nota opcional para a família). */
export function atualizarCandidatura(id: string, estado: EstadoCandidatura, nota?: string) {
  const c = db.candidaturas.find((x) => x.id === id)
  if (!c || c.estado === estado) return
  const lar = db.lares.find((l) => l.id === c.larId)
  if (!lar) return
  const agora = nowIso()
  let state: DB = db
  let posicao = c.posicao

  const estavaNaLista = c.estado === 'lista_espera' || c.estado === 'vaga_proposta'
  const ficaNaLista = estado === 'lista_espera' || estado === 'vaga_proposta'
  if (!estavaNaLista && ficaNaLista) {
    posicao = lar.listaEspera + 1
    state = { ...state, lares: patchLar(state.lares, lar.id, (l) => ({ ...l, listaEspera: l.listaEspera + 1 })) }
  } else if (estavaNaLista && !ficaNaLista) {
    state = sairDaLista(state, c)
    posicao = undefined
  }

  if (estado === 'aceite') {
    state = {
      ...state,
      lares: patchLar(state.lares, lar.id, (l) => {
        const alvo = l.quartos.find((q) => q.tipo === c.perfil.quarto && q.livres > 0) ?? l.quartos.find((q) => q.livres > 0)
        return alvo ? { ...l, quartos: l.quartos.map((q) => (q === alvo ? { ...q, livres: q.livres - 1 } : q)), atualizadoEm: agora } : l
      }),
    }
  }

  const prazo = estado === 'vaga_proposta' ? new Date(Date.now() + 48 * 3_600_000).toISOString() : undefined
  state = {
    ...state,
    candidaturas: state.candidaturas.map((x) =>
      x.id === id
        ? {
            ...x,
            estado,
            posicao,
            prazoResposta: prazo,
            atualizadaEm: agora,
            historico: [...x.historico, { data: agora, estado, nota }],
          }
        : x,
    ),
  }

  const nome = c.perfil.nome
  const inscrito = c.perfil.genero === 'F' ? 'inscrita' : c.perfil.genero === 'M' ? 'inscrito' : 'inscrito(a)'
  const textos: Partial<Record<EstadoCandidatura, string>> = {
    em_analise: `O pedido para ${nome} está em análise ${noLar(lar.nome)}.`,
    lista_espera: `${nome} ficou ${inscrito} na lista de espera ${doLar(lar.nome)}${posicao != null ? ` (posição ${posicao})` : ''}.`,
    vaga_proposta: `Há uma vaga ${noLar(lar.nome)} para ${nome}. Responda nas próximas 48 horas.`,
    aceite: `A entrada de ${nome} ${noLar(lar.nome)} está confirmada.`,
    recusada: `${maiuscula(oLar(lar.nome))} não ${larPlural(lar.nome) ? 'têm' : 'tem'}, neste momento, condições para receber ${nome}.`,
  }
  state = {
    ...state,
    notificacoes: [
      ...state.notificacoes,
      novaNotificacao({
        userId: c.userId,
        tipo: estado === 'vaga_proposta' ? 'vaga' : 'candidatura',
        titulo: estado === 'vaga_proposta' ? 'Tem uma vaga proposta' : ESTADO_CANDIDATURA_LABEL[estado],
        texto: (textos[estado] ?? `O pedido para ${c.perfil.nome} foi atualizado.`) + (nota ? ` Nota: ${nota}` : ''),
        larId: lar.id,
        candidaturaId: c.id,
        link: '/familia',
      }),
    ],
  }
  commit(state)
}

export function confirmarVisita(id: string) {
  const c = db.candidaturas.find((x) => x.id === id)
  if (!c?.visita) return
  const lar = db.lares.find((l) => l.id === c.larId)
  commit({
    ...db,
    candidaturas: db.candidaturas.map((x) =>
      x.id === id && x.visita ? { ...x, visita: { ...x.visita, estado: 'confirmada' }, atualizadaEm: nowIso() } : x,
    ),
    notificacoes: [
      ...db.notificacoes,
      novaNotificacao({
        userId: c.userId,
        tipo: 'visita',
        titulo: 'Visita confirmada',
        texto: `A visita ${lar ? aoLar(lar.nome) : 'à instituição'} ficou confirmada para ${diaPorExtenso(c.visita.data)}, às ${horaPt(c.visita.hora)}.`,
        larId: c.larId,
        candidaturaId: c.id,
        link: '/familia',
      }),
    ],
  })
}

/**
 * Repõe os dados de demonstração (mantém a sessão se o utilizador ainda existir).
 * `contaRemovida` = a conta com sessão iniciada não fazia parte do exemplo e foi apagada.
 */
export function resetDemo(): { contaRemovida: boolean } {
  const seed = createSeed()
  commit(seed)
  const contaRemovida = !!sessionUserId && !seed.users.some((u) => u.id === sessionUserId)
  if (contaRemovida) setSession(null)
  return { contaRemovida }
}
