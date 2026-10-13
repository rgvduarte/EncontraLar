/**
 * Tipos da base de dados Supabase (schema public), no formato que o supabase-js espera.
 *
 * ESCRITOS À MÃO a partir de supabase/migrations/*.sql enquanto o projeto não está ligado.
 * Assim que o MCP do Supabase estiver autenticado, regenerar com a ferramenta
 * `generate_typescript_types` (ou `supabase gen types typescript --project-id kdyvsxzputvuyauddmwg`)
 * e substituir este ficheiro — ver docs/SUPABASE.md, secção "Regenerar os tipos".
 *
 * Convenções iguais às do gerador: numeric → number, timestamptz/date/time → string,
 * colunas de vistas → anuláveis, identity "generated always" → `?: never` no Insert/Update.
 * Os domínios lista_cuidados/lista_comodidades/distrito/regiao aparecem como o tipo base (string/string[]).
 *
 * Atenção (como no ficheiro gerado, os tipos não refletem privilégios por coluna):
 *   * instituicoes.owner_id e visualizacoes_30d NÃO são legíveis por anon/authenticated — selecione
 *     colunas explícitas; o dono obtém-nas pela RPC painel_instituicao();
 *   * candidatura_eventos.autor_id, avaliacoes.user_id e avaliacoes.candidatura_id também não são legíveis
 *     (o autor obtém as suas avaliações com minhas_avaliacoes());
 *   * instituicoes.confirmacao_token_hash/confirmacao_token_expira_em não são legíveis (só o hash do link);
 *   * instituicoes.plano/plano_desde (modalidade dos lares privados) não são legíveis nem graváveis: o dono
 *     lê-as em painel_instituicao() e muda-as com escolher_plano_instituicao(); a equipa lê-as em painel_equipa();
 *   * visitas só é legível por contas 'equipa' (do mesmo "mundo") e só se escreve por registar_visita();
 *   * candidaturas: o LAR só lê as linhas que aceitou (desbloqueada_em); antes disso usa a RPC
 *     pedidos_recebidos(), que devolve o resumo sem identificação;
 *   * procuras_anonimas não é legível nem gravável pelos clientes (registar_procura / procura_na_zona);
 *   * publicado, demonstracao, lista_espera_offline e os campos de verificação (incluindo
 *     licenca_confirmada_em, que é legível) não são graváveis pelos clientes (só pelo servidor/administrador);
 *   * ACESSO FAMÍLIA (20261013110000): a camada completa de instituicoes (morada, codigo_postal, telefone, email,
 *     website, lista_espera_offline/online, estadia_media_meses, extras, atualizado_em, updated_at) não é legível
 *     por anon/authenticated — use instituicoes_completas() (acesso completo; o dono, a sua ficha). quartos,
 *     saidas_mensais e avaliacoes não são legíveis por anon e, para as contas, só com acesso completo (RLS; o dono
 *     lê os da sua ficha, o autor a sua avaliação). A versão grátis usa instituicoes_publicas,
 *     disponibilidade_agregada() e avaliacoes_instituicao(). acessos_familia: o próprio lê a sua linha; só o
 *     servidor escreve (private.estender_acesso).
 *   * FATURAÇÃO (20261013120000): nenhum cliente escreve nestas tabelas (só as funções do servidor). O dono do lar
 *     lê as suas linhas de contratos (sem notas), dados_faturacao (sem as colunas stripe_ e moloni_), contestacoes_entrada,
 *     subscricoes_instituicao (sem stripe_subscription_id), faturas (sem rascunhos nem as colunas stripe_, tentativas,
 *     divergente) e fatura_linhas; a família as suas pagamentos_familia (sem as colunas stripe_ nem demonstracao) e
 *     consentimentos_acesso (sem user_id/ip_truncado). documentos_fiscais: só emitidos, o lar as suas FT/RC e a
 *     família as suas FR, e só id, tipo, origem, estado, numero, data, emitido_em, total_centimos, iva_centimos,
 *     fatura_id e pagamento_id. stripe_eventos não é legível. A página Faturação usa faturacao_resumo() →
 *     faturacaoDeResumo; as funções servico_… e resolver_contestacao são só da service_role (Edge Functions).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type FK<Nome extends string, Coluna extends string, Destino extends string, ColunaDestino extends string = 'id'> = {
  foreignKeyName: Nome
  columns: [Coluna]
  isOneToOne: false
  referencedRelation: Destino
  referencedColumns: [ColunaDestino]
}

/** Linha de pedidos_recebidos(): resumo sempre; user_id…historico só depois de o lar aceitar (null antes). */
type PedidoRecebido = {
  id: string
  instituicao_id: string
  estado: Database['public']['Enums']['estado_candidatura']
  posicao: number | null
  origem: Database['public']['Enums']['origem_pedido']
  organizacao: string | null
  alta_prevista: string | null
  faixa_etaria: string | null
  grau: Database['public']['Enums']['grau_dependencia'] | null
  necessidades: string[]
  zona: string | null
  orcamento_max: number | null
  urgencia: Database['public']['Enums']['urgencia'] | null
  quarto: string | null
  precisa_acordo_ss: boolean | null
  visita_data: string | null
  visita_hora: string | null
  visita_estado: Database['public']['Enums']['estado_visita'] | null
  prazo_resposta: string | null
  desbloqueada_em: string | null
  entrada_data: string | null
  entrada_confirmada_lar_em: string | null
  entrada_confirmada_familia_em: string | null
  entrada_taxa: Database['public']['Enums']['taxa_entrada'] | null
  created_at: string
  updated_at: string
  user_id: string | null
  perfil_id: string | null
  contacto: Json | null
  perfil_snapshot: Json | null
  mensagem: string | null
  historico: Json | null
}

/** Linha de vagas_por_token() / confirmar_vagas_por_token(): só a instituição do link. */
type VagasPorToken = {
  instituicao_id: string
  nome: string
  quartos: Json
  vagas_livres: number
  atualizado_em: string
}

/**
 * Linha de instituicoes_completas() (Acesso Família, profissionais, equipa; o dono, só a sua ficha): a ficha
 * inteira, com a forma da antiga vista pública (quartos com preços e livres, lista de espera, previsão, contactos).
 */
type InstituicaoCompleta = {
  id: string
  nome: string
  tipo: Database['public']['Enums']['tipo_resposta']
  natureza: Database['public']['Enums']['natureza']
  resumo: string
  descricao: string
  morada: string
  codigo_postal: string | null
  localidade: string
  concelho: string
  distrito: string
  regiao: string
  lat: number
  lng: number
  telefone: string | null
  email: string | null
  website: string | null
  capacidade: number
  lista_espera: number
  estadia_media_meses: number
  acordo_ss: boolean
  incluido: string[]
  extras: Json
  graus: Database['public']['Enums']['grau_dependencia'][]
  cuidados: string[]
  comodidades: string[]
  equipa_cuidadores_por_10: number
  equipa_enfermeiros: number
  equipa_medico_horas_semana: number
  licenca: string
  verificacao_estado: Database['public']['Enums']['estado_verificacao']
  verificacao_data: string | null
  ultima_inspecao: string | null
  avaliacao_media: number
  num_avaliacoes: number
  fundacao: number | null
  atualizado_em: string
  capa: Json
  publicado: boolean
  demonstracao: boolean
  vagas_livres: number
  mensalidade_min: number | null
  mensalidade_max: number | null
  quartos: Json
  historico_saidas: number[]
  licenca_confirmada_em: string | null
}

/**
 * Linha de avaliacoes_instituicao(): com acesso completo todas (excerto false, com as notas por aspeto); na
 * versão grátis no máximo uma, com o texto em excerto e sem as notas por aspeto (null; excerto true).
 */
type AvaliacaoInstituicao = {
  id: number
  instituicao_id: string
  autor: string
  relacao: string
  nota: number
  aspeto_cuidados: number | null
  aspeto_alimentacao: number | null
  aspeto_instalacoes: number | null
  aspeto_comunicacao: number | null
  texto: string
  verificada: boolean
  created_at: string
  excerto: boolean
}

/** Linha de escolher_plano_instituicao(): a modalidade em vigor depois da escolha (null = por entrada). */
type PlanoDaInstituicao = {
  instituicao_id: string
  plano: Database['public']['Enums']['plano_instituicao'] | null
  plano_desde: string | null
  compromisso_ate: string | null
}

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '12'
  }
  public: {
    Tables: {
      acessos_familia: {
        Row: {
          user_id: string
          plano: Database['public']['Enums']['plano_familia']
          ate: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          user_id: string
          plano: Database['public']['Enums']['plano_familia']
          ate: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          user_id?: string
          plano?: Database['public']['Enums']['plano_familia']
          ate?: string
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      avaliacoes: {
        Row: {
          id: number
          instituicao_id: string
          user_id: string | null
          autor: string
          relacao: string
          nota: number
          aspeto_cuidados: number
          aspeto_alimentacao: number
          aspeto_instalacoes: number
          aspeto_comunicacao: number
          texto: string
          verificada: boolean
          created_at: string
          candidatura_id: string | null
        }
        Insert: {
          id?: never
          instituicao_id: string
          user_id?: string | null
          candidatura_id?: string | null
          autor: string
          relacao?: string
          nota: number
          aspeto_cuidados: number
          aspeto_alimentacao: number
          aspeto_instalacoes: number
          aspeto_comunicacao: number
          texto: string
          verificada?: boolean
          created_at?: string
        }
        Update: {
          id?: never
          instituicao_id?: string
          user_id?: string | null
          candidatura_id?: string | null
          autor?: string
          relacao?: string
          nota?: number
          aspeto_cuidados?: number
          aspeto_alimentacao?: number
          aspeto_instalacoes?: number
          aspeto_comunicacao?: number
          texto?: string
          verificada?: boolean
          created_at?: string
        }
        Relationships: [
          FK<'avaliacoes_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'avaliacoes_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'avaliacoes_user_id_fkey', 'user_id', 'perfis_utilizador'>,
          FK<'avaliacoes_candidatura_id_fkey', 'candidatura_id', 'candidaturas'>,
        ]
      }
      candidatura_eventos: {
        Row: {
          id: number
          candidatura_id: string
          estado: Database['public']['Enums']['estado_candidatura']
          nota: string | null
          autor: string
          autor_id: string | null
          created_at: string
        }
        Insert: {
          id?: never
          candidatura_id: string
          estado: Database['public']['Enums']['estado_candidatura']
          nota?: string | null
          autor?: string
          autor_id?: string | null
          created_at?: string
        }
        Update: {
          id?: never
          candidatura_id?: string
          estado?: Database['public']['Enums']['estado_candidatura']
          nota?: string | null
          autor?: string
          autor_id?: string | null
          created_at?: string
        }
        Relationships: [
          FK<'candidatura_eventos_candidatura_id_fkey', 'candidatura_id', 'candidaturas'>,
          FK<'candidatura_eventos_autor_id_fkey', 'autor_id', 'perfis_utilizador'>,
        ]
      }
      candidaturas: {
        Row: {
          id: string
          instituicao_id: string
          user_id: string
          perfil_id: string | null
          perfil_snapshot: Json
          contacto: Json
          estado: Database['public']['Enums']['estado_candidatura']
          posicao: number | null
          mensagem: string | null
          visita_data: string | null
          visita_hora: string | null
          visita_estado: Database['public']['Enums']['estado_visita'] | null
          prazo_resposta: string | null
          consentimento_em: string
          created_at: string
          updated_at: string
          origem: Database['public']['Enums']['origem_pedido']
          caso_id: string | null
          organizacao: string | null
          alta_prevista: string | null
          desbloqueada_em: string | null
          entrada_data: string | null
          entrada_confirmada_lar_em: string | null
          entrada_confirmada_familia_em: string | null
          entrada_taxa: Database['public']['Enums']['taxa_entrada'] | null
        }
        Insert: {
          id?: string
          instituicao_id: string
          user_id: string
          perfil_id?: string | null
          perfil_snapshot: Json
          contacto: Json
          estado?: Database['public']['Enums']['estado_candidatura']
          posicao?: number | null
          mensagem?: string | null
          visita_data?: string | null
          visita_hora?: string | null
          visita_estado?: Database['public']['Enums']['estado_visita'] | null
          prazo_resposta?: string | null
          consentimento_em: string
          created_at?: string
          updated_at?: string
          origem?: Database['public']['Enums']['origem_pedido']
          caso_id?: string | null
          organizacao?: string | null
          alta_prevista?: string | null
          desbloqueada_em?: string | null
          entrada_data?: string | null
          entrada_confirmada_lar_em?: string | null
          entrada_confirmada_familia_em?: string | null
          entrada_taxa?: Database['public']['Enums']['taxa_entrada'] | null
        }
        Update: {
          id?: string
          instituicao_id?: string
          user_id?: string
          perfil_id?: string | null
          perfil_snapshot?: Json
          contacto?: Json
          estado?: Database['public']['Enums']['estado_candidatura']
          posicao?: number | null
          mensagem?: string | null
          visita_data?: string | null
          visita_hora?: string | null
          visita_estado?: Database['public']['Enums']['estado_visita'] | null
          prazo_resposta?: string | null
          consentimento_em?: string
          created_at?: string
          updated_at?: string
          origem?: Database['public']['Enums']['origem_pedido']
          caso_id?: string | null
          organizacao?: string | null
          alta_prevista?: string | null
          desbloqueada_em?: string | null
          entrada_data?: string | null
          entrada_confirmada_lar_em?: string | null
          entrada_confirmada_familia_em?: string | null
          entrada_taxa?: Database['public']['Enums']['taxa_entrada'] | null
        }
        Relationships: [
          FK<'candidaturas_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'candidaturas_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'candidaturas_user_id_fkey', 'user_id', 'perfis_utilizador'>,
          FK<'candidaturas_perfil_id_fkey', 'perfil_id', 'perfis_cuidados'>,
          FK<'candidaturas_caso_id_fkey', 'caso_id', 'casos'>,
        ]
      }
      casos: {
        Row: {
          id: string
          profissional_id: string
          perfil_id: string
          referencia: string | null
          alta_prevista: string | null
          consentimento_em: string
          estado: Database['public']['Enums']['estado_caso']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          profissional_id: string
          perfil_id: string
          referencia?: string | null
          alta_prevista?: string | null
          consentimento_em: string
          estado?: Database['public']['Enums']['estado_caso']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          profissional_id?: string
          perfil_id?: string
          referencia?: string | null
          alta_prevista?: string | null
          consentimento_em?: string
          estado?: Database['public']['Enums']['estado_caso']
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          FK<'casos_profissional_id_fkey', 'profissional_id', 'perfis_utilizador'>,
          FK<'casos_perfil_id_fkey', 'perfil_id', 'perfis_cuidados'>,
        ]
      }
      consentimentos_acesso: {
        Row: {
          id: string
          user_id: string | null
          pagamento_id: string
          plano: Database['public']['Enums']['plano_familia']
          texto_versao: string
          aceite_em: string
          ip_truncado: string | null
        }
        Insert: {
          id?: string
          user_id?: string | null
          pagamento_id: string
          plano: Database['public']['Enums']['plano_familia']
          texto_versao: string
          aceite_em?: string
          ip_truncado?: string | null
        }
        Update: {
          id?: string
          user_id?: string | null
          pagamento_id?: string
          plano?: Database['public']['Enums']['plano_familia']
          texto_versao?: string
          aceite_em?: string
          ip_truncado?: string | null
        }
        Relationships: [
          FK<'consentimentos_acesso_pagamento_id_fkey', 'pagamento_id', 'pagamentos_familia'>,
        ]
      }
      contestacoes_entrada: {
        Row: {
          candidatura_id: string
          instituicao_id: string
          estado: Database['public']['Enums']['estado_contestacao']
          motivo: string
          contestada_em: string
          resolvida_em: string | null
          nota_resolucao: string | null
        }
        Insert: {
          candidatura_id: string
          instituicao_id: string
          estado?: Database['public']['Enums']['estado_contestacao']
          motivo: string
          contestada_em?: string
          resolvida_em?: string | null
          nota_resolucao?: string | null
        }
        Update: {
          candidatura_id?: string
          instituicao_id?: string
          estado?: Database['public']['Enums']['estado_contestacao']
          motivo?: string
          contestada_em?: string
          resolvida_em?: string | null
          nota_resolucao?: string | null
        }
        Relationships: [
          FK<'contestacoes_entrada_candidatura_id_fkey', 'candidatura_id', 'candidaturas'>,
          FK<'contestacoes_entrada_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'contestacoes_entrada_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
        ]
      }
      contratos: {
        Row: {
          id: string
          instituicao_id: string
          referencia: string
          taxa_entrada_centimos: number
          iva_percent: number
          regiao_fiscal: Database['public']['Enums']['regiao_fiscal']
          inicio: string
          fim: string | null
          notas: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          instituicao_id: string
          referencia: string
          taxa_entrada_centimos?: number
          iva_percent?: number
          regiao_fiscal?: Database['public']['Enums']['regiao_fiscal']
          inicio: string
          fim?: string | null
          notas?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          instituicao_id?: string
          referencia?: string
          taxa_entrada_centimos?: number
          iva_percent?: number
          regiao_fiscal?: Database['public']['Enums']['regiao_fiscal']
          inicio?: string
          fim?: string | null
          notas?: string | null
          criado_em?: string
        }
        Relationships: [
          FK<'contratos_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'contratos_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
        ]
      }
      dados_faturacao: {
        Row: {
          instituicao_id: string
          razao_social: string
          nif: string
          morada: string
          codigo_postal: string
          localidade: string
          email: string
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
          moloni_cliente_id: string | null
          metodo_tipo: Database['public']['Enums']['metodo_pagamento_b2b'] | null
          metodo_ultimos4: string | null
          metodo_banco: string | null
          metodo_validade: string | null
          metodo_mandato_ref: string | null
          metodo_atualizado_em: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          instituicao_id: string
          razao_social: string
          nif: string
          morada: string
          codigo_postal: string
          localidade: string
          email: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          moloni_cliente_id?: string | null
          metodo_tipo?: Database['public']['Enums']['metodo_pagamento_b2b'] | null
          metodo_ultimos4?: string | null
          metodo_banco?: string | null
          metodo_validade?: string | null
          metodo_mandato_ref?: string | null
          metodo_atualizado_em?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          instituicao_id?: string
          razao_social?: string
          nif?: string
          morada?: string
          codigo_postal?: string
          localidade?: string
          email?: string
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
          moloni_cliente_id?: string | null
          metodo_tipo?: Database['public']['Enums']['metodo_pagamento_b2b'] | null
          metodo_ultimos4?: string | null
          metodo_banco?: string | null
          metodo_validade?: string | null
          metodo_mandato_ref?: string | null
          metodo_atualizado_em?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          FK<'dados_faturacao_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'dados_faturacao_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
        ]
      }
      documentos_fiscais: {
        Row: {
          id: string
          ordem: number
          tipo: Database['public']['Enums']['tipo_documento_fiscal']
          origem: Database['public']['Enums']['origem_documento']
          estado: Database['public']['Enums']['estado_documento_fiscal']
          chave: string
          instituicao_id: string | null
          user_id: string | null
          pagamento_id: string | null
          fatura_id: string | null
          documento_origem_id: string | null
          data: string
          vencimento: string | null
          cliente: Json
          linhas: Json
          pagamento: Json | null
          total_centimos: number
          iva_centimos: number
          numero: string | null
          externo_id: string | null
          emissor: Database['public']['Enums']['emissor_documento'] | null
          emitido_em: string | null
          tentativas: number
          ultimo_erro: string | null
          proxima_tentativa_em: string | null
          demonstracao: boolean
          criado_em: string
        }
        Insert: {
          id?: string
          ordem?: never
          tipo: Database['public']['Enums']['tipo_documento_fiscal']
          origem: Database['public']['Enums']['origem_documento']
          estado?: Database['public']['Enums']['estado_documento_fiscal']
          chave: string
          instituicao_id?: string | null
          user_id?: string | null
          pagamento_id?: string | null
          fatura_id?: string | null
          documento_origem_id?: string | null
          data: string
          vencimento?: string | null
          cliente: Json
          linhas?: Json
          pagamento?: Json | null
          total_centimos: number
          iva_centimos: number
          numero?: string | null
          externo_id?: string | null
          emissor?: Database['public']['Enums']['emissor_documento'] | null
          emitido_em?: string | null
          tentativas?: number
          ultimo_erro?: string | null
          proxima_tentativa_em?: string | null
          demonstracao?: boolean
          criado_em?: string
        }
        Update: {
          id?: string
          ordem?: never
          tipo?: Database['public']['Enums']['tipo_documento_fiscal']
          origem?: Database['public']['Enums']['origem_documento']
          estado?: Database['public']['Enums']['estado_documento_fiscal']
          chave?: string
          instituicao_id?: string | null
          user_id?: string | null
          pagamento_id?: string | null
          fatura_id?: string | null
          documento_origem_id?: string | null
          data?: string
          vencimento?: string | null
          cliente?: Json
          linhas?: Json
          pagamento?: Json | null
          total_centimos?: number
          iva_centimos?: number
          numero?: string | null
          externo_id?: string | null
          emissor?: Database['public']['Enums']['emissor_documento'] | null
          emitido_em?: string | null
          tentativas?: number
          ultimo_erro?: string | null
          proxima_tentativa_em?: string | null
          demonstracao?: boolean
          criado_em?: string
        }
        Relationships: [
          FK<'documentos_fiscais_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'documentos_fiscais_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'documentos_fiscais_pagamento_id_fkey', 'pagamento_id', 'pagamentos_familia'>,
          FK<'documentos_fiscais_fatura_id_fkey', 'fatura_id', 'faturas'>,
          FK<'documentos_fiscais_documento_origem_id_fkey', 'documento_origem_id', 'documentos_fiscais'>,
        ]
      }
      fatura_linhas: {
        Row: {
          id: string
          ordem: number
          instituicao_id: string
          candidatura_id: string | null
          fatura_id: string | null
          documento_id: string | null
          contrato_id: string | null
          referencia: string
          entrada_data: string
          faturavel_desde: string
          valor_centimos: number
          iva_percent: number
          iva_centimos: number
          total_centimos: number
          anulada_em: string | null
          motivo_anulacao: string | null
          criado_em: string
        }
        Insert: {
          id?: string
          ordem?: never
          instituicao_id: string
          candidatura_id?: string | null
          fatura_id?: string | null
          documento_id?: string | null
          contrato_id?: string | null
          referencia: string
          entrada_data: string
          faturavel_desde: string
          valor_centimos: number
          iva_percent: number
          iva_centimos: number
          total_centimos?: never
          anulada_em?: string | null
          motivo_anulacao?: string | null
          criado_em?: string
        }
        Update: {
          id?: string
          ordem?: never
          instituicao_id?: string
          candidatura_id?: string | null
          fatura_id?: string | null
          documento_id?: string | null
          contrato_id?: string | null
          referencia?: string
          entrada_data?: string
          faturavel_desde?: string
          valor_centimos?: number
          iva_percent?: number
          iva_centimos?: number
          total_centimos?: never
          anulada_em?: string | null
          motivo_anulacao?: string | null
          criado_em?: string
        }
        Relationships: [
          FK<'fatura_linhas_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'fatura_linhas_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'fatura_linhas_candidatura_id_fkey', 'candidatura_id', 'candidaturas'>,
          FK<'fatura_linhas_fatura_id_fkey', 'fatura_id', 'faturas'>,
          FK<'fatura_linhas_documento_id_fkey', 'documento_id', 'documentos_fiscais'>,
          FK<'fatura_linhas_contrato_id_fkey', 'contrato_id', 'contratos'>,
        ]
      }
      faturas: {
        Row: {
          id: string
          ordem: number
          instituicao_id: string
          origem: Database['public']['Enums']['origem_fatura']
          contrato_id: string | null
          periodo: string
          estado: Database['public']['Enums']['estado_fatura']
          modo_documento: Database['public']['Enums']['modo_documento'] | null
          cliente: Json | null
          subtotal_centimos: number
          iva_centimos: number
          total_centimos: number
          moeda: string
          cobranca: Database['public']['Enums']['cobranca_fatura']
          debito_em: string | null
          stripe_invoice_id: string | null
          stripe_subscription_id: string | null
          numero: string | null
          url_pagamento: string | null
          periodo_inicio: string | null
          periodo_fim: string | null
          emitida_em: string | null
          paga_em: string | null
          falhou_em: string | null
          anulada_em: string | null
          motivo_falha: Database['public']['Enums']['motivo_falha'] | null
          metodo_pago: string | null
          tentativas: number
          divergente: boolean
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          ordem?: never
          instituicao_id: string
          origem: Database['public']['Enums']['origem_fatura']
          contrato_id?: string | null
          periodo: string
          estado?: Database['public']['Enums']['estado_fatura']
          modo_documento?: Database['public']['Enums']['modo_documento'] | null
          cliente?: Json | null
          subtotal_centimos: number
          iva_centimos: number
          total_centimos: number
          moeda?: string
          cobranca?: Database['public']['Enums']['cobranca_fatura']
          debito_em?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          numero?: string | null
          url_pagamento?: string | null
          periodo_inicio?: string | null
          periodo_fim?: string | null
          emitida_em?: string | null
          paga_em?: string | null
          falhou_em?: string | null
          anulada_em?: string | null
          motivo_falha?: Database['public']['Enums']['motivo_falha'] | null
          metodo_pago?: string | null
          tentativas?: number
          divergente?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          ordem?: never
          instituicao_id?: string
          origem?: Database['public']['Enums']['origem_fatura']
          contrato_id?: string | null
          periodo?: string
          estado?: Database['public']['Enums']['estado_fatura']
          modo_documento?: Database['public']['Enums']['modo_documento'] | null
          cliente?: Json | null
          subtotal_centimos?: number
          iva_centimos?: number
          total_centimos?: number
          moeda?: string
          cobranca?: Database['public']['Enums']['cobranca_fatura']
          debito_em?: string | null
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          numero?: string | null
          url_pagamento?: string | null
          periodo_inicio?: string | null
          periodo_fim?: string | null
          emitida_em?: string | null
          paga_em?: string | null
          falhou_em?: string | null
          anulada_em?: string | null
          motivo_falha?: Database['public']['Enums']['motivo_falha'] | null
          metodo_pago?: string | null
          tentativas?: number
          divergente?: boolean
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          FK<'faturas_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'faturas_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'faturas_contrato_id_fkey', 'contrato_id', 'contratos'>,
        ]
      }
      favoritos: {
        Row: {
          user_id: string
          instituicao_id: string
          alerta: boolean
          created_at: string
        }
        Insert: {
          user_id?: string
          instituicao_id: string
          alerta?: boolean
          created_at?: string
        }
        Update: {
          user_id?: string
          instituicao_id?: string
          alerta?: boolean
          created_at?: string
        }
        Relationships: [
          FK<'favoritos_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'favoritos_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'favoritos_user_id_fkey', 'user_id', 'perfis_utilizador'>,
        ]
      }
      instituicoes: {
        Row: {
          id: string
          owner_id: string | null
          publicado: boolean
          demonstracao: boolean
          nome: string
          tipo: Database['public']['Enums']['tipo_resposta']
          natureza: Database['public']['Enums']['natureza']
          resumo: string
          descricao: string
          morada: string
          codigo_postal: string | null
          localidade: string
          concelho: string
          distrito: string
          regiao: string
          lat: number
          lng: number
          telefone: string | null
          email: string | null
          website: string | null
          capacidade: number
          lista_espera_offline: number
          lista_espera_online: number
          estadia_media_meses: number
          acordo_ss: boolean
          incluido: string[]
          extras: Json
          /** gerada: os nomes dos extras, sem os valores (pública) */
          extras_nomes: Json
          graus: Database['public']['Enums']['grau_dependencia'][]
          cuidados: string[]
          comodidades: string[]
          equipa_cuidadores_por_10: number
          equipa_enfermeiros: number
          equipa_medico_horas_semana: number
          licenca: string
          verificacao_estado: Database['public']['Enums']['estado_verificacao']
          verificacao_data: string | null
          licenca_confirmada_em: string | null
          ultima_inspecao: string | null
          avaliacao_media: number
          num_avaliacoes: number
          fundacao: number | null
          atualizado_em: string
          capa: Json
          visualizacoes_30d: number
          confirmacao_token_hash: string | null
          confirmacao_token_expira_em: string | null
          plano: Database['public']['Enums']['plano_instituicao'] | null
          plano_desde: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          publicado?: boolean
          demonstracao?: boolean
          nome: string
          tipo: Database['public']['Enums']['tipo_resposta']
          natureza: Database['public']['Enums']['natureza']
          resumo?: string
          descricao?: string
          morada?: string
          codigo_postal?: string | null
          localidade: string
          concelho: string
          distrito: string
          regiao: string
          lat: number
          lng: number
          telefone?: string | null
          email?: string | null
          website?: string | null
          capacidade: number
          lista_espera_offline?: number
          lista_espera_online?: number
          estadia_media_meses?: number
          acordo_ss?: boolean
          incluido?: string[]
          extras?: Json
          extras_nomes?: never
          graus?: Database['public']['Enums']['grau_dependencia'][]
          cuidados?: string[]
          comodidades?: string[]
          equipa_cuidadores_por_10?: number
          equipa_enfermeiros?: number
          equipa_medico_horas_semana?: number
          licenca?: string
          verificacao_estado?: Database['public']['Enums']['estado_verificacao']
          verificacao_data?: string | null
          licenca_confirmada_em?: string | null
          ultima_inspecao?: string | null
          avaliacao_media?: number
          num_avaliacoes?: number
          fundacao?: number | null
          atualizado_em?: string
          capa?: Json
          visualizacoes_30d?: number
          confirmacao_token_hash?: string | null
          confirmacao_token_expira_em?: string | null
          plano?: Database['public']['Enums']['plano_instituicao'] | null
          plano_desde?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string | null
          publicado?: boolean
          demonstracao?: boolean
          nome?: string
          tipo?: Database['public']['Enums']['tipo_resposta']
          natureza?: Database['public']['Enums']['natureza']
          resumo?: string
          descricao?: string
          morada?: string
          codigo_postal?: string | null
          localidade?: string
          concelho?: string
          distrito?: string
          regiao?: string
          lat?: number
          lng?: number
          telefone?: string | null
          email?: string | null
          website?: string | null
          capacidade?: number
          lista_espera_offline?: number
          lista_espera_online?: number
          estadia_media_meses?: number
          acordo_ss?: boolean
          incluido?: string[]
          extras?: Json
          extras_nomes?: never
          graus?: Database['public']['Enums']['grau_dependencia'][]
          cuidados?: string[]
          comodidades?: string[]
          equipa_cuidadores_por_10?: number
          equipa_enfermeiros?: number
          equipa_medico_horas_semana?: number
          licenca?: string
          verificacao_estado?: Database['public']['Enums']['estado_verificacao']
          verificacao_data?: string | null
          licenca_confirmada_em?: string | null
          ultima_inspecao?: string | null
          avaliacao_media?: number
          num_avaliacoes?: number
          fundacao?: number | null
          atualizado_em?: string
          capa?: Json
          visualizacoes_30d?: number
          confirmacao_token_hash?: string | null
          confirmacao_token_expira_em?: string | null
          plano?: Database['public']['Enums']['plano_instituicao'] | null
          plano_desde?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [FK<'instituicoes_owner_id_fkey', 'owner_id', 'perfis_utilizador'>]
      }
      notificacoes: {
        Row: {
          id: number
          user_id: string
          tipo: Database['public']['Enums']['tipo_notificacao']
          titulo: string
          texto: string
          instituicao_id: string | null
          candidatura_id: string | null
          link: string | null
          lida: boolean
          created_at: string
        }
        Insert: {
          id?: never
          user_id: string
          tipo: Database['public']['Enums']['tipo_notificacao']
          titulo: string
          texto: string
          instituicao_id?: string | null
          candidatura_id?: string | null
          link?: string | null
          lida?: boolean
          created_at?: string
        }
        Update: {
          id?: never
          user_id?: string
          tipo?: Database['public']['Enums']['tipo_notificacao']
          titulo?: string
          texto?: string
          instituicao_id?: string | null
          candidatura_id?: string | null
          link?: string | null
          lida?: boolean
          created_at?: string
        }
        Relationships: [
          FK<'notificacoes_user_id_fkey', 'user_id', 'perfis_utilizador'>,
          FK<'notificacoes_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'notificacoes_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'notificacoes_candidatura_id_fkey', 'candidatura_id', 'candidaturas'>,
        ]
      }
      pagamentos_familia: {
        Row: {
          id: string
          ordem: number
          user_id: string | null
          plano: Database['public']['Enums']['plano_familia']
          valor_centimos: number
          dias: number
          metodo: Database['public']['Enums']['metodo_familia'] | null
          estado: Database['public']['Enums']['estado_pagamento_familia']
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          multibanco_entidade: string | null
          multibanco_referencia: string | null
          multibanco_expira_em: string | null
          fatura_nif: string | null
          fatura_nome: string | null
          motivo_falha: Database['public']['Enums']['motivo_falha'] | null
          reembolsado_centimos: number
          reembolsado_em: string | null
          demonstracao: boolean
          criado_em: string
          atualizado_em: string
          pago_em: string | null
          documento_id: string | null
        }
        Insert: {
          id?: string
          ordem?: never
          user_id?: string | null
          plano: Database['public']['Enums']['plano_familia']
          valor_centimos: number
          dias: number
          metodo?: Database['public']['Enums']['metodo_familia'] | null
          estado?: Database['public']['Enums']['estado_pagamento_familia']
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          multibanco_entidade?: string | null
          multibanco_referencia?: string | null
          multibanco_expira_em?: string | null
          fatura_nif?: string | null
          fatura_nome?: string | null
          motivo_falha?: Database['public']['Enums']['motivo_falha'] | null
          reembolsado_centimos?: number
          reembolsado_em?: string | null
          demonstracao?: boolean
          criado_em?: string
          atualizado_em?: string
          pago_em?: string | null
          documento_id?: string | null
        }
        Update: {
          id?: string
          ordem?: never
          user_id?: string | null
          plano?: Database['public']['Enums']['plano_familia']
          valor_centimos?: number
          dias?: number
          metodo?: Database['public']['Enums']['metodo_familia'] | null
          estado?: Database['public']['Enums']['estado_pagamento_familia']
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          multibanco_entidade?: string | null
          multibanco_referencia?: string | null
          multibanco_expira_em?: string | null
          fatura_nif?: string | null
          fatura_nome?: string | null
          motivo_falha?: Database['public']['Enums']['motivo_falha'] | null
          reembolsado_centimos?: number
          reembolsado_em?: string | null
          demonstracao?: boolean
          criado_em?: string
          atualizado_em?: string
          pago_em?: string | null
          documento_id?: string | null
        }
        Relationships: [
          FK<'pagamentos_familia_documento_id_fkey', 'documento_id', 'documentos_fiscais'>,
        ]
      }
      perfis_cuidados: {
        Row: {
          id: string
          user_id: string
          nome: string
          idade: number
          relacao: string
          genero: string | null
          grau: Database['public']['Enums']['grau_dependencia']
          necessidades: string[]
          preferencias: string[]
          quarto: string
          local_label: string
          local_lat: number
          local_lng: number
          raio_km: number
          orcamento_max: number
          urgencia: Database['public']['Enums']['urgencia']
          precisa_acordo_ss: boolean
          notas: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string
          nome: string
          idade: number
          relacao?: string
          genero?: string | null
          grau: Database['public']['Enums']['grau_dependencia']
          necessidades?: string[]
          preferencias?: string[]
          quarto?: string
          local_label?: string
          local_lat: number
          local_lng: number
          raio_km?: number
          orcamento_max?: number
          urgencia?: Database['public']['Enums']['urgencia']
          precisa_acordo_ss?: boolean
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          nome?: string
          idade?: number
          relacao?: string
          genero?: string | null
          grau?: Database['public']['Enums']['grau_dependencia']
          necessidades?: string[]
          preferencias?: string[]
          quarto?: string
          local_label?: string
          local_lat?: number
          local_lng?: number
          raio_km?: number
          orcamento_max?: number
          urgencia?: Database['public']['Enums']['urgencia']
          precisa_acordo_ss?: boolean
          notas?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [FK<'perfis_cuidados_user_id_fkey', 'user_id', 'perfis_utilizador'>]
      }
      perfis_utilizador: {
        Row: {
          id: string
          role: Database['public']['Enums']['role_utilizador']
          nome: string
          telefone: string | null
          demonstracao: boolean
          organizacao: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: Database['public']['Enums']['role_utilizador']
          nome?: string
          telefone?: string | null
          demonstracao?: boolean
          organizacao?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: Database['public']['Enums']['role_utilizador']
          nome?: string
          telefone?: string | null
          demonstracao?: boolean
          organizacao?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      procuras_anonimas: {
        Row: {
          id: number
          distrito: string | null
          lugar: string | null
          grau: Database['public']['Enums']['grau_dependencia'] | null
          cuidados: string[]
          orcamento_max: number | null
          resultados: number
          com_vaga: number
          created_at: string
        }
        Insert: {
          id?: never
          distrito?: string | null
          lugar?: string | null
          grau?: Database['public']['Enums']['grau_dependencia'] | null
          cuidados?: string[]
          orcamento_max?: number | null
          resultados?: number
          com_vaga?: number
          created_at?: string
        }
        Update: {
          id?: never
          distrito?: string | null
          lugar?: string | null
          grau?: Database['public']['Enums']['grau_dependencia'] | null
          cuidados?: string[]
          orcamento_max?: number | null
          resultados?: number
          com_vaga?: number
          created_at?: string
        }
        Relationships: []
      }
      quartos: {
        Row: {
          id: number
          instituicao_id: string
          tipo: Database['public']['Enums']['tipo_quarto']
          total: number
          livres: number
          preco_min: number
          preco_max: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: never
          instituicao_id: string
          tipo: Database['public']['Enums']['tipo_quarto']
          total: number
          livres?: number
          preco_min: number
          preco_max: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: never
          instituicao_id?: string
          tipo?: Database['public']['Enums']['tipo_quarto']
          total?: number
          livres?: number
          preco_min?: number
          preco_max?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          FK<'quartos_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'quartos_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
        ]
      }
      saidas_mensais: {
        Row: {
          instituicao_id: string
          mes: string
          saidas: number
          created_at: string
          updated_at: string
        }
        Insert: {
          instituicao_id: string
          mes: string
          saidas?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          instituicao_id?: string
          mes?: string
          saidas?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          FK<'saidas_mensais_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'saidas_mensais_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
        ]
      }
      stripe_eventos: {
        Row: {
          id: string
          tipo: string
          livemode: boolean
          criado_em: string
          recebido_em: string
          processado_em: string | null
          tentativas: number
          erro: string | null
          operacoes: Json | null
        }
        Insert: {
          id: string
          tipo: string
          livemode: boolean
          criado_em: string
          recebido_em?: string
          processado_em?: string | null
          tentativas?: number
          erro?: string | null
          operacoes?: Json | null
        }
        Update: {
          id?: string
          tipo?: string
          livemode?: boolean
          criado_em?: string
          recebido_em?: string
          processado_em?: string | null
          tentativas?: number
          erro?: string | null
          operacoes?: Json | null
        }
        Relationships: []
      }
      subscricoes_instituicao: {
        Row: {
          instituicao_id: string
          stripe_subscription_id: string
          estado: Database['public']['Enums']['estado_subscricao']
          inicio: string | null
          compromisso_ate: string | null
          cancelada_em: string | null
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          instituicao_id: string
          stripe_subscription_id: string
          estado: Database['public']['Enums']['estado_subscricao']
          inicio?: string | null
          compromisso_ate?: string | null
          cancelada_em?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          instituicao_id?: string
          stripe_subscription_id?: string
          estado?: Database['public']['Enums']['estado_subscricao']
          inicio?: string | null
          compromisso_ate?: string | null
          cancelada_em?: string | null
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: [
          FK<'subscricoes_instituicao_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'subscricoes_instituicao_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
        ]
      }
      visitas: {
        Row: {
          id: string
          instituicao_id: string
          equipa_id: string | null
          data: string
          resultado: Database['public']['Enums']['resultado_visita']
          licenca_confirmada: boolean
          instalacoes_vistas: boolean
          vagas_confirmadas: boolean
          precos_confirmados: boolean
          responsavel_nome: string | null
          responsavel_cargo: string | null
          responsavel_telefone: string | null
          responsavel_email: string | null
          plano: Database['public']['Enums']['plano_instituicao'] | null
          notas: string | null
          proximo_contacto: string | null
          conta_criada_id: string | null
          demonstracao: boolean
          created_at: string
        }
        Insert: {
          id?: string
          instituicao_id: string
          equipa_id?: string | null
          data?: string
          resultado: Database['public']['Enums']['resultado_visita']
          licenca_confirmada?: boolean
          instalacoes_vistas?: boolean
          vagas_confirmadas?: boolean
          precos_confirmados?: boolean
          responsavel_nome?: string | null
          responsavel_cargo?: string | null
          responsavel_telefone?: string | null
          responsavel_email?: string | null
          plano?: Database['public']['Enums']['plano_instituicao'] | null
          notas?: string | null
          proximo_contacto?: string | null
          conta_criada_id?: string | null
          demonstracao?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          instituicao_id?: string
          equipa_id?: string | null
          data?: string
          resultado?: Database['public']['Enums']['resultado_visita']
          licenca_confirmada?: boolean
          instalacoes_vistas?: boolean
          vagas_confirmadas?: boolean
          precos_confirmados?: boolean
          responsavel_nome?: string | null
          responsavel_cargo?: string | null
          responsavel_telefone?: string | null
          responsavel_email?: string | null
          plano?: Database['public']['Enums']['plano_instituicao'] | null
          notas?: string | null
          proximo_contacto?: string | null
          conta_criada_id?: string | null
          demonstracao?: boolean
          created_at?: string
        }
        Relationships: [
          FK<'visitas_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'visitas_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'visitas_equipa_id_fkey', 'equipa_id', 'perfis_utilizador'>,
          FK<'visitas_conta_criada_id_fkey', 'conta_criada_id', 'perfis_utilizador'>,
        ]
      }
    }
    Views: {
      instituicoes_publicas: {
        Row: {
          id: string | null
          nome: string | null
          tipo: Database['public']['Enums']['tipo_resposta'] | null
          natureza: Database['public']['Enums']['natureza'] | null
          resumo: string | null
          descricao: string | null
          localidade: string | null
          concelho: string | null
          distrito: string | null
          regiao: string | null
          lat: number | null
          lng: number | null
          capacidade: number | null
          acordo_ss: boolean | null
          incluido: string[] | null
          /** nomes dos extras (sem os valores, que são do Acesso Família) */
          extras_nomes: Json | null
          graus: Database['public']['Enums']['grau_dependencia'][] | null
          cuidados: string[] | null
          comodidades: string[] | null
          equipa_cuidadores_por_10: number | null
          equipa_enfermeiros: number | null
          equipa_medico_horas_semana: number | null
          licenca: string | null
          verificacao_estado: Database['public']['Enums']['estado_verificacao'] | null
          verificacao_data: string | null
          ultima_inspecao: string | null
          licenca_confirmada_em: string | null
          avaliacao_media: number | null
          num_avaliacoes: number | null
          avaliacoes_publicadas: number | null
          avaliacoes_verificadas: number | null
          fundacao: number | null
          capa: Json | null
          publicado: boolean | null
          demonstracao: boolean | null
          faixa_preco: Database['public']['Enums']['faixa_preco'] | null
        }
        Relationships: []
      }
    }
    Functions: {
      acesso_estado: {
        Args: never
        /** { completo, ativo, ate, plano, pagamentos } — pagamentos vem vazio até existir a faturação */
        Returns: Json
      }
      aceitar_candidatura: {
        Args: { p_candidatura_id: string }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      atualizar_caso: {
        Args: { p_caso_id: string; p_alteracoes: Json }
        Returns: Database['public']['Tables']['casos']['Row']
      }
      atualizar_estado_candidatura: {
        Args: {
          p_candidatura_id: string
          p_estado: Database['public']['Enums']['estado_candidatura']
          p_nota?: string
        }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      cancelar_candidatura: {
        Args: { p_candidatura_id: string }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      candidatar: {
        Args: {
          p_instituicao_id: string
          p_perfil_id: string
          p_consentimento: boolean
          p_mensagem?: string
          p_visita_data?: string
          p_visita_hora?: string
        }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      avaliacoes_instituicao: {
        Args: { p_instituicao_id: string }
        Returns: AvaliacaoInstituicao[]
      }
      avaliar_lar: {
        Args: { p_candidatura_id: string; p_nota: number; p_texto: string; p_aspetos: Json }
        Returns: Database['public']['Tables']['avaliacoes']['Row']
      }
      contestar_entrada: {
        Args: { p_candidatura_id: string; p_motivo: string }
        /** { candidatura_id, estado: 'aberta', contestada_em } */
        Returns: Json
      }
      confirmar_entrada_familia: {
        Args: { p_candidatura_id: string; p_data: string }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      confirmar_vagas_atualizadas: {
        Args: { p_instituicao_id: string }
        Returns: string
      }
      confirmar_vagas_por_token: {
        Args: { p_token: string; p_ainda_tem: boolean }
        Returns: VagasPorToken[]
      }
      confirmar_visita: {
        Args: { p_candidatura_id: string }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      criar_caso: {
        Args: { p_perfil: Json; p_referencia?: string; p_alta_prevista?: string; p_consentimento?: boolean }
        Returns: Database['public']['Tables']['casos']['Row']
      }
      definir_vagas: {
        Args: {
          p_instituicao_id: string
          p_tipo: Database['public']['Enums']['tipo_quarto']
          p_livres: number
        }
        Returns: number
      }
      disponibilidade_agregada: {
        /** p_distrito null (com p_concelho null) = o país inteiro; um concelho exige o distrito */
        Args: { p_distrito: string | null; p_concelho?: string | null }
        Returns: { total: number; com_vaga: number | null; breve: number | null }[]
      }
      enviar_caso: {
        Args: { p_caso_id: string; p_instituicao_ids: string[]; p_mensagem?: string }
        Returns: Database['public']['Tables']['candidaturas']['Row'][]
      }
      escolher_plano_instituicao: {
        Args: { p_plano: Database['public']['Enums']['plano_instituicao'] }
        Returns: PlanoDaInstituicao[]
      }
      faturacao_resumo: {
        Args: never
        /** ResumoFaturacaoRpc (supabase/functions/_shared/portas.ts) → faturacaoDeResumo */
        Returns: Json
      }
      guardar_dados_faturacao: {
        Args: { p_razao_social: string; p_nif: string; p_morada: string; p_codigo_postal: string; p_localidade: string; p_email: string }
        /** { razao_social, nif, morada, codigo_postal, localidade, email, atualizado_em } */
        Returns: Json
      }
      instituicoes_completas: {
        Args: { p_ids?: string[] }
        Returns: InstituicaoCompleta[]
      }
      marcar_entrada: {
        Args: { p_candidatura_id: string; p_data: string }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      minhas_avaliacoes: {
        Args: never
        Returns: {
          avaliacao_id: number
          candidatura_id: string | null
          instituicao_id: string
          nota: number
          verificada: boolean
          created_at: string
        }[]
      }
      painel_equipa: {
        Args: never
        Returns: {
          instituicao_id: string
          tem_gestor: boolean
          plano: Database['public']['Enums']['plano_instituicao'] | null
          plano_desde: string | null
          compromisso_ate: string | null
        }[]
      }
      painel_instituicao: {
        Args: never
        Returns: {
          id: string
          publicado: boolean
          verificacao_estado: Database['public']['Enums']['estado_verificacao']
          visualizacoes_30d: number
          lista_espera_offline: number
          lista_espera_online: number
          plano: Database['public']['Enums']['plano_instituicao'] | null
          plano_desde: string | null
          compromisso_ate: string | null
        }[]
      }
      pedidos_recebidos: {
        Args: never
        Returns: PedidoRecebido[]
      }
      pedir_visita: {
        Args: { p_candidatura_id: string; p_data: string; p_hora: string }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      procura_na_zona: {
        Args: { p_dias?: number }
        Returns: {
          distrito: string
          dias: number
          total: number
          cuidados: Json
          graus: Json
          orcamento_mediano: number | null
        }[]
      }
      registar_entrada: {
        Args: { p_instituicao_id: string; p_tipo: Database['public']['Enums']['tipo_quarto'] }
        Returns: number
      }
      registar_procura: {
        Args: {
          p_distrito?: string
          p_lugar?: string
          p_grau?: Database['public']['Enums']['grau_dependencia']
          p_cuidados?: string[]
          p_orcamento_max?: number
          p_resultados?: number
          p_com_vaga?: number
        }
        Returns: boolean
      }
      registar_vaga_libertada: {
        Args: { p_instituicao_id: string; p_tipo: Database['public']['Enums']['tipo_quarto'] }
        Returns: number
      }
      registar_visita: {
        Args: {
          p_instituicao_id: string
          p_resultado: Database['public']['Enums']['resultado_visita']
          /** { licenca_confirmada?, instalacoes_vistas?, vagas_confirmadas?, precos_confirmados? } (booleanos) */
          p_verificacao?: Json
          p_licenca?: string
          /** { nome?, cargo?, telefone?, email? } */
          p_responsavel?: Json
          p_plano?: Database['public']['Enums']['plano_instituicao']
          p_notas?: string
          p_proximo_contacto?: string
          /** [{ tipo, livres, preco_min, preco_max }] */
          p_quartos?: Json
          p_cuidados?: string[]
        }
        Returns: Database['public']['Tables']['visitas']['Row']
      }
      renovar_token_confirmacao: {
        Args: never
        Returns: string
      }
      resolver_contestacao: {
        /** só service_role (equipa) */
        Args: { p_candidatura_id: string; p_decisao: string; p_nota?: string | null }
        Returns: Json
      }
      responder_vaga: {
        Args: { p_candidatura_id: string; p_aceitar: boolean }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      // ——— só service_role (Edge Functions com a chave secreta): o contrato de supabase/functions/_shared/portas.ts
      servico_acesso_iniciar: {
        Args: { p_user_id: string; p_plano: string; p_texto_versao: string; p_ip?: string | null; p_nif?: string | null; p_nome_fiscal?: string | null }
        Returns: Json
      }
      servico_acesso_sessao_criada: {
        Args: { p_pagamento_id: string; p_session_id: string }
        Returns: undefined
      }
      servico_cobranca_criada: {
        Args: { p_fatura_id: string; p_stripe_invoice_id: string; p_numero: string | null; p_url: string | null; p_cobranca: string; p_debito_em: string | null }
        Returns: undefined
      }
      servico_cobranca_debito_iniciado: {
        Args: { p_fatura_id: string; p_estado: string; p_motivo: string | null; p_em: string }
        Returns: undefined
      }
      servico_cobrancas_a_debitar: {
        Args: { p_agora: string; p_limite: number }
        Returns: Json
      }
      servico_contexto_instituicao: {
        Args: { p_instituicao_id: string }
        Returns: Json
      }
      servico_definir_cliente_stripe: {
        Args: { p_instituicao_id: string; p_customer_id: string }
        Returns: string
      }
      servico_documento_emitido: {
        Args: { p_id: string; p_externo_id: string; p_numero: string; p_total_centimos: number; p_iva_centimos: number; p_emitido_em: string; p_emissor: string }
        Returns: undefined
      }
      servico_documento_externo: {
        Args: { p_id: string }
        Returns: Json
      }
      servico_documento_falhou: {
        Args: { p_id: string; p_erro: string }
        Returns: undefined
      }
      servico_documentos_pendentes: {
        Args: { p_agora: string; p_limite: number }
        Returns: Json
      }
      servico_evento_aplicar: {
        Args: { p_id: string; p_operacoes: Json }
        Returns: boolean
      }
      servico_evento_falhou: {
        Args: { p_id: string; p_erro: string }
        Returns: undefined
      }
      servico_evento_iniciar: {
        Args: { p_id: string; p_tipo: string; p_livemode: boolean; p_criado_em: string }
        Returns: string
      }
      servico_iniciar_execucao: {
        Args: { p_fase: string; p_duracao_segundos: number }
        Returns: boolean
      }
      servico_preparar_cobrancas: {
        Args: { p_modo: string; p_agora: string; p_limite: number }
        Returns: Json
      }
      servico_reservar_documentos: {
        Args: { p_modo: string; p_agora: string; p_limite: number }
        Returns: Json
      }
      servico_subscricao_contexto: {
        Args: { p_instituicao_id: string }
        Returns: Json
      }
      servico_subscricao_registar: {
        Args: { p_instituicao_id: string; p_stripe_subscription_id: string; p_estado: string; p_inicio: string | null }
        Returns: undefined
      }
      servico_subscricoes_a_sincronizar: {
        Args: { p_limite: number }
        Returns: Json
      }
      servico_terminar_execucao: {
        Args: { p_fase: string; p_resumo: Json }
        Returns: undefined
      }
      vagas_por_token: {
        Args: { p_token: string }
        Returns: VagasPorToken[]
      }
    }
    Enums: {
      cobranca_fatura: 'debito_automatico' | 'pagamento_por_link'
      emissor_documento: 'moloni' | 'falso'
      estado_candidatura: 'enviada' | 'em_analise' | 'lista_espera' | 'vaga_proposta' | 'aceite' | 'admitida' | 'recusada' | 'cancelada'
      estado_caso: 'aberto' | 'colocado' | 'fechado'
      estado_contestacao: 'aberta' | 'aceite' | 'rejeitada' | 'retirada'
      estado_documento_fiscal: 'pendente' | 'emitido' | 'erro' | 'anulado'
      estado_fatura: 'rascunho' | 'emitida' | 'em_processamento' | 'paga' | 'falhou' | 'anulada'
      estado_pagamento_familia: 'pendente' | 'a_aguardar_pagamento' | 'pago' | 'falhou' | 'expirado' | 'reembolsado'
      estado_subscricao: 'incompleta' | 'ativa' | 'em_atraso' | 'cancelada'
      estado_verificacao: 'verificado' | 'pendente' | 'nao_verificado'
      estado_visita: 'pedida' | 'confirmada' | 'realizada'
      faixa_preco: 'ate_1000' | '1000_2000' | 'mais_2000' | 'conforme_rendimentos'
      grau_dependencia: 'autonomo' | 'ligeira' | 'moderada' | 'grave'
      metodo_familia: 'card' | 'mb_way' | 'multibanco'
      metodo_pagamento_b2b: 'sepa_debit' | 'card'
      modo_documento: 'fatura_por_entrada' | 'fatura_mensal' | 'fatura_recibo_mensal'
      motivo_falha: 'saldo_insuficiente' | 'mandato_revogado' | 'cartao_recusado' | 'cartao_expirado' | 'autenticacao_falhou' | 'referencia_expirada' | 'pagamento_cancelado' | 'outro'
      natureza: 'ipss' | 'misericordia' | 'privado'
      origem_documento: 'entradas' | 'subscricao' | 'acesso'
      origem_fatura: 'entradas' | 'subscricao'
      origem_pedido: 'familia' | 'profissional'
      plano_familia: 'acesso_30' | 'acesso_90'
      plano_instituicao: 'por_entrada' | 'mensal'
      regiao_fiscal: 'continente' | 'madeira' | 'acores'
      resultado_visita: 'aderiu' | 'interessado' | 'voltar' | 'recusou'
      role_utilizador: 'familia' | 'lar' | 'profissional' | 'equipa'
      taxa_entrada: 'aplicavel' | 'incluida' | 'isenta'
      tipo_documento_fiscal: 'FT' | 'FR' | 'RC' | 'NC'
      tipo_notificacao: 'vaga' | 'candidatura' | 'visita' | 'sistema'
      tipo_quarto: 'individual' | 'duplo' | 'casal'
      tipo_resposta: 'erpi' | 'residencia' | 'centro_dia'
      urgencia: 'imediata' | '1-3meses' | '3-6meses' | 'planeamento'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// ————————————————————————————————————————— atalhos (iguais aos do ficheiro gerado)

type PublicSchema = Database['public']

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never

export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update']

export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]

export const Constants = {
  public: {
    Enums: {
      cobranca_fatura: ['debito_automatico', 'pagamento_por_link'],
      emissor_documento: ['moloni', 'falso'],
      estado_candidatura: ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite', 'admitida', 'recusada', 'cancelada'],
      estado_caso: ['aberto', 'colocado', 'fechado'],
      estado_contestacao: ['aberta', 'aceite', 'rejeitada', 'retirada'],
      estado_documento_fiscal: ['pendente', 'emitido', 'erro', 'anulado'],
      estado_fatura: ['rascunho', 'emitida', 'em_processamento', 'paga', 'falhou', 'anulada'],
      estado_pagamento_familia: ['pendente', 'a_aguardar_pagamento', 'pago', 'falhou', 'expirado', 'reembolsado'],
      estado_subscricao: ['incompleta', 'ativa', 'em_atraso', 'cancelada'],
      estado_verificacao: ['verificado', 'pendente', 'nao_verificado'],
      estado_visita: ['pedida', 'confirmada', 'realizada'],
      faixa_preco: ['ate_1000', '1000_2000', 'mais_2000', 'conforme_rendimentos'],
      grau_dependencia: ['autonomo', 'ligeira', 'moderada', 'grave'],
      metodo_familia: ['card', 'mb_way', 'multibanco'],
      metodo_pagamento_b2b: ['sepa_debit', 'card'],
      modo_documento: ['fatura_por_entrada', 'fatura_mensal', 'fatura_recibo_mensal'],
      motivo_falha: ['saldo_insuficiente', 'mandato_revogado', 'cartao_recusado', 'cartao_expirado', 'autenticacao_falhou', 'referencia_expirada', 'pagamento_cancelado', 'outro'],
      natureza: ['ipss', 'misericordia', 'privado'],
      origem_documento: ['entradas', 'subscricao', 'acesso'],
      origem_fatura: ['entradas', 'subscricao'],
      origem_pedido: ['familia', 'profissional'],
      plano_familia: ['acesso_30', 'acesso_90'],
      plano_instituicao: ['por_entrada', 'mensal'],
      regiao_fiscal: ['continente', 'madeira', 'acores'],
      resultado_visita: ['aderiu', 'interessado', 'voltar', 'recusou'],
      role_utilizador: ['familia', 'lar', 'profissional', 'equipa'],
      taxa_entrada: ['aplicavel', 'incluida', 'isenta'],
      tipo_documento_fiscal: ['FT', 'FR', 'RC', 'NC'],
      tipo_notificacao: ['vaga', 'candidatura', 'visita', 'sistema'],
      tipo_quarto: ['individual', 'duplo', 'casal'],
      tipo_resposta: ['erpi', 'residencia', 'centro_dia'],
      urgencia: ['imediata', '1-3meses', '3-6meses', 'planeamento'],
    },
  },
} as const
