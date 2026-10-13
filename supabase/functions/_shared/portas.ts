/**
 * CONTRATO entre as Edge Functions e a base de dados: as RPC que as funções chamam, com os nomes exatos dos
 * argumentos (PostgREST chama-as por nome) e as formas JSON exatas que devolvem. A implementação SQL segue
 * este ficheiro; as funções só falam com a base de dados através de PortaBD (serviço) e PortaUtilizador
 * (JWT do utilizador).
 *
 * Convenções (valem para todas as RPC):
 * - Datas e horas: texto ISO 8601 com fuso (timestamptz → '2026-10-13T10:00:00+00:00' ou '…Z'); dias: 'AAAA-MM-DD'.
 * - Dinheiro: inteiros em cêntimos (`*_centimos`); IVA por linha = round(valor × taxa / 100).
 * - Erros: `raise exception … using errcode = …` com mensagem em PT-PT pensada para o utilizador:
 *     '42501' sem permissão (não é o dono, não é família, conta anónima…) → HTTP 403
 *     '22023' pedido inválido ou regra de negócio (plano, NIF, compromisso…) → HTTP 400/409
 *     'P0002' não encontrado → HTTP 404
 *   Qualquer outro código é tratado como erro interno e a mensagem NÃO chega ao utilizador.
 * - Todas as `servico_*`: EXECUTE só para service_role (revogado de public, anon, authenticated), SECURITY
 *   DEFINER, search_path = '', e `private.exigir_servico()` como defesa em profundidade. As de lote excluem
 *   sempre a demonstração; as de contexto devolvem `demonstracao` e a função recusa-a em modo produção.
 * - Idempotência: cada função de serviço pode ser chamada duas vezes com os mesmos argumentos sem efeito
 *   duplicado (o webhook e as tarefas agendadas repetem-se).
 *
 * Nomes novos face ao brief (faturacao-brief.md) e ao v1 (plano-faturacao.md) estão marcados com «NOVO» ou
 * «REFINADO»; o relatório do agente lista-os.
 */

// ————————————————————————————————————————————————————————————— enumerados

export type PlanoFamiliaId = 'acesso_30' | 'acesso_90'
export type PlanoInstituicao = 'por_entrada' | 'mensal'
export type Natureza = 'ipss' | 'misericordia' | 'privado'
export type RegiaoFiscal = 'continente' | 'madeira' | 'acores'
export type TaxaIvaPercent = 23 | 22 | 16

/** pagamentos_familia.metodo (nomes do Stripe) */
export type MetodoFamilia = 'card' | 'mb_way' | 'multibanco'
export type EstadoPagamentoFamilia = 'pendente' | 'a_aguardar_pagamento' | 'pago' | 'falhou' | 'expirado' | 'reembolsado'

export type EstadoSubscricao = 'incompleta' | 'ativa' | 'em_atraso' | 'cancelada'

export type EstadoFatura = 'rascunho' | 'emitida' | 'em_processamento' | 'paga' | 'falhou' | 'anulada'
/** «NOVO» faturas.origem: cobrança mensal das entradas (v1) ou fatura de subscrição do Stripe */
export type OrigemFatura = 'entradas' | 'subscricao'
export type Cobranca = 'debito_automatico' | 'pagamento_por_link'
export type MetodoPagamentoB2B = 'sepa_debit' | 'card'
/** Método com que uma fatura foi efetivamente paga (alimenta o meio de pagamento do recibo). */
export type MetodoPago = 'sepa_debit' | 'card' | 'customer_balance'

export type TipoDocumentoFiscal = 'FT' | 'FR' | 'RC' | 'NC'
export type EstadoDocumentoFiscal = 'pendente' | 'emitido' | 'erro' | 'anulado'
export type ModoDocumento = 'fatura_por_entrada' | 'fatura_mensal' | 'fatura_recibo_mensal'
/** «NOVO» documentos_fiscais.emissor: quem emitiu (o emissor falso só existe com STRIPE_MODO=teste) */
export type EmissorDocumento = 'moloni' | 'falso'

export type EstadoContestacao = 'aberta' | 'aceite' | 'rejeitada' | 'retirada'
export type EstadoFaturacaoEntrada =
  | 'por_confirmar'
  | 'isenta'
  | 'incluida'
  | 'faturada'
  | 'fora_janela'
  | 'dispensada'
  | 'contestada'
  | 'faturavel'
  | 'a_aguardar'

/**
 * Motivo de falha normalizado (faturas.motivo_falha, pagamentos_familia.motivo_falha). Nunca a mensagem do
 * Stripe: a interface mostra o texto de MOTIVOS_FALHA (stripe/motivos.ts).
 */
export type MotivoFalha =
  | 'saldo_insuficiente'
  | 'mandato_revogado'
  | 'cartao_recusado'
  | 'cartao_expirado'
  | 'autenticacao_falhou'
  | 'referencia_expirada'
  | 'pagamento_cancelado'
  | 'outro'

export type FaseExecucao = 'diario' | 'cobranca'

// ————————————————————————————————————————————————————————————— formas JSON partilhadas

/** Dados fiscais de um lar (dados_faturacao) — snapshot em faturas.cliente / documentos_fiscais.cliente. */
export interface DadosFiscaisRpc {
  razao_social: string
  nif: string
  morada: string
  codigo_postal: string
  localidade: string
  email: string
}

/** Cliente de um documento fiscal (snapshot no momento da emissão). */
export type ClienteDocumentoRpc =
  | ({ tipo: 'empresa'; pais: 'PT' } & DadosFiscaisRpc)
  /** família que indicou NIF (e, opcionalmente, nome) para a Fatura-Recibo */
  | { tipo: 'particular'; nif: string; nome: string | null }
  /** família sem NIF: "Consumidor final" */
  | { tipo: 'consumidor_final' }

/** Linha estruturada de um documento: a descrição é construída em TypeScript (documentos.ts), sem dados pessoais. */
export type LinhaDocumentoRpc =
  | { tipo: 'entrada'; referencia: string; entrada_data: string; valor_centimos: number; iva_percent: TaxaIvaPercent }
  | { tipo: 'mensalidade'; periodo_inicio: string; periodo_fim: string; valor_centimos: number; iva_percent: TaxaIvaPercent }
  /** valor_centimos COM IVA incluído (B2C) */
  | { tipo: 'acesso'; plano: PlanoFamiliaId; valor_centimos: number; iva_percent: TaxaIvaPercent }

/** Pagamento que um FR ou RC documenta. */
export interface PagamentoDocumentoRpc {
  metodo: MetodoPago | MetodoFamilia
  /** 'AAAA-MM-DD' (Lisboa) */
  data: string
  valor_centimos: number
}

/**
 * Documento na fila (outbox) pronto a emitir: devolvido por servico_documentos_pendentes.
 * Chaves (documentos_fiscais.chave, únicas) — ver chaveDocumento() em documentos.ts:
 *   FT:<candidatura_id>        FT por entrada (modo fatura_por_entrada)
 *   FT:<fatura_id>             FT mensal global (modo fatura_mensal)
 *   FT:sub:<stripe_invoice_id> FT da mensalidade (subscrição)
 *   RC:<fatura_id>             recibo de uma fatura paga (todas as FT dessa fatura)
 *   FR:<fatura_id>             fatura-recibo mensal (modo fatura_recibo_mensal)
 *   FR:pag:<pagamento_id>      fatura-recibo de uma compra do Acesso Família
 */
export interface DocumentoPendenteRpc {
  id: string
  tipo: TipoDocumentoFiscal
  chave: string
  tentativas: number
  /** «REFINADO» de onde vem: entradas de um lar, subscrição, compra de uma família */
  origem: 'entradas' | 'subscricao' | 'acesso'
  instituicao_id: string | null
  /** «NOVO» documentos_fiscais.user_id/pagamento_id: só nos FR das famílias (o dono lê o seu) */
  user_id: string | null
  pagamento_id: string | null
  fatura_id: string | null
  /** data do documento 'AAAA-MM-DD' (Lisboa) */
  data: string
  /** vencimento 'AAAA-MM-DD' (FT); null em FR/RC */
  vencimento: string | null
  cliente: ClienteDocumentoRpc
  /** FT/FR/NC: as linhas; RC: [] */
  linhas: LinhaDocumentoRpc[]
  /** FR e RC: o pagamento; FT: null */
  pagamento: PagamentoDocumentoRpc | null
  /**
   * RC: os documentos que o recibo liquida, já emitidos (um RC só fica pendente depois de todas as suas FT
   * estarem `emitido`). Outros tipos: [].
   */
  documentos_associados: { documento_id: string; externo_id: string; numero: string; total_centimos: number }[]
  /** total esperado (com IVA): o emissor tem de chegar exatamente a este valor */
  total_centimos: number
  /**
   * IVA esperado. B2B: soma de round(valor × taxa / 100) por linha. FR do Acesso Família (preço com IVA):
   * valor − n, onde n é o ÚNICO líquido com n + round(n × 0,23) = valor (1490 → 279; 2990 → 559) — ver
   * separarIvaIncluido em faturacao/dinheiro.ts.
   */
  iva_centimos: number
  /** sempre false (servico_documentos_pendentes exclui demonstração); a função recusa se vier true com o Moloni */
  demonstracao: boolean
}

// ————————————————————————————————————————————————————————————— operações do webhook (servico_evento_aplicar)

/**
 * Vocabulário de operações que o TypeScript constrói a partir de um evento do Stripe (stripe/eventos.ts) e
 * que servico_evento_aplicar aplica atomicamente, por ordem, numa transação. Regras:
 * - cada operação é idempotente (reaplicar não muda nada);
 * - transições de estado inválidas são ignoradas (não falham), como em private.transicao_fatura_permitida;
 * - referências desconhecidas (ex.: um payment_intent que não é de nenhuma família) são ignoradas;
 * - o cliente Stripe resolve-se por dados_faturacao.stripe_customer_id (autoritativo); `instituicao_id` vindo
 *   de metadata só é comparado (divergência = registo para a equipa, sem aplicar).
 */
export type OperacaoEvento =
  // ——— v1: lares (por entrada)
  | {
      op: 'fatura_estado'
      stripe_invoice_id: string
      /** metadata.fatura_id (cobranças criadas por nós); recurso quando o finalized chega antes de servico_cobranca_criada */
      fatura_id: string | null
      /** «NOVO» 'subscricao' cria a linha em faturas (se não existir) ligada à subscrição */
      origem: OrigemFatura
      estado: Exclude<EstadoFatura, 'rascunho'>
      em: string
      url: string | null
      numero: string | null
      motivo: MotivoFalha | null
      metodo: MetodoPago | null
      /** total cobrado pelo Stripe; a BD compara com o seu (subscrição: 2900 + IVA do contrato) */
      total_centimos: number | null
      /**
       * «NOVO» só origem 'subscricao'; período inclusivo (dias de Lisboa). A primeira fatura de uma subscrição
       * pode chegar ANTES de servico_subscricao_registar/subscricao_estado: se a subscrição ainda não for
       * conhecida, a BD liga-a ao lar de instituicao_id (metadata da subscrição) com estado 'incompleta'.
       * Em payment_intent.processing a origem vem sempre 'entradas' e só atualiza faturas já conhecidas.
       */
      subscricao: { stripe_subscription_id: string; instituicao_id: string | null; periodo_inicio: string; periodo_fim: string } | null
    }
  | {
      op: 'metodo_definido'
      stripe_customer_id: string
      instituicao_id: string | null
      payment_method_id: string
      tipo: MetodoPagamentoB2B
      ultimos4: string
      banco: string | null
      /** cartão: 'MM/AAAA' */
      validade: string | null
      mandato_ref: string | null
    }
  | { op: 'metodo_removido'; stripe_customer_id: string | null; payment_method_id: string }
  | {
      op: 'disputa'
      stripe_customer_id: string | null
      payment_intent_id: string | null
      charge_id: string
      /** código do Stripe (interno, para a equipa) */
      motivo: string
      valor_centimos: number
    }
  // ——— «NOVO» famílias (Acesso Família). O pagamento resolve-se por stripe_checkout_session_id; se a sessão
  //     nunca chegou a ser registada (falha entre o Stripe e servico_acesso_sessao_criada), por pagamento_id.
  | {
      /** estado 'pago', private.estender_acesso(user_id, plano) e documento FR:pag:<id> pendente (cliente: NIF/nome
       *  do pagamento ou consumidor final; linha 'acesso' com o valor COM IVA e iva_percent 23). Idempotente: um
       *  pagamento já 'pago' não estende duas vezes. estender_acesso = novoAte() do protótipo:
       *  ate = greatest(ate_atual, now()) + dias * interval '24 hours' (horas exatas, não dias de calendário). */
      op: 'acesso_pago'
      session_id: string
      pagamento_id: string | null
      payment_intent_id: string | null
      metodo: MetodoFamilia | null
      /** amount_total da sessão; a BD recusa (exceção → o evento repete) se diferir de valor_centimos */
      valor_centimos: number
      pago_em: string
    }
  | {
      /** Multibanco: estado 'a_aguardar_pagamento' com entidade/referência para a página /acesso */
      op: 'acesso_a_aguardar'
      session_id: string
      pagamento_id: string | null
      payment_intent_id: string | null
      metodo: MetodoFamilia | null
      entidade: string | null
      referencia: string | null
      expira_em: string | null
    }
  | { op: 'acesso_falhou'; session_id: string; pagamento_id: string | null; motivo: MotivoFalha }
  | { op: 'acesso_expirado'; session_id: string; pagamento_id: string | null }
  | {
      /** NÃO encurta o acesso: marca 'reembolsado' (se total) e avisa a equipa. PIs desconhecidos: ignorado. */
      op: 'acesso_reembolsado'
      payment_intent_id: string
      valor_reembolsado_centimos: number
      total: boolean
      em: string
    }
  // ——— «NOVO» lares com mensalidade
  | {
      op: 'subscricao_estado'
      stripe_subscription_id: string
      stripe_customer_id: string | null
      /** metadata.instituicao_id: cria a linha em subscricoes_instituicao se ainda não existir */
      instituicao_id: string | null
      estado: EstadoSubscricao
      inicio: string | null
      cancelada_em: string | null
    }

// ————————————————————————————————————————————————————————————— resultados das RPC de serviço

/** servico_contexto_instituicao (v1, «REFINADO» com natureza/plano/iva/demonstracao) */
export interface ContextoInstituicaoRpc {
  instituicao_id: string
  natureza: Natureza
  demonstracao: boolean
  plano: PlanoInstituicao | null
  dados: DadosFiscaisRpc | null
  contrato: {
    referencia: string
    taxa_entrada_centimos: number
    iva_percent: TaxaIvaPercent
    regiao_fiscal: RegiaoFiscal
  } | null
  /** taxa de IVA em vigor para o lar (contrato; sem contrato, a região fiscal do código postal) */
  iva_percent: TaxaIvaPercent
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  tem_metodo: boolean
}

/** servico_subscricao_contexto (brief, «REFINADO»: + natureza, demonstracao, iva_percent, payment method e subscrição) */
export interface ContextoSubscricaoRpc {
  instituicao_id: string
  natureza: Natureza
  demonstracao: boolean
  plano: PlanoInstituicao | null
  plano_desde: string | null
  /** private.compromisso_ate(natureza, plano, plano_desde) */
  compromisso_ate: string | null
  stripe_customer_id: string | null
  stripe_payment_method_id: string | null
  tem_metodo: boolean
  iva_percent: TaxaIvaPercent
  subscricao: { stripe_subscription_id: string; estado: EstadoSubscricao; inicio: string | null; compromisso_ate: string | null } | null
}

/** servico_acesso_iniciar («REFINADO»: + demonstracao) */
export interface AcessoIniciadoRpc {
  pagamento_id: string
  /** tem de ser igual a PLANOS_FAMILIA[plano].precoCentimos (a função confirma) */
  valor_centimos: number
  plano: PlanoFamiliaId
  dias: number
  /** conta de demonstração: nunca vai ao Stripe em modo produção */
  demonstracao: boolean
}

/**
 * servico_preparar_cobrancas (v1): uma fatura `rascunho` (origem 'entradas') por lar com linhas faturadas no
 * mês, SEM stripe_invoice_id. Retoma: com as mesmas chaves de idempotência (24 h) o Stripe devolve a mesma
 * fatura; e o invoice.finalized traz metadata.fatura_id, que liga a fatura mesmo que a função tenha caído antes
 * de servico_cobranca_criada — a partir daí deixa de ser devolvida aqui.
 */
export interface CobrancaPreparadaRpc {
  fatura_id: string
  instituicao_id: string
  /** 'AAAA-MM-01' */
  periodo: string
  stripe_customer_id: string
  /** null → cobrança por link (send_invoice) */
  stripe_payment_method_id: string | null
  linhas: {
    referencia: string
    entrada_data: string
    valor_centimos: number
    iva_percent: TaxaIvaPercent
    iva_centimos: number
    /** número da FT da entrada (modo fatura_por_entrada) */
    documento_numero: string | null
  }[]
  subtotal_centimos: number
  iva_centimos: number
  total_centimos: number
}

/** servico_cobrancas_a_debitar (v1): faturas `emitida` com debito_em <= p_agora e cobrança automática */
export interface CobrancaADebitarRpc {
  fatura_id: string
  instituicao_id: string
  stripe_invoice_id: string
  total_centimos: number
  debito_em: string
  tentativas: number
}

/** «NOVO» servico_subscricoes_a_sincronizar: reconciliação diária BD ↔ Stripe */
export interface SubscricaoASincronizarRpc {
  instituicao_id: string
  /** criar: plano 'mensal' sem subscrição ativa (e com método); cancelar: plano 'por_entrada' com subscrição ativa */
  acao: 'criar' | 'cancelar'
  stripe_subscription_id: string | null
}

/** «NOVO» servico_documento_externo: para faturacao-documento obter o id no emissor depois de o RLS provar a posse */
export interface DocumentoExternoRpc {
  id: string
  tipo: TipoDocumentoFiscal
  numero: string
  externo_id: string
  emissor: EmissorDocumento
}

// ————————————————————————————————————————————————————————————— RPC de serviço (service_role)

export interface RpcServico {
  // ——— execuções das tarefas agendadas (v1)
  /** Arrenda a fase por p_duracao_segundos; false se outra execução a tem. */
  servico_iniciar_execucao: { args: { p_fase: FaseExecucao; p_duracao_segundos: number }; resultado: boolean }
  /** Liberta o arrendamento e guarda o resumo (sem dados pessoais). */
  servico_terminar_execucao: { args: { p_fase: FaseExecucao; p_resumo: Record<string, unknown> }; resultado: null }

  // ——— lares: contexto e cliente Stripe (v1)
  /**
   * null se não existir. Devolve `demonstracao` em vez de a excluir: em modo teste uma instituição de
   * demonstração pode usar o Stripe de teste; em produção a função recusa-a. (As funções em lote —
   * reservar/pendentes/preparar/a_debitar/a_sincronizar — excluem sempre a demonstração.)
   */
  servico_contexto_instituicao:{ args: { p_instituicao_id: string }; resultado: ContextoInstituicaoRpc | null }
  /** Guarda o customer só se ainda não houver; devolve o que ficou guardado (pode ser outro: apagar o duplicado). */
  servico_definir_cliente_stripe: { args: { p_instituicao_id: string; p_customer_id: string }; resultado: string }

  // ——— documentos fiscais (outbox, v1)
  /** Numa transação: linhas novas em fatura_linhas para as entradas `faturavel` e FT pendentes (modo por entrada). */
  servico_reservar_documentos: { args: { p_modo: ModoDocumento; p_agora: string; p_limite: number }; resultado: { reservados: number } }
  /** «REFINADO» (+ p_agora): pendentes ou em erro com proxima_tentativa_em <= p_agora; FT antes de RC. */
  servico_documentos_pendentes: { args: { p_agora: string; p_limite: number }; resultado: DocumentoPendenteRpc[] }
  /**
   * «REFINADO» (+ p_iva_centimos, p_emissor; moloni id → p_externo_id texto): marca `emitido`. Exceção se o total
   * ou o IVA diferirem dos esperados. Notifica "Fatura emitida" (lares) e liga o FR ao pagamento (famílias).
   */
  servico_documento_emitido: {
    args: {
      p_id: string
      p_externo_id: string
      p_numero: string
      p_total_centimos: number
      p_iva_centimos: number
      p_emitido_em: string
      p_emissor: EmissorDocumento
    }
    resultado: null
  }
  /** tentativas + 1, estado `erro`, proxima_tentativa_em com recuo exponencial; p_erro sem dados pessoais (≤ 500). */
  servico_documento_falhou: { args: { p_id: string; p_erro: string }; resultado: null }
  /** «NOVO» só documentos `emitido` */
  servico_documento_externo: { args: { p_id: string }; resultado: DocumentoExternoRpc | null }

  // ——— cobranças mensais por entrada (v1)
  /** «REFINADO» (+ p_limite): lotes de no máximo p_limite lares. */
  servico_preparar_cobrancas: { args: { p_modo: ModoDocumento; p_agora: string; p_limite: number }; resultado: CobrancaPreparadaRpc[] }
  servico_cobranca_criada: {
    args: {
      p_fatura_id: string
      p_stripe_invoice_id: string
      p_numero: string | null
      p_url: string | null
      p_cobranca: Cobranca
      p_debito_em: string | null
    }
    resultado: null
  }
  /** «REFINADO» (+ p_limite) */
  servico_cobrancas_a_debitar: { args: { p_agora: string; p_limite: number }; resultado: CobrancaADebitarRpc[] }
  /**
   * «NOVO» resultado imediato de invoices.pay na tarefa diária (SEPA → em_processamento; cartão → paga/falhou),
   * para não voltar a debitar antes de o webhook chegar. Mesmas transições e efeitos que fatura_estado.
   */
  servico_cobranca_debito_iniciado: {
    args: { p_fatura_id: string; p_estado: 'em_processamento' | 'paga' | 'falhou'; p_motivo: MotivoFalha | null; p_em: string }
    resultado: null
  }

  // ——— webhook do Stripe (v1)
  /** 'repetido' só se o evento já foi aplicado (processado_em); um evento que falhou volta a ser 'novo'. */
  servico_evento_iniciar: { args: { p_id: string; p_tipo: string; p_livemode: boolean; p_criado_em: string }; resultado: 'novo' | 'repetido' }
  /** Aplica as operações e carimba processado_em, só se ainda for null. true = aplicou agora. */
  servico_evento_aplicar: { args: { p_id: string; p_operacoes: OperacaoEvento[] }; resultado: boolean }
  servico_evento_falhou: { args: { p_id: string; p_erro: string }; resultado: null }

  // ——— Acesso Família (brief)
  /**
   * Valida: utilizador existe, perfis_utilizador.role = 'familia', não anónimo ('42501' "O Acesso Família é para
   * contas de família."); plano conhecido ('22023'); p_texto_versao não vazio; NIF (se vier) válido para B2C
   * ('22023'); 999999990 = sem NIF. Regista consentimentos_acesso (texto_versao, aceite_em = now(), ip_truncado)
   * e pagamentos_familia `pendente` (valor e dias do plano; fatura_nif/fatura_nome «NOVO»).
   */
  servico_acesso_iniciar: {
    args: {
      p_user_id: string
      p_plano: PlanoFamiliaId
      p_texto_versao: string
      /** já truncado pela função (IPv4 /24, IPv6 /48) ou null */
      p_ip: string | null
      /** «NOVO» NIF para a Fatura-Recibo (opcional; nunca vai ao Stripe) */
      p_nif: string | null
      /** «NOVO» nome para a Fatura-Recibo (opcional, só com NIF) */
      p_nome_fiscal: string | null
    }
    resultado: AcessoIniciadoRpc
  }
  /** Liga a sessão do Checkout ao pagamento (só se ainda `pendente` e sem sessão). */
  servico_acesso_sessao_criada: { args: { p_pagamento_id: string; p_session_id: string }; resultado: null }

  // ——— mensalidade dos lares (brief)
  servico_subscricao_contexto: { args: { p_instituicao_id: string }; resultado: ContextoSubscricaoRpc | null }
  /**
   * «NOVO» regista a subscrição criada/cancelada pela função plano-instituicao (antes do webhook chegar), para
   * não criar duas. inicio/compromisso_ate: plano_desde e private.compromisso_ate. Idempotente.
   */
  servico_subscricao_registar: {
    args: { p_instituicao_id: string; p_stripe_subscription_id: string; p_estado: EstadoSubscricao; p_inicio: string | null }
    resultado: null
  }
  /** «NOVO» lares cuja modalidade e subscrição divergem (exclui demonstração), até p_limite */
  servico_subscricoes_a_sincronizar: { args: { p_limite: number }; resultado: SubscricaoASincronizarRpc[] }

  // ——— equipa (v1): o administrador decide uma contestação (corre como postgres no editor SQL ou service_role)
  resolver_contestacao: {
    args: { p_candidatura_id: string; p_decisao: 'aceite' | 'rejeitada'; p_nota: string | null }
    resultado: { candidatura_id: string; estado: EstadoContestacao; resolvida_em: string }
  }
}

// ————————————————————————————————————————————————————————————— RPC do utilizador (JWT, authenticated)

/** faturacao_resumo() — v1 «REFINADO» com plano, subscrição e faturas de subscrição. Só o dono (42501). */
export interface ResumoFaturacaoRpc {
  instituicao_id: string
  /** IPSS/Misericórdia: true e o resto vazio */
  isenta: boolean
  agora: string
  plano: PlanoInstituicao | null
  plano_desde: string | null
  compromisso_ate: string | null
  subscricao: { estado: EstadoSubscricao; inicio: string | null; compromisso_ate: string | null } | null
  contrato: {
    referencia: string
    taxa_entrada_centimos: number
    iva_percent: TaxaIvaPercent
    regiao_fiscal: RegiaoFiscal
    inicio: string
    fim: string | null
  } | null
  dados: (DadosFiscaisRpc & { atualizado_em: string }) | null
  metodo: { tipo: MetodoPagamentoB2B; ultimos4: string; banco: string | null; validade: string | null; mandato_ref: string | null; atualizado_em: string } | null
  proxima: {
    data: string
    debito_em: string | null
    linhas: {
      candidatura_id: string | null
      referencia: string
      entrada_data: string
      valor_centimos: number
      iva_percent: TaxaIvaPercent
      iva_centimos: number
      total_centimos: number
      documento_numero: string | null
    }[]
    subtotal_centimos: number
    iva_centimos: number
    total_centimos: number
  }
  entradas: {
    candidatura_id: string
    estado: EstadoFaturacaoEntrada
    faturavel_desde: string | null
    contestavel_ate: string | null
    contestacao: { estado: EstadoContestacao; contestada_em: string; motivo: string; resolvida_em: string | null; nota: string | null } | null
    fatura_id: string | null
    documento_numero: string | null
  }[]
  faturas: {
    id: string
    origem: OrigemFatura
    periodo: string
    estado: Exclude<EstadoFatura, 'rascunho'>
    numero: string | null
    documentos: { id: string; tipo: TipoDocumentoFiscal; numero: string; emitido_em: string; total_centimos: number }[]
    subtotal_centimos: number
    iva_centimos: number
    total_centimos: number
    cobranca: Cobranca
    emitida_em: string | null
    debito_em: string | null
    paga_em: string | null
    falhou_em: string | null
    motivo_falha: MotivoFalha | null
    url_pagamento: string | null
  }[]
}

/** acesso_estado() — brief «REFINADO»: documento.id (para pedir o PDF a faturacao-documento) e motivo_falha. */
export interface AcessoEstadoRpc {
  completo: boolean
  ativo: boolean
  ate: string | null
  plano: PlanoFamiliaId | null
  pagamentos: {
    id: string
    plano: PlanoFamiliaId
    valor_centimos: number
    metodo: MetodoFamilia | null
    estado: EstadoPagamentoFamilia
    criado_em: string
    pago_em: string | null
    motivo_falha: MotivoFalha | null
    multibanco?: { entidade: string; referencia: string; expira_em: string | null }
    documento?: { id: string; numero: string; emitido_em: string }
  }[]
}

/** painel_instituicao() — existente (20261013100100_equipa_modalidade.sql) */
export interface PainelInstituicaoRpc {
  id: string
  publicado: boolean
  verificacao_estado: string
  visualizacoes_30d: number
  lista_espera_offline: number
  lista_espera_online: number
  plano: PlanoInstituicao | null
  plano_desde: string | null
  compromisso_ate: string | null
}

export interface RpcUtilizador {
  faturacao_resumo: { args: Record<string, never>; resultado: ResumoFaturacaoRpc }
  guardar_dados_faturacao: {
    args: { p_razao_social: string; p_nif: string; p_morada: string; p_codigo_postal: string; p_localidade: string; p_email: string }
    resultado: ResumoFaturacaoRpc['dados']
  }
  contestar_entrada: {
    args: { p_candidatura_id: string; p_motivo: string }
    resultado: { candidatura_id: string; estado: EstadoContestacao; contestada_em: string }
  }
  acesso_estado: { args: Record<string, never>; resultado: AcessoEstadoRpc }
  /** existente: devolve uma linha (setof) */
  painel_instituicao: { args: Record<string, never>; resultado: PainelInstituicaoRpc[] }
  /** existente: devolve uma linha (setof); 22023 com mensagemCompromisso() antes do fim do compromisso */
  escolher_plano_instituicao: {
    args: { p_plano: PlanoInstituicao }
    resultado: { instituicao_id: string; plano: PlanoInstituicao | null; plano_desde: string | null; compromisso_ate: string | null }[]
  }
}

// ————————————————————————————————————————————————————————————— portas

/** Erro de uma RPC (PostgREST): `codigo` é o SQLSTATE (ex.: '42501'), `mensagem` a do raise. */
export class ErroBD extends Error {
  constructor(
    readonly codigo: string | null,
    mensagem: string,
  ) {
    super(mensagem)
    this.name = 'ErroBD'
  }
}

/** Base de dados com a chave de serviço. O adaptador Deno chama supabase.rpc(nome, args) e lança ErroBD. */
export interface PortaBD {
  rpc<K extends keyof RpcServico>(nome: K, args: RpcServico[K]['args']): Promise<RpcServico[K]['resultado']>
}

export interface UtilizadorSessao {
  id: string
  email: string | null
  anonimo: boolean
}

/** Base de dados com o JWT do utilizador (RLS e auth.uid() aplicam-se). */
export interface PortaUtilizador {
  /** auth.getUser(jwt): null se o token não for válido */
  utilizador(): Promise<UtilizadorSessao | null>
  rpc<K extends keyof RpcUtilizador>(nome: K, args: RpcUtilizador[K]['args']): Promise<RpcUtilizador[K]['resultado']>
  /**
   * select id from documentos_fiscais where id = $1 (com RLS): true se o utilizador o pode ler. A política
   * de documentos_fiscais tem de deixar o lar ler os seus (instituicao_id) e a família os seus FR (user_id),
   * só quando estado = 'emitido'.
   */
  documentoVisivel(id: string): Promise<boolean>
}

/** Registo para os logs da função: só códigos e ids técnicos, nunca dados pessoais nem segredos. */
export interface Registo {
  info(evento: string, dados?: Record<string, unknown>): void
  erro(evento: string, dados?: Record<string, unknown>): void
}

export const registoSilencioso: Registo = { info: () => {}, erro: () => {} }
