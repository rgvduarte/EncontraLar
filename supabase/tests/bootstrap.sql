-- =====================================================================================
-- APENAS PARA TESTES LOCAIS (PGlite). NUNCA aplicar num projeto Supabase.
--
-- Imita o mínimo da plataforma Supabase de que as migrações dependem, para as podermos
-- testar sem rede: papéis anon/authenticated/service_role, schema auth (auth.users,
-- auth.uid(), auth.jwt(), auth.role()) e os privilégios por omissão que o Supabase aplica
-- ao schema public (com "expor novas tabelas automaticamente" ligado — o pior caso, que
-- obriga as migrações a revogar explicitamente o que não deve ser público).
-- Num projeto real tudo isto já existe e é gerido pela plataforma.
-- =====================================================================================

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
grant usage on schema auth to anon, authenticated, service_role;

-- subconjunto das colunas de auth.users usadas pelos triggers e scripts do EncontraLar
-- (is_anonymous e email_confirmed_at existem no auth.users real do Supabase)
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  is_anonymous boolean not null default false,
  email_confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mesma semântica das funções do Supabase: leem as claims do JWT colocadas pelo PostgREST
-- em request.jwt.claim.sub / request.jwt.claims.
create function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.jwt() to anon, authenticated, service_role;
grant select on auth.users to service_role;

-- Privilégios por omissão do Supabase no schema public
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Publicação do Realtime (vazia, como num projeto novo)
create publication supabase_realtime;

-- Imitação mínima do pg_cron (o PGlite não o tem): cron.schedule(nome, agenda, comando) regista
-- o trabalho em cron.job, com a mesma semântica de "voltar a agendar com o mesmo nome substitui".
-- Os testes leem cron.job e executam o comando para provar que o trabalho agendado funciona.
create schema cron;
create table cron.job (
  jobid bigint generated always as identity primary key,
  jobname text unique,
  schedule text not null,
  command text not null,
  username text not null default current_user,
  active boolean not null default true
);
create function cron.schedule(job_name text, schedule text, command text)
returns bigint
language sql
as $$
  insert into cron.job (jobname, schedule, command) values (job_name, schedule, command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command
  returning jobid;
$$;

-- Imitação mínima do pg_net e do Vault (o PGlite não os tem), para a faturação agendada
-- (20261013120100_faturacao_agendamento.sql): net.http_post regista o pedido em net.pedidos_teste (os testes
-- leem o URL, o corpo e os cabeçalhos); vault.decrypted_secrets lê vault.secrets em claro (só em testes!).
create schema net;
create table net.pedidos_teste (
  id bigint generated always as identity primary key,
  url text,
  body jsonb,
  params jsonb,
  headers jsonb,
  timeout_milliseconds integer,
  criado_em timestamptz not null default now()
);
create function net.http_post(
  url text,
  body jsonb default '{}'::jsonb,
  params jsonb default '{}'::jsonb,
  headers jsonb default '{"Content-Type": "application/json"}'::jsonb,
  timeout_milliseconds integer default 5000
)
returns bigint
language sql
as $$
  insert into net.pedidos_teste (url, body, params, headers, timeout_milliseconds)
  values (url, body, params, headers, timeout_milliseconds)
  returning id;
$$;

create schema vault;
create table vault.secrets (
  id uuid primary key default gen_random_uuid(),
  name text unique,
  secret text not null
);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(new_secret text, new_name text default null)
returns uuid
language sql
as $$
  insert into vault.secrets (name, secret) values (new_name, new_secret)
  on conflict (name) do update set secret = excluded.secret
  returning id;
$$;
