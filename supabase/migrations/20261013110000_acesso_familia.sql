-- =====================================================================================
-- EncontraLar — Acesso Família no servidor (modelo de dois lados, decisões de 13/10/2026,
-- docs/MODELO-NEGOCIO.md). Até aqui a versão grátis só existia na interface: qualquer pessoa lia
-- vagas, preços por quarto, contactos e as entradas da previsão na vista pública. Esta migração
-- impõe a divisão na base de dados (espelha src/lib/acesso.ts: temAcessoCompleto, novoAte,
-- faixaPreco, resumoDisponibilidade, MIN_AGREGADO; src/lib/forecast.ts: vagaParaNovos,
-- disponibilidade; e o que a versão grátis da interface mostra):
--
--   1. Direito de acesso (public.acessos_familia): um passe por família, com o fim (ate). Só o
--      servidor o escreve (private.estender_acesso, chamada pela faturação); a família lê o seu
--      (acesso_estado()). private.tem_acesso_completo(): profissionais e equipa sempre; famílias com
--      passe em vigor; anon, instituições e o resto nunca.
--   2. Público (anon e qualquer conta): instituicoes_publicas só com o que a versão grátis mostra —
--      quem existe, onde (com as coordenadas: o mapa da pesquisa grátis mostra os alfinetes), tipo,
--      natureza, descrição, serviços e cuidados, equipa, verificação, avaliação geral e número de
--      avaliações, os NOMES dos extras e a FAIXA de preço (faixa_preco, como faixaPreco).
--   3. Completo (Acesso Família, profissionais, equipa; e o dono, só a sua ficha): instituicoes_completas()
--      devolve a ficha inteira (quartos com preços e lugares livres, lista de espera, entradas da
--      previsão, frescura das vagas, contactos, morada, preços dos extras) — a mesma linha da vista
--      antiga, para larDeLinha. Na tabela, essas colunas deixam de ser legíveis por anon/authenticated
--      (privilégios por coluna) e quartos, saídas mensais e avaliações passam a ter leitura só com
--      acesso completo (RLS) — o Realtime dos quartos segue a mesma regra.
--   4. Agregados (disponibilidade_agregada): "quantas têm vaga nesta zona", nunca quais; abaixo de 5
--      instituições (MIN_AGREGADO) só o total. Mesmas definições de vagaParaNovos e disponibilidade.
--   5. Avaliações (avaliacoes_instituicao): sem acesso, no máximo um excerto (de preferência de uma
--      avaliação verificada); com acesso, todas.
--   6. Ações pagas impostas aqui: pedidos e visitas (candidatar, pedir_visita) e ligar o alerta de vaga
--      (favoritos.alerta) exigem o acesso completo; guardar e desligar o alerta continuam livres. Os
--      avisos de vaga a quem segue uma ficha só vão para quem tem acesso; quem está na lista de espera
--      é sempre avisado (como avisarNovaVaga no protótipo).
--
-- Os valores dos passes (€) não vivem aqui: só os dias de cada plano (a faturação guarda o que foi pago).
-- Erros "é do Acesso Família" levam o código 42501 e hint = 'acesso_familia' (a interface abre a folha
-- do Acesso Família em vez de mostrar um erro).
-- =====================================================================================

-- ————————————————————————————————————————————————————————————————— 1. tipos

-- passes do Acesso Família (PLANOS_FAMILIA em src/lib/acesso.ts): só os dias vivem na base de dados
create type public.plano_familia as enum ('acesso_30', 'acesso_90');
comment on type public.plano_familia is
  'Passe do Acesso Família: acesso_30 (30 dias) ou acesso_90 (90 dias). Sem renovação automática; uma nova compra soma os dias.';

-- faixa de preço da versão grátis (faixaPreco em src/lib/acesso.ts)
create type public.faixa_preco as enum ('ate_1000', '1000_2000', 'mais_2000', 'conforme_rendimentos');
comment on type public.faixa_preco is
  'Faixa de preço pública: privados pela mensalidade mais baixa (até 1.000 €, 1.000 € a 2.000 €, mais de 2.000 €); IPSS e Misericórdias conforme os rendimentos.';

-- ————————————————————————————————————————————————————————————————— 2. direito de acesso

create table public.acessos_familia (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- último passe comprado (o fim já soma os anteriores)
  plano public.plano_familia not null,
  -- o acesso termina neste instante (sem renovação automática)
  ate timestamptz not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.acessos_familia is
  'Acesso Família de cada família (um passe em vigor por conta). O próprio lê a sua linha; só o servidor escreve (private.estender_acesso, chamada pela faturação).';

alter table public.acessos_familia enable row level security;

create policy acessos_familia_select_proprio on public.acessos_familia
  for select to authenticated
  using (user_id = (select auth.uid()));

-- clientes só leem; a service_role também só lê (escreve-se por private.estender_acesso)
revoke all on table public.acessos_familia from anon, authenticated, service_role;
grant select on public.acessos_familia to authenticated, service_role;

-- Dias de cada passe (PLANOS_FAMILIA): 30 ou 90.
create function private.dias_plano_familia(p_plano public.plano_familia)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_plano when 'acesso_30' then 30 when 'acesso_90' then 90 end;
$$;

-- temAcessoCompleto(user) no protótipo: vê a camada completa (vagas, preços, previsão, contactos, pedidos)?
-- profissional e equipa → sempre; família → enquanto acessos_familia.ate > agora; anon, 'lar' e o resto → nunca.
-- (Uma instituição vê sempre a SUA ficha completa, pelas RPC do dono e por instituicoes_completas.)
create function private.tem_acesso_completo(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select case p.role
             when 'profissional' then true
             when 'equipa' then true
             when 'familia' then exists (
               select 1 from public.acessos_familia a where a.user_id = p.id and a.ate > now()
             )
             else false
           end
      from public.perfis_utilizador p
     where p.id = p_user_id
  ), false);
$$;
comment on function private.tem_acesso_completo(uuid) is
  'temAcessoCompleto: profissionais e equipa sempre; famílias com o Acesso Família em vigor; anon, instituições e o resto nunca.';

-- A conta com sessão é de demonstração? (palavra-passe pública: o acesso completo dela só cobre fichas de
-- demonstração — o mesmo isolamento dos pedidos e das visitas)
create function private.conta_demonstracao()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.demonstracao from public.perfis_utilizador p where p.id = (select auth.uid())), false);
$$;

-- Acesso completo da sessão a uma ficha deste "mundo" (contas de demonstração: só fichas de demonstração).
create function private.acesso_completo_a(p_demonstracao boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.tem_acesso_completo((select auth.uid()))
         and (coalesce(p_demonstracao, false) or not private.conta_demonstracao());
$$;

-- Soma os dias de um passe ao acesso de uma família (novoAte no protótipo): a partir do fim atual se ainda
-- estiver em vigor, senão a partir de agora — nunca se perdem dias pagos. Dias de 24 horas exatas (como o
-- protótipo, em milissegundos), sem depender da hora de verão. Bloqueia a linha: duas compras simultâneas
-- somam as duas. Avisa a família ("Acesso Família ativo", como comprarAcessoDemo) — quem chama não repete
-- o aviso. SÓ SERVIDOR: a faturação chama-a quando o pagamento fica confirmado (cartão, MB WAY, ou
-- Multibanco pago); o administrador pode usá-la como postgres (ex.: compensar uma falha técnica).
-- Não verifica o papel: um pagamento confirmado conta sempre, e o acesso só vale para contas 'familia'
-- (private.tem_acesso_completo).
create function private.estender_acesso(p_user_id uuid, p_plano public.plano_familia)
returns public.acessos_familia
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dias integer := private.dias_plano_familia(p_plano);
  v_a public.acessos_familia;
begin
  if p_user_id is null or v_dias is null then
    raise exception 'Indique a conta e o passe do Acesso Família.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.perfis_utilizador p where p.id = p_user_id) then
    raise exception 'Conta não encontrada.' using errcode = 'P0002';
  end if;

  insert into public.acessos_familia as a (user_id, plano, ate)
  values (p_user_id, p_plano, now() + v_dias * interval '24 hours')
  on conflict (user_id) do update
     set plano = excluded.plano,
         ate = greatest(a.ate, now()) + v_dias * interval '24 hours',
         atualizado_em = now()
  returning * into v_a;

  perform private.notificar(
    p_user_id, 'sistema', 'Acesso Família ativo',
    format('Tem acesso completo até %s. Não há renovação automática.',
           private.data_extenso((v_a.ate at time zone 'Europe/Lisbon')::date)),
    null, null, '/familia'
  );
  return v_a;
end;
$$;
comment on function private.estender_acesso(uuid, public.plano_familia) is
  'SÓ SERVIDOR (faturação): soma os dias do passe ao acesso da família (novoAte) e avisa-a. Devolve a linha de acessos_familia.';

-- useAcesso() da família com sessão: {completo, ativo, ate, plano, pagamentos}.
create function private.acesso_estado()
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
    -- GANCHO DA FATURAÇÃO: a lista de pagamentos_familia do próprio ({id, plano, valor_centimos, metodo,
    -- estado, criado_em, pago_em, multibanco?, documento?}) é preenchida quando essa tabela existir
    -- (create or replace desta função, na migração da faturação). Até lá vem sempre vazia.
    'pagamentos', '[]'::jsonb
  )
  from (select 1) as x
  left join public.acessos_familia a on a.user_id = (select auth.uid());
$$;

-- ————————————————————————————————————————————————————————————————— 3. dados públicos vs completos

-- A vista antiga lia todas as colunas da ficha: é substituída no fim desta secção.
drop view public.instituicoes_publicas;

-- Nomes dos extras (o que se paga à parte) sem os valores: a versão grátis mostra a lista, os preços são do
-- Acesso Família. Coluna gerada (sempre igual a extras), legível por todos.
alter table public.instituicoes
  add column extras_nomes jsonb generated always as (jsonb_path_query_array(extras, '$[*].nome')) stored;
comment on column public.instituicoes.extras_nomes is
  'Nomes dos extras, sem os valores (gerada a partir de extras). Pública; os preços dos extras são do Acesso Família.';

-- Colunas da camada completa: deixam de ser legíveis por anon/authenticated na tabela. O acesso completo
-- (e o dono, à sua ficha) lê-as por instituicoes_completas(). updated_at também (revelaria quando as vagas
-- mudaram). As políticas RLS não precisam destes privilégios; a escrita do dono não muda.
revoke select (
  morada, codigo_postal, telefone, email, website, lista_espera_offline, lista_espera_online,
  estadia_media_meses, extras, atualizado_em, updated_at
) on public.instituicoes from anon, authenticated;
grant select (extras_nomes) on public.instituicoes to anon, authenticated;

-- quartos (lugares livres e preços), saídas mensais (previsão) e avaliações (texto completo): sem leitura
-- para anon; para as contas, só com acesso completo (e o dono, a sua ficha). As contas de demonstração só
-- leem fichas de demonstração. O Realtime (quartos) aplica a mesma RLS: a versão grátis não recebe as vagas.
revoke select on public.quartos, public.saidas_mensais, public.avaliacoes from anon;

drop policy quartos_select_publicados on public.quartos;
create policy quartos_select_acesso_completo on public.quartos
  for select to authenticated
  using (
    (select private.tem_acesso_completo())
    and exists (
      select 1 from public.instituicoes i
       where i.id = quartos.instituicao_id and i.publicado
         and (i.demonstracao or not (select private.conta_demonstracao()))
    )
  );

drop policy saidas_mensais_select_publicadas on public.saidas_mensais;
create policy saidas_mensais_select_acesso_completo on public.saidas_mensais
  for select to authenticated
  using (
    (select private.tem_acesso_completo())
    and exists (
      select 1 from public.instituicoes i
       where i.id = saidas_mensais.instituicao_id and i.publicado
         and (i.demonstracao or not (select private.conta_demonstracao()))
    )
  );

drop policy avaliacoes_select_publicadas on public.avaliacoes;
create policy avaliacoes_select_acesso_completo on public.avaliacoes
  for select to authenticated
  using (
    (select private.tem_acesso_completo())
    and exists (
      select 1 from public.instituicoes i
       where i.id = avaliacoes.instituicao_id and i.publicado
         and (i.demonstracao or not (select private.conta_demonstracao()))
    )
  );
-- a instituição lê as avaliações da sua ficha; o autor lê (e apaga) a sua
create policy avaliacoes_select_dono_instituicao on public.avaliacoes
  for select to authenticated
  using (instituicao_id = (select private.minha_instituicao()));
create policy avaliacoes_select_autor on public.avaliacoes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- O que a vista pública calcula a partir de dados fechados: a faixa de preço (como faixaPreco: privados pela
-- mensalidade mais baixa, sem quartos conta como 0; IPSS/Misericórdia "conforme os rendimentos") e quantas
-- avaliações estão publicadas e verificadas (níveis de verificação e "x de y publicadas"). Só fichas
-- publicadas ou a do próprio dono (a vista já filtra pela RLS; isto é defesa em profundidade).
create function private.resumo_publico(p_instituicao_id text)
returns table (faixa_preco public.faixa_preco, avaliacoes_publicadas integer, avaliacoes_verificadas integer)
language sql
stable
security definer
set search_path = ''
as $$
  select
    case
      when i.natureza <> 'privado' then 'conforme_rendimentos'
      when q.minimo < 1000 then 'ate_1000'
      when q.minimo < 2000 then '1000_2000'
      else 'mais_2000'
    end::public.faixa_preco,
    a.publicadas,
    a.verificadas
  from public.instituicoes i
  cross join lateral (
    select coalesce(min(qq.preco_min), 0) as minimo from public.quartos qq where qq.instituicao_id = i.id
  ) q
  cross join lateral (
    select count(*)::integer as publicadas, (count(*) filter (where aa.verificada))::integer as verificadas
      from public.avaliacoes aa where aa.instituicao_id = i.id
  ) a
  where i.id = p_instituicao_id
    and (i.publicado or i.owner_id = (select auth.uid()));
$$;

-- Vista pública (versão grátis): só o que a interface mostra sem o Acesso Família. security_invoker: anon e
-- authenticated leem só as fichas publicadas (o dono também a sua) e só colunas públicas da tabela.
create view public.instituicoes_publicas
with (security_invoker = true)
as
select
  i.id, i.nome, i.tipo, i.natureza, i.resumo, i.descricao,
  i.localidade, i.concelho, i.distrito, i.regiao, i.lat, i.lng,
  i.capacidade, i.acordo_ss, i.incluido, i.extras_nomes, i.graus, i.cuidados, i.comodidades,
  i.equipa_cuidadores_por_10, i.equipa_enfermeiros, i.equipa_medico_horas_semana,
  i.licenca, i.verificacao_estado, i.verificacao_data, i.ultima_inspecao, i.licenca_confirmada_em,
  i.avaliacao_media, i.num_avaliacoes,
  coalesce(r.avaliacoes_publicadas, 0) as avaliacoes_publicadas,
  coalesce(r.avaliacoes_verificadas, 0) as avaliacoes_verificadas,
  i.fundacao, i.capa, i.publicado, i.demonstracao,
  r.faixa_preco
from public.instituicoes i
left join lateral private.resumo_publico(i.id) r on true;

comment on view public.instituicoes_publicas is
  'Versão grátis (sem Acesso Família): quem existe, onde, tipo, natureza, descrição, cuidados, equipa, verificação, avaliação geral, nomes dos extras e faixa de preço. Vagas, preços por quarto, lista de espera, previsão, frescura e contactos: instituicoes_completas().';

revoke all on public.instituicoes_publicas from anon, authenticated;
grant select on public.instituicoes_publicas to anon, authenticated, service_role;

-- Camada completa (Acesso Família, profissionais, equipa): a ficha inteira, com a forma da vista pública
-- antiga (larDeLinha) — quartos com lugares livres e preços, vagas_livres, mensalidade mínima/máxima, lista de
-- espera (offline + plataforma), estadia média e histórico de saídas dos últimos 12 meses (previsão), frescura
-- das vagas, morada, código postal, contactos e preços dos extras.
--   * acesso completo → as fichas publicadas (contas de demonstração: só as de demonstração);
--   * o dono de uma ficha (instituição, sem acesso completo) → só a sua, publicada ou não;
--   * outras contas → erro 42501 (hint 'acesso_familia'); anon nem tem permissão de execução.
-- p_ids (opcional) limita às fichas indicadas (null = todas as que pode ver).
create function private.instituicoes_completas(p_ids text[] default null)
returns table (
  id text,
  nome text,
  tipo public.tipo_resposta,
  natureza public.natureza,
  resumo text,
  descricao text,
  morada text,
  codigo_postal text,
  localidade text,
  concelho text,
  distrito text,
  regiao text,
  lat numeric,
  lng numeric,
  telefone text,
  email text,
  website text,
  capacidade integer,
  lista_espera integer,
  estadia_media_meses integer,
  acordo_ss boolean,
  incluido text[],
  extras jsonb,
  graus public.grau_dependencia[],
  cuidados text[],
  comodidades text[],
  equipa_cuidadores_por_10 numeric,
  equipa_enfermeiros integer,
  equipa_medico_horas_semana numeric,
  licenca text,
  verificacao_estado public.estado_verificacao,
  verificacao_data timestamptz,
  ultima_inspecao timestamptz,
  avaliacao_media numeric,
  num_avaliacoes integer,
  fundacao integer,
  atualizado_em timestamptz,
  capa jsonb,
  publicado boolean,
  demonstracao boolean,
  vagas_livres integer,
  mensalidade_min numeric,
  mensalidade_max numeric,
  quartos jsonb,
  historico_saidas integer[],
  licenca_confirmada_em timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_completo boolean := private.tem_acesso_completo((select auth.uid()));
  v_demo boolean := private.conta_demonstracao();
  v_minha text := private.minha_instituicao();
begin
  if not v_completo and v_minha is null then
    raise exception 'As vagas, os preços por quarto, a previsão de espera e os contactos fazem parte do Acesso Família.'
      using errcode = '42501', hint = 'acesso_familia';
  end if;

  return query
  select
    i.id, i.nome, i.tipo, i.natureza, i.resumo, i.descricao,
    i.morada, i.codigo_postal, i.localidade, i.concelho, i.distrito::text, i.regiao::text, i.lat, i.lng,
    i.telefone, i.email, i.website,
    i.capacidade,
    i.lista_espera_offline + i.lista_espera_online,
    i.estadia_media_meses, i.acordo_ss, i.incluido, i.extras, i.graus, i.cuidados::text[], i.comodidades::text[],
    i.equipa_cuidadores_por_10, i.equipa_enfermeiros, i.equipa_medico_horas_semana,
    i.licenca, i.verificacao_estado, i.verificacao_data, i.ultima_inspecao,
    i.avaliacao_media, i.num_avaliacoes, i.fundacao, i.atualizado_em, i.capa,
    i.publicado, i.demonstracao,
    coalesce(q.vagas_livres, 0),
    q.mensalidade_min,
    q.mensalidade_max,
    coalesce(q.quartos, '[]'::jsonb),
    coalesce(h.historico, '{}'::integer[]),
    i.licenca_confirmada_em
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
    -- últimos 12 meses no calendário português (o último é o mês corrente em Lisboa), como a vista antiga
    select array_agg(coalesce(s.saidas, 0) order by m.mes) as historico
    from generate_series(
           date_trunc('month', now() at time zone 'Europe/Lisbon') - interval '11 months',
           date_trunc('month', now() at time zone 'Europe/Lisbon'),
           interval '1 month'
         ) as m (mes)
    left join public.saidas_mensais s on s.instituicao_id = i.id and s.mes = m.mes::date
    where exists (select 1 from public.saidas_mensais x where x.instituicao_id = i.id)
  ) h on true
  where (p_ids is null or i.id = any (p_ids))
    and ((v_completo and i.publicado and (i.demonstracao or not v_demo)) or i.id = v_minha)
  order by i.id;
end;
$$;

-- Excerto de uma opinião longa (excerto() em src/features/lar-detail/sections/AvaliacoesSection.tsx): até
-- p_max carateres, cortado numa palavra se o último espaço estiver depois de 60 % do limite, sem pontuação
-- solta no fim e com "…". O texto inteiro é do Acesso Família.
create function private.excerto_avaliacao(p_texto text, p_max integer default 240)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
           when char_length(p_texto) <= p_max then p_texto
           else regexp_replace(
                  case when x.espaco > p_max * 0.6 then left(x.corte, x.espaco) else x.corte end,
                  '[[:space:],;:.–—-]+$', ''
                ) || '…'
         end
    from (
      select left(p_texto, p_max) as corte,
             -- índice (base 0) do último espaço, como String#lastIndexOf(' '); −1 se não houver
             case when strpos(reverse(left(p_texto, p_max)), ' ') > 0
                  then char_length(left(p_texto, p_max)) - strpos(reverse(left(p_texto, p_max)), ' ')
                  else -1 end as espaco
    ) x;
$$;

-- Avaliações de uma ficha publicada (ou da do próprio dono):
--   * acesso completo (ou o dono da ficha) → todas, da mais recente para a mais antiga (em empate, pela ordem em
--     que foram publicadas, como a ordenação estável do protótipo) (excerto = false);
--   * versão grátis (anon, famílias sem passe, outras instituições) → no máximo UMA, de preferência verificada
--     e a mais recente (como a ficha grátis: reviews.find(verificada) ?? reviews[0]), só com o excerto do texto
--     e sem as notas por aspeto (excerto = true). A média e o número de avaliações estão na vista pública.
create function private.avaliacoes_instituicao(p_instituicao_id text)
returns table (
  id bigint,
  instituicao_id text,
  autor text,
  relacao text,
  nota smallint,
  aspeto_cuidados smallint,
  aspeto_alimentacao smallint,
  aspeto_instalacoes smallint,
  aspeto_comunicacao smallint,
  texto text,
  verificada boolean,
  created_at timestamptz,
  excerto boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := (select auth.uid());
  v_inst public.instituicoes;
begin
  select * into v_inst from public.instituicoes i
   where i.id = p_instituicao_id and (i.publicado or i.owner_id = v_uid);
  if not found then
    return;
  end if;

  if v_inst.owner_id = v_uid or private.acesso_completo_a(v_inst.demonstracao) then
    return query
      select a.id, a.instituicao_id, a.autor, a.relacao, a.nota, a.aspeto_cuidados, a.aspeto_alimentacao,
             a.aspeto_instalacoes, a.aspeto_comunicacao, a.texto, a.verificada, a.created_at, false
        from public.avaliacoes a
       where a.instituicao_id = v_inst.id
       order by a.created_at desc, a.id;
  else
    return query
      select a.id, a.instituicao_id, a.autor, a.relacao, a.nota, null::smallint, null::smallint, null::smallint,
             null::smallint, private.excerto_avaliacao(a.texto), a.verificada, a.created_at, true
        from public.avaliacoes a
       where a.instituicao_id = v_inst.id
       order by a.verificada desc, a.created_at desc, a.id
       limit 1;
  end if;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 4. agregados ("quantas", nunca "quais")

-- SAZONALIDADE de src/lib/forecast.ts (fator por mês, média 1), os mesmos números de vírgula flutuante
-- (17 algarismos significativos: ida e volta exata).
create function private.sazonalidade(p_mes integer)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select (array[
    1.2000000000000000, 1.1016393442622952, 1.0229508196721313, 0.95409836065573772,
    0.91475409836065580, 0.88524590163934436, 0.90491803278688532, 0.92459016393442628,
    0.91475409836065580, 0.96393442622950820, 1.0327868852459017, 1.1803278688524590
  ]::double precision[])[p_mes];
$$;

-- Σ fator sazonal do dia ÷ dias do mês, nos p_dias dias a partir de p_inicio (inclusive): a intensidade
-- acumulada de intensidadeAcumulada() para uma taxa mensal de 1. Λ(dia) = taxa × isto.
create function private.intensidade_sazonal(p_inicio date, p_dias integer)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select coalesce(sum(
           private.sazonalidade(extract(month from d.dia)::integer)
           / extract(day from (date_trunc('month', d.dia::timestamp) + interval '1 month' - interval '1 day'))::double precision
         ), 0)
    from generate_series(0, greatest(p_dias, 0) - 1) as g (k)
    cross join lateral (select p_inicio + g.k as dia) d;
$$;

-- poissonAtLeast(k, λ) de src/lib/forecast.ts: P(N ≥ k), N ~ Poisson(λ), com a mesma soma termo a termo.
-- O Postgres recusa resultados que se anulam por subcarga (o JavaScript dá 0): para λ > 700, exp(−λ) já é 0
-- e o resultado é 1, como no protótipo; os termos abaixo de 1e-290 depois do pico não mudam a soma.
create function private.poisson_pelo_menos(p_k integer, p_lambda double precision)
returns double precision
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_termo double precision;
  v_acumulada double precision;
begin
  if p_k <= 0 then
    return 1;
  end if;
  if p_lambda is null or p_lambda <= 0 then
    return 0;
  end if;
  if p_lambda > 700 then
    return 1;
  end if;
  v_termo := exp(-p_lambda);
  v_acumulada := v_termo;
  for v_i in 1 .. p_k - 1 loop
    exit when v_i > p_lambda and v_termo < 1e-290;
    v_termo := v_termo * (p_lambda / v_i);
    v_acumulada := v_acumulada + v_termo;
  end loop;
  return least(1, greatest(0, 1 - v_acumulada));
end;
$$;

-- Estado de uma ficha para as contagens da versão grátis (resumoDisponibilidade no protótipo):
--   'com_vaga'        → vagaParaNovos: lista efetiva (40 % da lista, arredondada) abaixo dos lugares livres;
--   'livre_com_lista' → tem lugares livres, mas já prometidos à lista (disponibilidade = 'disponivel': não conta
--                       como "com vaga" nem como "em breve");
--   'breve'           → sem lugares livres e P(vaga em 90 dias) ≥ 50 % (disponibilidade = 'breve');
--   'espera'          → o resto.
-- A taxa de saídas é a de taxaSaidasMensal (metade histórico dos últimos 12 meses, metade residentes ÷ estadia
-- média, com mínimo de 6 meses). p_media_saidas: média mensal dos 12 meses, ou null sem histórico.
-- p_fator_90: private.intensidade_sazonal(hoje, 90). APROXIMAÇÃO documentada: o protótipo soma dia a dia
-- taxa × fator ÷ dias do mês; aqui Λ(90) = taxa × Σ(fator ÷ dias do mês) — a mesma conta com outra ordem de
-- arredondamento (diferença relativa ≈ 1e-14, sem efeito no limiar de 50 %; testado contra o protótipo).
create function private.estado_disponibilidade(
  p_livres integer,
  p_lista integer,
  p_capacidade integer,
  p_estadia_meses integer,
  p_media_saidas double precision,
  p_fator_90 double precision
)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_livres integer := coalesce(p_livres, 0);
  -- FATOR_LISTA_EFETIVA = 0,4; Math.round (nunca há meios: a lista é inteira e 0,4 × n tem décimas pares)
  v_efetiva integer := round(greatest(coalesce(p_lista, 0), 0) * 0.4)::integer;
  v_estrutural double precision;
  v_taxa double precision;
begin
  if v_efetiva < v_livres then
    return 'com_vaga';
  end if;
  if v_livres > 0 then
    return 'livre_com_lista';
  end if;
  v_estrutural := greatest(0, coalesce(p_capacidade, 0) - v_livres)::double precision
                  / greatest(6, coalesce(p_estadia_meses, 36))::double precision;
  v_taxa := case when p_media_saidas is null then v_estrutural else 0.5 * p_media_saidas + 0.5 * v_estrutural end;
  return case when private.poisson_pelo_menos(v_efetiva + 1, v_taxa * p_fator_90) >= 0.5 then 'breve' else 'espera' end;
end;
$$;

-- "43 com vaga agora nesta zona": quantas fichas publicadas de um distrito (ou concelho do distrito, ou do país
-- inteiro com os dois a null) há, quantas têm vaga para quem pede hoje e quantas devem ter vaga em breve.
-- Abaixo de 5 fichas (MIN_AGREGADO) com_vaga e breve vêm a null: com 1 a 4 casas, "quantas" seria "quais".
-- Para qualquer pessoa (anon incluído): só contagens, nenhuma ficha. A data de hoje é a de Lisboa.
create function private.disponibilidade_agregada(p_distrito text, p_concelho text default null)
returns table (total integer, com_vaga integer, breve integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_distrito public.distrito;
  v_concelho text := nullif(btrim(p_concelho), '');
  v_hoje date := (now() at time zone 'Europe/Lisbon')::date;
  v_mes date := date_trunc('month', (now() at time zone 'Europe/Lisbon'))::date;
  v_desde date;
  v_fator double precision;
begin
  begin
    v_distrito := nullif(btrim(p_distrito), '')::public.distrito;
  exception when check_violation then
    raise exception 'Distrito inválido.' using errcode = '22023';
  end;
  if char_length(v_concelho) > 120 then
    raise exception 'Concelho inválido.' using errcode = '22023';
  end if;
  -- há concelhos com o mesmo nome em distritos diferentes (ex.: Calheta, na Madeira e nos Açores)
  if v_concelho is not null and v_distrito is null then
    raise exception 'Indique o distrito do concelho.' using errcode = '22023';
  end if;
  v_desde := (v_mes - interval '11 months')::date;
  v_fator := private.intensidade_sazonal(v_hoje, 90);

  return query
  with z as (
    select
      coalesce((select sum(q.livres) from public.quartos q where q.instituicao_id = i.id), 0)::integer as livres,
      i.lista_espera_offline + i.lista_espera_online as lista,
      i.capacidade,
      i.estadia_media_meses,
      -- historicoSaidas: 12 meses (o último é o corrente) só se a ficha tiver algum registo de saídas
      case when exists (select 1 from public.saidas_mensais x where x.instituicao_id = i.id) then
        coalesce((select sum(s.saidas) from public.saidas_mensais s
                   where s.instituicao_id = i.id and s.mes between v_desde and v_mes), 0)::double precision / 12
      end as media
    from public.instituicoes i
    where i.publicado
      and (v_distrito is null or i.distrito = v_distrito)
      and (v_concelho is null or i.concelho = v_concelho)
  ),
  e as (
    select private.estado_disponibilidade(z.livres, z.lista, z.capacidade, z.estadia_media_meses, z.media, v_fator) as estado
      from z
  )
  select
    count(*)::integer,
    case when count(*) >= 5 then (count(*) filter (where e.estado = 'com_vaga'))::integer end,
    case when count(*) >= 5 then (count(*) filter (where e.estado = 'breve'))::integer end
  from e;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 5. ações pagas

-- Pedido de uma família: como em 20261012190800 e, antes de tudo o resto (depois do papel e da sessão), o
-- Acesso Família — "pedidos a várias casas" é da camada paga. Os profissionais enviam pelos casos (enviar_caso).
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
  if not private.tem_acesso_completo(v_uid) then
    raise exception 'Os pedidos de vaga e as visitas fazem parte do Acesso Família.'
      using errcode = '42501', hint = 'acesso_familia';
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

-- Pedir/alterar a visita: como em 20261012190800 e só com o acesso completo (na ficha grátis, "Marcar visita"
-- abre a folha do Acesso Família, também num pedido já existente). Cancelar o pedido, responder a uma vaga
-- proposta e confirmar a entrada continuam livres: são do pedido que a família já fez.
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
  if not private.tem_acesso_completo(v_uid) then
    raise exception 'Os pedidos de vaga e as visitas fazem parte do Acesso Família.'
      using errcode = '42501', hint = 'acesso_familia';
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

-- Alerta de vaga (favoritos.alerta) é do Acesso Família (setAlerta/toggleFavorito no protótipo):
--   * guardar uma ficha continua livre: sem acesso, o alerta fica desligado (como toggleFavorito, que grava
--     alerta = temAcessoCompleto) — o valor por omissão (true) só vale para quem tem acesso;
--   * ligar o alerta de um favorito já guardado sem acesso → erro 42501 (hint 'acesso_familia');
--   * desligar está sempre à mão.
-- Só para clientes (anon/authenticated); as cargas de demonstração (postgres) não passam por aqui. Um alerta
-- ligado com o passe fica ligado quando o passe termina, mas os avisos só voltam com um passe novo
-- (private.avisar_nova_vaga).
create function private.favoritos_alerta_acesso()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('anon', 'authenticated') and new.alerta then
    if tg_op = 'INSERT' then
      new.alerta := private.tem_acesso_completo(new.user_id);
    elsif not old.alerta and not private.tem_acesso_completo(new.user_id) then
      raise exception 'Os alertas de vaga fazem parte do Acesso Família.' using errcode = '42501', hint = 'acesso_familia';
    end if;
  end if;
  return new;
end;
$$;

create trigger favoritos_alerta_acesso
  before insert or update of alerta on public.favoritos
  for each row execute function private.favoritos_alerta_acesso();

-- Avisos de vaga: como em 20261012190800; quem segue a ficha (favorito com alerta) só é avisado com o acesso
-- completo — senão o aviso diria quais têm vaga — e, numa conta de demonstração, só de fichas de demonstração (o
-- acesso dela não cobre as reais). Quem está na lista de espera é sempre avisado: já tem uma relação com a
-- instituição (avisarNovaVaga no protótipo).
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
    join public.perfis_utilizador p on p.id = f.user_id
   where f.instituicao_id = v_inst.id
     and f.alerta
     and f.user_id is distinct from v_inst.owner_id
     and private.tem_acesso_completo(f.user_id)
     and (v_inst.demonstracao or not p.demonstracao)
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

-- ————————————————————————————————————————————————————————————————— 6. RPC públicas (Data API)
-- Invólucros SECURITY INVOKER (a autorização está nas funções private).

create function public.acesso_estado()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.acesso_estado();
$$;
comment on function public.acesso_estado() is
  'Conta com sessão: {completo, ativo, ate, plano, pagamentos} do Acesso Família (pagamentos vem vazio até existir a faturação).';

create function public.instituicoes_completas(p_ids text[] default null)
returns table (
  id text, nome text, tipo public.tipo_resposta, natureza public.natureza, resumo text, descricao text,
  morada text, codigo_postal text, localidade text, concelho text, distrito text, regiao text, lat numeric,
  lng numeric, telefone text, email text, website text, capacidade integer, lista_espera integer,
  estadia_media_meses integer, acordo_ss boolean, incluido text[], extras jsonb, graus public.grau_dependencia[],
  cuidados text[], comodidades text[], equipa_cuidadores_por_10 numeric, equipa_enfermeiros integer,
  equipa_medico_horas_semana numeric, licenca text, verificacao_estado public.estado_verificacao,
  verificacao_data timestamptz, ultima_inspecao timestamptz, avaliacao_media numeric, num_avaliacoes integer,
  fundacao integer, atualizado_em timestamptz, capa jsonb, publicado boolean, demonstracao boolean,
  vagas_livres integer, mensalidade_min numeric, mensalidade_max numeric, quartos jsonb, historico_saidas integer[],
  licenca_confirmada_em timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.instituicoes_completas(p_ids);
$$;
comment on function public.instituicoes_completas(text[]) is
  'Acesso Família, profissionais e equipa: fichas completas (vagas, preços por quarto, previsão, contactos). O dono: só a sua. Outros: erro 42501 (hint acesso_familia).';

create function public.disponibilidade_agregada(p_distrito text, p_concelho text default null)
returns table (total integer, com_vaga integer, breve integer)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.disponibilidade_agregada(p_distrito, p_concelho);
$$;
comment on function public.disponibilidade_agregada(text, text) is
  'Qualquer pessoa: quantas fichas publicadas há na zona, quantas têm vaga agora e quantas em breve (null abaixo de 5 fichas).';

create function public.avaliacoes_instituicao(p_instituicao_id text)
returns table (
  id bigint, instituicao_id text, autor text, relacao text, nota smallint, aspeto_cuidados smallint,
  aspeto_alimentacao smallint, aspeto_instalacoes smallint, aspeto_comunicacao smallint, texto text,
  verificada boolean, created_at timestamptz, excerto boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.avaliacoes_instituicao(p_instituicao_id);
$$;
comment on function public.avaliacoes_instituicao(text) is
  'Avaliações de uma ficha: todas com acesso completo (ou para o dono); na versão grátis, no máximo um excerto.';

-- ————————————————————————————————————————————————————————————————— 7. privilégios de execução

revoke all on function
  private.dias_plano_familia(public.plano_familia),
  private.tem_acesso_completo(uuid),
  private.conta_demonstracao(),
  private.acesso_completo_a(boolean),
  private.estender_acesso(uuid, public.plano_familia),
  private.acesso_estado(),
  private.resumo_publico(text),
  private.instituicoes_completas(text[]),
  private.excerto_avaliacao(text, integer),
  private.avaliacoes_instituicao(text),
  private.sazonalidade(integer),
  private.intensidade_sazonal(date, integer),
  private.poisson_pelo_menos(integer, double precision),
  private.estado_disponibilidade(integer, integer, integer, integer, double precision, double precision),
  private.disponibilidade_agregada(text, text),
  private.favoritos_alerta_acesso(),
  public.acesso_estado(),
  public.instituicoes_completas(text[]),
  public.disponibilidade_agregada(text, text),
  public.avaliacoes_instituicao(text)
from public, anon, authenticated, service_role;

-- auxiliares das políticas RLS (quartos, saídas, avaliações) e do trigger dos favoritos
grant execute on function private.tem_acesso_completo(uuid), private.conta_demonstracao()
  to authenticated, service_role;

-- RPC de utilizadores com sessão (e as funções private que elas chamam; private não está na Data API)
grant execute on function
  public.acesso_estado(),
  public.instituicoes_completas(text[]),
  private.acesso_estado(),
  private.instituicoes_completas(text[])
to authenticated, service_role;

-- versão grátis, também sem sessão: a vista pública (resumo_publico), os agregados e o excerto das avaliações
grant execute on function
  private.resumo_publico(text),
  public.disponibilidade_agregada(text, text),
  public.avaliacoes_instituicao(text),
  private.disponibilidade_agregada(text, text),
  private.avaliacoes_instituicao(text)
to anon, authenticated, service_role;

-- só servidor: a faturação (outra migração) soma os dias do passe com estender_acesso
grant execute on function private.estender_acesso(uuid, public.plano_familia) to service_role;
