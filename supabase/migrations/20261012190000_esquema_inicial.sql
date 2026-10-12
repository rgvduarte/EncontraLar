-- =====================================================================================
-- EncontraLar — esquema inicial: tipos, tabelas, restrições, índices e triggers de manutenção.
--
-- Ordem das migrações:
--   20261012190000_esquema_inicial.sql   ← este ficheiro (estrutura)
--   20261012190100_seguranca.sql         ← RLS, GRANTs, perfil automático no registo
--   20261012190200_logica_negocio.sql    ← funções de negócio (schema private) + RPC públicas + vista
--   20261012190300_realtime.sql          ← publicação Realtime (se existir)
--
-- Convenções: identificadores em minúsculas snake_case, timestamptz em todas as datas,
-- índice em todas as chaves estrangeiras, comentários em português (PT-PT).
-- Dados de saúde (RGPD art. 9.º): public.perfis_cuidados e candidaturas.perfil_snapshot.
-- =====================================================================================

-- Schema interno: funções SECURITY DEFINER e de triggers. NÃO está exposto na Data API
-- (o PostgREST só serve os schemas listados nas definições da Data API: public, graphql_public).
create schema if not exists private;
comment on schema private is
  'Funções internas do EncontraLar (lógica de negócio SECURITY DEFINER e triggers). Não exposto na Data API.';
revoke all on schema private from public;
alter default privileges in schema private revoke execute on functions from public;

-- ————————————————————————————————————————————————————————————————— tipos enumerados
-- Enums para domínios pequenos, estáveis e usados em lógica (transições, filtros).

create type public.role_utilizador as enum ('familia', 'lar');
create type public.tipo_resposta as enum ('erpi', 'residencia', 'centro_dia');
create type public.natureza as enum ('ipss', 'misericordia', 'privado');
create type public.grau_dependencia as enum ('autonomo', 'ligeira', 'moderada', 'grave');
create type public.tipo_quarto as enum ('individual', 'duplo', 'casal');
create type public.estado_candidatura as enum (
  'enviada', 'em_analise', 'lista_espera', 'vaga_proposta', 'aceite', 'recusada', 'cancelada'
);
create type public.estado_verificacao as enum ('verificado', 'pendente', 'nao_verificado');
create type public.tipo_notificacao as enum ('vaga', 'candidatura', 'visita', 'sistema');
create type public.urgencia as enum ('imediata', '1-3meses', '3-6meses', 'planeamento');
create type public.estado_visita as enum ('pedida', 'confirmada', 'realizada');

-- ————————————————————————————————————————————————————————————————— domínios
-- Cuidados e comodidades: text[] com CHECK (domínio) em vez de enum[]. Justificação:
--   * as listas vão crescer (novos cuidados/comodidades) — trocar o CHECK de um domínio é uma
--     operação transacional simples; ALTER TYPE … ADD VALUE não pode ser usado na mesma transação
--     e um valor de enum nunca pode ser removido;
--   * o mesmo domínio é reutilizado nas instituições (oferta) e nos perfis (necessidades), e o
--     operador @> (contém) com índice GIN funciona igual em text[];
--   * os tipos gerados pelo supabase-js ficam string[] (o front-end valida com os tipos de src/types.ts).
-- Distritos e regiões: idem (texto com acentos e espaços, lista fechada mas sujeita a revisão administrativa).

create domain public.lista_cuidados as text[]
  constraint lista_cuidados_valores check (
    value <@ array[
      'enfermagem24h', 'medico', 'fisioterapia', 'demencia', 'paliativos', 'acamados', 'diabetes',
      'oxigenio', 'terapia_ocupacional', 'psicologia', 'nutricao', 'terapia_fala'
    ]::text[]
    and array_position(value, null) is null
  );

create domain public.lista_comodidades as text[]
  constraint lista_comodidades_valores check (
    value <@ array[
      'jardim', 'animais', 'quarto_wc', 'climatizacao', 'wifi', 'capela', 'cabeleireiro', 'transporte',
      'atividades', 'visitas_livres', 'cozinha_propria', 'piscina', 'lavandaria'
    ]::text[]
    and array_position(value, null) is null
  );

create domain public.distrito as text
  constraint distrito_valores check (
    value in (
      'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra', 'Évora', 'Faro', 'Guarda',
      'Leiria', 'Lisboa', 'Portalegre', 'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real',
      'Viseu', 'Madeira', 'Açores'
    )
  );

create domain public.regiao as text
  constraint regiao_valores check (
    value in ('Norte', 'Centro', 'Lisboa e Vale do Tejo', 'Alentejo', 'Algarve', 'Madeira', 'Açores')
  );

-- ————————————————————————————————————————————————————————————————— funções utilitárias

-- Mantém updated_at em todas as tabelas que o têm.
create function private.definir_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- "Casa de Repouso Jardins do Douro" → "casa-de-repouso-jardins-do-douro"
-- (translate explícito em vez da extensão unaccent: não depende do locale da base de dados).
create function private.slugify(p_texto text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(
      coalesce(p_texto, ''),
      'ÁÀÂÃÄÅÇÉÈÊËÍÌÎÏÑÓÒÔÕÖÚÙÛÜÝáàâãäåçéèêëíìîïñóòôõöúùûüýÿ',
      'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy'
    )),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

-- ————————————————————————————————————————————————————————————————— perfis_utilizador
-- Um registo por conta (auth.users). Criado automaticamente no registo (ver 20261012190100).
-- O papel (role) NÃO é editável pelo utilizador: privilégios por coluna + trigger de proteção.

create table public.perfis_utilizador (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.role_utilizador not null default 'familia',
  nome text not null default '' check (char_length(nome) <= 120),
  telefone text check (char_length(telefone) <= 30),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.perfis_utilizador is
  'Dados de conta visíveis apenas ao próprio. role é definido no registo e só muda por um administrador (app_metadata).';

create trigger perfis_utilizador_updated_at
  before update on public.perfis_utilizador
  for each row execute function private.definir_updated_at();

-- ————————————————————————————————————————————————————————————————— instituicoes
-- id = slug público e estável (é o id usado nas rotas /lar/:id do protótipo). O dono não o pode
-- alterar; se um administrador o mudar, as FKs propagam com ON UPDATE CASCADE.

create table public.instituicoes (
  id text primary key
    constraint instituicoes_id_formato check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(id) between 3 and 80),
  owner_id uuid default auth.uid() references public.perfis_utilizador (id) on delete set null,
  publicado boolean not null default false,

  nome text not null check (char_length(btrim(nome)) between 2 and 160),
  tipo public.tipo_resposta not null,
  natureza public.natureza not null,
  resumo text not null default '' check (char_length(resumo) <= 400),
  descricao text not null default '' check (char_length(descricao) <= 8000),

  morada text not null default '' check (char_length(morada) <= 200),
  codigo_postal text check (codigo_postal ~ '^[0-9]{4}-[0-9]{3}$'),
  localidade text not null check (char_length(localidade) between 1 and 120),
  concelho text not null check (char_length(concelho) between 1 and 120),
  distrito public.distrito not null,
  regiao public.regiao not null,
  lat numeric(8, 5) not null,
  lng numeric(8, 5) not null,

  telefone text check (char_length(telefone) <= 30),
  email text check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  website text check (website ~ '^https?://' and char_length(website) <= 300),

  capacidade integer not null check (capacidade between 1 and 2000),
  -- inscrições na lista de espera feitas por telefone/presencialmente (geridas pelo lar)
  lista_espera_offline integer not null default 0 check (lista_espera_offline between 0 and 10000),
  -- candidaturas da plataforma em lista_espera/vaga_proposta (mantido por trigger; não editável)
  lista_espera_online integer not null default 0 check (lista_espera_online >= 0),
  estadia_media_meses integer not null default 36 check (estadia_media_meses between 1 and 240),
  acordo_ss boolean not null default false,
  incluido text[] not null default '{}',
  extras jsonb not null default '[]' check (jsonb_typeof(extras) = 'array'),
  graus public.grau_dependencia[] not null default '{}',
  cuidados public.lista_cuidados not null default '{}',
  comodidades public.lista_comodidades not null default '{}',

  equipa_cuidadores_por_10 numeric(4, 1) not null default 0 check (equipa_cuidadores_por_10 between 0 and 100),
  equipa_enfermeiros integer not null default 0 check (equipa_enfermeiros between 0 and 1000),
  equipa_medico_horas_semana integer not null default 0 check (equipa_medico_horas_semana between 0 and 168),

  -- verificação EncontraLar: só administradores (service_role) alteram estado/datas
  licenca text not null default '' check (char_length(licenca) <= 60),
  verificacao_estado public.estado_verificacao not null default 'pendente',
  verificacao_data timestamptz,
  ultima_inspecao timestamptz,

  -- agregados das avaliações (os importados/demonstração já trazem o total histórico)
  avaliacao_media numeric(3, 2) not null default 0 check (avaliacao_media between 0 and 5),
  num_avaliacoes integer not null default 0 check (num_avaliacoes >= 0),

  fundacao integer check (fundacao between 1400 and 2100),
  -- última atualização das vagas pela instituição — sinal de confiança ("frescura")
  atualizado_em timestamptz not null default now(),
  capa jsonb not null default '{"hue": 152, "variante": 0}' check (jsonb_typeof(capa) = 'object'),
  visualizacoes_30d integer not null default 0 check (visualizacoes_30d >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Portugal continental, Madeira (com Porto Santo) e Açores
  constraint instituicoes_localizacao_portugal check (
    (lat between 36.9 and 42.2 and lng between -9.6 and -6.1)
    or (lat between 32.3 and 33.2 and lng between -17.4 and -16.2)
    or (lat between 36.9 and 39.8 and lng between -31.4 and -24.9)
  )
);
comment on table public.instituicoes is
  'Fichas públicas de lares/residências/centros de dia. Leitura pública só quando publicado = true.';
comment on column public.instituicoes.lista_espera_offline is
  'Pessoas inscritas fora da plataforma (telefone/presencial). Total da lista = offline + online.';
comment on column public.instituicoes.lista_espera_online is
  'Candidaturas EncontraLar em lista_espera ou vaga_proposta. Mantido pelo trigger candidaturas_lista_espera.';
comment on column public.instituicoes.atualizado_em is
  'Última confirmação/alteração das vagas pelo lar (frescura). Não editável diretamente.';

-- um utilizador "lar" gere no máximo uma instituição (também serve de índice da FK)
create unique index instituicoes_owner_id_key on public.instituicoes (owner_id) where owner_id is not null;
-- pesquisa: distrito + tipo (só fichas publicadas)
create index instituicoes_pesquisa_idx on public.instituicoes (distrito, tipo) where publicado;
create index instituicoes_concelho_idx on public.instituicoes (concelho) where publicado;
-- compatibilidade: cuidados @> necessidades
create index instituicoes_cuidados_idx on public.instituicoes using gin (cuidados);

create trigger instituicoes_updated_at
  before update on public.instituicoes
  for each row execute function private.definir_updated_at();

-- Gera o id (slug) a partir do nome quando não é indicado (fichas criadas pelos lares).
-- SECURITY DEFINER para ver todas as fichas (incluindo não publicadas) ao evitar colisões.
create function private.gerar_id_instituicao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_id text;
  v_n integer := 1;
begin
  if new.id is not null then
    return new;
  end if;
  v_base := left('lar-' || coalesce(nullif(private.slugify(new.nome), ''), 'instituicao'), 60);
  v_base := trim(both '-' from v_base);
  v_id := v_base;
  while exists (select 1 from public.instituicoes i where i.id = v_id) loop
    v_n := v_n + 1;
    v_id := v_base || '-' || v_n;
  end loop;
  new.id := v_id;
  return new;
end;
$$;

create trigger instituicoes_gerar_id
  before insert on public.instituicoes
  for each row execute function private.gerar_id_instituicao();

-- ————————————————————————————————————————————————————————————————— quartos

create table public.quartos (
  id bigint generated always as identity primary key,
  instituicao_id text not null references public.instituicoes (id) on delete cascade on update cascade,
  tipo public.tipo_quarto not null,
  total integer not null check (total between 0 and 2000),
  livres integer not null default 0,
  preco_min numeric(10, 2) not null check (preco_min >= 0),
  preco_max numeric(10, 2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quartos_livres_intervalo check (livres between 0 and total),
  constraint quartos_preco_intervalo check (preco_max >= preco_min),
  -- também é o índice da FK (instituicao_id é a coluna mais à esquerda)
  constraint quartos_instituicao_tipo_key unique (instituicao_id, tipo)
);
comment on column public.quartos.livres is
  'Lugares livres. Só muda pelas RPC definir_vagas / registar_vaga_libertada / registar_entrada (que avisam as famílias).';

-- pesquisa "com vaga"
create index quartos_com_vaga_idx on public.quartos (instituicao_id) where livres > 0;

create trigger quartos_updated_at
  before update on public.quartos
  for each row execute function private.definir_updated_at();

-- Se o total baixar abaixo dos livres, os livres acompanham (o formulário do lar faz o mesmo).
create function private.ajustar_livres_ao_total()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.livres > new.total then
    new.livres := new.total;
  end if;
  return new;
end;
$$;

create trigger quartos_ajustar_livres
  before update of total on public.quartos
  for each row execute function private.ajustar_livres_ao_total();

-- ————————————————————————————————————————————————————————————————— saidas_mensais
-- Histórico de saídas de residentes por mês (base da previsão de vagas).

create table public.saidas_mensais (
  instituicao_id text not null references public.instituicoes (id) on delete cascade on update cascade,
  mes date not null constraint saidas_mensais_primeiro_dia check (extract(day from mes) = 1),
  saidas integer not null default 0 check (saidas between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (instituicao_id, mes)
);

create trigger saidas_mensais_updated_at
  before update on public.saidas_mensais
  for each row execute function private.definir_updated_at();

-- ————————————————————————————————————————————————————————————————— avaliacoes

create table public.avaliacoes (
  id bigint generated always as identity primary key,
  instituicao_id text not null references public.instituicoes (id) on delete cascade on update cascade,
  -- null = avaliação importada/demonstração; apagar a conta apaga as avaliações (RGPD, art. 17.º)
  user_id uuid default auth.uid() references public.perfis_utilizador (id) on delete cascade,
  autor text not null check (char_length(btrim(autor)) between 1 and 80),
  relacao text not null default '' check (char_length(relacao) <= 80),
  nota smallint not null check (nota between 1 and 5),
  aspeto_cuidados smallint not null check (aspeto_cuidados between 1 and 5),
  aspeto_alimentacao smallint not null check (aspeto_alimentacao between 1 and 5),
  aspeto_instalacoes smallint not null check (aspeto_instalacoes between 1 and 5),
  aspeto_comunicacao smallint not null check (aspeto_comunicacao between 1 and 5),
  texto text not null check (char_length(btrim(texto)) between 10 and 3000),
  verificada boolean not null default false,
  created_at timestamptz not null default now(),
  -- uma avaliação por utilizador e instituição (NULLs — importadas — não colidem)
  constraint avaliacoes_uma_por_utilizador unique (instituicao_id, user_id)
);

create index avaliacoes_instituicao_recentes_idx on public.avaliacoes (instituicao_id, created_at desc);
create index avaliacoes_user_id_idx on public.avaliacoes (user_id) where user_id is not null;

-- ————————————————————————————————————————————————————————————————— perfis_cuidados (DADOS DE SAÚDE)

create table public.perfis_cuidados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.perfis_utilizador (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 120),
  idade smallint not null check (idade between 18 and 130),
  -- relação com o utilizador: "Mãe", "Pai", "Avó"…
  relacao text not null default '' check (char_length(relacao) <= 60),
  genero text check (genero in ('F', 'M')),
  grau public.grau_dependencia not null,
  necessidades public.lista_cuidados not null default '{}',
  preferencias public.lista_comodidades not null default '{}',
  quarto text not null default 'indiferente' check (quarto in ('individual', 'duplo', 'casal', 'indiferente')),
  -- centro da pesquisa
  local_label text not null default '' check (char_length(local_label) <= 120),
  local_lat numeric(8, 5) not null check (local_lat between -90 and 90),
  local_lng numeric(8, 5) not null check (local_lng between -180 and 180),
  raio_km integer not null default 15 check (raio_km between 1 and 1000),
  orcamento_max numeric(10, 2) not null default 0 check (orcamento_max >= 0),
  urgencia public.urgencia not null default '1-3meses',
  precisa_acordo_ss boolean not null default false,
  notas text check (char_length(notas) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.perfis_cuidados is
  'DADOS DE SAÚDE (RGPD art. 9.º). Só o próprio utilizador lê/escreve. As instituições só veem a cópia enviada numa candidatura.';

create index perfis_cuidados_user_id_idx on public.perfis_cuidados (user_id);

create trigger perfis_cuidados_updated_at
  before update on public.perfis_cuidados
  for each row execute function private.definir_updated_at();

-- ————————————————————————————————————————————————————————————————— candidaturas

create table public.candidaturas (
  id uuid primary key default gen_random_uuid(),
  instituicao_id text not null references public.instituicoes (id) on delete cascade on update cascade,
  user_id uuid not null references public.perfis_utilizador (id) on delete cascade,
  -- o perfil pode ser apagado depois; a instituição mantém a cópia enviada (perfil_snapshot)
  perfil_id uuid references public.perfis_cuidados (id) on delete set null,
  -- cópia do perfil no momento do envio (o que o lar vê). DADOS DE SAÚDE.
  perfil_snapshot jsonb not null check (jsonb_typeof(perfil_snapshot) = 'object'),
  -- nome/email/telefone do familiar responsável, para o lar
  contacto jsonb not null check (jsonb_typeof(contacto) = 'object'),
  estado public.estado_candidatura not null default 'enviada',
  -- posição na lista de espera (inclui as inscrições offline à frente)
  posicao integer check (posicao > 0),
  mensagem text check (char_length(mensagem) <= 2000),
  visita_data date,
  visita_hora time,
  visita_estado public.estado_visita,
  -- prazo para a família responder a uma vaga proposta
  prazo_resposta timestamptz,
  -- consentimento explícito da família para partilhar o perfil (dados de saúde) com ESTA instituição
  consentimento_em timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint candidaturas_posicao_so_na_lista check (
    (posicao is not null) = (estado in ('lista_espera', 'vaga_proposta'))
  ),
  constraint candidaturas_prazo_so_em_proposta check ((prazo_resposta is not null) = (estado = 'vaga_proposta')),
  constraint candidaturas_visita_completa check (
    (visita_data is null) = (visita_hora is null) and (visita_data is null) = (visita_estado is null)
  ),
  -- posições únicas por instituição; DEFERRABLE para a verificação ser feita no fim de cada
  -- instrução (deslocar a fila com posicao = posicao - 1 não colide a meio)
  constraint candidaturas_posicao_unica unique (instituicao_id, posicao) deferrable initially immediate
);
comment on table public.candidaturas is
  'Pedidos de vaga. Visíveis à família que os enviou e ao dono da instituição de destino. Escrita só por RPC.';

-- painel do lar: pedidos por estado (também cobre a FK instituicao_id)
create index candidaturas_instituicao_estado_idx on public.candidaturas (instituicao_id, estado, created_at desc);
-- painel da família
create index candidaturas_user_id_idx on public.candidaturas (user_id, updated_at desc);
create index candidaturas_perfil_id_idx on public.candidaturas (perfil_id) where perfil_id is not null;
-- uma candidatura ativa por família + instituição + perfil (como no protótipo)
create unique index candidaturas_ativa_unica on public.candidaturas (user_id, instituicao_id, perfil_id)
  where estado not in ('cancelada', 'recusada');

create trigger candidaturas_updated_at
  before update on public.candidaturas
  for each row execute function private.definir_updated_at();

-- ————————————————————————————————————————————————————————————————— candidatura_eventos

create table public.candidatura_eventos (
  id bigint generated always as identity primary key,
  candidatura_id uuid not null references public.candidaturas (id) on delete cascade,
  estado public.estado_candidatura not null,
  nota text check (char_length(nota) <= 2000),
  -- quem originou o evento
  autor text not null default 'sistema' check (autor in ('familia', 'lar', 'sistema')),
  autor_id uuid references public.perfis_utilizador (id) on delete set null,
  created_at timestamptz not null default now()
);

create index candidatura_eventos_candidatura_idx on public.candidatura_eventos (candidatura_id, created_at);
create index candidatura_eventos_autor_id_idx on public.candidatura_eventos (autor_id) where autor_id is not null;

-- ————————————————————————————————————————————————————————————————— favoritos

create table public.favoritos (
  user_id uuid not null default auth.uid() references public.perfis_utilizador (id) on delete cascade,
  instituicao_id text not null references public.instituicoes (id) on delete cascade on update cascade,
  -- avisar quando houver vaga
  alerta boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, instituicao_id)
);

-- FK + "quem segue esta instituição com alerta" (avisos de nova vaga)
create index favoritos_instituicao_id_idx on public.favoritos (instituicao_id) include (alerta);

-- ————————————————————————————————————————————————————————————————— notificacoes

create table public.notificacoes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.perfis_utilizador (id) on delete cascade,
  tipo public.tipo_notificacao not null,
  titulo text not null check (char_length(titulo) <= 200),
  texto text not null check (char_length(texto) <= 2000),
  instituicao_id text references public.instituicoes (id) on delete set null on update cascade,
  -- o texto pode mencionar a pessoa idosa: apagar a candidatura apaga as notificações associadas
  candidatura_id uuid references public.candidaturas (id) on delete cascade,
  -- rota interna da app
  link text check (link ~ '^/' and char_length(link) <= 300),
  lida boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.notificacoes is
  'Criadas apenas por código de servidor (funções private.*). O utilizador só lê e marca como lidas as suas.';

create index notificacoes_user_recentes_idx on public.notificacoes (user_id, created_at desc);
create index notificacoes_user_nao_lidas_idx on public.notificacoes (user_id) where not lida;
create index notificacoes_instituicao_id_idx on public.notificacoes (instituicao_id) where instituicao_id is not null;
create index notificacoes_candidatura_id_idx on public.notificacoes (candidatura_id) where candidatura_id is not null;
