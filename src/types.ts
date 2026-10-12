// Modelo de dados do EncontraLar.
// Nomes em português para alinhar com o domínio (ERPI, Segurança Social, grau de dependência…).

export type TipoResposta = 'erpi' | 'residencia' | 'centro_dia'
export type Natureza = 'ipss' | 'misericordia' | 'privado'
export type GrauDependencia = 'autonomo' | 'ligeira' | 'moderada' | 'grave'
export type TipoQuarto = 'individual' | 'duplo' | 'casal'

export type Regiao = 'Norte' | 'Centro' | 'Lisboa e Vale do Tejo' | 'Alentejo' | 'Algarve' | 'Madeira' | 'Açores'

export type Distrito =
  | 'Aveiro' | 'Beja' | 'Braga' | 'Bragança' | 'Castelo Branco' | 'Coimbra' | 'Évora' | 'Faro'
  | 'Guarda' | 'Leiria' | 'Lisboa' | 'Portalegre' | 'Porto' | 'Santarém' | 'Setúbal'
  | 'Viana do Castelo' | 'Vila Real' | 'Viseu' | 'Madeira' | 'Açores'

/** Cuidados de saúde e apoio especializado. */
export type Cuidado =
  | 'enfermagem24h'
  | 'medico'
  | 'fisioterapia'
  | 'demencia'
  | 'paliativos'
  | 'acamados'
  | 'diabetes'
  | 'oxigenio'
  | 'terapia_ocupacional'
  | 'psicologia'
  | 'nutricao'
  | 'terapia_fala'

/** Comodidades e características da instituição. */
export type Comodidade =
  | 'jardim'
  | 'animais'
  | 'quarto_wc'
  | 'climatizacao'
  | 'wifi'
  | 'capela'
  | 'cabeleireiro'
  | 'transporte'
  | 'atividades'
  | 'visitas_livres'
  | 'cozinha_propria'
  | 'piscina'
  | 'lavandaria'

export interface RoomOffer {
  tipo: TipoQuarto
  /** camas/lugares deste tipo */
  total: number
  /** lugares livres neste momento */
  livres: number
  /** mensalidade por pessoa (€) */
  precoMin: number
  precoMax: number
}

export interface Review {
  id: string
  autor: string
  /** ex.: "Filha de residente" */
  relacao: string
  data: string // ISO
  nota: number // 1–5
  texto: string
  verificada: boolean
  aspetos: { cuidados: number; alimentacao: number; instalacoes: number; comunicacao: number }
}

export type EstadoVerificacao = 'verificado' | 'pendente' | 'nao_verificado'

export interface Lar {
  id: string
  nome: string
  tipo: TipoResposta
  natureza: Natureza
  /** uma frase */
  resumo: string
  /** 2–3 parágrafos separados por \n\n */
  descricao: string
  morada: string
  codigoPostal: string
  localidade: string
  concelho: string
  distrito: Distrito
  regiao: Regiao
  lat: number
  lng: number
  telefone: string
  email: string
  website?: string
  /** capacidade total licenciada */
  capacidade: number
  quartos: RoomOffer[]
  /** pessoas inscritas na lista de espera */
  listaEspera: number
  /** estadia média dos residentes, em meses (base da previsão) */
  estadiaMediaMeses: number
  /** saídas registadas por mês nos últimos 12 meses (mais antigo → mais recente) */
  historicoSaidas: number[]
  mensalidadeMin: number
  mensalidadeMax: number
  /** tem vagas com acordo de cooperação com a Segurança Social (comparticipação) */
  acordoSS: boolean
  incluido: string[]
  extras: { nome: string; preco: string }[]
  graus: GrauDependencia[]
  cuidados: Cuidado[]
  comodidades: Comodidade[]
  equipa: { cuidadoresPor10: number; enfermeiros: number; medicoHorasSemana: number }
  verificacao: {
    estado: EstadoVerificacao
    /** data da última auditoria presencial EncontraLar */
    data?: string
    /** nº de alvará/licença de funcionamento */
    licenca: string
    ultimaInspecao?: string
  }
  avaliacao: number
  numAvaliacoes: number
  reviews: Review[]
  fundacao: number
  /** última atualização das vagas pela instituição (ISO) — sinal de confiança */
  atualizadoEm: string
  /** parâmetros da ilustração de capa */
  capa: { hue: number; variante: number }
  /** utilizador (role 'lar') que gere esta ficha */
  ownerId?: string
  /** visualizações da ficha nos últimos 30 dias (painel do lar) */
  visualizacoes30d: number
}

export type Role = 'familia' | 'lar'

export interface User {
  id: string
  role: Role
  nome: string
  email: string
  passwordHash: string
  telefone?: string
  criadoEm: string
  /** para role 'lar': instituição gerida */
  larId?: string
  /** utilizadores de demonstração (mostrados no login) */
  demo?: boolean
}

export type Urgencia = 'imediata' | '1-3meses' | '3-6meses' | 'planeamento'

/** Perfil da pessoa idosa para quem se procura lar (dados sensíveis — RGPD art. 9.º). */
export interface PerfilIdoso {
  id: string
  userId: string
  nome: string
  idade: number
  /** relação com o utilizador: "Mãe", "Pai", "Avó"… */
  relacao: string
  genero?: 'F' | 'M'
  grau: GrauDependencia
  necessidades: Cuidado[]
  preferencias: Comodidade[]
  quarto: TipoQuarto | 'indiferente'
  /** centro da pesquisa */
  local: { label: string; lat: number; lng: number }
  raioKm: number
  orcamentoMax: number
  urgencia: Urgencia
  /** precisa de vaga com comparticipação da Segurança Social */
  precisaAcordoSS: boolean
  notas?: string
  criadoEm: string
  atualizadoEm: string
}

export type EstadoCandidatura =
  | 'enviada'
  | 'em_analise'
  | 'lista_espera'
  | 'vaga_proposta'
  | 'aceite'
  | 'recusada'
  | 'cancelada'

export interface Candidatura {
  id: string
  larId: string
  userId: string
  perfilId: string
  /** cópia do perfil no momento da candidatura (o lar vê esta versão) */
  perfil: PerfilIdoso
  /** nome/contacto do familiar responsável, para o lar */
  contacto: { nome: string; email: string; telefone?: string }
  estado: EstadoCandidatura
  /** posição na lista de espera (quando estado = lista_espera) */
  posicao?: number
  mensagem?: string
  visita?: { data: string; hora: string; estado: 'pedida' | 'confirmada' | 'realizada' }
  /** prazo para responder a uma vaga proposta (ISO) */
  prazoResposta?: string
  criadaEm: string
  atualizadaEm: string
  historico: { data: string; estado: EstadoCandidatura; nota?: string }[]
}

export type TipoNotificacao = 'vaga' | 'candidatura' | 'visita' | 'sistema'

export interface Notificacao {
  id: string
  userId: string
  tipo: TipoNotificacao
  titulo: string
  texto: string
  larId?: string
  candidaturaId?: string
  /** rota interna para onde a notificação leva */
  link?: string
  lida: boolean
  criadaEm: string
}

export interface Favorito {
  userId: string
  larId: string
  /** avisar quando houver vaga */
  alerta: boolean
  criadoEm: string
}

export interface DB {
  version: number
  seededAt: string
  users: User[]
  lares: Lar[]
  perfis: PerfilIdoso[]
  candidaturas: Candidatura[]
  favoritos: Favorito[]
  notificacoes: Notificacao[]
}

/** Estado de disponibilidade calculado a partir das vagas e da previsão. */
export type Disponibilidade = 'disponivel' | 'breve' | 'espera'
