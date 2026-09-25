export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_config_test_log: {
        Row: {
          active_model: string | null
          created_at: string
          duration_ms: number | null
          fallback_used: boolean | null
          id: string
          kind: string
          message: string | null
          model: string | null
          provider: string | null
          status: string
          user_id: string
        }
        Insert: {
          active_model?: string | null
          created_at?: string
          duration_ms?: number | null
          fallback_used?: boolean | null
          id?: string
          kind: string
          message?: string | null
          model?: string | null
          provider?: string | null
          status: string
          user_id: string
        }
        Update: {
          active_model?: string | null
          created_at?: string
          duration_ms?: number | null
          fallback_used?: boolean | null
          id?: string
          kind?: string
          message?: string | null
          model?: string | null
          provider?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_key_rotation_alerts: {
        Row: {
          acknowledged_at: string | null
          alert_day: string | null
          created_at: string
          days_since_rotation: number | null
          id: string
          interval_days: number | null
          key_kind: string
          message: string | null
          provider: string | null
          severity: string
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          alert_day?: string | null
          created_at?: string
          days_since_rotation?: number | null
          id?: string
          interval_days?: number | null
          key_kind: string
          message?: string | null
          provider?: string | null
          severity: string
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          alert_day?: string | null
          created_at?: string
          days_since_rotation?: number | null
          id?: string
          interval_days?: number | null
          key_kind?: string
          message?: string | null
          provider?: string | null
          severity?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          model: string
          provider: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          model: string
          provider: string
          status: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          model?: string
          provider?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      alertas_captacao_config: {
        Row: {
          created_at: string
          enabled_app: boolean
          enabled_whatsapp: boolean
          imobiliaria_id: string
          niveis_monitorados: string[]
          only_on_upgrade: boolean
          score_min_alerta: number
          updated_at: string
          whatsapp_grupo_numero: string | null
        }
        Insert: {
          created_at?: string
          enabled_app?: boolean
          enabled_whatsapp?: boolean
          imobiliaria_id: string
          niveis_monitorados?: string[]
          only_on_upgrade?: boolean
          score_min_alerta?: number
          updated_at?: string
          whatsapp_grupo_numero?: string | null
        }
        Update: {
          created_at?: string
          enabled_app?: boolean
          enabled_whatsapp?: boolean
          imobiliaria_id?: string
          niveis_monitorados?: string[]
          only_on_upgrade?: boolean
          score_min_alerta?: number
          updated_at?: string
          whatsapp_grupo_numero?: string | null
        }
        Relationships: []
      }
      alertas_captacao_log: {
        Row: {
          corretor_id: string | null
          created_at: string
          delivered_app: boolean
          delivered_whatsapp: boolean
          detalhes: Json
          id: string
          imobiliaria_id: string
          imovel_ref: string | null
          link: string | null
          nivel_anterior: string | null
          nivel_novo: string | null
          proprietario_id: string
          proprietario_nome: string | null
          score_anterior: number | null
          score_novo: number | null
          tipo_evento: string
          whatsapp_error: string | null
        }
        Insert: {
          corretor_id?: string | null
          created_at?: string
          delivered_app?: boolean
          delivered_whatsapp?: boolean
          detalhes?: Json
          id?: string
          imobiliaria_id: string
          imovel_ref?: string | null
          link?: string | null
          nivel_anterior?: string | null
          nivel_novo?: string | null
          proprietario_id: string
          proprietario_nome?: string | null
          score_anterior?: number | null
          score_novo?: number | null
          tipo_evento: string
          whatsapp_error?: string | null
        }
        Update: {
          corretor_id?: string | null
          created_at?: string
          delivered_app?: boolean
          delivered_whatsapp?: boolean
          detalhes?: Json
          id?: string
          imobiliaria_id?: string
          imovel_ref?: string | null
          link?: string | null
          nivel_anterior?: string | null
          nivel_novo?: string | null
          proprietario_id?: string
          proprietario_nome?: string | null
          score_anterior?: number | null
          score_novo?: number | null
          tipo_evento?: string
          whatsapp_error?: string | null
        }
        Relationships: []
      }
      analise_inquilino: {
        Row: {
          analise_detalhada: Json | null
          capacidade_pagamento_pct: number | null
          caucao_valor: number | null
          contrato_id: string | null
          created_at: string
          fiador_cpf: string | null
          fiador_imovel_proprio: boolean | null
          fiador_nome: string | null
          fiador_profissao: string | null
          fiador_renda: number | null
          id: string
          imobiliaria_id: string
          inquilino_cpf: string | null
          inquilino_email: string | null
          inquilino_nome: string
          inquilino_profissao: string | null
          inquilino_renda: number | null
          inquilino_telefone: string | null
          pontos_negativos: Json | null
          pontos_positivos: Json | null
          recomendacao_ia: string | null
          resumo_ia: string | null
          risco: string | null
          score_geral: number | null
          seguradora_apolice: string | null
          seguradora_nome: string | null
          status: string
          tipo_garantia: string | null
          updated_at: string
          valor_aluguel: number
          valor_condominio: number | null
          valor_iptu: number | null
        }
        Insert: {
          analise_detalhada?: Json | null
          capacidade_pagamento_pct?: number | null
          caucao_valor?: number | null
          contrato_id?: string | null
          created_at?: string
          fiador_cpf?: string | null
          fiador_imovel_proprio?: boolean | null
          fiador_nome?: string | null
          fiador_profissao?: string | null
          fiador_renda?: number | null
          id?: string
          imobiliaria_id: string
          inquilino_cpf?: string | null
          inquilino_email?: string | null
          inquilino_nome?: string
          inquilino_profissao?: string | null
          inquilino_renda?: number | null
          inquilino_telefone?: string | null
          pontos_negativos?: Json | null
          pontos_positivos?: Json | null
          recomendacao_ia?: string | null
          resumo_ia?: string | null
          risco?: string | null
          score_geral?: number | null
          seguradora_apolice?: string | null
          seguradora_nome?: string | null
          status?: string
          tipo_garantia?: string | null
          updated_at?: string
          valor_aluguel?: number
          valor_condominio?: number | null
          valor_iptu?: number | null
        }
        Update: {
          analise_detalhada?: Json | null
          capacidade_pagamento_pct?: number | null
          caucao_valor?: number | null
          contrato_id?: string | null
          created_at?: string
          fiador_cpf?: string | null
          fiador_imovel_proprio?: boolean | null
          fiador_nome?: string | null
          fiador_profissao?: string | null
          fiador_renda?: number | null
          id?: string
          imobiliaria_id?: string
          inquilino_cpf?: string | null
          inquilino_email?: string | null
          inquilino_nome?: string
          inquilino_profissao?: string | null
          inquilino_renda?: number | null
          inquilino_telefone?: string | null
          pontos_negativos?: Json | null
          pontos_positivos?: Json | null
          recomendacao_ia?: string | null
          resumo_ia?: string | null
          risco?: string | null
          score_geral?: number | null
          seguradora_apolice?: string | null
          seguradora_nome?: string | null
          status?: string
          tipo_garantia?: string | null
          updated_at?: string
          valor_aluguel?: number
          valor_condominio?: number | null
          valor_iptu?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "analise_inquilino_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      article_types: {
        Row: {
          created_at: string
          description: string | null
          id: string
          imobiliaria_id: string
          name: string
          prompt_template: string
          updated_at: string
          use_serper: boolean | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          imobiliaria_id: string
          name: string
          prompt_template: string
          updated_at?: string
          use_serper?: boolean | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          imobiliaria_id?: string
          name?: string
          prompt_template?: string
          updated_at?: string
          use_serper?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "article_types_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliaria_config"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          detalhes: string | null
          id: string
          master_id: string
          modulo: string | null
          target_user_id: string
          valor_anterior: boolean | null
          valor_novo: boolean | null
        }
        Insert: {
          acao: string
          created_at?: string
          detalhes?: string | null
          id?: string
          master_id: string
          modulo?: string | null
          target_user_id: string
          valor_anterior?: boolean | null
          valor_novo?: boolean | null
        }
        Update: {
          acao?: string
          created_at?: string
          detalhes?: string | null
          id?: string
          master_id?: string
          modulo?: string | null
          target_user_id?: string
          valor_anterior?: boolean | null
          valor_novo?: boolean | null
        }
        Relationships: []
      }
      automacao_followup_execucoes: {
        Row: {
          compromisso_id: string | null
          created_at: string
          escalado: boolean
          escalado_em: string | null
          estagio_destino: string | null
          estagio_origem: string | null
          followup_id: string | null
          id: string
          imobiliaria_id: string
          lead_id: string | null
          regra_id: string | null
          tipo: string
        }
        Insert: {
          compromisso_id?: string | null
          created_at?: string
          escalado?: boolean
          escalado_em?: string | null
          estagio_destino?: string | null
          estagio_origem?: string | null
          followup_id?: string | null
          id?: string
          imobiliaria_id: string
          lead_id?: string | null
          regra_id?: string | null
          tipo: string
        }
        Update: {
          compromisso_id?: string | null
          created_at?: string
          escalado?: boolean
          escalado_em?: string | null
          estagio_destino?: string | null
          estagio_origem?: string | null
          followup_id?: string | null
          id?: string
          imobiliaria_id?: string
          lead_id?: string | null
          regra_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "automacao_followup_execucoes_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "automacao_followup_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      automacao_followup_regras: {
        Row: {
          acao_descricao: string
          acao_titulo: string
          ativo: boolean
          created_at: string
          escalonamento_horas: number
          estagio_destino: string | null
          estagio_origem: string | null
          id: string
          imobiliaria_id: string
          notificar_gerente: boolean
          prazo_tarefa_horas: number
          tipo: string
          tipo_followup: string
          updated_at: string
        }
        Insert: {
          acao_descricao?: string
          acao_titulo?: string
          ativo?: boolean
          created_at?: string
          escalonamento_horas?: number
          estagio_destino?: string | null
          estagio_origem?: string | null
          id?: string
          imobiliaria_id: string
          notificar_gerente?: boolean
          prazo_tarefa_horas?: number
          tipo: string
          tipo_followup?: string
          updated_at?: string
        }
        Update: {
          acao_descricao?: string
          acao_titulo?: string
          ativo?: boolean
          created_at?: string
          escalonamento_horas?: number
          estagio_destino?: string | null
          estagio_origem?: string | null
          id?: string
          imobiliaria_id?: string
          notificar_gerente?: boolean
          prazo_tarefa_horas?: number
          tipo?: string
          tipo_followup?: string
          updated_at?: string
        }
        Relationships: []
      }
      automacoes: {
        Row: {
          acao: string
          ativo: boolean
          categoria: string
          created_at: string
          execucoes: number
          id: string
          imobiliaria_id: string
          nome: string
          plataforma_nome: string | null
          plataforma_url: string | null
          tipo: string
          trigger_desc: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          acao: string
          ativo?: boolean
          categoria?: string
          created_at?: string
          execucoes?: number
          id?: string
          imobiliaria_id: string
          nome: string
          plataforma_nome?: string | null
          plataforma_url?: string | null
          tipo?: string
          trigger_desc: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          acao?: string
          ativo?: boolean
          categoria?: string
          created_at?: string
          execucoes?: number
          id?: string
          imobiliaria_id?: string
          nome?: string
          plataforma_nome?: string | null
          plataforma_url?: string | null
          tipo?: string
          trigger_desc?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      avaliacoes_historico: {
        Row: {
          analise_resumo: string | null
          area: number
          bairro: string | null
          cidade: string | null
          classificacao_liquidez: string | null
          comparaveis_count: number | null
          created_at: string
          dados_completos: Json | null
          descricao: string | null
          estado: string | null
          estrategia_venda: string | null
          id: string
          imobiliaria_id: string
          imovel_id: string | null
          modo: string | null
          operacao: string
          pontos_atencao: Json | null
          pontos_fortes: Json | null
          portais_recomendados: Json | null
          preco_competitivo: boolean | null
          preco_informado: number | null
          preco_m2_estimado: number | null
          preco_m2_regiao: number | null
          probabilidade_venda_30dias: number | null
          probabilidade_venda_60dias: number | null
          probabilidade_venda_90dias: number | null
          quartos: number
          score_liquidez: number | null
          sugestao_preco_inicial: number | null
          tipo: string
          titulo: string
          valor_ideal: number
          valor_maximo: number
          valor_minimo: number
        }
        Insert: {
          analise_resumo?: string | null
          area?: number
          bairro?: string | null
          cidade?: string | null
          classificacao_liquidez?: string | null
          comparaveis_count?: number | null
          created_at?: string
          dados_completos?: Json | null
          descricao?: string | null
          estado?: string | null
          estrategia_venda?: string | null
          id?: string
          imobiliaria_id: string
          imovel_id?: string | null
          modo?: string | null
          operacao?: string
          pontos_atencao?: Json | null
          pontos_fortes?: Json | null
          portais_recomendados?: Json | null
          preco_competitivo?: boolean | null
          preco_informado?: number | null
          preco_m2_estimado?: number | null
          preco_m2_regiao?: number | null
          probabilidade_venda_30dias?: number | null
          probabilidade_venda_60dias?: number | null
          probabilidade_venda_90dias?: number | null
          quartos?: number
          score_liquidez?: number | null
          sugestao_preco_inicial?: number | null
          tipo?: string
          titulo?: string
          valor_ideal?: number
          valor_maximo?: number
          valor_minimo?: number
        }
        Update: {
          analise_resumo?: string | null
          area?: number
          bairro?: string | null
          cidade?: string | null
          classificacao_liquidez?: string | null
          comparaveis_count?: number | null
          created_at?: string
          dados_completos?: Json | null
          descricao?: string | null
          estado?: string | null
          estrategia_venda?: string | null
          id?: string
          imobiliaria_id?: string
          imovel_id?: string | null
          modo?: string | null
          operacao?: string
          pontos_atencao?: Json | null
          pontos_fortes?: Json | null
          portais_recomendados?: Json | null
          preco_competitivo?: boolean | null
          preco_informado?: number | null
          preco_m2_estimado?: number | null
          preco_m2_regiao?: number | null
          probabilidade_venda_30dias?: number | null
          probabilidade_venda_60dias?: number | null
          probabilidade_venda_90dias?: number | null
          quartos?: number
          score_liquidez?: number | null
          sugestao_preco_inicial?: number | null
          tipo?: string
          titulo?: string
          valor_ideal?: number
          valor_maximo?: number
          valor_minimo?: number
        }
        Relationships: []
      }
      batch_exports: {
        Row: {
          created_at: string | null
          download_url: string | null
          error_message: string | null
          filename: string
          filters: Json | null
          id: string
          idempotency_key: string | null
          imobiliaria_id: string
          processed_items: number | null
          search_params: Json | null
          status: string
          total_items: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          download_url?: string | null
          error_message?: string | null
          filename: string
          filters?: Json | null
          id?: string
          idempotency_key?: string | null
          imobiliaria_id: string
          processed_items?: number | null
          search_params?: Json | null
          status?: string
          total_items?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          download_url?: string | null
          error_message?: string | null
          filename?: string
          filters?: Json | null
          id?: string
          idempotency_key?: string | null
          imobiliaria_id?: string
          processed_items?: number | null
          search_params?: Json | null
          status?: string
          total_items?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      blog_analises_ia: {
        Row: {
          created_at: string
          id: string
          imobiliaria_id: string
          modelo: string | null
          nichos: Json
          resultado: Json
          topicos: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          imobiliaria_id: string
          modelo?: string | null
          nichos?: Json
          resultado?: Json
          topicos?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          imobiliaria_id?: string
          modelo?: string | null
          nichos?: Json
          resultado?: Json
          topicos?: string | null
        }
        Relationships: []
      }
      blog_rss_defaults: {
        Row: {
          cache_seconds: number | null
          cidade: string | null
          created_at: string
          id: string
          limit: number | null
          tipo: string | null
          updated_at: string
        }
        Insert: {
          cache_seconds?: number | null
          cidade?: string | null
          created_at?: string
          id?: string
          limit?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          cache_seconds?: number | null
          cidade?: string | null
          created_at?: string
          id?: string
          limit?: number | null
          tipo?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      blog_sugestoes_ia: {
        Row: {
          analise_id: string | null
          angulo: string | null
          created_at: string
          estrutura: Json
          formato: string | null
          id: string
          imobiliaria_id: string
          keyword_primaria: string | null
          keywords_secundarias: Json
          potencial_engajamento: string | null
          potencial_seo: string | null
          publico_alvo: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          analise_id?: string | null
          angulo?: string | null
          created_at?: string
          estrutura?: Json
          formato?: string | null
          id?: string
          imobiliaria_id: string
          keyword_primaria?: string | null
          keywords_secundarias?: Json
          potencial_engajamento?: string | null
          potencial_seo?: string | null
          publico_alvo?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          analise_id?: string | null
          angulo?: string | null
          created_at?: string
          estrutura?: Json
          formato?: string | null
          id?: string
          imobiliaria_id?: string
          keyword_primaria?: string | null
          keywords_secundarias?: Json
          potencial_engajamento?: string | null
          potencial_seo?: string | null
          publico_alvo?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blog_sugestoes_ia_analise_id_fkey"
            columns: ["analise_id"]
            isOneToOne: false
            referencedRelation: "blog_analises_ia"
            referencedColumns: ["id"]
          },
        ]
      }
      calibracao_datasets: {
        Row: {
          criado_em: string
          criado_por: string | null
          descricao: string | null
          id: string
          imobiliaria_id: string
          itens: Json
          janela_dias: number | null
          nome: string
          origem: string
          periodo_fim: string | null
          periodo_inicio: string | null
          positivos: number
          total_itens: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          imobiliaria_id: string
          itens?: Json
          janela_dias?: number | null
          nome: string
          origem?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          positivos?: number
          total_itens?: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          imobiliaria_id?: string
          itens?: Json
          janela_dias?: number | null
          nome?: string
          origem?: string
          periodo_fim?: string | null
          periodo_inicio?: string | null
          positivos?: number
          total_itens?: number
        }
        Relationships: []
      }
      calibracao_falhas_log: {
        Row: {
          ai_modelo: string | null
          ai_provider: string | null
          criado_em: string
          duracao_ms: number | null
          erro: string
          fingerprint: string
          http_status: number | null
          id: string
          imobiliaria_id: string
          notificado: boolean
          ocorrencias_24h: number
          payload: Json
          query_context: Json
          run_id: string | null
          stack: string | null
        }
        Insert: {
          ai_modelo?: string | null
          ai_provider?: string | null
          criado_em?: string
          duracao_ms?: number | null
          erro: string
          fingerprint: string
          http_status?: number | null
          id?: string
          imobiliaria_id: string
          notificado?: boolean
          ocorrencias_24h?: number
          payload?: Json
          query_context?: Json
          run_id?: string | null
          stack?: string | null
        }
        Update: {
          ai_modelo?: string | null
          ai_provider?: string | null
          criado_em?: string
          duracao_ms?: number | null
          erro?: string
          fingerprint?: string
          http_status?: number | null
          id?: string
          imobiliaria_id?: string
          notificado?: boolean
          ocorrencias_24h?: number
          payload?: Json
          query_context?: Json
          run_id?: string | null
          stack?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calibracao_falhas_log_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "calibracao_filtro_ia_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      calibracao_filtro_ia_runs: {
        Row: {
          accuracy_v: number | null
          amostra_total: number
          auc: number | null
          config: Json
          conversao_geral: number | null
          conversao_preditos: number | null
          criado_em: string
          criado_por: string | null
          dataset_id: string | null
          duracao_ms: number | null
          erro: string | null
          f1_v: number | null
          finalizado_em: string | null
          fn: number
          fnr: number | null
          fp: number
          fpr: number | null
          id: string
          imobiliaria_id: string
          janela_dias: number
          latency_batches: number | null
          latency_ms_avg: number | null
          latency_ms_p50: number | null
          latency_ms_p95: number | null
          latency_ms_p99: number | null
          latency_ms_total: number | null
          lift: number | null
          modelo: string | null
          nome: string | null
          notas: string | null
          positivos_preditos: number
          positivos_reais: number
          precision_v: number | null
          provider: string | null
          recall_v: number | null
          resultados_amostra: Json | null
          roc_curve: Json | null
          status: string
          threshold_ai: number
          threshold_sweep: Json | null
          tn: number
          tp: number
        }
        Insert: {
          accuracy_v?: number | null
          amostra_total?: number
          auc?: number | null
          config?: Json
          conversao_geral?: number | null
          conversao_preditos?: number | null
          criado_em?: string
          criado_por?: string | null
          dataset_id?: string | null
          duracao_ms?: number | null
          erro?: string | null
          f1_v?: number | null
          finalizado_em?: string | null
          fn?: number
          fnr?: number | null
          fp?: number
          fpr?: number | null
          id?: string
          imobiliaria_id: string
          janela_dias?: number
          latency_batches?: number | null
          latency_ms_avg?: number | null
          latency_ms_p50?: number | null
          latency_ms_p95?: number | null
          latency_ms_p99?: number | null
          latency_ms_total?: number | null
          lift?: number | null
          modelo?: string | null
          nome?: string | null
          notas?: string | null
          positivos_preditos?: number
          positivos_reais?: number
          precision_v?: number | null
          provider?: string | null
          recall_v?: number | null
          resultados_amostra?: Json | null
          roc_curve?: Json | null
          status?: string
          threshold_ai?: number
          threshold_sweep?: Json | null
          tn?: number
          tp?: number
        }
        Update: {
          accuracy_v?: number | null
          amostra_total?: number
          auc?: number | null
          config?: Json
          conversao_geral?: number | null
          conversao_preditos?: number | null
          criado_em?: string
          criado_por?: string | null
          dataset_id?: string | null
          duracao_ms?: number | null
          erro?: string | null
          f1_v?: number | null
          finalizado_em?: string | null
          fn?: number
          fnr?: number | null
          fp?: number
          fpr?: number | null
          id?: string
          imobiliaria_id?: string
          janela_dias?: number
          latency_batches?: number | null
          latency_ms_avg?: number | null
          latency_ms_p50?: number | null
          latency_ms_p95?: number | null
          latency_ms_p99?: number | null
          latency_ms_total?: number | null
          lift?: number | null
          modelo?: string | null
          nome?: string | null
          notas?: string | null
          positivos_preditos?: number
          positivos_reais?: number
          precision_v?: number | null
          provider?: string | null
          recall_v?: number | null
          resultados_amostra?: Json | null
          roc_curve?: Json | null
          status?: string
          threshold_ai?: number
          threshold_sweep?: Json | null
          tn?: number
          tp?: number
        }
        Relationships: [
          {
            foreignKeyName: "calibracao_filtro_ia_runs_dataset_id_fkey"
            columns: ["dataset_id"]
            isOneToOne: false
            referencedRelation: "calibracao_datasets"
            referencedColumns: ["id"]
          },
        ]
      }
      captacao_anuncios_extraidos: {
        Row: {
          anunciante_tipo: string
          bairro: string | null
          cidade: string | null
          created_at: string
          dados: Json
          email: string | null
          estado: string | null
          extraction_status: string
          id: string
          imobiliaria_id: string
          missing_fields: string[]
          observacoes: string | null
          portal: string | null
          preco: number | null
          telefone: string | null
          titulo: string | null
          updated_at: string
          url_anuncio: string
        }
        Insert: {
          anunciante_tipo?: string
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          dados?: Json
          email?: string | null
          estado?: string | null
          extraction_status?: string
          id?: string
          imobiliaria_id: string
          missing_fields?: string[]
          observacoes?: string | null
          portal?: string | null
          preco?: number | null
          telefone?: string | null
          titulo?: string | null
          updated_at?: string
          url_anuncio: string
        }
        Update: {
          anunciante_tipo?: string
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          dados?: Json
          email?: string | null
          estado?: string | null
          extraction_status?: string
          id?: string
          imobiliaria_id?: string
          missing_fields?: string[]
          observacoes?: string | null
          portal?: string | null
          preco?: number | null
          telefone?: string | null
          titulo?: string | null
          updated_at?: string
          url_anuncio?: string
        }
        Relationships: []
      }
      captacao_buscas_agendadas: {
        Row: {
          ativo: boolean
          created_at: string
          fingerprints_conhecidos: string[]
          frequencia: string
          id: string
          imobiliaria_id: string
          nome: string
          params: Json
          proxima_execucao: string
          ultima_execucao: string | null
          ultimo_novos: number
          ultimo_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          fingerprints_conhecidos?: string[]
          frequencia: string
          id?: string
          imobiliaria_id: string
          nome: string
          params: Json
          proxima_execucao?: string
          ultima_execucao?: string | null
          ultimo_novos?: number
          ultimo_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          fingerprints_conhecidos?: string[]
          frequencia?: string
          id?: string
          imobiliaria_id?: string
          nome?: string
          params?: Json
          proxima_execucao?: string
          ultima_execucao?: string | null
          ultimo_novos?: number
          ultimo_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      captacao_execucoes_historico: {
        Row: {
          action: string
          cidades_alvo: string[]
          created_at: string
          duracao_ms: number | null
          erro: string | null
          finalizado_em: string | null
          id: string
          imobiliaria_id: string
          iniciado_em: string
          itens_processados: number
          parametros: Json
          portais_consultados: string[]
          resultados_encontrados: number
          status: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          action: string
          cidades_alvo?: string[]
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          imobiliaria_id: string
          iniciado_em?: string
          itens_processados?: number
          parametros?: Json
          portais_consultados?: string[]
          resultados_encontrados?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          cidades_alvo?: string[]
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          finalizado_em?: string | null
          id?: string
          imobiliaria_id?: string
          iniciado_em?: string
          itens_processados?: number
          parametros?: Json
          portais_consultados?: string[]
          resultados_encontrados?: number
          status?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      captacao_fontes_allowlist: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          descricao: string | null
          dominio_pattern: string
          fonte_tipo: string
          id: string
          imobiliaria_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          dominio_pattern: string
          fonte_tipo: string
          id?: string
          imobiliaria_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          dominio_pattern?: string
          fonte_tipo?: string
          id?: string
          imobiliaria_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      captacao_fontes_dados: {
        Row: {
          ativo: boolean
          base_legal: string
          campo: string
          coletado_em: string
          coletado_por: string | null
          fonte_expirada: boolean
          fonte_snippet: string | null
          fonte_tipo: string
          fonte_titulo: string | null
          fonte_url: string
          hash_conteudo: string | null
          id: string
          imobiliaria_id: string
          lead_id: string
          lead_tipo: string
          metodo_coleta: string
          removido_em: string | null
          removido_motivo: string | null
          updated_at: string
          valor_capturado: string | null
        }
        Insert: {
          ativo?: boolean
          base_legal?: string
          campo: string
          coletado_em?: string
          coletado_por?: string | null
          fonte_expirada?: boolean
          fonte_snippet?: string | null
          fonte_tipo: string
          fonte_titulo?: string | null
          fonte_url: string
          hash_conteudo?: string | null
          id?: string
          imobiliaria_id: string
          lead_id: string
          lead_tipo: string
          metodo_coleta?: string
          removido_em?: string | null
          removido_motivo?: string | null
          updated_at?: string
          valor_capturado?: string | null
        }
        Update: {
          ativo?: boolean
          base_legal?: string
          campo?: string
          coletado_em?: string
          coletado_por?: string | null
          fonte_expirada?: boolean
          fonte_snippet?: string | null
          fonte_tipo?: string
          fonte_titulo?: string | null
          fonte_url?: string
          hash_conteudo?: string | null
          id?: string
          imobiliaria_id?: string
          lead_id?: string
          lead_tipo?: string
          metodo_coleta?: string
          removido_em?: string | null
          removido_motivo?: string | null
          updated_at?: string
          valor_capturado?: string | null
        }
        Relationships: []
      }
      captacao_lgpd_solicitacoes: {
        Row: {
          atendida_em: string | null
          atendida_por: string | null
          contato_titular: string | null
          created_at: string
          descricao: string | null
          id: string
          imobiliaria_id: string
          ip_origem: string | null
          lead_id: string
          lead_tipo: string
          observacao_interna: string | null
          status: string
          tipo_solicitacao: string
          token_verificacao: string | null
          updated_at: string
        }
        Insert: {
          atendida_em?: string | null
          atendida_por?: string | null
          contato_titular?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          imobiliaria_id: string
          ip_origem?: string | null
          lead_id: string
          lead_tipo: string
          observacao_interna?: string | null
          status?: string
          tipo_solicitacao: string
          token_verificacao?: string | null
          updated_at?: string
        }
        Update: {
          atendida_em?: string | null
          atendida_por?: string | null
          contato_titular?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          imobiliaria_id?: string
          ip_origem?: string | null
          lead_id?: string
          lead_tipo?: string
          observacao_interna?: string | null
          status?: string
          tipo_solicitacao?: string
          token_verificacao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      captacao_pipeline: {
        Row: {
          campos_verificados: Json
          corretor_id: string | null
          created_at: string
          created_by: string | null
          dados: Json
          email: string | null
          escalonado_em: string | null
          estagio: Database["public"]["Enums"]["captacao_pipeline_estagio"]
          estagio_desde: string
          fontes_resumo: Json
          id: string
          imobiliaria_id: string
          imovel_bairro: string | null
          imovel_cidade: string | null
          imovel_endereco: string | null
          imovel_tipo: string | null
          lgpd_status: string
          nome: string
          operacao: string | null
          origem: string | null
          perdido_motivo: string | null
          radarzap_lead_id: string | null
          telefone: string | null
          telefone_e164: string | null
          ultima_atividade_em: string | null
          updated_at: string
          valor_estimado: number | null
          won_em: string | null
          won_valor: number | null
        }
        Insert: {
          campos_verificados?: Json
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          email?: string | null
          escalonado_em?: string | null
          estagio?: Database["public"]["Enums"]["captacao_pipeline_estagio"]
          estagio_desde?: string
          fontes_resumo?: Json
          id?: string
          imobiliaria_id: string
          imovel_bairro?: string | null
          imovel_cidade?: string | null
          imovel_endereco?: string | null
          imovel_tipo?: string | null
          lgpd_status?: string
          nome: string
          operacao?: string | null
          origem?: string | null
          perdido_motivo?: string | null
          radarzap_lead_id?: string | null
          telefone?: string | null
          telefone_e164?: string | null
          ultima_atividade_em?: string | null
          updated_at?: string
          valor_estimado?: number | null
          won_em?: string | null
          won_valor?: number | null
        }
        Update: {
          campos_verificados?: Json
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          dados?: Json
          email?: string | null
          escalonado_em?: string | null
          estagio?: Database["public"]["Enums"]["captacao_pipeline_estagio"]
          estagio_desde?: string
          fontes_resumo?: Json
          id?: string
          imobiliaria_id?: string
          imovel_bairro?: string | null
          imovel_cidade?: string | null
          imovel_endereco?: string | null
          imovel_tipo?: string | null
          lgpd_status?: string
          nome?: string
          operacao?: string | null
          origem?: string | null
          perdido_motivo?: string | null
          radarzap_lead_id?: string | null
          telefone?: string | null
          telefone_e164?: string | null
          ultima_atividade_em?: string | null
          updated_at?: string
          valor_estimado?: number | null
          won_em?: string | null
          won_valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "captacao_pipeline_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      captacao_pipeline_atividades: {
        Row: {
          created_at: string
          criado_por: string | null
          data_atividade: string
          descricao: string | null
          id: string
          imobiliaria_id: string
          metadata: Json
          pipeline_id: string
          tipo: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          data_atividade?: string
          descricao?: string | null
          id?: string
          imobiliaria_id: string
          metadata?: Json
          pipeline_id: string
          tipo: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          data_atividade?: string
          descricao?: string | null
          id?: string
          imobiliaria_id?: string
          metadata?: Json
          pipeline_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "captacao_pipeline_atividades_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "captacao_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      captacao_pipeline_config: {
        Row: {
          alertas_email_ativo: boolean
          created_at: string
          followup_ativo: boolean
          followup_atraso_horas: number
          imobiliaria_id: string
          sla_autorizacao_horas: number
          sla_avaliacao_horas: number
          sla_contactado_horas: number
          sla_escalonamento_horas_extra: number
          sla_followup_dias_json: Json
          sla_inatividade_horas: number
          sla_interessado_horas: number
          sla_prospectado_horas: number
          updated_at: string
        }
        Insert: {
          alertas_email_ativo?: boolean
          created_at?: string
          followup_ativo?: boolean
          followup_atraso_horas?: number
          imobiliaria_id: string
          sla_autorizacao_horas?: number
          sla_avaliacao_horas?: number
          sla_contactado_horas?: number
          sla_escalonamento_horas_extra?: number
          sla_followup_dias_json?: Json
          sla_inatividade_horas?: number
          sla_interessado_horas?: number
          sla_prospectado_horas?: number
          updated_at?: string
        }
        Update: {
          alertas_email_ativo?: boolean
          created_at?: string
          followup_ativo?: boolean
          followup_atraso_horas?: number
          imobiliaria_id?: string
          sla_autorizacao_horas?: number
          sla_avaliacao_horas?: number
          sla_contactado_horas?: number
          sla_escalonamento_horas_extra?: number
          sla_followup_dias_json?: Json
          sla_inatividade_horas?: number
          sla_interessado_horas?: number
          sla_prospectado_horas?: number
          updated_at?: string
        }
        Relationships: []
      }
      captacao_pipeline_followups: {
        Row: {
          agendado_para: string
          canal: string
          corretor_id: string | null
          created_at: string
          dia_offset: number
          executado_em: string | null
          executado_por: string | null
          id: string
          imobiliaria_id: string
          notificado_em: string | null
          observacao: string | null
          pipeline_id: string
          resultado: string | null
          status: string
          tipo: string
          updated_at: string
        }
        Insert: {
          agendado_para: string
          canal?: string
          corretor_id?: string | null
          created_at?: string
          dia_offset: number
          executado_em?: string | null
          executado_por?: string | null
          id?: string
          imobiliaria_id: string
          notificado_em?: string | null
          observacao?: string | null
          pipeline_id: string
          resultado?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          agendado_para?: string
          canal?: string
          corretor_id?: string | null
          created_at?: string
          dia_offset?: number
          executado_em?: string | null
          executado_por?: string | null
          id?: string
          imobiliaria_id?: string
          notificado_em?: string | null
          observacao?: string | null
          pipeline_id?: string
          resultado?: string | null
          status?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captacao_pipeline_followups_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "captacao_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      captacao_pipeline_historico: {
        Row: {
          created_at: string
          de_estagio:
            | Database["public"]["Enums"]["captacao_pipeline_estagio"]
            | null
          duracao_horas: number | null
          id: string
          imobiliaria_id: string
          metadata: Json
          movido_por: string | null
          para_estagio: Database["public"]["Enums"]["captacao_pipeline_estagio"]
          pipeline_id: string
        }
        Insert: {
          created_at?: string
          de_estagio?:
            | Database["public"]["Enums"]["captacao_pipeline_estagio"]
            | null
          duracao_horas?: number | null
          id?: string
          imobiliaria_id: string
          metadata?: Json
          movido_por?: string | null
          para_estagio: Database["public"]["Enums"]["captacao_pipeline_estagio"]
          pipeline_id: string
        }
        Update: {
          created_at?: string
          de_estagio?:
            | Database["public"]["Enums"]["captacao_pipeline_estagio"]
            | null
          duracao_horas?: number | null
          id?: string
          imobiliaria_id?: string
          metadata?: Json
          movido_por?: string | null
          para_estagio?: Database["public"]["Enums"]["captacao_pipeline_estagio"]
          pipeline_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "captacao_pipeline_historico_pipeline_id_fkey"
            columns: ["pipeline_id"]
            isOneToOne: false
            referencedRelation: "captacao_pipeline"
            referencedColumns: ["id"]
          },
        ]
      }
      captacao_portais_allowlist: {
        Row: {
          ativo: boolean
          created_at: string
          created_by: string | null
          dominio: string
          id: string
          notas: string | null
          regiao: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          dominio: string
          id?: string
          notas?: string | null
          regiao?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          created_by?: string | null
          dominio?: string
          id?: string
          notas?: string | null
          regiao?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      captacao_portais_allowlist_versoes: {
        Row: {
          acao: string
          changed_at: string
          changed_by: string | null
          dados_antes: Json | null
          dados_depois: Json | null
          dominio: string
          id: string
          portal_id: string | null
        }
        Insert: {
          acao: string
          changed_at?: string
          changed_by?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          dominio: string
          id?: string
          portal_id?: string | null
        }
        Update: {
          acao?: string
          changed_at?: string
          changed_by?: string | null
          dados_antes?: Json | null
          dados_depois?: Json | null
          dominio?: string
          id?: string
          portal_id?: string | null
        }
        Relationships: []
      }
      captacoes: {
        Row: {
          bairro: string | null
          cidade: string | null
          created_at: string
          email_contato: string | null
          endereco_imovel: string | null
          estado: string | null
          id: string
          imobiliaria_id: string
          nome_condominio: string | null
          nome_construtora: string | null
          nome_contato: string
          observacoes: string | null
          operacao: string | null
          status: string
          telefone_contato: string | null
          tipo: string
          tipo_imovel: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          email_contato?: string | null
          endereco_imovel?: string | null
          estado?: string | null
          id?: string
          imobiliaria_id: string
          nome_condominio?: string | null
          nome_construtora?: string | null
          nome_contato?: string
          observacoes?: string | null
          operacao?: string | null
          status?: string
          telefone_contato?: string | null
          tipo?: string
          tipo_imovel?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          email_contato?: string | null
          endereco_imovel?: string | null
          estado?: string | null
          id?: string
          imobiliaria_id?: string
          nome_condominio?: string | null
          nome_construtora?: string | null
          nome_contato?: string
          observacoes?: string | null
          operacao?: string | null
          status?: string
          telefone_contato?: string | null
          tipo?: string
          tipo_imovel?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes_relacionamento: {
        Row: {
          aniversario: string | null
          ativo: boolean
          created_at: string
          data_casamento: string | null
          data_compra_imovel: string | null
          data_mudanca: string | null
          data_profissao: string | null
          email: string | null
          filhos: Json | null
          id: string
          imobiliaria_id: string
          nome: string
          observacoes: string | null
          profissao: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          aniversario?: string | null
          ativo?: boolean
          created_at?: string
          data_casamento?: string | null
          data_compra_imovel?: string | null
          data_mudanca?: string | null
          data_profissao?: string | null
          email?: string | null
          filhos?: Json | null
          id?: string
          imobiliaria_id: string
          nome: string
          observacoes?: string | null
          profissao?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          aniversario?: string | null
          ativo?: boolean
          created_at?: string
          data_casamento?: string | null
          data_compra_imovel?: string | null
          data_mudanca?: string | null
          data_profissao?: string | null
          email?: string | null
          filhos?: Json | null
          id?: string
          imobiliaria_id?: string
          nome?: string
          observacoes?: string | null
          profissao?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cobrancas_lembretes_config: {
        Row: {
          ativo: boolean
          canal_email: boolean
          canal_notificacao: boolean
          canal_whatsapp: boolean
          categorias: string[]
          created_at: string
          dias_antes: number[]
          dias_apos: number[]
          imobiliaria_id: string
          mensagem_template: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal_email?: boolean
          canal_notificacao?: boolean
          canal_whatsapp?: boolean
          categorias?: string[]
          created_at?: string
          dias_antes?: number[]
          dias_apos?: number[]
          imobiliaria_id: string
          mensagem_template?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal_email?: boolean
          canal_notificacao?: boolean
          canal_whatsapp?: boolean
          categorias?: string[]
          created_at?: string
          dias_antes?: number[]
          dias_apos?: number[]
          imobiliaria_id?: string
          mensagem_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      compromissos: {
        Row: {
          checkin_at: string | null
          checkout_at: string | null
          cliente_resposta: string | null
          confirmacao_mensagem: string | null
          confirmacao_status: string
          confirmacao_token: string | null
          confirmado: boolean
          corretor_id: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string
          data_reagendamento_sugerida: string | null
          descricao: string | null
          email_cliente: string | null
          feedback_ia: string | null
          feedback_visita: string | null
          google_maps_link: string | null
          id: string
          imobiliaria_id: string
          imovel_id: string | null
          lead_id: string | null
          lembrete_enviado: boolean
          lembrete_nivel: number
          lembrete_whatsapp: boolean
          local: string | null
          prioridade: string
          resultado_cliente: string | null
          status: string
          telefone_lembrete: string | null
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          checkin_at?: string | null
          checkout_at?: string | null
          cliente_resposta?: string | null
          confirmacao_mensagem?: string | null
          confirmacao_status?: string
          confirmacao_token?: string | null
          confirmado?: boolean
          corretor_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio: string
          data_reagendamento_sugerida?: string | null
          descricao?: string | null
          email_cliente?: string | null
          feedback_ia?: string | null
          feedback_visita?: string | null
          google_maps_link?: string | null
          id?: string
          imobiliaria_id: string
          imovel_id?: string | null
          lead_id?: string | null
          lembrete_enviado?: boolean
          lembrete_nivel?: number
          lembrete_whatsapp?: boolean
          local?: string | null
          prioridade?: string
          resultado_cliente?: string | null
          status?: string
          telefone_lembrete?: string | null
          tipo?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          checkin_at?: string | null
          checkout_at?: string | null
          cliente_resposta?: string | null
          confirmacao_mensagem?: string | null
          confirmacao_status?: string
          confirmacao_token?: string | null
          confirmado?: boolean
          corretor_id?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          data_reagendamento_sugerida?: string | null
          descricao?: string | null
          email_cliente?: string | null
          feedback_ia?: string | null
          feedback_visita?: string | null
          google_maps_link?: string | null
          id?: string
          imobiliaria_id?: string
          imovel_id?: string | null
          lead_id?: string | null
          lembrete_enviado?: boolean
          lembrete_nivel?: number
          lembrete_whatsapp?: boolean
          local?: string | null
          prioridade?: string
          resultado_cliente?: string | null
          status?: string
          telefone_lembrete?: string | null
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compromissos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromissos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compromissos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_contatos: {
        Row: {
          cargo: string | null
          condominio_id: string | null
          condominio_nome: string
          confianca: number
          created_at: string
          email: string | null
          id: string
          imobiliaria_id: string
          metadata: Json
          nome: string | null
          status: string
          telefone: string | null
          tipo: string
          trecho_fonte: string | null
          updated_at: string
          url_fonte: string
        }
        Insert: {
          cargo?: string | null
          condominio_id?: string | null
          condominio_nome: string
          confianca?: number
          created_at?: string
          email?: string | null
          id?: string
          imobiliaria_id: string
          metadata?: Json
          nome?: string | null
          status?: string
          telefone?: string | null
          tipo: string
          trecho_fonte?: string | null
          updated_at?: string
          url_fonte: string
        }
        Update: {
          cargo?: string | null
          condominio_id?: string | null
          condominio_nome?: string
          confianca?: number
          created_at?: string
          email?: string | null
          id?: string
          imobiliaria_id?: string
          metadata?: Json
          nome?: string | null
          status?: string
          telefone?: string | null
          tipo?: string
          trecho_fonte?: string | null
          updated_at?: string
          url_fonte?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominio_contatos_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios_df"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_enriquecimento_runs: {
        Row: {
          bairro: string | null
          cep: string | null
          condominio_nome: string
          consultas: Json
          contatos_encontrados: number
          created_at: string
          duracao_ms: number | null
          erro: string | null
          fontes: Json
          id: string
          imobiliaria_id: string
          status: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          condominio_nome: string
          consultas?: Json
          contatos_encontrados?: number
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          fontes?: Json
          id?: string
          imobiliaria_id: string
          status?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          condominio_nome?: string
          consultas?: Json
          contatos_encontrados?: number
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          fontes?: Json
          id?: string
          imobiliaria_id?: string
          status?: string
        }
        Relationships: []
      }
      condominio_historico_notas: {
        Row: {
          anexo_nome: string | null
          anexo_path: string | null
          anexo_tamanho: number | null
          anexo_tipo: string | null
          autor_id: string
          autor_nome: string | null
          created_at: string
          historico_id: string
          id: string
          imobiliaria_id: string
          prospeccao_id: string
          texto: string | null
          updated_at: string
          visibilidade: string
        }
        Insert: {
          anexo_nome?: string | null
          anexo_path?: string | null
          anexo_tamanho?: number | null
          anexo_tipo?: string | null
          autor_id?: string
          autor_nome?: string | null
          created_at?: string
          historico_id: string
          id?: string
          imobiliaria_id: string
          prospeccao_id: string
          texto?: string | null
          updated_at?: string
          visibilidade?: string
        }
        Update: {
          anexo_nome?: string | null
          anexo_path?: string | null
          anexo_tamanho?: number | null
          anexo_tipo?: string | null
          autor_id?: string
          autor_nome?: string | null
          created_at?: string
          historico_id?: string
          id?: string
          imobiliaria_id?: string
          prospeccao_id?: string
          texto?: string | null
          updated_at?: string
          visibilidade?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominio_historico_notas_historico_id_fkey"
            columns: ["historico_id"]
            isOneToOne: false
            referencedRelation: "condominio_prospeccao_historico"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condominio_historico_notas_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "condominio_prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_iniciativa_logs: {
        Row: {
          autor: string | null
          conteudo: string
          created_at: string
          id: string
          imobiliaria_id: string
          iniciativa_id: string
          metadata: Json
          tipo: string
        }
        Insert: {
          autor?: string | null
          conteudo: string
          created_at?: string
          id?: string
          imobiliaria_id: string
          iniciativa_id: string
          metadata?: Json
          tipo: string
        }
        Update: {
          autor?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string
          iniciativa_id?: string
          metadata?: Json
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominio_iniciativa_logs_iniciativa_id_fkey"
            columns: ["iniciativa_id"]
            isOneToOne: false
            referencedRelation: "condominio_iniciativas"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_iniciativas: {
        Row: {
          bairro: string | null
          canal: string
          cep: string | null
          condominio_id: string | null
          condominio_nome: string
          created_at: string
          created_by: string | null
          data_agendada: string | null
          data_conclusao: string | null
          descricao: string | null
          id: string
          imobiliaria_id: string
          metadata: Json
          responsavel: string | null
          resultado: string | null
          status: string
          titulo: string
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          canal: string
          cep?: string | null
          condominio_id?: string | null
          condominio_nome: string
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          id?: string
          imobiliaria_id: string
          metadata?: Json
          responsavel?: string | null
          resultado?: string | null
          status?: string
          titulo: string
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          canal?: string
          cep?: string | null
          condominio_id?: string | null
          condominio_nome?: string
          created_at?: string
          created_by?: string | null
          data_agendada?: string | null
          data_conclusao?: string | null
          descricao?: string | null
          id?: string
          imobiliaria_id?: string
          metadata?: Json
          responsavel?: string | null
          resultado?: string | null
          status?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominio_iniciativas_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios_df"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_mensagens_enviadas: {
        Row: {
          assunto: string | null
          canal: string
          condominio_nome: string
          destinatario: string | null
          destinatario_tipo: string | null
          id: string
          imobiliaria_id: string
          metadata: Json
          prospeccao_id: string | null
          roteiro_id: string | null
          sent_at: string
          sent_by: string | null
          texto_final: string
          versao: number | null
        }
        Insert: {
          assunto?: string | null
          canal: string
          condominio_nome: string
          destinatario?: string | null
          destinatario_tipo?: string | null
          id?: string
          imobiliaria_id: string
          metadata?: Json
          prospeccao_id?: string | null
          roteiro_id?: string | null
          sent_at?: string
          sent_by?: string | null
          texto_final: string
          versao?: number | null
        }
        Update: {
          assunto?: string | null
          canal?: string
          condominio_nome?: string
          destinatario?: string | null
          destinatario_tipo?: string | null
          id?: string
          imobiliaria_id?: string
          metadata?: Json
          prospeccao_id?: string | null
          roteiro_id?: string | null
          sent_at?: string
          sent_by?: string | null
          texto_final?: string
          versao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "condominio_mensagens_enviadas_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "condominio_prospeccoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condominio_mensagens_enviadas_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "condominio_roteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_notificacoes_config: {
        Row: {
          created_at: string
          destinatarios_email: string[]
          destinatarios_wa: string[]
          email_enabled: boolean
          imobiliaria_id: string
          tipos_habilitados: string[]
          updated_at: string
          wa_enabled: boolean
        }
        Insert: {
          created_at?: string
          destinatarios_email?: string[]
          destinatarios_wa?: string[]
          email_enabled?: boolean
          imobiliaria_id: string
          tipos_habilitados?: string[]
          updated_at?: string
          wa_enabled?: boolean
        }
        Update: {
          created_at?: string
          destinatarios_email?: string[]
          destinatarios_wa?: string[]
          email_enabled?: boolean
          imobiliaria_id?: string
          tipos_habilitados?: string[]
          updated_at?: string
          wa_enabled?: boolean
        }
        Relationships: []
      }
      condominio_notificacoes_eventos: {
        Row: {
          condominio_nome: string | null
          created_at: string
          id: string
          imobiliaria_id: string
          payload: Json
          processed_at: string | null
          prospeccao_id: string | null
          resultado: Json | null
          status: string
          tentativas: number
          tipo: string
          ultimo_erro: string | null
        }
        Insert: {
          condominio_nome?: string | null
          created_at?: string
          id?: string
          imobiliaria_id: string
          payload?: Json
          processed_at?: string | null
          prospeccao_id?: string | null
          resultado?: Json | null
          status?: string
          tentativas?: number
          tipo: string
          ultimo_erro?: string | null
        }
        Update: {
          condominio_nome?: string | null
          created_at?: string
          id?: string
          imobiliaria_id?: string
          payload?: Json
          processed_at?: string | null
          prospeccao_id?: string | null
          resultado?: Json | null
          status?: string
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
        }
        Relationships: []
      }
      condominio_prospeccao_agendamentos: {
        Row: {
          agendado_para: string
          concluido_em: string | null
          created_at: string
          created_by: string | null
          descricao: string | null
          etapa: string
          id: string
          imobiliaria_id: string
          intervalo_dias: number
          max_tentativas: number
          motivo_pausa: string | null
          observacao: string | null
          parent_id: string | null
          pausado_ate: string | null
          prospeccao_id: string
          status: string
          tentativa_num: number
          updated_at: string
        }
        Insert: {
          agendado_para: string
          concluido_em?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          etapa: string
          id?: string
          imobiliaria_id: string
          intervalo_dias?: number
          max_tentativas?: number
          motivo_pausa?: string | null
          observacao?: string | null
          parent_id?: string | null
          pausado_ate?: string | null
          prospeccao_id: string
          status?: string
          tentativa_num?: number
          updated_at?: string
        }
        Update: {
          agendado_para?: string
          concluido_em?: string | null
          created_at?: string
          created_by?: string | null
          descricao?: string | null
          etapa?: string
          id?: string
          imobiliaria_id?: string
          intervalo_dias?: number
          max_tentativas?: number
          motivo_pausa?: string | null
          observacao?: string | null
          parent_id?: string | null
          pausado_ate?: string | null
          prospeccao_id?: string
          status?: string
          tentativa_num?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominio_prospeccao_agendamentos_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "condominio_prospeccao_agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "condominio_prospeccao_agendamentos_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "condominio_prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_prospeccao_historico: {
        Row: {
          changed_by: string | null
          created_at: string
          etapa: string | null
          id: string
          imobiliaria_id: string
          nota: string | null
          prospeccao_id: string
          tipo: string
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          etapa?: string | null
          id?: string
          imobiliaria_id: string
          nota?: string | null
          prospeccao_id: string
          tipo: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          etapa?: string | null
          id?: string
          imobiliaria_id?: string
          nota?: string | null
          prospeccao_id?: string
          tipo?: string
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "condominio_prospeccao_historico_prospeccao_id_fkey"
            columns: ["prospeccao_id"]
            isOneToOne: false
            referencedRelation: "condominio_prospeccoes"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_prospeccoes: {
        Row: {
          bairro: string | null
          cep: string | null
          condominio_id: string | null
          condominio_nome: string
          created_at: string
          created_by: string | null
          email_adm: string | null
          endereco: string | null
          etapas_concluidas: Json
          id: string
          imobiliaria_id: string
          metadata: Json
          nome_adm: string | null
          progresso: number
          status: string
          telefone_portaria: string | null
          telefone_sindico: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          condominio_id?: string | null
          condominio_nome: string
          created_at?: string
          created_by?: string | null
          email_adm?: string | null
          endereco?: string | null
          etapas_concluidas?: Json
          id?: string
          imobiliaria_id: string
          metadata?: Json
          nome_adm?: string | null
          progresso?: number
          status?: string
          telefone_portaria?: string | null
          telefone_sindico?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          condominio_id?: string | null
          condominio_nome?: string
          created_at?: string
          created_by?: string | null
          email_adm?: string | null
          endereco?: string | null
          etapas_concluidas?: Json
          id?: string
          imobiliaria_id?: string
          metadata?: Json
          nome_adm?: string | null
          progresso?: number
          status?: string
          telefone_portaria?: string | null
          telefone_sindico?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "condominio_prospeccoes_condominio_id_fkey"
            columns: ["condominio_id"]
            isOneToOne: false
            referencedRelation: "condominios_df"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_roteiro_versoes: {
        Row: {
          assunto: string | null
          changed_by: string | null
          corpo: string
          created_at: string
          id: string
          imobiliaria_id: string
          nota: string | null
          roteiro_id: string
          titulo: string
          versao: number
        }
        Insert: {
          assunto?: string | null
          changed_by?: string | null
          corpo: string
          created_at?: string
          id?: string
          imobiliaria_id: string
          nota?: string | null
          roteiro_id: string
          titulo: string
          versao: number
        }
        Update: {
          assunto?: string | null
          changed_by?: string | null
          corpo?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string
          nota?: string | null
          roteiro_id?: string
          titulo?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "condominio_roteiro_versoes_roteiro_id_fkey"
            columns: ["roteiro_id"]
            isOneToOne: false
            referencedRelation: "condominio_roteiros"
            referencedColumns: ["id"]
          },
        ]
      }
      condominio_roteiros: {
        Row: {
          assunto: string | null
          ativo: boolean
          canal: string
          condominio_nome: string | null
          corpo: string
          created_at: string
          created_by: string | null
          id: string
          imobiliaria_id: string
          titulo: string
          updated_at: string
          versao_atual: number
        }
        Insert: {
          assunto?: string | null
          ativo?: boolean
          canal: string
          condominio_nome?: string | null
          corpo: string
          created_at?: string
          created_by?: string | null
          id?: string
          imobiliaria_id: string
          titulo: string
          updated_at?: string
          versao_atual?: number
        }
        Update: {
          assunto?: string | null
          ativo?: boolean
          canal?: string
          condominio_nome?: string | null
          corpo?: string
          created_at?: string
          created_by?: string | null
          id?: string
          imobiliaria_id?: string
          titulo?: string
          updated_at?: string
          versao_atual?: number
        }
        Relationships: []
      }
      condominios_df: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          created_at: string
          endereco: string | null
          external_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          nome: string
          raw_data: Json | null
          source: string
          telefone: string | null
          uf: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          external_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome: string
          raw_data?: Json | null
          source: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          created_at?: string
          endereco?: string | null
          external_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          nome?: string
          raw_data?: Json | null
          source?: string
          telefone?: string | null
          uf?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      contatos_landing: {
        Row: {
          created_at: string
          email: string
          extracted_data: Json | null
          extraction_status:
            | Database["public"]["Enums"]["extraction_status"]
            | null
          id: string
          lido: boolean
          mensagem: string
          missing_fields: string[] | null
          nome: string
          source_url: string | null
          telefone: string | null
        }
        Insert: {
          created_at?: string
          email: string
          extracted_data?: Json | null
          extraction_status?:
            | Database["public"]["Enums"]["extraction_status"]
            | null
          id?: string
          lido?: boolean
          mensagem: string
          missing_fields?: string[] | null
          nome: string
          source_url?: string | null
          telefone?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          extracted_data?: Json | null
          extraction_status?:
            | Database["public"]["Enums"]["extraction_status"]
            | null
          id?: string
          lido?: boolean
          mensagem?: string
          missing_fields?: string[] | null
          nome?: string
          source_url?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      conteudo_seo_autopublish_config: {
        Row: {
          ativo: boolean
          atraso_horas: number
          bloquear_publicacao_seo_critico: boolean
          created_at: string
          exigir_meta_description: boolean
          exigir_titulo_min: number
          id: string
          imobiliaria_id: string
          janela_fim: number
          janela_inicio: number
          max_por_dia: number
          min_palavras: number
          tipos_permitidos: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          atraso_horas?: number
          bloquear_publicacao_seo_critico?: boolean
          created_at?: string
          exigir_meta_description?: boolean
          exigir_titulo_min?: number
          id?: string
          imobiliaria_id: string
          janela_fim?: number
          janela_inicio?: number
          max_por_dia?: number
          min_palavras?: number
          tipos_permitidos?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          atraso_horas?: number
          bloquear_publicacao_seo_critico?: boolean
          created_at?: string
          exigir_meta_description?: boolean
          exigir_titulo_min?: number
          id?: string
          imobiliaria_id?: string
          janela_fim?: number
          janela_inicio?: number
          max_por_dia?: number
          min_palavras?: number
          tipos_permitidos?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      conteudos_seo: {
        Row: {
          agendado_para: string | null
          auto_publicado: boolean
          bairro: string | null
          cidade: string | null
          conteudo: Json
          created_at: string
          id: string
          imobiliaria_id: string
          imovel_id: string | null
          meta_description: string | null
          origem: string
          publicado_em: string | null
          slug: string | null
          status: string
          tags: string[]
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          agendado_para?: string | null
          auto_publicado?: boolean
          bairro?: string | null
          cidade?: string | null
          conteudo?: Json
          created_at?: string
          id?: string
          imobiliaria_id: string
          imovel_id?: string | null
          meta_description?: string | null
          origem?: string
          publicado_em?: string | null
          slug?: string | null
          status?: string
          tags?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Update: {
          agendado_para?: string | null
          auto_publicado?: boolean
          bairro?: string | null
          cidade?: string | null
          conteudo?: Json
          created_at?: string
          id?: string
          imobiliaria_id?: string
          imovel_id?: string | null
          meta_description?: string | null
          origem?: string
          publicado_em?: string | null
          slug?: string | null
          status?: string
          tags?: string[]
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conteudos_seo_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      conteudos_seo_versoes: {
        Row: {
          conteudo_id: string
          criado_em: string
          criado_por: string | null
          id: string
          imobiliaria_id: string
          meta_description: string | null
          origem: string
          slug: string | null
          titulo: string | null
        }
        Insert: {
          conteudo_id: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          imobiliaria_id: string
          meta_description?: string | null
          origem?: string
          slug?: string | null
          titulo?: string | null
        }
        Update: {
          conteudo_id?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          imobiliaria_id?: string
          meta_description?: string | null
          origem?: string
          slug?: string | null
          titulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conteudos_seo_versoes_conteudo_id_fkey"
            columns: ["conteudo_id"]
            isOneToOne: false
            referencedRelation: "conteudos_seo"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_anexos_anuais: {
        Row: {
          ano: number
          arquivo_url: string
          contrato_id: string
          created_at: string
          id: string
          imobiliaria_id: string
          label: string
        }
        Insert: {
          ano: number
          arquivo_url: string
          contrato_id: string
          created_at?: string
          id?: string
          imobiliaria_id: string
          label?: string
        }
        Update: {
          ano?: number
          arquivo_url?: string
          contrato_id?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string
          label?: string
        }
        Relationships: [
          {
            foreignKeyName: "contrato_anexos_anuais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contrato_comprovantes_mensais: {
        Row: {
          ano: number
          arquivo_url: string
          contrato_id: string
          created_at: string
          id: string
          imobiliaria_id: string
          label: string
          mes: number
          recebido: boolean
        }
        Insert: {
          ano: number
          arquivo_url: string
          contrato_id: string
          created_at?: string
          id?: string
          imobiliaria_id: string
          label?: string
          mes: number
          recebido?: boolean
        }
        Update: {
          ano?: number
          arquivo_url?: string
          contrato_id?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string
          label?: string
          mes?: number
          recebido?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contrato_comprovantes_mensais_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          aditivo_anexo_url: string | null
          apolice_anexo_url: string | null
          apolice_seguro: boolean
          canal_origem: string | null
          captador_comissao_percentual: number | null
          captador_comissao_valor: number | null
          captador_nome: string | null
          captador_telefone: string | null
          caucao_comprovante_url: string | null
          caucao_quantidade: number | null
          caucao_valor: number | null
          cliente: string
          cliente_cpf: string | null
          cliente_email: string | null
          cliente_rg: string | null
          cliente_telefone: string | null
          codigo_contrato: string | null
          comissao_percentual: number | null
          comissao_tipo: string | null
          comissao_valor: number | null
          comprovante_agua_url: string | null
          comprovante_luz_url: string | null
          condominio_inclui: string | null
          conjuge_cpf: string | null
          conjuge_email: string | null
          conjuge_proprietario: string | null
          conjuge_telefone: string | null
          contrato_anexo_url: string | null
          contrato_url: string | null
          corretor_comissao_percentual: number | null
          corretor_comissao_valor: number | null
          corretor_id: string | null
          corretor_nome: string | null
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          data_proxima_correcao: string | null
          data_vencimento_apolice: string | null
          dia_vencimento_aluguel: number | null
          fiador_cpf: string | null
          fiador_email: string | null
          fiador_endereco: string | null
          fiador_estado_civil: string | null
          fiador_matricula_url: string | null
          fiador_nome: string | null
          fiador_renda_url: string | null
          fiador_telefone: string | null
          fiador2_cpf: string | null
          fiador2_email: string | null
          fiador2_endereco: string | null
          fiador2_estado_civil: string | null
          fiador2_matricula_url: string | null
          fiador2_nome: string | null
          fiador2_renda_url: string | null
          fiador2_telefone: string | null
          id: string
          imobiliaria_id: string
          imovel_id: string | null
          imposto_percentual: number | null
          imposto_tipo: string | null
          imposto_valor: number | null
          indice_correcao: string | null
          inquilino: string | null
          inquilino_cpf: string | null
          inquilino_email: string | null
          inquilino_rg: string | null
          inquilino_telefone: string | null
          inquilino2_cpf: string | null
          inquilino2_email: string | null
          inquilino2_nome: string | null
          inquilino2_rg: string | null
          inquilino2_telefone: string | null
          inscricao_iptu: string | null
          iptu_parcelado: boolean | null
          matricula: string | null
          numero_agua: string | null
          numero_luz: string | null
          numero_unidade: string | null
          observacoes: string | null
          parceiro_comissao_percentual: number | null
          parceiro_comissao_valor: number | null
          parceiro_nome: string | null
          parceria_envolvidos: string[] | null
          percentual_correcao: number | null
          proprietario: string | null
          proprietario_agencia: string | null
          proprietario_banco: string | null
          proprietario_conta: string | null
          proprietario_cpf: string | null
          proprietario_email: string | null
          proprietario_id: string | null
          proprietario_pix: string | null
          proprietario_rg: string | null
          proprietario_telefone: string | null
          seguro_fianca_anexo_url: string | null
          seguro_incendio_anexo_url: string | null
          status: string
          tem_parceria: boolean | null
          tipo: string
          tipo_garantia: string | null
          titulo: string
          updated_at: string
          valor: number
          valor_condominio: number | null
          valor_iptu: number | null
          vistoria_anexo_url: string | null
          vistoria_entrada: boolean
          vistoria_video: boolean
          vistoria_video_url: string | null
        }
        Insert: {
          aditivo_anexo_url?: string | null
          apolice_anexo_url?: string | null
          apolice_seguro?: boolean
          canal_origem?: string | null
          captador_comissao_percentual?: number | null
          captador_comissao_valor?: number | null
          captador_nome?: string | null
          captador_telefone?: string | null
          caucao_comprovante_url?: string | null
          caucao_quantidade?: number | null
          caucao_valor?: number | null
          cliente: string
          cliente_cpf?: string | null
          cliente_email?: string | null
          cliente_rg?: string | null
          cliente_telefone?: string | null
          codigo_contrato?: string | null
          comissao_percentual?: number | null
          comissao_tipo?: string | null
          comissao_valor?: number | null
          comprovante_agua_url?: string | null
          comprovante_luz_url?: string | null
          condominio_inclui?: string | null
          conjuge_cpf?: string | null
          conjuge_email?: string | null
          conjuge_proprietario?: string | null
          conjuge_telefone?: string | null
          contrato_anexo_url?: string | null
          contrato_url?: string | null
          corretor_comissao_percentual?: number | null
          corretor_comissao_valor?: number | null
          corretor_id?: string | null
          corretor_nome?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          data_proxima_correcao?: string | null
          data_vencimento_apolice?: string | null
          dia_vencimento_aluguel?: number | null
          fiador_cpf?: string | null
          fiador_email?: string | null
          fiador_endereco?: string | null
          fiador_estado_civil?: string | null
          fiador_matricula_url?: string | null
          fiador_nome?: string | null
          fiador_renda_url?: string | null
          fiador_telefone?: string | null
          fiador2_cpf?: string | null
          fiador2_email?: string | null
          fiador2_endereco?: string | null
          fiador2_estado_civil?: string | null
          fiador2_matricula_url?: string | null
          fiador2_nome?: string | null
          fiador2_renda_url?: string | null
          fiador2_telefone?: string | null
          id?: string
          imobiliaria_id: string
          imovel_id?: string | null
          imposto_percentual?: number | null
          imposto_tipo?: string | null
          imposto_valor?: number | null
          indice_correcao?: string | null
          inquilino?: string | null
          inquilino_cpf?: string | null
          inquilino_email?: string | null
          inquilino_rg?: string | null
          inquilino_telefone?: string | null
          inquilino2_cpf?: string | null
          inquilino2_email?: string | null
          inquilino2_nome?: string | null
          inquilino2_rg?: string | null
          inquilino2_telefone?: string | null
          inscricao_iptu?: string | null
          iptu_parcelado?: boolean | null
          matricula?: string | null
          numero_agua?: string | null
          numero_luz?: string | null
          numero_unidade?: string | null
          observacoes?: string | null
          parceiro_comissao_percentual?: number | null
          parceiro_comissao_valor?: number | null
          parceiro_nome?: string | null
          parceria_envolvidos?: string[] | null
          percentual_correcao?: number | null
          proprietario?: string | null
          proprietario_agencia?: string | null
          proprietario_banco?: string | null
          proprietario_conta?: string | null
          proprietario_cpf?: string | null
          proprietario_email?: string | null
          proprietario_id?: string | null
          proprietario_pix?: string | null
          proprietario_rg?: string | null
          proprietario_telefone?: string | null
          seguro_fianca_anexo_url?: string | null
          seguro_incendio_anexo_url?: string | null
          status?: string
          tem_parceria?: boolean | null
          tipo?: string
          tipo_garantia?: string | null
          titulo: string
          updated_at?: string
          valor?: number
          valor_condominio?: number | null
          valor_iptu?: number | null
          vistoria_anexo_url?: string | null
          vistoria_entrada?: boolean
          vistoria_video?: boolean
          vistoria_video_url?: string | null
        }
        Update: {
          aditivo_anexo_url?: string | null
          apolice_anexo_url?: string | null
          apolice_seguro?: boolean
          canal_origem?: string | null
          captador_comissao_percentual?: number | null
          captador_comissao_valor?: number | null
          captador_nome?: string | null
          captador_telefone?: string | null
          caucao_comprovante_url?: string | null
          caucao_quantidade?: number | null
          caucao_valor?: number | null
          cliente?: string
          cliente_cpf?: string | null
          cliente_email?: string | null
          cliente_rg?: string | null
          cliente_telefone?: string | null
          codigo_contrato?: string | null
          comissao_percentual?: number | null
          comissao_tipo?: string | null
          comissao_valor?: number | null
          comprovante_agua_url?: string | null
          comprovante_luz_url?: string | null
          condominio_inclui?: string | null
          conjuge_cpf?: string | null
          conjuge_email?: string | null
          conjuge_proprietario?: string | null
          conjuge_telefone?: string | null
          contrato_anexo_url?: string | null
          contrato_url?: string | null
          corretor_comissao_percentual?: number | null
          corretor_comissao_valor?: number | null
          corretor_id?: string | null
          corretor_nome?: string | null
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          data_proxima_correcao?: string | null
          data_vencimento_apolice?: string | null
          dia_vencimento_aluguel?: number | null
          fiador_cpf?: string | null
          fiador_email?: string | null
          fiador_endereco?: string | null
          fiador_estado_civil?: string | null
          fiador_matricula_url?: string | null
          fiador_nome?: string | null
          fiador_renda_url?: string | null
          fiador_telefone?: string | null
          fiador2_cpf?: string | null
          fiador2_email?: string | null
          fiador2_endereco?: string | null
          fiador2_estado_civil?: string | null
          fiador2_matricula_url?: string | null
          fiador2_nome?: string | null
          fiador2_renda_url?: string | null
          fiador2_telefone?: string | null
          id?: string
          imobiliaria_id?: string
          imovel_id?: string | null
          imposto_percentual?: number | null
          imposto_tipo?: string | null
          imposto_valor?: number | null
          indice_correcao?: string | null
          inquilino?: string | null
          inquilino_cpf?: string | null
          inquilino_email?: string | null
          inquilino_rg?: string | null
          inquilino_telefone?: string | null
          inquilino2_cpf?: string | null
          inquilino2_email?: string | null
          inquilino2_nome?: string | null
          inquilino2_rg?: string | null
          inquilino2_telefone?: string | null
          inscricao_iptu?: string | null
          iptu_parcelado?: boolean | null
          matricula?: string | null
          numero_agua?: string | null
          numero_luz?: string | null
          numero_unidade?: string | null
          observacoes?: string | null
          parceiro_comissao_percentual?: number | null
          parceiro_comissao_valor?: number | null
          parceiro_nome?: string | null
          parceria_envolvidos?: string[] | null
          percentual_correcao?: number | null
          proprietario?: string | null
          proprietario_agencia?: string | null
          proprietario_banco?: string | null
          proprietario_conta?: string | null
          proprietario_cpf?: string | null
          proprietario_email?: string | null
          proprietario_id?: string | null
          proprietario_pix?: string | null
          proprietario_rg?: string | null
          proprietario_telefone?: string | null
          seguro_fianca_anexo_url?: string | null
          seguro_incendio_anexo_url?: string | null
          status?: string
          tem_parceria?: boolean | null
          tipo?: string
          tipo_garantia?: string | null
          titulo?: string
          updated_at?: string
          valor?: number
          valor_condominio?: number | null
          valor_iptu?: number | null
          vistoria_anexo_url?: string | null
          vistoria_entrada?: boolean
          vistoria_video?: boolean
          vistoria_video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contratos_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "proprietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_atribuicao_regras: {
        Row: {
          ativo: boolean
          bairro: string | null
          cidade: string | null
          corretor_id: string
          created_at: string
          id: string
          imobiliaria_id: string
          peso: number
          prioridade: number
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cidade?: string | null
          corretor_id: string
          created_at?: string
          id?: string
          imobiliaria_id: string
          peso?: number
          prioridade?: number
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cidade?: string | null
          corretor_id?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string
          peso?: number
          prioridade?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_atribuicao_regras_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      corretor_permissoes: {
        Row: {
          ativo: boolean
          corretor_id: string
          id: string
          modulo: string
        }
        Insert: {
          ativo?: boolean
          corretor_id: string
          id?: string
          modulo: string
        }
        Update: {
          ativo?: boolean
          corretor_id?: string
          id?: string
          modulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "corretor_permissoes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      corretores: {
        Row: {
          created_at: string
          creci: string | null
          email: string | null
          id: string
          imobiliaria_id: string
          limite_leads: number
          nome: string
          status: string
          telefone: string | null
        }
        Insert: {
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          imobiliaria_id: string
          limite_leads?: number
          nome: string
          status?: string
          telefone?: string | null
        }
        Update: {
          created_at?: string
          creci?: string | null
          email?: string | null
          id?: string
          imobiliaria_id?: string
          limite_leads?: number
          nome?: string
          status?: string
          telefone?: string | null
        }
        Relationships: []
      }
      cron_execucoes_log: {
        Row: {
          created_at: string
          duration_ms: number | null
          finished_at: string | null
          id: string
          job_name: string
          message: string | null
          metadata: Json
          servidor: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          job_name: string
          message?: string | null
          metadata?: Json
          servidor?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          finished_at?: string | null
          id?: string
          job_name?: string
          message?: string | null
          metadata?: Json
          servidor?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      curadoria_configuracao: {
        Row: {
          aprovacao_obrigatoria: boolean
          ativo: boolean
          created_at: string
          filtros_globais: Json
          frequencia_horas: number
          id: string
          imobiliaria_id: string
          max_posts_por_dia: number
          modo_publicacao: string
          score_minimo: number
          updated_at: string
        }
        Insert: {
          aprovacao_obrigatoria?: boolean
          ativo?: boolean
          created_at?: string
          filtros_globais?: Json
          frequencia_horas?: number
          id?: string
          imobiliaria_id: string
          max_posts_por_dia?: number
          modo_publicacao?: string
          score_minimo?: number
          updated_at?: string
        }
        Update: {
          aprovacao_obrigatoria?: boolean
          ativo?: boolean
          created_at?: string
          filtros_globais?: Json
          frequencia_horas?: number
          id?: string
          imobiliaria_id?: string
          max_posts_por_dia?: number
          modo_publicacao?: string
          score_minimo?: number
          updated_at?: string
        }
        Relationships: []
      }
      curadoria_descobertas: {
        Row: {
          autor: string | null
          conteudo_seo_id: string | null
          created_at: string
          fonte_dominio: string | null
          fonte_nome: string | null
          id: string
          imagem_url: string | null
          imobiliaria_id: string
          motivo_descarte: string | null
          payload: Json
          publicado_em: string | null
          resumo: string | null
          score_viralidade: number
          sinais: Json
          status: string
          tema_id: string
          titulo: string
          updated_at: string
          url: string
          url_hash: string
        }
        Insert: {
          autor?: string | null
          conteudo_seo_id?: string | null
          created_at?: string
          fonte_dominio?: string | null
          fonte_nome?: string | null
          id?: string
          imagem_url?: string | null
          imobiliaria_id: string
          motivo_descarte?: string | null
          payload?: Json
          publicado_em?: string | null
          resumo?: string | null
          score_viralidade?: number
          sinais?: Json
          status?: string
          tema_id: string
          titulo: string
          updated_at?: string
          url: string
          url_hash: string
        }
        Update: {
          autor?: string | null
          conteudo_seo_id?: string | null
          created_at?: string
          fonte_dominio?: string | null
          fonte_nome?: string | null
          id?: string
          imagem_url?: string | null
          imobiliaria_id?: string
          motivo_descarte?: string | null
          payload?: Json
          publicado_em?: string | null
          resumo?: string | null
          score_viralidade?: number
          sinais?: Json
          status?: string
          tema_id?: string
          titulo?: string
          updated_at?: string
          url?: string
          url_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "curadoria_descobertas_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "curadoria_temas"
            referencedColumns: ["id"]
          },
        ]
      }
      curadoria_execucoes_log: {
        Row: {
          created_at: string
          descobertas_encontradas: number
          descobertas_novas: number
          detalhes: Json
          duracao_ms: number | null
          erro: string | null
          id: string
          imobiliaria_id: string
          posts_gerados: number
          status: string
          tema_id: string | null
          tipo: string
        }
        Insert: {
          created_at?: string
          descobertas_encontradas?: number
          descobertas_novas?: number
          detalhes?: Json
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          imobiliaria_id: string
          posts_gerados?: number
          status?: string
          tema_id?: string | null
          tipo?: string
        }
        Update: {
          created_at?: string
          descobertas_encontradas?: number
          descobertas_novas?: number
          detalhes?: Json
          duracao_ms?: number | null
          erro?: string | null
          id?: string
          imobiliaria_id?: string
          posts_gerados?: number
          status?: string
          tema_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "curadoria_execucoes_log_tema_id_fkey"
            columns: ["tema_id"]
            isOneToOne: false
            referencedRelation: "curadoria_temas"
            referencedColumns: ["id"]
          },
        ]
      }
      curadoria_temas: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          fontes_bloqueadas: string[]
          fontes_permitidas: string[]
          id: string
          idioma: string
          imobiliaria_id: string
          max_por_execucao: number
          nome: string
          palavras_chave: string[]
          periodo_busca: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          fontes_bloqueadas?: string[]
          fontes_permitidas?: string[]
          id?: string
          idioma?: string
          imobiliaria_id: string
          max_por_execucao?: number
          nome: string
          palavras_chave?: string[]
          periodo_busca?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          fontes_bloqueadas?: string[]
          fontes_permitidas?: string[]
          id?: string
          idioma?: string
          imobiliaria_id?: string
          max_por_execucao?: number
          nome?: string
          palavras_chave?: string[]
          periodo_busca?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deleted_records_backup: {
        Row: {
          deleted_at: string
          deleted_by: string | null
          id: string
          imobiliaria_id: string | null
          original_id: string | null
          owner_user_id: string | null
          restored_at: string | null
          restored_by: string | null
          row_data: Json
          source_table: string
        }
        Insert: {
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          imobiliaria_id?: string | null
          original_id?: string | null
          owner_user_id?: string | null
          restored_at?: string | null
          restored_by?: string | null
          row_data: Json
          source_table: string
        }
        Update: {
          deleted_at?: string
          deleted_by?: string | null
          id?: string
          imobiliaria_id?: string | null
          original_id?: string | null
          owner_user_id?: string | null
          restored_at?: string | null
          restored_by?: string | null
          row_data?: Json
          source_table?: string
        }
        Relationships: []
      }
      edge_function_requests: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          function_name: string
          http_status: number | null
          id: string
          metadata: Json
          request_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name: string
          http_status?: number | null
          id?: string
          metadata?: Json
          request_id: string
          status?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name?: string
          http_status?: number | null
          id?: string
          metadata?: Json
          request_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      error_notifications: {
        Row: {
          error_message: string | null
          id: string
          log_id: string
          notified_at: string | null
          status: string | null
        }
        Insert: {
          error_message?: string | null
          id?: string
          log_id: string
          notified_at?: string | null
          status?: string | null
        }
        Update: {
          error_message?: string | null
          id?: string
          log_id?: string
          notified_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "error_notifications_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "system_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      error_threshold_logs: {
        Row: {
          alert_type: string
          id: string
          last_alerted_at: string | null
          target_id: string
        }
        Insert: {
          alert_type: string
          id?: string
          last_alerted_at?: string | null
          target_id: string
        }
        Update: {
          alert_type?: string
          id?: string
          last_alerted_at?: string | null
          target_id?: string
        }
        Relationships: []
      }
      export_queue_items: {
        Row: {
          created_at: string | null
          data: Json
          export_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          export_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          export_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_queue_items_export_id_fkey"
            columns: ["export_id"]
            isOneToOne: false
            referencedRelation: "batch_exports"
            referencedColumns: ["id"]
          },
        ]
      }
      extraction_failure_alerts: {
        Row: {
          alert_type: string
          created_at: string
          failure_count: number
          failure_rate: number
          function_name: string
          id: string
          resolved_at: string | null
          resolved_by: string | null
          sample_errors: Json | null
          threshold: number
          total_count: number
          window_end: string
          window_start: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          failure_count: number
          failure_rate: number
          function_name?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sample_errors?: Json | null
          threshold: number
          total_count: number
          window_end: string
          window_start: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          failure_count?: number
          failure_rate?: number
          function_name?: string
          id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sample_errors?: Json | null
          threshold?: number
          total_count?: number
          window_end?: string
          window_start?: string
        }
        Relationships: []
      }
      extraction_logs: {
        Row: {
          created_at: string
          error_code: string | null
          error_message: string | null
          http_status: number | null
          id: string
          missing_fields: string[] | null
          portal: string | null
          response_time_ms: number | null
          retry_attempt: number | null
          source_url: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          missing_fields?: string[] | null
          portal?: string | null
          response_time_ms?: number | null
          retry_attempt?: number | null
          source_url: string
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          http_status?: number | null
          id?: string
          missing_fields?: string[] | null
          portal?: string | null
          response_time_ms?: number | null
          retry_attempt?: number | null
          source_url?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      filtro_ia_execucoes_log: {
        Row: {
          contagens: Json
          criado_em: string
          criterios: Json
          duracao_ms: number
          error_code: string | null
          filtros_aplicados: Json
          filtros_efetivos: Json
          id: string
          imobiliaria_id: string
          modelo: string | null
          modo_teste: boolean
          motivos_exclusao: Json
          provider: string | null
          run_id: string
          sucesso: boolean
          tempos: Json
          total_resultados: number
        }
        Insert: {
          contagens?: Json
          criado_em?: string
          criterios?: Json
          duracao_ms?: number
          error_code?: string | null
          filtros_aplicados?: Json
          filtros_efetivos?: Json
          id?: string
          imobiliaria_id: string
          modelo?: string | null
          modo_teste?: boolean
          motivos_exclusao?: Json
          provider?: string | null
          run_id: string
          sucesso?: boolean
          tempos?: Json
          total_resultados?: number
        }
        Update: {
          contagens?: Json
          criado_em?: string
          criterios?: Json
          duracao_ms?: number
          error_code?: string | null
          filtros_aplicados?: Json
          filtros_efetivos?: Json
          id?: string
          imobiliaria_id?: string
          modelo?: string | null
          modo_teste?: boolean
          motivos_exclusao?: Json
          provider?: string | null
          run_id?: string
          sucesso?: boolean
          tempos?: Json
          total_resultados?: number
        }
        Relationships: []
      }
      firecrawl_captacao_cache: {
        Row: {
          bairro: string | null
          cache_key: string
          cidade: string | null
          created_at: string
          expires_at: string
          hits: number
          id: string
          operacao: string | null
          payload: Json
          tipo_imovel: string | null
        }
        Insert: {
          bairro?: string | null
          cache_key: string
          cidade?: string | null
          created_at?: string
          expires_at?: string
          hits?: number
          id?: string
          operacao?: string | null
          payload: Json
          tipo_imovel?: string | null
        }
        Update: {
          bairro?: string | null
          cache_key?: string
          cidade?: string | null
          created_at?: string
          expires_at?: string
          hits?: number
          id?: string
          operacao?: string | null
          payload?: Json
          tipo_imovel?: string | null
        }
        Relationships: []
      }
      followups: {
        Row: {
          contrato_id: string | null
          created_at: string
          data_followup: string
          descricao: string | null
          id: string
          imobiliaria_id: string
          lead_id: string | null
          mensagem_whatsapp: string | null
          resultado: string | null
          status: string
          tipo: string
          updated_at: string
          whatsapp_enviado: boolean
          whatsapp_enviado_at: string | null
        }
        Insert: {
          contrato_id?: string | null
          created_at?: string
          data_followup: string
          descricao?: string | null
          id?: string
          imobiliaria_id: string
          lead_id?: string | null
          mensagem_whatsapp?: string | null
          resultado?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          whatsapp_enviado?: boolean
          whatsapp_enviado_at?: string | null
        }
        Update: {
          contrato_id?: string | null
          created_at?: string
          data_followup?: string
          descricao?: string | null
          id?: string
          imobiliaria_id?: string
          lead_id?: string | null
          mensagem_whatsapp?: string | null
          resultado?: string | null
          status?: string
          tipo?: string
          updated_at?: string
          whatsapp_enviado?: boolean
          whatsapp_enviado_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "followups_contrato_id_fkey"
            columns: ["contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "followups_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      imobiliaria_config: {
        Row: {
          auto_assign_ludmila_estagios: string[]
          auto_assign_ludmila_janela_horas: number | null
          blog_nichos: Json
          blog_topicos: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          creci: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          extraction_max_retries: number | null
          extraction_retry_delay_ms: number | null
          id: string
          lead_capture_publico: boolean
          lembretes_datas_antecedencias: number[]
          lembretes_datas_ativo: boolean
          logo_url: string | null
          nome_empresa: string
          nomes_excluidos_importacao: string[] | null
          pipeline_tema_default: string
          retention_firecrawl_cache_dias: number
          retention_lista_proprietarios_dias: number
          sem_contato_days: number
          sla_primeiro_contato_horas: number
          sla_recontato_dias: number
          sw_cleanup_disabled: boolean
          sw_cleanup_disabled_at: string | null
          sw_cleanup_disabled_by: string | null
          sw_cleanup_disabled_reason: string | null
          telefone: string | null
          updated_at: string
          user_id: string
          video_demo_url: string | null
        }
        Insert: {
          auto_assign_ludmila_estagios?: string[]
          auto_assign_ludmila_janela_horas?: number | null
          blog_nichos?: Json
          blog_topicos?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          extraction_max_retries?: number | null
          extraction_retry_delay_ms?: number | null
          id?: string
          lead_capture_publico?: boolean
          lembretes_datas_antecedencias?: number[]
          lembretes_datas_ativo?: boolean
          logo_url?: string | null
          nome_empresa?: string
          nomes_excluidos_importacao?: string[] | null
          pipeline_tema_default?: string
          retention_firecrawl_cache_dias?: number
          retention_lista_proprietarios_dias?: number
          sem_contato_days?: number
          sla_primeiro_contato_horas?: number
          sla_recontato_dias?: number
          sw_cleanup_disabled?: boolean
          sw_cleanup_disabled_at?: string | null
          sw_cleanup_disabled_by?: string | null
          sw_cleanup_disabled_reason?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
          video_demo_url?: string | null
        }
        Update: {
          auto_assign_ludmila_estagios?: string[]
          auto_assign_ludmila_janela_horas?: number | null
          blog_nichos?: Json
          blog_topicos?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          creci?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          extraction_max_retries?: number | null
          extraction_retry_delay_ms?: number | null
          id?: string
          lead_capture_publico?: boolean
          lembretes_datas_antecedencias?: number[]
          lembretes_datas_ativo?: boolean
          logo_url?: string | null
          nome_empresa?: string
          nomes_excluidos_importacao?: string[] | null
          pipeline_tema_default?: string
          retention_firecrawl_cache_dias?: number
          retention_lista_proprietarios_dias?: number
          sem_contato_days?: number
          sla_primeiro_contato_horas?: number
          sla_recontato_dias?: number
          sw_cleanup_disabled?: boolean
          sw_cleanup_disabled_at?: string | null
          sw_cleanup_disabled_by?: string | null
          sw_cleanup_disabled_reason?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
          video_demo_url?: string | null
        }
        Relationships: []
      }
      imoveis: {
        Row: {
          aceita_fgts: boolean
          aceita_financiamento: boolean
          aceita_permuta: boolean
          andar: string | null
          area: number
          bairro: string | null
          banheiros: number
          caracteristicas: string[]
          cep: string | null
          cidade: string | null
          comissao_percentual: number | null
          created_at: string
          descricao: string | null
          destaque: boolean
          documentos_iptu: string[] | null
          documentos_matricula: string[] | null
          documentos_outros: string[] | null
          endereco: string | null
          estado: string | null
          estado_conservacao: string | null
          exclusividade_fim: string | null
          exclusividade_inicio: string | null
          exclusivo: boolean
          foto_capa_index: number | null
          fotos: string[] | null
          id: string
          imobiliaria_id: string
          operacao: string
          portal_origem: string | null
          posicao_solar: string | null
          preco: number
          quartos: number
          status: string
          suites: number
          tem_escritura: boolean
          tipo: string
          titulo: string
          updated_at: string
          url_anuncio: string | null
          vagas: number
          valor_condominio: number
          valor_iptu: number
          videos: string[] | null
        }
        Insert: {
          aceita_fgts?: boolean
          aceita_financiamento?: boolean
          aceita_permuta?: boolean
          andar?: string | null
          area?: number
          bairro?: string | null
          banheiros?: number
          caracteristicas?: string[]
          cep?: string | null
          cidade?: string | null
          comissao_percentual?: number | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          documentos_iptu?: string[] | null
          documentos_matricula?: string[] | null
          documentos_outros?: string[] | null
          endereco?: string | null
          estado?: string | null
          estado_conservacao?: string | null
          exclusividade_fim?: string | null
          exclusividade_inicio?: string | null
          exclusivo?: boolean
          foto_capa_index?: number | null
          fotos?: string[] | null
          id?: string
          imobiliaria_id: string
          operacao?: string
          portal_origem?: string | null
          posicao_solar?: string | null
          preco?: number
          quartos?: number
          status?: string
          suites?: number
          tem_escritura?: boolean
          tipo?: string
          titulo: string
          updated_at?: string
          url_anuncio?: string | null
          vagas?: number
          valor_condominio?: number
          valor_iptu?: number
          videos?: string[] | null
        }
        Update: {
          aceita_fgts?: boolean
          aceita_financiamento?: boolean
          aceita_permuta?: boolean
          andar?: string | null
          area?: number
          bairro?: string | null
          banheiros?: number
          caracteristicas?: string[]
          cep?: string | null
          cidade?: string | null
          comissao_percentual?: number | null
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          documentos_iptu?: string[] | null
          documentos_matricula?: string[] | null
          documentos_outros?: string[] | null
          endereco?: string | null
          estado?: string | null
          estado_conservacao?: string | null
          exclusividade_fim?: string | null
          exclusividade_inicio?: string | null
          exclusivo?: boolean
          foto_capa_index?: number | null
          fotos?: string[] | null
          id?: string
          imobiliaria_id?: string
          operacao?: string
          portal_origem?: string | null
          posicao_solar?: string | null
          preco?: number
          quartos?: number
          status?: string
          suites?: number
          tem_escritura?: boolean
          tipo?: string
          titulo?: string
          updated_at?: string
          url_anuncio?: string | null
          vagas?: number
          valor_condominio?: number
          valor_iptu?: number
          videos?: string[] | null
        }
        Relationships: []
      }
      imoveis_mercado: {
        Row: {
          area: number | null
          bairro: string | null
          banheiros: number | null
          cidade: string | null
          created_at: string
          dados_raw: Json | null
          data_scraping: string | null
          dias_anuncio: number | null
          estado: string | null
          id: string
          imobiliaria_id: string
          operacao: string | null
          portal: string
          preco: number | null
          preco_m2: number | null
          q_score: number | null
          quartos: number | null
          tipo: string | null
          titulo: string
          updated_at: string
          url_anuncio: string | null
          vagas: number | null
        }
        Insert: {
          area?: number | null
          bairro?: string | null
          banheiros?: number | null
          cidade?: string | null
          created_at?: string
          dados_raw?: Json | null
          data_scraping?: string | null
          dias_anuncio?: number | null
          estado?: string | null
          id?: string
          imobiliaria_id: string
          operacao?: string | null
          portal: string
          preco?: number | null
          preco_m2?: number | null
          q_score?: number | null
          quartos?: number | null
          tipo?: string | null
          titulo: string
          updated_at?: string
          url_anuncio?: string | null
          vagas?: number | null
        }
        Update: {
          area?: number | null
          bairro?: string | null
          banheiros?: number | null
          cidade?: string | null
          created_at?: string
          dados_raw?: Json | null
          data_scraping?: string | null
          dias_anuncio?: number | null
          estado?: string | null
          id?: string
          imobiliaria_id?: string
          operacao?: string | null
          portal?: string
          preco?: number | null
          preco_m2?: number | null
          q_score?: number | null
          quartos?: number | null
          tipo?: string | null
          titulo?: string
          updated_at?: string
          url_anuncio?: string | null
          vagas?: number | null
        }
        Relationships: []
      }
      lead_atividades: {
        Row: {
          ator_nome: string | null
          ator_user_id: string | null
          created_at: string
          descricao: string | null
          id: string
          imobiliaria_id: string
          lead_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          ator_nome?: string | null
          ator_user_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          imobiliaria_id: string
          lead_id: string
          tipo?: string
          titulo: string
        }
        Update: {
          ator_nome?: string | null
          ator_user_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          imobiliaria_id?: string
          lead_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_atividades_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_cursor: {
        Row: {
          imobiliaria_id: string
          last_assigned_at: string | null
          last_corretor_id: string | null
          updated_at: string
        }
        Insert: {
          imobiliaria_id: string
          last_assigned_at?: string | null
          last_corretor_id?: string | null
          updated_at?: string
        }
        Update: {
          imobiliaria_id?: string
          last_assigned_at?: string | null
          last_corretor_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lead_distribution_queue: {
        Row: {
          ai_score: number
          assigned_at: string | null
          closed_at: string | null
          corretor_id: string | null
          created_at: string
          id: string
          imobiliaria_id: string
          payload: Json
          source: string
          source_ref: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_score?: number
          assigned_at?: string | null
          closed_at?: string | null
          corretor_id?: string | null
          created_at?: string
          id?: string
          imobiliaria_id: string
          payload?: Json
          source?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_score?: number
          assigned_at?: string | null
          closed_at?: string | null
          corretor_id?: string | null
          created_at?: string
          id?: string
          imobiliaria_id?: string
          payload?: Json
          source?: string
          source_ref?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_queue_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          amenidades_desejadas: string[]
          area_minima: number | null
          bairro_interesse: string | null
          bairros_interesse: string[]
          banheiros_minimo: number | null
          canal_origem: string | null
          corretor_id: string | null
          created_at: string
          created_by: string | null
          email: string | null
          estagio: string
          finalidade: string | null
          id: string
          imobiliaria_id: string
          interesse: string | null
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          posicao: number
          quartos_minimo: number | null
          suites_minimo: number | null
          telefone: string | null
          tipo_imovel_interesse: string | null
          tipo_operacao: string
          updated_at: string
          urgencia: string | null
          vagas_minimo: number | null
          valor: number
          valor_maximo: number | null
        }
        Insert: {
          amenidades_desejadas?: string[]
          area_minima?: number | null
          bairro_interesse?: string | null
          bairros_interesse?: string[]
          banheiros_minimo?: number | null
          canal_origem?: string | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estagio?: string
          finalidade?: string | null
          id?: string
          imobiliaria_id: string
          interesse?: string | null
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          posicao?: number
          quartos_minimo?: number | null
          suites_minimo?: number | null
          telefone?: string | null
          tipo_imovel_interesse?: string | null
          tipo_operacao?: string
          updated_at?: string
          urgencia?: string | null
          vagas_minimo?: number | null
          valor?: number
          valor_maximo?: number | null
        }
        Update: {
          amenidades_desejadas?: string[]
          area_minima?: number | null
          bairro_interesse?: string | null
          bairros_interesse?: string[]
          banheiros_minimo?: number | null
          canal_origem?: string | null
          corretor_id?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          estagio?: string
          finalidade?: string | null
          id?: string
          imobiliaria_id?: string
          interesse?: string | null
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          posicao?: number
          quartos_minimo?: number | null
          suites_minimo?: number | null
          telefone?: string | null
          tipo_imovel_interesse?: string | null
          tipo_operacao?: string
          updated_at?: string
          urgencia?: string | null
          vagas_minimo?: number | null
          valor?: number
          valor_maximo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
        ]
      }
      lgpd_consentimentos: {
        Row: {
          base_legal: string
          consentimento_ativo: boolean
          created_at: string
          finalidade: string
          id: string
          imobiliaria_id: string
          lead_id: string | null
          lista_proprietario_id: string | null
          observacoes: string | null
          origem_dado: string
          revogado_em: string | null
          revogado_por: string | null
          updated_at: string
        }
        Insert: {
          base_legal?: string
          consentimento_ativo?: boolean
          created_at?: string
          finalidade: string
          id?: string
          imobiliaria_id: string
          lead_id?: string | null
          lista_proprietario_id?: string | null
          observacoes?: string | null
          origem_dado?: string
          revogado_em?: string | null
          revogado_por?: string | null
          updated_at?: string
        }
        Update: {
          base_legal?: string
          consentimento_ativo?: boolean
          created_at?: string
          finalidade?: string
          id?: string
          imobiliaria_id?: string
          lead_id?: string | null
          lista_proprietario_id?: string | null
          observacoes?: string | null
          origem_dado?: string
          revogado_em?: string | null
          revogado_por?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lgpd_solicitacoes_titular: {
        Row: {
          base_legal_invocada: string | null
          canal_recebimento: string
          created_at: string
          descricao: string | null
          evidencia_identidade: Json | null
          id: string
          imobiliaria_id: string
          ip_origem: string | null
          lead_ids: string[] | null
          metadata: Json | null
          prazo_legal_em: string
          respondido_em: string | null
          respondido_por: string | null
          resposta: string | null
          status: string
          tipo: string
          titular_documento: string | null
          titular_email: string | null
          titular_nome: string | null
          titular_telefone: string | null
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          base_legal_invocada?: string | null
          canal_recebimento?: string
          created_at?: string
          descricao?: string | null
          evidencia_identidade?: Json | null
          id?: string
          imobiliaria_id: string
          ip_origem?: string | null
          lead_ids?: string[] | null
          metadata?: Json | null
          prazo_legal_em?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          status?: string
          tipo: string
          titular_documento?: string | null
          titular_email?: string | null
          titular_nome?: string | null
          titular_telefone?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          base_legal_invocada?: string | null
          canal_recebimento?: string
          created_at?: string
          descricao?: string | null
          evidencia_identidade?: Json | null
          id?: string
          imobiliaria_id?: string
          ip_origem?: string | null
          lead_ids?: string[] | null
          metadata?: Json | null
          prazo_legal_em?: string
          respondido_em?: string | null
          respondido_por?: string | null
          resposta?: string | null
          status?: string
          tipo?: string
          titular_documento?: string | null
          titular_email?: string | null
          titular_nome?: string | null
          titular_telefone?: string | null
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      lgpd_titular_verificacoes: {
        Row: {
          canal: string
          created_at: string
          destino: string
          expira_em: string
          id: string
          solicitacao_id: string | null
          tentativas: number
          token_hash: string
          verificado_em: string | null
        }
        Insert: {
          canal: string
          created_at?: string
          destino: string
          expira_em?: string
          id?: string
          solicitacao_id?: string | null
          tentativas?: number
          token_hash: string
          verificado_em?: string | null
        }
        Update: {
          canal?: string
          created_at?: string
          destino?: string
          expira_em?: string
          id?: string
          solicitacao_id?: string | null
          tentativas?: number
          token_hash?: string
          verificado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lgpd_titular_verificacoes_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "lgpd_solicitacoes_titular"
            referencedColumns: ["id"]
          },
        ]
      }
      lighthouse_audits: {
        Row: {
          accessibility_score: number | null
          best_practices_score: number | null
          cls: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          fcp_ms: number | null
          id: string
          lcp_ms: number | null
          path: string
          performance_score: number | null
          pwa_score: number | null
          raw: Json | null
          seo_score: number | null
          speed_index_ms: number | null
          status: string
          strategy: string
          tbt_ms: number | null
          tti_ms: number | null
          url: string
        }
        Insert: {
          accessibility_score?: number | null
          best_practices_score?: number | null
          cls?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          fcp_ms?: number | null
          id?: string
          lcp_ms?: number | null
          path: string
          performance_score?: number | null
          pwa_score?: number | null
          raw?: Json | null
          seo_score?: number | null
          speed_index_ms?: number | null
          status?: string
          strategy: string
          tbt_ms?: number | null
          tti_ms?: number | null
          url: string
        }
        Update: {
          accessibility_score?: number | null
          best_practices_score?: number | null
          cls?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          fcp_ms?: number | null
          id?: string
          lcp_ms?: number | null
          path?: string
          performance_score?: number | null
          pwa_score?: number | null
          raw?: Json | null
          seo_score?: number | null
          speed_index_ms?: number | null
          status?: string
          strategy?: string
          tbt_ms?: number | null
          tti_ms?: number | null
          url?: string
        }
        Relationships: []
      }
      lighthouse_config: {
        Row: {
          created_at: string
          id: string
          imobiliaria_id: string
          max_cls: number
          max_lcp_ms: number
          max_tbt_ms: number
          min_accessibility: number
          min_best_practices: number
          min_performance: number
          min_seo: number
          paths: string[]
          regression_delta: number
          strategies: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imobiliaria_id: string
          max_cls?: number
          max_lcp_ms?: number
          max_tbt_ms?: number
          min_accessibility?: number
          min_best_practices?: number
          min_performance?: number
          min_seo?: number
          paths?: string[]
          regression_delta?: number
          strategies?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imobiliaria_id?: string
          max_cls?: number
          max_lcp_ms?: number
          max_tbt_ms?: number
          min_accessibility?: number
          min_best_practices?: number
          min_performance?: number
          min_seo?: number
          paths?: string[]
          regression_delta?: number
          strategies?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      lighthouse_regression_alertas: {
        Row: {
          created_at: string
          current_audit_id: string | null
          current_score: number
          delta: number
          id: string
          metric: string
          path: string
          previous_audit_id: string | null
          previous_score: number
          resolved_at: string | null
          resolved_by: string | null
          status: string
          strategy: string
          threshold: number
        }
        Insert: {
          created_at?: string
          current_audit_id?: string | null
          current_score: number
          delta: number
          id?: string
          metric: string
          path: string
          previous_audit_id?: string | null
          previous_score: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          strategy: string
          threshold: number
        }
        Update: {
          created_at?: string
          current_audit_id?: string | null
          current_score?: number
          delta?: number
          id?: string
          metric?: string
          path?: string
          previous_audit_id?: string | null
          previous_score?: number
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          strategy?: string
          threshold?: number
        }
        Relationships: []
      }
      lista_proprietarios_captacao: {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          bairro: string | null
          cidade: string | null
          created_at: string
          dados_extraidos_raw: Json | null
          dedup_ignored_group_hash: string | null
          email: string | null
          fontes_resumo: Json
          historico_precos: Json
          id: string
          imobiliaria_id: string
          imovel_id_ref: string | null
          lgpd_status: string
          motivacao_calculada_em: string | null
          motivacao_nivel: string
          motivacao_score: number
          motivacao_sinais: Json
          motivo_revisao: string | null
          nome_proprietario: string
          observacoes: string | null
          operacao: string
          origem: string | null
          preco: number | null
          primeiro_visto_em: string | null
          q_score: number | null
          rejeitado_motivo: string | null
          republicacoes: number
          revisado_em: string | null
          revisado_por: string | null
          status_revisao: string
          telefone: string | null
          telefone_e164: string | null
          titulo_imovel: string | null
          ultimo_preco: number | null
          ultimo_visto_em: string | null
          updated_at: string
          url_anuncio: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          dados_extraidos_raw?: Json | null
          dedup_ignored_group_hash?: string | null
          email?: string | null
          fontes_resumo?: Json
          historico_precos?: Json
          id?: string
          imobiliaria_id: string
          imovel_id_ref?: string | null
          lgpd_status?: string
          motivacao_calculada_em?: string | null
          motivacao_nivel?: string
          motivacao_score?: number
          motivacao_sinais?: Json
          motivo_revisao?: string | null
          nome_proprietario?: string
          observacoes?: string | null
          operacao?: string
          origem?: string | null
          preco?: number | null
          primeiro_visto_em?: string | null
          q_score?: number | null
          rejeitado_motivo?: string | null
          republicacoes?: number
          revisado_em?: string | null
          revisado_por?: string | null
          status_revisao?: string
          telefone?: string | null
          telefone_e164?: string | null
          titulo_imovel?: string | null
          ultimo_preco?: number | null
          ultimo_visto_em?: string | null
          updated_at?: string
          url_anuncio?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          dados_extraidos_raw?: Json | null
          dedup_ignored_group_hash?: string | null
          email?: string | null
          fontes_resumo?: Json
          historico_precos?: Json
          id?: string
          imobiliaria_id?: string
          imovel_id_ref?: string | null
          lgpd_status?: string
          motivacao_calculada_em?: string | null
          motivacao_nivel?: string
          motivacao_score?: number
          motivacao_sinais?: Json
          motivo_revisao?: string | null
          nome_proprietario?: string
          observacoes?: string | null
          operacao?: string
          origem?: string | null
          preco?: number | null
          primeiro_visto_em?: string | null
          q_score?: number | null
          rejeitado_motivo?: string | null
          republicacoes?: number
          revisado_em?: string | null
          revisado_por?: string | null
          status_revisao?: string
          telefone?: string | null
          telefone_e164?: string | null
          titulo_imovel?: string | null
          ultimo_preco?: number | null
          ultimo_visto_em?: string | null
          updated_at?: string
          url_anuncio?: string | null
        }
        Relationships: []
      }
      master_autorizacoes: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          master_id: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          master_id: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          master_id?: string
          user_id?: string
        }
        Relationships: []
      }
      matching_fallback_log: {
        Row: {
          action: string
          ads_count: number
          bairro: string | null
          cidade: string | null
          created_at: string
          duracao_ms: number | null
          fallback_used: boolean
          firecrawl_error: string | null
          id: string
          imobiliaria_id: string
          match_type: string
          nome_predio: string | null
          operacao: string | null
          suggestions: Json
          suggestions_count: number
          tipo_imovel: string | null
          user_id: string
        }
        Insert: {
          action?: string
          ads_count?: number
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          duracao_ms?: number | null
          fallback_used?: boolean
          firecrawl_error?: string | null
          id?: string
          imobiliaria_id: string
          match_type: string
          nome_predio?: string | null
          operacao?: string | null
          suggestions?: Json
          suggestions_count?: number
          tipo_imovel?: string | null
          user_id: string
        }
        Update: {
          action?: string
          ads_count?: number
          bairro?: string | null
          cidade?: string | null
          created_at?: string
          duracao_ms?: number | null
          fallback_used?: boolean
          firecrawl_error?: string | null
          id?: string
          imobiliaria_id?: string
          match_type?: string
          nome_predio?: string | null
          operacao?: string | null
          suggestions?: Json
          suggestions_count?: number
          tipo_imovel?: string | null
          user_id?: string
        }
        Relationships: []
      }
      mensagem_templates: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          imobiliaria_id: string
          mensagem: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          imobiliaria_id: string
          mensagem: string
          tipo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          imobiliaria_id?: string
          mensagem?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      mensagens_whatsapp: {
        Row: {
          cliente_id: string | null
          contexto: string | null
          corretor_id: string | null
          created_at: string
          direcao: string
          id: string
          imobiliaria_id: string
          lead_id: string | null
          mensagem: string
          metadata: Json | null
          nome_contato: string
          proprietario_id: string | null
          telefone_destino: string
        }
        Insert: {
          cliente_id?: string | null
          contexto?: string | null
          corretor_id?: string | null
          created_at?: string
          direcao?: string
          id?: string
          imobiliaria_id: string
          lead_id?: string | null
          mensagem: string
          metadata?: Json | null
          nome_contato?: string
          proprietario_id?: string | null
          telefone_destino: string
        }
        Update: {
          cliente_id?: string | null
          contexto?: string | null
          corretor_id?: string | null
          created_at?: string
          direcao?: string
          id?: string
          imobiliaria_id?: string
          lead_id?: string | null
          mensagem?: string
          metadata?: Json | null
          nome_contato?: string
          proprietario_id?: string | null
          telefone_destino?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_whatsapp_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes_relacionamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_whatsapp_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_whatsapp_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_whatsapp_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "proprietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      metas_dashboard: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          imobiliaria_id: string
          meta_valor: number
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          imobiliaria_id: string
          meta_valor?: number
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          imobiliaria_id?: string
          meta_valor?: number
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      modulo_config: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          imobiliaria_id: string
          modulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          imobiliaria_id: string
          modulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          imobiliaria_id?: string
          modulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      monitoramento_capturas: {
        Row: {
          bairro: string | null
          captado_em: string
          cidade: string | null
          created_at: string
          external_id: string
          fonte_id: string
          id: string
          imobiliaria_id: string
          media_urls: string[] | null
          motivo: string | null
          nome_contato: string | null
          operacao: string | null
          payload_raw: Json
          preco: number | null
          processado_em: string | null
          radarzap_lead_id: string | null
          status: string
          telefone: string | null
          texto: string | null
          tipo_fonte: string
          tipo_imovel: string | null
          titulo: string | null
          uf: string | null
          url_origem: string | null
        }
        Insert: {
          bairro?: string | null
          captado_em?: string
          cidade?: string | null
          created_at?: string
          external_id: string
          fonte_id: string
          id?: string
          imobiliaria_id: string
          media_urls?: string[] | null
          motivo?: string | null
          nome_contato?: string | null
          operacao?: string | null
          payload_raw?: Json
          preco?: number | null
          processado_em?: string | null
          radarzap_lead_id?: string | null
          status?: string
          telefone?: string | null
          texto?: string | null
          tipo_fonte: string
          tipo_imovel?: string | null
          titulo?: string | null
          uf?: string | null
          url_origem?: string | null
        }
        Update: {
          bairro?: string | null
          captado_em?: string
          cidade?: string | null
          created_at?: string
          external_id?: string
          fonte_id?: string
          id?: string
          imobiliaria_id?: string
          media_urls?: string[] | null
          motivo?: string | null
          nome_contato?: string | null
          operacao?: string | null
          payload_raw?: Json
          preco?: number | null
          processado_em?: string | null
          radarzap_lead_id?: string | null
          status?: string
          telefone?: string | null
          texto?: string | null
          tipo_fonte?: string
          tipo_imovel?: string | null
          titulo?: string | null
          uf?: string | null
          url_origem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "monitoramento_capturas_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "monitoramento_fontes"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramento_execucoes_log: {
        Row: {
          detalhes: Json | null
          duracao_ms: number | null
          erro: string | null
          finalizado_em: string | null
          fonte_id: string | null
          id: string
          imobiliaria_id: string | null
          iniciado_em: string
          itens_capturados: number
          itens_descartados: number
          itens_duplicados: number
          itens_novos: number
          status: string
          tipo_fonte: string
        }
        Insert: {
          detalhes?: Json | null
          duracao_ms?: number | null
          erro?: string | null
          finalizado_em?: string | null
          fonte_id?: string | null
          id?: string
          imobiliaria_id?: string | null
          iniciado_em?: string
          itens_capturados?: number
          itens_descartados?: number
          itens_duplicados?: number
          itens_novos?: number
          status?: string
          tipo_fonte: string
        }
        Update: {
          detalhes?: Json | null
          duracao_ms?: number | null
          erro?: string | null
          finalizado_em?: string | null
          fonte_id?: string | null
          id?: string
          imobiliaria_id?: string | null
          iniciado_em?: string
          itens_capturados?: number
          itens_descartados?: number
          itens_duplicados?: number
          itens_novos?: number
          status?: string
          tipo_fonte?: string
        }
        Relationships: [
          {
            foreignKeyName: "monitoramento_execucoes_log_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "monitoramento_fontes"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoramento_fontes: {
        Row: {
          ativo: boolean
          bairros_alvo: string[] | null
          base_legal: string
          cidades_alvo: string[] | null
          config: Json
          created_at: string
          descricao: string | null
          fonte_url_publica: string | null
          id: string
          imobiliaria_id: string
          nome: string
          operacao_alvo: string[] | null
          tipo: string
          total_capturas: number
          ultima_captura_em: string | null
          ultima_execucao_em: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          bairros_alvo?: string[] | null
          base_legal?: string
          cidades_alvo?: string[] | null
          config?: Json
          created_at?: string
          descricao?: string | null
          fonte_url_publica?: string | null
          id?: string
          imobiliaria_id: string
          nome: string
          operacao_alvo?: string[] | null
          tipo: string
          total_capturas?: number
          ultima_captura_em?: string | null
          ultima_execucao_em?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          bairros_alvo?: string[] | null
          base_legal?: string
          cidades_alvo?: string[] | null
          config?: Json
          created_at?: string
          descricao?: string | null
          fonte_url_publica?: string | null
          id?: string
          imobiliaria_id?: string
          nome?: string
          operacao_alvo?: string[] | null
          tipo?: string
          total_capturas?: number
          ultima_captura_em?: string | null
          ultima_execucao_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      motivacao_config: {
        Row: {
          bonus_fsbo: number
          bonus_queda_tier1: number
          bonus_queda_tier2: number
          bonus_republicacao: number
          bonus_tempo_tier1: number
          bonus_tempo_tier2: number
          bonus_tempo_tier3: number
          created_at: string
          dias_tier1: number
          dias_tier2: number
          dias_tier3: number
          imobiliaria_id: string
          nivel_fervendo_min: number
          nivel_morno_min: number
          nivel_quente_min: number
          queda_tier1: number
          queda_tier2: number
          updated_at: string
        }
        Insert: {
          bonus_fsbo?: number
          bonus_queda_tier1?: number
          bonus_queda_tier2?: number
          bonus_republicacao?: number
          bonus_tempo_tier1?: number
          bonus_tempo_tier2?: number
          bonus_tempo_tier3?: number
          created_at?: string
          dias_tier1?: number
          dias_tier2?: number
          dias_tier3?: number
          imobiliaria_id: string
          nivel_fervendo_min?: number
          nivel_morno_min?: number
          nivel_quente_min?: number
          queda_tier1?: number
          queda_tier2?: number
          updated_at?: string
        }
        Update: {
          bonus_fsbo?: number
          bonus_queda_tier1?: number
          bonus_queda_tier2?: number
          bonus_republicacao?: number
          bonus_tempo_tier1?: number
          bonus_tempo_tier2?: number
          bonus_tempo_tier3?: number
          created_at?: string
          dias_tier1?: number
          dias_tier2?: number
          dias_tier3?: number
          imobiliaria_id?: string
          nivel_fervendo_min?: number
          nivel_morno_min?: number
          nivel_quente_min?: number
          queda_tier1?: number
          queda_tier2?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          description: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      nutricao_envios: {
        Row: {
          canal: string
          created_at: string
          destino: string | null
          enviado_em: string | null
          erro: string | null
          etapa_id: string | null
          id: string
          imobiliaria_id: string
          inscricao_id: string
          lead_id: string | null
          mensagem: string
          status: string
          titulo: string | null
          updated_at: string
          variante: string | null
        }
        Insert: {
          canal?: string
          created_at?: string
          destino?: string | null
          enviado_em?: string | null
          erro?: string | null
          etapa_id?: string | null
          id?: string
          imobiliaria_id: string
          inscricao_id: string
          lead_id?: string | null
          mensagem: string
          status?: string
          titulo?: string | null
          updated_at?: string
          variante?: string | null
        }
        Update: {
          canal?: string
          created_at?: string
          destino?: string | null
          enviado_em?: string | null
          erro?: string | null
          etapa_id?: string | null
          id?: string
          imobiliaria_id?: string
          inscricao_id?: string
          lead_id?: string | null
          mensagem?: string
          status?: string
          titulo?: string | null
          updated_at?: string
          variante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutricao_envios_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "nutricao_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutricao_envios_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "nutricao_inscricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutricao_etapas: {
        Row: {
          ab_ativo: boolean
          ab_auto_escolher: boolean
          ab_decidido_em: string | null
          ab_mensagem_b: string | null
          ab_min_envios: number
          ab_split: number
          ab_titulo_b: string | null
          ab_vencedor: string | null
          ativo: boolean
          canal: string
          created_at: string
          dias_apos: number
          fluxo_id: string
          id: string
          imobiliaria_id: string
          mensagem: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          ab_ativo?: boolean
          ab_auto_escolher?: boolean
          ab_decidido_em?: string | null
          ab_mensagem_b?: string | null
          ab_min_envios?: number
          ab_split?: number
          ab_titulo_b?: string | null
          ab_vencedor?: string | null
          ativo?: boolean
          canal?: string
          created_at?: string
          dias_apos?: number
          fluxo_id: string
          id?: string
          imobiliaria_id: string
          mensagem: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          ab_ativo?: boolean
          ab_auto_escolher?: boolean
          ab_decidido_em?: string | null
          ab_mensagem_b?: string | null
          ab_min_envios?: number
          ab_split?: number
          ab_titulo_b?: string | null
          ab_vencedor?: string | null
          ativo?: boolean
          canal?: string
          created_at?: string
          dias_apos?: number
          fluxo_id?: string
          id?: string
          imobiliaria_id?: string
          mensagem?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutricao_etapas_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "nutricao_fluxos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutricao_eventos: {
        Row: {
          canal: string | null
          created_at: string
          envio_id: string | null
          etapa_id: string | null
          fluxo_id: string
          id: string
          imobiliaria_id: string
          inscricao_id: string | null
          lead_id: string | null
          observacao: string | null
          ocorrido_em: string
          tipo: string
          updated_at: string
          valor: number | null
          variante: string | null
        }
        Insert: {
          canal?: string | null
          created_at?: string
          envio_id?: string | null
          etapa_id?: string | null
          fluxo_id: string
          id?: string
          imobiliaria_id: string
          inscricao_id?: string | null
          lead_id?: string | null
          observacao?: string | null
          ocorrido_em?: string
          tipo: string
          updated_at?: string
          valor?: number | null
          variante?: string | null
        }
        Update: {
          canal?: string | null
          created_at?: string
          envio_id?: string | null
          etapa_id?: string | null
          fluxo_id?: string
          id?: string
          imobiliaria_id?: string
          inscricao_id?: string | null
          lead_id?: string | null
          observacao?: string | null
          ocorrido_em?: string
          tipo?: string
          updated_at?: string
          valor?: number | null
          variante?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "nutricao_eventos_envio_id_fkey"
            columns: ["envio_id"]
            isOneToOne: false
            referencedRelation: "nutricao_envios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutricao_eventos_etapa_id_fkey"
            columns: ["etapa_id"]
            isOneToOne: false
            referencedRelation: "nutricao_etapas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutricao_eventos_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "nutricao_fluxos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nutricao_eventos_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "nutricao_inscricoes"
            referencedColumns: ["id"]
          },
        ]
      }
      nutricao_fluxos: {
        Row: {
          ativo: boolean
          canal: string
          created_at: string
          descricao: string | null
          dias_inatividade: number
          encerrar_ao_responder: boolean
          id: string
          imobiliaria_id: string
          nome: string
          publico_alvo: string
          segmento_estagios: string[]
          segmento_motivos_perda: string[]
          segmento_perfis: string[]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal?: string
          created_at?: string
          descricao?: string | null
          dias_inatividade?: number
          encerrar_ao_responder?: boolean
          id?: string
          imobiliaria_id: string
          nome: string
          publico_alvo?: string
          segmento_estagios?: string[]
          segmento_motivos_perda?: string[]
          segmento_perfis?: string[]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: string
          created_at?: string
          descricao?: string | null
          dias_inatividade?: number
          encerrar_ao_responder?: boolean
          id?: string
          imobiliaria_id?: string
          nome?: string
          publico_alvo?: string
          segmento_estagios?: string[]
          segmento_motivos_perda?: string[]
          segmento_perfis?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      nutricao_inscricoes: {
        Row: {
          cliente_id: string | null
          created_at: string
          email: string | null
          etapa_atual: number
          fluxo_id: string
          id: string
          imobiliaria_id: string
          lead_id: string | null
          motivo_encerramento: string | null
          nome: string | null
          proxima_execucao: string
          status: string
          telefone: string | null
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          email?: string | null
          etapa_atual?: number
          fluxo_id: string
          id?: string
          imobiliaria_id: string
          lead_id?: string | null
          motivo_encerramento?: string | null
          nome?: string | null
          proxima_execucao?: string
          status?: string
          telefone?: string | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          email?: string | null
          etapa_atual?: number
          fluxo_id?: string
          id?: string
          imobiliaria_id?: string
          lead_id?: string | null
          motivo_encerramento?: string | null
          nome?: string | null
          proxima_execucao?: string
          status?: string
          telefone?: string | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutricao_inscricoes_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "nutricao_fluxos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutricao_metas_alertas: {
        Row: {
          created_at: string
          envios: number | null
          fluxo_id: string | null
          fluxo_nome: string | null
          id: string
          imobiliaria_id: string
          janela_dias: number | null
          mensagem: string
          meta: number | null
          metrica: string | null
          resolvido: boolean
          resolvido_em: string | null
          severidade: string
          tipo: string
          valor: number | null
        }
        Insert: {
          created_at?: string
          envios?: number | null
          fluxo_id?: string | null
          fluxo_nome?: string | null
          id?: string
          imobiliaria_id: string
          janela_dias?: number | null
          mensagem: string
          meta?: number | null
          metrica?: string | null
          resolvido?: boolean
          resolvido_em?: string | null
          severidade?: string
          tipo: string
          valor?: number | null
        }
        Update: {
          created_at?: string
          envios?: number | null
          fluxo_id?: string | null
          fluxo_nome?: string | null
          id?: string
          imobiliaria_id?: string
          janela_dias?: number | null
          mensagem?: string
          meta?: number | null
          metrica?: string | null
          resolvido?: boolean
          resolvido_em?: string | null
          severidade?: string
          tipo?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "nutricao_metas_alertas_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "nutricao_fluxos"
            referencedColumns: ["id"]
          },
        ]
      }
      nutricao_metas_config: {
        Row: {
          alertar_zero_agendamento: boolean
          alertar_zero_resposta: boolean
          ativo: boolean
          created_at: string
          fluxo_id: string | null
          frequencia_horas: number
          id: string
          imobiliaria_id: string
          janela_dias: number
          meta_abertura: number
          meta_agendamento: number
          meta_fechamento: number
          meta_resposta: number
          min_envios: number
          notificar_app: boolean
          updated_at: string
        }
        Insert: {
          alertar_zero_agendamento?: boolean
          alertar_zero_resposta?: boolean
          ativo?: boolean
          created_at?: string
          fluxo_id?: string | null
          frequencia_horas?: number
          id?: string
          imobiliaria_id: string
          janela_dias?: number
          meta_abertura?: number
          meta_agendamento?: number
          meta_fechamento?: number
          meta_resposta?: number
          min_envios?: number
          notificar_app?: boolean
          updated_at?: string
        }
        Update: {
          alertar_zero_agendamento?: boolean
          alertar_zero_resposta?: boolean
          ativo?: boolean
          created_at?: string
          fluxo_id?: string | null
          frequencia_horas?: number
          id?: string
          imobiliaria_id?: string
          janela_dias?: number
          meta_abertura?: number
          meta_agendamento?: number
          meta_fechamento?: number
          meta_resposta?: number
          min_envios?: number
          notificar_app?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "nutricao_metas_config_fluxo_id_fkey"
            columns: ["fluxo_id"]
            isOneToOne: false
            referencedRelation: "nutricao_fluxos"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_extraction_cache: {
        Row: {
          block_reason: string | null
          blocked: boolean
          created_at: string
          expires_at: string
          fotos: Json
          hits: number
          strategy_stats: Json | null
          total_candidates: number
          updated_at: string
          url: string
          url_hash: string
        }
        Insert: {
          block_reason?: string | null
          blocked?: boolean
          created_at?: string
          expires_at?: string
          fotos?: Json
          hits?: number
          strategy_stats?: Json | null
          total_candidates?: number
          updated_at?: string
          url: string
          url_hash: string
        }
        Update: {
          block_reason?: string | null
          blocked?: boolean
          created_at?: string
          expires_at?: string
          fotos?: Json
          hits?: number
          strategy_stats?: Json | null
          total_candidates?: number
          updated_at?: string
          url?: string
          url_hash?: string
        }
        Relationships: []
      }
      photo_extraction_queue: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          imovel_id: string | null
          last_block_reason: string | null
          last_error: string | null
          last_error_code: string | null
          max_attempts: number
          next_run_at: string
          origin: string
          portal: string | null
          priority: number
          result: Json | null
          source_url: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          imovel_id?: string | null
          last_block_reason?: string | null
          last_error?: string | null
          last_error_code?: string | null
          max_attempts?: number
          next_run_at?: string
          origin?: string
          portal?: string | null
          priority?: number
          result?: Json | null
          source_url: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          imovel_id?: string | null
          last_block_reason?: string | null
          last_error?: string | null
          last_error_code?: string | null
          max_attempts?: number
          next_run_at?: string
          origin?: string
          portal?: string | null
          priority?: number
          result?: Json | null
          source_url?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pipeline_estagios: {
        Row: {
          ativo: boolean
          color: string
          created_at: string
          id: string
          imobiliaria_id: string
          is_sistema: boolean
          ordem: number
          sistema_tipo: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          color?: string
          created_at?: string
          id?: string
          imobiliaria_id: string
          is_sistema?: boolean
          ordem?: number
          sistema_tipo?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          color?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string
          is_sistema?: boolean
          ordem?: number
          sistema_tipo?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      post_deploy_audit_actions: {
        Row: {
          applied: boolean
          applied_at: string | null
          applied_by: string | null
          auto_fixable: boolean
          category: string
          created_at: string
          current_value: number | null
          delta: number | null
          id: string
          metric: string
          notes: string | null
          path: string
          previous_value: number | null
          probable_cause: string
          recommendation: string
          run_id: string
          severity: string
          strategy: string
          threshold: number | null
        }
        Insert: {
          applied?: boolean
          applied_at?: string | null
          applied_by?: string | null
          auto_fixable?: boolean
          category: string
          created_at?: string
          current_value?: number | null
          delta?: number | null
          id?: string
          metric: string
          notes?: string | null
          path: string
          previous_value?: number | null
          probable_cause: string
          recommendation: string
          run_id: string
          severity?: string
          strategy: string
          threshold?: number | null
        }
        Update: {
          applied?: boolean
          applied_at?: string | null
          applied_by?: string | null
          auto_fixable?: boolean
          category?: string
          created_at?: string
          current_value?: number | null
          delta?: number | null
          id?: string
          metric?: string
          notes?: string | null
          path?: string
          previous_value?: number | null
          probable_cause?: string
          recommendation?: string
          run_id?: string
          severity?: string
          strategy?: string
          threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_deploy_audit_actions_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "post_deploy_audit_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      post_deploy_audit_runs: {
        Row: {
          audit_ids: string[]
          avg_cls: number | null
          avg_lcp_ms: number | null
          avg_performance: number | null
          avg_seo: number | null
          avg_tbt_ms: number | null
          completed_at: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          ok_routes: number
          paths: string[]
          regressions_count: number
          release_tag: string | null
          status: string
          strategies: string[]
          summary: Json | null
          total_routes: number
          trigger_source: string
          triggered_by: string | null
        }
        Insert: {
          audit_ids?: string[]
          avg_cls?: number | null
          avg_lcp_ms?: number | null
          avg_performance?: number | null
          avg_seo?: number | null
          avg_tbt_ms?: number | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          ok_routes?: number
          paths: string[]
          regressions_count?: number
          release_tag?: string | null
          status?: string
          strategies?: string[]
          summary?: Json | null
          total_routes?: number
          trigger_source?: string
          triggered_by?: string | null
        }
        Update: {
          audit_ids?: string[]
          avg_cls?: number | null
          avg_lcp_ms?: number | null
          avg_performance?: number | null
          avg_seo?: number | null
          avg_tbt_ms?: number | null
          completed_at?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          ok_routes?: number
          paths?: string[]
          regressions_count?: number
          release_tag?: string | null
          status?: string
          strategies?: string[]
          summary?: Json | null
          total_routes?: number
          trigger_source?: string
          triggered_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          approved: boolean
          created_at: string
          customer_id: string | null
          email: string | null
          id: string
          is_master: boolean
          nome: string
          plano: string
          plano_solicitado: string | null
          plano_solicitado_em: string | null
          signup_ip: string | null
          trial_start: string | null
        }
        Insert: {
          approved?: boolean
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id: string
          is_master?: boolean
          nome?: string
          plano?: string
          plano_solicitado?: string | null
          plano_solicitado_em?: string | null
          signup_ip?: string | null
          trial_start?: string | null
        }
        Update: {
          approved?: boolean
          created_at?: string
          customer_id?: string | null
          email?: string | null
          id?: string
          is_master?: boolean
          nome?: string
          plano?: string
          plano_solicitado?: string | null
          plano_solicitado_em?: string | null
          signup_ip?: string | null
          trial_start?: string | null
        }
        Relationships: []
      }
      propostas: {
        Row: {
          cliente_email: string | null
          cliente_nome: string
          cliente_telefone: string | null
          condicoes_especiais: string | null
          created_at: string
          forma_pagamento: string | null
          id: string
          imobiliaria_id: string
          imovel_id: string | null
          lead_id: string | null
          numero_proposta: number
          observacoes: string | null
          prazo_contrato: string | null
          status: string
          updated_at: string
          valor: number
        }
        Insert: {
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          condicoes_especiais?: string | null
          created_at?: string
          forma_pagamento?: string | null
          id?: string
          imobiliaria_id: string
          imovel_id?: string | null
          lead_id?: string | null
          numero_proposta?: number
          observacoes?: string | null
          prazo_contrato?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          condicoes_especiais?: string | null
          created_at?: string
          forma_pagamento?: string | null
          id?: string
          imobiliaria_id?: string
          imovel_id?: string | null
          lead_id?: string | null
          numero_proposta?: number
          observacoes?: string | null
          prazo_contrato?: string | null
          status?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "propostas_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "propostas_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      proprietario_familiares: {
        Row: {
          created_at: string
          data_nascimento: string | null
          id: string
          imobiliaria_id: string
          nome: string
          proprietario_id: string
          relacao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          imobiliaria_id: string
          nome: string
          proprietario_id: string
          relacao?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          imobiliaria_id?: string
          nome?: string
          proprietario_id?: string
          relacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "proprietario_familiares_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "proprietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      proprietario_lembretes_log: {
        Row: {
          ano_ocorrencia: number
          antecedencia_dias: number
          data_referencia: string
          familiar_id: string | null
          id: string
          imobiliaria_id: string
          notification_id: string | null
          proprietario_id: string
          sent_at: string
          tipo: string
        }
        Insert: {
          ano_ocorrencia: number
          antecedencia_dias: number
          data_referencia: string
          familiar_id?: string | null
          id?: string
          imobiliaria_id: string
          notification_id?: string | null
          proprietario_id: string
          sent_at?: string
          tipo: string
        }
        Update: {
          ano_ocorrencia?: number
          antecedencia_dias?: number
          data_referencia?: string
          familiar_id?: string | null
          id?: string
          imobiliaria_id?: string
          notification_id?: string | null
          proprietario_id?: string
          sent_at?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "proprietario_lembretes_log_familiar_id_fkey"
            columns: ["familiar_id"]
            isOneToOne: false
            referencedRelation: "proprietario_familiares"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proprietario_lembretes_log_proprietario_id_fkey"
            columns: ["proprietario_id"]
            isOneToOne: false
            referencedRelation: "proprietarios"
            referencedColumns: ["id"]
          },
        ]
      }
      proprietarios: {
        Row: {
          agencia: string | null
          averbacao: boolean | null
          banco: string | null
          canal_origem: string | null
          cep: string | null
          certidao_onus_url: string | null
          cidade: string | null
          comissao_acordada: number | null
          conjuge_cpf: string | null
          conjuge_data_nascimento: string | null
          conjuge_nome: string | null
          conta: string | null
          contrato_administracao: boolean | null
          cpf_cnpj: string | null
          created_at: string
          dados_imovel_area: number | null
          dados_imovel_endereco: string | null
          dados_imovel_tipo: string | null
          data_casamento: string | null
          data_compra_imovel: string | null
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          estado_civil: string | null
          exclusividade: boolean | null
          exclusividade_contrato_url: string | null
          exclusividade_fim: string | null
          exclusividade_inicio: string | null
          id: string
          imobiliaria_id: string
          inscricao_iptu: string | null
          matricula: string | null
          nome: string
          observacoes: string | null
          parcela_atraso_condominio: boolean | null
          parcela_atraso_financiamento: boolean | null
          parcela_atraso_iptu: boolean | null
          pix: string | null
          quitado: boolean | null
          saldo_devedor: boolean | null
          telefone: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          averbacao?: boolean | null
          banco?: string | null
          canal_origem?: string | null
          cep?: string | null
          certidao_onus_url?: string | null
          cidade?: string | null
          comissao_acordada?: number | null
          conjuge_cpf?: string | null
          conjuge_data_nascimento?: string | null
          conjuge_nome?: string | null
          conta?: string | null
          contrato_administracao?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string
          dados_imovel_area?: number | null
          dados_imovel_endereco?: string | null
          dados_imovel_tipo?: string | null
          data_casamento?: string | null
          data_compra_imovel?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          exclusividade?: boolean | null
          exclusividade_contrato_url?: string | null
          exclusividade_fim?: string | null
          exclusividade_inicio?: string | null
          id?: string
          imobiliaria_id: string
          inscricao_iptu?: string | null
          matricula?: string | null
          nome: string
          observacoes?: string | null
          parcela_atraso_condominio?: boolean | null
          parcela_atraso_financiamento?: boolean | null
          parcela_atraso_iptu?: boolean | null
          pix?: string | null
          quitado?: boolean | null
          saldo_devedor?: boolean | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          averbacao?: boolean | null
          banco?: string | null
          canal_origem?: string | null
          cep?: string | null
          certidao_onus_url?: string | null
          cidade?: string | null
          comissao_acordada?: number | null
          conjuge_cpf?: string | null
          conjuge_data_nascimento?: string | null
          conjuge_nome?: string | null
          conta?: string | null
          contrato_administracao?: boolean | null
          cpf_cnpj?: string | null
          created_at?: string
          dados_imovel_area?: number | null
          dados_imovel_endereco?: string | null
          dados_imovel_tipo?: string | null
          data_casamento?: string | null
          data_compra_imovel?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          estado_civil?: string | null
          exclusividade?: boolean | null
          exclusividade_contrato_url?: string | null
          exclusividade_fim?: string | null
          exclusividade_inicio?: string | null
          id?: string
          imobiliaria_id?: string
          inscricao_iptu?: string | null
          matricula?: string | null
          nome?: string
          observacoes?: string | null
          parcela_atraso_condominio?: boolean | null
          parcela_atraso_financiamento?: boolean | null
          parcela_atraso_iptu?: boolean | null
          pix?: string | null
          quitado?: boolean | null
          saldo_devedor?: boolean | null
          telefone?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      prospeccao_diaria: {
        Row: {
          created_at: string
          data: string
          id: string
          imobiliaria_id: string
          leads_conversados: number
          observacoes: string | null
          proprietarios_contatados: number
          prospeccoes_aluguel: number
          prospeccoes_venda: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: string
          id?: string
          imobiliaria_id: string
          leads_conversados?: number
          observacoes?: string | null
          proprietarios_contatados?: number
          prospeccoes_aluguel?: number
          prospeccoes_venda?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          id?: string
          imobiliaria_id?: string
          leads_conversados?: number
          observacoes?: string | null
          proprietarios_contatados?: number
          prospeccoes_aluguel?: number
          prospeccoes_venda?: number
          updated_at?: string
        }
        Relationships: []
      }
      radarzap_access_log: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          route: string
          status: string
          user_agent: string | null
          user_email: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          route: string
          status: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          route?: string
          status?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      radarzap_agendamento_config: {
        Row: {
          ativo: boolean
          cidades: string[]
          created_at: string
          frequencia_horas: number
          id: string
          imobiliaria_id: string
          max_grupos_por_execucao: number
          proxima_execucao: string
          termo_extra: string | null
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidades?: string[]
          created_at?: string
          frequencia_horas?: number
          id?: string
          imobiliaria_id: string
          max_grupos_por_execucao?: number
          proxima_execucao?: string
          termo_extra?: string | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidades?: string[]
          created_at?: string
          frequencia_horas?: number
          id?: string
          imobiliaria_id?: string
          max_grupos_por_execucao?: number
          proxima_execucao?: string
          termo_extra?: string | null
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      radarzap_dedup_log: {
        Row: {
          campos_batidos: Json
          created_at: string
          decisao: string
          dedup_group_id: string | null
          dedup_key: string | null
          destino_pipeline_id: string | null
          destino_radarzap_lead_id: string | null
          id: string
          imobiliaria_id: string
          match_por: string | null
          motivo: string | null
          radarzap_grupo_id: string | null
          radarzap_lead_id: string | null
          radarzap_mensagem_id: string | null
          score: number | null
        }
        Insert: {
          campos_batidos?: Json
          created_at?: string
          decisao: string
          dedup_group_id?: string | null
          dedup_key?: string | null
          destino_pipeline_id?: string | null
          destino_radarzap_lead_id?: string | null
          id?: string
          imobiliaria_id: string
          match_por?: string | null
          motivo?: string | null
          radarzap_grupo_id?: string | null
          radarzap_lead_id?: string | null
          radarzap_mensagem_id?: string | null
          score?: number | null
        }
        Update: {
          campos_batidos?: Json
          created_at?: string
          decisao?: string
          dedup_group_id?: string | null
          dedup_key?: string | null
          destino_pipeline_id?: string | null
          destino_radarzap_lead_id?: string | null
          id?: string
          imobiliaria_id?: string
          match_por?: string | null
          motivo?: string | null
          radarzap_grupo_id?: string | null
          radarzap_lead_id?: string | null
          radarzap_mensagem_id?: string | null
          score?: number | null
        }
        Relationships: []
      }
      radarzap_descoberta_execucoes: {
        Row: {
          agregadores: Json | null
          cidades: string[]
          created_at: string
          encontrados: number
          erros: Json
          firecrawl_key_kind: string | null
          id: string
          ignorar_dedup_all: boolean
          imobiliaria_id: string
          inseridos: number
          modo: string
          motivo_reprocessamento: string | null
          queries: number
          reprocessar_invites: string[]
          retry_of_run_id: string | null
          run_id: string
          telemetria: Json
          termo: string | null
          total_invites_validos: number
          total_ms: number
          total_raw_items: number
        }
        Insert: {
          agregadores?: Json | null
          cidades?: string[]
          created_at?: string
          encontrados?: number
          erros?: Json
          firecrawl_key_kind?: string | null
          id?: string
          ignorar_dedup_all?: boolean
          imobiliaria_id: string
          inseridos?: number
          modo?: string
          motivo_reprocessamento?: string | null
          queries?: number
          reprocessar_invites?: string[]
          retry_of_run_id?: string | null
          run_id: string
          telemetria?: Json
          termo?: string | null
          total_invites_validos?: number
          total_ms?: number
          total_raw_items?: number
        }
        Update: {
          agregadores?: Json | null
          cidades?: string[]
          created_at?: string
          encontrados?: number
          erros?: Json
          firecrawl_key_kind?: string | null
          id?: string
          ignorar_dedup_all?: boolean
          imobiliaria_id?: string
          inseridos?: number
          modo?: string
          motivo_reprocessamento?: string | null
          queries?: number
          reprocessar_invites?: string[]
          retry_of_run_id?: string | null
          run_id?: string
          telemetria?: Json
          termo?: string | null
          total_invites_validos?: number
          total_ms?: number
          total_raw_items?: number
        }
        Relationships: []
      }
      radarzap_execucoes_log: {
        Row: {
          config_id: string | null
          created_at: string
          detalhes: Json
          duracao_ms: number | null
          erros: Json
          finalizado_em: string | null
          grupos_encontrados: number
          grupos_novos: number
          id: string
          imobiliaria_id: string
          iniciado_em: string
          queries_executadas: number
          status: string
        }
        Insert: {
          config_id?: string | null
          created_at?: string
          detalhes?: Json
          duracao_ms?: number | null
          erros?: Json
          finalizado_em?: string | null
          grupos_encontrados?: number
          grupos_novos?: number
          id?: string
          imobiliaria_id: string
          iniciado_em?: string
          queries_executadas?: number
          status?: string
        }
        Update: {
          config_id?: string | null
          created_at?: string
          detalhes?: Json
          duracao_ms?: number | null
          erros?: Json
          finalizado_em?: string | null
          grupos_encontrados?: number
          grupos_novos?: number
          id?: string
          imobiliaria_id?: string
          iniciado_em?: string
          queries_executadas?: number
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "radarzap_execucoes_log_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "radarzap_agendamento_config"
            referencedColumns: ["id"]
          },
        ]
      }
      radarzap_grupos: {
        Row: {
          bairro: string | null
          categoria: string | null
          cidade: string | null
          created_at: string | null
          descricao: string | null
          evolution_group_jid: string | null
          evolution_instance: string | null
          evolution_join_status: string | null
          evolution_last_seen_at: string | null
          id: string
          imobiliaria_id: string
          invite_url: string
          nome: string | null
          notas: string | null
          origem: string | null
          status: string | null
          total_leads: number | null
          total_mensagens: number | null
          uf: string | null
          ultimo_scan: string | null
          updated_at: string | null
        }
        Insert: {
          bairro?: string | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string | null
          descricao?: string | null
          evolution_group_jid?: string | null
          evolution_instance?: string | null
          evolution_join_status?: string | null
          evolution_last_seen_at?: string | null
          id?: string
          imobiliaria_id: string
          invite_url: string
          nome?: string | null
          notas?: string | null
          origem?: string | null
          status?: string | null
          total_leads?: number | null
          total_mensagens?: number | null
          uf?: string | null
          ultimo_scan?: string | null
          updated_at?: string | null
        }
        Update: {
          bairro?: string | null
          categoria?: string | null
          cidade?: string | null
          created_at?: string | null
          descricao?: string | null
          evolution_group_jid?: string | null
          evolution_instance?: string | null
          evolution_join_status?: string | null
          evolution_last_seen_at?: string | null
          id?: string
          imobiliaria_id?: string
          invite_url?: string
          nome?: string | null
          notas?: string | null
          origem?: string | null
          status?: string | null
          total_leads?: number | null
          total_mensagens?: number | null
          uf?: string | null
          ultimo_scan?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      radarzap_leads: {
        Row: {
          aceita_financiamento: boolean | null
          aceita_pet: boolean | null
          alerta_score_alto_em: string | null
          andar: number | null
          aprovado_em: string | null
          aprovado_por: string | null
          area_total: number | null
          area_util: number | null
          bairro: string | null
          banheiros: number | null
          cidade: string | null
          condominio_valor: number | null
          contato: string | null
          created_at: string | null
          dados_extra: Json
          dedup_group_id: string | null
          dedup_key: string | null
          descricao: string | null
          endereco: string | null
          grupo_id: string | null
          id: string
          imobiliaria_id: string
          iptu_valor: number | null
          is_principal: boolean
          lead_id: string | null
          mensagem_id: string | null
          midias: Json
          mobiliado: boolean | null
          operacao: string | null
          preco: number | null
          proprietario_nome: string | null
          quartos: number | null
          resumo: string | null
          revisao_notas: string | null
          score: number
          score_detalhes: Json
          status: string | null
          suites: number | null
          tipo_imovel: string | null
          updated_at: string | null
          vagas: number | null
        }
        Insert: {
          aceita_financiamento?: boolean | null
          aceita_pet?: boolean | null
          alerta_score_alto_em?: string | null
          andar?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          area_total?: number | null
          area_util?: number | null
          bairro?: string | null
          banheiros?: number | null
          cidade?: string | null
          condominio_valor?: number | null
          contato?: string | null
          created_at?: string | null
          dados_extra?: Json
          dedup_group_id?: string | null
          dedup_key?: string | null
          descricao?: string | null
          endereco?: string | null
          grupo_id?: string | null
          id?: string
          imobiliaria_id: string
          iptu_valor?: number | null
          is_principal?: boolean
          lead_id?: string | null
          mensagem_id?: string | null
          midias?: Json
          mobiliado?: boolean | null
          operacao?: string | null
          preco?: number | null
          proprietario_nome?: string | null
          quartos?: number | null
          resumo?: string | null
          revisao_notas?: string | null
          score?: number
          score_detalhes?: Json
          status?: string | null
          suites?: number | null
          tipo_imovel?: string | null
          updated_at?: string | null
          vagas?: number | null
        }
        Update: {
          aceita_financiamento?: boolean | null
          aceita_pet?: boolean | null
          alerta_score_alto_em?: string | null
          andar?: number | null
          aprovado_em?: string | null
          aprovado_por?: string | null
          area_total?: number | null
          area_util?: number | null
          bairro?: string | null
          banheiros?: number | null
          cidade?: string | null
          condominio_valor?: number | null
          contato?: string | null
          created_at?: string | null
          dados_extra?: Json
          dedup_group_id?: string | null
          dedup_key?: string | null
          descricao?: string | null
          endereco?: string | null
          grupo_id?: string | null
          id?: string
          imobiliaria_id?: string
          iptu_valor?: number | null
          is_principal?: boolean
          lead_id?: string | null
          mensagem_id?: string | null
          midias?: Json
          mobiliado?: boolean | null
          operacao?: string | null
          preco?: number | null
          proprietario_nome?: string | null
          quartos?: number | null
          resumo?: string | null
          revisao_notas?: string | null
          score?: number
          score_detalhes?: Json
          status?: string | null
          suites?: number | null
          tipo_imovel?: string | null
          updated_at?: string | null
          vagas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "radarzap_leads_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "radarzap_grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radarzap_leads_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "radarzap_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      radarzap_leads_auditoria: {
        Row: {
          acao: string
          actor_user_id: string | null
          campos_alterados: Json
          created_at: string
          id: string
          imobiliaria_id: string
          lead_id: string
          revisao_notas: string | null
          status_anterior: string | null
          status_novo: string | null
        }
        Insert: {
          acao: string
          actor_user_id?: string | null
          campos_alterados?: Json
          created_at?: string
          id?: string
          imobiliaria_id: string
          lead_id: string
          revisao_notas?: string | null
          status_anterior?: string | null
          status_novo?: string | null
        }
        Update: {
          acao?: string
          actor_user_id?: string | null
          campos_alterados?: Json
          created_at?: string
          id?: string
          imobiliaria_id?: string
          lead_id?: string
          revisao_notas?: string | null
          status_anterior?: string | null
          status_novo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radarzap_leads_auditoria_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "radarzap_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radarzap_leads_auditoria_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "vw_radarzap_imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      radarzap_mensagens: {
        Row: {
          analisado: boolean | null
          autor_contato: string | null
          autor_hash: string | null
          created_at: string | null
          data_mensagem: string | null
          evolution_message_id: string | null
          extraido: Json | null
          grupo_id: string | null
          id: string
          imobiliaria_id: string
          intencao: string | null
          midias: Json
          score_intencao: number | null
          tem_imovel: boolean | null
          texto: string
        }
        Insert: {
          analisado?: boolean | null
          autor_contato?: string | null
          autor_hash?: string | null
          created_at?: string | null
          data_mensagem?: string | null
          evolution_message_id?: string | null
          extraido?: Json | null
          grupo_id?: string | null
          id?: string
          imobiliaria_id: string
          intencao?: string | null
          midias?: Json
          score_intencao?: number | null
          tem_imovel?: boolean | null
          texto: string
        }
        Update: {
          analisado?: boolean | null
          autor_contato?: string | null
          autor_hash?: string | null
          created_at?: string | null
          data_mensagem?: string | null
          evolution_message_id?: string | null
          extraido?: Json | null
          grupo_id?: string | null
          id?: string
          imobiliaria_id?: string
          intencao?: string | null
          midias?: Json
          score_intencao?: number | null
          tem_imovel?: boolean | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "radarzap_mensagens_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "radarzap_grupos"
            referencedColumns: ["id"]
          },
        ]
      }
      radarzap_metricas_alertas_config: {
        Row: {
          ativo: boolean
          cooldown_horas: number
          created_at: string
          descoberta_alertar_erro: boolean
          descoberta_alertar_timeout: boolean
          descoberta_alertar_zero: boolean
          descoberta_min_erros: number
          descoberta_timeout_ms: number
          id: string
          imobiliaria_id: string
          janela_horas: number
          min_leads_avaliacao: number
          min_mensagens_avaliacao: number
          min_taxa_aprovacao: number
          min_taxa_geracao: number
          ultimo_check_em: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cooldown_horas?: number
          created_at?: string
          descoberta_alertar_erro?: boolean
          descoberta_alertar_timeout?: boolean
          descoberta_alertar_zero?: boolean
          descoberta_min_erros?: number
          descoberta_timeout_ms?: number
          id?: string
          imobiliaria_id: string
          janela_horas?: number
          min_leads_avaliacao?: number
          min_mensagens_avaliacao?: number
          min_taxa_aprovacao?: number
          min_taxa_geracao?: number
          ultimo_check_em?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cooldown_horas?: number
          created_at?: string
          descoberta_alertar_erro?: boolean
          descoberta_alertar_timeout?: boolean
          descoberta_alertar_zero?: boolean
          descoberta_min_erros?: number
          descoberta_timeout_ms?: number
          id?: string
          imobiliaria_id?: string
          janela_horas?: number
          min_leads_avaliacao?: number
          min_mensagens_avaliacao?: number
          min_taxa_aprovacao?: number
          min_taxa_geracao?: number
          ultimo_check_em?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      radarzap_metricas_alertas_log: {
        Row: {
          created_at: string
          detalhes: Json | null
          id: string
          imobiliaria_id: string
          janela_horas: number
          taxa_minima: number
          taxa_observada: number
          tipo: string
          total_aprovados: number
          total_leads: number
          total_mensagens: number
        }
        Insert: {
          created_at?: string
          detalhes?: Json | null
          id?: string
          imobiliaria_id: string
          janela_horas: number
          taxa_minima: number
          taxa_observada: number
          tipo: string
          total_aprovados?: number
          total_leads?: number
          total_mensagens?: number
        }
        Update: {
          created_at?: string
          detalhes?: Json | null
          id?: string
          imobiliaria_id?: string
          janela_horas?: number
          taxa_minima?: number
          taxa_observada?: number
          tipo?: string
          total_aprovados?: number
          total_leads?: number
          total_mensagens?: number
        }
        Relationships: []
      }
      radarzap_normalizacao_config: {
        Row: {
          created_at: string
          id: string
          imobiliaria_id: string
          min_length: number
          tokens_ruidosos: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          imobiliaria_id: string
          min_length?: number
          tokens_ruidosos?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          imobiliaria_id?: string
          min_length?: number
          tokens_ruidosos?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      radarzap_scoring_config: {
        Row: {
          alerta_score_alto: number
          created_at: string
          followup_auto_ativo: boolean
          followup_sla_horas: number
          followup_tipo: string
          id: string
          imobiliaria_id: string
          min_score_principal: number
          peso_bairro: number
          peso_cidade: number
          peso_contato_bom: number
          peso_contato_parcial: number
          peso_operacao: number
          peso_preco: number
          peso_proprietario: number
          peso_tipo: number
          updated_at: string
        }
        Insert: {
          alerta_score_alto?: number
          created_at?: string
          followup_auto_ativo?: boolean
          followup_sla_horas?: number
          followup_tipo?: string
          id?: string
          imobiliaria_id: string
          min_score_principal?: number
          peso_bairro?: number
          peso_cidade?: number
          peso_contato_bom?: number
          peso_contato_parcial?: number
          peso_operacao?: number
          peso_preco?: number
          peso_proprietario?: number
          peso_tipo?: number
          updated_at?: string
        }
        Update: {
          alerta_score_alto?: number
          created_at?: string
          followup_auto_ativo?: boolean
          followup_sla_horas?: number
          followup_tipo?: string
          id?: string
          imobiliaria_id?: string
          min_score_principal?: number
          peso_bairro?: number
          peso_cidade?: number
          peso_contato_bom?: number
          peso_contato_parcial?: number
          peso_operacao?: number
          peso_preco?: number
          peso_proprietario?: number
          peso_tipo?: number
          updated_at?: string
        }
        Relationships: []
      }
      relatorios_agendados: {
        Row: {
          ativo: boolean
          created_at: string
          destinatarios: string[]
          dia_mes: number
          dia_semana: number
          enviar_para_permissao: string | null
          formato: string
          frequencia: string
          hora: number
          id: string
          imobiliaria_id: string
          incluir_corretores: boolean
          nome: string
          periodo: string
          proxima_execucao: string
          tipo_relatorio: string
          ultima_execucao: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          destinatarios?: string[]
          dia_mes?: number
          dia_semana?: number
          enviar_para_permissao?: string | null
          formato?: string
          frequencia?: string
          hora?: number
          id?: string
          imobiliaria_id: string
          incluir_corretores?: boolean
          nome: string
          periodo?: string
          proxima_execucao?: string
          tipo_relatorio: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          destinatarios?: string[]
          dia_mes?: number
          dia_semana?: number
          enviar_para_permissao?: string | null
          formato?: string
          frequencia?: string
          hora?: number
          id?: string
          imobiliaria_id?: string
          incluir_corretores?: boolean
          nome?: string
          periodo?: string
          proxima_execucao?: string
          tipo_relatorio?: string
          ultima_execucao?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      relatorios_agendados_execucoes: {
        Row: {
          created_at: string
          destinatarios: string[]
          erro: string | null
          executado_em: string
          formato: string | null
          id: string
          imobiliaria_id: string
          relatorio_id: string
          status: string
          total_registros: number
        }
        Insert: {
          created_at?: string
          destinatarios?: string[]
          erro?: string | null
          executado_em?: string
          formato?: string | null
          id?: string
          imobiliaria_id: string
          relatorio_id: string
          status?: string
          total_registros?: number
        }
        Update: {
          created_at?: string
          destinatarios?: string[]
          erro?: string | null
          executado_em?: string
          formato?: string | null
          id?: string
          imobiliaria_id?: string
          relatorio_id?: string
          status?: string
          total_registros?: number
        }
        Relationships: [
          {
            foreignKeyName: "relatorios_agendados_execucoes_relatorio_id_fkey"
            columns: ["relatorio_id"]
            isOneToOne: false
            referencedRelation: "relatorios_agendados"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_deletion_log: {
        Row: {
          created_at: string
          criterio: string | null
          cron_execucao_id: string | null
          deleted_at: string
          entidade: string
          id: string
          mecanismo: string
          metadata: Json
          politica: string
          quantidade: number
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          criterio?: string | null
          cron_execucao_id?: string | null
          deleted_at?: string
          entidade: string
          id?: string
          mecanismo?: string
          metadata?: Json
          politica: string
          quantidade?: number
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          criterio?: string | null
          cron_execucao_id?: string | null
          deleted_at?: string
          entidade?: string
          id?: string
          mecanismo?: string
          metadata?: Json
          politica?: string
          quantidade?: number
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "retention_deletion_log_cron_execucao_id_fkey"
            columns: ["cron_execucao_id"]
            isOneToOne: false
            referencedRelation: "cron_execucoes_log"
            referencedColumns: ["id"]
          },
        ]
      }
      retention_simulation_history: {
        Row: {
          created_at: string
          duracao_ms: number | null
          executed_at: string
          executed_by: string | null
          executed_by_email: string | null
          id: string
          parametros: Json
          politicas_count: number
          resultados: Json
          tenants_impactados: number
          total_protegidos: number
          total_removidos: number
        }
        Insert: {
          created_at?: string
          duracao_ms?: number | null
          executed_at?: string
          executed_by?: string | null
          executed_by_email?: string | null
          id?: string
          parametros?: Json
          politicas_count?: number
          resultados?: Json
          tenants_impactados?: number
          total_protegidos?: number
          total_removidos?: number
        }
        Update: {
          created_at?: string
          duracao_ms?: number | null
          executed_at?: string
          executed_by?: string | null
          executed_by_email?: string | null
          id?: string
          parametros?: Json
          politicas_count?: number
          resultados?: Json
          tenants_impactados?: number
          total_protegidos?: number
          total_removidos?: number
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          action: string
          actor_tenant_id: string | null
          actor_user_id: string | null
          correlation_id: string | null
          created_at: string
          edge_function: string | null
          event_type: string
          id: string
          metadata: Json
          outcome: string
          reason: string | null
          record_id: string | null
          request_ip: string | null
          source: string
          table_name: string | null
          tenant_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_tenant_id?: string | null
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          edge_function?: string | null
          event_type: string
          id?: string
          metadata?: Json
          outcome: string
          reason?: string | null
          record_id?: string | null
          request_ip?: string | null
          source: string
          table_name?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_tenant_id?: string | null
          actor_user_id?: string | null
          correlation_id?: string | null
          created_at?: string
          edge_function?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          outcome?: string
          reason?: string | null
          record_id?: string | null
          request_ip?: string | null
          source?: string
          table_name?: string | null
          tenant_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      seo_correcoes_checklist: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          imobiliaria_id: string
          notes: string | null
          resolved: boolean
          resolved_at: string | null
          route_path: string
          tag_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          imobiliaria_id: string
          notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          route_path: string
          tag_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          imobiliaria_id?: string
          notes?: string | null
          resolved?: boolean
          resolved_at?: string | null
          route_path?: string
          tag_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_monitor_alertas: {
        Row: {
          created_at: string
          id: string
          message: string
          metadata: Json
          resolved_at: string | null
          response_ms: number | null
          severity: string
          snapshot_id: string | null
          status_code: number | null
          tipo: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          metadata?: Json
          resolved_at?: string | null
          response_ms?: number | null
          severity?: string
          snapshot_id?: string | null
          status_code?: number | null
          tipo: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          metadata?: Json
          resolved_at?: string | null
          response_ms?: number | null
          severity?: string
          snapshot_id?: string | null
          status_code?: number | null
          tipo?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "seo_monitor_alertas_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "seo_monitor_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      seo_monitor_snapshots: {
        Row: {
          avg_ms: number
          created_at: string
          duration_ms: number
          error_count: number
          id: string
          new_urls_count: number
          ok_count: number
          p95_ms: number
          removed_urls_count: number
          results: Json
          total_urls: number
        }
        Insert: {
          avg_ms?: number
          created_at?: string
          duration_ms?: number
          error_count?: number
          id?: string
          new_urls_count?: number
          ok_count?: number
          p95_ms?: number
          removed_urls_count?: number
          results?: Json
          total_urls?: number
        }
        Update: {
          avg_ms?: number
          created_at?: string
          duration_ms?: number
          error_count?: number
          id?: string
          new_urls_count?: number
          ok_count?: number
          p95_ms?: number
          removed_urls_count?: number
          results?: Json
          total_urls?: number
        }
        Relationships: []
      }
      serper_audit_logs: {
        Row: {
          created_at: string
          id: string
          query: string
          source: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          source: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          source?: string
          user_id?: string | null
        }
        Relationships: []
      }
      serper_search_cache: {
        Row: {
          created_at: string
          id: string
          query: string
          results: Json
          summary: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          results: Json
          summary?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          results?: Json
          summary?: string | null
          user_id?: string
        }
        Relationships: []
      }
      serper_usage_limits: {
        Row: {
          alert_email: string | null
          alert_threshold_percent: number | null
          created_at: string | null
          id: string
          monthly_limit: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          alert_email?: string | null
          alert_threshold_percent?: number | null
          created_at?: string | null
          id?: string
          monthly_limit?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          alert_email?: string | null
          alert_threshold_percent?: number | null
          created_at?: string | null
          id?: string
          monthly_limit?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      signup_ips: {
        Row: {
          created_at: string
          id: string
          ip_address: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ip_address: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ip_address?: string
          user_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string | null
          current_period_end: string | null
          id: string
          plan_type: string
          price_id: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_type: string
          price_id?: string | null
          status: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string | null
          current_period_end?: string | null
          id?: string
          plan_type?: string
          price_id?: string | null
          status?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          action: string
          correlation_id: string | null
          created_at: string
          id: string
          level: string | null
          message: string
          metadata: Json | null
          module: string
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          correlation_id?: string | null
          created_at?: string
          id?: string
          level?: string | null
          message: string
          metadata?: Json | null
          module: string
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          correlation_id?: string | null
          created_at?: string
          id?: string
          level?: string | null
          message?: string
          metadata?: Json | null
          module?: string
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          canal_origem: string | null
          captador_comissao_percentual: number | null
          captador_comissao_valor: number | null
          captador_nome: string | null
          categoria: string
          comissao_percentual: number | null
          comissao_valor: number | null
          comprovante_url: string | null
          corretor_id: string | null
          corretor_nome: string | null
          created_at: string
          data: string
          data_recebimento: string | null
          descricao: string
          divisao_comissao: string | null
          id: string
          imobiliaria_id: string
          imovel_id: string | null
          imposto_percentual: number | null
          imposto_tipo: string | null
          imposto_valor: number | null
          lembrete_enviado_count: number
          lembrete_ultimo_envio: string | null
          link_pagamento: string | null
          numero_unidade: string | null
          observacoes: string | null
          pago_confirmado_em: string | null
          pago_confirmado_por: string | null
          parceiro_comissao_percentual: number | null
          parceiro_comissao_valor: number | null
          parceiro_nome: string | null
          proprietario_cpf: string | null
          proprietario_nome: string | null
          proprietario_telefone: string | null
          recorrencia: string | null
          status: string
          taxa_extra: number | null
          taxa_extra_descricao: string | null
          tipo: string
          token_pagamento: string | null
          updated_at: string
          valor: number
          valor_condominio: number | null
          valor_iptu: number | null
          valor_nao_tributavel: number | null
        }
        Insert: {
          canal_origem?: string | null
          captador_comissao_percentual?: number | null
          captador_comissao_valor?: number | null
          captador_nome?: string | null
          categoria?: string
          comissao_percentual?: number | null
          comissao_valor?: number | null
          comprovante_url?: string | null
          corretor_id?: string | null
          corretor_nome?: string | null
          created_at?: string
          data?: string
          data_recebimento?: string | null
          descricao: string
          divisao_comissao?: string | null
          id?: string
          imobiliaria_id: string
          imovel_id?: string | null
          imposto_percentual?: number | null
          imposto_tipo?: string | null
          imposto_valor?: number | null
          lembrete_enviado_count?: number
          lembrete_ultimo_envio?: string | null
          link_pagamento?: string | null
          numero_unidade?: string | null
          observacoes?: string | null
          pago_confirmado_em?: string | null
          pago_confirmado_por?: string | null
          parceiro_comissao_percentual?: number | null
          parceiro_comissao_valor?: number | null
          parceiro_nome?: string | null
          proprietario_cpf?: string | null
          proprietario_nome?: string | null
          proprietario_telefone?: string | null
          recorrencia?: string | null
          status?: string
          taxa_extra?: number | null
          taxa_extra_descricao?: string | null
          tipo?: string
          token_pagamento?: string | null
          updated_at?: string
          valor?: number
          valor_condominio?: number | null
          valor_iptu?: number | null
          valor_nao_tributavel?: number | null
        }
        Update: {
          canal_origem?: string | null
          captador_comissao_percentual?: number | null
          captador_comissao_valor?: number | null
          captador_nome?: string | null
          categoria?: string
          comissao_percentual?: number | null
          comissao_valor?: number | null
          comprovante_url?: string | null
          corretor_id?: string | null
          corretor_nome?: string | null
          created_at?: string
          data?: string
          data_recebimento?: string | null
          descricao?: string
          divisao_comissao?: string | null
          id?: string
          imobiliaria_id?: string
          imovel_id?: string | null
          imposto_percentual?: number | null
          imposto_tipo?: string | null
          imposto_valor?: number | null
          lembrete_enviado_count?: number
          lembrete_ultimo_envio?: string | null
          link_pagamento?: string | null
          numero_unidade?: string | null
          observacoes?: string | null
          pago_confirmado_em?: string | null
          pago_confirmado_por?: string | null
          parceiro_comissao_percentual?: number | null
          parceiro_comissao_valor?: number | null
          parceiro_nome?: string | null
          proprietario_cpf?: string | null
          proprietario_nome?: string | null
          proprietario_telefone?: string | null
          recorrencia?: string | null
          status?: string
          taxa_extra?: number | null
          taxa_extra_descricao?: string | null
          tipo?: string
          token_pagamento?: string | null
          updated_at?: string
          valor?: number
          valor_condominio?: number | null
          valor_iptu?: number | null
          valor_nao_tributavel?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_corretor_id_fkey"
            columns: ["corretor_id"]
            isOneToOne: false
            referencedRelation: "corretores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_imovel_id_fkey"
            columns: ["imovel_id"]
            isOneToOne: false
            referencedRelation: "imoveis"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_config: {
        Row: {
          api_key_encrypted: string | null
          api_key_iv: string | null
          api_key_rotated_at: string | null
          byok_active: boolean | null
          created_at: string
          last_health_check_at: string | null
          last_health_check_message: string | null
          last_health_check_status: string | null
          model: string | null
          model_article: string | null
          model_image: string | null
          provider: string
          provider_keys: Json | null
          rotation_alert_days: number
          rotation_interval_days: number
          rotation_notifications_enabled: boolean
          serper_config: Json | null
          serper_key_encrypted: string | null
          serper_key_iv: string | null
          serper_key_rotated_at: string | null
          serper_keys: Json | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          api_key_encrypted?: string | null
          api_key_iv?: string | null
          api_key_rotated_at?: string | null
          byok_active?: boolean | null
          created_at?: string
          last_health_check_at?: string | null
          last_health_check_message?: string | null
          last_health_check_status?: string | null
          model?: string | null
          model_article?: string | null
          model_image?: string | null
          provider: string
          provider_keys?: Json | null
          rotation_alert_days?: number
          rotation_interval_days?: number
          rotation_notifications_enabled?: boolean
          serper_config?: Json | null
          serper_key_encrypted?: string | null
          serper_key_iv?: string | null
          serper_key_rotated_at?: string | null
          serper_keys?: Json | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          api_key_encrypted?: string | null
          api_key_iv?: string | null
          api_key_rotated_at?: string | null
          byok_active?: boolean | null
          created_at?: string
          last_health_check_at?: string | null
          last_health_check_message?: string | null
          last_health_check_status?: string | null
          model?: string | null
          model_article?: string | null
          model_image?: string | null
          provider?: string
          provider_keys?: Json | null
          rotation_alert_days?: number
          rotation_interval_days?: number
          rotation_notifications_enabled?: boolean
          serper_config?: Json | null
          serper_key_encrypted?: string | null
          serper_key_iv?: string | null
          serper_key_rotated_at?: string | null
          serper_keys?: Json | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_permissoes: {
        Row: {
          ativo: boolean
          id: string
          modulo: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          id?: string
          modulo: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          id?: string
          modulo?: string
          user_id?: string
        }
        Relationships: []
      }
      verify_sla_execucoes_log: {
        Row: {
          created_at: string
          duracao_ms: number | null
          erro: string | null
          executado_em: string
          http_status: number | null
          id: string
          payload: Json | null
          status: string
        }
        Insert: {
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          executado_em?: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          status: string
        }
        Update: {
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          executado_em?: string
          http_status?: number | null
          id?: string
          payload?: Json | null
          status?: string
        }
        Relationships: []
      }
      verify_sla_schedule_config: {
        Row: {
          ativo: boolean
          created_at: string
          cron_expression: string
          falhas_consecutivas: number
          id: string
          ultima_execucao_em: string | null
          ultima_execucao_payload: Json | null
          ultima_execucao_status: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          cron_expression?: string
          falhas_consecutivas?: number
          id?: string
          ultima_execucao_em?: string | null
          ultima_execucao_payload?: Json | null
          ultima_execucao_status?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          cron_expression?: string
          falhas_consecutivas?: number
          id?: string
          ultima_execucao_em?: string | null
          ultima_execucao_payload?: Json | null
          ultima_execucao_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      webhook_alert_thresholds: {
        Row: {
          cache_hit_min: number | null
          cooldown_minutes: number | null
          created_at: string
          critical_cache_hit_min: number | null
          critical_latency_max_ms: number | null
          enabled: boolean
          id: string
          imobiliaria_id: string
          latency_max_ms: number | null
          min_samples: number | null
          provider: string | null
          updated_at: string
        }
        Insert: {
          cache_hit_min?: number | null
          cooldown_minutes?: number | null
          created_at?: string
          critical_cache_hit_min?: number | null
          critical_latency_max_ms?: number | null
          enabled?: boolean
          id?: string
          imobiliaria_id: string
          latency_max_ms?: number | null
          min_samples?: number | null
          provider?: string | null
          updated_at?: string
        }
        Update: {
          cache_hit_min?: number | null
          cooldown_minutes?: number | null
          created_at?: string
          critical_cache_hit_min?: number | null
          critical_latency_max_ms?: number | null
          enabled?: boolean
          id?: string
          imobiliaria_id?: string
          latency_max_ms?: number | null
          min_samples?: number | null
          provider?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      webhook_alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          details: Json
          id: string
          imobiliaria_id: string
          message: string
          metric_value: number
          provider: string
          request_id: string | null
          resolution_note: string | null
          resolution_source: string | null
          resolved_at: string | null
          resolved_by: string | null
          sample_size: number
          severity: string
          threshold: number
          updated_at: string
          window_seconds: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          created_at?: string
          details?: Json
          id?: string
          imobiliaria_id: string
          message: string
          metric_value: number
          provider: string
          request_id?: string | null
          resolution_note?: string | null
          resolution_source?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sample_size: number
          severity?: string
          threshold: number
          updated_at?: string
          window_seconds: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          created_at?: string
          details?: Json
          id?: string
          imobiliaria_id?: string
          message?: string
          metric_value?: number
          provider?: string
          request_id?: string | null
          resolution_note?: string | null
          resolution_source?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          sample_size?: number
          severity?: string
          threshold?: number
          updated_at?: string
          window_seconds?: number
        }
        Relationships: []
      }
      webhook_metrics: {
        Row: {
          cache_hit: boolean
          created_at: string
          id: string
          imobiliaria_id: string | null
          keys_loaded: number
          keys_tested: number
          outcome: string
          provider: string
          reason: string | null
          request_id: string
          secret_id: string | null
          secret_version: number | null
          secrets_source: string | null
          validation_ms: number
        }
        Insert: {
          cache_hit?: boolean
          created_at?: string
          id?: string
          imobiliaria_id?: string | null
          keys_loaded?: number
          keys_tested?: number
          outcome: string
          provider: string
          reason?: string | null
          request_id: string
          secret_id?: string | null
          secret_version?: number | null
          secrets_source?: string | null
          validation_ms?: number
        }
        Update: {
          cache_hit?: boolean
          created_at?: string
          id?: string
          imobiliaria_id?: string | null
          keys_loaded?: number
          keys_tested?: number
          outcome?: string
          provider?: string
          reason?: string | null
          request_id?: string
          secret_id?: string | null
          secret_version?: number | null
          secrets_source?: string | null
          validation_ms?: number
        }
        Relationships: []
      }
      webhook_metrics_daily: {
        Row: {
          allowed_events: number
          bucket_date: string
          cache_hits: number
          created_at: string
          denied_events: number
          id: string
          imobiliaria_id: string | null
          keys_loaded_sum: number
          keys_tested_sum: number
          provider: string
          total_events: number
          updated_at: string
          validation_ms_max: number
          validation_ms_sum: number
        }
        Insert: {
          allowed_events?: number
          bucket_date: string
          cache_hits?: number
          created_at?: string
          denied_events?: number
          id?: string
          imobiliaria_id?: string | null
          keys_loaded_sum?: number
          keys_tested_sum?: number
          provider: string
          total_events?: number
          updated_at?: string
          validation_ms_max?: number
          validation_ms_sum?: number
        }
        Update: {
          allowed_events?: number
          bucket_date?: string
          cache_hits?: number
          created_at?: string
          denied_events?: number
          id?: string
          imobiliaria_id?: string | null
          keys_loaded_sum?: number
          keys_tested_sum?: number
          provider?: string
          total_events?: number
          updated_at?: string
          validation_ms_max?: number
          validation_ms_sum?: number
        }
        Relationships: []
      }
      webhook_metrics_hourly: {
        Row: {
          allowed_events: number
          bucket_hour: string
          cache_hits: number
          created_at: string
          denied_events: number
          id: string
          imobiliaria_id: string | null
          keys_loaded_sum: number
          keys_tested_sum: number
          provider: string
          total_events: number
          updated_at: string
          validation_ms_max: number
          validation_ms_sum: number
        }
        Insert: {
          allowed_events?: number
          bucket_hour: string
          cache_hits?: number
          created_at?: string
          denied_events?: number
          id?: string
          imobiliaria_id?: string | null
          keys_loaded_sum?: number
          keys_tested_sum?: number
          provider: string
          total_events?: number
          updated_at?: string
          validation_ms_max?: number
          validation_ms_sum?: number
        }
        Update: {
          allowed_events?: number
          bucket_hour?: string
          cache_hits?: number
          created_at?: string
          denied_events?: number
          id?: string
          imobiliaria_id?: string | null
          keys_loaded_sum?: number
          keys_tested_sum?: number
          provider?: string
          total_events?: number
          updated_at?: string
          validation_ms_max?: number
          validation_ms_sum?: number
        }
        Relationships: []
      }
      webhook_nonces: {
        Row: {
          expires_at: string
          id: string
          imobiliaria_id: string
          nonce: string
          provider: string
          received_at: string
        }
        Insert: {
          expires_at?: string
          id?: string
          imobiliaria_id: string
          nonce: string
          provider: string
          received_at?: string
        }
        Update: {
          expires_at?: string
          id?: string
          imobiliaria_id?: string
          nonce?: string
          provider?: string
          received_at?: string
        }
        Relationships: []
      }
      webhook_secrets: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          expires_at: string | null
          id: string
          imobiliaria_id: string
          label: string | null
          last_used_at: string | null
          provider: string
          replaced_by: string | null
          rotated_at: string | null
          secret: string
          updated_at: string
          version: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          expires_at?: string | null
          id?: string
          imobiliaria_id: string
          label?: string | null
          last_used_at?: string | null
          provider: string
          replaced_by?: string | null
          rotated_at?: string | null
          secret: string
          updated_at?: string
          version?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          expires_at?: string | null
          id?: string
          imobiliaria_id?: string
          label?: string | null
          last_used_at?: string | null
          provider?: string
          replaced_by?: string | null
          rotated_at?: string | null
          secret?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "webhook_secrets_replaced_by_fkey"
            columns: ["replaced_by"]
            isOneToOne: false
            referencedRelation: "webhook_secrets"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_captacao_templates: {
        Row: {
          created_at: string
          id: string
          imobiliaria_id: string
          template_body: string
          updated_at: string
          variables: Json
        }
        Insert: {
          created_at?: string
          id?: string
          imobiliaria_id: string
          template_body?: string
          updated_at?: string
          variables?: Json
        }
        Update: {
          created_at?: string
          id?: string
          imobiliaria_id?: string
          template_body?: string
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      whatsapp_config: {
        Row: {
          api_key: string | null
          api_url: string | null
          ativo: boolean | null
          created_at: string | null
          id: string
          imobiliaria_id: string
          instance_id_zapi: string | null
          instance_name: string | null
          provider: string
          token_zapi: string | null
          updated_at: string | null
        }
        Insert: {
          api_key?: string | null
          api_url?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          imobiliaria_id: string
          instance_id_zapi?: string | null
          instance_name?: string | null
          provider?: string
          token_zapi?: string | null
          updated_at?: string | null
        }
        Update: {
          api_key?: string | null
          api_url?: string | null
          ativo?: boolean | null
          created_at?: string | null
          id?: string
          imobiliaria_id?: string
          instance_id_zapi?: string | null
          instance_name?: string | null
          provider?: string
          token_zapi?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_consentimento_eventos: {
        Row: {
          ator_id: string | null
          ator_tipo: string | null
          consentimento_id: string
          created_at: string
          descricao: string | null
          id: string
          imobiliaria_id: string
          ip_origem: unknown
          metadata: Json | null
          tipo_evento: string
          user_agent: string | null
        }
        Insert: {
          ator_id?: string | null
          ator_tipo?: string | null
          consentimento_id: string
          created_at?: string
          descricao?: string | null
          id?: string
          imobiliaria_id: string
          ip_origem?: unknown
          metadata?: Json | null
          tipo_evento: string
          user_agent?: string | null
        }
        Update: {
          ator_id?: string | null
          ator_tipo?: string | null
          consentimento_id?: string
          created_at?: string
          descricao?: string | null
          id?: string
          imobiliaria_id?: string
          ip_origem?: unknown
          metadata?: Json | null
          tipo_evento?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_consentimento_eventos_consentimento_id_fkey"
            columns: ["consentimento_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_consentimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_consentimentos: {
        Row: {
          aceito_em: string | null
          canal_origem: string
          created_at: string
          double_optin_confirmado_em: string | null
          double_optin_enviado_em: string | null
          double_optin_token: string | null
          email: string | null
          finalidades: string[]
          id: string
          imobiliaria_id: string
          ip_origem: unknown
          motivo_revogacao: string | null
          nome_contato: string | null
          observacoes: string | null
          origem_referencia: string | null
          revogado_em: string | null
          revogado_por: string | null
          status: string
          telefone: string
          telefone_norm: string
          termo_id: string | null
          termo_versao: string | null
          token_publico: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          aceito_em?: string | null
          canal_origem: string
          created_at?: string
          double_optin_confirmado_em?: string | null
          double_optin_enviado_em?: string | null
          double_optin_token?: string | null
          email?: string | null
          finalidades?: string[]
          id?: string
          imobiliaria_id: string
          ip_origem?: unknown
          motivo_revogacao?: string | null
          nome_contato?: string | null
          observacoes?: string | null
          origem_referencia?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          status?: string
          telefone: string
          telefone_norm: string
          termo_id?: string | null
          termo_versao?: string | null
          token_publico: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          aceito_em?: string | null
          canal_origem?: string
          created_at?: string
          double_optin_confirmado_em?: string | null
          double_optin_enviado_em?: string | null
          double_optin_token?: string | null
          email?: string | null
          finalidades?: string[]
          id?: string
          imobiliaria_id?: string
          ip_origem?: unknown
          motivo_revogacao?: string | null
          nome_contato?: string | null
          observacoes?: string | null
          origem_referencia?: string | null
          revogado_em?: string | null
          revogado_por?: string | null
          status?: string
          telefone?: string
          telefone_norm?: string
          termo_id?: string | null
          termo_versao?: string | null
          token_publico?: string
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_consentimentos_termo_id_fkey"
            columns: ["termo_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_termos_consentimento"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_contatos_captacao: {
        Row: {
          created_at: string
          id: string
          imobiliaria_id: string
          lista_proprietario_id: string
          mensagem_preview: string | null
          sent_at: string
          telefone_digits: string
          url_anuncio: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          imobiliaria_id: string
          lista_proprietario_id: string
          mensagem_preview?: string | null
          sent_at?: string
          telefone_digits: string
          url_anuncio?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          imobiliaria_id?: string
          lista_proprietario_id?: string
          mensagem_preview?: string | null
          sent_at?: string
          telefone_digits?: string
          url_anuncio?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_contatos_captacao_lista_proprietario_id_fkey"
            columns: ["lista_proprietario_id"]
            isOneToOne: false
            referencedRelation: "lista_proprietarios_captacao"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_termos_consentimento: {
        Row: {
          ativo: boolean
          created_at: string
          finalidades: string[]
          id: string
          imobiliaria_id: string
          texto: string
          titulo: string
          updated_at: string
          versao: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          finalidades?: string[]
          id?: string
          imobiliaria_id: string
          texto: string
          titulo: string
          updated_at?: string
          versao: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          finalidades?: string[]
          id?: string
          imobiliaria_id?: string
          texto?: string
          titulo?: string
          updated_at?: string
          versao?: string
        }
        Relationships: []
      }
      wordpress_sites: {
        Row: {
          application_password: string
          base_url: string
          created_at: string
          id: string
          imobiliaria_id: string
          name: string
          seo_plugin: string | null
          updated_at: string
          username: string
        }
        Insert: {
          application_password: string
          base_url: string
          created_at?: string
          id?: string
          imobiliaria_id: string
          name: string
          seo_plugin?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          application_password?: string
          base_url?: string
          created_at?: string
          id?: string
          imobiliaria_id?: string
          name?: string
          seo_plugin?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: [
          {
            foreignKeyName: "wordpress_sites_imobiliaria_id_fkey"
            columns: ["imobiliaria_id"]
            isOneToOne: false
            referencedRelation: "imobiliaria_config"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_radarzap_imoveis: {
        Row: {
          aceita_financiamento: boolean | null
          aceita_pet: boolean | null
          andar: number | null
          area_total: number | null
          area_util: number | null
          bairro: string | null
          banheiros: number | null
          cidade: string | null
          condominio_valor: number | null
          contato: string | null
          created_at: string | null
          data_mensagem: string | null
          descricao: string | null
          endereco: string | null
          grupo_categoria: string | null
          grupo_id: string | null
          grupo_invite_url: string | null
          grupo_nome: string | null
          id: string | null
          imobiliaria_id: string | null
          iptu_valor: number | null
          mensagem_id: string | null
          mensagem_original: string | null
          midias: Json | null
          mobiliado: boolean | null
          operacao: string | null
          preco: number | null
          proprietario_nome: string | null
          quartos: number | null
          score: number | null
          status: string | null
          suites: number | null
          tipo_imovel: string | null
          uf: string | null
          vagas: number | null
        }
        Relationships: [
          {
            foreignKeyName: "radarzap_leads_grupo_id_fkey"
            columns: ["grupo_id"]
            isOneToOne: false
            referencedRelation: "radarzap_grupos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radarzap_leads_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "radarzap_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ack_webhook_alert: {
        Args: { _alert_id: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          details: Json
          id: string
          imobiliaria_id: string
          message: string
          metric_value: number
          provider: string
          request_id: string | null
          resolution_note: string | null
          resolution_source: string | null
          resolved_at: string | null
          resolved_by: string | null
          sample_size: number
          severity: string
          threshold: number
          updated_at: string
          window_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "webhook_alerts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      aplicar_autopublicacao_seo: {
        Args: never
        Returns: {
          publicados: number
        }[]
      }
      apply_data_retention_policies: {
        Args: never
        Returns: {
          firecrawl_deleted: number
          proprietarios_deleted: number
          tenant_id: string
        }[]
      }
      calcular_motivacao_proprietario: {
        Args: {
          _config?: Json
          _historico_precos: Json
          _origem: string
          _primeiro_visto: string
          _republicacoes: number
          _ultimo_preco: number
        }
        Returns: Json
      }
      can_access_imobiliaria: {
        Args: { _imobiliaria_id: string }
        Returns: boolean
      }
      candidato_pode_contatar: { Args: { _id: string }; Returns: boolean }
      captacao_pipeline_metricas: {
        Args: { _ate?: string; _corretor_id?: string; _desde?: string }
        Returns: Json
      }
      captacao_pipeline_move: {
        Args: {
          _id: string
          _motivo?: string
          _to: Database["public"]["Enums"]["captacao_pipeline_estagio"]
        }
        Returns: {
          campos_verificados: Json
          corretor_id: string | null
          created_at: string
          created_by: string | null
          dados: Json
          email: string | null
          escalonado_em: string | null
          estagio: Database["public"]["Enums"]["captacao_pipeline_estagio"]
          estagio_desde: string
          fontes_resumo: Json
          id: string
          imobiliaria_id: string
          imovel_bairro: string | null
          imovel_cidade: string | null
          imovel_endereco: string | null
          imovel_tipo: string | null
          lgpd_status: string
          nome: string
          operacao: string | null
          origem: string | null
          perdido_motivo: string | null
          radarzap_lead_id: string | null
          telefone: string | null
          telefone_e164: string | null
          ultima_atividade_em: string | null
          updated_at: string
          valor_estimado: number | null
          won_em: string | null
          won_valor: number | null
        }
        SetofOptions: {
          from: "*"
          to: "captacao_pipeline"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      captacao_pipeline_sla_pendentes: {
        Args: never
        Returns: {
          corretor_id: string
          escalonado_em: string
          estagio: Database["public"]["Enums"]["captacao_pipeline_estagio"]
          estagio_desde: string
          horas_no_estagio: number
          id: string
          imobiliaria_id: string
          nome: string
          sla_horas: number
          tipo_alerta: string
          ultima_atividade_em: string
        }[]
      }
      check_expiring_contracts: { Args: never; Returns: undefined }
      check_extracao_anuncio_spikes: {
        Args: {
          _threshold_429?: number
          _threshold_502?: number
          _threshold_total?: number
          _window_minutes?: number
        }
        Returns: Json
      }
      check_ip_abuse: { Args: { _ip: string }; Returns: number }
      claim_photo_extraction_jobs: {
        Args: { _limit?: number }
        Returns: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          imovel_id: string | null
          last_block_reason: string | null
          last_error: string | null
          last_error_code: string | null
          max_attempts: number
          next_run_at: string
          origin: string
          portal: string | null
          priority: number
          result: Json | null
          source_url: string
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "photo_extraction_queue"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      cleanup_old_notifications: { Args: never; Returns: undefined }
      cleanup_old_serper_cache: { Args: never; Returns: undefined }
      cleanup_webhook_nonces: { Args: never; Returns: undefined }
      condo_prosp_agendamento_concluir: {
        Args: {
          _agendar_proxima?: boolean
          _id: string
          _observacao?: string
          _resultado: string
        }
        Returns: string
      }
      cron_log_finish: {
        Args: {
          _id: string
          _message?: string
          _metadata?: Json
          _status: string
        }
        Returns: undefined
      }
      cron_log_start: {
        Args: { _job_name: string; _metadata?: Json; _servidor?: string }
        Returns: string
      }
      distribuir_fila_leads: {
        Args: { _imobiliaria_id: string; _max_iteracoes?: number }
        Returns: {
          atribuidos: number
          restantes: number
          sem_corretor_elegivel: boolean
        }[]
      }
      enqueue_lead_ia: {
        Args: {
          _ai_score: number
          _imobiliaria_id: string
          _payload: Json
          _source: string
          _source_ref: string
        }
        Returns: string
      }
      expire_webhook_secrets: { Args: never; Returns: number }
      find_dedup_groups_by_phone: {
        Args: { _limit?: number; _offset?: number }
        Returns: {
          registros: Json
          telefone_e164: string
          total: number
        }[]
      }
      gen_secure_token: { Args: never; Returns: string }
      get_ai_usage_count: {
        Args: { _function_name: string; _user_id: string }
        Returns: number
      }
      get_followup_counts: {
        Args: { _include_inactive?: boolean; _sem_contato_days?: number }
        Returns: {
          atrasados: number
          hoje: number
          sem_contato: number
          semana: number
        }[]
      }
      get_master_user_id: { Args: never; Returns: string }
      get_user_imobiliaria_id: { Args: never; Returns: string }
      ignore_dedup_group: { Args: { _telefone_e164: string }; Returns: number }
      increment_firecrawl_cache_hit: {
        Args: { p_cache_key: string }
        Returns: undefined
      }
      introspect_table_columns: {
        Args: { _table: string }
        Returns: {
          column_name: string
        }[]
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_lista_proprietario_retention_exception: {
        Args: { _row_id: string }
        Returns: boolean
      }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      leads_ativos_por_corretor: {
        Args: { _imobiliaria_id: string }
        Returns: {
          ativos: number
          capacidade_livre: number
          corretor_id: string
          limite: number
          nome: string
          status: string
        }[]
      }
      lgpd_localizar_registros_titular: {
        Args: { _documento: string; _email: string; _telefone: string }
        Returns: {
          criado_em: string
          fonte: string
          imobiliaria_id: string
          lista_proprietario_id: string
          titulo: string
        }[]
      }
      lgpd_metricas_imobiliaria: {
        Args: { _imobiliaria_id: string }
        Returns: {
          atendidas: number
          pendentes: number
          proximas_do_prazo: number
          total_recebidas: number
          vencidas: number
        }[]
      }
      list_retention_exceptions: {
        Args: never
        Returns: {
          acao: string
          criterio: string
          entidade: string
          exemplo: Json
          justificativa: string
          nome: string
        }[]
      }
      log_rls_denied_attempt: {
        Args: {
          _action: string
          _correlation_id?: string
          _metadata?: Json
          _reason?: string
          _record_id?: string
          _table_name: string
          _tenant_id?: string
        }
        Returns: string
      }
      log_service_role_call: {
        Args: {
          _action: string
          _actor_user_id?: string
          _correlation_id?: string
          _edge_function: string
          _metadata?: Json
          _outcome?: string
          _reason?: string
          _record_id?: string
          _request_ip?: string
          _table_name?: string
          _tenant_id?: string
          _user_agent?: string
        }
        Returns: string
      }
      merge_dedup_group: {
        Args: { _duplicate_ids: string[]; _master_id: string }
        Returns: Json
      }
      migrar_avaliacoes_link: {
        Args: never
        Returns: {
          para_carteira: number
          para_manual: number
          total: number
        }[]
      }
      normalize_phone: { Args: { p: string }; Returns: string }
      normalize_phone_digits: { Args: { p: string }; Returns: string }
      normalize_phone_e164: { Args: { _raw: string }; Returns: string }
      normalize_reference_url: { Args: { raw: string }; Returns: string }
      owns_contrato_file: { Args: { file_path: string }; Returns: boolean }
      owns_corretor: { Args: { _corretor_id: string }; Returns: boolean }
      pick_corretor_para_captacao: {
        Args: { p_bairro: string; p_cidade: string; p_imobiliaria_id: string }
        Returns: string
      }
      pipeline_estagios_reorder: {
        Args: { p_slugs: string[] }
        Returns: undefined
      }
      pipeline_estagios_seed_defaults: {
        Args: never
        Returns: {
          ativo: boolean
          color: string
          created_at: string
          id: string
          imobiliaria_id: string
          is_sistema: boolean
          ordem: number
          sistema_tipo: string | null
          slug: string
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "pipeline_estagios"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      plano_limite: {
        Args: { _plano: string; _recurso: string }
        Returns: number
      }
      pode_aprovar_captacao: {
        Args: { _imobiliaria_id: string; _user_id: string }
        Returns: boolean
      }
      process_proprietario_lembretes_datas: {
        Args: never
        Returns: {
          imobiliaria_id: string
          lembretes_criados: number
        }[]
      }
      processar_captacao_followups: { Args: never; Returns: Json }
      recalcular_fontes_lead: {
        Args: {
          p_imobiliaria_id: string
          p_lead_id: string
          p_lead_tipo: string
        }
        Returns: undefined
      }
      recalcular_motivacao_proprietarios: {
        Args: { _imobiliaria_id?: string }
        Returns: number
      }
      record_retention_simulation: {
        Args: {
          _duracao_ms: number
          _parametros: Json
          _politicas_count: number
          _resultados: Json
          _tenants_impactados: number
          _total_protegidos: number
          _total_removidos: number
        }
        Returns: string
      }
      register_whatsapp_contato_captacao: {
        Args: { p_lista_id: string; p_mensagem?: string }
        Returns: Json
      }
      resolve_webhook_alert: {
        Args: { _alert_id: string; _note?: string }
        Returns: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          created_at: string
          details: Json
          id: string
          imobiliaria_id: string
          message: string
          metric_value: number
          provider: string
          request_id: string | null
          resolution_note: string | null
          resolution_source: string | null
          resolved_at: string | null
          resolved_by: string | null
          sample_size: number
          severity: string
          threshold: number
          updated_at: string
          window_seconds: number
        }
        SetofOptions: {
          from: "*"
          to: "webhook_alerts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rest_rebuild: { Args: { host: string; path: string }; Returns: string }
      restore_deleted_backup: { Args: { _backup_id: string }; Returns: boolean }
      rotate_webhook_secret: {
        Args: {
          _grace_period_hours?: number
          _label?: string
          _new_secret: string
          _provider: string
        }
        Returns: {
          new_id: string
          new_version: number
          previous_expires_at: string
        }[]
      }
      rz_mesclar_dados_complementares: {
        Args: { _pipeline_id: string }
        Returns: Json
      }
      rz_mesclar_dados_complementares_internal: {
        Args: { _imob: string; _pipeline_id: string }
        Returns: undefined
      }
      rz_min_score_principal: { Args: { _imob: string }; Returns: number }
      rz_norm: { Args: { _s: string }; Returns: string }
      rz_reprocessar_scores: { Args: { _imob: string }; Returns: Json }
      seed_automacao_followup_defaults: {
        Args: { _imob: string }
        Returns: number
      }
      set_sw_cleanup_disabled: {
        Args: { _disabled: boolean; _reason?: string; _tenant_id: string }
        Returns: {
          changed_at: string
          changed_by: string
          disabled: boolean
          tenant_id: string
        }[]
      }
      simulate_data_retention_policies: {
        Args: {
          _webhook_daily_retention_days?: number
          _webhook_raw_retention_days?: number
        }
        Returns: {
          criterio: string
          entidade: string
          exemplos: Json
          politica: string
          protegidos: number
          quantidade: number
          simulated_at: string
          tenant_id: string
        }[]
      }
      unaccent: { Args: { "": string }; Returns: string }
      wa_processar_optout_keyword: {
        Args: {
          p_imobiliaria_id: string
          p_mensagem: string
          p_telefone: string
        }
        Returns: boolean
      }
      webhook_metrics_hourly_refresh: {
        Args: { _since_hours?: number }
        Returns: number
      }
      webhook_metrics_retention: {
        Args: { _daily_retention_days?: number; _raw_retention_days?: number }
        Returns: {
          deleted_daily: number
          deleted_raw: number
          rollup_rows: number
        }[]
      }
    }
    Enums: {
      captacao_pipeline_estagio:
        | "Prospectado"
        | "Contactado"
        | "Interessado"
        | "Avaliacao Enviada"
        | "Autorizacao"
        | "Contrato Assinado"
        | "Perdido"
      extraction_status: "pending" | "completed" | "incomplete" | "failed"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      captacao_pipeline_estagio: [
        "Prospectado",
        "Contactado",
        "Interessado",
        "Avaliacao Enviada",
        "Autorizacao",
        "Contrato Assinado",
        "Perdido",
      ],
      extraction_status: ["pending", "completed", "incomplete", "failed"],
    },
  },
} as const
