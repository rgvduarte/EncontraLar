/**
 * Conversão entre as linhas da base de dados Supabase (snake_case, ver database.types.ts) e os
 * tipos da app (src/types.ts), para a troca do store localStorage pelo Supabase não tocar na UI.
 *
 * Regras gerais:
 *   * datas → ISO 8601 em UTC (como Date#toISOString no protótipo);
 *   * colunas anuláveis → campos opcionais (undefined) do lado da app;
 *   * Lar.id = instituicoes.id (o slug público usado nas rotas /lar/:id);
 *   * a cópia do perfil numa candidatura (perfil_snapshot) tem um SUBCONJUNTO das colunas de
 *     perfis_cuidados (sem coordenadas, raio, id nem datas — ver private.snapshot_perfil) e pode
 *     estar minimizada ({nome, idade, minimizado_em}) depois de o pedido ser cancelado/recusado:
 *     nesse caso devolvemos PerfilMinimizado em vez de inventar grau/necessidades;
 *   * owner_id e visualizacoes_30d não são legíveis pelos clientes: vêm de painel_instituicao();
 *   * DUAS FASES (RGPD art. 9.º): o lar só lê na tabela os pedidos que aceitou; a lista completa do
 *     painel vem de pedidos_recebidos() → pedidoRecebidoDeLinha (pedidos por aceitar só com o resumo
 *     sem identificação: nome, contacto, notas e mensagem nunca chegam ao navegador do lar).
 *     Na BD o contacto fica visível só com desbloqueada_em (recusar ou cancelar sem aceitar não o revela).
 */
import type {
  Candidatura,
  Caso,
  Comodidade,
  Cuidado,
  Distrito,
  EstadoCandidatura,
  Favorito,
  GrauDependencia,
  Lar,
  Notificacao,
  Organizacao,
  PerfilIdoso,
  ProcuraAnonima,
  Regiao,
  Review,
  RoomOffer,
  TaxaEntrada,
  TipoOrganizacao,
  TipoQuarto,
  User,
} from '@/types'
import type { Database, Json, Tables, TablesInsert, TablesUpdate } from './database.types'
import type { atualizarCaso, AvaliacaoInput, CasoInput, PerfilInput, RegisterInput } from './store'
import { LOCALIDADES, LUGARES } from '@/data/localidades'

export type InstituicaoPublicaRow = Tables<'instituicoes_publicas'>
export type AvaliacaoPublicaRow = Omit<Tables<'avaliacoes'>, 'user_id'>
export type PerfilCuidadosRow = Tables<'perfis_cuidados'>
export type CandidaturaRow = Tables<'candidaturas'>
export type CandidaturaEventoRow = Tables<'candidatura_eventos'>
export type NotificacaoRow = Tables<'notificacoes'>
export type FavoritoRow = Tables<'favoritos'>
export type PerfilUtilizadorRow = Tables<'perfis_utilizador'>
export type PainelInstituicaoRow = Database['public']['Functions']['painel_instituicao']['Returns'][number]
export type CasoRow = Tables<'casos'>
type Rpc = Database['public']['Functions']
export type PedidoRecebidoRow = Rpc['pedidos_recebidos']['Returns'][number]
export type ProcuraNaZonaRow = Rpc['procura_na_zona']['Returns'][number]
export type VagasPorTokenRow = Rpc['vagas_por_token']['Returns'][number]
export type MinhaAvaliacaoRow = Rpc['minhas_avaliacoes']['Returns'][number]
/** Argumentos de uma RPC, para supabase.rpc(nome, args). */
export type ArgsRpc<N extends keyof Rpc> = Rpc[N]['Args']

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
/** Ordena por data ISO (mais antiga primeiro), comparando instantes e não texto. */
const porData = (a: string, b: string) => Date.parse(a) - Date.parse(b)

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

/** Dados do dono (painel_instituicao) que a vista pública não expõe. */
export interface DadosDoDono {
  /** auth.uid() do gestor, quando a ficha é a da sessão atual */
  ownerId?: string
  visualizacoes30d?: number
}

/**
 * Linha de instituicoes_publicas → Lar. As avaliações (texto) carregam-se à parte e ficam da mais
 * recente para a mais antiga (como no protótipo). ownerId/visualizacoes30d só para a ficha do
 * próprio gestor (painel_instituicao); nas restantes ficam undefined/0.
 */
export function larDeLinha(r: InstituicaoPublicaRow, reviews: Review[] = [], dono: DadosDoDono = {}): Lar {
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
    reviews: [...reviews].sort((a, b) => porData(b.data, a.data)),
    fundacao: num(r.fundacao, new Date().getFullYear()),
    atualizadoEm: isoObrigatorio(r.atualizado_em),
    capa: { hue: num(capa.hue as number, 152), variante: num(capa.variante as number) },
    ownerId: dono.ownerId,
    visualizacoes30d: dono.visualizacoes30d ?? 0,
  }
}

/** Resultado de painel_instituicao() (dono) → id da ficha gerida e dados internos. */
export function painelDeLinha(r: PainelInstituicaoRow, ownerId: string) {
  return {
    larId: r.id,
    publicado: r.publicado,
    verificacao: r.verificacao_estado,
    listaEsperaOffline: num(r.lista_espera_offline),
    listaEsperaOnline: num(r.lista_espera_online),
    dono: { ownerId, visualizacoes30d: num(r.visualizacoes_30d) } satisfies DadosDoDono,
  }
}

/**
 * Endereço do site como a ficha o aceita ("www.exemplo.pt") → com esquema, como a base de dados
 * exige (o CHECK ^https?:// também impede ligações javascript: no href). Vazio → null.
 */
export function normalizarWebsite(v: string | null | undefined): string | null {
  const w = v?.trim()
  if (!w) return null
  return /^https?:\/\//i.test(w) ? w : `https://${w}`
}

/**
 * Alterações à ficha (atualizarLar) → UPDATE em instituicoes, só com as colunas que o dono pode
 * escrever. Quartos, id, dono, publicação, verificação, agregados, frescura e lista de espera
 * (`listaEspera`: só o administrador mexe nas inscrições offline) não passam por aqui.
 * Mudar nome, morada, contactos, licença… numa ficha verificada fá-la voltar a "pendente" (servidor).
 */
export function larParaAtualizacao(patch: Partial<Omit<Lar, 'id' | 'ownerId'>>): TablesUpdate<'instituicoes'> {
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
  if ('website' in patch) u.website = normalizarWebsite(patch.website)
  if (patch.capacidade !== undefined) u.capacidade = patch.capacidade
  if (patch.estadiaMediaMeses !== undefined) u.estadia_media_meses = patch.estadiaMediaMeses
  if (patch.acordoSS !== undefined) u.acordo_ss = patch.acordoSS
  if (patch.incluido !== undefined) u.incluido = patch.incluido
  if (patch.extras !== undefined) u.extras = patch.extras
  if (patch.graus !== undefined) u.graus = patch.graus
  if (patch.cuidados !== undefined) u.cuidados = patch.cuidados
  if (patch.comodidades !== undefined) u.comodidades = patch.comodidades
  if (patch.equipa !== undefined) {
    // cuidadores e horas de médico são numeric(4,1) na BD (aceitam "4,5" e "7,5"); enfermeiros é inteiro
    u.equipa_cuidadores_por_10 = Math.round(patch.equipa.cuidadoresPor10 * 10) / 10
    u.equipa_enfermeiros = Math.round(patch.equipa.enfermeiros)
    u.equipa_medico_horas_semana = Math.round(patch.equipa.medicoHorasSemana * 10) / 10
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

type InstituicaoRegisto = NonNullable<RegisterInput['instituicao']>

const DISTRITO_REGIAO = Object.fromEntries(LOCALIDADES.map((l) => [l.distrito, l.regiao])) as Record<Distrito, Regiao>

/**
 * Registo de uma conta 'lar' (store.register) → ficha a inserir em instituicoes, com os mesmos
 * campos derivados do protótipo. id, dono (auth.uid()), publicação e verificação ficam a cargo do
 * servidor: a ficha nasce por publicar e "pendente". Inserir com .select('id') (o id é gerado).
 */
export function larParaInsercao(
  inst: InstituicaoRegisto,
  conta: { email: string; telefone?: string },
  aleatorio: () => number = Math.random,
): TablesInsert<'instituicoes'> {
  const lugar = LUGARES.find((l) => l.label === inst.lugar) ?? LUGARES[0]!
  const loc = LOCALIDADES.find((l) => l.concelho === lugar.label || l.nome === lugar.label)
  const nomeLugar = lugar.label.split(' — ')[0]!
  const r5 = (x: number) => Math.round(x * 1e5) / 1e5 // numeric(8,5)
  return {
    nome: inst.nome.trim(),
    tipo: inst.tipo,
    natureza: inst.natureza,
    morada: inst.morada?.trim() || '',
    codigo_postal: loc ? `${loc.cp}-000` : null,
    localidade: nomeLugar,
    concelho: loc?.concelho ?? nomeLugar,
    distrito: lugar.distrito,
    regiao: DISTRITO_REGIAO[lugar.distrito] ?? 'Norte',
    lat: r5(lugar.lat + 0.004),
    lng: r5(lugar.lng + 0.004),
    telefone: conta.telefone?.trim() || null,
    email: conta.email.trim().toLowerCase(),
    capacidade: capacidadeRegisto(inst),
    estadia_media_meses: 36,
    acordo_ss: false,
    incluido: ['Alojamento e todas as refeições', 'Higiene pessoal e apoio diário', 'Tratamento de roupa'],
    extras: [],
    graus: inst.tipo === 'residencia' ? ['autonomo', 'ligeira'] : ['ligeira', 'moderada'],
    cuidados: [],
    comodidades: [],
    licenca: inst.licenca.trim(),
    fundacao: new Date().getFullYear(),
    capa: { hue: Math.floor(aleatorio() * 360), variante: Math.floor(aleatorio() * 4) },
  }
}

const capacidadeRegisto = (inst: InstituicaoRegisto) => Math.max(1, Math.round(inst.capacidade || 1))

/** Primeiro tipo de quarto de uma ficha registada: individual, todos os lugares, preço "desde" (+20 % no máximo). */
export function quartoInicial(larId: string, inst: InstituicaoRegisto): TablesInsert<'quartos'> {
  const preco = Math.max(0, Math.round(inst.precoDesde || 0))
  return quartoParaInsercao(larId, { tipo: 'individual', total: capacidadeRegisto(inst), precoMin: preco, precoMax: Math.round(preco * 1.2) })
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

/** Cópia do perfil reduzida ao mínimo (pedido cancelado/recusado ou perfil apagado — RGPD). */
export interface PerfilMinimizado {
  minimizado: true
  nome: string
  idade: number
  minimizadoEm: string
}

export function snapshotMinimizado(v: Json | null | undefined): boolean {
  return typeof obj(v).minimizado_em === 'string'
}

/**
 * Linha de perfis_cuidados — ou a cópia (não minimizada) guardada numa candidatura — → PerfilIdoso.
 * A cópia não traz coordenadas nem raio (não são partilhados com a instituição): ficam NaN/15,
 * para que nenhuma distância seja calculada a partir de um local inventado.
 */
export function perfilDeLinha(r: PerfilCuidadosRow | Json, userId?: string): PerfilIdoso {
  const o = obj(r as Json)
  const coordenada = (v: Json | undefined) => (v == null ? Number.NaN : num(v as number))
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
    local: { label: texto(o.local_label), lat: coordenada(o.local_lat), lng: coordenada(o.local_lng) },
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

/** Pedido cuja cópia do perfil foi minimizada: só nome e idade; contacto só com o nome. */
export type CandidaturaMinimizada = Omit<Candidatura, 'perfil' | 'contacto'> & {
  perfil: PerfilMinimizado
  contacto: { nome: string; email?: undefined; telefone?: undefined }
}

export function eCandidaturaMinimizada(c: Candidatura | CandidaturaMinimizada): c is CandidaturaMinimizada {
  return 'minimizado' in c.perfil
}

/**
 * Linha de candidaturas (com candidatura_eventos embutidos) → Candidatura, ou CandidaturaMinimizada
 * se a cópia do perfil já tiver sido minimizada (use eCandidaturaMinimizada para distinguir).
 */
/** Colunas de candidaturas comuns à tabela e a pedidos_recebidos(). */
type CamposPedido = Pick<
  CandidaturaRow,
  | 'id' | 'instituicao_id' | 'estado' | 'posicao' | 'mensagem' | 'visita_data' | 'visita_hora' | 'visita_estado'
  | 'prazo_resposta' | 'created_at' | 'updated_at' | 'origem' | 'organizacao' | 'alta_prevista' | 'desbloqueada_em'
  | 'entrada_data' | 'entrada_confirmada_lar_em' | 'entrada_confirmada_familia_em' | 'entrada_taxa'
> & { user_id: string | null; caso_id?: string | null }

function camposComuns(r: CamposPedido, eventos: EventoMinimo[]) {
  const historico = [...eventos]
    .sort((a, b) => porData(a.created_at, b.created_at))
    .map((e) => ({ data: isoObrigatorio(e.created_at), estado: e.estado as EstadoCandidatura, nota: opcional(e.nota) }))
  return {
    id: r.id,
    larId: r.instituicao_id,
    userId: r.user_id ?? '',
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
    // ausente = 'familia' (como no protótipo)
    origem: r.origem === 'profissional' ? ('profissional' as const) : undefined,
    encaminhamento:
      r.origem === 'profissional'
        ? {
            casoId: r.caso_id ?? '',
            profissionalId: r.user_id ?? '',
            organizacao: r.organizacao ?? '',
            altaPrevista: opcional(r.alta_prevista),
          }
        : undefined,
    desbloqueadaEm: iso(r.desbloqueada_em),
    entrada:
      r.entrada_data && r.entrada_taxa
        ? {
            data: r.entrada_data,
            confirmadaLarEm: iso(r.entrada_confirmada_lar_em),
            confirmadaFamiliaEm: iso(r.entrada_confirmada_familia_em),
            taxa: r.entrada_taxa as TaxaEntrada,
          }
        : undefined,
  }
}

export function candidaturaDeLinha(
  r: CandidaturaRow & { candidatura_eventos?: EventoMinimo[] | null },
): Candidatura | CandidaturaMinimizada {
  const contacto = obj(r.contacto)
  const comum = camposComuns(r, r.candidatura_eventos ?? [])
  if (snapshotMinimizado(r.perfil_snapshot)) {
    const o = obj(r.perfil_snapshot)
    return {
      ...comum,
      perfilId: r.perfil_id ?? '',
      perfil: { minimizado: true, nome: texto(o.nome), idade: num(o.idade as number), minimizadoEm: isoObrigatorio(texto(o.minimizado_em) || null) },
      contacto: { nome: texto(contacto.nome) },
    }
  }
  const perfil = perfilDeLinha(r.perfil_snapshot, r.user_id)
  return {
    ...comum,
    // a cópia não traz o id do perfil: o perfil de origem (null se entretanto foi apagado)
    perfilId: r.perfil_id ?? '',
    perfil: { ...perfil, id: r.perfil_id ?? '' },
    contacto: {
      nome: texto(contacto.nome),
      email: texto(contacto.email),
      telefone: typeof contacto.telefone === 'string' ? contacto.telefone : undefined,
    },
  }
}

/** '80–84' → 80, 'menos de 65' → 64, '95 ou mais' → 95: uma idade com a mesma faixa (faixaEtaria), nunca a real. */
export function idadeDaFaixa(faixa: string | null | undefined): number {
  if (!faixa) return 0
  if (faixa.startsWith('menos')) return 64
  const n = Number.parseInt(/\d+/.exec(faixa)?.[0] ?? '', 10)
  return Number.isNaN(n) ? 0 : n
}

/**
 * Linha de pedidos_recebidos() (painel do lar) → Candidatura.
 *   * pedido aceite (desbloqueada_em): igual a candidaturaDeLinha, com o histórico;
 *   * pedido por aceitar: só o resumo sem identificação. O perfil é reconstruído a partir dele, com
 *     nome, contacto, notas e mensagem VAZIOS (a BD não os envia) e uma idade da mesma faixa etária,
 *     para que resumoAnonimo(c) dê exatamente o que o protótipo mostra. Decida o que mostrar com
 *     `!!c.desbloqueadaEm` (a regra da BD), não com o estado;
 *   * pedido por aceitar já minimizado (cancelado/recusado): CandidaturaMinimizada sem nome.
 */
export function pedidoRecebidoDeLinha(r: PedidoRecebidoRow): Candidatura | CandidaturaMinimizada {
  const historico = lista(r.historico).map((e) => {
    const o = obj(e)
    return { estado: texto(o.estado) as EstadoCandidatura, nota: typeof o.nota === 'string' ? o.nota : null, created_at: texto(o.created_at) }
  })
  if (r.desbloqueada_em && r.perfil_snapshot != null && r.contacto != null) {
    return candidaturaDeLinha({
      ...r,
      user_id: r.user_id ?? '',
      perfil_id: r.perfil_id,
      perfil_snapshot: r.perfil_snapshot,
      contacto: r.contacto,
      caso_id: null,
      consentimento_em: r.created_at,
      candidatura_eventos: historico,
    })
  }
  const comum = camposComuns({ ...r, mensagem: null }, [])
  if (r.grau == null) {
    return {
      ...comum,
      perfilId: '',
      perfil: { minimizado: true, nome: '', idade: idadeDaFaixa(r.faixa_etaria), minimizadoEm: isoObrigatorio(r.updated_at) },
      contacto: { nome: '' },
    }
  }
  const quarto = r.quarto ?? 'indiferente'
  return {
    ...comum,
    perfilId: '',
    perfil: {
      id: '',
      userId: '',
      nome: '',
      idade: idadeDaFaixa(r.faixa_etaria),
      relacao: '',
      grau: r.grau,
      necessidades: (r.necessidades ?? []) as Cuidado[],
      preferencias: [],
      quarto: (['individual', 'duplo', 'casal'].includes(quarto) ? quarto : 'indiferente') as PerfilIdoso['quarto'],
      local: { label: r.zona ?? '', lat: Number.NaN, lng: Number.NaN },
      raioKm: 15,
      orcamentoMax: num(r.orcamento_max),
      urgencia: r.urgencia ?? '1-3meses',
      precisaAcordoSS: r.precisa_acordo_ss === true,
      notas: undefined,
      criadoEm: isoObrigatorio(r.created_at),
      atualizadoEm: isoObrigatorio(r.updated_at),
    },
    contacto: { nome: '', email: '' },
  }
}

// ————————————————————————————————————————— casos (profissionais)

export function casoDeLinha(r: CasoRow): Caso {
  return {
    id: r.id,
    profissionalId: r.profissional_id,
    perfilId: r.perfil_id,
    referencia: opcional(r.referencia),
    altaPrevista: opcional(r.alta_prevista),
    consentimento: !!r.consentimento_em,
    estado: r.estado,
    criadoEm: isoObrigatorio(r.created_at),
    atualizadoEm: isoObrigatorio(r.updated_at),
  }
}

/** criarCaso(input) → argumentos de criar_caso (o perfil vai como as colunas de perfis_cuidados). */
export function casoParaCriacao(input: CasoInput): ArgsRpc<'criar_caso'> {
  return {
    p_perfil: perfilParaLinha(input.perfil) as unknown as Json,
    p_referencia: input.referencia?.trim() || undefined,
    p_alta_prevista: input.altaPrevista || undefined,
    p_consentimento: input.consentimento,
  }
}

/** Partes de um PerfilInput → colunas de perfis_cuidados (só as indicadas). */
export function perfilParcialParaLinha(p: Partial<PerfilInput>): TablesUpdate<'perfis_cuidados'> {
  const u: TablesUpdate<'perfis_cuidados'> = {}
  if (p.nome !== undefined) u.nome = p.nome
  if (p.idade !== undefined) u.idade = p.idade
  if (p.relacao !== undefined) u.relacao = p.relacao
  if ('genero' in p) u.genero = p.genero ?? null
  if (p.grau !== undefined) u.grau = p.grau
  if (p.necessidades !== undefined) u.necessidades = p.necessidades
  if (p.preferencias !== undefined) u.preferencias = p.preferencias
  if (p.quarto !== undefined) u.quarto = p.quarto
  if (p.local !== undefined) {
    u.local_label = p.local.label
    u.local_lat = p.local.lat
    u.local_lng = p.local.lng
  }
  if (p.raioKm !== undefined) u.raio_km = p.raioKm
  if (p.orcamentoMax !== undefined) u.orcamento_max = p.orcamentoMax
  if (p.urgencia !== undefined) u.urgencia = p.urgencia
  if (p.precisaAcordoSS !== undefined) u.precisa_acordo_ss = p.precisaAcordoSS
  if ('notas' in p) u.notas = p.notas?.trim() || null
  return u
}

/** atualizarCaso(id, patch) → argumentos de atualizar_caso (só as chaves presentes mudam, como no protótipo). */
export function casoParaAtualizacao(casoId: string, patch: Parameters<typeof atualizarCaso>[1]): ArgsRpc<'atualizar_caso'> {
  const a: { [k: string]: Json } = {}
  if ('referencia' in patch) a.referencia = patch.referencia?.trim() || null
  if ('altaPrevista' in patch) a.alta_prevista = patch.altaPrevista || null
  if (patch.estado !== undefined) a.estado = patch.estado
  if (patch.perfil) a.perfil = perfilParcialParaLinha(patch.perfil) as unknown as Json
  return { p_caso_id: casoId, p_alteracoes: a }
}

// ————————————————————————————————————————— avaliação verificada

/** avaliarLar(candidaturaId, input) → argumentos de avaliar_lar (a BD exige notas inteiras de 1 a 5). */
export function avaliacaoParaRpc(candidaturaId: string, input: AvaliacaoInput): ArgsRpc<'avaliar_lar'> {
  return {
    p_candidatura_id: candidaturaId,
    p_nota: Math.round(input.nota),
    p_texto: input.texto.trim(),
    p_aspetos: {
      cuidados: Math.round(input.aspetos.cuidados),
      alimentacao: Math.round(input.aspetos.alimentacao),
      instalacoes: Math.round(input.aspetos.instalacoes),
      comunicacao: Math.round(input.aspetos.comunicacao),
    },
  }
}

// ————————————————————————————————————————— procura sem resposta (anónima)

/** registarProcura(p) → argumentos de registar_procura. */
export function procuraParaRpc(p: Omit<ProcuraAnonima, 'id' | 'criadaEm'>): ArgsRpc<'registar_procura'> {
  return {
    p_distrito: p.distrito,
    p_lugar: p.lugar,
    p_grau: p.grau,
    p_cuidados: [...new Set(p.cuidados)],
    p_orcamento_max: p.orcamentoMax,
    p_resultados: p.resultados,
    p_com_vaga: p.comVaga,
  }
}

/** Igual ao que resumirProcuras (src/lib/negocio.ts) devolve no protótipo. */
export interface ResumoProcuras {
  total: number
  cuidados: [Cuidado, number][]
  graus: [GrauDependencia, number][]
  orcamentoMediano: number | null
}

/** Linha de procura_na_zona() → resumo (o mesmo formato de resumirProcuras). Sem linha (não gere uma ficha): vazio. */
export function procuraNaZonaDeLinha(r: ProcuraNaZonaRow | undefined): ResumoProcuras {
  if (!r) return { total: 0, cuidados: [], graus: [], orcamentoMediano: null }
  return {
    total: num(r.total),
    cuidados: lista(r.cuidados).map((x) => [texto(obj(x).cuidado) as Cuidado, num(obj(x).total as number)]),
    graus: lista(r.graus).map((x) => [texto(obj(x).grau) as GrauDependencia, num(obj(x).total as number)]),
    orcamentoMediano: r.orcamento_mediano == null ? null : num(r.orcamento_mediano),
  }
}

// ————————————————————————————————————————— link de confirmação das vagas (sem sessão)

/** Linha de vagas_por_token / confirmar_vagas_por_token → o que a página /confirmar/:token mostra. */
export function vagasPorTokenDeLinha(r: VagasPorTokenRow) {
  return {
    larId: r.instituicao_id,
    nome: r.nome,
    quartos: lista(r.quartos).map((q) => {
      const o = obj(q)
      return { tipo: texto(o.tipo, 'individual') as TipoQuarto, total: num(o.total as number), livres: num(o.livres as number) }
    }),
    vagasLivres: num(r.vagas_livres),
    atualizadoEm: isoObrigatorio(r.atualizado_em),
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
export function utilizadorDeLinha(
  r: Omit<PerfilUtilizadorRow, 'demonstracao' | 'organizacao'> & { demonstracao?: boolean; organizacao?: Json | null },
  email: string,
  larId?: string,
): User {
  return {
    id: r.id,
    role: r.role,
    nome: r.nome,
    email,
    passwordHash: '',
    telefone: opcional(r.telefone),
    criadoEm: isoObrigatorio(r.created_at),
    larId,
    organizacao: r.role === 'profissional' ? organizacaoDeJson(r.organizacao) : undefined,
    demo: r.demonstracao || undefined,
  }
}

const TIPOS_ORGANIZACAO: TipoOrganizacao[] = ['hospital', 'centro_saude', 'autarquia', 'outro']

/** perfis_utilizador.organizacao → Organizacao (undefined se não houver). */
export function organizacaoDeJson(v: Json | null | undefined): Organizacao | undefined {
  const o = obj(v)
  const nome = texto(o.nome).trim()
  if (!nome) return undefined
  const tipo = TIPOS_ORGANIZACAO.find((t) => t === o.tipo) ?? 'outro'
  return { nome, tipo, servico: typeof o.servico === 'string' && o.servico.trim() ? o.servico.trim() : undefined }
}

/**
 * Registo (store.register) → user_metadata de supabase.auth.signUp({ options: { data } }). O trigger
 * de registo lê o papel ('familia' | 'lar' | 'profissional') e a organização UMA vez; depois só o
 * administrador os muda (app_metadata). A organização é validada no servidor.
 */
export function dadosRegisto(input: Pick<RegisterInput, 'role' | 'nome' | 'telefone' | 'organizacao'>): { [k: string]: Json } {
  const org = input.role === 'profissional' ? input.organizacao : undefined
  return {
    role: input.role,
    nome: input.nome.trim(),
    ...(input.telefone?.trim() ? { telefone: input.telefone.trim() } : {}),
    ...(org?.nome.trim()
      ? { organizacao: { nome: org.nome.trim(), tipo: org.tipo, ...(org.servico?.trim() ? { servico: org.servico.trim() } : {}) } }
      : {}),
  }
}
