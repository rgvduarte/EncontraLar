-- =====================================================================================
-- EncontraLar — modelo de negócio (docs/MODELO-NEGOCIO.md), parte 2. Espelha as ações novas de
-- src/lib/store.ts (aceitarPedido, marcarEntrada, confirmarEntradaFamilia, avaliarLar, criarCaso,
-- atualizarCaso, enviarCaso, registarProcura, responderConfirmacao) e acrescenta:
--
--   1. Contas de profissionais (role 'profissional'), com a organização em perfis_utilizador
--      (definida no registo ou pelo administrador; nunca editável pelo utilizador).
--   2. Casos (public.casos): a pessoa de quem o profissional trata. Só o próprio profissional os vê.
--   3. Pedidos com origem (família/profissional), encaminhamento (caso, organização, alta prevista)
--      e entrada na instituição (estado 'admitida', confirmações do lar e da família, taxa).
--   4. PRIVACIDADE EM DUAS FASES (RGPD art. 9.º), imposta aqui e não na interface:
--        * antes de aceitar, o lar NÃO lê a linha do pedido (a política RLS exige desbloqueada_em)
--          — nem o contacto, nem o nome, nem as notas, nem a mensagem, nem o histórico;
--        * vê apenas um resumo sem identificação pela RPC pedidos_recebidos() (faixa etária, grau,
--          necessidades, zona, orçamento, urgência, quarto, acordo SS, origem, organização, alta);
--        * aceitar_candidatura() (ou fazer o pedido avançar) regista desbloqueada_em e só então a
--          linha completa fica legível; recusar sem aceitar ou o pedido ser cancelado NÃO desbloqueia;
--        * os avisos ao lar sobre pedidos por aceitar e os valores devolvidos pelas RPC do lar não
--          têm nomes nem contactos.
--   5. Avaliações verificadas: só por avaliar_lar(), por FAMÍLIAS que fizeram o pedido e confirmaram
--      a entrada, uma por pedido. Acabou a inserção direta em avaliacoes.
--   6. Procura sem resposta (public.procuras_anonimas): só se escreve por registar_procura()
--      (anónima, validada e limitada); ninguém lê as linhas — o lar vê agregados do SEU distrito
--      com procura_na_zona().
--   7. Link de confirmação rápida das vagas sem sessão: só o hash SHA-256 do token fica na base de
--      dados (ilegível para anon/authenticated); confirmar_vagas_por_token() para quem tem o link.
--   8. Avisos a quem fez o pedido levam ao caso quando é um encaminhamento (linkAutor), também nos
--      avisos de vaga e na expiração das propostas.
-- =====================================================================================

-- ————————————————————————————————————————————————————————————————— 1. tipos

create type public.origem_pedido as enum ('familia', 'profissional');
create type public.estado_caso as enum ('aberto', 'colocado', 'fechado');
-- só os lares privados pagam a taxa fixa por entrada; IPSS e Misericórdias estão isentas
create type public.taxa_entrada as enum ('aplicavel', 'isenta');

-- ————————————————————————————————————————————————————————————————— utilitários (sem acesso a tabelas)

-- 84 → '80–84' (igual a faixaEtaria em src/lib/negocio.ts): a idade exata não sai antes de aceitar.
create function private.faixa_etaria(p_idade integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p_idade is null then null
    when p_idade < 65 then 'menos de 65'
    when p_idade >= 95 then '95 ou mais'
    else (p_idade / 5 * 5)::text || '–' || (p_idade / 5 * 5 + 4)::text
  end;
$$;

create function private.maiuscula(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(left(p_texto, 1)) || substr(p_texto, 2);
$$;

-- Organização de um profissional validada e normalizada ({nome, tipo, servico?}) ou null se inválida.
-- Usada no registo (o que vem de app_metadata/user_metadata nunca é guardado tal como vem).
create function private.normalizar_organizacao(p_org jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when p_org is null or jsonb_typeof(p_org) <> 'object' then null
    when jsonb_typeof(p_org -> 'nome') is distinct from 'string' then null
    when char_length(btrim(p_org ->> 'nome')) not between 2 and 160 then null
    when coalesce(p_org ->> 'tipo', '') not in ('hospital', 'centro_saude', 'autarquia', 'outro') then null
    when coalesce(jsonb_typeof(p_org -> 'servico'), 'null') not in ('string', 'null') then null
    else jsonb_strip_nulls(jsonb_build_object(
      'nome', btrim(p_org ->> 'nome'),
      'tipo', p_org ->> 'tipo',
      'servico', nullif(left(btrim(p_org ->> 'servico'), 120), '')
    ))
  end;
$$;

-- "Hospital de Vale Formoso · Serviço Social" (organizacaoTexto no protótipo); sem organização: "Serviço social".
create function private.texto_organizacao(p_org jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    nullif(btrim(p_org ->> 'nome'), '') || coalesce(' · ' || nullif(btrim(p_org ->> 'servico'), ''), ''),
    'Serviço social'
  );
$$;

-- taxaPara(lar) no protótipo
create function private.taxa_para(p_natureza public.natureza)
returns public.taxa_entrada
language sql
immutable
set search_path = ''
as $$
  select case when p_natureza = 'privado' then 'aplicavel' else 'isenta' end::public.taxa_entrada;
$$;

-- Rota do painel do lar que abre o pedido (linkPedido no protótipo).
create function private.link_pedido(p_candidatura_id uuid)
returns text
language sql
immutable
set search_path = ''
as $$
  select '/gestao/pedidos?pedido=' || p_candidatura_id::text;
$$;

-- Token em bruto → hash guardado. O token em bruto nunca é guardado.
create function private.hash_token(p_token text)
returns bytea
language sql
immutable
set search_path = ''
as $$
  select sha256(convert_to(p_token, 'UTF8'));
$$;

-- ————————————————————————————————————————————————————————————————— 2. profissionais

-- Organização (hospital, centro de saúde, autarquia…) de uma conta 'profissional'. Definida no registo
-- (validada por private.normalizar_organizacao) ou pelo administrador (app_metadata.organizacao).
-- Sem privilégio de escrita para os clientes: é o que o lar vê como origem do encaminhamento.
-- (CHECK só com funções do sistema: as restrições correm com os privilégios de quem escreve.)
alter table public.perfis_utilizador
  add column organizacao jsonb
    constraint perfis_utilizador_organizacao_formato check (
      organizacao is null or case when jsonb_typeof(organizacao) = 'object' then
        (organizacao - array['nome', 'tipo', 'servico']) = '{}'::jsonb
        and jsonb_typeof(organizacao -> 'nome') = 'string'
        and char_length(organizacao ->> 'nome') between 2 and 160
        and coalesce(organizacao ->> 'tipo', '') in ('hospital', 'centro_saude', 'autarquia', 'outro')
        and coalesce(jsonb_typeof(organizacao -> 'servico'), 'string') = 'string'
        and char_length(coalesce(organizacao ->> 'servico', '')) <= 120
      else false end
    );
comment on column public.perfis_utilizador.organizacao is
  'Só contas profissional: {nome, tipo: hospital|centro_saude|autarquia|outro, servico?}. Definida no registo ou pelo administrador; não editável pelo utilizador.';

-- Registo: como em 20261012190400, agora também com o papel 'profissional'.
--   * app_metadata.role (administrador) tem prioridade; contas anónimas são sempre 'familia';
--   * o formulário de registo pode pedir 'lar' ou 'profissional' (user_metadata, lido UMA vez aqui).
--     'profissional' não dá acesso a dados de ninguém: permite criar casos (perfis que o próprio
--     escreve) e enviá-los a fichas verificadas — o mesmo que uma família, com a organização indicada;
--   * a organização vem de app_metadata.organizacao ou, no registo, de user_metadata.organizacao.
create or replace function private.criar_perfil_utilizador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_app text := new.raw_app_meta_data ->> 'role';
  v_role_registo text := new.raw_user_meta_data ->> 'role';
  v_role public.role_utilizador;
  v_nome text;
  v_org jsonb;
begin
  v_role := case
    when v_role_app in ('familia', 'lar', 'profissional') then v_role_app::public.role_utilizador
    when coalesce(new.is_anonymous, false) then 'familia'::public.role_utilizador
    when v_role_registo in ('familia', 'lar', 'profissional') then v_role_registo::public.role_utilizador
    else 'familia'::public.role_utilizador
  end;
  if v_role = 'profissional' then
    v_org := coalesce(
      private.normalizar_organizacao(new.raw_app_meta_data -> 'organizacao'),
      private.normalizar_organizacao(new.raw_user_meta_data -> 'organizacao')
    );
  end if;
  v_nome := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  )), 120);

  insert into public.perfis_utilizador (id, role, nome, telefone, organizacao)
  values (new.id, v_role, v_nome, nullif(left(btrim(new.raw_user_meta_data ->> 'telefone'), 30), ''), v_org)
  on conflict (id) do nothing;

  insert into public.notificacoes (user_id, tipo, titulo, texto, link)
  values (
    new.id,
    'sistema',
    'Bem-vindo(a) ao EncontraLar',
    case v_role
      when 'lar' then 'Crie a ficha da sua instituição. Fica visível nas pesquisas e pode receber pedidos depois de verificada pela equipa EncontraLar.'
      when 'profissional' then 'Crie um caso com o perfil de cuidados da pessoa e envie o pedido às instituições compatíveis de uma só vez.'
      else 'Crie o perfil da pessoa de quem cuida para receber sugestões compatíveis e alertas de vaga.'
    end,
    case v_role when 'lar' then '/gestao' when 'profissional' then '/casos' else '/familia' end
  );
  return new;
end;
$$;

-- O administrador muda o papel e/ou a organização em app_metadata (Auth Admin API) → sincroniza.
create or replace function private.sincronizar_role_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org jsonb := private.normalizar_organizacao(new.raw_app_meta_data -> 'organizacao');
begin
  if (new.raw_app_meta_data ->> 'role') in ('familia', 'lar', 'profissional')
     and (new.raw_app_meta_data ->> 'role') is distinct from (old.raw_app_meta_data ->> 'role') then
    update public.perfis_utilizador
       set role = (new.raw_app_meta_data ->> 'role')::public.role_utilizador
     where id = new.id;
  end if;
  if v_org is not null
     and (new.raw_app_meta_data -> 'organizacao') is distinct from (old.raw_app_meta_data -> 'organizacao') then
    update public.perfis_utilizador set organizacao = v_org where id = new.id;
  end if;
  return new;
end;
$$;

-- Defesa em profundidade (além dos privilégios por coluna): um cliente nunca muda id, papel,
-- organização nem a marca de demonstração.
create or replace function private.proteger_perfil_utilizador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.role, new.id, new.organizacao, new.demonstracao)
         is distinct from (old.role, old.id, old.organizacao, old.demonstracao) then
    raise exception 'O tipo de conta não pode ser alterado pelo utilizador (nem a organização).'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 3. link de confirmação das vagas

-- Só o hash SHA-256 do token: quem lê a base de dados (ou uma cópia de segurança) não obtém links
-- válidos. Sem privilégio de leitura para anon/authenticated (as colunas de instituicoes são
-- concedidas uma a uma — 20261012190400 — e estas não estão na lista).
alter table public.instituicoes
  add column confirmacao_token_hash bytea
    constraint instituicoes_confirmacao_token_hash_formato check (octet_length(confirmacao_token_hash) = 32),
  add column confirmacao_token_expira_em timestamptz;
comment on column public.instituicoes.confirmacao_token_hash is
  'SHA-256 do token do link /confirmar/:token (confirmação das vagas sem sessão). O token em bruto nunca é guardado. Interno.';
comment on column public.instituicoes.confirmacao_token_expira_em is
  'Fim da validade do link de confirmação (null = sem prazo, só nos dados de demonstração). Interno.';

create unique index instituicoes_confirmacao_token_key on public.instituicoes (confirmacao_token_hash)
  where confirmacao_token_hash is not null;

-- ————————————————————————————————————————————————————————————————— 4. casos (profissionais)

create table public.casos (
  id uuid primary key default gen_random_uuid(),
  profissional_id uuid not null references public.perfis_utilizador (id) on delete cascade,
  -- perfil de cuidados (DADOS DE SAÚDE) escrito pelo profissional; apagá-lo apaga o caso
  perfil_id uuid not null references public.perfis_cuidados (id) on delete cascade,
  -- nº interno NÃO identificativo (ex.: processo do serviço social)
  referencia text check (char_length(referencia) between 1 and 60),
  alta_prevista date,
  -- a pessoa (ou o seu representante) autorizou a partilha do perfil com instituições
  consentimento_em timestamptz not null,
  estado public.estado_caso not null default 'aberto',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- um caso por perfil (também é o índice da FK perfil_id)
  constraint casos_perfil_unico unique (perfil_id)
);
comment on table public.casos is
  'Casos de profissionais (ex.: alta hospitalar). Só o próprio profissional os lê; escrita só por RPC (criar_caso, atualizar_caso).';

-- painel do profissional (useCasos: mais recentes primeiro); também é o índice da FK
create index casos_profissional_recentes_idx on public.casos (profissional_id, updated_at desc);

create trigger casos_updated_at
  before update on public.casos
  for each row execute function private.definir_updated_at();

alter table public.casos enable row level security;

create policy casos_select_proprio on public.casos
  for select to authenticated
  using (profissional_id = (select auth.uid()));

revoke all on table public.casos from anon, authenticated;
grant all on table public.casos to service_role;
grant select on public.casos to authenticated;

-- ————————————————————————————————————————————————————————————————— 5. candidaturas: origem, desbloqueio, entrada

alter table public.candidaturas
  add column origem public.origem_pedido not null default 'familia',
  -- encaminhamento (só origem 'profissional'); o autor (user_id) é o profissional
  add column caso_id uuid references public.casos (id) on delete set null,
  add column organizacao text check (char_length(organizacao) between 1 and 200),
  add column alta_prevista date,
  -- o lar aceitou o pedido: a partir daqui lê o contacto e o perfil completo
  add column desbloqueada_em timestamptz,
  -- entrada na instituição (base da taxa por entrada)
  add column entrada_data date,
  add column entrada_confirmada_lar_em timestamptz,
  add column entrada_confirmada_familia_em timestamptz,
  add column entrada_taxa public.taxa_entrada;

comment on column public.candidaturas.desbloqueada_em is
  'O lar aceitou o pedido (aceitar_candidatura ou fazê-lo avançar). Antes disso o lar não lê a linha: só o resumo de pedidos_recebidos().';
comment on column public.candidaturas.entrada_taxa is
  'aplicavel (lar privado) ou isenta (IPSS/Misericórdia), fixada na primeira confirmação da entrada.';

-- Pedidos que já avançaram antes desta migração: o lar já os via, por isso ficam desbloqueados
-- (na data do primeiro passo em frente). Sem mexer em updated_at (a retenção usa-o).
alter table public.candidaturas disable trigger candidaturas_updated_at;
update public.candidaturas c
   set desbloqueada_em = coalesce(
         (select min(e.created_at) from public.candidatura_eventos e
           where e.candidatura_id = c.id and e.estado not in ('enviada', 'recusada', 'cancelada')),
         case when c.estado not in ('recusada', 'cancelada') then c.updated_at end
       )
 where c.estado <> 'enviada' and c.desbloqueada_em is null;
alter table public.candidaturas enable trigger candidaturas_updated_at;

alter table public.candidaturas
  add constraint candidaturas_origem_coerente check (
    case origem
      when 'profissional' then organizacao is not null
      else caso_id is null and organizacao is null and alta_prevista is null
    end
  ),
  -- o lar só faz avançar um pedido que aceitou (recusar e cancelar não exigem desbloqueio)
  add constraint candidaturas_desbloqueio check (
    estado in ('enviada', 'recusada', 'cancelada') or desbloqueada_em is not null
  ),
  add constraint candidaturas_entrada_so_admitida check ((estado = 'admitida') = (entrada_data is not null)),
  add constraint candidaturas_entrada_completa check (
    case when entrada_data is null
      then entrada_taxa is null and entrada_confirmada_lar_em is null and entrada_confirmada_familia_em is null
      else entrada_taxa is not null and (entrada_confirmada_lar_em is not null or entrada_confirmada_familia_em is not null)
    end
  );

create index candidaturas_caso_id_idx on public.candidaturas (caso_id) where caso_id is not null;

-- DUAS FASES: o lar só lê pedidos que aceitou. Antes disso nem a linha (nem o histórico, cuja
-- política depende desta) lhe é visível; o resumo vem de pedidos_recebidos().
alter policy candidaturas_select_lar on public.candidaturas
  using (instituicao_id = (select private.minha_instituicao()) and desbloqueada_em is not null);

-- histórico: o profissional que fez o pedido também é autor de eventos
alter table public.candidatura_eventos drop constraint candidatura_eventos_autor_check;
alter table public.candidatura_eventos
  add constraint candidatura_eventos_autor_check check (autor in ('familia', 'profissional', 'lar', 'sistema'));

-- ————————————————————————————————————————————————————————————————— utilitários sobre pedidos

-- Para onde levar o autor do pedido (linkAutor no protótipo): o painel da família ou o caso.
create function private.link_autor(p_c public.candidaturas)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_c.origem = 'profissional' then coalesce('/casos/' || p_c.caso_id::text, '/casos') else '/familia' end;
$$;

-- Resumo SEM identificação de uma cópia de perfil (o que o lar vê antes de aceitar): sem nome,
-- idade exata, relação, género, preferências nem notas.
create function private.resumo_perfil(p_snapshot jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'faixa_etaria', private.faixa_etaria((p_snapshot ->> 'idade')::integer),
    'grau', p_snapshot -> 'grau',
    'necessidades', p_snapshot -> 'necessidades',
    'local_label', p_snapshot -> 'local_label',
    'orcamento_max', p_snapshot -> 'orcamento_max',
    'urgencia', p_snapshot -> 'urgencia',
    'quarto', p_snapshot -> 'quarto',
    'precisa_acordo_ss', p_snapshot -> 'precisa_acordo_ss'
  ));
$$;

-- Como o lar se refere a um pedido por aceitar (pedidoAnonimo no protótipo):
-- "uma família (pessoa de 80–84 anos)" / "encaminhamento do Hospital X · Serviço Social (pessoa de …)".
create function private.texto_pedido_anonimo(p_c public.candidaturas)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_c.origem = 'profissional'
           then 'encaminhamento ' || case when p_c.organizacao like 'Hospital%' then 'do ' else 'de ' end || p_c.organizacao
           else 'uma família'
         end
         || coalesce(' (pessoa de ' || private.faixa_etaria((p_c.perfil_snapshot ->> 'idade')::integer) || ' anos)', '');
$$;

-- O que uma RPC do LAR pode devolver: a linha completa só depois de aceitar; antes, sem
-- identificadores, contacto, mensagem nem perfil completo (a cópia passa a resumo_perfil).
create function private.para_lar(p_c public.candidaturas)
returns public.candidaturas
language plpgsql
immutable
set search_path = ''
as $$
declare
  v public.candidaturas := p_c;
begin
  if v.id is not null and v.desbloqueada_em is null then
    v.user_id := null;
    v.perfil_id := null;
    v.caso_id := null;
    v.contacto := '{}'::jsonb;
    v.perfil_snapshot := private.resumo_perfil(p_c.perfil_snapshot);
    v.mensagem := null;
  end if;
  return v;
end;
$$;

-- Avisos já enviados ao lar sobre pedidos que, com esta migração, ficam por aceitar: passam a ter o
-- texto sem identificação dos avisos novos (o lar deixa de ler a linha; o aviso não pode ficar a contar).
update public.notificacoes n
   set texto = case n.titulo
         when 'Pedido de visita' then private.maiuscula(private.texto_pedido_anonimo(c)) || ' pediu uma visita.'
         when 'Pedido cancelado' then format('O pedido de %s foi cancelado.', private.texto_pedido_anonimo(c))
         else format('Pedido de vaga de %s. Abra o pedido para o aceitar e ver o contacto.', private.texto_pedido_anonimo(c))
       end
  from public.candidaturas c
  join public.instituicoes i on i.id = c.instituicao_id
 where n.candidatura_id = c.id
   and n.user_id = i.owner_id
   and c.desbloqueada_em is null;

-- ————————————————————————————————————————————————————————————————— 6. avaliações verificadas

-- Cada avaliação de utilizador fica ligada ao pedido que a justifica (uma por pedido). As importadas
-- (demonstração, user_id null) não têm pedido. Apagar o pedido (conta apagada) apaga a avaliação.
alter table public.avaliacoes
  add column candidatura_id uuid references public.candidaturas (id) on delete cascade,
  -- também é o índice da FK
  add constraint avaliacoes_uma_por_candidatura unique (candidatura_id),
  add constraint avaliacoes_candidatura_com_autor check (candidatura_id is null or user_id is not null);
comment on column public.avaliacoes.candidatura_id is
  'Pedido com entrada confirmada pela família que dá direito a esta avaliação verificada. Interno (não legível por anon/authenticated).';

-- "uma por pedido" substitui "uma por família e instituição" (dois familiares na mesma instituição
-- são duas entradas e podem ter duas avaliações)
alter table public.avaliacoes drop constraint avaliacoes_uma_por_utilizador;

-- Escrita só por avaliar_lar(): sem política nem privilégio de INSERT para os clientes.
drop policy avaliacoes_insert_familia on public.avaliacoes;
revoke insert on public.avaliacoes from authenticated;

-- "verificada" = ligada a um pedido do próprio autor, nesta instituição, com a entrada confirmada
-- pela família (substitui a regra anterior: "teve uma vaga aceite").
create or replace function private.avaliacoes_verificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    new.verificada := new.candidatura_id is not null and exists (
      select 1 from public.candidaturas c
       where c.id = new.candidatura_id
         and c.user_id = new.user_id
         and c.instituicao_id = new.instituicao_id
         and c.entrada_confirmada_familia_em is not null
    );
  end if;
  return new;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 7. procura sem resposta (anónima)

-- Pesquisas sem vagas, SEM dados pessoais nem identificação de quem pesquisou (nem user_id, nem IP).
-- Ninguém lê as linhas pela Data API: escrita por registar_procura(), leitura agregada por
-- procura_na_zona(). Retenção: 365 dias (pg_cron, abaixo).
create table public.procuras_anonimas (
  id bigint generated always as identity primary key,
  distrito public.distrito,
  -- nome do lugar pesquisado (ex.: "Porto — Paranhos"): sem algarismos nem '@' (não aceita moradas,
  -- telefones nem e-mails)
  lugar text check (char_length(lugar) between 1 and 80 and lugar !~ '[0-9@<>]'),
  grau public.grau_dependencia,
  cuidados public.lista_cuidados not null default '{}',
  orcamento_max numeric(10, 2) check (orcamento_max between 0 and 100000),
  resultados integer not null default 0 check (resultados between 0 and 100000),
  com_vaga integer not null default 0,
  created_at timestamptz not null default now(),
  constraint procuras_anonimas_com_vaga check (com_vaga between 0 and resultados)
);
comment on table public.procuras_anonimas is
  'Procura sem resposta (pesquisas sem vagas), anónima. Escrita só por registar_procura(); leitura só agregada (procura_na_zona).';

create index procuras_anonimas_distrito_idx on public.procuras_anonimas (distrito, created_at desc);
create index procuras_anonimas_created_at_idx on public.procuras_anonimas (created_at);

alter table public.procuras_anonimas enable row level security;
-- sem políticas: anon/authenticated não leem nem escrevem diretamente
revoke all on table public.procuras_anonimas from anon, authenticated;
grant all on table public.procuras_anonimas to service_role;

-- ————————————————————————————————————————————————————————————————— 8. funções substituídas

create or replace function private.rotulo_estado(p_estado public.estado_candidatura)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_estado
    when 'enviada' then 'Pedido enviado'
    when 'em_analise' then 'Em análise'
    when 'lista_espera' then 'Em lista de espera'
    when 'vaga_proposta' then 'Vaga proposta'
    when 'aceite' then 'Vaga aceite'
    when 'admitida' then 'Entrou'
    when 'recusada' then 'Não foi possível'
    when 'cancelada' then 'Cancelada'
  end;
$$;

-- Minimização: como em 20261012190500, e também a data prevista de alta (revela um internamento).
create or replace function private.minimizar_candidaturas(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  if coalesce(cardinality(p_ids), 0) = 0 then
    return 0;
  end if;
  update public.candidaturas c
     set perfil_snapshot = jsonb_strip_nulls(jsonb_build_object(
           'nome', c.perfil_snapshot -> 'nome',
           'idade', c.perfil_snapshot -> 'idade',
           'minimizado_em', now()
         )),
         contacto = jsonb_strip_nulls(jsonb_build_object('nome', c.contacto -> 'nome')),
         mensagem = null,
         alta_prevista = null
   where c.id = any(p_ids)
     and not (c.perfil_snapshot ? 'minimizado_em');
  get diagnostics v_n = row_count;

  update public.candidatura_eventos e
     set nota = null
   where e.candidatura_id = any(p_ids) and e.nota is not null;

  update public.notificacoes n
     set texto = regexp_replace(n.texto, ' Nota: .*$', '', 's')
   where n.candidatura_id = any(p_ids) and strpos(n.texto, ' Nota: ') > 0;
  return v_n;
end;
$$;

-- Pedido de uma família: como em 20261012190500; o aviso ao lar já NÃO tem nomes (duas fases).
create or replace function private.candidatar(
  p_instituicao_id text,
  p_perfil_id uuid,
  p_consentimento boolean,
  p_mensagem text default null,
  p_visita_data date default null,
  p_visita_hora time default null
)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_conta public.perfis_utilizador;
  v_perfil public.perfis_cuidados;
  v_inst public.instituicoes;
  v_email text;
  v_c public.candidaturas;
begin
  select * into v_conta from public.perfis_utilizador p where p.id = v_uid;
  if v_conta.role is distinct from 'familia' then
    raise exception 'Só as contas de família podem enviar pedidos de vaga.' using errcode = '42501';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crie uma conta com email para enviar pedidos de vaga.' using errcode = '42501';
  end if;
  if p_consentimento is not true then
    raise exception 'É necessário o consentimento explícito para partilhar o perfil com a instituição.'
      using errcode = '22023';
  end if;

  select * into v_perfil from public.perfis_cuidados p where p.id = p_perfil_id and p.user_id = v_uid;
  if not found then
    raise exception 'Perfil não encontrado.' using errcode = 'P0002';
  end if;
  select * into v_inst from public.instituicoes i where i.id = p_instituicao_id and i.publicado;
  if not found then
    raise exception 'Instituição não encontrada.' using errcode = 'P0002';
  end if;
  if v_inst.verificacao_estado <> 'verificado' or v_inst.owner_id is null then
    raise exception 'Esta instituição ainda não recebe pedidos pela plataforma (ficha por verificar ou sem gestor). Contacte-a diretamente.'
      using errcode = '22023';
  end if;
  if v_inst.demonstracao is distinct from v_conta.demonstracao then
    raise exception '%', case when v_inst.demonstracao
        then 'Esta ficha é de demonstração e não recebe pedidos reais.'
        else 'As contas de demonstração não enviam pedidos a instituições reais.' end
      using errcode = '22023';
  end if;
  if (p_visita_data is null) <> (p_visita_hora is null) then
    raise exception 'Indique a data e a hora da visita.' using errcode = '22023';
  end if;
  if p_visita_data < current_date then
    raise exception 'A data da visita já passou.' using errcode = '22023';
  end if;

  select * into v_c from public.candidaturas c
   where c.user_id = v_uid and c.instituicao_id = v_inst.id and c.perfil_id = v_perfil.id
     and c.estado not in ('cancelada', 'recusada');
  if found then
    return v_c;
  end if;

  if (select count(*) from public.candidaturas c
       where c.user_id = v_uid and c.instituicao_id = v_inst.id and c.created_at > now() - interval '24 hours') >= 3
     or (select count(*) from public.candidaturas c
          where c.user_id = v_uid and c.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Atingiu o limite de pedidos por hoje. Tente novamente amanhã.' using errcode = '22023';
  end if;

  select u.email into v_email from auth.users u where u.id = v_uid;

  begin
    insert into public.candidaturas (
      instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, mensagem,
      visita_data, visita_hora, visita_estado, consentimento_em
    ) values (
      v_inst.id, v_uid, v_perfil.id, private.snapshot_perfil(v_perfil),
      jsonb_strip_nulls(jsonb_build_object('nome', v_conta.nome, 'email', v_email, 'telefone', v_conta.telefone)),
      'enviada', nullif(btrim(p_mensagem), ''),
      p_visita_data, p_visita_hora, case when p_visita_data is not null then 'pedida'::public.estado_visita end,
      now()
    )
    returning * into v_c;
  exception when unique_violation then
    select * into v_c from public.candidaturas c
     where c.user_id = v_uid and c.instituicao_id = v_inst.id and c.perfil_id = v_perfil.id
       and c.estado not in ('cancelada', 'recusada');
    return v_c;
  end;

  insert into public.candidatura_eventos (candidatura_id, estado, autor, autor_id)
  values (v_c.id, 'enviada', 'familia', v_uid);

  perform private.notificar(
    v_inst.owner_id, 'candidatura', 'Novo pedido de vaga',
    format('Pedido de vaga de %s.%s Abra o pedido para o aceitar e ver o contacto.',
           private.texto_pedido_anonimo(v_c),
           case when p_visita_data is not null then ' Pediu também uma visita.' else '' end),
    v_inst.id, v_c.id, private.link_pedido(v_c.id)
  );
  return v_c;
end;
$$;

-- Pedir/alterar a visita: como em 20261012190500; pedido concluído inclui 'admitida'; o aviso ao lar
-- de um pedido por aceitar não tem o nome de quem pediu.
create or replace function private.pedir_visita(p_candidatura_id uuid, p_data date, p_hora time)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
  v_owner uuid;
begin
  if v_c.id is null or v_c.user_id <> v_uid then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if p_data is null or p_hora is null then
    raise exception 'Indique a data e a hora da visita.' using errcode = '22023';
  end if;
  if p_data < current_date then
    raise exception 'A data da visita já passou.' using errcode = '22023';
  end if;
  v_c := private.bloquear_candidatura(p_candidatura_id);
  if v_c.estado in ('aceite', 'admitida', 'recusada', 'cancelada') then
    raise exception 'Este pedido já está concluído.' using errcode = '22023';
  end if;
  if (v_c.visita_data, v_c.visita_hora) is not distinct from (p_data, p_hora) then
    return v_c;
  end if;

  select i.owner_id into v_owner from public.instituicoes i where i.id = v_c.instituicao_id;
  if v_owner is not null and (
    select count(*) from public.notificacoes n
     where n.candidatura_id = v_c.id and n.user_id = v_owner and n.tipo = 'visita'
       and n.created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'Já pediu várias alterações à visita hoje. Tente amanhã ou contacte a instituição.'
      using errcode = '22023';
  end if;

  update public.candidaturas
     set visita_data = p_data, visita_hora = p_hora, visita_estado = 'pedida'
   where id = v_c.id
  returning * into v_c;

  if v_owner is not null then
    perform private.notificar(
      v_owner, 'visita', 'Pedido de visita',
      format('%s pediu uma visita para %s, às %s.',
             case when v_c.desbloqueada_em is not null then v_c.contacto ->> 'nome'
                  else private.maiuscula(private.texto_pedido_anonimo(v_c)) end,
             private.data_extenso(p_data), to_char(p_hora, 'HH24:MI')),
      v_c.instituicao_id, v_c.id, private.link_pedido(v_c.id)
    );
  end if;
  return v_c;
end;
$$;

-- Cancelar (retirar o consentimento): como em 20261012190500; uma entrada já registada não se
-- cancela; o aviso ao lar de um pedido que ele nunca aceitou não tem nomes.
create or replace function private.cancelar_candidatura(p_candidatura_id uuid)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
  v_posicao integer;
  v_owner uuid;
begin
  if v_c.id is null or v_c.user_id <> v_uid then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  v_c := private.bloquear_candidatura(p_candidatura_id);
  if v_c.estado in ('aceite', 'admitida', 'recusada', 'cancelada') then
    raise exception 'Este pedido já está concluído.' using errcode = '22023';
  end if;
  v_posicao := v_c.posicao;

  update public.candidaturas
     set estado = 'cancelada', posicao = null, prazo_resposta = null
   where id = v_c.id;
  if v_posicao is not null then
    perform private.sair_da_lista(v_c.instituicao_id, v_posicao);
  end if;

  insert into public.candidatura_eventos (candidatura_id, estado, autor, autor_id)
  values (v_c.id, 'cancelada', case when v_c.origem = 'profissional' then 'profissional' else 'familia' end, v_uid);

  perform private.minimizar_candidaturas(array[v_c.id]);
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id;

  select i.owner_id into v_owner from public.instituicoes i where i.id = v_c.instituicao_id;
  if v_owner is not null then
    perform private.notificar(
      v_owner, 'candidatura', 'Pedido cancelado',
      case when v_c.desbloqueada_em is not null
        then format('%s cancelou o pedido para %s.', v_c.contacto ->> 'nome', v_c.perfil_snapshot ->> 'nome')
        else format('O pedido de %s foi cancelado.', private.texto_pedido_anonimo(v_c))
      end,
      v_c.instituicao_id, v_c.id, private.link_pedido(v_c.id)
    );
  end if;
  return v_c;
end;
$$;

-- O lar muda o estado de um pedido: como em 20261012190500 e, como no protótipo, fazer avançar
-- um pedido por aceitar (em análise, lista de espera) equivale a aceitá-lo → regista desbloqueada_em.
-- Recusar sem aceitar NÃO desbloqueia. O valor devolvido passa por private.para_lar.
create or replace function private.atualizar_estado_candidatura(
  p_candidatura_id uuid,
  p_estado public.estado_candidatura,
  p_nota text default null
)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
  v_inst public.instituicoes;
  v_nota text := nullif(btrim(p_nota), '');
  v_estava boolean;
  v_fica boolean;
  v_posicao_antiga integer;
  v_posicao integer;
  v_nome text;
  v_texto text;
begin
  if v_c.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if p_estado is null then
    raise exception 'Indique o novo estado.' using errcode = '22023';
  end if;
  v_inst := private.exigir_dono(v_c.instituicao_id);
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id for update;

  if v_c.estado = p_estado then
    return private.para_lar(v_c);
  end if;
  if not private.transicao_lar_permitida(v_c.estado, p_estado) then
    raise exception 'Transição não permitida: % → %.', v_c.estado, p_estado using errcode = '22023';
  end if;
  if p_estado = 'vaga_proposta'
     and (select coalesce(sum(q.livres), 0) from public.quartos q where q.instituicao_id = v_inst.id)
         <= (select count(*) from public.candidaturas c where c.instituicao_id = v_inst.id and c.estado = 'vaga_proposta') then
    raise exception 'Não há lugares livres por propor: cada vaga proposta reserva um lugar. Registe primeiro a vaga.'
      using errcode = '22023';
  end if;
  if p_estado = 'aceite' and private.ocupar_lugar(v_inst.id, v_c.perfil_snapshot ->> 'quarto') is null then
    raise exception 'Já não há lugar livre para confirmar esta entrada. Registe primeiro a vaga.' using errcode = '22023';
  end if;

  v_estava := v_c.estado in ('lista_espera', 'vaga_proposta');
  v_fica := p_estado in ('lista_espera', 'vaga_proposta');
  v_posicao_antiga := v_c.posicao;
  v_posicao := case
    when v_fica and v_estava then v_c.posicao
    when v_fica then private.proxima_posicao(v_inst.id)
    else null
  end;

  update public.candidaturas
     set estado = p_estado,
         posicao = v_posicao,
         prazo_resposta = case when p_estado = 'vaga_proposta' then now() + interval '48 hours' end,
         desbloqueada_em = coalesce(desbloqueada_em, case when p_estado <> 'recusada' then now() end)
   where id = v_c.id
  returning * into v_c;

  if v_estava and not v_fica then
    perform private.sair_da_lista(v_inst.id, v_posicao_antiga);
  end if;

  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id)
  values (v_c.id, p_estado, v_nota, 'lar', v_uid);

  -- aviso a quem fez o pedido (a família ou o profissional): é sobre os seus próprios dados
  v_nome := v_c.perfil_snapshot ->> 'nome';
  v_texto := case p_estado
    when 'em_analise' then format('%s está a analisar o pedido para %s.', v_inst.nome, v_nome)
    when 'lista_espera' then format('%s inscreveu %s na lista de espera (posição %s).', v_inst.nome, v_nome, v_posicao)
    when 'vaga_proposta' then format('%s tem uma vaga para %s! Responda nas próximas 48 horas.', v_inst.nome, v_nome)
    when 'aceite' then format('A entrada de %s em %s está confirmada.', v_nome, v_inst.nome)
    when 'recusada' then format('%s não tem, neste momento, condições para receber %s.', v_inst.nome, v_nome)
    else format('O pedido para %s foi atualizado.', v_nome)
  end || coalesce(' Nota: ' || v_nota, '');

  perform private.notificar(
    v_c.user_id,
    case when p_estado = 'vaga_proposta' then 'vaga' else 'candidatura' end::public.tipo_notificacao,
    case when p_estado = 'vaga_proposta' then 'Tem uma vaga proposta' else private.rotulo_estado(p_estado) end,
    v_texto, v_inst.id, v_c.id, private.link_autor(v_c)
  );
  return private.para_lar(v_c);
end;
$$;

-- Confirmar a visita: como em 20261012190200; aviso com a rota do autor e valor devolvido sem
-- identificação se o pedido ainda não foi aceite.
create or replace function private.confirmar_visita(p_candidatura_id uuid)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
  v_inst public.instituicoes;
begin
  perform private.exigir_sessao();
  if v_c.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  v_inst := private.exigir_dono(v_c.instituicao_id);
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id for update;
  if v_c.visita_data is null then
    raise exception 'Este pedido não tem nenhuma visita pedida.' using errcode = '22023';
  end if;
  if v_c.estado = 'cancelada' then
    raise exception 'Este pedido foi cancelado pela família.' using errcode = '22023';
  end if;

  update public.candidaturas set visita_estado = 'confirmada' where id = v_c.id
  returning * into v_c;

  perform private.notificar(
    v_c.user_id, 'visita', 'Visita confirmada',
    format('A visita a %s ficou confirmada para %s, às %s.', v_inst.nome, private.data_extenso(v_c.visita_data),
           to_char(v_c.visita_hora, 'HH24:MI')),
    v_inst.id, v_c.id, private.link_autor(v_c)
  );
  return private.para_lar(v_c);
end;
$$;

-- Avisos de vaga: como em 20261012190500; quem está na lista por um encaminhamento (profissional) é
-- levado ao caso, não ao painel da família (linkAutor no protótipo).
create or replace function private.avisar_nova_vaga(p_instituicao_id text, p_tipo public.tipo_quarto)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst public.instituicoes;
  v_quarto text := private.nome_quarto(p_tipo);
  v_lista integer;
  v_favoritos integer;
begin
  select * into v_inst from public.instituicoes i where i.id = p_instituicao_id;
  if not found or not v_inst.publicado then
    return 0;
  end if;

  insert into public.notificacoes (user_id, tipo, titulo, texto, instituicao_id, candidatura_id, link)
  select l.user_id, 'vaga', 'Abriu uma vaga onde está inscrito(a)',
         format('%s tem uma nova vaga (quarto %s). A instituição contacta as famílias pela ordem da lista — está na posição %s.',
                v_inst.nome, v_quarto, l.posicao),
         v_inst.id, l.id, l.link
    from (
      select distinct on (c.user_id) c.user_id, c.id, c.posicao, private.link_autor(c) as link
        from public.candidaturas c
       where c.instituicao_id = v_inst.id and c.estado = 'lista_espera'
       order by c.user_id, c.posicao
    ) l
   where not exists (
     select 1 from public.notificacoes n
      where n.user_id = l.user_id and n.instituicao_id = v_inst.id and n.tipo = 'vaga'
        and n.created_at > now() - interval '24 hours'
   );
  get diagnostics v_lista = row_count;

  insert into public.notificacoes (user_id, tipo, titulo, texto, instituicao_id, link)
  select f.user_id, 'vaga', 'Nova vaga disponível',
         format('%s indicou que tem uma vaga livre (quarto %s). Contacte a instituição se ainda tiver interesse.',
                v_inst.nome, v_quarto),
         v_inst.id, '/lar/' || v_inst.id
    from public.favoritos f
   where f.instituicao_id = v_inst.id
     and f.alerta
     and f.user_id is distinct from v_inst.owner_id
     and not exists (
       select 1 from public.candidaturas c
        where c.instituicao_id = v_inst.id and c.estado = 'lista_espera' and c.user_id = f.user_id
     )
     and not exists (
       select 1 from public.notificacoes n
        where n.user_id = f.user_id and n.instituicao_id = v_inst.id and n.tipo = 'vaga'
          and n.created_at > now() - interval '24 hours'
     );
  get diagnostics v_favoritos = row_count;

  return v_lista + v_favoritos;
end;
$$;

-- Propostas fora de prazo (pg_cron): como em 20261012190500; o aviso a quem fez o pedido leva ao caso
-- quando é um encaminhamento, e o do lar abre o pedido.
create or replace function private.expirar_propostas()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_c public.candidaturas;
  v_inst public.instituicoes;
  v_n integer := 0;
begin
  for r in
    select c.id from public.candidaturas c
     where c.estado = 'vaga_proposta' and c.prazo_resposta < now()
     order by c.instituicao_id, c.id
  loop
    v_c := private.bloquear_candidatura(r.id);
    continue when v_c.id is null or v_c.estado <> 'vaga_proposta' or v_c.prazo_resposta >= now();

    update public.candidaturas
       set estado = 'lista_espera', prazo_resposta = null
     where id = v_c.id
    returning * into v_c;
    insert into public.candidatura_eventos (candidatura_id, estado, nota, autor)
    values (v_c.id, 'lista_espera', 'O prazo de 48 horas para responder à vaga terminou.', 'sistema');

    select * into v_inst from public.instituicoes i where i.id = v_c.instituicao_id;
    perform private.notificar(
      v_c.user_id, 'candidatura', 'Prazo da vaga terminado',
      format('O prazo para responder à vaga em %s terminou. %s mantém a posição %s na lista de espera.',
             v_inst.nome, v_c.perfil_snapshot ->> 'nome', v_c.posicao),
      v_inst.id, v_c.id, private.link_autor(v_c)
    );
    if v_inst.owner_id is not null then
      perform private.notificar(
        v_inst.owner_id, 'candidatura', 'Proposta sem resposta',
        format('%s não respondeu no prazo à vaga proposta para %s. Pode propô-la à pessoa seguinte da lista.',
               v_c.contacto ->> 'nome', v_c.perfil_snapshot ->> 'nome'),
        v_inst.id, v_c.id, private.link_pedido(v_c.id)
      );
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 9. duas fases: o lar

-- Pedidos recebidos pela instituição do utilizador autenticado (vazio se não gerir nenhuma).
-- Resumo sem identificação SEMPRE; user_id, perfil_id, contacto, cópia do perfil, mensagem e
-- histórico SÓ depois de aceitar (desbloqueada_em). Uma chamada serve o painel inteiro.
create function private.pedidos_recebidos()
returns table (
  id uuid,
  instituicao_id text,
  estado public.estado_candidatura,
  posicao integer,
  origem public.origem_pedido,
  organizacao text,
  alta_prevista date,
  faixa_etaria text,
  grau public.grau_dependencia,
  necessidades text[],
  zona text,
  orcamento_max numeric,
  urgencia public.urgencia,
  quarto text,
  precisa_acordo_ss boolean,
  visita_data date,
  visita_hora time,
  visita_estado public.estado_visita,
  prazo_resposta timestamptz,
  desbloqueada_em timestamptz,
  entrada_data date,
  entrada_confirmada_lar_em timestamptz,
  entrada_confirmada_familia_em timestamptz,
  entrada_taxa public.taxa_entrada,
  created_at timestamptz,
  updated_at timestamptz,
  user_id uuid,
  perfil_id uuid,
  contacto jsonb,
  perfil_snapshot jsonb,
  mensagem text,
  historico jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id, c.instituicao_id, c.estado, c.posicao, c.origem, c.organizacao, c.alta_prevista,
    private.faixa_etaria((c.perfil_snapshot ->> 'idade')::integer),
    (c.perfil_snapshot ->> 'grau')::public.grau_dependencia,
    array(select jsonb_array_elements_text(c.perfil_snapshot -> 'necessidades')),
    c.perfil_snapshot ->> 'local_label',
    (c.perfil_snapshot ->> 'orcamento_max')::numeric,
    (c.perfil_snapshot ->> 'urgencia')::public.urgencia,
    c.perfil_snapshot ->> 'quarto',
    (c.perfil_snapshot ->> 'precisa_acordo_ss')::boolean,
    c.visita_data, c.visita_hora, c.visita_estado, c.prazo_resposta, c.desbloqueada_em,
    c.entrada_data, c.entrada_confirmada_lar_em, c.entrada_confirmada_familia_em, c.entrada_taxa,
    c.created_at, c.updated_at,
    case when c.desbloqueada_em is not null then c.user_id end,
    case when c.desbloqueada_em is not null then c.perfil_id end,
    case when c.desbloqueada_em is not null then c.contacto end,
    case when c.desbloqueada_em is not null then c.perfil_snapshot end,
    case when c.desbloqueada_em is not null then c.mensagem end,
    case when c.desbloqueada_em is not null then coalesce((
      select jsonb_agg(jsonb_build_object('estado', e.estado, 'nota', e.nota, 'created_at', e.created_at)
                       order by e.created_at, e.id)
        from public.candidatura_eventos e where e.candidatura_id = c.id
    ), '[]'::jsonb) end
  from public.candidaturas c
  where c.instituicao_id = (select private.minha_instituicao())
  order by c.created_at desc;
$$;

-- "Aceitar e ver contacto" (aceitarPedido): só o dono; só pedidos por aceitar ('enviada'); passa a
-- 'em_analise' e regista desbloqueada_em na mesma transação, e avisa quem fez o pedido.
-- Já aceite → devolve-o sem mudar nada. Recusado/cancelado sem ter sido aceite → erro (a família
-- retirou o consentimento ou o lar recusou: o contacto nunca chega a ser revelado).
create function private.aceitar_candidatura(p_candidatura_id uuid)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
begin
  perform private.exigir_sessao();
  if v_c.id is null then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  perform private.exigir_dono(v_c.instituicao_id);
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id for update;
  if v_c.desbloqueada_em is not null then
    return v_c;
  end if;
  if v_c.estado <> 'enviada' then
    raise exception 'Este pedido já não pode ser aceite (foi recusado ou cancelado).' using errcode = '22023';
  end if;
  return private.atualizar_estado_candidatura(p_candidatura_id, 'em_analise');
end;
$$;

-- ————————————————————————————————————————————————————————————————— 10. entrada na instituição

-- O lar marca "Entrou" (marcarEntrada): só o dono, só depois de a vaga ser aceite. Passa a
-- 'admitida', regista a confirmação do lar e a taxa (privado → aplicável; IPSS/Misericórdia →
-- isenta). Se a família já tinha confirmado, junta-se a essa entrada (mantém a data dela).
create function private.marcar_entrada(p_candidatura_id uuid, p_data date)
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
         entrada_taxa = coalesce(entrada_taxa, private.taxa_para(v_inst.natureza)),
         entrada_confirmada_lar_em = now()
   where id = v_c.id
  returning * into v_c;

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

-- Quem fez o pedido (família ou profissional) confirma que a pessoa entrou (confirmarEntradaFamilia).
-- Com as duas confirmações a entrada fica verificada; só com esta a família pode avaliar.
create function private.confirmar_entrada_familia(p_candidatura_id uuid, p_data date)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
  v_inst public.instituicoes;
  v_lar_ja boolean;
begin
  if v_c.id is null or v_c.user_id <> v_uid then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  v_c := private.bloquear_candidatura(p_candidatura_id);
  if v_c.estado not in ('aceite', 'admitida') then
    raise exception 'Só pode confirmar a entrada depois de aceitar a vaga.' using errcode = '22023';
  end if;
  if v_c.entrada_confirmada_familia_em is not null then
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
  select * into v_inst from public.instituicoes i where i.id = v_c.instituicao_id;
  v_lar_ja := v_c.entrada_confirmada_lar_em is not null;

  update public.candidaturas
     set estado = 'admitida',
         posicao = null,
         prazo_resposta = null,
         entrada_data = coalesce(entrada_data, p_data),
         entrada_taxa = coalesce(entrada_taxa, private.taxa_para(v_inst.natureza)),
         entrada_confirmada_familia_em = now()
   where id = v_c.id
  returning * into v_c;

  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id)
  values (v_c.id, 'admitida', 'Entrada confirmada pela família.',
          case when v_c.origem = 'profissional' then 'profissional' else 'familia' end, v_uid);

  if not v_lar_ja and v_inst.owner_id is not null then
    perform private.notificar(
      v_inst.owner_id, 'candidatura', 'Entrada confirmada pela família',
      format('%s confirmou a entrada de %s a %s. Registe-a também no painel.',
             v_c.contacto ->> 'nome', v_c.perfil_snapshot ->> 'nome', private.data_extenso(v_c.entrada_data)),
      v_inst.id, v_c.id, private.link_pedido(v_c.id)
    );
  end if;
  return v_c;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 11. avaliação verificada

-- avaliarLar: só FAMÍLIAS (um profissional confirma a entrada em nome da pessoa, mas não avalia), só
-- quem fez o pedido e confirmou a entrada; uma avaliação por pedido; fica "verificada" (trigger
-- avaliacoes_verificar) e atualiza média e total (trigger avaliacoes_agregados).
-- Autor como no protótipo: "Ana F." (primeiro nome + inicial do último).
create function private.avaliar_lar(p_candidatura_id uuid, p_nota integer, p_texto text, p_aspetos jsonb)
returns public.avaliacoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_c public.candidaturas := private.ler_candidatura(p_candidatura_id);
  v_texto text := btrim(p_texto);
  v_partes text[];
  v_autor text;
  v_cuidados integer;
  v_alimentacao integer;
  v_instalacoes integer;
  v_comunicacao integer;
  v_av public.avaliacoes;
begin
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crie uma conta com email para avaliar.' using errcode = '42501';
  end if;
  if not private.tem_papel('familia') then
    raise exception 'Só as famílias deixam avaliações.' using errcode = '42501';
  end if;
  if v_c.id is null or v_c.user_id <> v_uid then
    raise exception 'Pedido não encontrado.' using errcode = 'P0002';
  end if;
  if v_c.entrada_confirmada_familia_em is null then
    raise exception 'Só pode deixar uma avaliação verificada depois de confirmar a entrada na instituição.'
      using errcode = '22023';
  end if;
  if exists (select 1 from public.avaliacoes a where a.candidatura_id = v_c.id) then
    raise exception 'Já avaliou esta instituição a partir deste pedido.' using errcode = '22023';
  end if;

  begin
    v_cuidados := (p_aspetos ->> 'cuidados')::integer;
    v_alimentacao := (p_aspetos ->> 'alimentacao')::integer;
    v_instalacoes := (p_aspetos ->> 'instalacoes')::integer;
    v_comunicacao := (p_aspetos ->> 'comunicacao')::integer;
  exception when invalid_text_representation or numeric_value_out_of_range then
    v_cuidados := null;
  end;
  if p_nota is null or v_cuidados is null or v_alimentacao is null or v_instalacoes is null or v_comunicacao is null
     or p_nota not between 1 and 5 or v_cuidados not between 1 and 5 or v_alimentacao not between 1 and 5
     or v_instalacoes not between 1 and 5 or v_comunicacao not between 1 and 5 then
    raise exception 'A nota e cada aspeto (cuidados, alimentação, instalações, comunicação) vão de 1 a 5.'
      using errcode = '22023';
  end if;
  if char_length(coalesce(v_texto, '')) < 10 then
    raise exception 'Escreva pelo menos 10 caracteres sobre a sua experiência.' using errcode = '22023';
  end if;
  if char_length(v_texto) > 3000 then
    raise exception 'O texto da avaliação tem um máximo de 3000 caracteres.' using errcode = '22023';
  end if;

  select regexp_split_to_array(btrim(coalesce(p.nome, '')), '\s+') into v_partes
    from public.perfis_utilizador p where p.id = v_uid;
  v_autor := case
    when cardinality(v_partes) > 1 then v_partes[1] || ' ' || left(v_partes[cardinality(v_partes)], 1) || '.'
    else coalesce(nullif(v_partes[1], ''), 'Família')
  end;

  begin
    insert into public.avaliacoes (
      instituicao_id, user_id, candidatura_id, autor, relacao, nota,
      aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes, aspeto_comunicacao, texto
    ) values (
      v_c.instituicao_id, v_uid, v_c.id, left(v_autor, 80),
      case when v_c.perfil_snapshot ->> 'relacao' = 'Eu próprio(a)' then 'Residente' else 'Familiar de residente' end,
      p_nota, v_cuidados, v_alimentacao, v_instalacoes, v_comunicacao, v_texto
    )
    returning * into v_av;
  exception when unique_violation then
    raise exception 'Já avaliou esta instituição a partir deste pedido.' using errcode = '22023';
  end;
  return v_av;
end;
$$;

-- As avaliações do próprio utilizador e o pedido de cada uma (jaAvaliou no protótipo). candidatura_id
-- e user_id não são legíveis na tabela por ninguém (nem pelo autor): esta RPC é o único caminho.
create function private.minhas_avaliacoes()
returns table (
  avaliacao_id bigint,
  candidatura_id uuid,
  instituicao_id text,
  nota smallint,
  verificada boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.candidatura_id, a.instituicao_id, a.nota, a.verificada, a.created_at
    from public.avaliacoes a
   where a.user_id = (select auth.uid())
   order by a.created_at desc;
$$;

-- ————————————————————————————————————————————————————————————————— 12. casos (profissionais)

-- criarCaso: cria o perfil de cuidados (do profissional) e o caso. Exige o consentimento da pessoa
-- (ou do representante). p_perfil = colunas de perfis_cuidados em JSON (perfilParaLinha); id,
-- user_id e datas são sempre do servidor.
create function private.criar_caso(
  p_perfil jsonb,
  p_referencia text default null,
  p_alta_prevista date default null,
  p_consentimento boolean default false
)
returns public.casos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_p public.perfis_cuidados;
  v_caso public.casos;
begin
  if not private.tem_papel('profissional') then
    raise exception 'Só as contas de profissionais criam casos.' using errcode = '42501';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crie uma conta com email para criar casos.' using errcode = '42501';
  end if;
  if p_consentimento is not true then
    raise exception 'É necessário o consentimento da pessoa (ou do seu representante) para partilhar o perfil com instituições.'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_perfil) is distinct from 'object' then
    raise exception 'Indique o perfil de cuidados da pessoa.' using errcode = '22023';
  end if;
  v_p := jsonb_populate_record(null::public.perfis_cuidados, p_perfil);
  if v_p.nome is null or v_p.idade is null or v_p.grau is null or v_p.local_lat is null or v_p.local_lng is null then
    raise exception 'Perfil incompleto: indique o nome, a idade, o grau de dependência e a localização.' using errcode = '22023';
  end if;

  insert into public.perfis_cuidados (
    user_id, nome, idade, relacao, genero, grau, necessidades, preferencias, quarto, local_label,
    local_lat, local_lng, raio_km, orcamento_max, urgencia, precisa_acordo_ss, notas
  ) values (
    v_uid, btrim(v_p.nome), v_p.idade, coalesce(v_p.relacao, ''), v_p.genero, v_p.grau,
    coalesce(v_p.necessidades, '{}'), coalesce(v_p.preferencias, '{}'), coalesce(v_p.quarto, 'indiferente'),
    coalesce(v_p.local_label, ''), v_p.local_lat, v_p.local_lng, coalesce(v_p.raio_km, 15),
    coalesce(v_p.orcamento_max, 0), coalesce(v_p.urgencia, '1-3meses'), coalesce(v_p.precisa_acordo_ss, false),
    nullif(btrim(v_p.notas), '')
  )
  returning * into v_p;

  insert into public.casos (profissional_id, perfil_id, referencia, alta_prevista, consentimento_em)
  values (v_uid, v_p.id, nullif(btrim(p_referencia), ''), p_alta_prevista, now())
  returning * into v_caso;
  return v_caso;
end;
$$;

-- atualizarCaso: só o profissional do caso. p_alteracoes com as chaves a mudar (as ausentes ficam):
-- referencia, alta_prevista, estado e perfil (objeto com colunas de perfis_cuidados). Os pedidos já
-- enviados mantêm a cópia que as instituições receberam.
create function private.atualizar_caso(p_caso_id uuid, p_alteracoes jsonb)
returns public.casos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_a jsonb := coalesce(p_alteracoes, '{}'::jsonb);
  v_caso public.casos;
  v_p public.perfis_cuidados;
begin
  select * into v_caso from public.casos c where c.id = p_caso_id and c.profissional_id = v_uid for update;
  if not found then
    raise exception 'Caso não encontrado.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(v_a) <> 'object' or (v_a ? 'perfil' and jsonb_typeof(v_a -> 'perfil') <> 'object') then
    raise exception 'Alterações inválidas.' using errcode = '22023';
  end if;

  if v_a ? 'perfil' then
    select * into v_p from public.perfis_cuidados p where p.id = v_caso.perfil_id for update;
    v_p := jsonb_populate_record(v_p, v_a -> 'perfil');
    update public.perfis_cuidados p
       set nome = btrim(v_p.nome), idade = v_p.idade, relacao = coalesce(v_p.relacao, ''), genero = v_p.genero,
           grau = v_p.grau, necessidades = coalesce(v_p.necessidades, '{}'), preferencias = coalesce(v_p.preferencias, '{}'),
           quarto = coalesce(v_p.quarto, 'indiferente'), local_label = coalesce(v_p.local_label, ''),
           local_lat = v_p.local_lat, local_lng = v_p.local_lng, raio_km = coalesce(v_p.raio_km, 15),
           orcamento_max = coalesce(v_p.orcamento_max, 0), urgencia = coalesce(v_p.urgencia, '1-3meses'),
           precisa_acordo_ss = coalesce(v_p.precisa_acordo_ss, false), notas = nullif(btrim(v_p.notas), '')
     where p.id = v_caso.perfil_id;
  end if;

  update public.casos c
     set referencia = case when v_a ? 'referencia' then nullif(btrim(v_a ->> 'referencia'), '') else c.referencia end,
         alta_prevista = case when v_a ? 'alta_prevista' then (v_a ->> 'alta_prevista')::date else c.alta_prevista end,
         estado = case when v_a ? 'estado' then (v_a ->> 'estado')::public.estado_caso else c.estado end
   where c.id = v_caso.id
  returning * into v_caso;
  return v_caso;
end;
$$;

-- enviarCaso: um pedido por instituição, com origem 'profissional', o encaminhamento e o contacto do
-- profissional. As mesmas regras de candidatar (fichas publicadas, verificadas, com gestor, do mesmo
-- "mundo"; limites por dia) — as fichas que não cumprem, ou que já têm um pedido ativo deste caso,
-- são ignoradas. Avisa cada gestor SEM identificar a pessoa. Devolve os pedidos criados.
create function private.enviar_caso(p_caso_id uuid, p_instituicao_ids text[], p_mensagem text default null)
returns setof public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_conta public.perfis_utilizador;
  v_caso public.casos;
  v_perfil public.perfis_cuidados;
  v_inst public.instituicoes;
  v_org text;
  v_email text;
  v_id text;
  v_c public.candidaturas;
  v_n integer := 0;
begin
  select * into v_conta from public.perfis_utilizador p where p.id = v_uid;
  if v_conta.role is distinct from 'profissional' then
    raise exception 'Só as contas de profissionais enviam casos.' using errcode = '42501';
  end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Crie uma conta com email para enviar pedidos.' using errcode = '42501';
  end if;
  select * into v_caso from public.casos c where c.id = p_caso_id and c.profissional_id = v_uid for update;
  if not found then
    raise exception 'Caso não encontrado.' using errcode = 'P0002';
  end if;
  if v_caso.estado = 'fechado' then
    raise exception 'Este caso está fechado. Reabra-o antes de o enviar.' using errcode = '22023';
  end if;
  if coalesce(cardinality(p_instituicao_ids), 0) = 0 then
    return;
  end if;
  if cardinality(p_instituicao_ids) > 20 then
    raise exception 'Escolha no máximo 20 instituições de cada vez.' using errcode = '22023';
  end if;

  select * into v_perfil from public.perfis_cuidados p where p.id = v_caso.perfil_id;
  v_org := private.texto_organizacao(v_conta.organizacao);
  select u.email into v_email from auth.users u where u.id = v_uid;

  for v_id in
    select x.id from unnest(p_instituicao_ids) with ordinality as x (id, n)
     where x.id is not null
     group by x.id
     order by min(x.n)
  loop
    select * into v_inst from public.instituicoes i
     where i.id = v_id and i.publicado and i.verificacao_estado = 'verificado' and i.owner_id is not null
       and i.demonstracao = v_conta.demonstracao;
    continue when not found;
    continue when exists (
      select 1 from public.candidaturas c
       where c.caso_id = v_caso.id and c.instituicao_id = v_inst.id and c.estado not in ('cancelada', 'recusada')
    );
    if (select count(*) from public.candidaturas c
         where c.user_id = v_uid and c.instituicao_id = v_inst.id and c.created_at > now() - interval '24 hours') >= 3
       or (select count(*) from public.candidaturas c
            where c.user_id = v_uid and c.created_at > now() - interval '24 hours') >= 20 then
      raise exception 'Atingiu o limite de pedidos por hoje. Tente novamente amanhã.' using errcode = '22023';
    end if;

    begin
      insert into public.candidaturas (
        instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, mensagem, consentimento_em,
        origem, caso_id, organizacao, alta_prevista
      ) values (
        v_inst.id, v_uid, v_perfil.id, private.snapshot_perfil(v_perfil),
        jsonb_strip_nulls(jsonb_build_object(
          'nome', format('%s (%s)', v_conta.nome, v_org), 'email', v_email, 'telefone', v_conta.telefone
        )),
        'enviada', nullif(btrim(p_mensagem), ''), v_caso.consentimento_em,
        'profissional', v_caso.id, v_org, v_caso.alta_prevista
      )
      returning * into v_c;
    exception when unique_violation then
      continue;   -- pedido simultâneo para a mesma instituição
    end;

    insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id)
    values (v_c.id, 'enviada', format('Encaminhado por %s.', v_org), 'profissional', v_uid);

    perform private.notificar(
      v_inst.owner_id, 'candidatura', 'Novo encaminhamento',
      private.maiuscula(private.texto_pedido_anonimo(v_c))
        || coalesce(', com alta prevista para ' || private.data_extenso(v_caso.alta_prevista), '')
        || '. Abra o pedido para o aceitar e ver o contacto.',
      v_inst.id, v_c.id, private.link_pedido(v_c.id)
    );
    v_n := v_n + 1;
    return next v_c;
  end loop;

  if v_n > 0 then
    update public.casos set updated_at = now() where id = v_caso.id;
  end if;
  return;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 13. procura sem resposta

-- registarProcura: anónima (anon ou authenticated), validada e limitada SEM identificar quem pesquisa:
--   * a mesma combinação nos últimos 10 minutos não se repete (o protótipo: 1 por sessão);
--   * no máximo 60 registos por minuto no total e 300 por hora por distrito (um robô não inunda nem
--     distorce a procura de um distrito).
-- Devolve true se guardou, false se foi ignorada pelos limites.
create function private.registar_procura(
  p_distrito text default null,
  p_lugar text default null,
  p_grau public.grau_dependencia default null,
  p_cuidados text[] default '{}',
  p_orcamento_max numeric default null,
  p_resultados integer default 0,
  p_com_vaga integer default 0
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_distrito public.distrito;
  v_lugar text := nullif(btrim(p_lugar), '');
  v_cuidados public.lista_cuidados;
  v_orcamento numeric := round(p_orcamento_max, 2);
begin
  if coalesce(cardinality(p_cuidados), 0) > 12
     or (v_lugar is not null and (char_length(v_lugar) > 80 or v_lugar ~ '[0-9@<>]'))
     or (v_orcamento is not null and v_orcamento not between 0 and 100000)
     or p_resultados is null or p_resultados not between 0 and 100000
     or p_com_vaga is null or p_com_vaga not between 0 and p_resultados then
    raise exception 'Pesquisa inválida.' using errcode = '22023';
  end if;
  begin
    v_distrito := nullif(btrim(p_distrito), '')::public.distrito;
    v_cuidados := array(select distinct x from unnest(p_cuidados) as x where x is not null order by 1)::public.lista_cuidados;
  exception when check_violation then
    raise exception 'Pesquisa inválida.' using errcode = '22023';
  end;

  if exists (
    select 1 from public.procuras_anonimas p
     where p.created_at > now() - interval '10 minutes'
       and p.distrito is not distinct from v_distrito
       and p.lugar is not distinct from v_lugar
       and p.grau is not distinct from p_grau
       and p.cuidados = v_cuidados
       and p.orcamento_max is not distinct from v_orcamento
  ) then
    return false;
  end if;
  if (select count(*) from public.procuras_anonimas p where p.created_at > now() - interval '1 minute') >= 60
     or (v_distrito is not null and (
       select count(*) from public.procuras_anonimas p
        where p.distrito = v_distrito and p.created_at > now() - interval '1 hour'
     ) >= 300) then
    return false;
  end if;

  insert into public.procuras_anonimas (distrito, lugar, grau, cuidados, orcamento_max, resultados, com_vaga)
  values (v_distrito, v_lugar, p_grau, v_cuidados, v_orcamento, p_resultados, p_com_vaga);
  return true;
end;
$$;

-- useProcurasZona + resumirProcuras: procura sem resposta no distrito da instituição do utilizador
-- autenticado, nos últimos p_dias (1–365). Só agregados — total, contagem por cuidado e por grau,
-- orçamento mediano (o mesmo elemento que o protótipo escolhe) — e só do distrito do próprio lar
-- (não há parâmetro de distrito). Vazio para quem não gere nenhuma instituição.
create function private.procura_na_zona(p_dias integer default 30)
returns table (
  distrito text,
  dias integer,
  total integer,
  cuidados jsonb,
  graus jsonb,
  orcamento_mediano numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  with lar as (
    select i.distrito::text as distrito, least(greatest(coalesce(p_dias, 30), 1), 365) as dias
      from public.instituicoes i
     where i.id = (select private.minha_instituicao())
  ),
  q as (
    select p.grau, p.cuidados, p.orcamento_max
      from public.procuras_anonimas p, lar
     where p.distrito = lar.distrito
       and p.created_at >= now() - make_interval(days => lar.dias)
  )
  select
    lar.distrito,
    lar.dias,
    (select count(*)::integer from q),
    coalesce((
      select jsonb_agg(jsonb_build_object('cuidado', x.cuidado, 'total', x.n) order by x.n desc, x.cuidado)
        from (select c.cuidado, count(*)::integer as n from q, unnest(q.cuidados) as c (cuidado) group by c.cuidado) x
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object('grau', x.grau, 'total', x.n) order by x.n desc, x.grau)
        from (select q.grau, count(*)::integer as n from q where q.grau is not null group by q.grau) x
    ), '[]'::jsonb),
    (select (array_agg(q.orcamento_max order by q.orcamento_max))[(count(*) / 2 + 1)::integer]
       from q where q.orcamento_max > 0)
  from lar;
$$;

-- Retenção da procura anónima (pg_cron, diário).
create function private.limpar_procuras_anonimas(p_dias integer default 365)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.procuras_anonimas p
   where p.created_at < now() - make_interval(days => greatest(coalesce(p_dias, 365), 30));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 14. link de confirmação das vagas

-- Gera um token novo (≈ 244 bits aleatórios, URL-safe), guarda só o hash e devolve o token UMA vez.
-- Uso interno: renovar_token_confirmacao (dono) e o futuro envio periódico por SMS/e-mail.
create function private.emitir_token_confirmacao(p_instituicao_id text, p_validade interval default interval '30 days')
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := rtrim(translate(
    encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'base64'), '+/', '-_'), '=');
begin
  update public.instituicoes i
     set confirmacao_token_hash = private.hash_token(v_token),
         confirmacao_token_expira_em = now() + p_validade
   where i.id = p_instituicao_id;
  if not found then
    raise exception 'Instituição não encontrada.' using errcode = 'P0002';
  end if;
  return v_token;
end;
$$;

-- O dono gera um link novo (o anterior deixa de funcionar). Devolve o token em bruto, só desta vez.
create function private.renovar_token_confirmacao()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst text;
begin
  perform private.exigir_sessao();
  v_inst := private.minha_instituicao();
  if v_inst is null then
    raise exception 'Sem permissão para gerir esta instituição.' using errcode = '42501';
  end if;
  perform private.exigir_dono(v_inst);
  return private.emitir_token_confirmacao(v_inst);
end;
$$;

-- larPorToken: a instituição do link (nome e vagas por tipo de quarto), para a página
-- /confirmar/:token. Token desconhecido, expirado ou mal formado → nenhuma linha (sem distinguir).
create function private.vagas_por_token(p_token text)
returns table (
  instituicao_id text,
  nome text,
  quartos jsonb,
  vagas_livres integer,
  atualizado_em timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.nome,
    coalesce((
      select jsonb_agg(jsonb_build_object('tipo', q.tipo, 'total', q.total, 'livres', q.livres) order by q.tipo)
        from public.quartos q where q.instituicao_id = i.id
    ), '[]'::jsonb),
    coalesce((select sum(q.livres)::integer from public.quartos q where q.instituicao_id = i.id), 0),
    i.atualizado_em
  from public.instituicoes i
  where char_length(p_token) between 1 and 200
    and i.confirmacao_token_hash = private.hash_token(p_token)
    and (i.confirmacao_token_expira_em is null or i.confirmacao_token_expira_em > now());
$$;

-- responderConfirmacao: "Ainda tem estas vagas?" sem sessão. Sim → renova a frescura (como
-- confirmar_vagas_atualizadas); não → todos os lugares livres a 0 e renova a frescura.
-- O token é comparado pelo hash (pesquisa por índice: o tempo não depende de quão "perto" está um
-- token errado). Token desconhecido, expirado ou mal formado → sempre o mesmo erro; nada é revelado
-- sobre outras instituições. Devolve a instituição do link, como vagas_por_token.
create function private.confirmar_vagas_por_token(p_token text, p_ainda_tem boolean)
returns table (
  instituicao_id text,
  nome text,
  quartos jsonb,
  vagas_livres integer,
  atualizado_em timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
begin
  if p_ainda_tem is null then
    raise exception 'Indique se ainda tem estas vagas.' using errcode = '22023';
  end if;
  select i.id into v_id
    from public.instituicoes i
   where char_length(p_token) between 1 and 200
     and i.confirmacao_token_hash = private.hash_token(p_token)
     and (i.confirmacao_token_expira_em is null or i.confirmacao_token_expira_em > now())
   for update;
  if v_id is null then
    raise exception 'Link de confirmação inválido ou expirado.' using errcode = 'P0002';
  end if;

  if not p_ainda_tem then
    update public.quartos q set livres = 0 where q.instituicao_id = v_id and q.livres <> 0;
  end if;
  update public.instituicoes i set atualizado_em = now() where i.id = v_id;
  return query select * from private.vagas_por_token(p_token);
end;
$$;

-- ————————————————————————————————————————————————————————————————— 15. RPC públicas (Data API)
-- Invólucros SECURITY INVOKER (a autorização está nas funções private).

create function public.pedidos_recebidos()
returns table (
  id uuid, instituicao_id text, estado public.estado_candidatura, posicao integer, origem public.origem_pedido,
  organizacao text, alta_prevista date, faixa_etaria text, grau public.grau_dependencia, necessidades text[],
  zona text, orcamento_max numeric, urgencia public.urgencia, quarto text, precisa_acordo_ss boolean,
  visita_data date, visita_hora time, visita_estado public.estado_visita, prazo_resposta timestamptz,
  desbloqueada_em timestamptz, entrada_data date, entrada_confirmada_lar_em timestamptz,
  entrada_confirmada_familia_em timestamptz, entrada_taxa public.taxa_entrada, created_at timestamptz,
  updated_at timestamptz, user_id uuid, perfil_id uuid, contacto jsonb, perfil_snapshot jsonb, mensagem text,
  historico jsonb
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.pedidos_recebidos();
$$;
comment on function public.pedidos_recebidos() is
  'Lar: pedidos recebidos. Resumo sem identificação sempre; contacto, perfil completo, mensagem e histórico só depois de aceitar.';

create function public.aceitar_candidatura(p_candidatura_id uuid)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.aceitar_candidatura(p_candidatura_id);
$$;
comment on function public.aceitar_candidatura(uuid) is
  'Lar: "Aceitar e ver contacto" — passa o pedido a em_analise, regista desbloqueada_em e avisa quem o fez.';

create function public.marcar_entrada(p_candidatura_id uuid, p_data date)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.marcar_entrada(p_candidatura_id, p_data);
$$;

create function public.confirmar_entrada_familia(p_candidatura_id uuid, p_data date)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.confirmar_entrada_familia(p_candidatura_id, p_data);
$$;

create function public.avaliar_lar(p_candidatura_id uuid, p_nota integer, p_texto text, p_aspetos jsonb)
returns public.avaliacoes
language sql
security invoker
set search_path = ''
as $$
  select * from private.avaliar_lar(p_candidatura_id, p_nota, p_texto, p_aspetos);
$$;

create function public.minhas_avaliacoes()
returns table (avaliacao_id bigint, candidatura_id uuid, instituicao_id text, nota smallint, verificada boolean, created_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.minhas_avaliacoes();
$$;

create function public.criar_caso(
  p_perfil jsonb,
  p_referencia text default null,
  p_alta_prevista date default null,
  p_consentimento boolean default false
)
returns public.casos
language sql
security invoker
set search_path = ''
as $$
  select * from private.criar_caso(p_perfil, p_referencia, p_alta_prevista, p_consentimento);
$$;

create function public.atualizar_caso(p_caso_id uuid, p_alteracoes jsonb)
returns public.casos
language sql
security invoker
set search_path = ''
as $$
  select * from private.atualizar_caso(p_caso_id, p_alteracoes);
$$;

create function public.enviar_caso(p_caso_id uuid, p_instituicao_ids text[], p_mensagem text default null)
returns setof public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.enviar_caso(p_caso_id, p_instituicao_ids, p_mensagem);
$$;

create function public.registar_procura(
  p_distrito text default null,
  p_lugar text default null,
  p_grau public.grau_dependencia default null,
  p_cuidados text[] default '{}',
  p_orcamento_max numeric default null,
  p_resultados integer default 0,
  p_com_vaga integer default 0
)
returns boolean
language sql
security invoker
set search_path = ''
as $$
  select private.registar_procura(p_distrito, p_lugar, p_grau, p_cuidados, p_orcamento_max, p_resultados, p_com_vaga);
$$;
comment on function public.registar_procura(text, text, public.grau_dependencia, text[], numeric, integer, integer) is
  'Qualquer pessoa (anon incluído): regista uma pesquisa sem vagas, sem dados pessoais. Limitada; devolve false se ignorada.';

create function public.procura_na_zona(p_dias integer default 30)
returns table (distrito text, dias integer, total integer, cuidados jsonb, graus jsonb, orcamento_mediano numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.procura_na_zona(p_dias);
$$;

create function public.renovar_token_confirmacao()
returns text
language sql
security invoker
set search_path = ''
as $$
  select private.renovar_token_confirmacao();
$$;

create function public.vagas_por_token(p_token text)
returns table (instituicao_id text, nome text, quartos jsonb, vagas_livres integer, atualizado_em timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.vagas_por_token(p_token);
$$;

create function public.confirmar_vagas_por_token(p_token text, p_ainda_tem boolean)
returns table (instituicao_id text, nome text, quartos jsonb, vagas_livres integer, atualizado_em timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select * from private.confirmar_vagas_por_token(p_token, p_ainda_tem);
$$;
comment on function public.confirmar_vagas_por_token(text, boolean) is
  'Link /confirmar/:token, sem sessão: sim renova a frescura das vagas; não põe os lugares livres a 0.';

-- ————————————————————————————————————————————————————————————————— 16. privilégios de execução

revoke all on function
  private.faixa_etaria(integer),
  private.maiuscula(text),
  private.normalizar_organizacao(jsonb),
  private.texto_organizacao(jsonb),
  private.taxa_para(public.natureza),
  private.link_pedido(uuid),
  private.hash_token(text),
  private.link_autor(public.candidaturas),
  private.resumo_perfil(jsonb),
  private.texto_pedido_anonimo(public.candidaturas),
  private.para_lar(public.candidaturas),
  private.pedidos_recebidos(),
  private.aceitar_candidatura(uuid),
  private.marcar_entrada(uuid, date),
  private.confirmar_entrada_familia(uuid, date),
  private.avaliar_lar(uuid, integer, text, jsonb),
  private.minhas_avaliacoes(),
  private.criar_caso(jsonb, text, date, boolean),
  private.atualizar_caso(uuid, jsonb),
  private.enviar_caso(uuid, text[], text),
  private.registar_procura(text, text, public.grau_dependencia, text[], numeric, integer, integer),
  private.procura_na_zona(integer),
  private.limpar_procuras_anonimas(integer),
  private.emitir_token_confirmacao(text, interval),
  private.renovar_token_confirmacao(),
  private.vagas_por_token(text),
  private.confirmar_vagas_por_token(text, boolean),
  public.pedidos_recebidos(),
  public.aceitar_candidatura(uuid),
  public.marcar_entrada(uuid, date),
  public.confirmar_entrada_familia(uuid, date),
  public.avaliar_lar(uuid, integer, text, jsonb),
  public.minhas_avaliacoes(),
  public.criar_caso(jsonb, text, date, boolean),
  public.atualizar_caso(uuid, jsonb),
  public.enviar_caso(uuid, text[], text),
  public.registar_procura(text, text, public.grau_dependencia, text[], numeric, integer, integer),
  public.procura_na_zona(integer),
  public.renovar_token_confirmacao(),
  public.vagas_por_token(text),
  public.confirmar_vagas_por_token(text, boolean)
from public, anon, authenticated;
-- manutenção e emissão de tokens: nem a service_role (correm no pg_cron/servidor como postgres)
revoke all on function private.limpar_procuras_anonimas(integer), private.emitir_token_confirmacao(text, interval)
  from service_role;

-- RPC de utilizadores com sessão (e as funções private que elas chamam; private não está na Data API)
grant execute on function
  public.pedidos_recebidos(),
  public.aceitar_candidatura(uuid),
  public.marcar_entrada(uuid, date),
  public.confirmar_entrada_familia(uuid, date),
  public.avaliar_lar(uuid, integer, text, jsonb),
  public.minhas_avaliacoes(),
  public.criar_caso(jsonb, text, date, boolean),
  public.atualizar_caso(uuid, jsonb),
  public.enviar_caso(uuid, text[], text),
  public.procura_na_zona(integer),
  public.renovar_token_confirmacao(),
  private.pedidos_recebidos(),
  private.aceitar_candidatura(uuid),
  private.marcar_entrada(uuid, date),
  private.confirmar_entrada_familia(uuid, date),
  private.avaliar_lar(uuid, integer, text, jsonb),
  private.minhas_avaliacoes(),
  private.criar_caso(jsonb, text, date, boolean),
  private.atualizar_caso(uuid, jsonb),
  private.enviar_caso(uuid, text[], text),
  private.procura_na_zona(integer),
  private.renovar_token_confirmacao()
to authenticated, service_role;

-- RPC sem sessão (a pesquisa anónima e o link de confirmação): anon precisa de USAGE no schema
-- private para o invólucro chamar a função interna — continua fora da Data API e todas as outras
-- funções private continuam sem EXECUTE para anon.
grant usage on schema private to anon;
grant execute on function
  public.registar_procura(text, text, public.grau_dependencia, text[], numeric, integer, integer),
  public.vagas_por_token(text),
  public.confirmar_vagas_por_token(text, boolean),
  private.registar_procura(text, text, public.grau_dependencia, text[], numeric, integer, integer),
  private.vagas_por_token(text),
  private.confirmar_vagas_por_token(text, boolean)
to anon, authenticated, service_role;

-- ————————————————————————————————————————————————————————————————— 17. pg_cron: retenção da procura anónima

do $agendar$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron indisponível: agende private.limpar_procuras_anonimas(365) à mão.';
    return;
  end if;
  perform cron.schedule(
    'encontralar-limpar-procuras',
    '41 3 * * *',
    'select private.limpar_procuras_anonimas(365)'
  );
end;
$agendar$;
