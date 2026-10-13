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
 *     licenca_confirmada_em, que é legível) não são graváveis pelos clientes (só pelo servidor/administrador).
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
          morada: string | null
          codigo_postal: string | null
          localidade: string | null
          concelho: string | null
          distrito: string | null
          regiao: string | null
          lat: number | null
          lng: number | null
          telefone: string | null
          email: string | null
          website: string | null
          capacidade: number | null
          lista_espera: number | null
          estadia_media_meses: number | null
          acordo_ss: boolean | null
          incluido: string[] | null
          extras: Json | null
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
          avaliacao_media: number | null
          num_avaliacoes: number | null
          fundacao: number | null
          atualizado_em: string | null
          capa: Json | null
          publicado: boolean | null
          demonstracao: boolean | null
          vagas_livres: number | null
          mensalidade_min: number | null
          mensalidade_max: number | null
          quartos: Json | null
          historico_saidas: number[] | null
          licenca_confirmada_em: string | null
        }
        Relationships: []
      }
    }
    Functions: {
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
      avaliar_lar: {
        Args: { p_candidatura_id: string; p_nota: number; p_texto: string; p_aspetos: Json }
        Returns: Database['public']['Tables']['avaliacoes']['Row']
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
      enviar_caso: {
        Args: { p_caso_id: string; p_instituicao_ids: string[]; p_mensagem?: string }
        Returns: Database['public']['Tables']['candidaturas']['Row'][]
      }
      escolher_plano_instituicao: {
        Args: { p_plano: Database['public']['Enums']['plano_instituicao'] }
        Returns: PlanoDaInstituicao[]
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
      responder_vaga: {
        Args: { p_candidatura_id: string; p_aceitar: boolean }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      vagas_por_token: {
        Args: { p_token: string }
        Returns: VagasPorToken[]
      }
    }
    Enums: {
      estado_candidatura: 'enviada' | 'em_analise' | 'lista_espera' | 'vaga_proposta' | 'aceite' | 'admitida' | 'recusada' | 'cancelada'
      estado_caso: 'aberto' | 'colocado' | 'fechado'
      estado_verificacao: 'verificado' | 'pendente' | 'nao_verificado'
      estado_visita: 'pedida' | 'confirmada' | 'realizada'
      grau_dependencia: 'autonomo' | 'ligeira' | 'moderada' | 'grave'
      natureza: 'ipss' | 'misericordia' | 'privado'
      origem_pedido: 'familia' | 'profissional'
      plano_instituicao: 'por_entrada' | 'mensal'
      resultado_visita: 'aderiu' | 'interessado' | 'voltar' | 'recusou'
      role_utilizador: 'familia' | 'lar' | 'profissional' | 'equipa'
      taxa_entrada: 'aplicavel' | 'incluida' | 'isenta'
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
      estado_candidatura: ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite', 'admitida', 'recusada', 'cancelada'],
      estado_caso: ['aberto', 'colocado', 'fechado'],
      estado_verificacao: ['verificado', 'pendente', 'nao_verificado'],
      estado_visita: ['pedida', 'confirmada', 'realizada'],
      grau_dependencia: ['autonomo', 'ligeira', 'moderada', 'grave'],
      natureza: ['ipss', 'misericordia', 'privado'],
      origem_pedido: ['familia', 'profissional'],
      plano_instituicao: ['por_entrada', 'mensal'],
      resultado_visita: ['aderiu', 'interessado', 'voltar', 'recusou'],
      role_utilizador: ['familia', 'lar', 'profissional', 'equipa'],
      taxa_entrada: ['aplicavel', 'incluida', 'isenta'],
      tipo_notificacao: ['vaga', 'candidatura', 'visita', 'sistema'],
      tipo_quarto: ['individual', 'duplo', 'casal'],
      tipo_resposta: ['erpi', 'residencia', 'centro_dia'],
      urgencia: ['imediata', '1-3meses', '3-6meses', 'planeamento'],
    },
  },
} as const
