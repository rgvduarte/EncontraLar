/**
 * Conversão entre as linhas da base de dados Supabase (snake_case, ver database.types.ts) e os
 * tipos da app (src/types.ts), para a troca do store localStorage pelo Supabase não tocar na UI.
 *
 * Regras gerais:
 *   * datas → ISO 8601 em UTC (como Date#toISOString no protótipo);
 *   * colunas anuláveis → campos opcionais (undefined) do lado da app;
 *   * Lar.id = instituicoes.id (o slug público usado nas rotas /lar/:id);
 *   * a cópia do perfil numa candidatura (perfil_snapshot) tem o formato de uma linha de
 *     perfis_cuidados — pode estar minimizada (só nome/idade) após o prazo de retenção.
 */
import type {
  Candidatura,
  Comodidade,
  Cuidado,
  Distrito,
  EstadoCandidatura,
  Favorito,
  GrauDependencia,
  Lar,
  Notificacao,
  PerfilIdoso,
  Regiao,
  Review,
  RoomOffer,
  TipoQuarto,
  User,
} from '@/types'
import type { Json, Tables, TablesInsert, TablesUpdate } from './database.types'

export type InstituicaoPublicaRow = Tables<'instituicoes_publicas'>
export type AvaliacaoPublicaRow = Omit<Tables<'avaliacoes'>, 'user_id'>
export type PerfilCuidadosRow = Tables<'perfis_cuidados'>
export type CandidaturaRow = Tables<'candidaturas'>
export type CandidaturaEventoRow = Tables<'candidatura_eventos'>
export type NotificacaoRow = Tables<'notificacoes'>
export type FavoritoRow = Tables<'favoritos'>
export type PerfilUtilizadorRow = Tables<'perfis_utilizador'>

/** Colunas públicas de avaliacoes (user_id não é legível por anon/authenticated: usar sempre esta lista). */
export const COLUNAS_AVALIACAO =
  'id, instituicao_id, autor, relacao, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes, aspeto_comunicacao, texto, verificada, created_at'

/** select de candidaturas com o histórico embutido (uma só ida à API). */
export const SELECT_CANDIDATURA = '*, candidatura_eventos(estado, nota, created_at)'

// ————————————————————————————————————————— utilitários

const iso = (v: string | null | undefined): string | undefined => (v ? new Date(v).toISOString() : undefined)
const isoObrigatorio = (v: string | null | undefined): string => iso(v) ?? new Date(0).toISOString()
const num = (v: number | string | null | undefined, padrao = 0): number => {
  const n = typeof v === 'string' ? Number(v) : v
  return n == null || Number.isNaN(n) ? padrao : n
}
const obj = (v: Json | null | undefined): Record<string, Json | undefined> =>
  v && typeof v === 'object' && !Array.isArray(v) ? v : {}
const lista = (v: Json | null | undefined): Json[] => (Array.isArray(v) ? v : [])
const texto = (v: Json | undefined, padrao = ''): string => (typeof v === 'string' ? v : padrao)
const opcional = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v)

// ————————————————————————————————————————— instituições

export function quartosDeJson(v: Json | null | undefined): RoomOffer[] {
  return lista(v).map((q) => {
    const o = obj(q)
    return {
      tipo: texto(o.tipo, 'individual') as TipoQuarto,
      total: num(o.total as number),
      livres: num(o.livres as number),
      precoMin: num(o.preco_min as number),
      precoMax: num(o.preco_max as number),
    }
  })
}

/** Linha de instituicoes_publicas → Lar. As avaliações (texto) carregam-se à parte. */
export function larDeLinha(r: InstituicaoPublicaRow, reviews: Review[] = []): Lar {
  const capa = obj(r.capa)
  return {
    id: r.id ?? '',
    nome: r.nome ?? '',
    tipo: r.tipo ?? 'erpi',
    natureza: r.natureza ?? 'privado',
    resumo: r.resumo ?? '',
    descricao: r.descricao ?? '',
    morada: r.morada ?? '',
    codigoPostal: r.codigo_postal ?? '',
    localidade: r.localidade ?? '',
    concelho: r.concelho ?? '',
    distrito: (r.distrito ?? 'Lisboa') as Distrito,
    regiao: (r.regiao ?? 'Lisboa e Vale do Tejo') as Regiao,
    lat: num(r.lat),
    lng: num(r.lng),
    telefone: r.telefone ?? '',
    email: r.email ?? '',
    website: opcional(r.website),
    capacidade: num(r.capacidade),
    quartos: quartosDeJson(r.quartos),
    listaEspera: num(r.lista_espera),
    estadiaMediaMeses: num(r.estadia_media_meses, 36),
    historicoSaidas: r.historico_saidas ?? [],
    mensalidadeMin: num(r.mensalidade_min),
    mensalidadeMax: num(r.mensalidade_max),
    acordoSS: r.acordo_ss ?? false,
    incluido: r.incluido ?? [],
    extras: lista(r.extras).map((e) => ({ nome: texto(obj(e).nome), preco: texto(obj(e).preco) })),
    graus: r.graus ?? [],
    cuidados: (r.cuidados ?? []) as Cuidado[],
    comodidades: (r.comodidades ?? []) as Comodidade[],
    equipa: {
      cuidadoresPor10: num(r.equipa_cuidadores_por_10),
      enfermeiros: num(r.equipa_enfermeiros),
      medicoHorasSemana: num(r.equipa_medico_horas_semana),
    },
    verificacao: {
      estado: r.verificacao_estado ?? 'pendente',
      data: iso(r.verificacao_data),
      licenca: r.licenca ?? '',
      ultimaInspecao: iso(r.ultima_inspecao),
    },
    avaliacao: num(r.avaliacao_media),
    numAvaliacoes: num(r.num_avaliacoes),
    reviews,
    fundacao: num(r.fundacao, new Date().getFullYear()),
    atualizadoEm: isoObrigatorio(r.atualizado_em),
    capa: { hue: num(capa.hue as number, 152), variante: num(capa.variante as number) },
    ownerId: opcional(r.owner_id),
    visualizacoes30d: num(r.visualizacoes_30d),
  }
}

/**
 * Alterações à ficha (atualizarLar) → UPDATE em instituicoes, só com as colunas que o dono pode
 * escrever. `listaEspera` é o TOTAL na app; na BD guarda-se a parte offline (total − plataforma).
 * Quartos, id, dono, verificação, agregados e frescura não passam por aqui.
 */
export function larParaAtualizacao(
  patch: Partial<Omit<Lar, 'id' | 'ownerId'>>,
  ctx: { listaEsperaOnline?: number } = {},
): TablesUpdate<'instituicoes'> {
  const u: TablesUpdate<'instituicoes'> = {}
  if (patch.nome !== undefined) u.nome = patch.nome
  if (patch.tipo !== undefined) u.tipo = patch.tipo
  if (patch.natureza !== undefined) u.natureza = patch.natureza
  if (patch.resumo !== undefined) u.resumo = patch.resumo
  if (patch.descricao !== undefined) u.descricao = patch.descricao
  if (patch.morada !== undefined) u.morada = patch.morada
  if (patch.codigoPostal !== undefined) u.codigo_postal = patch.codigoPostal || null
  if (patch.localidade !== undefined) u.localidade = patch.localidade
  if (patch.concelho !== undefined) u.concelho = patch.concelho
  if (patch.distrito !== undefined) u.distrito = patch.distrito
  if (patch.regiao !== undefined) u.regiao = patch.regiao
  if (patch.lat !== undefined) u.lat = patch.lat
  if (patch.lng !== undefined) u.lng = patch.lng
  if (patch.telefone !== undefined) u.telefone = patch.telefone || null
  if (patch.email !== undefined) u.email = patch.email || null
  if ('website' in patch) u.website = patch.website || null
  if (patch.capacidade !== undefined) u.capacidade = patch.capacidade
  if (patch.listaEspera !== undefined) u.lista_espera_offline = Math.max(0, patch.listaEspera - (ctx.listaEsperaOnline ?? 0))
  if (patch.estadiaMediaMeses !== undefined) u.estadia_media_meses = patch.estadiaMediaMeses
  if (patch.acordoSS !== undefined) u.acordo_ss = patch.acordoSS
  if (patch.incluido !== undefined) u.incluido = patch.incluido
  if (patch.extras !== undefined) u.extras = patch.extras
  if (patch.graus !== undefined) u.graus = patch.graus
  if (patch.cuidados !== undefined) u.cuidados = patch.cuidados
  if (patch.comodidades !== undefined) u.comodidades = patch.comodidades
  if (patch.equipa !== undefined) {
    u.equipa_cuidadores_por_10 = patch.equipa.cuidadoresPor10
    u.equipa_enfermeiros = patch.equipa.enfermeiros
    u.equipa_medico_horas_semana = patch.equipa.medicoHorasSemana
  }
  if (patch.verificacao !== undefined) u.licenca = patch.verificacao.licenca
  if (patch.fundacao !== undefined) u.fundacao = patch.fundacao
  if (patch.capa !== undefined) u.capa = patch.capa
  return u
}

/** Novo tipo de quarto (os lugares livres começam em 0 e mudam pela RPC definir_vagas). */
export function quartoParaInsercao(larId: string, q: Pick<RoomOffer, 'tipo' | 'total' | 'precoMin' | 'precoMax'>): TablesInsert<'quartos'> {
  return { instituicao_id: larId, tipo: q.tipo, total: q.total, preco_min: q.precoMin, preco_max: q.precoMax }
}

/** Alteração de lugares/preços de um tipo de quarto (sem livres). */
export function quartoParaAtualizacao(q: Partial<Pick<RoomOffer, 'total' | 'precoMin' | 'precoMax'>>): TablesUpdate<'quartos'> {
  const u: TablesUpdate<'quartos'> = {}
  if (q.total !== undefined) u.total = q.total
  if (q.precoMin !== undefined) u.preco_min = q.precoMin
  if (q.precoMax !== undefined) u.preco_max = q.precoMax
  return u
}

// ————————————————————————————————————————— avaliações

export function reviewDeLinha(r: AvaliacaoPublicaRow): Review {
  return {
    id: String(r.id),
    autor: r.autor,
    relacao: r.relacao,
    data: isoObrigatorio(r.created_at),
    nota: r.nota,
    texto: r.texto,
    verificada: r.verificada,
    aspetos: {
      cuidados: r.aspeto_cuidados,
      alimentacao: r.aspeto_alimentacao,
      instalacoes: r.aspeto_instalacoes,
      comunicacao: r.aspeto_comunicacao,
    },
  }
}

// ————————————————————————————————————————— perfis de cuidados (dados de saúde)

/** Linha de perfis_cuidados — ou a cópia guardada numa candidatura — → PerfilIdoso. */
export function perfilDeLinha(r: PerfilCuidadosRow | Json, userId?: string): PerfilIdoso {
  const o = obj(r as Json)
  const quarto = texto(o.quarto, 'indiferente')
  const genero = o.genero === 'F' || o.genero === 'M' ? o.genero : undefined
  return {
    id: texto(o.id),
    userId: texto(o.user_id, userId ?? ''),
    nome: texto(o.nome),
    idade: num(o.idade as number),
    relacao: texto(o.relacao),
    genero,
    grau: texto(o.grau, 'moderada') as GrauDependencia,
    necessidades: (Array.isArray(o.necessidades) ? o.necessidades : []) as Cuidado[],
    preferencias: (Array.isArray(o.preferencias) ? o.preferencias : []) as Comodidade[],
    quarto: (['individual', 'duplo', 'casal'].includes(quarto) ? quarto : 'indiferente') as PerfilIdoso['quarto'],
    local: { label: texto(o.local_label), lat: num(o.local_lat as number), lng: num(o.local_lng as number) },
    raioKm: num(o.raio_km as number, 15),
    orcamentoMax: num(o.orcamento_max as number),
    urgencia: texto(o.urgencia, '1-3meses') as PerfilIdoso['urgencia'],
    precisaAcordoSS: o.precisa_acordo_ss === true,
    notas: typeof o.notas === 'string' && o.notas ? o.notas : undefined,
    criadoEm: isoObrigatorio(texto(o.created_at) || null),
    atualizadoEm: isoObrigatorio(texto(o.updated_at) || null),
  }
}

/** PerfilInput (savePerfil) → linha a inserir/atualizar. user_id fica a cargo do servidor (auth.uid()). */
export function perfilParaLinha(p: Omit<PerfilIdoso, 'id' | 'userId' | 'criadoEm' | 'atualizadoEm'>): TablesInsert<'perfis_cuidados'> {
  return {
    nome: p.nome,
    idade: p.idade,
    relacao: p.relacao,
    genero: p.genero ?? null,
    grau: p.grau,
    necessidades: p.necessidades,
    preferencias: p.preferencias,
    quarto: p.quarto,
    local_label: p.local.label,
    local_lat: p.local.lat,
    local_lng: p.local.lng,
    raio_km: p.raioKm,
    orcamento_max: p.orcamentoMax,
    urgencia: p.urgencia,
    precisa_acordo_ss: p.precisaAcordoSS,
    notas: p.notas?.trim() || null,
  }
}

// ————————————————————————————————————————— candidaturas

type EventoMinimo = Pick<CandidaturaEventoRow, 'estado' | 'nota' | 'created_at'>

export function candidaturaDeLinha(r: CandidaturaRow & { candidatura_eventos?: EventoMinimo[] | null }): Candidatura {
  const contacto = obj(r.contacto)
  const perfil = perfilDeLinha(r.perfil_snapshot, r.user_id)
  const historico = [...(r.candidatura_eventos ?? [])]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((e) => ({ data: isoObrigatorio(e.created_at), estado: e.estado as EstadoCandidatura, nota: opcional(e.nota) }))
  return {
    id: r.id,
    larId: r.instituicao_id,
    userId: r.user_id,
    perfilId: r.perfil_id ?? perfil.id,
    perfil,
    contacto: {
      nome: texto(contacto.nome),
      email: texto(contacto.email),
      telefone: typeof contacto.telefone === 'string' ? contacto.telefone : undefined,
    },
    estado: r.estado,
    posicao: opcional(r.posicao),
    mensagem: opcional(r.mensagem),
    visita:
      r.visita_data && r.visita_hora && r.visita_estado
        ? { data: r.visita_data, hora: r.visita_hora.slice(0, 5), estado: r.visita_estado }
        : undefined,
    prazoResposta: iso(r.prazo_resposta),
    criadaEm: isoObrigatorio(r.created_at),
    atualizadaEm: isoObrigatorio(r.updated_at),
    historico,
  }
}

// ————————————————————————————————————————— notificações, favoritos, conta

export function notificacaoDeLinha(r: NotificacaoRow): Notificacao {
  return {
    id: String(r.id),
    userId: r.user_id,
    tipo: r.tipo,
    titulo: r.titulo,
    texto: r.texto,
    larId: opcional(r.instituicao_id),
    candidaturaId: opcional(r.candidatura_id),
    link: opcional(r.link),
    lida: r.lida,
    criadaEm: isoObrigatorio(r.created_at),
  }
}

export function favoritoDeLinha(r: FavoritoRow): Favorito {
  return { userId: r.user_id, larId: r.instituicao_id, alerta: r.alerta, criadoEm: isoObrigatorio(r.created_at) }
}

/**
 * perfis_utilizador + email da sessão (supabase.auth) → User. A palavra-passe é gerida pelo
 * Supabase Auth: passwordHash fica vazio (o campo só existe no modo demonstração).
 */
export function utilizadorDeLinha(r: PerfilUtilizadorRow, email: string, larId?: string): User {
  return {
    id: r.id,
    role: r.role,
    nome: r.nome,
    email,
    passwordHash: '',
    telefone: opcional(r.telefone),
    criadoEm: isoObrigatorio(r.created_at),
    larId,
  }
}
