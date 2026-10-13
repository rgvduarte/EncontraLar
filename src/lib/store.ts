/**
 * "Base de dados" do protótipo: vive no localStorage do navegador e sincroniza entre separadores
 * (abra o painel da família e o painel do lar em dois separadores para ver as notificações em direto).
 *
 * Numa versão de produção isto é substituído por uma API + base de dados com autenticação real.
 */
import { useMemo, useSyncExternalStore } from 'react'
import type {
  AcessoFamilia,
  Candidatura,
  Caso,
  DB,
  EstadoCandidatura,
  Favorito,
  Lar,
  MetodoPagamentoFamilia,
  Natureza,
  Notificacao,
  Organizacao,
  PerfilIdoso,
  PlanoFamiliaId,
  PlanoInstituicao,
  ProcuraAnonima,
  Review,
  Role,
  TipoQuarto,
  TipoResposta,
  User,
  Visita,
} from '@/types'
import { createSeed, DEMO_EQUIPA_EMAIL, DEMO_FAMILIA_EMAIL, DEMO_LAR_EMAIL, DEMO_PASSWORD, DEMO_PRO_EMAIL, SEED_VERSION } from '@/data/seed'
import { LOCALIDADES, LUGARES } from '@/data/localidades'
import { hashPassword } from './hash'
import { uid } from './random'
import { ESTADO_CANDIDATURA_LABEL } from './labels'
import { diaPorExtenso, horaPt, isoDia } from './format'
import { aoLar, doLar, larPlural, maiuscula, noLar, oLar } from './artigos'
import { contactoVisivel, faixaEtaria, taxaPara } from './negocio'
import { acessoAtivo, diasRestantes, novoAte, planoFamilia, temAcessoCompleto } from './acesso'

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

/** Pesquisas sem vaga guardadas (anónimas) — só as mais recentes. */
const MAX_PROCURAS = 500

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
    Array.isArray(x.casos) &&
    Array.isArray(x.procuras) &&
    Array.isArray(x.visitas) &&
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
    casos: juntar(antigo.casos, fresco.casos),
    procuras: juntar(antigo.procuras, fresco.procuras).slice(-MAX_PROCURAS),
    visitas: juntar(antigo.visitas, fresco.visitas),
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
/** Para onde levar o autor do pedido: o painel da família, ou o caso do profissional. */
const linkAutor = (c: Pick<Candidatura, 'encaminhamento'>) => (c.encaminhamento ? `/casos/${encodeURIComponent(c.encaminhamento.casoId)}` : '/familia')
/** Como o lar se refere a um pedido ainda não aceite: sem nome nem contacto. */
const pedidoAnonimo = (c: Candidatura) =>
  `${c.encaminhamento ? `encaminhamento ${c.encaminhamento.organizacao.startsWith('Hospital') ? 'do' : 'de'} ${c.encaminhamento.organizacao}` : 'uma família'} (pessoa de ${faixaEtaria(c.perfil.idade)} anos)`

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

/** Casos do profissional com sessão iniciada (mais recentes primeiro). */
export function useCasos(): Caso[] {
  const d = useDB()
  const user = useCurrentUser()
  return useMemo(
    () => (user?.role === 'profissional' ? d.casos.filter((c) => c.profissionalId === user.id).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)) : []),
    [d.casos, user],
  )
}

export function useCaso(id: string | undefined): Caso | undefined {
  const casos = useCasos()
  return useMemo(() => (id ? casos.find((c) => c.id === id) : undefined), [casos, id])
}

/** Pedidos enviados a partir de um caso (um por instituição). */
export function useCandidaturasDoCaso(casoId: string | undefined): Candidatura[] {
  const d = useDB()
  return useMemo(
    () => (casoId ? d.candidaturas.filter((c) => c.encaminhamento?.casoId === casoId).sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm)) : []),
    [d.candidaturas, casoId],
  )
}

/** Pesquisas sem vaga no distrito da instituição, nos últimos `dias` (anónimas). */
export function useProcurasZona(lar: Pick<Lar, 'distrito'> | undefined, dias = 30): ProcuraAnonima[] {
  const d = useDB()
  return useMemo(() => {
    if (!lar) return []
    const desde = Date.now() - dias * 86_400_000
    return d.procuras.filter((p) => p.distrito === lar.distrito && Date.parse(p.criadaEm) >= desde)
  }, [d.procuras, lar, dias])
}

export interface EstadoAcesso {
  /** vê a camada completa: vagas, preços, previsão, contactos, pedidos (famílias com passe e profissionais) */
  completo: boolean
  /** a família tem um passe em vigor */
  ativo: boolean
  ate?: string
  plano?: PlanoFamiliaId
  diasRestantes: number
}

/** Estado do Acesso Família do utilizador com sessão (ou de um visitante: versão grátis). */
export function useAcesso(): EstadoAcesso {
  const user = useCurrentUser()
  return useMemo(() => {
    const agora = Date.now()
    return {
      completo: temAcessoCompleto(user, agora),
      ativo: acessoAtivo(user?.acesso, agora),
      ate: user?.acesso?.ate,
      plano: user?.acesso?.plano,
      diasRestantes: diasRestantes(user?.acesso, agora),
    }
  }, [user])
}

/** Visitas da equipa de terreno (só a equipa vê), mais recentes primeiro. */
export function useVisitas(): Visita[] {
  const d = useDB()
  const user = useCurrentUser()
  return useMemo(() => (user?.role === 'equipa' ? [...d.visitas].sort((a, b) => b.data.localeCompare(a.data)) : []), [d.visitas, user])
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
  const email = { familia: DEMO_FAMILIA_EMAIL, lar: DEMO_LAR_EMAIL, profissional: DEMO_PRO_EMAIL, equipa: DEMO_EQUIPA_EMAIL }[role]
  return login(email, DEMO_PASSWORD)
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
  /** role 'profissional': hospital, centro de saúde, autarquia… */
  organizacao?: Organizacao
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
  if (input.role === 'profissional') {
    const org = input.organizacao
    if (!org || !org.nome.trim()) return { ok: false, error: 'Indique onde trabalha (hospital, centro de saúde…).' }
    user.organizacao = { nome: org.nome.trim(), tipo: org.tipo, servico: org.servico?.trim() || undefined }
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
            : input.role === 'profissional'
              ? 'Crie um caso com o perfil de cuidados da pessoa e envie o pedido às instituições compatíveis de uma só vez.'
              : 'Crie o perfil da pessoa de quem cuida para ver as instituições compatíveis. Com o Acesso Família, vê onde há vaga, envia pedidos e recebe alertas.',
        link: input.role === 'lar' ? '/gestao' : input.role === 'profissional' ? '/casos' : '/familia',
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
      // o alerta de vaga é do Acesso Família: na versão grátis, guardar não liga o alerta
      : [...db.favoritos, { userId: user.id, larId, alerta: temAcessoCompleto(user), criadoEm: nowIso() }],
  })
  return !existe
}

/** Liga/desliga o alerta de vaga. Ligar é do Acesso Família (devolve false sem ele); desligar está sempre à mão. */
export function setAlerta(larId: string, alerta: boolean): boolean {
  const user = getCurrentUser()
  if (!user) return false
  if (alerta && !temAcessoCompleto(user)) return false
  const existe = db.favoritos.some((f) => f.userId === user.id && f.larId === larId)
  commit({
    ...db,
    favoritos: existe
      ? db.favoritos.map((f) => (f.userId === user.id && f.larId === larId ? { ...f, alerta } : f))
      : [...db.favoritos, { userId: user.id, larId, alerta, criadoEm: nowIso() }],
  })
  return true
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
        texto: `Pedido de vaga de uma família (pessoa de ${faixaEtaria(perfil.idade)} anos).${input.visita ? ' Pediu também uma visita.' : ''} Abra o pedido para o aceitar e ver o contacto.`,
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
          texto: `${contactoVisivel(c) ? c.contacto.nome : maiuscula(pedidoAnonimo(c))} pediu uma visita para ${diaPorExtenso(data)}, às ${horaPt(hora)}.`,
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
        texto: contactoVisivel(c) ? `${c.contacto.nome} cancelou o pedido para ${c.perfil.nome}.` : `O pedido de ${pedidoAnonimo(c)} foi cancelado.`,
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
          link: linkAutor(c),
        }),
      )
    }
  }
  for (const f of state.favoritos) {
    // alertas de lares guardados só com Acesso Família (senão revelariam quais têm vaga); quem está inscrito
    // na lista de espera (acima) é sempre avisado, porque já tem uma relação com a instituição
    const seguidor = state.users.find((u) => u.id === f.userId)
    if (!temAcessoCompleto(seguidor)) continue
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
            // fazer avançar o pedido equivale a aceitá-lo: o contacto passa a estar visível
            desbloqueadaEm: x.desbloqueadaEm ?? (x.estado === 'enviada' && estado !== 'recusada' ? agora : undefined),
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
    aceite: `A vaga ${noLar(lar.nome)} para ${nome} foi aceite. A instituição vai combinar consigo a data de entrada.`,
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
        link: linkAutor(c),
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
        link: linkAutor(c),
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

// ————————————————————————————————————————— modelo de negócio (docs/MODELO-NEGOCIO.md)

/** O lar aceita o pedido: passa a ver o contacto e o perfil completo (RGPD: só depois de aceitar). */
export function aceitarPedido(id: string) {
  const c = db.candidaturas.find((x) => x.id === id)
  if (!c || c.desbloqueadaEm || c.estado !== 'enviada') return
  // passar a "em análise" já regista o desbloqueio e avisa quem fez o pedido
  atualizarCandidatura(id, 'em_analise')
}

/** Junta uma confirmação de entrada (do lar ou da família) ao pedido e passa-o a "admitida". */
function registarConfirmacaoEntrada(state: DB, c: Candidatura, lado: 'lar' | 'familia', data: string): DB {
  const lar = state.lares.find((l) => l.id === c.larId)
  if (!lar) return state
  const agora = nowIso()
  const entrada = {
    ...(c.entrada ?? { data, taxa: taxaPara(lar) }),
    data: c.entrada?.data ?? data,
    ...(lado === 'lar' ? { confirmadaLarEm: agora } : { confirmadaFamiliaEm: agora }),
  }
  const nota = lado === 'lar' ? 'Entrada registada pela instituição.' : 'Entrada confirmada pela família.'
  return {
    ...state,
    candidaturas: state.candidaturas.map((x) =>
      x.id === c.id
        ? {
            ...x,
            estado: 'admitida',
            posicao: undefined,
            prazoResposta: undefined,
            entrada,
            atualizadaEm: agora,
            historico: [...x.historico, { data: agora, estado: 'admitida', nota }],
          }
        : x,
    ),
  }
}

const PODE_ENTRAR: EstadoCandidatura[] = ['aceite', 'admitida']

/** A instituição marca "Entrou" (dia da entrada AAAA-MM-DD). Avisa quem fez o pedido para confirmar. */
export function marcarEntrada(id: string, data: string) {
  const c = db.candidaturas.find((x) => x.id === id)
  if (!c || !PODE_ENTRAR.includes(c.estado) || c.entrada?.confirmadaLarEm) return
  const lar = db.lares.find((l) => l.id === c.larId)
  if (!lar) return
  const state = registarConfirmacaoEntrada(db, c, 'lar', data)
  commit({
    ...state,
    notificacoes: c.entrada?.confirmadaFamiliaEm
      ? state.notificacoes
      : [
          ...state.notificacoes,
          novaNotificacao({
            userId: c.userId,
            tipo: 'candidatura',
            titulo: 'Entrada registada',
            texto: `${maiuscula(oLar(lar.nome))} registou a entrada de ${c.perfil.nome} a ${diaPorExtenso(data)}. Confirme no painel, para poder deixar uma avaliação verificada.`,
            larId: lar.id,
            candidaturaId: c.id,
            link: linkAutor(c),
          }),
        ],
  })
}

/** A família (ou o profissional que fez o pedido) confirma que a pessoa entrou. */
export function confirmarEntradaFamilia(id: string, data: string) {
  const user = getCurrentUser()
  const c = db.candidaturas.find((x) => x.id === id)
  if (!user || !c || c.userId !== user.id || !PODE_ENTRAR.includes(c.estado) || c.entrada?.confirmadaFamiliaEm) return
  const lar = db.lares.find((l) => l.id === c.larId)
  if (!lar) return
  const state = registarConfirmacaoEntrada(db, c, 'familia', data)
  commit({
    ...state,
    notificacoes:
      lar.ownerId && !c.entrada?.confirmadaLarEm
        ? [
            ...state.notificacoes,
            novaNotificacao({
              userId: lar.ownerId,
              tipo: 'candidatura',
              titulo: 'Entrada confirmada pela família',
              texto: `${c.contacto.nome} confirmou a entrada de ${c.perfil.nome} a ${diaPorExtenso(c.entrada?.data ?? data)}. Registe-a também no painel.`,
              larId: lar.id,
              candidaturaId: c.id,
              link: linkPedido(c.id),
            }),
          ]
        : state.notificacoes,
  })
}

export interface AvaliacaoInput {
  nota: number
  texto: string
  aspetos: Review['aspetos']
}

const relacaoReview = (relacao: string) => (relacao === 'Eu próprio(a)' ? 'Residente' : 'Familiar de residente')

/** Avaliação verificada: só quem confirmou a entrada, uma por pedido. */
export function avaliarLar(candidaturaId: string, input: AvaliacaoInput): Review | null {
  const user = getCurrentUser()
  const c = db.candidaturas.find((x) => x.id === candidaturaId)
  // só famílias avaliam (um profissional confirma a entrada em nome da pessoa, mas não avalia)
  if (!user || user.role !== 'familia' || !c || c.userId !== user.id || !c.entrada?.confirmadaFamiliaEm) return null
  const lar = db.lares.find((l) => l.id === c.larId)
  const id = `r-${c.id}`
  if (!lar || lar.reviews.some((r) => r.id === id)) return null
  const nota = Math.max(1, Math.min(5, Math.round(input.nota)))
  const [primeiro, ...resto] = user.nome.trim().split(/\s+/)
  const review: Review = {
    id,
    autor: resto.length ? `${primeiro} ${resto[resto.length - 1]![0]}.` : (primeiro ?? 'Família'),
    relacao: relacaoReview(c.perfil.relacao),
    data: nowIso(),
    nota,
    texto: input.texto.trim(),
    verificada: true,
    aspetos: input.aspetos,
  }
  const total = lar.numAvaliacoes + 1
  commit({
    ...db,
    lares: patchLar(db.lares, lar.id, (l) => ({
      ...l,
      reviews: [review, ...l.reviews],
      numAvaliacoes: total,
      avaliacao: Math.round(((l.avaliacao * l.numAvaliacoes + nota) / total) * 10) / 10,
    })),
  })
  return review
}

/** O utilizador já avaliou a instituição a partir deste pedido? */
export const jaAvaliou = (c: Pick<Candidatura, 'id' | 'larId'>) => !!db.lares.find((l) => l.id === c.larId)?.reviews.some((r) => r.id === `r-${c.id}`)

// ————————————————————————————————————————— casos (profissionais)

export interface CasoInput {
  perfil: Omit<PerfilInput, 'id'>
  referencia?: string
  altaPrevista?: string
  consentimento: boolean
}

export function criarCaso(input: CasoInput): Caso | null {
  const user = getCurrentUser()
  if (!user || user.role !== 'profissional' || !input.consentimento) return null
  const agora = nowIso()
  const perfil: PerfilIdoso = { ...input.perfil, id: uid('p'), userId: user.id, criadoEm: agora, atualizadoEm: agora }
  const caso: Caso = {
    id: uid('caso'),
    profissionalId: user.id,
    perfilId: perfil.id,
    referencia: input.referencia?.trim() || undefined,
    altaPrevista: input.altaPrevista || undefined,
    consentimento: true,
    estado: 'aberto',
    criadoEm: agora,
    atualizadoEm: agora,
  }
  commit({ ...db, perfis: [...db.perfis, perfil], casos: [...db.casos, caso] })
  return caso
}

export function atualizarCaso(id: string, patch: Partial<Pick<Caso, 'referencia' | 'altaPrevista' | 'estado'>> & { perfil?: Partial<PerfilInput> }) {
  const user = getCurrentUser()
  const caso = db.casos.find((c) => c.id === id && c.profissionalId === user?.id)
  if (!caso) return
  const agora = nowIso()
  const { perfil, ...resto } = patch
  commit({
    ...db,
    casos: db.casos.map((c) => (c.id === id ? { ...c, ...resto, atualizadoEm: agora } : c)),
    perfis: perfil ? db.perfis.map((p) => (p.id === caso.perfilId ? { ...p, ...perfil, id: p.id, userId: p.userId, atualizadoEm: agora } : p)) : db.perfis,
  })
}

const organizacaoTexto = (o: Organizacao | undefined) => (o ? `${o.nome}${o.servico ? ` · ${o.servico}` : ''}` : 'Serviço social')

/**
 * Envia o caso a várias instituições de uma vez: um pedido por instituição, com o contacto do profissional.
 * Ignora instituições que já têm um pedido ativo deste caso. Devolve os pedidos criados.
 */
export function enviarCaso(casoId: string, larIds: string[], mensagem?: string): Candidatura[] {
  const user = getCurrentUser()
  const caso = db.casos.find((c) => c.id === casoId && c.profissionalId === user?.id)
  const perfil = caso && db.perfis.find((p) => p.id === caso.perfilId)
  if (!user || !caso || !perfil || !caso.consentimento) return []
  const agora = nowIso()
  const organizacao = organizacaoTexto(user.organizacao)
  const novos: Candidatura[] = []
  const notifs: Notificacao[] = []
  for (const larId of new Set(larIds)) {
    const lar = db.lares.find((l) => l.id === larId)
    if (!lar) continue
    const ativo = db.candidaturas.some((c) => c.larId === larId && c.encaminhamento?.casoId === casoId && !['cancelada', 'recusada'].includes(c.estado))
    if (ativo) continue
    const c: Candidatura = {
      id: uid('c'),
      larId,
      userId: user.id,
      perfilId: perfil.id,
      perfil,
      contacto: { nome: `${user.nome} (${organizacao})`, email: user.email, telefone: user.telefone },
      estado: 'enviada',
      mensagem: mensagem?.trim() || undefined,
      criadaEm: agora,
      atualizadaEm: agora,
      historico: [{ data: agora, estado: 'enviada', nota: `Encaminhado por ${organizacao}.` }],
      origem: 'profissional',
      encaminhamento: { casoId, profissionalId: user.id, organizacao, altaPrevista: caso.altaPrevista },
    }
    novos.push(c)
    if (lar.ownerId) {
      notifs.push(
        novaNotificacao({
          userId: lar.ownerId,
          tipo: 'candidatura',
          titulo: 'Novo encaminhamento',
          texto: `${maiuscula(pedidoAnonimo(c))}${caso.altaPrevista ? `, com alta prevista para ${diaPorExtenso(caso.altaPrevista)}` : ''}. Abra o pedido para o aceitar e ver o contacto.`,
          candidaturaId: c.id,
          larId,
          link: linkPedido(c.id),
        }),
      )
    }
  }
  if (novos.length) {
    commit({
      ...db,
      candidaturas: [...db.candidaturas, ...novos],
      notificacoes: [...db.notificacoes, ...notifs],
      casos: db.casos.map((c) => (c.id === casoId ? { ...c, atualizadoEm: agora } : c)),
    })
  }
  return novos
}

// ————————————————————————————————————————— procura sem resposta (anónima)

const procurasDestaSessao = new Set<string>()

/** Guarda uma pesquisa sem vagas (sem dados pessoais). No máximo uma por combinação, por sessão. */
export function registarProcura(p: Omit<ProcuraAnonima, 'id' | 'criadaEm'>) {
  const chave = JSON.stringify([p.distrito, p.lugar, p.grau, [...p.cuidados].sort(), p.orcamentoMax])
  if (procurasDestaSessao.has(chave)) return
  procurasDestaSessao.add(chave)
  commit({ ...db, procuras: [...db.procuras, { ...p, id: uid('q'), criadaEm: nowIso() }].slice(-MAX_PROCURAS) })
}

// ————————————————————————————————————————— confirmação rápida de vagas (link sem login)

export const larPorToken = (token: string | undefined) => (token ? db.lares.find((l) => l.confirmacaoToken === token) : undefined)

export function useLarPorToken(token: string | undefined): Lar | undefined {
  const lares = useLares()
  return useMemo(() => (token ? lares.find((l) => l.confirmacaoToken === token) : undefined), [lares, token])
}

/** Resposta ao "Ainda tem N vagas?": sim confirma; não põe os lugares livres a 0. Devolve a instituição. */
export function responderConfirmacao(token: string, aindaTem: boolean): Lar | null {
  const lar = larPorToken(token)
  if (!lar) return null
  if (aindaTem) confirmarVagasAtualizadas(lar.id)
  else commit({ ...db, lares: patchLar(db.lares, lar.id, (l) => ({ ...l, quartos: l.quartos.map((q) => ({ ...q, livres: 0 })), atualizadoEm: nowIso() })) })
  return db.lares.find((l) => l.id === lar.id) ?? null
}

// ————————————————————————————————————————— Acesso Família (lado das famílias)

/**
 * Demonstração: simula o pagamento de um passe do Acesso Família (na versão real: Stripe Checkout com MB WAY,
 * Multibanco ou cartão, e fatura-recibo certificada). Só contas de família. Soma os dias ao passe em vigor.
 */
export function comprarAcessoDemo(planoId: PlanoFamiliaId, metodo: MetodoPagamentoFamilia): { ok: true; ate: string } | { ok: false; erro: string } {
  const user = getCurrentUser()
  if (!user) return { ok: false, erro: 'Entre ou crie uma conta de família para ativar o Acesso Família.' }
  if (user.role !== 'familia') return { ok: false, erro: 'O Acesso Família é para contas de família.' }
  const plano = planoFamilia(planoId)
  const agora = Date.now()
  const acesso: AcessoFamilia = {
    plano: plano.id,
    compradoEm: new Date(agora).toISOString(),
    ate: novoAte(user.acesso, plano, agora),
    origem: 'compra',
    metodo,
    valorCentimos: plano.precoCentimos,
  }
  commit({
    ...db,
    users: db.users.map((u) => (u.id === user.id ? { ...u, acesso } : u)),
    notificacoes: [
      ...db.notificacoes,
      novaNotificacao({
        userId: user.id,
        tipo: 'sistema',
        titulo: 'Acesso Família ativo',
        texto: `Tem acesso completo até ${diaPorExtenso(isoDia(new Date(acesso.ate)))}. Não há renovação automática.`,
        link: '/familia',
      }),
    ],
  })
  return { ok: true, ate: acesso.ate }
}

// ————————————————————————————————————————— modalidade das instituições privadas

/** O lar privado escolhe: por entrada ou mensalidade fixa (no protótipo, muda logo; na versão real, no contrato). */
export function escolherPlanoInstituicao(plano: PlanoInstituicao): { ok: true } | { ok: false; erro: string } {
  const user = getCurrentUser()
  const lar = user?.role === 'lar' ? db.lares.find((l) => l.id === user.larId) : undefined
  if (!lar) return { ok: false, erro: 'Só a instituição pode escolher a modalidade.' }
  if (lar.natureza !== 'privado') return { ok: false, erro: 'As IPSS e Misericórdias não têm custos.' }
  commit({ ...db, lares: patchLar(db.lares, lar.id, (l) => ({ ...l, planoInstituicao: plano })) })
  return { ok: true }
}

// ————————————————————————————————————————— equipa de terreno (modo visita)

export interface RegistoVisitaInput {
  larId: string
  resultado: Visita['resultado']
  verificacao: Visita['verificacao']
  responsavel?: Visita['responsavel']
  plano?: PlanoInstituicao
  notas?: string
  proximoContacto?: string
  /** nº do alvará/licença visto na visita (atualiza a ficha quando a licença é confirmada) */
  licenca?: string
  /** vagas e preços confirmados na visita (por tipo de quarto existente) */
  quartos?: { tipo: TipoQuarto; livres: number; precoMin: number; precoMax: number }[]
  cuidados?: Lar['cuidados']
  /** na adesão: criar a conta do responsável (precisa de email) */
  criarConta?: boolean
}

export type RegistoVisitaResultado =
  | { ok: true; visita: Visita; selo: boolean; conta?: { email: string; palavraPasse: string } }
  | { ok: false; erro: string }

/** Palavra-passe provisória legível (o responsável muda-a no primeiro acesso). */
function palavraPasseProvisoria(): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(10)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => letras[b % letras.length]).join('').replace(/^(.{5})/, '$1-')
}

/**
 * A equipa regista uma visita: confirma a licença e as instalações (selo "Visitada pela equipa"), as vagas e os
 * preços (a ficha fica atualizada agora), os cuidados, e o resultado. Na adesão de um privado fica registada a
 * modalidade; com email do responsável, pode criar-lhe a conta (palavra-passe provisória, mostrada uma vez).
 */
export function registarVisita(input: RegistoVisitaInput): RegistoVisitaResultado {
  const user = getCurrentUser()
  if (!user || user.role !== 'equipa') return { ok: false, erro: 'Só a equipa de terreno regista visitas.' }
  const lar = db.lares.find((l) => l.id === input.larId)
  if (!lar) return { ok: false, erro: 'Instituição não encontrada.' }
  const agora = nowIso()
  const email = input.responsavel?.email?.trim().toLowerCase()
  const criarConta = !!input.criarConta && input.resultado === 'aderiu' && !lar.ownerId
  if (criarConta) {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, erro: 'Indique o email do responsável para criar a conta.' }
    if (db.users.some((u) => u.email.toLowerCase() === email)) return { ok: false, erro: 'Já existe uma conta com este email.' }
  }

  const selo = input.verificacao.licencaConfirmada && input.verificacao.instalacoesVistas
  let novoLar: Lar = { ...lar }
  if (input.verificacao.licencaConfirmada) {
    const licenca = input.licenca?.trim() || lar.verificacao.licenca
    // licença confirmada sem ver as instalações: 1.º nível (licença), sem o selo da visita
    const estado = selo ? 'verificado' : lar.verificacao.estado === 'nao_verificado' ? 'pendente' : lar.verificacao.estado
    novoLar = { ...novoLar, verificacao: { ...novoLar.verificacao, licenca, estado, ...(selo ? { data: agora } : {}) } }
  }
  if (input.quartos?.length && (input.verificacao.vagasConfirmadas || input.verificacao.precosConfirmados)) {
    const quartos = novoLar.quartos.map((q) => {
      const c = input.quartos!.find((x) => x.tipo === q.tipo)
      if (!c) return q
      return {
        ...q,
        livres: input.verificacao.vagasConfirmadas ? Math.max(0, Math.min(q.total, Math.round(c.livres))) : q.livres,
        precoMin: input.verificacao.precosConfirmados ? Math.max(0, Math.round(c.precoMin)) : q.precoMin,
        precoMax: input.verificacao.precosConfirmados ? Math.max(Math.round(c.precoMin), Math.round(c.precoMax)) : q.precoMax,
      }
    })
    const precos = quartos.flatMap((q) => [q.precoMin, q.precoMax])
    novoLar = { ...novoLar, quartos, mensalidadeMin: Math.min(...precos), mensalidadeMax: Math.max(...precos), atualizadoEm: agora }
  }
  if (input.cuidados) novoLar = { ...novoLar, cuidados: input.cuidados }
  if (input.resultado === 'aderiu' && lar.natureza === 'privado') novoLar = { ...novoLar, planoInstituicao: input.plano ?? 'por_entrada' }

  let users = db.users
  let conta: { email: string; palavraPasse: string } | undefined
  let contaId: string | undefined
  if (criarConta && email) {
    const palavraPasse = palavraPasseProvisoria()
    contaId = uid('u')
    users = [
      ...users,
      {
        id: contaId,
        role: 'lar',
        nome: input.responsavel?.nome?.trim() || lar.nome,
        email,
        passwordHash: hashPassword(palavraPasse, email),
        telefone: input.responsavel?.telefone?.trim() || undefined,
        criadoEm: agora,
        larId: lar.id,
      },
    ]
    novoLar = { ...novoLar, ownerId: contaId }
    conta = { email, palavraPasse }
  }

  const visita: Visita = {
    id: uid('v'),
    larId: lar.id,
    equipaId: user.id,
    data: agora,
    resultado: input.resultado,
    verificacao: input.verificacao,
    responsavel: input.responsavel,
    plano: input.resultado === 'aderiu' && lar.natureza === 'privado' ? (input.plano ?? 'por_entrada') : undefined,
    notas: input.notas?.trim() || undefined,
    proximoContacto: input.resultado === 'interessado' || input.resultado === 'voltar' ? input.proximoContacto : undefined,
    contaCriadaId: contaId,
  }
  const dono = novoLar.ownerId
  commit({
    ...db,
    users,
    lares: db.lares.map((l) => (l.id === lar.id ? novoLar : l)),
    visitas: [...db.visitas, visita],
    notificacoes:
      dono && selo
        ? [
            ...db.notificacoes,
            novaNotificacao({
              userId: dono,
              tipo: 'sistema',
              titulo: 'Visitada pela equipa',
              texto: 'A equipa do EncontraLar confirmou a licença e as instalações. A ficha tem agora o selo «Visitada pela equipa».',
              larId: lar.id,
              link: '/gestao/ficha',
            }),
          ]
        : db.notificacoes,
  })
  return { ok: true, visita, selo, conta }
}
