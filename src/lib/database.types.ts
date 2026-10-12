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
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type FK<Nome extends string, Coluna extends string, Destino extends string, ColunaDestino extends string = 'id'> = {
  foreignKeyName: Nome
  columns: [Coluna]
  isOneToOne: false
  referencedRelation: Destino
  referencedColumns: [ColunaDestino]
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
        }
        Insert: {
          id?: never
          instituicao_id: string
          user_id?: string | null
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
        }
        Relationships: [
          FK<'candidaturas_instituicao_id_fkey', 'instituicao_id', 'instituicoes'>,
          FK<'candidaturas_instituicao_id_fkey', 'instituicao_id', 'instituicoes_publicas'>,
          FK<'candidaturas_user_id_fkey', 'user_id', 'perfis_utilizador'>,
          FK<'candidaturas_perfil_id_fkey', 'perfil_id', 'perfis_cuidados'>,
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
          ultima_inspecao: string | null
          avaliacao_media: number
          num_avaliacoes: number
          fundacao: number | null
          atualizado_em: string
          capa: Json
          visualizacoes_30d: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id?: string | null
          publicado?: boolean
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
          ultima_inspecao?: string | null
          avaliacao_media?: number
          num_avaliacoes?: number
          fundacao?: number | null
          atualizado_em?: string
          capa?: Json
          visualizacoes_30d?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string | null
          publicado?: boolean
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
          ultima_inspecao?: string | null
          avaliacao_media?: number
          num_avaliacoes?: number
          fundacao?: number | null
          atualizado_em?: string
          capa?: Json
          visualizacoes_30d?: number
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
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: Database['public']['Enums']['role_utilizador']
          nome?: string
          telefone?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: Database['public']['Enums']['role_utilizador']
          nome?: string
          telefone?: string | null
          created_at?: string
          updated_at?: string
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
          lista_espera_offline: number | null
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
          owner_id: string | null
          publicado: boolean | null
          visualizacoes_30d: number | null
          vagas_livres: number | null
          mensalidade_min: number | null
          mensalidade_max: number | null
          quartos: Json | null
          historico_saidas: number[] | null
        }
        Relationships: [FK<'instituicoes_owner_id_fkey', 'owner_id', 'perfis_utilizador'>]
      }
    }
    Functions: {
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
      confirmar_vagas_atualizadas: {
        Args: { p_instituicao_id: string }
        Returns: string
      }
      confirmar_visita: {
        Args: { p_candidatura_id: string }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      definir_vagas: {
        Args: {
          p_instituicao_id: string
          p_tipo: Database['public']['Enums']['tipo_quarto']
          p_livres: number
        }
        Returns: number
      }
      pedir_visita: {
        Args: { p_candidatura_id: string; p_data: string; p_hora: string }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
      registar_entrada: {
        Args: { p_instituicao_id: string; p_tipo: Database['public']['Enums']['tipo_quarto'] }
        Returns: number
      }
      registar_vaga_libertada: {
        Args: { p_instituicao_id: string; p_tipo: Database['public']['Enums']['tipo_quarto'] }
        Returns: number
      }
      responder_vaga: {
        Args: { p_candidatura_id: string; p_aceitar: boolean }
        Returns: Database['public']['Tables']['candidaturas']['Row']
      }
    }
    Enums: {
      estado_candidatura: 'enviada' | 'em_analise' | 'lista_espera' | 'vaga_proposta' | 'aceite' | 'recusada' | 'cancelada'
      estado_verificacao: 'verificado' | 'pendente' | 'nao_verificado'
      estado_visita: 'pedida' | 'confirmada' | 'realizada'
      grau_dependencia: 'autonomo' | 'ligeira' | 'moderada' | 'grave'
      natureza: 'ipss' | 'misericordia' | 'privado'
      role_utilizador: 'familia' | 'lar'
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
      estado_candidatura: ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite', 'recusada', 'cancelada'],
      estado_verificacao: ['verificado', 'pendente', 'nao_verificado'],
      estado_visita: ['pedida', 'confirmada', 'realizada'],
      grau_dependencia: ['autonomo', 'ligeira', 'moderada', 'grave'],
      natureza: ['ipss', 'misericordia', 'privado'],
      role_utilizador: ['familia', 'lar'],
      tipo_notificacao: ['vaga', 'candidatura', 'visita', 'sistema'],
      tipo_quarto: ['individual', 'duplo', 'casal'],
      tipo_resposta: ['erpi', 'residencia', 'centro_dia'],
      urgencia: ['imediata', '1-3meses', '3-6meses', 'planeamento'],
    },
  },
} as const
