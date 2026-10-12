-- =====================================================================================
-- EncontraLar — segurança: perfil automático no registo, RLS em TODAS as tabelas expostas,
-- GRANTs explícitos para a Data API (anon / authenticated) e triggers de proteção.
--
-- Modelo (resumo; detalhe em docs/SUPABASE.md):
--   * anon e authenticated leem fichas publicadas (instituicoes, quartos, saidas_mensais, avaliacoes);
--   * o dono (role 'lar') gere a SUA instituição, quartos e histórico de saídas;
--   * a família gere os SEUS perfis de cuidados, favoritos; lê as SUAS candidaturas e notificações;
--   * o lar lê as candidaturas dirigidas à sua instituição (com a cópia do perfil enviada com
--     consentimento) — NUNCA a tabela perfis_cuidados;
--   * candidaturas, eventos e notificações só são escritos por funções de servidor (private.*).
--
-- Os GRANTs começam por REVOGAR tudo a anon/authenticated: assim o resultado é o mesmo quer o
-- projeto tenha, ou não, a opção "expor novas tabelas automaticamente" ligada na Data API.
-- =====================================================================================

-- O papel authenticated precisa de USAGE no schema private para executar as funções auxiliares
-- usadas nas políticas e as funções chamadas pelas RPC públicas. O schema continua fora da
-- Data API (não está na lista de schemas expostos), por isso nada aqui é invocável por HTTP.
grant usage on schema private to authenticated, service_role;

-- ————————————————————————————————————————————————————————————————— funções auxiliares (RLS)
-- SECURITY DEFINER para não dependerem da RLS de outras tabelas (evita recursão e é mais rápido);
-- só revelam informação do próprio utilizador (auth.uid()).

create function private.tem_papel(p_role public.role_utilizador)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.perfis_utilizador p
    where p.id = (select auth.uid()) and p.role = p_role
  );
$$;
comment on function private.tem_papel(public.role_utilizador) is
  'true se o utilizador autenticado tem este papel (lido de perfis_utilizador, nunca de user_metadata).';

-- Um utilizador "lar" gere no máximo uma instituição: devolve o id (ou null).
-- Usada nas políticas como (select private.minha_instituicao()) → avaliada uma vez por consulta.
create function private.minha_instituicao()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select i.id from public.instituicoes i where i.owner_id = (select auth.uid()) limit 1;
$$;

revoke all on function private.tem_papel(public.role_utilizador) from public, anon;
revoke all on function private.minha_instituicao() from public, anon;
grant execute on function private.tem_papel(public.role_utilizador) to authenticated, service_role;
grant execute on function private.minha_instituicao() to authenticated, service_role;

-- ————————————————————————————————————————————————————————————————— registo de utilizadores
-- Ao criar uma conta (auth.users), cria o perfil e a notificação de boas-vindas.
--
-- Escolha do papel:
--   1. raw_app_meta_data.role — só um administrador o define (Auth Admin API / painel); tem prioridade;
--   2. senão, o parâmetro de registo raw_user_meta_data.role ('familia' | 'lar'), validado.
--      Os dois tipos de conta são de auto-registo no produto (famílias e instituições registam-se
--      sozinhas), por isso aceitar a escolha feita no formulário não concede nenhum privilégio
--      que o utilizador não pudesse obter. É lido UMA vez, aqui; a partir daí a autorização usa
--      apenas perfis_utilizador.role (imutável pelo utilizador). user_metadata nunca é usado em
--      políticas nem em funções de autorização (é editável pelo próprio utilizador).
--   3. por omissão: 'familia'.

create function private.criar_perfil_utilizador()
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
begin
  v_role := case
    when v_role_app in ('familia', 'lar') then v_role_app::public.role_utilizador
    when v_role_registo in ('familia', 'lar') then v_role_registo::public.role_utilizador
    else 'familia'::public.role_utilizador
  end;
  v_nome := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    split_part(coalesce(new.email, ''), '@', 1)
  )), 120);

  insert into public.perfis_utilizador (id, role, nome, telefone)
  values (new.id, v_role, v_nome, nullif(left(btrim(new.raw_user_meta_data ->> 'telefone'), 30), ''))
  on conflict (id) do nothing;

  insert into public.notificacoes (user_id, tipo, titulo, texto, link)
  values (
    new.id,
    'sistema',
    'Bem-vindo(a) ao EncontraLar',
    case v_role
      when 'lar' then 'Crie a ficha da sua instituição (fica pendente de verificação) e mantenha as vagas atualizadas.'
      else 'Crie o perfil da pessoa de quem cuida para receber sugestões compatíveis e alertas de vaga.'
    end,
    case v_role when 'lar' then '/gestao' else '/familia' end
  );
  return new;
end;
$$;

create trigger ao_criar_utilizador
  after insert on auth.users
  for each row execute function private.criar_perfil_utilizador();

-- Um administrador muda o papel através de app_metadata (Auth Admin API) → sincroniza.
create function private.sincronizar_role_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.raw_app_meta_data ->> 'role') in ('familia', 'lar')
     and (new.raw_app_meta_data ->> 'role') is distinct from (old.raw_app_meta_data ->> 'role') then
    update public.perfis_utilizador
       set role = (new.raw_app_meta_data ->> 'role')::public.role_utilizador
     where id = new.id;
  end if;
  return new;
end;
$$;

create trigger ao_atualizar_app_metadata
  after update of raw_app_meta_data on auth.users
  for each row execute function private.sincronizar_role_app_metadata();

-- Defesa em profundidade (além dos privilégios por coluna): um cliente nunca muda id/role.
create function private.proteger_perfil_utilizador()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated')
     and (new.role is distinct from old.role or new.id is distinct from old.id) then
    raise exception 'O tipo de conta não pode ser alterado pelo utilizador.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger perfis_utilizador_proteger
  before update on public.perfis_utilizador
  for each row execute function private.proteger_perfil_utilizador();

-- Se o dono alterar a licença de uma ficha verificada, a verificação volta a "pendente".
create function private.proteger_instituicao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and new.licenca is distinct from old.licenca
     and old.verificacao_estado = 'verificado' then
    new.verificacao_estado := 'pendente';
    new.verificacao_data := null;
  end if;
  return new;
end;
$$;

create trigger instituicoes_proteger
  before update on public.instituicoes
  for each row execute function private.proteger_instituicao();

-- Alterações aos quartos feitas por um utilizador (dono) renovam a "frescura" das vagas,
-- como no protótipo. Cargas administrativas (seed, sem sessão) não mexem em atualizado_em.
create function private.quartos_renovar_frescura()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    update public.instituicoes
       set atualizado_em = now()
     where id = coalesce(new.instituicao_id, old.instituicao_id);
  end if;
  return null;
end;
$$;

create trigger quartos_frescura
  after insert or update or delete on public.quartos
  for each row execute function private.quartos_renovar_frescura();

-- ————————————————————————————————————————————————————————————————— RLS: ativar em todas as tabelas

alter table public.perfis_utilizador enable row level security;
alter table public.instituicoes enable row level security;
alter table public.quartos enable row level security;
alter table public.saidas_mensais enable row level security;
alter table public.avaliacoes enable row level security;
alter table public.perfis_cuidados enable row level security;
alter table public.candidaturas enable row level security;
alter table public.candidatura_eventos enable row level security;
alter table public.favoritos enable row level security;
alter table public.notificacoes enable row level security;

-- ————————————————————————————————————————————————————————————————— políticas

-- perfis_utilizador: só o próprio
create policy perfis_utilizador_select_proprio on public.perfis_utilizador
  for select to authenticated
  using (id = (select auth.uid()));

create policy perfis_utilizador_update_proprio on public.perfis_utilizador
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- instituicoes
create policy instituicoes_select_publicadas on public.instituicoes
  for select to anon, authenticated
  using (publicado);

create policy instituicoes_select_dono on public.instituicoes
  for select to authenticated
  using (owner_id = (select auth.uid()));

create policy instituicoes_insert_lar on public.instituicoes
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and (select private.tem_papel('lar')));

create policy instituicoes_update_dono on public.instituicoes
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

-- quartos
create policy quartos_select_publicados on public.quartos
  for select to anon, authenticated
  using (exists (
    select 1 from public.instituicoes i where i.id = quartos.instituicao_id and i.publicado
  ));

create policy quartos_select_dono on public.quartos
  for select to authenticated
  using (instituicao_id = (select private.minha_instituicao()));

create policy quartos_insert_dono on public.quartos
  for insert to authenticated
  with check (instituicao_id = (select private.minha_instituicao()));

create policy quartos_update_dono on public.quartos
  for update to authenticated
  using (instituicao_id = (select private.minha_instituicao()))
  with check (instituicao_id = (select private.minha_instituicao()));

create policy quartos_delete_dono on public.quartos
  for delete to authenticated
  using (instituicao_id = (select private.minha_instituicao()));

-- saidas_mensais
create policy saidas_mensais_select_publicadas on public.saidas_mensais
  for select to anon, authenticated
  using (exists (
    select 1 from public.instituicoes i where i.id = saidas_mensais.instituicao_id and i.publicado
  ));

create policy saidas_mensais_select_dono on public.saidas_mensais
  for select to authenticated
  using (instituicao_id = (select private.minha_instituicao()));

create policy saidas_mensais_insert_dono on public.saidas_mensais
  for insert to authenticated
  with check (instituicao_id = (select private.minha_instituicao()));

create policy saidas_mensais_update_dono on public.saidas_mensais
  for update to authenticated
  using (instituicao_id = (select private.minha_instituicao()))
  with check (instituicao_id = (select private.minha_instituicao()));

-- avaliacoes: leitura pública (fichas publicadas); escrita por famílias, uma por instituição
create policy avaliacoes_select_publicadas on public.avaliacoes
  for select to anon, authenticated
  using (exists (
    select 1 from public.instituicoes i where i.id = avaliacoes.instituicao_id and i.publicado
  ));

create policy avaliacoes_insert_familia on public.avaliacoes
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.tem_papel('familia'))
    and exists (select 1 from public.instituicoes i where i.id = avaliacoes.instituicao_id and i.publicado)
  );

-- perfis_cuidados (DADOS DE SAÚDE): só o próprio. Nenhuma política para instituições.
create policy perfis_cuidados_select_proprio on public.perfis_cuidados
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy perfis_cuidados_insert_familia on public.perfis_cuidados
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.tem_papel('familia')));

create policy perfis_cuidados_update_proprio on public.perfis_cuidados
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy perfis_cuidados_delete_proprio on public.perfis_cuidados
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- candidaturas: leitura pelas duas partes; escrita só por RPC (sem políticas de escrita)
create policy candidaturas_select_familia on public.candidaturas
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy candidaturas_select_lar on public.candidaturas
  for select to authenticated
  using (instituicao_id = (select private.minha_instituicao()));

-- candidatura_eventos: visíveis a quem vê a candidatura (a subconsulta respeita a RLS acima)
create policy candidatura_eventos_select_partes on public.candidatura_eventos
  for select to authenticated
  using (exists (
    select 1 from public.candidaturas c where c.id = candidatura_eventos.candidatura_id
  ));

-- favoritos: só o próprio (famílias)
create policy favoritos_select_proprio on public.favoritos
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy favoritos_insert_familia on public.favoritos
  for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.tem_papel('familia')));

create policy favoritos_update_proprio on public.favoritos
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy favoritos_delete_proprio on public.favoritos
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- notificacoes: o próprio lê e marca como lida; criação só por funções de servidor
create policy notificacoes_select_proprio on public.notificacoes
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy notificacoes_update_proprio on public.notificacoes
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ————————————————————————————————————————————————————————————————— GRANTs (Data API)
-- Começa do zero (revoga os privilégios por omissão) e concede só o necessário.
-- Colunas não listadas nos GRANTs de INSERT/UPDATE são geridas pelo servidor.

revoke all on table
  public.perfis_utilizador, public.instituicoes, public.quartos, public.saidas_mensais,
  public.avaliacoes, public.perfis_cuidados, public.candidaturas, public.candidatura_eventos,
  public.favoritos, public.notificacoes
from anon, authenticated;

grant all on table
  public.perfis_utilizador, public.instituicoes, public.quartos, public.saidas_mensais,
  public.avaliacoes, public.perfis_cuidados, public.candidaturas, public.candidatura_eventos,
  public.favoritos, public.notificacoes
to service_role;

-- perfis_utilizador: ler o próprio, mudar nome/telefone (role nunca)
grant select on public.perfis_utilizador to authenticated;
grant update (nome, telefone) on public.perfis_utilizador to authenticated;

-- instituicoes: leitura pública; o dono escreve a ficha mas não id, verificação, agregados,
-- contadores, frescura nem visualizações
grant select on public.instituicoes to anon, authenticated;
grant insert (
  owner_id, publicado, nome, tipo, natureza, resumo, descricao, morada, codigo_postal, localidade,
  concelho, distrito, regiao, lat, lng, telefone, email, website, capacidade, lista_espera_offline,
  estadia_media_meses, acordo_ss, incluido, extras, graus, cuidados, comodidades,
  equipa_cuidadores_por_10, equipa_enfermeiros, equipa_medico_horas_semana, licenca, fundacao, capa
) on public.instituicoes to authenticated;
grant update (
  publicado, nome, tipo, natureza, resumo, descricao, morada, codigo_postal, localidade,
  concelho, distrito, regiao, lat, lng, telefone, email, website, capacidade, lista_espera_offline,
  estadia_media_meses, acordo_ss, incluido, extras, graus, cuidados, comodidades,
  equipa_cuidadores_por_10, equipa_enfermeiros, equipa_medico_horas_semana, licenca, fundacao, capa
) on public.instituicoes to authenticated;

-- quartos: os lugares livres só mudam por RPC (para avisar as famílias)
grant select on public.quartos to anon, authenticated;
grant insert (instituicao_id, tipo, total, preco_min, preco_max) on public.quartos to authenticated;
grant update (total, preco_min, preco_max) on public.quartos to authenticated;
grant delete on public.quartos to authenticated;

grant select on public.saidas_mensais to anon, authenticated;
grant insert (instituicao_id, mes, saidas) on public.saidas_mensais to authenticated;
grant update (saidas) on public.saidas_mensais to authenticated;

-- avaliacoes: user_id não é público (privilégio por coluna) → selecionar colunas explícitas
grant select (
  id, instituicao_id, autor, relacao, nota, aspeto_cuidados, aspeto_alimentacao, aspeto_instalacoes,
  aspeto_comunicacao, texto, verificada, created_at
) on public.avaliacoes to anon, authenticated;
grant insert (
  instituicao_id, user_id, autor, relacao, nota, aspeto_cuidados, aspeto_alimentacao,
  aspeto_instalacoes, aspeto_comunicacao, texto
) on public.avaliacoes to authenticated;

grant select, delete on public.perfis_cuidados to authenticated;
grant insert (
  user_id, nome, idade, relacao, genero, grau, necessidades, preferencias, quarto, local_label,
  local_lat, local_lng, raio_km, orcamento_max, urgencia, precisa_acordo_ss, notas
) on public.perfis_cuidados to authenticated;
grant update (
  nome, idade, relacao, genero, grau, necessidades, preferencias, quarto, local_label,
  local_lat, local_lng, raio_km, orcamento_max, urgencia, precisa_acordo_ss, notas
) on public.perfis_cuidados to authenticated;

-- candidaturas e eventos: só leitura (escrita pelas RPC)
grant select on public.candidaturas to authenticated;
grant select on public.candidatura_eventos to authenticated;

grant select, delete on public.favoritos to authenticated;
grant insert (user_id, instituicao_id, alerta) on public.favoritos to authenticated;
grant update (alerta) on public.favoritos to authenticated;

-- notificacoes: ler e marcar como lida (sem INSERT/DELETE)
grant select on public.notificacoes to authenticated;
grant update (lida) on public.notificacoes to authenticated;

-- Funções auxiliares de triggers: nunca invocáveis diretamente
revoke all on function
  private.definir_updated_at(), private.slugify(text), private.gerar_id_instituicao(),
  private.ajustar_livres_ao_total(), private.criar_perfil_utilizador(),
  private.sincronizar_role_app_metadata(), private.proteger_perfil_utilizador(),
  private.proteger_instituicao(), private.quartos_renovar_frescura()
from public, anon, authenticated;
