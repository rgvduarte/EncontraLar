import type {
  Comodidade,
  Cuidado,
  Disponibilidade,
  EstadoCandidatura,
  GrauDependencia,
  Natureza,
  TipoQuarto,
  TipoResposta,
  Urgencia,
} from '@/types'

export const TIPO_LABEL: Record<TipoResposta, string> = {
  erpi: 'Lar (ERPI)',
  residencia: 'Residência sénior',
  centro_dia: 'Centro de dia',
}

export const TIPO_DESCRICAO: Record<TipoResposta, string> = {
  erpi:
    'Estrutura Residencial para Pessoas Idosas: alojamento permanente ou temporário com cuidados diários, refeições, higiene e apoio de saúde.',
  residencia:
    'Residência privada, geralmente com apartamentos ou quartos amplos e serviços de tipo hoteleiro. Indicada sobretudo para pessoas autónomas ou com pouca dependência.',
  centro_dia:
    'Resposta diurna: a pessoa passa o dia no centro (refeições, atividades, cuidados) e regressa a casa ao fim do dia.',
}

export const NATUREZA_LABEL: Record<Natureza, string> = {
  ipss: 'IPSS',
  misericordia: 'Misericórdia',
  privado: 'Privado',
}

export const NATUREZA_DESCRICAO: Record<Natureza, string> = {
  ipss: 'Instituição Particular de Solidariedade Social, sem fins lucrativos. A mensalidade depende normalmente dos rendimentos do agregado.',
  misericordia: 'Santa Casa da Misericórdia local, instituição sem fins lucrativos. A mensalidade depende normalmente dos rendimentos.',
  privado: 'Entidade privada com fins lucrativos. Preço fixo por tipo de quarto e nível de cuidados.',
}

export const GRAU_LABEL: Record<GrauDependencia, string> = {
  autonomo: 'Autónomo',
  ligeira: 'Dependência ligeira',
  moderada: 'Dependência moderada',
  grave: 'Dependência grave',
}

export const GRAU_DESCRICAO: Record<GrauDependencia, string> = {
  autonomo: 'Faz a sua vida sozinho(a); procura sobretudo companhia, segurança e conforto.',
  ligeira: 'Precisa de ajuda pontual — por exemplo no banho, na medicação ou a sair de casa.',
  moderada: 'Precisa de ajuda diária em várias tarefas (vestir, higiene, deslocações) ou tem demência inicial.',
  grave: 'Precisa de apoio permanente: está acamado(a), tem mobilidade muito reduzida ou demência avançada.',
}

export const GRAUS_ORDEM: GrauDependencia[] = ['autonomo', 'ligeira', 'moderada', 'grave']

export const CUIDADO_LABEL: Record<Cuidado, string> = {
  enfermagem24h: 'Enfermagem 24 horas',
  medico: 'Acompanhamento médico',
  fisioterapia: 'Fisioterapia',
  demencia: 'Demência e Alzheimer',
  paliativos: 'Cuidados paliativos',
  acamados: 'Pessoas acamadas',
  diabetes: 'Gestão de diabetes',
  oxigenio: 'Oxigenoterapia',
  terapia_ocupacional: 'Terapia ocupacional',
  psicologia: 'Psicologia',
  nutricao: 'Nutricionista e dietas',
  terapia_fala: 'Terapia da fala',
}

/** Necessidades que, se não forem asseguradas, tornam o lar inadequado. */
export const CUIDADOS_CRITICOS: Cuidado[] = ['enfermagem24h', 'demencia', 'paliativos', 'acamados', 'oxigenio']

export const CUIDADOS_ORDEM: Cuidado[] = [
  'enfermagem24h',
  'demencia',
  'acamados',
  'fisioterapia',
  'medico',
  'diabetes',
  'paliativos',
  'oxigenio',
  'terapia_ocupacional',
  'psicologia',
  'nutricao',
  'terapia_fala',
]

export const COMODIDADE_LABEL: Record<Comodidade, string> = {
  jardim: 'Jardim / espaço exterior',
  animais: 'Aceita animais de estimação',
  quarto_wc: 'Casa de banho privativa',
  climatizacao: 'Climatização',
  wifi: 'Wi-Fi',
  capela: 'Capela / apoio espiritual',
  cabeleireiro: 'Cabeleireiro',
  transporte: 'Transporte para consultas',
  atividades: 'Atividades diárias',
  visitas_livres: 'Visitas sem horário fixo',
  cozinha_propria: 'Cozinha própria',
  piscina: 'Piscina / hidroterapia',
  lavandaria: 'Lavandaria incluída',
}

export const COMODIDADES_ORDEM: Comodidade[] = [
  'quarto_wc',
  'jardim',
  'visitas_livres',
  'atividades',
  'animais',
  'climatizacao',
  'cozinha_propria',
  'transporte',
  'capela',
  'cabeleireiro',
  'lavandaria',
  'wifi',
  'piscina',
]

export const QUARTO_LABEL: Record<TipoQuarto, string> = {
  individual: 'Quarto individual',
  duplo: 'Quarto duplo (partilhado)',
  casal: 'Quarto para casal',
}

export const QUARTO_CURTO: Record<TipoQuarto, string> = {
  individual: 'Individual',
  duplo: 'Duplo',
  casal: 'Casal',
}

export const URGENCIA_LABEL: Record<Urgencia, string> = {
  imediata: 'O mais depressa possível',
  '1-3meses': 'Nos próximos 1 a 3 meses',
  '3-6meses': 'Dentro de 3 a 6 meses',
  planeamento: 'Estou só a planear com tempo',
}

export const DISPONIBILIDADE_LABEL: Record<Disponibilidade, string> = {
  disponivel: 'Vaga disponível',
  breve: 'Vaga prevista em breve',
  espera: 'Lista de espera',
}

export const DISPONIBILIDADE_DESCRICAO: Record<Disponibilidade, string> = {
  disponivel: 'A instituição indicou ter pelo menos um lugar livre neste momento.',
  breve: 'Sem lugares livres hoje, mas a previsão indica boa probabilidade de vaga nos próximos 3 meses.',
  espera: 'Sem lugares livres e com procura elevada. Pode inscrever-se na lista de espera.',
}

export const ESTADO_CANDIDATURA_LABEL: Record<EstadoCandidatura, string> = {
  enviada: 'Pedido enviado',
  em_analise: 'Em análise',
  lista_espera: 'Em lista de espera',
  vaga_proposta: 'Vaga proposta',
  aceite: 'Vaga aceite',
  recusada: 'Não foi possível',
  cancelada: 'Cancelada',
}

export const ESTADO_CANDIDATURA_DESCRICAO: Record<EstadoCandidatura, string> = {
  enviada: 'A instituição recebeu o pedido e vai analisá-lo.',
  em_analise: 'A equipa técnica está a avaliar o perfil e pode contactá-lo.',
  lista_espera: 'O pedido foi aceite para a lista de espera. Será avisado quando houver vaga.',
  vaga_proposta: 'Há uma vaga para si! Responda dentro do prazo indicado.',
  aceite: 'Vaga confirmada. A instituição vai combinar a data de entrada.',
  recusada: 'A instituição não tem condições para este perfil neste momento.',
  cancelada: 'Este pedido foi cancelado.',
}

export const RELACOES = ['Mãe', 'Pai', 'Avó', 'Avô', 'Sogra', 'Sogro', 'Tia', 'Tio', 'Cônjuge', 'Eu próprio(a)', 'Outro familiar', 'Amigo(a)'] as const
