-- =====================================================================================
-- EncontraLar — faturação na base de dados (Stripe + Moloni, decisões de 13/10/2026: docs/MODELO-NEGOCIO.md,
-- plano v1 e v2). Implementa o CONTRATO das Edge Functions, supabase/functions/_shared/portas.ts, com o
-- comportamento da implementação de referência (supabase/tests/funcoes/fakes.ts::BDFalsa). Os testes de
-- conformidade (supabase/tests/faturacao-conformidade.test.ts) correm os mesmos cenários nas duas e comparam.
--
-- Três fluxos de dinheiro:
--   1. Acesso Família (famílias): pagamentos_familia + consentimentos_acesso; a compra paga chama
--      private.estender_acesso (que já avisa a família) e põe na fila uma Fatura-Recibo (FR).
--   2. Lares privados por entrada: contratos (taxa por entrada, 150 € + IVA por omissão), dados_faturacao
--      (NIF, morada fiscal, cliente e método do Stripe), contestacoes_entrada, fatura_linhas (uma por entrada
--      faturável), faturas (cobrança mensal no Stripe) e documentos_fiscais (FT por entrada + RC quando paga).
--   3. Lares privados com mensalidade: subscricoes_instituicao; as faturas da subscrição (faturas.origem =
--      'subscricao') geram a FT da mensalidade e, quando pagas, o RC — pela mesma fila de documentos.
--
-- Regras transversais:
--   * RLS em todas as tabelas; os clientes NUNCA escrevem (só funções SECURITY DEFINER do servidor). O dono lê
--     as suas linhas sem as colunas stripe_*/moloni_*/externo_id; stripe_eventos e as tabelas private não têm
--     acesso de clientes.
--   * Estado de faturação de uma entrada (private.classificar_entrada), pela ordem de regras.ts: isenta e incluida
--     antes de faturada (nunca faturam), janela de atribuição de 12 meses e prazo de contestação de 14 dias em
--     hora de parede de Lisboa (datas.ts). IVA arredondado por linha (dinheiro.ts).
--   * Todas as servico_*: EXECUTE só para service_role, SECURITY DEFINER em private com invólucro SECURITY
--     INVOKER em public (a Data API não expõe private), private.exigir_servico() como defesa em profundidade.
--     As de lote excluem a demonstração; as de contexto devolvem `demonstracao` (a função recusa-a em produção).
--   * Idempotência: cada função de serviço pode repetir-se sem efeito duplicado (o webhook e o cron repetem).
--   * Nada de dados de saúde: as linhas e os documentos levam só a referência EL-XXXXXXXX e datas.
-- =====================================================================================

-- ————————————————————————————————————————————————————————————————— 1. tipos

create type public.estado_contestacao as enum ('aberta', 'aceite', 'rejeitada', 'retirada');
comment on type public.estado_contestacao is
  'Contestação de uma entrada confirmada só pela família: aberta, aceite (não se fatura), rejeitada (fatura-se) ou retirada (o lar registou a entrada).';

create type public.estado_fatura as enum ('rascunho', 'emitida', 'em_processamento', 'paga', 'falhou', 'anulada');
create type public.origem_fatura as enum ('entradas', 'subscricao');
create type public.cobranca_fatura as enum ('debito_automatico', 'pagamento_por_link');
create type public.modo_documento as enum ('fatura_por_entrada', 'fatura_mensal', 'fatura_recibo_mensal');
create type public.tipo_documento_fiscal as enum ('FT', 'FR', 'RC', 'NC');
create type public.estado_documento_fiscal as enum ('pendente', 'emitido', 'erro', 'anulado');
create type public.origem_documento as enum ('entradas', 'subscricao', 'acesso');
create type public.emissor_documento as enum ('moloni', 'falso');
create type public.regiao_fiscal as enum ('continente', 'madeira', 'acores');
create type public.metodo_pagamento_b2b as enum ('sepa_debit', 'card');
create type public.metodo_familia as enum ('card', 'mb_way', 'multibanco');
create type public.estado_pagamento_familia as enum ('pendente', 'a_aguardar_pagamento', 'pago', 'falhou', 'expirado', 'reembolsado');
create type public.estado_subscricao as enum ('incompleta', 'ativa', 'em_atraso', 'cancelada');
create type public.motivo_falha as enum (
  'saldo_insuficiente', 'mandato_revogado', 'cartao_recusado', 'cartao_expirado', 'autenticacao_falhou',
  'referencia_expirada', 'pagamento_cancelado', 'outro'
);
comment on type public.motivo_falha is
  'Motivo de falha normalizado (nunca a mensagem do Stripe): a interface mostra o texto de stripe/motivos.ts.';

-- NIF português válido para faturar: 9 algarismos, prefixo atribuído e dígito de controlo mod 11 (nif.ts).
-- 999999990 (consumidor final) não é um NIF de cliente: nas famílias quer dizer "sem NIF" (null).
-- Verificação em linha (só funções do sistema): as restrições correm com os privilégios de quem escreve.
create domain public.nif as text
  constraint nif_valido check (
    case
      when value !~ '^([123568][0-9]|45|7[0124579]|9[0189])[0-9]{7}$' or value = '999999990' then false
      else (case when (substr(value, 1, 1)::int * 9 + substr(value, 2, 1)::int * 8 + substr(value, 3, 1)::int * 7
                       + substr(value, 4, 1)::int * 6 + substr(value, 5, 1)::int * 5 + substr(value, 6, 1)::int * 4
                       + substr(value, 7, 1)::int * 3 + substr(value, 8, 1)::int * 2) % 11 < 2 then 0
                 else 11 - (substr(value, 1, 1)::int * 9 + substr(value, 2, 1)::int * 8 + substr(value, 3, 1)::int * 7
                            + substr(value, 4, 1)::int * 6 + substr(value, 5, 1)::int * 5 + substr(value, 6, 1)::int * 4
                            + substr(value, 7, 1)::int * 3 + substr(value, 8, 1)::int * 2) % 11
            end) = substr(value, 9, 1)::int
    end
  );
comment on domain public.nif is
  'NIF português (9 algarismos, prefixo atribuído, controlo mod 11), nunca o 999999990 de consumidor final.';

-- ————————————————————————————————————————————————————————————————— 2. tabelas dos lares (B2B)

-- Contrato de um lar privado: a taxa por entrada (150 € + IVA por omissão) e o IVA da região fiscal.
-- Escrito pela equipa (postgres, editor SQL). Sem sobreposição de períodos (trigger).
create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  instituicao_id text not null references public.instituicoes (id) on update cascade on delete restrict,
  referencia text not null unique check (referencia ~ '^[A-Z0-9][A-Z0-9-]{2,39}$'),
  taxa_entrada_centimos integer not null default 15000 check (taxa_entrada_centimos between 100 and 1000000),
  iva_percent smallint not null default 23 check (iva_percent in (23, 22, 16)),
  regiao_fiscal public.regiao_fiscal not null default 'continente',
  inicio date not null,
  fim date,
  notas text check (char_length(notas) <= 2000),
  criado_em timestamptz not null default now(),
  constraint contratos_periodo check (fim is null or fim >= inicio),
  constraint contratos_iva_da_regiao check (
    iva_percent = case regiao_fiscal when 'continente' then 23 when 'madeira' then 22 else 16 end
  )
);
comment on table public.contratos is
  'Contrato de um lar privado (taxa por entrada + IVA da região fiscal). O dono lê-o (sem as notas); só a equipa escreve.';
create index contratos_instituicao_idx on public.contratos (instituicao_id, inicio desc);

-- Dados fiscais do lar (o cliente das FT/RC) e o que o Stripe devolve. stripe_*/moloni_* nunca saem para o
-- navegador; do método de pagamento o dono vê só o resumo (tipo, últimos 4, banco, validade, mandato).
create table public.dados_faturacao (
  instituicao_id text primary key references public.instituicoes (id) on update cascade on delete restrict,
  razao_social text not null check (char_length(btrim(razao_social)) between 2 and 200),
  nif public.nif not null,
  morada text not null check (char_length(btrim(morada)) between 3 and 200),
  codigo_postal text not null check (codigo_postal ~ '^[0-9]{4}-[0-9]{3}$'),
  localidade text not null check (char_length(btrim(localidade)) between 1 and 120),
  email text not null check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(email) <= 254),
  stripe_customer_id text unique check (stripe_customer_id ~ '^cus_[A-Za-z0-9_]+$' and char_length(stripe_customer_id) <= 255),
  stripe_payment_method_id text check (stripe_payment_method_id ~ '^pm_[A-Za-z0-9_]+$' and char_length(stripe_payment_method_id) <= 255),
  moloni_cliente_id text check (char_length(moloni_cliente_id) between 1 and 40),
  metodo_tipo public.metodo_pagamento_b2b,
  metodo_ultimos4 text check (metodo_ultimos4 ~ '^[0-9]{4}$'),
  metodo_banco text check (char_length(metodo_banco) <= 120),
  metodo_validade text check (metodo_validade ~ '^(0[1-9]|1[0-2])/[0-9]{4}$'),
  metodo_mandato_ref text check (char_length(metodo_mandato_ref) <= 120),
  metodo_atualizado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint dados_faturacao_metodo_coerente check (
    (metodo_tipo is null) = (metodo_ultimos4 is null)
    and (metodo_tipo is null) = (stripe_payment_method_id is null)
    and (metodo_tipo is null) = (metodo_atualizado_em is null)
  )
);
comment on table public.dados_faturacao is
  'Dados fiscais de um lar privado (guardar_dados_faturacao) e as referências do Stripe/Moloni (só servidor). O dono lê-os sem stripe_*/moloni_*.';

-- Contestação de uma entrada confirmada só pela família (tabela própria: a família lê candidaturas e o
-- histórico, e não deve ver o motivo do lar). Sem linha em candidatura_eventos.
create table public.contestacoes_entrada (
  candidatura_id uuid primary key references public.candidaturas (id) on delete cascade,
  instituicao_id text not null references public.instituicoes (id) on update cascade on delete cascade,
  estado public.estado_contestacao not null default 'aberta',
  motivo text not null check (char_length(btrim(motivo)) between 10 and 1000),
  contestada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  nota_resolucao text check (char_length(nota_resolucao) <= 1000),
  constraint contestacoes_resolucao check ((estado = 'aberta') = (resolvida_em is null))
);
comment on table public.contestacoes_entrada is
  'Contestações das entradas (contestar_entrada pelo dono; resolver_contestacao pela equipa). Só o lar lê as suas.';
create index contestacoes_instituicao_idx on public.contestacoes_entrada (instituicao_id, estado);

-- Assinatura Stripe Billing de um lar com mensalidade (29 € + IVA, compromisso de 12 meses).
create table public.subscricoes_instituicao (
  instituicao_id text primary key references public.instituicoes (id) on update cascade on delete restrict,
  stripe_subscription_id text not null unique check (stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$' and char_length(stripe_subscription_id) <= 255),
  estado public.estado_subscricao not null,
  inicio timestamptz,
  compromisso_ate timestamptz,
  cancelada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.subscricoes_instituicao is
  'Subscrição da mensalidade de um lar (uma por lar). O dono lê-a sem o id do Stripe; só o servidor escreve.';

-- ————————————————————————————————————————————————————————————————— 3. tabelas das famílias (B2C)

create table public.pagamentos_familia (
  id uuid primary key default gen_random_uuid(),
  -- ordem de criação (desempate estável para as listas)
  ordem bigint generated always as identity unique,
  -- a conta pode ser apagada; o pagamento (e a Fatura-Recibo) fica pelo prazo legal
  user_id uuid references auth.users (id) on delete set null,
  plano public.plano_familia not null,
  valor_centimos integer not null check (valor_centimos > 0),
  dias integer not null check (dias > 0),
  metodo public.metodo_familia,
  estado public.estado_pagamento_familia not null default 'pendente',
  stripe_checkout_session_id text unique check (stripe_checkout_session_id ~ '^cs_[A-Za-z0-9_]+$' and char_length(stripe_checkout_session_id) <= 255),
  stripe_payment_intent_id text check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$' and char_length(stripe_payment_intent_id) <= 255),
  multibanco_entidade text check (multibanco_entidade ~ '^[0-9]{5}$'),
  multibanco_referencia text check (multibanco_referencia ~ '^[0-9 ]{6,20}$'),
  multibanco_expira_em timestamptz,
  -- para a Fatura-Recibo (opcionais; nunca vão ao Stripe). Sem NIF = consumidor final.
  fatura_nif public.nif,
  fatura_nome text check (char_length(btrim(fatura_nome)) between 1 and 200),
  motivo_falha public.motivo_falha,
  reembolsado_centimos integer not null default 0 check (reembolsado_centimos >= 0),
  reembolsado_em timestamptz,
  -- conta de demonstração: nunca vai ao Stripe em produção; o documento nunca vai ao Moloni
  demonstracao boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pago_em timestamptz,
  documento_id uuid,
  constraint pagamentos_nome_com_nif check (fatura_nome is null or fatura_nif is not null),
  constraint pagamentos_reembolso_ate_valor check (reembolsado_centimos <= valor_centimos),
  constraint pagamentos_pago_com_data check (estado <> 'pago' or pago_em is not null)
);
comment on table public.pagamentos_familia is
  'Compras do Acesso Família (Stripe Checkout). O próprio lê as suas sem stripe_*; só o servidor escreve (servico_acesso_iniciar, webhook).';
create index pagamentos_familia_user_idx on public.pagamentos_familia (user_id, criado_em desc);
create unique index pagamentos_familia_pi_idx on public.pagamentos_familia (stripe_payment_intent_id) where stripe_payment_intent_id is not null;

-- Consentimento de início imediato (perda do direito de livre resolução de 14 dias): versão do texto, quando,
-- IP truncado (IPv4 /24, IPv6 /48 — truncado pela função).
create table public.consentimentos_acesso (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  pagamento_id uuid not null unique references public.pagamentos_familia (id) on delete cascade,
  plano public.plano_familia not null,
  texto_versao text not null check (char_length(btrim(texto_versao)) between 1 and 100),
  aceite_em timestamptz not null default now(),
  ip_truncado text check (char_length(ip_truncado) <= 64 and ip_truncado ~ '^[0-9A-Fa-f:.]+$')
);
comment on table public.consentimentos_acesso is
  'Prova do consentimento de início imediato do Acesso Família (uma por pagamento). O próprio lê as suas; só o servidor escreve.';
create index consentimentos_acesso_user_idx on public.consentimentos_acesso (user_id) where user_id is not null;

-- ————————————————————————————————————————————————————————————————— 4. faturas, documentos e linhas

-- Uma cobrança no Stripe: a mensal das entradas de um lar (origem 'entradas') ou uma fatura da subscrição.
create table public.faturas (
  id uuid primary key default gen_random_uuid(),
  ordem bigint generated always as identity unique,
  instituicao_id text not null references public.instituicoes (id) on update cascade on delete restrict,
  origem public.origem_fatura not null,
  contrato_id uuid references public.contratos (id) on delete restrict,
  -- mês a que respeita (dia 1, Lisboa)
  periodo date not null check (extract(day from periodo) = 1),
  estado public.estado_fatura not null default 'rascunho',
  -- só 'entradas': que documentos fiscais gera (FATURACAO_MODO)
  modo_documento public.modo_documento,
  -- dados fiscais do cliente no momento da cobrança
  cliente jsonb check (cliente is null or jsonb_typeof(cliente) = 'object'),
  subtotal_centimos integer not null check (subtotal_centimos >= 0),
  iva_centimos integer not null check (iva_centimos >= 0),
  total_centimos integer not null,
  moeda text not null default 'eur' check (moeda = 'eur'),
  cobranca public.cobranca_fatura not null default 'debito_automatico',
  debito_em timestamptz,
  stripe_invoice_id text unique check (stripe_invoice_id ~ '^in_[A-Za-z0-9_]+$' and char_length(stripe_invoice_id) <= 255),
  stripe_subscription_id text check (stripe_subscription_id ~ '^sub_[A-Za-z0-9_]+$' and char_length(stripe_subscription_id) <= 255),
  -- número do documento de cobrança do Stripe (não é a fatura legal) e a página para pagar
  numero text check (char_length(numero) between 1 and 60),
  url_pagamento text check (url_pagamento ~ '^https://' and char_length(url_pagamento) <= 500),
  periodo_inicio date,
  periodo_fim date,
  emitida_em timestamptz,
  paga_em timestamptz,
  falhou_em timestamptz,
  anulada_em timestamptz,
  motivo_falha public.motivo_falha,
  metodo_pago text check (metodo_pago in ('sepa_debit', 'card', 'customer_balance')),
  tentativas integer not null default 0 check (tentativas >= 0),
  -- subscrição: o total do Stripe não bate com 29 € + IVA (rateio, cupão…): sem FT, alerta para a equipa
  divergente boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint faturas_totais check (total_centimos = subtotal_centimos + iva_centimos),
  constraint faturas_origem_coerente check (
    case origem
      when 'subscricao' then stripe_subscription_id is not null and periodo_inicio is not null and periodo_fim is not null and modo_documento is null
      else stripe_subscription_id is null and modo_documento is not null
    end
  ),
  constraint faturas_debito_so_automatico check (debito_em is null or cobranca = 'debito_automatico')
);
comment on table public.faturas is
  'Cobranças no Stripe (mensal das entradas ou fatura da subscrição). Documento de cobrança, não a fatura legal (FT/FR/RC em documentos_fiscais). O dono lê as suas (sem rascunhos nem stripe_*).';
-- uma cobrança das entradas por lar e mês
create unique index faturas_entradas_periodo_unica on public.faturas (instituicao_id, periodo)
  where origem = 'entradas' and estado <> 'anulada';
create index faturas_instituicao_idx on public.faturas (instituicao_id, periodo desc);
create index faturas_contrato_idx on public.faturas (contrato_id) where contrato_id is not null;
create index faturas_a_debitar_idx on public.faturas (debito_em) where estado = 'emitida' and cobranca = 'debito_automatico';

-- Documentos fiscais (Moloni) e fila de emissão (outbox): o servidor põe-nos 'pendente' na mesma transação
-- do facto que os origina; a tarefa diária e o webhook emitem-nos e marcam-nos 'emitido'.
-- Chaves únicas (documentos.ts::chaveDocumento): FT:<candidatura>, FT:<fatura>, FT:sub:<invoice>, RC:<fatura>,
-- FR:<fatura>, FR:pag:<pagamento>.
create table public.documentos_fiscais (
  id uuid primary key default gen_random_uuid(),
  ordem bigint generated always as identity unique,
  tipo public.tipo_documento_fiscal not null,
  origem public.origem_documento not null,
  estado public.estado_documento_fiscal not null default 'pendente',
  chave text not null unique check (char_length(chave) between 4 and 120),
  instituicao_id text references public.instituicoes (id) on update cascade on delete restrict,
  -- só FR das famílias: o dono do pagamento (lê o seu documento)
  user_id uuid references auth.users (id) on delete set null,
  pagamento_id uuid references public.pagamentos_familia (id) on delete restrict,
  fatura_id uuid references public.faturas (id) on delete restrict,
  -- NC: o documento que anula
  documento_origem_id uuid references public.documentos_fiscais (id) on delete restrict,
  -- data do documento (Lisboa) e vencimento (FT)
  data date not null,
  vencimento date,
  -- snapshot do cliente, linhas estruturadas (sem descrições livres) e o pagamento (FR/RC) — portas.ts
  cliente jsonb not null check (jsonb_typeof(cliente) = 'object'),
  linhas jsonb not null default '[]' check (jsonb_typeof(linhas) = 'array'),
  pagamento jsonb check (pagamento is null or jsonb_typeof(pagamento) = 'object'),
  total_centimos integer not null,
  iva_centimos integer not null,
  numero text check (char_length(numero) between 1 and 60),
  -- id do documento no emissor (Moloni) — só servidor
  externo_id text check (char_length(externo_id) between 1 and 120),
  emissor public.emissor_documento,
  emitido_em timestamptz,
  tentativas integer not null default 0 check (tentativas >= 0),
  ultimo_erro text check (char_length(ultimo_erro) <= 500),
  proxima_tentativa_em timestamptz,
  demonstracao boolean not null default false,
  criado_em timestamptz not null default now(),
  constraint documentos_emitido_completo check (
    estado <> 'emitido' or (numero is not null and externo_id is not null and emissor is not null and emitido_em is not null)
  ),
  constraint documentos_por_emitir_sem_numero check (estado not in ('pendente', 'erro') or numero is null),
  constraint documentos_origem_coerente check (
    case origem
      when 'acesso' then tipo in ('FR', 'NC') and pagamento_id is not null and instituicao_id is null
      else instituicao_id is not null and user_id is null and pagamento_id is null
    end
  ),
  -- a demonstração nunca chega ao Moloni
  constraint documentos_demonstracao_sem_moloni check (not demonstracao or emissor is distinct from 'moloni')
);
comment on table public.documentos_fiscais is
  'Documentos fiscais (FT, FR, RC, NC) e fila de emissão. O lar lê as suas FT/RC e a família as suas FR, só emitidas e sem o id do emissor.';
create index documentos_fila_idx on public.documentos_fiscais (ordem) where estado in ('pendente', 'erro');
create index documentos_instituicao_idx on public.documentos_fiscais (instituicao_id, emitido_em desc) where instituicao_id is not null;
create index documentos_user_idx on public.documentos_fiscais (user_id) where user_id is not null;
create index documentos_pagamento_idx on public.documentos_fiscais (pagamento_id) where pagamento_id is not null;
create index documentos_fatura_idx on public.documentos_fiscais (fatura_id) where fatura_id is not null;
create index documentos_origem_idx on public.documentos_fiscais (documento_origem_id) where documento_origem_id is not null;
-- o mesmo documento do emissor nunca fica ligado a dois registos
create unique index documentos_externo_unico on public.documentos_fiscais (emissor, externo_id) where externo_id is not null;

alter table public.pagamentos_familia
  add constraint pagamentos_familia_documento_id_fkey foreign key (documento_id) references public.documentos_fiscais (id) on delete set null;
create index pagamentos_familia_documento_idx on public.pagamentos_familia (documento_id) where documento_id is not null;

-- Uma linha por entrada faturada (snapshot: referência e data; o pedido pode ser apagado depois).
create table public.fatura_linhas (
  id uuid primary key default gen_random_uuid(),
  ordem bigint generated always as identity unique,
  instituicao_id text not null references public.instituicoes (id) on update cascade on delete restrict,
  candidatura_id uuid references public.candidaturas (id) on delete set null,
  fatura_id uuid references public.faturas (id) on delete restrict,
  documento_id uuid references public.documentos_fiscais (id) on delete restrict,
  contrato_id uuid references public.contratos (id) on delete restrict,
  referencia text not null check (referencia ~ '^EL-[0-9A-F]{8}$'),
  entrada_data date not null,
  faturavel_desde timestamptz not null,
  valor_centimos integer not null check (valor_centimos > 0),
  iva_percent smallint not null check (iva_percent in (23, 22, 16)),
  iva_centimos integer not null,
  total_centimos integer generated always as (valor_centimos + iva_centimos) stored,
  anulada_em timestamptz,
  motivo_anulacao text check (char_length(motivo_anulacao) between 1 and 500),
  criado_em timestamptz not null default now(),
  -- IVA por linha, arredondado ao cêntimo (ivaCentimos em dinheiro.ts)
  constraint fatura_linhas_iva check (iva_centimos = (2 * valor_centimos::bigint * iva_percent + 100) / 200),
  constraint fatura_linhas_anulacao check ((anulada_em is null) = (motivo_anulacao is null))
);
comment on table public.fatura_linhas is
  'Entradas faturadas (uma linha ativa por entrada; anular permite refaturar depois de uma nota de crédito). O dono lê as suas.';
-- impede faturar a mesma entrada duas vezes (e serve a chave estrangeira candidatura_id)
create unique index fatura_linhas_entrada_ativa on public.fatura_linhas (candidatura_id) where anulada_em is null;
create index fatura_linhas_candidatura_idx on public.fatura_linhas (candidatura_id) where candidatura_id is not null;
create index fatura_linhas_instituicao_idx on public.fatura_linhas (instituicao_id, fatura_id);
create index fatura_linhas_fatura_idx on public.fatura_linhas (fatura_id) where fatura_id is not null;
create index fatura_linhas_documento_idx on public.fatura_linhas (documento_id) where documento_id is not null;
create index fatura_linhas_contrato_idx on public.fatura_linhas (contrato_id) where contrato_id is not null;

-- entradas aplicáveis (as únicas que podem faturar), para a tarefa diária
create index candidaturas_entradas_aplicaveis_idx on public.candidaturas (entrada_data) where entrada_taxa = 'aplicavel';

-- Eventos do webhook do Stripe (idempotência). Sem acesso de clientes (RLS sem políticas, como procuras_anonimas).
create table public.stripe_eventos (
  id text primary key check (id ~ '^evt_[A-Za-z0-9_]+$' and char_length(id) <= 255),
  tipo text not null check (char_length(tipo) between 1 and 100),
  livemode boolean not null,
  criado_em timestamptz not null,
  recebido_em timestamptz not null default now(),
  processado_em timestamptz,
  tentativas integer not null default 1 check (tentativas >= 1),
  erro text check (char_length(erro) <= 500),
  -- as operações aplicadas (auditoria; sem dados pessoais nem de saúde)
  operacoes jsonb check (operacoes is null or jsonb_typeof(operacoes) = 'array')
);
comment on table public.stripe_eventos is
  'Eventos do webhook do Stripe já recebidos (servico_evento_*). Sem acesso de clientes; limpos aos 90 dias (pg_cron).';
create index stripe_eventos_processado_idx on public.stripe_eventos (processado_em) where processado_em is not null;

-- ————————————————————————————————————————————————————————————————— 5. tabelas internas (schema private)

-- Arrendamento das tarefas agendadas (faturar-mes): duas execuções da mesma fase não se sobrepõem.
create table private.execucoes_faturacao (
  fase text primary key check (fase in ('diario', 'cobranca')),
  bloqueado_ate timestamptz,
  iniciado_em timestamptz,
  terminado_em timestamptz,
  -- só contagens (sem dados pessoais)
  ultimo_resumo jsonb
);

-- Alertas para a equipa (reembolsos, disputas, pagamentos falhados, divergências): playbook em docs/SUPABASE.md.
create table private.alertas_faturacao (
  id bigint generated always as identity primary key,
  tipo text not null check (tipo ~ '^[a-z_]{3,40}$'),
  ref text not null check (char_length(ref) between 1 and 255),
  dados jsonb not null default '{}' check (jsonb_typeof(dados) = 'object'),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz,
  nota text check (char_length(nota) <= 1000)
);
create index alertas_faturacao_abertos_idx on private.alertas_faturacao (criado_em desc) where resolvido_em is null;

-- ————————————————————————————————————————————————————————————————— 6. RLS e privilégios das tabelas

alter table public.contratos enable row level security;
alter table public.dados_faturacao enable row level security;
alter table public.contestacoes_entrada enable row level security;
alter table public.subscricoes_instituicao enable row level security;
alter table public.pagamentos_familia enable row level security;
alter table public.consentimentos_acesso enable row level security;
alter table public.faturas enable row level security;
alter table public.documentos_fiscais enable row level security;
alter table public.fatura_linhas enable row level security;
alter table public.stripe_eventos enable row level security;
alter table private.execucoes_faturacao enable row level security;
alter table private.alertas_faturacao enable row level security;

-- o dono do lar lê as suas linhas
create policy contratos_select_dono on public.contratos
  for select to authenticated using (instituicao_id = (select private.minha_instituicao()));
create policy dados_faturacao_select_dono on public.dados_faturacao
  for select to authenticated using (instituicao_id = (select private.minha_instituicao()));
create policy contestacoes_select_dono on public.contestacoes_entrada
  for select to authenticated using (instituicao_id = (select private.minha_instituicao()));
create policy subscricoes_select_dono on public.subscricoes_instituicao
  for select to authenticated using (instituicao_id = (select private.minha_instituicao()));
create policy faturas_select_dono on public.faturas
  for select to authenticated using (instituicao_id = (select private.minha_instituicao()) and estado <> 'rascunho');
create policy fatura_linhas_select_dono on public.fatura_linhas
  for select to authenticated using (instituicao_id = (select private.minha_instituicao()));
-- documentos: o lar as suas FT/RC, a família as suas FR — só depois de emitidos
create policy documentos_select_instituicao on public.documentos_fiscais
  for select to authenticated using (estado = 'emitido' and instituicao_id = (select private.minha_instituicao()));
create policy documentos_select_familia on public.documentos_fiscais
  for select to authenticated using (estado = 'emitido' and user_id = (select auth.uid()));
-- famílias: as suas compras e consentimentos
create policy pagamentos_familia_select_proprio on public.pagamentos_familia
  for select to authenticated using (user_id = (select auth.uid()));
create policy consentimentos_select_proprio on public.consentimentos_acesso
  for select to authenticated using (user_id = (select auth.uid()));
-- stripe_eventos: sem políticas (nenhum cliente lê)

-- Os clientes nunca escrevem; leem só colunas sem referências do Stripe/Moloni. A service_role só lê (escreve
-- pelas funções servico_*, que validam e mantêm a coerência).
revoke all on table
  public.contratos, public.dados_faturacao, public.contestacoes_entrada, public.subscricoes_instituicao,
  public.pagamentos_familia, public.consentimentos_acesso, public.faturas, public.documentos_fiscais,
  public.fatura_linhas, public.stripe_eventos
from anon, authenticated, service_role;
revoke all on table private.execucoes_faturacao, private.alertas_faturacao from public, anon, authenticated, service_role;

grant select (id, instituicao_id, referencia, taxa_entrada_centimos, iva_percent, regiao_fiscal, inicio, fim, criado_em)
  on public.contratos to authenticated;
grant select (instituicao_id, razao_social, nif, morada, codigo_postal, localidade, email, metodo_tipo, metodo_ultimos4,
              metodo_banco, metodo_validade, metodo_mandato_ref, metodo_atualizado_em, criado_em, atualizado_em)
  on public.dados_faturacao to authenticated;
grant select on public.contestacoes_entrada to authenticated;
grant select (instituicao_id, estado, inicio, compromisso_ate, cancelada_em, criado_em, atualizado_em)
  on public.subscricoes_instituicao to authenticated;
grant select (id, user_id, plano, valor_centimos, dias, metodo, estado, multibanco_entidade, multibanco_referencia,
              multibanco_expira_em, fatura_nif, fatura_nome, motivo_falha, reembolsado_centimos, reembolsado_em,
              criado_em, pago_em, documento_id)
  on public.pagamentos_familia to authenticated;
grant select (id, pagamento_id, plano, texto_versao, aceite_em) on public.consentimentos_acesso to authenticated;
grant select (id, instituicao_id, origem, contrato_id, periodo, estado, modo_documento, cliente, subtotal_centimos,
              iva_centimos, total_centimos, moeda, cobranca, debito_em, numero, url_pagamento, periodo_inicio,
              periodo_fim, emitida_em, paga_em, falhou_em, anulada_em, motivo_falha, metodo_pago, criado_em)
  on public.faturas to authenticated;
grant select (id, tipo, origem, estado, numero, data, emitido_em, total_centimos, iva_centimos, fatura_id, pagamento_id)
  on public.documentos_fiscais to authenticated;
grant select (id, instituicao_id, candidatura_id, fatura_id, documento_id, contrato_id, referencia, entrada_data,
              faturavel_desde, valor_centimos, iva_percent, iva_centimos, total_centimos, anulada_em, motivo_anulacao, criado_em)
  on public.fatura_linhas to authenticated;
grant select on
  public.contratos, public.dados_faturacao, public.contestacoes_entrada, public.subscricoes_instituicao,
  public.pagamentos_familia, public.consentimentos_acesso, public.faturas, public.documentos_fiscais,
  public.fatura_linhas, public.stripe_eventos
to service_role;

-- ————————————————————————————————————————————————————————————————— 7. auxiliares (valores, datas, NIF, IVA)

-- Valores comerciais do servidor: os mesmos de supabase/functions/_shared/faturacao/planos.ts (um teste prova-o).
create function private.preco_plano_familia(p_plano public.plano_familia)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plano when 'acesso_30' then 1490 when 'acesso_90' then 2990 end;
$$;
comment on function private.preco_plano_familia(public.plano_familia) is
  'Preço do passe com IVA incluído, em cêntimos (PLANOS_FAMILIA): 14,90 € / 30 dias e 29,90 € / 90 dias.';

-- IVA incluído nos passes das famílias (Continente)
create function private.iva_familia_percent()
returns integer language sql immutable set search_path = '' as $$ select 23 $$;

-- Mensalidade dos lares privados (+ IVA)
create function private.mensalidade_centimos()
returns integer language sql immutable set search_path = '' as $$ select 2900 $$;

-- Taxa por entrada sem contrato (+ IVA); o contrato manda (contratos.taxa_entrada_centimos)
create function private.taxa_entrada_omissao_centimos()
returns integer language sql immutable set search_path = '' as $$ select 15000 $$;

-- Pré-aviso do débito SEPA mostrado em "Próxima fatura" (= FATURACAO_SEPA_PRE_AVISO_DIAS por omissão)
create function private.pre_aviso_sepa_dias()
returns integer language sql immutable set search_path = '' as $$ select 3 $$;

-- 'EL-' + 8 hexadecimais do id do pedido (referencia.ts): o único identificador do pedido que sai.
create function private.referencia_pedido(p_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select 'EL-' || upper(left(replace(p_id::text, '-', ''), 8));
$$;

-- normalizarNIF (nif.ts): tira espaços, pontos, hífenes e o prefixo PT.
create function private.normalizar_nif(p_valor text)
returns text
language sql
immutable
set search_path = ''
as $$
  select regexp_replace(
           regexp_replace(upper(regexp_replace(coalesce(p_valor, ''), '^\s+|\s+$', '', 'g')), '^PT', ''),
           '[[:space:].-]', '', 'g');
$$;

-- validarNIF (nif.ts): mensagem de erro (PT-PT) ou null. p_b2b recusa o 999999990 (consumidor final).
-- plpgsql (não SQL) para o planeador não avaliar substr(...)::int de um texto que não é numérico.
create function private.erro_nif(p_nif text, p_b2b boolean)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_soma integer := 0;
  v_resto integer;
begin
  if p_nif is null or p_nif !~ '^[0-9]{9}$' then
    return 'O NIF tem 9 algarismos.';
  end if;
  for i in 1 .. 8 loop
    v_soma := v_soma + substr(p_nif, i, 1)::int * (10 - i);
  end loop;
  v_resto := v_soma % 11;
  if p_nif !~ '^([123568][0-9]|45|7[0124579]|9[0189])[0-9]{7}$'
     or (case when v_resto < 2 then 0 else 11 - v_resto end) <> substr(p_nif, 9, 1)::int then
    return 'Este NIF não é válido. Confirme os algarismos.';
  end if;
  if p_nif = '999999990' and p_b2b then
    return 'Indique o NIF da entidade: o NIF de consumidor final não serve para faturas a empresas.';
  end if;
  return null;
end;
$$;

-- ivaCentimos (dinheiro.ts): round(base × taxa / 100), meio cêntimo afastado de zero, só com inteiros.
create function private.iva_centimos(p_base integer, p_pct integer)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (sign(p_base::bigint) * ((2 * abs(p_base::bigint) * p_pct + 100) / 200))::integer;
$$;

-- separarIvaIncluido (dinheiro.ts): o IVA de um preço com IVA incluído, tal que líquido + round(líquido × taxa)
-- = bruto (o que o Moloni recalcula). null se não houver separação exata ao cêntimo.
create function private.separar_iva_incluido(p_bruto integer, p_pct integer)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_estimativa integer;
begin
  if p_bruto is null or p_bruto < 0 then
    return null;
  end if;
  v_estimativa := round(p_bruto * 100.0 / (100 + p_pct));
  for n in greatest(0, v_estimativa - 2) .. v_estimativa + 2 loop
    if n + private.iva_centimos(n, p_pct) = p_bruto then
      return p_bruto - n;
    end if;
  end loop;
  return null;
end;
$$;

-- regiao.ts: o código postal fiscal manda (9000–9499 Madeira, 9500–9999 Açores); sem ele, a região da ficha.
create function private.regiao_fiscal_de(p_codigo_postal text, p_regiao text)
returns public.regiao_fiscal
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_n integer;
begin
  if coalesce(btrim(p_codigo_postal), '') ~ '^[0-9]{4}-[0-9]{3}$' then
    v_n := left(btrim(p_codigo_postal), 4)::int;
    if v_n >= 1000 then
      return case when v_n between 9000 and 9499 then 'madeira' when v_n >= 9500 then 'acores' else 'continente' end;
    end if;
  end if;
  return case p_regiao when 'Madeira' then 'madeira' when 'Açores' then 'acores' else 'continente' end;
end;
$$;

create function private.iva_da_regiao(p_regiao public.regiao_fiscal)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select (case p_regiao when 'madeira' then 22 when 'acores' then 16 else 23 end)::smallint;
$$;

-- Instante de uma hora de parede em Lisboa, com as regras do Date do ECMAScript (deLisboa em datas.ts): numa
-- hora que não existe (salto de março) usa o desvio de antes da mudança; numa hora repetida (outubro) escolhe
-- a PRIMEIRA. (O Postgres sozinho escolhe a hora de inverno, uma hora mais tarde, nesse caso.)
create function private.de_lisboa(p_local timestamp)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when ((x.t - interval '1 hour') at time zone 'Europe/Lisbon') = p_local then x.t - interval '1 hour' else x.t end
    from (select p_local at time zone 'Europe/Lisbon' as t) x;
$$;

create function private.dia_lisboa(p_quando timestamptz)
returns date
language sql
stable
set search_path = ''
as $$
  select (p_quando at time zone 'Europe/Lisbon')::date;
$$;

-- fimContestacao (datas.ts): 14 dias de calendário à mesma hora de Lisboa.
create function private.fim_contestacao(p_familia_em timestamptz)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select private.de_lisboa((p_familia_em at time zone 'Europe/Lisbon') + interval '14 days');
$$;

-- dentroDaJanela (datas.ts): a entrada até ao dia do pedido em Lisboa + 365 dias (inclusive).
create function private.dentro_janela(p_pedido_criado_em timestamptz, p_entrada_data date)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_entrada_data <= private.dia_lisboa(p_pedido_criado_em) + 365;
$$;

-- 1476 → '14,76 €' (euros() em dinheiro.ts)
create function private.euros(p_centimos integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_centimos < 0 then '-' else '' end
         || (abs(p_centimos) / 100)::text || ',' || lpad((abs(p_centimos) % 100)::text, 2, '0') || ' €';
$$;

-- '2026-10-01' → 'outubro de 2026' (mesPorExtenso em datas.ts)
create function private.mes_extenso(p_dia date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
                'outubro', 'novembro', 'dezembro'])[extract(month from p_dia)::int]
         || ' de ' || extract(year from p_dia)::int;
$$;

-- Defesa em profundidade das funções de serviço (o GRANT é a barreira): só a service_role ou sem claims do
-- PostgREST (postgres no editor SQL, pg_cron).
create function private.exigir_servico()
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', 'service_role') <> 'service_role' then
    raise exception 'Só o servidor pode fazer isto.' using errcode = '42501';
  end if;
end;
$$;

-- Alerta para a equipa (sem dados pessoais nem de saúde): ver o playbook.
create function private.alertar(p_tipo text, p_ref text, p_dados jsonb default '{}')
returns void
language sql
set search_path = ''
as $$
  insert into private.alertas_faturacao (tipo, ref, dados) values (p_tipo, left(coalesce(p_ref, '?'), 255), coalesce(p_dados, '{}'));
$$;

-- Cliente empresa de uma FT/RC (snapshot dos dados fiscais, ClienteDocumentoRpc 'empresa').
create function private.cliente_empresa(p_instituicao_id text)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cliente jsonb;
begin
  select jsonb_build_object(
           'tipo', 'empresa', 'pais', 'PT', 'razao_social', d.razao_social, 'nif', d.nif::text, 'morada', d.morada,
           'codigo_postal', d.codigo_postal, 'localidade', d.localidade, 'email', d.email)
    into v_cliente
    from public.dados_faturacao d
   where d.instituicao_id = p_instituicao_id;
  if v_cliente is null then
    raise exception 'Sem dados de faturação.' using errcode = '22023';
  end if;
  return v_cliente;
end;
$$;

-- Contrato em vigor num dia (Lisboa), ou null.
create function private.contrato_em_vigor(p_instituicao_id text, p_dia date)
returns public.contratos
language sql
stable
set search_path = ''
as $$
  select c.* from public.contratos c
   where c.instituicao_id = p_instituicao_id and c.inicio <= p_dia and (c.fim is null or c.fim >= p_dia)
   order by c.inicio desc
   limit 1;
$$;

-- IVA em vigor para o lar: o do contrato; sem contrato, o da região fiscal do código postal (senão da ficha).
create function private.iva_instituicao(p_instituicao_id text, p_dia date default null)
returns smallint
language sql
stable
set search_path = ''
as $$
  select coalesce(
    (select c.iva_percent from private.contrato_em_vigor(p_instituicao_id, coalesce(p_dia, private.dia_lisboa(now()))) c where c.id is not null),
    (select private.iva_da_regiao(private.regiao_fiscal_de(d.codigo_postal, i.regiao))
       from public.instituicoes i left join public.dados_faturacao d on d.instituicao_id = i.id
      where i.id = p_instituicao_id),
    23
  )::smallint;
$$;

-- Valor de uma entrada: o contrato em vigor na data da entrada (senão o de hoje); sem contrato, 150 € e o IVA
-- da região.
create function private.valor_entrada(
  p_instituicao_id text,
  p_entrada_data date,
  out contrato_id uuid,
  out valor_centimos integer,
  out iva_percent smallint
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_c public.contratos;
begin
  v_c := private.contrato_em_vigor(p_instituicao_id, p_entrada_data);
  if v_c.id is null then
    v_c := private.contrato_em_vigor(p_instituicao_id, private.dia_lisboa(now()));
  end if;
  if v_c.id is not null then
    contrato_id := v_c.id;
    valor_centimos := v_c.taxa_entrada_centimos;
    iva_percent := v_c.iva_percent;
  else
    contrato_id := null;
    valor_centimos := private.taxa_entrada_omissao_centimos();
    iva_percent := private.iva_instituicao(p_instituicao_id, p_entrada_data);
  end if;
end;
$$;

-- Sem dois contratos do mesmo lar com períodos sobrepostos (bloqueia o lar: duas escritas simultâneas esperam).
create function private.contratos_sem_sobreposicao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform 1 from public.instituicoes i where i.id = new.instituicao_id for update;
  if exists (
    select 1 from public.contratos c
     where c.instituicao_id = new.instituicao_id and c.id <> new.id
       and daterange(c.inicio, c.fim, '[]') && daterange(new.inicio, new.fim, '[]')
  ) then
    raise exception 'Já há um contrato desta instituição nesse período.' using errcode = '23P01';
  end if;
  return new;
end;
$$;

create trigger contratos_sem_sobreposicao
  before insert or update of instituicao_id, inicio, fim on public.contratos
  for each row execute function private.contratos_sem_sobreposicao();

-- ————————————————————————————————————————————————————————————————— 8. estado de faturação das entradas

-- classificarEntrada (regras.ts), pela mesma ordem:
--   por_confirmar → isenta → incluida → faturada (linha ativa) → fora_janela → dispensada (contestação aceite) →
--   contestada (aberta) → faturavel desde a confirmação do lar → faturavel desde a decisão (rejeitada) →
--   faturavel desde familia_em + 14 dias (se já passou) → a_aguardar até familia_em + 14 dias.
create function private.classificar_entrada(
  p_pedido_criado_em timestamptz,
  p_entrada_data date,
  p_taxa public.taxa_entrada,
  p_lar_em timestamptz,
  p_familia_em timestamptz,
  p_contestacao public.estado_contestacao,
  p_contestada_em timestamptz,
  p_resolvida_em timestamptz,
  p_tem_linha boolean,
  p_agora timestamptz,
  out estado text,
  out desde timestamptz,
  out ate timestamptz
)
language plpgsql
stable
set search_path = ''
as $$
declare
  v_fim timestamptz;
begin
  if p_entrada_data is null or p_taxa is null or (p_lar_em is null and p_familia_em is null) then
    estado := 'por_confirmar';
  elsif p_taxa = 'isenta' then
    estado := 'isenta';
  elsif p_taxa = 'incluida' then
    estado := 'incluida';
  elsif coalesce(p_tem_linha, false) then
    estado := 'faturada';
  elsif not private.dentro_janela(p_pedido_criado_em, p_entrada_data) then
    estado := 'fora_janela';
  elsif p_contestacao = 'aceite' then
    estado := 'dispensada';
  elsif p_contestacao = 'aberta' then
    estado := 'contestada';
    desde := p_contestada_em;
  elsif p_lar_em is not null then
    estado := 'faturavel';
    desde := p_lar_em;
  elsif p_contestacao = 'rejeitada' and p_resolvida_em is not null then
    estado := 'faturavel';
    desde := p_resolvida_em;
  else
    v_fim := private.fim_contestacao(p_familia_em);
    if p_agora >= v_fim then
      estado := 'faturavel';
      desde := v_fim;
    else
      estado := 'a_aguardar';
      ate := v_fim;
    end if;
  end if;
end;
$$;

-- As entradas (pedidos com entrada registada) de um lar — ou de todos, com p_instituicao_id null — e o seu
-- estado de faturação no instante p_agora (que os testes fixam: a regra dos 14 dias sem mexer no relógio).
create function private.entradas_faturacao(
  p_instituicao_id text,
  p_agora timestamptz default now(),
  p_candidatura_id uuid default null
)
returns table (
  candidatura_id uuid,
  instituicao_id text,
  referencia text,
  pedido_criado_em timestamptz,
  entrada_data date,
  confirmada_lar_em timestamptz,
  confirmada_familia_em timestamptz,
  taxa public.taxa_entrada,
  estado text,
  faturavel_desde timestamptz,
  contestavel_ate timestamptz,
  contestacao_estado public.estado_contestacao,
  contestada_em timestamptz,
  contestacao_motivo text,
  resolvida_em timestamptz,
  nota_resolucao text,
  linha_id uuid,
  fatura_id uuid,
  documento_numero text
)
language sql
stable
set search_path = ''
as $$
  select c.id, c.instituicao_id, private.referencia_pedido(c.id), c.created_at, c.entrada_data,
         c.entrada_confirmada_lar_em, c.entrada_confirmada_familia_em, c.entrada_taxa,
         k.estado,
         case k.estado when 'faturavel' then k.desde when 'faturada' then l.faturavel_desde end,
         case when c.entrada_taxa = 'aplicavel' and c.entrada_confirmada_familia_em is not null
                   and c.entrada_confirmada_lar_em is null
              then private.fim_contestacao(c.entrada_confirmada_familia_em) end,
         ct.estado, ct.contestada_em, ct.motivo, ct.resolvida_em, ct.nota_resolucao,
         l.id, l.fatura_id, d.numero
    from public.candidaturas c
    left join public.contestacoes_entrada ct on ct.candidatura_id = c.id
    left join public.fatura_linhas l on l.candidatura_id = c.id and l.anulada_em is null
    left join public.documentos_fiscais d on d.id = l.documento_id and d.estado = 'emitido'
   cross join lateral private.classificar_entrada(
           c.created_at, c.entrada_data, c.entrada_taxa, c.entrada_confirmada_lar_em, c.entrada_confirmada_familia_em,
           ct.estado, ct.contestada_em, ct.resolvida_em, l.id is not null, p_agora) k
   where c.entrada_data is not null
     and (p_instituicao_id is null or c.instituicao_id = p_instituicao_id)
     and (p_candidatura_id is null or c.id = p_candidatura_id);
$$;

-- ————————————————————————————————————————————————————————————————— 9. faturas: transições e recibos

-- Documento de quitação de uma fatura paga (outbox): RC:<fatura> que liquida as FT da fatura, ou FR:<fatura>
-- no modo fatura_recibo_mensal. Idempotente (chave única). O RC só fica pronto a emitir quando as FT
-- associadas estiverem emitidas (servico_documentos_pendentes).
create function private.criar_recibo(p_fatura_id uuid, p_em timestamptz)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_f public.faturas;
  v_metodo text;
  v_cliente jsonb;
  v_demo boolean;
  v_dia date := private.dia_lisboa(p_em);
begin
  select * into v_f from public.faturas f where f.id = p_fatura_id;
  select i.demonstracao into v_demo from public.instituicoes i where i.id = v_f.instituicao_id;
  v_metodo := coalesce(
    v_f.metodo_pago,
    (select d.metodo_tipo::text from public.dados_faturacao d where d.instituicao_id = v_f.instituicao_id),
    'sepa_debit'
  );
  -- o recibo vai ao mesmo cliente das faturas que liquida
  v_cliente := coalesce(
    (select d.cliente from public.documentos_fiscais d where d.fatura_id = v_f.id and d.tipo = 'FT' order by d.ordem limit 1),
    private.cliente_empresa(v_f.instituicao_id)
  );

  if v_f.modo_documento = 'fatura_recibo_mensal' then
    insert into public.documentos_fiscais (tipo, origem, chave, instituicao_id, fatura_id, data, cliente, linhas, pagamento,
                                          total_centimos, iva_centimos, demonstracao)
    select 'FR', 'entradas', 'FR:' || v_f.id, v_f.instituicao_id, v_f.id, v_dia, v_cliente,
           coalesce(jsonb_agg(jsonb_build_object('tipo', 'entrada', 'referencia', l.referencia, 'entrada_data', l.entrada_data,
                                                 'valor_centimos', l.valor_centimos, 'iva_percent', l.iva_percent) order by l.ordem), '[]'),
           jsonb_build_object('metodo', v_metodo, 'data', v_dia, 'valor_centimos', v_f.total_centimos),
           v_f.total_centimos, v_f.iva_centimos, coalesce(v_demo, false)
      from public.fatura_linhas l
     where l.fatura_id = v_f.id
    on conflict (chave) do nothing;
  else
    insert into public.documentos_fiscais (tipo, origem, chave, instituicao_id, fatura_id, data, cliente, linhas, pagamento,
                                          total_centimos, iva_centimos, demonstracao)
    values ('RC', case v_f.origem when 'subscricao' then 'subscricao' else 'entradas' end::public.origem_documento,
            'RC:' || v_f.id, v_f.instituicao_id, v_f.id, v_dia, v_cliente, '[]',
            jsonb_build_object('metodo', v_metodo, 'data', v_dia, 'valor_centimos', v_f.total_centimos),
            v_f.total_centimos, 0, coalesce(v_demo, false))
    on conflict (chave) do nothing;
  end if;
end;
$$;

-- transicao_fatura_permitida (v1) + efeitos: emitida_em/paga_em/falhou_em/anulada_em; 'falhou' avisa o lar e
-- a equipa; 'paga' põe o recibo na fila; 'anulada' alerta a equipa (as linhas ficam: decisão do playbook).
-- Transições inválidas ou repetidas são ignoradas (devolve false), como no webhook.
create function private.transitar_fatura(
  p_fatura_id uuid,
  p_para public.estado_fatura,
  p_em timestamptz,
  p_motivo public.motivo_falha default null,
  p_metodo text default null
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_f public.faturas;
  v_owner uuid;
  v_permitida boolean;
begin
  select * into v_f from public.faturas f where f.id = p_fatura_id for update;
  if not found or v_f.estado = p_para then
    return false;
  end if;
  v_permitida := case v_f.estado
    when 'rascunho' then p_para <> 'rascunho'
    when 'emitida' then p_para in ('em_processamento', 'paga', 'falhou', 'anulada')
    when 'em_processamento' then p_para in ('paga', 'falhou')
    when 'falhou' then p_para in ('em_processamento', 'paga', 'anulada')
    else false
  end;
  if not v_permitida then
    return false;
  end if;

  update public.faturas f
     set estado = p_para,
         emitida_em = case when p_para = 'emitida' then p_em else f.emitida_em end,
         paga_em = case when p_para = 'paga' then p_em else f.paga_em end,
         falhou_em = case when p_para = 'falhou' then p_em else f.falhou_em end,
         anulada_em = case when p_para = 'anulada' then p_em else f.anulada_em end,
         motivo_falha = case when p_para = 'falhou' then coalesce(p_motivo, 'outro') else f.motivo_falha end,
         metodo_pago = coalesce(p_metodo, f.metodo_pago),
         atualizado_em = now()
   where f.id = v_f.id;

  select i.owner_id into v_owner from public.instituicoes i where i.id = v_f.instituicao_id;
  if p_para = 'falhou' then
    perform private.alertar('pagamento_falhou', v_f.id::text, jsonb_build_object('motivo', coalesce(p_motivo, 'outro')));
    if v_owner is not null then
      perform private.notificar(
        v_owner, 'sistema', 'Pagamento falhou',
        format('O pagamento %s de %s falhou. Veja o motivo e pague em Faturação.',
               case v_f.origem when 'subscricao' then 'da mensalidade' else 'das entradas' end,
               private.mes_extenso(v_f.periodo)),
        v_f.instituicao_id, null, '/gestao/faturacao'
      );
    end if;
  elsif p_para = 'paga' then
    perform private.criar_recibo(v_f.id, p_em);
  elsif p_para = 'anulada' then
    perform private.alertar('fatura_anulada', v_f.id::text, jsonb_build_object('origem', v_f.origem));
  end if;
  return true;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 10. webhook: operações (servico_evento_aplicar)

-- Pagamento do Acesso Família por sessão do Checkout; se a sessão nunca foi registada (falha entre o Stripe e
-- servico_acesso_sessao_criada), pelo pagamento_id da metadata — e liga-lhe a sessão. Bloqueia a linha.
create function private.pagamento_da_sessao(p_session_id text, p_pagamento_id uuid)
returns public.pagamentos_familia
language plpgsql
set search_path = ''
as $$
declare
  v_p public.pagamentos_familia;
begin
  if p_session_id is not null then
    select * into v_p from public.pagamentos_familia p where p.stripe_checkout_session_id = p_session_id for update;
    if found then
      return v_p;
    end if;
  end if;
  if p_pagamento_id is not null then
    select * into v_p from public.pagamentos_familia p where p.id = p_pagamento_id for update;
    if found and v_p.stripe_checkout_session_id is null and p_session_id is not null then
      update public.pagamentos_familia p
         set stripe_checkout_session_id = p_session_id, atualizado_em = now()
       where p.id = v_p.id
      returning * into v_p;
      return v_p;
    end if;
  end if;
  return null;
end;
$$;

-- Uma operação de OperacaoEvento (portas.ts). Idempotente; transições inválidas e referências desconhecidas
-- são ignoradas; um valor pago diferente do passe lança (o evento repete-se e a equipa vê-o).
create function private.aplicar_operacao_evento(p_op jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_tipo text := p_op ->> 'op';
  v_p public.pagamentos_familia;
  v_f public.faturas;
  v_s public.subscricoes_instituicao;
  v_d public.dados_faturacao;
  v_i public.instituicoes;
  v_inst text;
  v_doc uuid;
  v_iva integer;
  v_quando timestamptz;
  v_dia date;
  v_pct smallint;
  v_liquido integer;
  v_total integer;
  v_sub jsonb;
begin
  case v_tipo
  -- ——— famílias
  when 'acesso_pago' then
    v_p := private.pagamento_da_sessao(p_op ->> 'session_id', (p_op ->> 'pagamento_id')::uuid);
    if v_p.id is null or v_p.estado in ('pago', 'reembolsado') then
      return;
    end if;
    if (p_op ->> 'valor_centimos')::integer is distinct from v_p.valor_centimos then
      raise exception 'Valor pago diferente do valor do passe.' using errcode = '22023';
    end if;
    v_quando := (p_op ->> 'pago_em')::timestamptz;
    update public.pagamentos_familia p
       set estado = 'pago',
           metodo = coalesce((p_op ->> 'metodo')::public.metodo_familia, p.metodo),
           stripe_payment_intent_id = coalesce(p_op ->> 'payment_intent_id', p.stripe_payment_intent_id),
           pago_em = v_quando,
           atualizado_em = now()
     where p.id = v_p.id
    returning * into v_p;
    -- o passe: novoAte (e o aviso "Acesso Família ativo" vem de estender_acesso). Uma vez por pagamento: um
    -- pagamento já 'pago' sai acima.
    if v_p.user_id is not null then
      perform private.estender_acesso(v_p.user_id, v_p.plano);
    end if;
    v_iva := private.separar_iva_incluido(v_p.valor_centimos, private.iva_familia_percent());
    if v_iva is null then
      raise exception 'O preço do passe não se separa em líquido + IVA ao cêntimo.' using errcode = '22023';
    end if;
    v_dia := private.dia_lisboa(v_quando);
    insert into public.documentos_fiscais (tipo, origem, chave, user_id, pagamento_id, data, cliente, linhas, pagamento,
                                          total_centimos, iva_centimos, demonstracao)
    values (
      'FR', 'acesso', 'FR:pag:' || v_p.id, v_p.user_id, v_p.id, v_dia,
      case when v_p.fatura_nif is not null
           then jsonb_build_object('tipo', 'particular', 'nif', v_p.fatura_nif::text, 'nome', v_p.fatura_nome)
           else jsonb_build_object('tipo', 'consumidor_final') end,
      jsonb_build_array(jsonb_build_object('tipo', 'acesso', 'plano', v_p.plano, 'valor_centimos', v_p.valor_centimos,
                                           'iva_percent', private.iva_familia_percent())),
      jsonb_build_object('metodo', coalesce(v_p.metodo::text, 'card'), 'data', v_dia, 'valor_centimos', v_p.valor_centimos),
      v_p.valor_centimos, v_iva, v_p.demonstracao
    )
    on conflict (chave) do nothing;
    select d.id into v_doc from public.documentos_fiscais d where d.chave = 'FR:pag:' || v_p.id;
    update public.pagamentos_familia p set documento_id = v_doc where p.id = v_p.id;

  when 'acesso_a_aguardar' then
    v_p := private.pagamento_da_sessao(p_op ->> 'session_id', (p_op ->> 'pagamento_id')::uuid);
    if v_p.id is null or v_p.estado <> 'pendente' then
      return;
    end if;
    update public.pagamentos_familia p
       set estado = 'a_aguardar_pagamento',
           metodo = (p_op ->> 'metodo')::public.metodo_familia,
           stripe_payment_intent_id = coalesce(p_op ->> 'payment_intent_id', p.stripe_payment_intent_id),
           multibanco_entidade = p_op ->> 'entidade',
           multibanco_referencia = p_op ->> 'referencia',
           multibanco_expira_em = (p_op ->> 'expira_em')::timestamptz,
           atualizado_em = now()
     where p.id = v_p.id;

  when 'acesso_falhou' then
    v_p := private.pagamento_da_sessao(p_op ->> 'session_id', (p_op ->> 'pagamento_id')::uuid);
    if v_p.id is null or v_p.estado in ('pago', 'reembolsado') then
      return;
    end if;
    update public.pagamentos_familia p
       set estado = 'falhou', motivo_falha = coalesce((p_op ->> 'motivo')::public.motivo_falha, 'outro'), atualizado_em = now()
     where p.id = v_p.id;

  when 'acesso_expirado' then
    v_p := private.pagamento_da_sessao(p_op ->> 'session_id', (p_op ->> 'pagamento_id')::uuid);
    if v_p.id is null or v_p.estado <> 'pendente' then
      return;
    end if;
    update public.pagamentos_familia p set estado = 'expirado', atualizado_em = now() where p.id = v_p.id;

  when 'acesso_reembolsado' then
    -- NÃO encurta o acesso (decisão de operações): marca e avisa a equipa
    select * into v_p from public.pagamentos_familia p where p.stripe_payment_intent_id = p_op ->> 'payment_intent_id' for update;
    if not found then
      return;
    end if;
    update public.pagamentos_familia p
       set reembolsado_centimos = least(greatest(coalesce((p_op ->> 'valor_reembolsado_centimos')::integer, 0), 0), p.valor_centimos),
           estado = case when coalesce((p_op ->> 'total')::boolean, false) then 'reembolsado' else p.estado end,
           reembolsado_em = coalesce((p_op ->> 'em')::timestamptz, now()),
           atualizado_em = now()
     where p.id = v_p.id;
    perform private.alertar('reembolso', v_p.id::text,
      jsonb_build_object('valor_centimos', (p_op ->> 'valor_reembolsado_centimos')::integer, 'total', coalesce((p_op ->> 'total')::boolean, false)));

  -- ——— mensalidade
  when 'subscricao_estado' then
    select * into v_s from public.subscricoes_instituicao s where s.stripe_subscription_id = p_op ->> 'stripe_subscription_id' for update;
    v_inst := coalesce(v_s.instituicao_id, p_op ->> 'instituicao_id');
    if v_inst is null or not exists (select 1 from public.instituicoes i where i.id = v_inst) then
      return;
    end if;
    -- metadata divergente da subscrição conhecida: registo para a equipa, sem aplicar
    if v_s.instituicao_id is not null and p_op ->> 'instituicao_id' is not null and p_op ->> 'instituicao_id' <> v_s.instituicao_id then
      perform private.alertar('metadata_divergente', v_s.instituicao_id,
        jsonb_build_object('stripe_subscription_id', p_op ->> 'stripe_subscription_id', 'metadata', p_op ->> 'instituicao_id'));
      return;
    end if;
    if v_s.instituicao_id is null then
      -- subscrição nova para este lar: não substitui uma OUTRA que ainda não está cancelada (evento atrasado)
      select * into v_s from public.subscricoes_instituicao s where s.instituicao_id = v_inst for update;
      if found and v_s.estado <> 'cancelada' then
        perform private.alertar('subscricao_conflito', v_inst,
          jsonb_build_object('atual', v_s.stripe_subscription_id, 'recebida', p_op ->> 'stripe_subscription_id'));
        return;
      end if;
      v_s := null;
    end if;
    select * into v_i from public.instituicoes i where i.id = v_inst;
    insert into public.subscricoes_instituicao as s (instituicao_id, stripe_subscription_id, estado, inicio, compromisso_ate, cancelada_em)
    values (
      v_inst, p_op ->> 'stripe_subscription_id', (p_op ->> 'estado')::public.estado_subscricao,
      coalesce((p_op ->> 'inicio')::timestamptz, v_s.inicio),
      coalesce(v_s.compromisso_ate, private.compromisso_ate(v_i.natureza, v_i.plano, v_i.plano_desde)),
      case when p_op ->> 'estado' = 'cancelada' then coalesce((p_op ->> 'cancelada_em')::timestamptz, now()) end
    )
    on conflict (instituicao_id) do update
       set stripe_subscription_id = excluded.stripe_subscription_id,
           estado = excluded.estado,
           inicio = coalesce(excluded.inicio, s.inicio),
           compromisso_ate = excluded.compromisso_ate,
           cancelada_em = excluded.cancelada_em,
           atualizado_em = now();

  -- ——— faturas (cobranças das entradas e mensalidades)
  when 'fatura_estado' then
    select * into v_f from public.faturas f where f.stripe_invoice_id = p_op ->> 'stripe_invoice_id' for update;
    if not found and p_op ->> 'fatura_id' is not null then
      -- o finalized chegou antes de servico_cobranca_criada: liga-a pela metadata (só uma cobrança nossa)
      select * into v_f from public.faturas f where f.id = (p_op ->> 'fatura_id')::uuid and f.origem = 'entradas' for update;
      if found then
        if v_f.stripe_invoice_id is null then
          update public.faturas f set stripe_invoice_id = p_op ->> 'stripe_invoice_id', atualizado_em = now()
           where f.id = v_f.id returning * into v_f;
        else
          -- outra fatura do Stripe para a mesma cobrança (retoma depois das 24 h da chave): a equipa anula-a
          perform private.alertar('fatura_duplicada', p_op ->> 'stripe_invoice_id', jsonb_build_object('fatura_id', v_f.id));
          return;
        end if;
      end if;
    end if;
    if v_f.id is null and p_op ->> 'origem' = 'subscricao' and jsonb_typeof(p_op -> 'subscricao') = 'object' then
      v_sub := p_op -> 'subscricao';
      select * into v_s from public.subscricoes_instituicao s where s.stripe_subscription_id = v_sub ->> 'stripe_subscription_id' for update;
      if not found and v_sub ->> 'instituicao_id' is not null
         and exists (select 1 from public.instituicoes i where i.id = v_sub ->> 'instituicao_id')
         and not exists (select 1 from public.subscricoes_instituicao s where s.instituicao_id = v_sub ->> 'instituicao_id') then
        -- a primeira fatura chegou antes do registo da subscrição: liga-a pelo metadata
        insert into public.subscricoes_instituicao (instituicao_id, stripe_subscription_id, estado)
        values (v_sub ->> 'instituicao_id', v_sub ->> 'stripe_subscription_id', 'incompleta')
        returning * into v_s;
      end if;
      if v_s.instituicao_id is null then
        raise exception 'Subscrição desconhecida.' using errcode = 'P0002';
      end if;
      select * into v_i from public.instituicoes i where i.id = v_s.instituicao_id;
      v_pct := private.iva_instituicao(v_i.id, null);
      v_liquido := private.mensalidade_centimos();
      v_iva := private.iva_centimos(v_liquido, v_pct);
      v_total := v_liquido + v_iva;
      insert into public.faturas (instituicao_id, origem, periodo, estado, cobranca, stripe_invoice_id, stripe_subscription_id,
                                  numero, url_pagamento, periodo_inicio, periodo_fim, subtotal_centimos, iva_centimos,
                                  total_centimos, divergente, cliente)
      values (v_i.id, 'subscricao', date_trunc('month', (v_sub ->> 'periodo_inicio')::date::timestamp)::date, 'rascunho',
              'debito_automatico', p_op ->> 'stripe_invoice_id', v_s.stripe_subscription_id, p_op ->> 'numero', p_op ->> 'url',
              (v_sub ->> 'periodo_inicio')::date, (v_sub ->> 'periodo_fim')::date, v_liquido, v_iva, v_total,
              p_op ->> 'total_centimos' is not null and (p_op ->> 'total_centimos')::integer <> v_total,
              (select private.cliente_empresa(v_i.id) where exists (select 1 from public.dados_faturacao d where d.instituicao_id = v_i.id)))
      returning * into v_f;
      if v_f.divergente then
        perform private.alertar('subscricao_divergente', v_f.id::text,
          jsonb_build_object('esperado', v_total, 'stripe', (p_op ->> 'total_centimos')::integer));
      else
        v_dia := private.dia_lisboa((p_op ->> 'em')::timestamptz);
        insert into public.documentos_fiscais (tipo, origem, chave, instituicao_id, fatura_id, data, vencimento, cliente, linhas,
                                              total_centimos, iva_centimos, demonstracao)
        values ('FT', 'subscricao', 'FT:sub:' || (p_op ->> 'stripe_invoice_id'), v_i.id, v_f.id, v_dia, v_dia,
                private.cliente_empresa(v_i.id),
                jsonb_build_array(jsonb_build_object('tipo', 'mensalidade', 'periodo_inicio', v_sub ->> 'periodo_inicio',
                                                     'periodo_fim', v_sub ->> 'periodo_fim', 'valor_centimos', v_liquido,
                                                     'iva_percent', v_pct)),
                v_total, v_iva, v_i.demonstracao)
        on conflict (chave) do nothing;
      end if;
    end if;
    if v_f.id is null then
      return;
    end if;
    update public.faturas f
       set url_pagamento = coalesce(p_op ->> 'url', f.url_pagamento),
           numero = coalesce(p_op ->> 'numero', f.numero),
           atualizado_em = now()
     where f.id = v_f.id;
    perform private.transitar_fatura(
      v_f.id, (p_op ->> 'estado')::public.estado_fatura, coalesce((p_op ->> 'em')::timestamptz, now()),
      (p_op ->> 'motivo')::public.motivo_falha, p_op ->> 'metodo');

  -- ——— método de pagamento dos lares
  when 'metodo_definido' then
    select * into v_d from public.dados_faturacao d where d.stripe_customer_id = p_op ->> 'stripe_customer_id' for update;
    if not found then
      return;
    end if;
    if p_op ->> 'instituicao_id' is not null and p_op ->> 'instituicao_id' <> v_d.instituicao_id then
      perform private.alertar('metadata_divergente', v_d.instituicao_id,
        jsonb_build_object('stripe_customer_id', p_op ->> 'stripe_customer_id', 'metadata', p_op ->> 'instituicao_id'));
      return;
    end if;
    update public.dados_faturacao d
       set stripe_payment_method_id = p_op ->> 'payment_method_id',
           metodo_tipo = (p_op ->> 'tipo')::public.metodo_pagamento_b2b,
           metodo_ultimos4 = p_op ->> 'ultimos4',
           metodo_banco = p_op ->> 'banco',
           metodo_validade = p_op ->> 'validade',
           metodo_mandato_ref = p_op ->> 'mandato_ref',
           metodo_atualizado_em = now()
     where d.instituicao_id = v_d.instituicao_id;

  when 'metodo_removido' then
    select * into v_d from public.dados_faturacao d where d.stripe_payment_method_id = p_op ->> 'payment_method_id' for update;
    if not found then
      return;
    end if;
    update public.dados_faturacao d
       set stripe_payment_method_id = null, metodo_tipo = null, metodo_ultimos4 = null, metodo_banco = null,
           metodo_validade = null, metodo_mandato_ref = null, metodo_atualizado_em = null
     where d.instituicao_id = v_d.instituicao_id;
    perform private.alertar('metodo_removido', v_d.instituicao_id, '{}');
    select * into v_i from public.instituicoes i where i.id = v_d.instituicao_id;
    if v_i.owner_id is not null then
      perform private.notificar(
        v_i.owner_id, 'sistema', 'Método de pagamento removido',
        'O débito direto (ou o cartão) da faturação deixou de estar ativo. Configure outro em Faturação.',
        v_i.id, null, '/gestao/faturacao'
      );
    end if;

  when 'disputa' then
    perform private.alertar('disputa', coalesce(p_op ->> 'charge_id', '?'),
      jsonb_build_object('motivo', left(p_op ->> 'motivo', 100), 'valor_centimos', (p_op ->> 'valor_centimos')::integer,
                         'stripe_customer_id', p_op ->> 'stripe_customer_id', 'payment_intent_id', p_op ->> 'payment_intent_id'));

  else
    raise exception 'Operação desconhecida: %.', coalesce(v_tipo, '(sem op)') using errcode = '22023';
  end case;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 11. RPC de serviço (service_role)

-- Arrenda a fase por p_duracao_segundos; false se outra execução a tem.
create function private.servico_iniciar_execucao(p_fase text, p_duracao_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  perform private.exigir_servico();
  if p_fase is null or p_fase not in ('diario', 'cobranca') then
    raise exception 'Fase desconhecida.' using errcode = '22023';
  end if;
  if p_duracao_segundos is null or p_duracao_segundos not between 1 and 86400 then
    raise exception 'Duração do arrendamento inválida.' using errcode = '22023';
  end if;
  insert into private.execucoes_faturacao as e (fase, bloqueado_ate, iniciado_em)
  values (p_fase, now() + make_interval(secs => p_duracao_segundos), now())
  on conflict (fase) do update
     set bloqueado_ate = excluded.bloqueado_ate, iniciado_em = excluded.iniciado_em
   where e.bloqueado_ate is null or e.bloqueado_ate <= now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

-- Liberta o arrendamento e guarda o resumo (só contagens).
create function private.servico_terminar_execucao(p_fase text, p_resumo jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.exigir_servico();
  if p_fase is null or p_fase not in ('diario', 'cobranca') then
    raise exception 'Fase desconhecida.' using errcode = '22023';
  end if;
  insert into private.execucoes_faturacao as e (fase, bloqueado_ate, terminado_em, ultimo_resumo)
  values (p_fase, null, now(), case when jsonb_typeof(p_resumo) = 'object' then p_resumo else '{}' end)
  on conflict (fase) do update
     set bloqueado_ate = null, terminado_em = now(), ultimo_resumo = excluded.ultimo_resumo;
end;
$$;

-- ContextoInstituicaoRpc (portas.ts) ou null. Devolve `demonstracao` (não a exclui).
create function private.servico_contexto_instituicao(p_instituicao_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_i public.instituicoes;
  v_d public.dados_faturacao;
  v_c public.contratos;
begin
  perform private.exigir_servico();
  select * into v_i from public.instituicoes i where i.id = p_instituicao_id;
  if not found then
    return null;
  end if;
  select * into v_d from public.dados_faturacao d where d.instituicao_id = v_i.id;
  v_c := private.contrato_em_vigor(v_i.id, private.dia_lisboa(now()));
  return jsonb_build_object(
    'instituicao_id', v_i.id,
    'natureza', v_i.natureza,
    'demonstracao', v_i.demonstracao,
    'plano', v_i.plano,
    'dados', case when v_d.instituicao_id is null then null else jsonb_build_object(
               'razao_social', v_d.razao_social, 'nif', v_d.nif::text, 'morada', v_d.morada,
               'codigo_postal', v_d.codigo_postal, 'localidade', v_d.localidade, 'email', v_d.email) end,
    'contrato', case when v_c.id is null then null else jsonb_build_object(
               'referencia', v_c.referencia, 'taxa_entrada_centimos', v_c.taxa_entrada_centimos,
               'iva_percent', v_c.iva_percent, 'regiao_fiscal', v_c.regiao_fiscal) end,
    'iva_percent', private.iva_instituicao(v_i.id, null),
    'stripe_customer_id', v_d.stripe_customer_id,
    'stripe_payment_method_id', v_d.stripe_payment_method_id,
    'tem_metodo', v_d.metodo_tipo is not null
  );
end;
$$;

-- Guarda o cliente Stripe só se ainda não houver; devolve o que ficou (pode ser outro: a função apaga o duplicado).
create function private.servico_definir_cliente_stripe(p_instituicao_id text, p_customer_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.dados_faturacao;
begin
  perform private.exigir_servico();
  if not exists (select 1 from public.instituicoes i where i.id = p_instituicao_id) then
    raise exception 'Instituição desconhecida.' using errcode = 'P0002';
  end if;
  select * into v_d from public.dados_faturacao d where d.instituicao_id = p_instituicao_id for update;
  if not found then
    raise exception 'Sem dados de faturação.' using errcode = '22023';
  end if;
  if v_d.stripe_customer_id is null then
    update public.dados_faturacao d set stripe_customer_id = p_customer_id where d.instituicao_id = p_instituicao_id
    returning * into v_d;
  end if;
  return v_d.stripe_customer_id;
end;
$$;

-- Reserva uma linha nova (com o valor do contrato) para uma entrada faturável, se outra transação não a tiver.
-- Bloqueia o pedido (salta os bloqueados) e volta a classificá-lo já com o bloqueio (uma contestação simultânea
-- ganha ou perde por inteiro). Devolve a linha ou null.
create function private.reservar_linha(p_candidatura_id uuid, p_instituicao_id text, p_agora timestamptz)
returns public.fatura_linhas
language plpgsql
set search_path = ''
as $$
declare
  v_e record;
  v_v record;
  v_l public.fatura_linhas;
begin
  perform 1 from public.candidaturas c where c.id = p_candidatura_id for update skip locked;
  if not found then
    return null;
  end if;
  select * into v_e from private.entradas_faturacao(p_instituicao_id, p_agora, p_candidatura_id) e where e.estado = 'faturavel';
  if not found then
    return null;
  end if;
  select * into v_v from private.valor_entrada(p_instituicao_id, v_e.entrada_data);
  insert into public.fatura_linhas (instituicao_id, candidatura_id, contrato_id, referencia, entrada_data, faturavel_desde,
                                    valor_centimos, iva_percent, iva_centimos)
  values (p_instituicao_id, p_candidatura_id, v_v.contrato_id, v_e.referencia, v_e.entrada_data, v_e.faturavel_desde,
          v_v.valor_centimos, v_v.iva_percent, private.iva_centimos(v_v.valor_centimos, v_v.iva_percent))
  on conflict (candidatura_id) where anulada_em is null do nothing
  returning * into v_l;
  return v_l;
end;
$$;

-- Numa transação: linhas novas para as entradas `faturavel` e uma FT pendente por linha (modo fatura_por_entrada;
-- nos outros modos as linhas nascem na cobrança). Exclui a demonstração e os lares sem dados de faturação.
create function private.servico_reservar_documentos(p_modo text, p_agora timestamptz, p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e record;
  v_l public.fatura_linhas;
  v_n integer := 0;
  v_limite integer := greatest(coalesce(p_limite, 0), 0);
  v_dia date := private.dia_lisboa(p_agora);
  v_chave text;
  v_doc uuid;
begin
  perform private.exigir_servico();
  if p_modo is null or p_modo not in ('fatura_por_entrada', 'fatura_mensal', 'fatura_recibo_mensal') then
    raise exception 'Modo de documentos desconhecido.' using errcode = '22023';
  end if;
  if p_agora is null then
    raise exception 'Indique o instante (p_agora).' using errcode = '22023';
  end if;
  if p_modo <> 'fatura_por_entrada' then
    return jsonb_build_object('reservados', 0);
  end if;

  for v_e in
    select e.candidatura_id, e.instituicao_id
      from private.entradas_faturacao(null, p_agora) e
      join public.instituicoes i on i.id = e.instituicao_id
      join public.dados_faturacao d on d.instituicao_id = e.instituicao_id
     where e.estado = 'faturavel' and not i.demonstracao
     order by e.faturavel_desde, e.pedido_criado_em, e.candidatura_id
  loop
    exit when v_n >= v_limite;
    v_l := private.reservar_linha(v_e.candidatura_id, v_e.instituicao_id, p_agora);
    continue when v_l.id is null;
    v_chave := 'FT:' || v_e.candidatura_id;
    -- refaturação depois de uma nota de crédito (linha anterior anulada): chave nova
    if exists (select 1 from public.documentos_fiscais d where d.chave = v_chave) then
      v_chave := v_chave || ':' || v_l.id;
    end if;
    insert into public.documentos_fiscais (tipo, origem, chave, instituicao_id, data, vencimento, cliente, linhas,
                                          total_centimos, iva_centimos)
    values ('FT', 'entradas', v_chave, v_l.instituicao_id, v_dia, v_dia + 30, private.cliente_empresa(v_l.instituicao_id),
            jsonb_build_array(jsonb_build_object('tipo', 'entrada', 'referencia', v_l.referencia, 'entrada_data', v_l.entrada_data,
                                                 'valor_centimos', v_l.valor_centimos, 'iva_percent', v_l.iva_percent)),
            v_l.total_centimos, v_l.iva_centimos)
    returning id into v_doc;
    update public.fatura_linhas l set documento_id = v_doc where l.id = v_l.id;
    v_n := v_n + 1;
  end loop;
  return jsonb_build_object('reservados', v_n);
end;
$$;

-- DocumentoPendenteRpc (portas.ts) de um documento.
create function private.documento_pendente_json(p_d public.documentos_fiscais)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_d.id, 'tipo', p_d.tipo, 'chave', p_d.chave, 'tentativas', p_d.tentativas, 'origem', p_d.origem,
    'instituicao_id', p_d.instituicao_id, 'user_id', p_d.user_id, 'pagamento_id', p_d.pagamento_id, 'fatura_id', p_d.fatura_id,
    'data', p_d.data, 'vencimento', p_d.vencimento, 'cliente', p_d.cliente, 'linhas', p_d.linhas, 'pagamento', p_d.pagamento,
    'documentos_associados', case when p_d.tipo = 'RC' then (
        select coalesce(jsonb_agg(jsonb_build_object('documento_id', a.id, 'externo_id', a.externo_id, 'numero', a.numero,
                                                     'total_centimos', a.total_centimos) order by a.ordem), '[]')
          from public.documentos_fiscais a
         where a.fatura_id = p_d.fatura_id and a.tipo = 'FT' and a.estado = 'emitido'
      ) else '[]'::jsonb end,
    'total_centimos', p_d.total_centimos, 'iva_centimos', p_d.iva_centimos, 'demonstracao', p_d.demonstracao
  );
$$;

-- Documentos prontos a emitir: pendentes ou em erro com a próxima tentativa vencida (p_agora), sem demonstração
-- nem NC (essas são da equipa); um RC só depois de todas as suas FT emitidas; FT/FR antes de RC, por ordem de
-- criação. Os devolvidos ficam reservados 10 minutos (outra execução simultânea — o webhook e a tarefa diária —
-- não os emite em duplicado; se a função morrer, voltam depois disso).
create function private.servico_documentos_pendentes(p_agora timestamptz, p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids uuid[];
begin
  perform private.exigir_servico();
  if p_agora is null then
    raise exception 'Indique o instante (p_agora).' using errcode = '22023';
  end if;
  select coalesce(array_agg(x.id order by x.recibo, x.ordem), '{}') into v_ids
    from (
      select d.id, d.tipo = 'RC' as recibo, d.ordem
        from public.documentos_fiscais d
       where d.estado in ('pendente', 'erro')
         and not d.demonstracao
         and d.tipo <> 'NC'
         and (d.proxima_tentativa_em is null or d.proxima_tentativa_em <= p_agora)
         and (d.tipo <> 'RC' or (
               exists (select 1 from public.documentos_fiscais a where a.fatura_id = d.fatura_id and a.tipo = 'FT' and a.estado <> 'anulado')
               and not exists (select 1 from public.documentos_fiscais a
                                where a.fatura_id = d.fatura_id and a.tipo = 'FT' and a.estado not in ('emitido', 'anulado'))))
       order by d.tipo = 'RC', d.ordem
       limit greatest(coalesce(p_limite, 0), 0)
       for update of d skip locked
    ) x;
  update public.documentos_fiscais d set proxima_tentativa_em = p_agora + interval '10 minutes' where d.id = any (v_ids);
  return (
    select coalesce(jsonb_agg(private.documento_pendente_json(d) order by d.tipo = 'RC', d.ordem), '[]')
      from public.documentos_fiscais d
     where d.id = any (v_ids)
  );
end;
$$;

-- Marca o documento `emitido` (idempotente). Exceção se o total ou o IVA diferirem dos esperados. FT dos lares:
-- avisa "Fatura emitida". FR das famílias: liga-a ao pagamento.
create function private.servico_documento_emitido(
  p_id uuid,
  p_externo_id text,
  p_numero text,
  p_total_centimos integer,
  p_iva_centimos integer,
  p_emitido_em timestamptz,
  p_emissor text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d public.documentos_fiscais;
  v_owner uuid;
begin
  perform private.exigir_servico();
  select * into v_d from public.documentos_fiscais d where d.id = p_id for update;
  if not found then
    raise exception 'Documento desconhecido.' using errcode = 'P0002';
  end if;
  if v_d.estado = 'emitido' then
    if v_d.externo_id is distinct from p_externo_id then
      -- dois documentos no emissor para o mesmo registo: a equipa anula um com uma nota de crédito
      perform private.alertar('documento_duplicado', v_d.id::text, jsonb_build_object('numero', p_numero));
    end if;
    return;
  end if;
  if v_d.estado = 'anulado' then
    raise exception 'O documento foi anulado.' using errcode = '22023';
  end if;
  if p_emissor is null or p_emissor not in ('moloni', 'falso') then
    raise exception 'Emissor desconhecido.' using errcode = '22023';
  end if;
  if v_d.demonstracao and p_emissor = 'moloni' then
    raise exception 'Os documentos de demonstração nunca vão ao Moloni.' using errcode = '42501';
  end if;
  if p_total_centimos is distinct from v_d.total_centimos or (v_d.tipo <> 'RC' and p_iva_centimos is distinct from v_d.iva_centimos) then
    raise exception 'Totais diferentes dos esperados.' using errcode = '22023';
  end if;
  update public.documentos_fiscais d
     set estado = 'emitido', externo_id = p_externo_id, numero = p_numero, emitido_em = coalesce(p_emitido_em, now()),
         emissor = p_emissor::public.emissor_documento, ultimo_erro = null, proxima_tentativa_em = null
   where d.id = v_d.id;

  if v_d.tipo = 'FT' and v_d.instituicao_id is not null then
    select i.owner_id into v_owner from public.instituicoes i where i.id = v_d.instituicao_id;
    if v_owner is not null then
      perform private.notificar(
        v_owner, 'sistema', 'Fatura emitida',
        format('A fatura %s (%s) está disponível em Faturação.', p_numero, private.euros(v_d.total_centimos)),
        v_d.instituicao_id, null, '/gestao/faturacao'
      );
    end if;
  elsif v_d.tipo = 'FR' and v_d.pagamento_id is not null then
    update public.pagamentos_familia p set documento_id = v_d.id where p.id = v_d.pagamento_id;
  end if;
end;
$$;

-- tentativas + 1, estado `erro`, próxima tentativa com recuo exponencial (15 min, 30 min, 1 h… até 24 h).
-- À 10.ª tentativa alerta a equipa. p_erro sem dados pessoais (≤ 500).
create function private.servico_documento_falhou(p_id uuid, p_erro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tentativas integer;
begin
  perform private.exigir_servico();
  update public.documentos_fiscais d
     set estado = 'erro',
         tentativas = d.tentativas + 1,
         ultimo_erro = left(coalesce(nullif(btrim(p_erro), ''), 'Erro sem descrição.'), 500),
         proxima_tentativa_em = now() + least(interval '15 minutes' * power(2, least(d.tentativas, 10)), interval '24 hours')
   where d.id = p_id and d.estado in ('pendente', 'erro')
  returning d.tentativas into v_tentativas;
  if v_tentativas = 10 then
    perform private.alertar('documento_bloqueado', p_id::text, jsonb_build_object('tentativas', v_tentativas));
  end if;
end;
$$;

-- DocumentoExternoRpc: só documentos emitidos (faturacao-documento chama-a depois de o RLS provar a posse).
create function private.servico_documento_externo(p_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_d public.documentos_fiscais;
begin
  perform private.exigir_servico();
  select * into v_d from public.documentos_fiscais d where d.id = p_id and d.estado = 'emitido';
  if not found then
    return null;
  end if;
  return jsonb_build_object('id', v_d.id, 'tipo', v_d.tipo, 'numero', v_d.numero, 'externo_id', v_d.externo_id, 'emissor', v_d.emissor);
end;
$$;

-- CobrancaPreparadaRpc de uma fatura.
create function private.cobranca_preparada_json(p_fatura_id uuid)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'fatura_id', f.id, 'instituicao_id', f.instituicao_id, 'periodo', f.periodo,
    'stripe_customer_id', d.stripe_customer_id, 'stripe_payment_method_id', d.stripe_payment_method_id,
    'linhas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'referencia', l.referencia, 'entrada_data', l.entrada_data, 'valor_centimos', l.valor_centimos,
               'iva_percent', l.iva_percent, 'iva_centimos', l.iva_centimos, 'documento_numero', doc.numero) order by l.ordem), '[]')
        from public.fatura_linhas l
        left join public.documentos_fiscais doc on doc.id = l.documento_id and doc.estado = 'emitido'
       where l.fatura_id = f.id
    ),
    'subtotal_centimos', f.subtotal_centimos, 'iva_centimos', f.iva_centimos, 'total_centimos', f.total_centimos
  )
  from public.faturas f
  left join public.dados_faturacao d on d.instituicao_id = f.instituicao_id
  where f.id = p_fatura_id;
$$;

-- Dia 1: uma fatura `rascunho` (origem 'entradas') por lar com linhas por cobrar, sem stripe_invoice_id. Retoma:
-- devolve primeiro os rascunhos que ficaram de uma execução que caiu (as chaves de idempotência do Stripe e a
-- metadata.fatura_id do invoice.finalized ligam-nos). No modo por entrada só entram linhas com a FT já emitida
-- (nunca se cobra uma fatura que ainda não existe); nos modos mensais as linhas nascem aqui (e no fatura_mensal
-- a FT global fica na fila). Exclui a demonstração e os lares sem cliente Stripe. Lotes de p_limite lares.
create function private.servico_preparar_cobrancas(p_modo text, p_agora timestamptz, p_limite integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limite integer := greatest(coalesce(p_limite, 0), 0);
  v_periodo date;
  v_dia date := private.dia_lisboa(p_agora);
  v_ids uuid[];
  v_e record;
  v_i record;
  v_linhas uuid[];
  v_f public.faturas;
  v_sub integer;
  v_iva integer;
begin
  perform private.exigir_servico();
  if p_modo is null or p_modo not in ('fatura_por_entrada', 'fatura_mensal', 'fatura_recibo_mensal') then
    raise exception 'Modo de documentos desconhecido.' using errcode = '22023';
  end if;
  if p_agora is null then
    raise exception 'Indique o instante (p_agora).' using errcode = '22023';
  end if;
  v_periodo := (date_trunc('month', p_agora at time zone 'Europe/Lisbon') - interval '1 month')::date;

  -- 1. retoma
  select coalesce(array_agg(x.id order by x.ordem), '{}') into v_ids
    from (
      select f.id, f.ordem
        from public.faturas f
        join public.instituicoes i on i.id = f.instituicao_id
        join public.dados_faturacao d on d.instituicao_id = f.instituicao_id
       where f.origem = 'entradas' and f.estado = 'rascunho' and f.stripe_invoice_id is null
         and not i.demonstracao and d.stripe_customer_id is not null
       order by f.ordem
       limit v_limite
    ) x;

  -- 2. modos mensais: as linhas das entradas faturáveis nascem aqui (sem FT por entrada)
  if p_modo <> 'fatura_por_entrada' then
    for v_e in
      select e.candidatura_id, e.instituicao_id
        from private.entradas_faturacao(null, p_agora) e
        join public.instituicoes i on i.id = e.instituicao_id
        join public.dados_faturacao d on d.instituicao_id = e.instituicao_id
       where e.estado = 'faturavel' and not i.demonstracao and d.stripe_customer_id is not null
       order by e.faturavel_desde, e.pedido_criado_em, e.candidatura_id
    loop
      perform private.reservar_linha(v_e.candidatura_id, v_e.instituicao_id, p_agora);
    end loop;
  end if;

  -- 3. cobranças novas
  for v_i in
    select i.id
      from public.instituicoes i
      join public.dados_faturacao d on d.instituicao_id = i.id
     where not i.demonstracao and d.stripe_customer_id is not null
       and exists (select 1 from public.fatura_linhas l where l.instituicao_id = i.id and l.fatura_id is null and l.anulada_em is null)
       and not exists (select 1 from public.faturas f
                        where f.instituicao_id = i.id and f.origem = 'entradas' and f.periodo = v_periodo and f.estado <> 'anulada')
     order by i.id
  loop
    exit when cardinality(v_ids) >= v_limite;
    select array_agg(x.id order by x.ordem), sum(x.valor_centimos), sum(x.iva_centimos)
      into v_linhas, v_sub, v_iva
      from (
        select l.id, l.ordem, l.valor_centimos, l.iva_centimos
          from public.fatura_linhas l
         where l.instituicao_id = v_i.id and l.fatura_id is null and l.anulada_em is null
           and (p_modo <> 'fatura_por_entrada'
                or exists (select 1 from public.documentos_fiscais doc where doc.id = l.documento_id and doc.estado = 'emitido'))
         order by l.ordem
         for update of l
      ) x;
    continue when v_linhas is null;
    insert into public.faturas (instituicao_id, origem, contrato_id, periodo, estado, modo_documento, cliente,
                                subtotal_centimos, iva_centimos, total_centimos, cobranca)
    values (v_i.id, 'entradas', (private.contrato_em_vigor(v_i.id, v_dia)).id, v_periodo, 'rascunho',
            p_modo::public.modo_documento, private.cliente_empresa(v_i.id), v_sub, v_iva, v_sub + v_iva,
            case when (select d.stripe_payment_method_id from public.dados_faturacao d where d.instituicao_id = v_i.id) is not null
                 then 'debito_automatico' else 'pagamento_por_link' end::public.cobranca_fatura)
    returning * into v_f;
    update public.fatura_linhas l set fatura_id = v_f.id where l.id = any (v_linhas);
    update public.documentos_fiscais doc set fatura_id = v_f.id
     where doc.id in (select l.documento_id from public.fatura_linhas l where l.id = any (v_linhas) and l.documento_id is not null);
    if p_modo = 'fatura_mensal' then
      -- FT global do mês (o RC segue quando for paga)
      insert into public.documentos_fiscais (tipo, origem, chave, instituicao_id, fatura_id, data, vencimento, cliente, linhas,
                                            total_centimos, iva_centimos)
      select 'FT', 'entradas', 'FT:' || v_f.id, v_f.instituicao_id, v_f.id, v_dia, v_dia + 30, v_f.cliente,
             jsonb_agg(jsonb_build_object('tipo', 'entrada', 'referencia', l.referencia, 'entrada_data', l.entrada_data,
                                          'valor_centimos', l.valor_centimos, 'iva_percent', l.iva_percent) order by l.ordem),
             v_f.total_centimos, v_f.iva_centimos
        from public.fatura_linhas l
       where l.fatura_id = v_f.id;
    end if;
    v_ids := v_ids || v_f.id;
  end loop;

  return (
    select coalesce(jsonb_agg(private.cobranca_preparada_json(u.id) order by u.n), '[]')
      from unnest(v_ids) with ordinality as u (id, n)
  );
end;
$$;

-- A cobrança foi criada no Stripe: guarda o id, o número e a página, e passa a `emitida` (avisa o lar).
create function private.servico_cobranca_criada(
  p_fatura_id uuid,
  p_stripe_invoice_id text,
  p_numero text,
  p_url text,
  p_cobranca text,
  p_debito_em timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_f public.faturas;
  v_owner uuid;
begin
  perform private.exigir_servico();
  select * into v_f from public.faturas f where f.id = p_fatura_id for update;
  if not found then
    raise exception 'Fatura desconhecida.' using errcode = 'P0002';
  end if;
  if p_cobranca is null or p_cobranca not in ('debito_automatico', 'pagamento_por_link') then
    raise exception 'Forma de cobrança desconhecida.' using errcode = '22023';
  end if;
  if v_f.stripe_invoice_id is not null and v_f.stripe_invoice_id <> p_stripe_invoice_id then
    raise exception 'A fatura já está ligada a outra cobrança do Stripe.' using errcode = '22023';
  end if;
  update public.faturas f
     set stripe_invoice_id = p_stripe_invoice_id,
         numero = coalesce(p_numero, f.numero),
         url_pagamento = coalesce(p_url, f.url_pagamento),
         cobranca = p_cobranca::public.cobranca_fatura,
         debito_em = case when p_cobranca = 'debito_automatico' then p_debito_em end,
         atualizado_em = now()
   where f.id = v_f.id
  returning * into v_f;

  if private.transitar_fatura(v_f.id, 'emitida', now()) then
    select i.owner_id into v_owner from public.instituicoes i where i.id = v_f.instituicao_id;
    if v_owner is not null then
      perform private.notificar(
        v_owner, 'sistema', 'Cobrança de ' || private.mes_extenso(v_f.periodo),
        case when v_f.cobranca = 'debito_automatico' and v_f.debito_em is not null
             then format('%s por débito direto a %s. As faturas estão em Faturação.',
                         private.euros(v_f.total_centimos), private.data_longa(v_f.debito_em))
             else format('%s para pagar por cartão ou transferência. Veja em Faturação.', private.euros(v_f.total_centimos)) end,
        v_f.instituicao_id, null, '/gestao/faturacao'
      );
    end if;
  end if;
end;
$$;

-- CobrancaADebitarRpc: faturas `emitida` das entradas com débito automático vencido (pré-aviso cumprido).
create function private.servico_cobrancas_a_debitar(p_agora timestamptz, p_limite integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_servico();
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'fatura_id', x.id, 'instituicao_id', x.instituicao_id, 'stripe_invoice_id', x.stripe_invoice_id,
             'total_centimos', x.total_centimos, 'debito_em', x.debito_em, 'tentativas', x.tentativas) order by x.debito_em, x.ordem), '[]')
      from (
        select f.* from public.faturas f
          join public.instituicoes i on i.id = f.instituicao_id
         where f.origem = 'entradas' and f.estado = 'emitida' and f.cobranca = 'debito_automatico'
           and f.debito_em <= p_agora and f.stripe_invoice_id is not null and not i.demonstracao
         order by f.debito_em, f.ordem
         limit greatest(coalesce(p_limite, 0), 0)
      ) x
  );
end;
$$;

-- Resultado imediato de invoices.pay (SEPA → em_processamento; cartão → paga/falhou): as mesmas transições e
-- efeitos que fatura_estado.
create function private.servico_cobranca_debito_iniciado(p_fatura_id uuid, p_estado text, p_motivo text, p_em timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.exigir_servico();
  if p_estado is null or p_estado not in ('em_processamento', 'paga', 'falhou') then
    raise exception 'Estado do débito inválido.' using errcode = '22023';
  end if;
  update public.faturas f set tentativas = f.tentativas + 1, atualizado_em = now() where f.id = p_fatura_id;
  if not found then
    raise exception 'Fatura desconhecida.' using errcode = 'P0002';
  end if;
  perform private.transitar_fatura(p_fatura_id, p_estado::public.estado_fatura, coalesce(p_em, now()), p_motivo::public.motivo_falha, null);
end;
$$;

-- Webhook, passo 4: 'repetido' só se o evento já foi aplicado; um evento que falhou volta a ser 'novo'.
create function private.servico_evento_iniciar(p_id text, p_tipo text, p_livemode boolean, p_criado_em timestamptz)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.stripe_eventos;
begin
  perform private.exigir_servico();
  select * into v_e from public.stripe_eventos e where e.id = p_id for update;
  if not found then
    insert into public.stripe_eventos (id, tipo, livemode, criado_em)
    values (p_id, p_tipo, coalesce(p_livemode, false), coalesce(p_criado_em, now()))
    on conflict (id) do nothing;
    if found then
      return 'novo';
    end if;
    -- outra entrega do mesmo evento inseriu-o entretanto
    select * into v_e from public.stripe_eventos e where e.id = p_id for update;
  end if;
  if v_e.processado_em is not null then
    return 'repetido';
  end if;
  update public.stripe_eventos e set tentativas = e.tentativas + 1 where e.id = p_id;
  return 'novo';
end;
$$;

-- Webhook, passo 6: aplica as operações por ordem numa transação e carimba processado_em, só se ainda for null
-- (bloqueia o evento: duas entregas simultâneas aplicam uma vez). true = aplicou agora.
create function private.servico_evento_aplicar(p_id text, p_operacoes jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_e public.stripe_eventos;
  v_op record;
begin
  perform private.exigir_servico();
  select * into v_e from public.stripe_eventos e where e.id = p_id for update;
  if not found then
    raise exception 'Evento não iniciado.' using errcode = 'P0002';
  end if;
  if v_e.processado_em is not null then
    return false;
  end if;
  if p_operacoes is null or jsonb_typeof(p_operacoes) <> 'array' then
    raise exception 'As operações têm de ser uma lista.' using errcode = '22023';
  end if;
  for v_op in select x.op from jsonb_array_elements(p_operacoes) with ordinality as x (op, n) order by x.n loop
    if jsonb_typeof(v_op.op) <> 'object' then
      raise exception 'Operação inválida.' using errcode = '22023';
    end if;
    perform private.aplicar_operacao_evento(v_op.op);
  end loop;
  update public.stripe_eventos e set processado_em = now(), erro = null, operacoes = p_operacoes where e.id = p_id;
  return true;
end;
$$;

create function private.servico_evento_falhou(p_id text, p_erro text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.exigir_servico();
  update public.stripe_eventos e
     set erro = left(coalesce(nullif(btrim(p_erro), ''), 'Erro sem descrição.'), 500)
   where e.id = p_id and e.processado_em is null;
end;
$$;

-- Acesso Família, antes do Checkout: valida a conta (família, não anónima), o plano, a versão do consentimento e
-- o NIF opcional; regista o consentimento e um pagamento `pendente`. 999999990 = sem NIF (consumidor final).
create function private.servico_acesso_iniciar(
  p_user_id uuid,
  p_plano text,
  p_texto_versao text,
  p_ip text default null,
  p_nif text default null,
  p_nome_fiscal text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_perfil public.perfis_utilizador;
  v_plano public.plano_familia;
  v_nif text;
  v_nome text;
  v_erro text;
  v_ip text;
  v_p public.pagamentos_familia;
begin
  perform private.exigir_servico();
  select p.* into v_perfil
    from public.perfis_utilizador p
    join auth.users u on u.id = p.id
   where p.id = p_user_id and p.role = 'familia' and not coalesce(u.is_anonymous, false);
  if not found then
    raise exception 'O Acesso Família é para contas de família.' using errcode = '42501';
  end if;
  if p_plano is null or p_plano not in ('acesso_30', 'acesso_90') then
    raise exception 'Plano desconhecido.' using errcode = '22023';
  end if;
  v_plano := p_plano::public.plano_familia;
  if nullif(btrim(coalesce(p_texto_versao, '')), '') is null or char_length(btrim(p_texto_versao)) > 100 then
    raise exception 'Falta a versão do consentimento.' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_nif, '')), '') is not null then
    v_nif := private.normalizar_nif(p_nif);
    v_erro := private.erro_nif(v_nif, false);
    if v_erro is not null then
      raise exception '%', v_erro using errcode = '22023';
    end if;
    if v_nif = '999999990' then
      v_nif := null;
    end if;
  end if;
  if v_nif is not null then
    v_nome := nullif(left(btrim(coalesce(p_nome_fiscal, '')), 200), '');
  end if;
  v_ip := case when p_ip ~ '^[0-9A-Fa-f:.]{2,64}$' then p_ip end;
  -- travão contra abuso: no máximo 10 compras iniciadas por hora e por conta
  if (select count(*) from public.pagamentos_familia p where p.user_id = p_user_id and p.criado_em > now() - interval '1 hour') >= 10 then
    raise exception 'Demasiadas tentativas de compra. Tente de novo daqui a uns minutos.' using errcode = '22023';
  end if;

  insert into public.pagamentos_familia (user_id, plano, valor_centimos, dias, fatura_nif, fatura_nome, demonstracao)
  values (p_user_id, v_plano, private.preco_plano_familia(v_plano), private.dias_plano_familia(v_plano), v_nif, v_nome,
          coalesce(v_perfil.demonstracao, false))
  returning * into v_p;
  insert into public.consentimentos_acesso (user_id, pagamento_id, plano, texto_versao, aceite_em, ip_truncado)
  values (p_user_id, v_p.id, v_plano, btrim(p_texto_versao), v_p.criado_em, v_ip);

  return jsonb_build_object('pagamento_id', v_p.id, 'valor_centimos', v_p.valor_centimos, 'plano', v_p.plano,
                            'dias', v_p.dias, 'demonstracao', v_p.demonstracao);
end;
$$;

-- Liga a sessão do Checkout ao pagamento (só se ainda `pendente` e sem sessão).
create function private.servico_acesso_sessao_criada(p_pagamento_id uuid, p_session_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.pagamentos_familia;
begin
  perform private.exigir_servico();
  select * into v_p from public.pagamentos_familia p where p.id = p_pagamento_id for update;
  if not found then
    raise exception 'Pagamento desconhecido.' using errcode = 'P0002';
  end if;
  if v_p.estado = 'pendente' and v_p.stripe_checkout_session_id is null then
    update public.pagamentos_familia p set stripe_checkout_session_id = p_session_id, atualizado_em = now() where p.id = v_p.id;
  end if;
end;
$$;

-- ContextoSubscricaoRpc (portas.ts) ou null. Devolve `demonstracao` (não a exclui).
create function private.servico_subscricao_contexto(p_instituicao_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_i public.instituicoes;
  v_d public.dados_faturacao;
  v_s public.subscricoes_instituicao;
begin
  perform private.exigir_servico();
  select * into v_i from public.instituicoes i where i.id = p_instituicao_id;
  if not found then
    return null;
  end if;
  select * into v_d from public.dados_faturacao d where d.instituicao_id = v_i.id;
  select * into v_s from public.subscricoes_instituicao s where s.instituicao_id = v_i.id;
  return jsonb_build_object(
    'instituicao_id', v_i.id,
    'natureza', v_i.natureza,
    'demonstracao', v_i.demonstracao,
    'plano', v_i.plano,
    'plano_desde', v_i.plano_desde,
    'compromisso_ate', private.compromisso_ate(v_i.natureza, v_i.plano, v_i.plano_desde),
    'stripe_customer_id', v_d.stripe_customer_id,
    'stripe_payment_method_id', v_d.stripe_payment_method_id,
    'tem_metodo', v_d.metodo_tipo is not null and v_d.stripe_payment_method_id is not null,
    'iva_percent', private.iva_instituicao(v_i.id, null),
    'subscricao', case when v_s.instituicao_id is null then null else jsonb_build_object(
                    'stripe_subscription_id', v_s.stripe_subscription_id, 'estado', v_s.estado,
                    'inicio', v_s.inicio, 'compromisso_ate', v_s.compromisso_ate) end
  );
end;
$$;

-- Regista a subscrição criada/cancelada por plano-instituicao (antes de o webhook chegar). Idempotente.
create function private.servico_subscricao_registar(
  p_instituicao_id text,
  p_stripe_subscription_id text,
  p_estado text,
  p_inicio timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.instituicoes;
begin
  perform private.exigir_servico();
  select * into v_i from public.instituicoes i where i.id = p_instituicao_id for update;
  if not found then
    raise exception 'Instituição desconhecida.' using errcode = 'P0002';
  end if;
  if p_estado is null or p_estado not in ('incompleta', 'ativa', 'em_atraso', 'cancelada') then
    raise exception 'Estado da subscrição inválido.' using errcode = '22023';
  end if;
  insert into public.subscricoes_instituicao as s (instituicao_id, stripe_subscription_id, estado, inicio, compromisso_ate, cancelada_em)
  values (
    v_i.id, p_stripe_subscription_id, p_estado::public.estado_subscricao, p_inicio,
    private.compromisso_ate(v_i.natureza, v_i.plano, v_i.plano_desde),
    case when p_estado = 'cancelada' then now() end
  )
  on conflict (instituicao_id) do update
     set stripe_subscription_id = excluded.stripe_subscription_id,
         estado = excluded.estado,
         inicio = coalesce(excluded.inicio, s.inicio),
         compromisso_ate = coalesce(excluded.compromisso_ate, s.compromisso_ate),
         cancelada_em = case when excluded.estado = 'cancelada' then coalesce(s.cancelada_em, now()) end,
         atualizado_em = now();
end;
$$;

-- Lares cuja modalidade e subscrição divergem (sem demonstração): criar (mensal, com método, sem subscrição
-- viva) ou cancelar (por entrada com subscrição viva).
create function private.servico_subscricoes_a_sincronizar(p_limite integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.exigir_servico();
  return (
    select coalesce(jsonb_agg(jsonb_build_object('instituicao_id', x.id, 'acao', x.acao, 'stripe_subscription_id', x.sub) order by x.id), '[]')
      from (
        select i.id,
               case when i.plano = 'mensal' then 'criar' else 'cancelar' end as acao,
               case when i.plano = 'mensal' then null else s.stripe_subscription_id end as sub
          from public.instituicoes i
          left join public.subscricoes_instituicao s on s.instituicao_id = i.id
          left join public.dados_faturacao d on d.instituicao_id = i.id
         where not i.demonstracao and i.natureza = 'privado'
           and (
             (i.plano = 'mensal' and (s.instituicao_id is null or s.estado = 'cancelada') and d.metodo_tipo is not null)
             or (i.plano is distinct from 'mensal' and s.instituicao_id is not null and s.estado <> 'cancelada')
           )
         order by i.id
         limit greatest(coalesce(p_limite, 0), 0)
      ) x
  );
end;
$$;

-- A equipa decide uma contestação (aceite: a entrada não se fatura; rejeitada: fatura-se desde a decisão).
-- Avisa o lar. Repetir a mesma decisão devolve a já registada.
create function private.resolver_contestacao(p_candidatura_id uuid, p_decisao text, p_nota text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ct public.contestacoes_entrada;
  v_owner uuid;
  v_ref text := private.referencia_pedido(p_candidatura_id);
begin
  perform private.exigir_servico();
  if p_decisao is null or p_decisao not in ('aceite', 'rejeitada') then
    raise exception 'Decisão inválida: aceite ou rejeitada.' using errcode = '22023';
  end if;
  select * into v_ct from public.contestacoes_entrada c where c.candidatura_id = p_candidatura_id for update;
  if not found then
    raise exception 'Contestação não encontrada.' using errcode = 'P0002';
  end if;
  if v_ct.estado <> 'aberta' then
    if v_ct.estado::text = p_decisao then
      return jsonb_build_object('candidatura_id', v_ct.candidatura_id, 'estado', v_ct.estado, 'resolvida_em', v_ct.resolvida_em);
    end if;
    raise exception 'A contestação já foi resolvida.' using errcode = '22023';
  end if;
  update public.contestacoes_entrada c
     set estado = p_decisao::public.estado_contestacao, resolvida_em = now(),
         nota_resolucao = nullif(left(btrim(coalesce(p_nota, '')), 1000), '')
   where c.candidatura_id = p_candidatura_id
  returning * into v_ct;

  select i.owner_id into v_owner from public.instituicoes i where i.id = v_ct.instituicao_id;
  if v_owner is not null then
    perform private.notificar(
      v_owner, 'sistema',
      case p_decisao when 'aceite' then 'Contestação aceite' else 'Contestação recusada' end,
      case p_decisao
        when 'aceite' then format('A entrada do pedido %s não vai ser cobrada.', v_ref)
        else format('A entrada do pedido %s fica faturável.%s', v_ref,
                    coalesce(' ' || v_ct.nota_resolucao, ''))
      end,
      v_ct.instituicao_id, null, '/gestao/faturacao'
    );
  end if;
  return jsonb_build_object('candidatura_id', v_ct.candidatura_id, 'estado', v_ct.estado, 'resolvida_em', v_ct.resolvida_em);
end;
$$;

-- ————————————————————————————————————————————————————————————————— 12. RPC dos utilizadores

-- O dono (instituição) com sessão, não anónima: a ficha que gere.
create function private.instituicao_da_faturacao(p_mensagem text)
returns public.instituicoes
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_i public.instituicoes;
begin
  perform private.exigir_sessao();
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception '%', p_mensagem using errcode = '42501';
  end if;
  select * into v_i from public.instituicoes i where i.id = private.minha_instituicao();
  if not found then
    raise exception '%', p_mensagem using errcode = '42501';
  end if;
  return v_i;
end;
$$;

-- ResumoFaturacaoRpc (portas.ts): tudo o que a página Faturação do lar mostra, numa ida. IPSS/Misericórdia:
-- isenta e o resto vazio.
create function private.faturacao_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_i public.instituicoes := private.instituicao_da_faturacao('Só a instituição pode ver a faturação.');
  v_agora timestamptz := now();
  v_hoje date := private.dia_lisboa(now());
  v_prox date := (date_trunc('month', now() at time zone 'Europe/Lisbon') + interval '1 month')::date;
  v_d public.dados_faturacao;
  v_c public.contratos;
  v_s public.subscricoes_instituicao;
  v_linhas jsonb;
  v_sub integer;
  v_iva integer;
begin
  if v_i.natureza <> 'privado' then
    return jsonb_build_object(
      'instituicao_id', v_i.id, 'isenta', true, 'agora', v_agora, 'plano', null, 'plano_desde', null,
      'compromisso_ate', null, 'subscricao', null, 'contrato', null, 'dados', null, 'metodo', null,
      'proxima', jsonb_build_object('data', v_prox, 'debito_em', null, 'linhas', '[]'::jsonb,
                                    'subtotal_centimos', 0, 'iva_centimos', 0, 'total_centimos', 0),
      'entradas', '[]'::jsonb, 'faturas', '[]'::jsonb
    );
  end if;
  select * into v_d from public.dados_faturacao d where d.instituicao_id = v_i.id;
  v_c := private.contrato_em_vigor(v_i.id, v_hoje);
  if v_c.id is null then
    select * into v_c from public.contratos c where c.instituicao_id = v_i.id order by c.inicio desc limit 1;
  end if;
  select * into v_s from public.subscricoes_instituicao s where s.instituicao_id = v_i.id;

  -- próxima cobrança: linhas já reservadas e por cobrar + entradas faturáveis que a tarefa diária ainda vai reservar
  select coalesce(jsonb_agg(to_jsonb(x) - 'o' order by x.o), '[]'), coalesce(sum(x.valor_centimos), 0), coalesce(sum(x.iva_centimos), 0)
    into v_linhas, v_sub, v_iva
    from (
      select l.candidatura_id, l.referencia, l.entrada_data, l.valor_centimos, l.iva_percent, l.iva_centimos,
             l.total_centimos, doc.numero as documento_numero, l.faturavel_desde as o
        from public.fatura_linhas l
        left join public.documentos_fiscais doc on doc.id = l.documento_id and doc.estado = 'emitido'
       where l.instituicao_id = v_i.id and l.fatura_id is null and l.anulada_em is null
      union all
      select e.candidatura_id, e.referencia, e.entrada_data, v.valor_centimos, v.iva_percent,
             private.iva_centimos(v.valor_centimos, v.iva_percent),
             v.valor_centimos + private.iva_centimos(v.valor_centimos, v.iva_percent), null::text, e.faturavel_desde
        from private.entradas_faturacao(v_i.id, v_agora) e
       cross join lateral private.valor_entrada(v_i.id, e.entrada_data) v
       where e.estado = 'faturavel'
    ) x;

  return jsonb_build_object(
    'instituicao_id', v_i.id,
    'isenta', false,
    'agora', v_agora,
    'plano', v_i.plano,
    'plano_desde', v_i.plano_desde,
    'compromisso_ate', private.compromisso_ate(v_i.natureza, v_i.plano, v_i.plano_desde),
    'subscricao', case when v_s.instituicao_id is null then null
                       else jsonb_build_object('estado', v_s.estado, 'inicio', v_s.inicio, 'compromisso_ate', v_s.compromisso_ate) end,
    'contrato', case when v_c.id is null then null else jsonb_build_object(
                  'referencia', v_c.referencia, 'taxa_entrada_centimos', v_c.taxa_entrada_centimos, 'iva_percent', v_c.iva_percent,
                  'regiao_fiscal', v_c.regiao_fiscal, 'inicio', v_c.inicio, 'fim', v_c.fim) end,
    'dados', case when v_d.instituicao_id is null then null else jsonb_build_object(
               'razao_social', v_d.razao_social, 'nif', v_d.nif::text, 'morada', v_d.morada, 'codigo_postal', v_d.codigo_postal,
               'localidade', v_d.localidade, 'email', v_d.email, 'atualizado_em', v_d.atualizado_em) end,
    'metodo', case when v_d.metodo_tipo is null then null else jsonb_build_object(
                'tipo', v_d.metodo_tipo, 'ultimos4', v_d.metodo_ultimos4, 'banco', v_d.metodo_banco,
                'validade', v_d.metodo_validade, 'mandato_ref', v_d.metodo_mandato_ref, 'atualizado_em', v_d.metodo_atualizado_em) end,
    'proxima', jsonb_build_object(
      'data', v_prox,
      'debito_em', case when v_d.metodo_tipo is not null and jsonb_array_length(v_linhas) > 0
                        then v_prox + private.pre_aviso_sepa_dias() end,
      'linhas', v_linhas,
      'subtotal_centimos', v_sub, 'iva_centimos', v_iva, 'total_centimos', v_sub + v_iva
    ),
    'entradas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'candidatura_id', e.candidatura_id, 'estado', e.estado, 'faturavel_desde', e.faturavel_desde,
               'contestavel_ate', e.contestavel_ate,
               'contestacao', case when e.contestacao_estado is null then null else jsonb_build_object(
                                'estado', e.contestacao_estado, 'contestada_em', e.contestada_em, 'motivo', e.contestacao_motivo,
                                'resolvida_em', e.resolvida_em, 'nota', e.nota_resolucao) end,
               'fatura_id', e.fatura_id, 'documento_numero', e.documento_numero
             ) order by e.entrada_data desc, e.candidatura_id), '[]')
        from private.entradas_faturacao(v_i.id, v_agora) e
    ),
    'faturas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', f.id, 'origem', f.origem, 'periodo', f.periodo, 'estado', f.estado, 'numero', f.numero,
               'documentos', (
                 select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'tipo', d.tipo, 'numero', d.numero,
                                                              'emitido_em', d.emitido_em, 'total_centimos', d.total_centimos) order by d.ordem), '[]')
                   from public.documentos_fiscais d where d.fatura_id = f.id and d.estado = 'emitido'
               ),
               'subtotal_centimos', f.subtotal_centimos, 'iva_centimos', f.iva_centimos, 'total_centimos', f.total_centimos,
               'cobranca', f.cobranca, 'emitida_em', f.emitida_em, 'debito_em', f.debito_em, 'paga_em', f.paga_em,
               'falhou_em', f.falhou_em, 'motivo_falha', f.motivo_falha, 'url_pagamento', f.url_pagamento
             ) order by f.periodo desc, f.ordem desc), '[]')
        from public.faturas f
       where f.instituicao_id = v_i.id and f.estado <> 'rascunho'
    )
  );
end;
$$;

-- O dono de um lar privado guarda os dados fiscais (validados como nif.ts). Devolve-os (ResumoFaturacaoRpc.dados).
create function private.guardar_dados_faturacao(
  p_razao_social text,
  p_nif text,
  p_morada text,
  p_codigo_postal text,
  p_localidade text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_i public.instituicoes := private.instituicao_da_faturacao('Só a instituição pode alterar os dados de faturação.');
  v_razao text := btrim(coalesce(p_razao_social, ''));
  v_nif text := private.normalizar_nif(p_nif);
  v_morada text := btrim(coalesce(p_morada, ''));
  v_cp text := btrim(coalesce(p_codigo_postal, ''));
  v_localidade text := btrim(coalesce(p_localidade, ''));
  v_email text := btrim(coalesce(p_email, ''));
  v_erro text;
  v_d public.dados_faturacao;
begin
  v_i := private.exigir_dono(v_i.id);   -- bloqueia a ficha
  if v_i.natureza <> 'privado' then
    raise exception 'As IPSS e Misericórdias não têm custos.' using errcode = '22023';
  end if;
  if char_length(v_razao) not between 2 and 200 then
    raise exception 'Indique a razão social (2 a 200 carateres).' using errcode = '22023';
  end if;
  v_erro := private.erro_nif(v_nif, true);
  if v_erro is not null then
    raise exception '%', v_erro using errcode = '22023';
  end if;
  if char_length(v_morada) not between 3 and 200 then
    raise exception 'Indique a morada fiscal (3 a 200 carateres).' using errcode = '22023';
  end if;
  if v_cp !~ '^[0-9]{4}-[0-9]{3}$' then
    raise exception 'O código postal tem o formato 0000-000.' using errcode = '22023';
  end if;
  if char_length(v_localidade) not between 1 and 120 then
    raise exception 'Indique a localidade.' using errcode = '22023';
  end if;
  if v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' or char_length(v_email) > 254 then
    raise exception 'Indique um email válido para as faturas.' using errcode = '22023';
  end if;
  insert into public.dados_faturacao as d (instituicao_id, razao_social, nif, morada, codigo_postal, localidade, email)
  values (v_i.id, v_razao, v_nif, v_morada, v_cp, v_localidade, v_email)
  on conflict (instituicao_id) do update
     set razao_social = excluded.razao_social, nif = excluded.nif, morada = excluded.morada,
         codigo_postal = excluded.codigo_postal, localidade = excluded.localidade, email = excluded.email,
         atualizado_em = now()
  returning * into v_d;
  return jsonb_build_object('razao_social', v_d.razao_social, 'nif', v_d.nif::text, 'morada', v_d.morada,
                            'codigo_postal', v_d.codigo_postal, 'localidade', v_d.localidade, 'email', v_d.email,
                            'atualizado_em', v_d.atualizado_em);
end;
$$;

-- O lar contesta uma entrada confirmada só pela família, dentro dos 14 dias: até a equipa decidir não se fatura.
create function private.contestar_entrada(p_candidatura_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_fim timestamptz;
  v_ct public.contestacoes_entrada;
begin
  perform private.exigir_sessao();
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Só a instituição pode contestar uma entrada.' using errcode = '42501';
  end if;
  if v_c.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  perform private.exigir_dono(v_c.instituicao_id);       -- bloqueia a ficha (mesma ordem que bloquear_candidatura)
  v_c := private.bloquear_candidatura(p_candidatura_id);  -- e o pedido (a tarefa diária salta-o enquanto bloqueado)
  if v_c.estado <> 'admitida' or v_c.entrada_data is null then
    raise exception 'Esta entrada ainda não está registada.' using errcode = '22023';
  end if;
  if v_c.entrada_taxa is distinct from 'aplicavel' then
    raise exception 'Só se contestam entradas com taxa por entrada.' using errcode = '22023';
  end if;
  if v_c.entrada_confirmada_lar_em is not null then
    raise exception 'A instituição já registou esta entrada: não pode ser contestada.' using errcode = '22023';
  end if;
  if v_c.entrada_confirmada_familia_em is null then
    raise exception 'Só se contesta uma entrada confirmada pela família.' using errcode = '22023';
  end if;
  if exists (select 1 from public.contestacoes_entrada ct where ct.candidatura_id = v_c.id) then
    raise exception 'Esta entrada já foi contestada.' using errcode = '22023';
  end if;
  if exists (select 1 from public.fatura_linhas l where l.candidatura_id = v_c.id and l.anulada_em is null) then
    raise exception 'Esta entrada já foi faturada.' using errcode = '22023';
  end if;
  if not private.dentro_janela(v_c.created_at, v_c.entrada_data) then
    raise exception 'Esta entrada está fora da janela de 12 meses e não é faturada.' using errcode = '22023';
  end if;
  v_fim := private.fim_contestacao(v_c.entrada_confirmada_familia_em);
  if now() >= v_fim then
    raise exception 'O prazo para contestar terminou a %.', private.data_longa(v_fim) using errcode = '22023';
  end if;
  if char_length(v_motivo) not between 10 and 1000 then
    raise exception 'Explique o motivo (entre 10 e 1000 carateres).' using errcode = '22023';
  end if;

  insert into public.contestacoes_entrada (candidatura_id, instituicao_id, motivo)
  values (v_c.id, v_c.instituicao_id, v_motivo)
  returning * into v_ct;

  perform private.notificar(
    (select auth.uid()), 'sistema', 'Contestação recebida',
    format('Recebemos a contestação da entrada do pedido %s. Até a analisarmos, esta entrada não é cobrada.',
           private.referencia_pedido(v_c.id)),
    v_c.instituicao_id, null, '/gestao/faturacao'
  );
  return jsonb_build_object('candidatura_id', v_ct.candidatura_id, 'estado', v_ct.estado, 'contestada_em', v_ct.contestada_em);
end;
$$;

-- useAcesso() da família com sessão: como em 20261013110000, agora com os pagamentos do próprio
-- (AcessoEstadoRpc em portas.ts), do mais recente para o mais antigo.
create or replace function private.acesso_estado()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'completo', private.tem_acesso_completo((select auth.uid())),
    'ativo', coalesce(a.ate > now(), false),
    'ate', a.ate,
    'plano', a.plano,
    'pagamentos', (
      select coalesce(jsonb_agg(
               jsonb_build_object(
                 'id', p.id, 'plano', p.plano, 'valor_centimos', p.valor_centimos, 'metodo', p.metodo, 'estado', p.estado,
                 'criado_em', p.criado_em, 'pago_em', p.pago_em, 'motivo_falha', p.motivo_falha)
               || case when p.multibanco_entidade is not null and p.multibanco_referencia is not null
                       then jsonb_build_object('multibanco', jsonb_build_object(
                              'entidade', p.multibanco_entidade, 'referencia', p.multibanco_referencia,
                              'expira_em', p.multibanco_expira_em))
                       else '{}'::jsonb end
               || case when d.id is not null
                       then jsonb_build_object('documento', jsonb_build_object('id', d.id, 'numero', d.numero, 'emitido_em', d.emitido_em))
                       else '{}'::jsonb end
               order by p.criado_em desc, p.ordem desc), '[]')
        from (select * from public.pagamentos_familia pp
               where pp.user_id = (select auth.uid())
               order by pp.criado_em desc, pp.ordem desc
               limit 50) p
        left join public.documentos_fiscais d on d.id = p.documento_id and d.estado = 'emitido'
    )
  )
  from (select 1) as x
  left join public.acessos_familia a on a.user_id = (select auth.uid());
$$;

-- O lar marca "Entrou": como em 20261013100100 e, se a entrada tinha uma contestação aberta, ela fica
-- 'retirada' (o lar confirma a entrada que contestou: fatura-se desde agora).
create or replace function private.marcar_entrada(p_candidatura_id uuid, p_data date)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
  v_inst public.instituicoes;
  v_familia_ja boolean;
begin
  if v_c.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  v_inst := private.exigir_dono(v_c.instituicao_id);
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id for update;
  if v_c.estado not in ('aceite', 'admitida') then
    raise exception 'Só pode registar a entrada depois de a vaga ser aceite.' using errcode = '22023';
  end if;
  if v_c.entrada_confirmada_lar_em is not null then
    return v_c;
  end if;
  -- a data só conta na primeira confirmação (a segunda junta-se à entrada já registada)
  if v_c.entrada_data is null then
    if p_data is null then
      raise exception 'Indique o dia da entrada.' using errcode = '22023';
    end if;
    if p_data > (now() at time zone 'Europe/Lisbon')::date + 1 then
      raise exception 'A data de entrada não pode ser futura.' using errcode = '22023';
    end if;
    if p_data < (v_c.created_at at time zone 'Europe/Lisbon')::date then
      raise exception 'A data de entrada é anterior ao pedido.' using errcode = '22023';
    end if;
  end if;
  v_familia_ja := v_c.entrada_confirmada_familia_em is not null;

  update public.candidaturas
     set estado = 'admitida',
         posicao = null,
         prazo_resposta = null,
         entrada_data = coalesce(entrada_data, p_data),
         entrada_taxa = coalesce(entrada_taxa, private.taxa_para(v_inst)),
         entrada_confirmada_lar_em = now()
   where id = v_c.id
  returning * into v_c;

  update public.contestacoes_entrada ct
     set estado = 'retirada', resolvida_em = now(), nota_resolucao = 'A instituição registou a entrada.'
   where ct.candidatura_id = v_c.id and ct.estado = 'aberta';

  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id)
  values (v_c.id, 'admitida', 'Entrada registada pela instituição.', 'lar', v_uid);

  if not v_familia_ja then
    perform private.notificar(
      v_c.user_id, 'candidatura', 'Entrada registada',
      format('%s registou a entrada de %s a %s. Confirme no painel, para poder deixar uma avaliação verificada.',
             v_inst.nome, v_c.perfil_snapshot ->> 'nome', private.data_extenso(v_c.entrada_data)),
      v_inst.id, v_c.id, private.link_autor(v_c)
    );
  end if;
  return v_c;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 13. RPC públicas (Data API)
-- Invólucros SECURITY INVOKER (a autorização está nas funções private).

create function public.faturacao_resumo()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.faturacao_resumo();
$$;
comment on function public.faturacao_resumo() is
  'Dono de um lar: plano, subscrição, contrato, dados fiscais, método, próxima cobrança, entradas e faturas (ResumoFaturacaoRpc).';

create function public.guardar_dados_faturacao(
  p_razao_social text, p_nif text, p_morada text, p_codigo_postal text, p_localidade text, p_email text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.guardar_dados_faturacao(p_razao_social, p_nif, p_morada, p_codigo_postal, p_localidade, p_email);
$$;
comment on function public.guardar_dados_faturacao(text, text, text, text, text, text) is
  'Dono de um lar privado: guarda a razão social, o NIF, a morada fiscal e o email das faturas.';

create function public.contestar_entrada(p_candidatura_id uuid, p_motivo text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.contestar_entrada(p_candidatura_id, p_motivo);
$$;
comment on function public.contestar_entrada(uuid, text) is
  'Dono de um lar privado: contesta uma entrada confirmada só pela família, nos 14 dias seguintes.';

create function public.resolver_contestacao(p_candidatura_id uuid, p_decisao text, p_nota text default null)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.resolver_contestacao(p_candidatura_id, p_decisao, p_nota); $$;

create function public.servico_iniciar_execucao(p_fase text, p_duracao_segundos integer)
returns boolean language sql security invoker set search_path = ''
as $$ select private.servico_iniciar_execucao(p_fase, p_duracao_segundos); $$;

create function public.servico_terminar_execucao(p_fase text, p_resumo jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.servico_terminar_execucao(p_fase, p_resumo); $$;

create function public.servico_contexto_instituicao(p_instituicao_id text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.servico_contexto_instituicao(p_instituicao_id); $$;

create function public.servico_definir_cliente_stripe(p_instituicao_id text, p_customer_id text)
returns text language sql security invoker set search_path = ''
as $$ select private.servico_definir_cliente_stripe(p_instituicao_id, p_customer_id); $$;

create function public.servico_reservar_documentos(p_modo text, p_agora timestamptz, p_limite integer)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.servico_reservar_documentos(p_modo, p_agora, p_limite); $$;

create function public.servico_documentos_pendentes(p_agora timestamptz, p_limite integer)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.servico_documentos_pendentes(p_agora, p_limite); $$;

create function public.servico_documento_emitido(
  p_id uuid, p_externo_id text, p_numero text, p_total_centimos integer, p_iva_centimos integer,
  p_emitido_em timestamptz, p_emissor text
)
returns void language sql security invoker set search_path = ''
as $$ select private.servico_documento_emitido(p_id, p_externo_id, p_numero, p_total_centimos, p_iva_centimos, p_emitido_em, p_emissor); $$;

create function public.servico_documento_falhou(p_id uuid, p_erro text)
returns void language sql security invoker set search_path = ''
as $$ select private.servico_documento_falhou(p_id, p_erro); $$;

create function public.servico_documento_externo(p_id uuid)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.servico_documento_externo(p_id); $$;

create function public.servico_preparar_cobrancas(p_modo text, p_agora timestamptz, p_limite integer)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.servico_preparar_cobrancas(p_modo, p_agora, p_limite); $$;

create function public.servico_cobranca_criada(
  p_fatura_id uuid, p_stripe_invoice_id text, p_numero text, p_url text, p_cobranca text, p_debito_em timestamptz
)
returns void language sql security invoker set search_path = ''
as $$ select private.servico_cobranca_criada(p_fatura_id, p_stripe_invoice_id, p_numero, p_url, p_cobranca, p_debito_em); $$;

create function public.servico_cobrancas_a_debitar(p_agora timestamptz, p_limite integer)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.servico_cobrancas_a_debitar(p_agora, p_limite); $$;

create function public.servico_cobranca_debito_iniciado(p_fatura_id uuid, p_estado text, p_motivo text, p_em timestamptz)
returns void language sql security invoker set search_path = ''
as $$ select private.servico_cobranca_debito_iniciado(p_fatura_id, p_estado, p_motivo, p_em); $$;

create function public.servico_evento_iniciar(p_id text, p_tipo text, p_livemode boolean, p_criado_em timestamptz)
returns text language sql security invoker set search_path = ''
as $$ select private.servico_evento_iniciar(p_id, p_tipo, p_livemode, p_criado_em); $$;

create function public.servico_evento_aplicar(p_id text, p_operacoes jsonb)
returns boolean language sql security invoker set search_path = ''
as $$ select private.servico_evento_aplicar(p_id, p_operacoes); $$;

create function public.servico_evento_falhou(p_id text, p_erro text)
returns void language sql security invoker set search_path = ''
as $$ select private.servico_evento_falhou(p_id, p_erro); $$;

create function public.servico_acesso_iniciar(
  p_user_id uuid, p_plano text, p_texto_versao text, p_ip text default null, p_nif text default null,
  p_nome_fiscal text default null
)
returns jsonb language sql security invoker set search_path = ''
as $$ select private.servico_acesso_iniciar(p_user_id, p_plano, p_texto_versao, p_ip, p_nif, p_nome_fiscal); $$;

create function public.servico_acesso_sessao_criada(p_pagamento_id uuid, p_session_id text)
returns void language sql security invoker set search_path = ''
as $$ select private.servico_acesso_sessao_criada(p_pagamento_id, p_session_id); $$;

create function public.servico_subscricao_contexto(p_instituicao_id text)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.servico_subscricao_contexto(p_instituicao_id); $$;

create function public.servico_subscricao_registar(
  p_instituicao_id text, p_stripe_subscription_id text, p_estado text, p_inicio timestamptz
)
returns void language sql security invoker set search_path = ''
as $$ select private.servico_subscricao_registar(p_instituicao_id, p_stripe_subscription_id, p_estado, p_inicio); $$;

create function public.servico_subscricoes_a_sincronizar(p_limite integer)
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.servico_subscricoes_a_sincronizar(p_limite); $$;

-- ————————————————————————————————————————————————————————————————— 14. privilégios de execução

revoke all on function
  private.preco_plano_familia(public.plano_familia),
  private.iva_familia_percent(),
  private.mensalidade_centimos(),
  private.taxa_entrada_omissao_centimos(),
  private.pre_aviso_sepa_dias(),
  private.referencia_pedido(uuid),
  private.normalizar_nif(text),
  private.erro_nif(text, boolean),
  private.iva_centimos(integer, integer),
  private.separar_iva_incluido(integer, integer),
  private.regiao_fiscal_de(text, text),
  private.iva_da_regiao(public.regiao_fiscal),
  private.de_lisboa(timestamp),
  private.dia_lisboa(timestamptz),
  private.fim_contestacao(timestamptz),
  private.dentro_janela(timestamptz, date),
  private.euros(integer),
  private.mes_extenso(date),
  private.exigir_servico(),
  private.alertar(text, text, jsonb),
  private.cliente_empresa(text),
  private.contrato_em_vigor(text, date),
  private.iva_instituicao(text, date),
  private.valor_entrada(text, date),
  private.contratos_sem_sobreposicao(),
  private.classificar_entrada(timestamptz, date, public.taxa_entrada, timestamptz, timestamptz, public.estado_contestacao,
                              timestamptz, timestamptz, boolean, timestamptz),
  private.entradas_faturacao(text, timestamptz, uuid),
  private.criar_recibo(uuid, timestamptz),
  private.transitar_fatura(uuid, public.estado_fatura, timestamptz, public.motivo_falha, text),
  private.pagamento_da_sessao(text, uuid),
  private.aplicar_operacao_evento(jsonb),
  private.reservar_linha(uuid, text, timestamptz),
  private.documento_pendente_json(public.documentos_fiscais),
  private.cobranca_preparada_json(uuid),
  private.instituicao_da_faturacao(text),
  private.servico_iniciar_execucao(text, integer),
  private.servico_terminar_execucao(text, jsonb),
  private.servico_contexto_instituicao(text),
  private.servico_definir_cliente_stripe(text, text),
  private.servico_reservar_documentos(text, timestamptz, integer),
  private.servico_documentos_pendentes(timestamptz, integer),
  private.servico_documento_emitido(uuid, text, text, integer, integer, timestamptz, text),
  private.servico_documento_falhou(uuid, text),
  private.servico_documento_externo(uuid),
  private.servico_preparar_cobrancas(text, timestamptz, integer),
  private.servico_cobranca_criada(uuid, text, text, text, text, timestamptz),
  private.servico_cobrancas_a_debitar(timestamptz, integer),
  private.servico_cobranca_debito_iniciado(uuid, text, text, timestamptz),
  private.servico_evento_iniciar(text, text, boolean, timestamptz),
  private.servico_evento_aplicar(text, jsonb),
  private.servico_evento_falhou(text, text),
  private.servico_acesso_iniciar(uuid, text, text, text, text, text),
  private.servico_acesso_sessao_criada(uuid, text),
  private.servico_subscricao_contexto(text),
  private.servico_subscricao_registar(text, text, text, timestamptz),
  private.servico_subscricoes_a_sincronizar(integer),
  private.resolver_contestacao(uuid, text, text),
  private.faturacao_resumo(),
  private.guardar_dados_faturacao(text, text, text, text, text, text),
  private.contestar_entrada(uuid, text),
  public.faturacao_resumo(),
  public.guardar_dados_faturacao(text, text, text, text, text, text),
  public.contestar_entrada(uuid, text),
  public.resolver_contestacao(uuid, text, text),
  public.servico_iniciar_execucao(text, integer),
  public.servico_terminar_execucao(text, jsonb),
  public.servico_contexto_instituicao(text),
  public.servico_definir_cliente_stripe(text, text),
  public.servico_reservar_documentos(text, timestamptz, integer),
  public.servico_documentos_pendentes(timestamptz, integer),
  public.servico_documento_emitido(uuid, text, text, integer, integer, timestamptz, text),
  public.servico_documento_falhou(uuid, text),
  public.servico_documento_externo(uuid),
  public.servico_preparar_cobrancas(text, timestamptz, integer),
  public.servico_cobranca_criada(uuid, text, text, text, text, timestamptz),
  public.servico_cobrancas_a_debitar(timestamptz, integer),
  public.servico_cobranca_debito_iniciado(uuid, text, text, timestamptz),
  public.servico_evento_iniciar(text, text, boolean, timestamptz),
  public.servico_evento_aplicar(text, jsonb),
  public.servico_evento_falhou(text, text),
  public.servico_acesso_iniciar(uuid, text, text, text, text, text),
  public.servico_acesso_sessao_criada(uuid, text),
  public.servico_subscricao_contexto(text),
  public.servico_subscricao_registar(text, text, text, timestamptz),
  public.servico_subscricoes_a_sincronizar(integer)
from public, anon, authenticated, service_role;

-- RPC dos donos dos lares (e as funções private que elas chamam; private não está na Data API)
grant execute on function
  public.faturacao_resumo(),
  public.guardar_dados_faturacao(text, text, text, text, text, text),
  public.contestar_entrada(uuid, text),
  private.faturacao_resumo(),
  private.guardar_dados_faturacao(text, text, text, text, text, text),
  private.contestar_entrada(uuid, text)
to authenticated, service_role;

-- só servidor (Edge Functions com a chave secreta; a equipa como postgres)
grant execute on function
  public.resolver_contestacao(uuid, text, text),
  public.servico_iniciar_execucao(text, integer),
  public.servico_terminar_execucao(text, jsonb),
  public.servico_contexto_instituicao(text),
  public.servico_definir_cliente_stripe(text, text),
  public.servico_reservar_documentos(text, timestamptz, integer),
  public.servico_documentos_pendentes(timestamptz, integer),
  public.servico_documento_emitido(uuid, text, text, integer, integer, timestamptz, text),
  public.servico_documento_falhou(uuid, text),
  public.servico_documento_externo(uuid),
  public.servico_preparar_cobrancas(text, timestamptz, integer),
  public.servico_cobranca_criada(uuid, text, text, text, text, timestamptz),
  public.servico_cobrancas_a_debitar(timestamptz, integer),
  public.servico_cobranca_debito_iniciado(uuid, text, text, timestamptz),
  public.servico_evento_iniciar(text, text, boolean, timestamptz),
  public.servico_evento_aplicar(text, jsonb),
  public.servico_evento_falhou(text, text),
  public.servico_acesso_iniciar(uuid, text, text, text, text, text),
  public.servico_acesso_sessao_criada(uuid, text),
  public.servico_subscricao_contexto(text),
  public.servico_subscricao_registar(text, text, text, timestamptz),
  public.servico_subscricoes_a_sincronizar(integer),
  private.resolver_contestacao(uuid, text, text),
  private.servico_iniciar_execucao(text, integer),
  private.servico_terminar_execucao(text, jsonb),
  private.servico_contexto_instituicao(text),
  private.servico_definir_cliente_stripe(text, text),
  private.servico_reservar_documentos(text, timestamptz, integer),
  private.servico_documentos_pendentes(timestamptz, integer),
  private.servico_documento_emitido(uuid, text, text, integer, integer, timestamptz, text),
  private.servico_documento_falhou(uuid, text),
  private.servico_documento_externo(uuid),
  private.servico_preparar_cobrancas(text, timestamptz, integer),
  private.servico_cobranca_criada(uuid, text, text, text, text, timestamptz),
  private.servico_cobrancas_a_debitar(timestamptz, integer),
  private.servico_cobranca_debito_iniciado(uuid, text, text, timestamptz),
  private.servico_evento_iniciar(text, text, boolean, timestamptz),
  private.servico_evento_aplicar(text, jsonb),
  private.servico_evento_falhou(text, text),
  private.servico_acesso_iniciar(uuid, text, text, text, text, text),
  private.servico_acesso_sessao_criada(uuid, text),
  private.servico_subscricao_contexto(text),
  private.servico_subscricao_registar(text, text, text, timestamptz),
  private.servico_subscricoes_a_sincronizar(integer)
to service_role;
