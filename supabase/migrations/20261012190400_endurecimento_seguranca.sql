-- =====================================================================================
-- EncontraLar — endurecimento de segurança (revisão de 2026-10-12).
--
-- As migrações anteriores podem já ter sido aplicadas, por isso esta NÃO as edita: substitui
-- funções (create or replace), ajusta políticas e privilégios e acrescenta restrições.
--
--   1. Registo: contas anónimas são sempre 'familia'; o papel 'lar' escolhido no registo só dá
--      direito a criar UM rascunho de ficha, nunca a receber dados de saúde (ver 2 e a migração
--      20261012190500: só fichas verificadas, com gestor, recebem pedidos).
--   2. Publicar é decisão do administrador: publicado sai dos privilégios dos clientes; um trigger
--      impede que um cliente o mude e força os valores de servidor numa ficha nova.
--   3. A verificação volta a "pendente" quando o dono muda nome, morada, contactos, licença…
--   4. Ficha que fica sem gestor (conta apagada) sai da pesquisa.
--   5. Dados internos (owner_id, visualizacoes_30d, autor_id dos eventos) deixam de ser legíveis
--      por anon/authenticated; o dono obtém-nos pela RPC painel_instituicao (20261012190500).
--   6. Limites de tamanho em listas/jsonb servidos a anon (incluido, extras, capa, graus, domínios).
--   7. Fichas e contas de demonstração marcadas (demonstracao) — isoladas das reais.
--   8. Favoritos só de fichas publicadas (sem oráculo de existência); avaliações: o autor pode
--      apagar a sua; contas anónimas não criam fichas, perfis de saúde nem avaliações.
--   9. Sequências do schema public sem privilégios para anon/authenticated.
--  10. equipa_medico_horas_semana aceita décimas (o formulário aceita "7,5").
--  11. Quartos: a capacidade acompanha a soma dos lugares (como atualizarLar no protótipo).
--  12. Vista instituicoes_publicas sem colunas internas; meses no fuso Europe/Lisbon.
-- =====================================================================================

-- A vista depende de colunas alteradas abaixo (tipo de equipa_medico_horas_semana): recriada no fim.
drop view if exists public.instituicoes_publicas;

-- ————————————————————————————————————————————————————————————————— 7. demonstração

alter table public.instituicoes
  add column demonstracao boolean not null default false;
comment on column public.instituicoes.demonstracao is
  'Ficha FICTÍCIA (supabase/seed.sql). Só recebe pedidos de contas de demonstração e vice-versa. Só o administrador altera.';

alter table public.perfis_utilizador
  add column demonstracao boolean not null default false;
comment on column public.perfis_utilizador.demonstracao is
  'Conta de demonstração (palavra-passe pública). Só interage com fichas de demonstração. Definido por supabase/demo/utilizadores-demo.sql.';

-- ————————————————————————————————————————————————————————————————— 1. registo

-- Escolha do papel no registo:
--   1. raw_app_meta_data.role — só um administrador o define (Auth Admin API); tem prioridade;
--   2. contas anónimas (signInAnonymously) → sempre 'familia', seja qual for o user_metadata;
--   3. senão, raw_user_meta_data.role ('familia' | 'lar'), escolhido no formulário de registo;
--   4. por omissão: 'familia'.
-- Porque é aceitável ler o passo 3 de user_metadata (que o utilizador controla): os dois tipos de
-- conta são de auto-registo no produto, e o papel 'lar' NÃO concede acesso a dados de saúde —
-- só permite criar um rascunho de ficha, não publicado e "pendente". Uma instituição só recebe
-- pedidos (com a cópia do perfil) depois de o administrador a verificar e publicar
-- (private.candidatar exige publicado + verificado + gestor). O valor é lido UMA vez, aqui:
-- alterações posteriores ao user_metadata não mudam o papel (só o app_metadata, via
-- private.sincronizar_role_app_metadata), e user_metadata nunca é usado em políticas.
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
begin
  v_role := case
    when v_role_app in ('familia', 'lar') then v_role_app::public.role_utilizador
    when coalesce(new.is_anonymous, false) then 'familia'::public.role_utilizador
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
      when 'lar' then 'Crie a ficha da sua instituição. Fica visível nas pesquisas e pode receber pedidos depois de verificada pela equipa EncontraLar.'
      else 'Crie o perfil da pessoa de quem cuida para receber sugestões compatíveis e alertas de vaga.'
    end,
    case v_role when 'lar' then '/gestao' else '/familia' end
  );
  return new;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 2, 3, 4. proteção das fichas

-- Antes de cada UPDATE de instituicoes:
--   * owner_id passa a null (ex.: ON DELETE SET NULL quando a conta do gestor é apagada) → a ficha
--     sai da pesquisa até um administrador a rever (vale para qualquer papel);
--   * clientes (anon/authenticated) não publicam nem despublicam;
--   * clientes que mudem um campo de identidade ou de contacto de uma ficha verificada fazem-na
--     voltar a "pendente" (o selo não pode ficar ao lado de um nome/telefone que ninguém verificou).
-- Atualizações feitas por funções de servidor (SECURITY DEFINER → current_user = dono das funções)
-- não passam pelas regras de clientes.
create or replace function private.proteger_instituicao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.owner_id is not null and new.owner_id is null then
    new.publicado := false;
  end if;

  if current_user in ('anon', 'authenticated') then
    if new.publicado is distinct from old.publicado or new.demonstracao is distinct from old.demonstracao then
      raise exception 'A publicação da ficha é feita pela equipa EncontraLar depois da verificação.'
        using errcode = '42501';
    end if;
    if old.verificacao_estado = 'verificado'
       and (new.nome, new.tipo, new.natureza, new.morada, new.codigo_postal, new.localidade, new.concelho,
            new.distrito, new.regiao, new.lat, new.lng, new.acordo_ss, new.licenca,
            new.telefone, new.email, new.website)
           is distinct from
           (old.nome, old.tipo, old.natureza, old.morada, old.codigo_postal, old.localidade, old.concelho,
            old.distrito, old.regiao, old.lat, old.lng, old.acordo_ss, old.licenca,
            old.telefone, old.email, old.website)
    then
      new.verificacao_estado := 'pendente';
      new.verificacao_data := null;
    end if;
  end if;
  return new;
end;
$$;

-- Ficha criada por um cliente: os campos de servidor ficam sempre nos valores iniciais, mesmo que
-- um dia os privilégios por coluna sejam alargados por engano (defesa em profundidade).
create function private.proteger_instituicao_insercao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') then
    new.publicado := false;
    new.demonstracao := false;
    new.verificacao_estado := 'pendente';
    new.verificacao_data := null;
    new.ultima_inspecao := null;
    new.lista_espera_offline := 0;
    new.lista_espera_online := 0;
    new.avaliacao_media := 0;
    new.num_avaliacoes := 0;
    new.visualizacoes_30d := 0;
    new.atualizado_em := now();
  end if;
  return new;
end;
$$;

create trigger instituicoes_proteger_insercao
  before insert on public.instituicoes
  for each row execute function private.proteger_instituicao_insercao();

-- ————————————————————————————————————————————————————————————————— 5. privilégios de leitura

-- instituicoes: lista explícita de colunas (sem owner_id nem visualizacoes_30d). As políticas RLS
-- continuam a usar owner_id (as expressões das políticas não exigem privilégio de coluna).
revoke select on public.instituicoes from anon, authenticated;
grant select (
  id, publicado, demonstracao, nome, tipo, natureza, resumo, descricao, morada, codigo_postal, localidade,
  concelho, distrito, regiao, lat, lng, telefone, email, website, capacidade, lista_espera_offline,
  lista_espera_online, estadia_media_meses, acordo_ss, incluido, extras, graus, cuidados, comodidades,
  equipa_cuidadores_por_10, equipa_enfermeiros, equipa_medico_horas_semana, licenca, verificacao_estado,
  verificacao_data, ultima_inspecao, avaliacao_media, num_avaliacoes, fundacao, atualizado_em, capa,
  created_at, updated_at
) on public.instituicoes to anon, authenticated;

-- escrita do dono: sem publicado (decisão do administrador) e sem lista_espera_offline (não há
-- interface para a gerir; mexer-lhe desalinharia as posições da lista — fica para o administrador)
revoke insert (publicado, lista_espera_offline), update (publicado, lista_espera_offline)
  on public.instituicoes from authenticated;

-- candidatura_eventos: autor_id (uuid da conta de quem agiu) não é exposto
revoke select on public.candidatura_eventos from authenticated;
grant select (id, candidatura_id, estado, nota, autor, created_at) on public.candidatura_eventos to authenticated;

-- ————————————————————————————————————————————————————————————————— 9. sequências

-- As colunas identity não precisam de privilégios na sequência para INSERT; anon/authenticated
-- não têm motivo para usar nextval/setval (setval permitiria provocar colisões de chaves).
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- ————————————————————————————————————————————————————————————————— 6. limites de tamanho

alter domain public.lista_cuidados
  add constraint lista_cuidados_tamanho check (cardinality(value) <= 12);
alter domain public.lista_comodidades
  add constraint lista_comodidades_tamanho check (cardinality(value) <= 13);

alter table public.instituicoes
  add constraint instituicoes_incluido_limite check (
    cardinality(incluido) <= 30
    and octet_length(array_to_string(incluido, '')) <= 3000
    and array_position(incluido, null) is null
  ),
  add constraint instituicoes_extras_limite check (
    case when jsonb_typeof(extras) = 'array' then
      jsonb_array_length(extras) <= 30
      and octet_length(extras::text) <= 4000
      and not jsonb_path_exists(
        extras, '$[*] ? (!(@.type() == "object" && @.nome.type() == "string" && @.preco.type() == "string"))'
      )
    else false end
  ),
  add constraint instituicoes_capa_formato check (
    case when jsonb_typeof(capa) = 'object' then
      (capa - array['hue', 'variante']) = '{}'::jsonb
      and jsonb_typeof(capa -> 'hue') = 'number'
      and jsonb_typeof(capa -> 'variante') = 'number'
      and octet_length(capa::text) <= 100
    else false end
  ),
  add constraint instituicoes_graus_limite check (
    cardinality(graus) <= 4 and array_position(graus, null) is null
  );

-- ————————————————————————————————————————————————————————————————— 10. horas de médico com décimas

alter table public.instituicoes
  alter column equipa_medico_horas_semana type numeric(4, 1);

-- ————————————————————————————————————————————————————————————————— 8. políticas

-- contas anónimas (se um dia forem ativadas) não criam fichas, perfis de saúde nem avaliações
alter policy instituicoes_insert_lar on public.instituicoes
  with check (
    owner_id = (select auth.uid())
    and (select private.tem_papel('lar'))
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  );

alter policy perfis_cuidados_insert_familia on public.perfis_cuidados
  with check (
    user_id = (select auth.uid())
    and (select private.tem_papel('familia'))
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
  );

-- avaliações: só em fichas publicadas do MESMO "mundo" (contas de demonstração só avaliam fichas
-- de demonstração — a palavra-passe delas é pública)
alter policy avaliacoes_insert_familia on public.avaliacoes
  with check (
    user_id = (select auth.uid())
    and (select private.tem_papel('familia'))
    and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
    and exists (
      select 1 from public.instituicoes i
       where i.id = avaliacoes.instituicao_id
         and i.publicado
         and i.demonstracao = coalesce(
           (select p.demonstracao from public.perfis_utilizador p where p.id = (select auth.uid())), false
         )
    )
  );

-- o autor pode apagar a sua avaliação (os agregados são corrigidos pelo trigger avaliacoes_agregados)
create policy avaliacoes_delete_proprio on public.avaliacoes
  for delete to authenticated
  using (user_id = (select auth.uid()));
grant delete on public.avaliacoes to authenticated;

-- favoritos: só fichas publicadas. Para uma ficha não publicada e para um id inexistente o erro é
-- o mesmo (violação da política, verificada antes da chave estrangeira) → sem oráculo de existência.
alter policy favoritos_insert_familia on public.favoritos
  with check (
    user_id = (select auth.uid())
    and (select private.tem_papel('familia'))
    and exists (
      select 1 from public.instituicoes i where i.id = favoritos.instituicao_id and i.publicado
    )
  );

-- ————————————————————————————————————————————————————————————————— 11. quartos → capacidade e frescura

-- Depois de qualquer alteração aos quartos:
--   * a capacidade da ficha nunca fica abaixo da soma dos lugares (como atualizarLar no protótipo);
--   * se a alteração vier de um utilizador (sessão), renova a "frescura" das vagas.
-- As cargas administrativas (seed, sem sessão) só corrigem a capacidade se for preciso.
create or replace function private.quartos_renovar_frescura()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inst text := coalesce(new.instituicao_id, old.instituicao_id);
  v_soma integer;
begin
  select coalesce(sum(q.total), 0)::int into v_soma from public.quartos q where q.instituicao_id = v_inst;
  if (select auth.uid()) is not null then
    update public.instituicoes
       set atualizado_em = now(), capacidade = greatest(capacidade, v_soma)
     where id = v_inst;
  else
    update public.instituicoes set capacidade = v_soma where id = v_inst and capacidade < v_soma;
  end if;
  return null;
end;
$$;

-- ————————————————————————————————————————————————————————————————— índices

-- painel do lar ordenado por data (useCandidaturasDoLar), sem filtro de estado
create index candidaturas_instituicao_recentes_idx on public.candidaturas (instituicao_id, created_at desc);

-- ————————————————————————————————————————————————————————————————— 12. vista pública

-- security_invoker: aplica a RLS e os privilégios por coluna de quem consulta. Por isso a vista
-- NÃO pode referir owner_id nem visualizacoes_30d (anon e authenticated não as podem ler);
-- o dono obtém esses dados com a RPC painel_instituicao().
create view public.instituicoes_publicas
with (security_invoker = true)
as
select
  i.id, i.nome, i.tipo, i.natureza, i.resumo, i.descricao,
  i.morada, i.codigo_postal, i.localidade, i.concelho, i.distrito, i.regiao, i.lat, i.lng,
  i.telefone, i.email, i.website,
  i.capacidade,
  i.lista_espera_offline + i.lista_espera_online as lista_espera,
  i.estadia_media_meses, i.acordo_ss, i.incluido, i.extras, i.graus, i.cuidados, i.comodidades,
  i.equipa_cuidadores_por_10, i.equipa_enfermeiros, i.equipa_medico_horas_semana,
  i.licenca, i.verificacao_estado, i.verificacao_data, i.ultima_inspecao,
  i.avaliacao_media, i.num_avaliacoes, i.fundacao, i.atualizado_em, i.capa,
  i.publicado, i.demonstracao,
  coalesce(q.vagas_livres, 0) as vagas_livres,
  q.mensalidade_min,
  q.mensalidade_max,
  coalesce(q.quartos, '[]'::jsonb) as quartos,
  coalesce(h.historico, '{}'::integer[]) as historico_saidas
from public.instituicoes i
left join lateral (
  select
    sum(qq.livres)::integer as vagas_livres,
    min(qq.preco_min) as mensalidade_min,
    max(qq.preco_max) as mensalidade_max,
    jsonb_agg(
      jsonb_build_object(
        'tipo', qq.tipo, 'total', qq.total, 'livres', qq.livres,
        'preco_min', qq.preco_min, 'preco_max', qq.preco_max
      ) order by qq.tipo
    ) as quartos
  from public.quartos qq
  where qq.instituicao_id = i.id
) q on true
left join lateral (
  -- últimos 12 meses no calendário português (o último é o mês corrente em Lisboa)
  select array_agg(coalesce(s.saidas, 0) order by m.mes) as historico
  from generate_series(
         date_trunc('month', now() at time zone 'Europe/Lisbon') - interval '11 months',
         date_trunc('month', now() at time zone 'Europe/Lisbon'),
         interval '1 month'
       ) as m (mes)
  left join public.saidas_mensais s on s.instituicao_id = i.id and s.mes = m.mes::date
  where exists (select 1 from public.saidas_mensais x where x.instituicao_id = i.id)
) h on true;

comment on view public.instituicoes_publicas is
  'Pesquisa/ficha pública: vagas_livres, mensalidade_min/max e quartos calculados a partir de quartos; lista_espera = offline + plataforma; historico_saidas = últimos 12 meses (Europe/Lisbon; o último é o mês corrente). Sem colunas internas (owner_id, visualizacoes_30d): ver painel_instituicao().';

revoke all on public.instituicoes_publicas from anon, authenticated;
grant select on public.instituicoes_publicas to anon, authenticated, service_role;

-- ————————————————————————————————————————————————————————————————— privilégios das funções novas
revoke all on function private.proteger_instituicao_insercao() from public, anon, authenticated;
