-- =====================================================================================
-- EncontraLar — equipa de terreno e modalidade das instituições privadas (decisões de 13/10/2026,
-- docs/MODELO-NEGOCIO.md), parte 2. Espelha src/lib/store.ts (escolherPlanoInstituicao, registarVisita,
-- useVisitas e registarConfirmacaoEntrada), src/lib/acesso.ts (compromissoAte, podeMudarPlano) e
-- src/lib/negocio.ts (taxaPara):
--
--   1. Modalidade dos lares privados (instituicoes.plano / plano_desde): por entrada (por omissão) ou
--      mensalidade, com compromisso de 12 meses. Dado comercial INTERNO: não está na vista pública nem é
--      legível por anon/authenticated; o dono lê-o em painel_instituicao(), a equipa em painel_equipa().
--      IPSS e Misericórdias nunca têm modalidade. Os valores (€) não vivem na base de dados.
--   2. escolher_plano_instituicao(): o dono de um lar privado muda de modalidade; para a mensalidade
--      sempre, de volta à taxa por entrada só no fim do compromisso.
--   3. Taxa da entrada: 'incluida' para um lar privado com mensalidade; a primeira confirmação da
--      entrada fixa a taxa com a modalidade em vigor nesse momento.
--   4. Papel 'equipa' (equipa de terreno, interno): só por app_metadata (administrador), nunca no
--      registo nem numa conta anónima; retirar o papel no app_metadata retira-o à conta.
--   5. Visitas (public.visitas): só a equipa as lê (do mesmo "mundo", demonstração ou real); escrita só
--      por registar_visita(), que aplica o selo «Visitada pela equipa», a licença, as vagas e os preços
--      confirmados, os cuidados e, na adesão de um privado, a modalidade; avisa o gestor do selo.
--      A conta do responsável NÃO é criada aqui (Auth Admin API numa Edge Function — docs/SUPABASE.md).
-- =====================================================================================

-- ————————————————————————————————————————————————————————————————— 1. tipos

-- só lares privados; ausente (null) = por entrada
create type public.plano_instituicao as enum ('por_entrada', 'mensal');
comment on type public.plano_instituicao is
  'Modalidade de um lar privado: por_entrada (por omissão) ou mensal (compromisso de 12 meses). IPSS e Misericórdias não têm modalidade.';

create type public.resultado_visita as enum ('aderiu', 'interessado', 'voltar', 'recusou');

comment on type public.taxa_entrada is
  'Taxa de uma entrada, fixada na primeira confirmação: aplicavel (privado por entrada), incluida (privado com mensalidade) ou isenta (IPSS/Misericórdia).';

-- ————————————————————————————————————————————————————————————————— utilitários (sem acesso a tabelas)

-- 2027-10-13 10:00 UTC → '13 de outubro de 2027' (dataLonga no protótipo), no calendário de Lisboa.
create function private.data_longa(p_quando timestamptz)
returns text
language sql
stable
set search_path = ''
as $$
  select extract(day from x.d)::int || ' de '
         || (array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
                   'outubro', 'novembro', 'dezembro'])[extract(month from x.d)::int]
         || ' de ' || extract(year from x.d)::int
    from (select (p_quando at time zone 'Europe/Lisbon')::date as d) x;
$$;

-- compromissoAte(lar) no protótipo: fim do compromisso de 12 meses da mensalidade, ou null (por entrada,
-- IPSS/Misericórdia, sem data). Mesma aritmética do Date#setMonth: hora de Lisboa e, num dia que não existe
-- no ano seguinte (29 de fevereiro), passa para o dia 1 do mês seguinte.
create function private.compromisso_ate(
  p_natureza public.natureza,
  p_plano public.plano_instituicao,
  p_desde timestamptz
)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select case when p_natureza = 'privado' and p_plano = 'mensal' and p_desde is not null then
           (date_trunc('month', x.l) + interval '12 months' + (x.l - date_trunc('month', x.l))) at time zone 'Europe/Lisbon'
         end
    from (select p_desde at time zone 'Europe/Lisbon' as l) x;
$$;

-- ————————————————————————————————————————————————————————————————— 2. modalidade (dado interno da ficha)

-- Sem privilégio de leitura nem de escrita para anon/authenticated: as colunas de instituicoes são
-- concedidas uma a uma (20261012190100/0400) e estas não estão na lista. A vista instituicoes_publicas
-- também não as tem. Escrita só por escolher_plano_instituicao() e registar_visita().
alter table public.instituicoes
  add column plano public.plano_instituicao,
  add column plano_desde timestamptz,
  add constraint instituicoes_plano_so_privados check (natureza = 'privado' or (plano is null and plano_desde is null)),
  add constraint instituicoes_plano_com_data check ((plano is null) = (plano_desde is null));
comment on column public.instituicoes.plano is
  'Só lares privados: modalidade (por_entrada | mensal); null = por entrada. Interno: o dono lê-a em painel_instituicao(), a equipa em painel_equipa(). Muda por escolher_plano_instituicao() ou registar_visita().';
comment on column public.instituicoes.plano_desde is
  'Desde quando vigora a modalidade (a mensalidade tem compromisso de 12 meses — private.compromisso_ate). Interno.';

-- Uma ficha que deixa de ser privada (o dono corrige a natureza; a verificação volta a "pendente") deixa
-- de ter modalidade: IPSS e Misericórdias não pagam.
create function private.instituicoes_limpar_plano()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.natureza is distinct from 'privado' then
    new.plano := null;
    new.plano_desde := null;
  end if;
  return new;
end;
$$;

create trigger instituicoes_plano_natureza
  before update of natureza on public.instituicoes
  for each row execute function private.instituicoes_limpar_plano();

-- ————————————————————————————————————————————————————————————————— 3. taxa da entrada ('incluida')

comment on column public.candidaturas.entrada_taxa is
  'aplicavel (lar privado por entrada), incluida (lar privado com mensalidade: sem taxa) ou isenta (IPSS/Misericórdia), fixada na primeira confirmação da entrada com a modalidade em vigor nesse momento.';

-- taxaPara(lar) no protótipo: natureza e modalidade da ficha.
create function private.taxa_para(p_inst public.instituicoes)
returns public.taxa_entrada
language sql
immutable
set search_path = ''
as $$
  select case
    when p_inst.natureza is distinct from 'privado' then 'isenta'
    when p_inst.plano = 'mensal' then 'incluida'
    else 'aplicavel'
  end::public.taxa_entrada;
$$;

-- O lar marca "Entrou": como em 20261012190800; a taxa vem da ficha (natureza E modalidade), lida já
-- com a linha bloqueada (exigir_dono) — uma mudança de modalidade simultânea espera por esta.
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

-- Quem fez o pedido confirma a entrada: como em 20261012190800; a taxa vem da ficha (natureza E
-- modalidade), lida depois de bloquear a instituição (bloquear_candidatura).
create or replace function private.confirmar_entrada_familia(p_candidatura_id uuid, p_data date)
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
         entrada_taxa = coalesce(entrada_taxa, private.taxa_para(v_inst)),
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

-- a versão só com a natureza deixa de servir (não sabe a modalidade)
drop function private.taxa_para(public.natureza);

-- ————————————————————————————————————————————————————————————————— 4. painel do dono (com a modalidade)

-- O tipo devolvido muda (colunas novas): o invólucro e a função interna são recriados.
drop function public.painel_instituicao();
drop function private.painel_instituicao();

-- Dados internos da ficha do utilizador autenticado (vazio se não gerir nenhuma), agora com a
-- modalidade (null = por entrada; sempre null em IPSS/Misericórdias) e o fim do compromisso.
create function private.painel_instituicao()
returns table (
  id text,
  publicado boolean,
  verificacao_estado public.estado_verificacao,
  visualizacoes_30d integer,
  lista_espera_offline integer,
  lista_espera_online integer,
  plano public.plano_instituicao,
  plano_desde timestamptz,
  compromisso_ate timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.publicado, i.verificacao_estado, i.visualizacoes_30d, i.lista_espera_offline, i.lista_espera_online,
         i.plano, i.plano_desde, private.compromisso_ate(i.natureza, i.plano, i.plano_desde)
    from public.instituicoes i
   where i.owner_id = (select auth.uid());
$$;

-- ————————————————————————————————————————————————————————————————— 5. escolher a modalidade (dono)

-- escolherPlanoInstituicao: só o dono (conta 'lar') de um lar PRIVADO. A mesma modalidade não muda nada
-- (nem a data). Para a mensalidade, sempre; de volta à taxa por entrada, só no fim do compromisso de 12
-- meses (senão mudava-se só no mês de uma entrada) — o erro diz a partir de quando. Cada mudança regista
-- plano_desde = agora. As entradas já confirmadas mantêm a taxa com que foram fixadas.
create function private.escolher_plano_instituicao(p_plano public.plano_instituicao)
returns table (
  instituicao_id text,
  plano public.plano_instituicao,
  plano_desde timestamptz,
  compromisso_ate timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text;
  v_inst public.instituicoes;
  v_ate timestamptz;
begin
  perform private.exigir_sessao();
  v_id := private.minha_instituicao();
  if v_id is null or not private.tem_papel('lar') or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Só a instituição pode escolher a modalidade.' using errcode = '42501';
  end if;
  if p_plano is null then
    raise exception 'Indique a modalidade: por entrada ou mensalidade.' using errcode = '22023';
  end if;
  v_inst := private.exigir_dono(v_id);   -- verifica e bloqueia a ficha
  if v_inst.natureza <> 'privado' then
    raise exception 'As IPSS e Misericórdias não têm custos.' using errcode = '22023';
  end if;

  if coalesce(v_inst.plano, 'por_entrada') <> p_plano then
    v_ate := private.compromisso_ate(v_inst.natureza, v_inst.plano, v_inst.plano_desde);
    if v_ate > now() then
      raise exception 'A mensalidade tem um compromisso de 12 meses: pode mudar a partir de %.', private.data_longa(v_ate)
        using errcode = '22023';
    end if;
    update public.instituicoes i
       set plano = p_plano, plano_desde = now()
     where i.id = v_inst.id
    returning * into v_inst;
  end if;

  return query
    select v_inst.id, v_inst.plano, v_inst.plano_desde,
           private.compromisso_ate(v_inst.natureza, v_inst.plano, v_inst.plano_desde);
end;
$$;

-- ————————————————————————————————————————————————————————————————— 6. papel 'equipa'

-- Registo: como em 20261012190800 e também com o papel interno 'equipa', que SÓ vem de app_metadata
-- (administrador) e nunca numa conta anónima. 'equipa' em user_metadata (formulário de registo,
-- editável pelo próprio) é ignorado: a conta fica 'familia'.
create or replace function private.criar_perfil_utilizador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_app text := new.raw_app_meta_data ->> 'role';
  v_role_registo text := new.raw_user_meta_data ->> 'role';
  v_anonima boolean := coalesce(new.is_anonymous, false);
  v_role public.role_utilizador;
  v_nome text;
  v_org jsonb;
begin
  v_role := case
    when v_role_app = 'equipa' and not v_anonima then 'equipa'::public.role_utilizador
    when v_role_app in ('familia', 'lar', 'profissional') then v_role_app::public.role_utilizador
    when v_anonima then 'familia'::public.role_utilizador
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
      when 'equipa' then 'Registe cada visita no modo visita: licença, instalações, vagas, preços e o resultado da conversa.'
      else 'Crie o perfil da pessoa de quem cuida para receber sugestões compatíveis e alertas de vaga.'
    end,
    case v_role when 'lar' then '/gestao' when 'profissional' then '/casos' when 'equipa' then '/visitas' else '/familia' end
  );
  return new;
end;
$$;

-- O administrador muda o papel em app_metadata → sincroniza (como em 20261012190800), agora também com
-- 'equipa'. Retirar 'equipa' do app_metadata (ex.: saída da equipa), mesmo sem pôr outro papel válido,
-- retira o papel à conta (passa a 'familia'): o acesso interno não fica esquecido em perfis_utilizador.
create or replace function private.sincronizar_role_app_metadata()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_novo text := new.raw_app_meta_data ->> 'role';
  v_antigo text := old.raw_app_meta_data ->> 'role';
  v_org jsonb := private.normalizar_organizacao(new.raw_app_meta_data -> 'organizacao');
begin
  if v_novo is distinct from v_antigo then
    if v_novo in ('familia', 'lar', 'profissional')
       or (v_novo = 'equipa' and not coalesce(new.is_anonymous, false)) then
      update public.perfis_utilizador set role = v_novo::public.role_utilizador where id = new.id;
    elsif v_antigo = 'equipa' then
      update public.perfis_utilizador set role = 'familia' where id = new.id and role = 'equipa';
    end if;
  end if;
  if v_org is not null
     and (new.raw_app_meta_data -> 'organizacao') is distinct from (old.raw_app_meta_data -> 'organizacao') then
    update public.perfis_utilizador set organizacao = v_org where id = new.id;
  end if;
  return new;
end;
$$;

-- Contas que o administrador já tinha marcado com 'equipa' no app_metadata antes desta migração (o papel ainda
-- não existia e ficaram 'familia') passam já a ser da equipa — a ordem entre criar a conta e migrar não importa.
update public.perfis_utilizador p
   set role = 'equipa'
  from auth.users u
 where u.id = p.id
   and u.raw_app_meta_data ->> 'role' = 'equipa'
   and not coalesce(u.is_anonymous, false)
   and p.role <> 'equipa';

-- "Mundo" da conta da equipa com sessão (demonstracao: true/false), ou null se não for da equipa (ou se a
-- sessão for anónima). Usada na política de visitas e em painel_equipa(): a conta de demonstração da equipa
-- (palavra-passe pública) só vê e só visita fichas de demonstração, e vice-versa.
create function private.mundo_equipa()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p.demonstracao
    from public.perfis_utilizador p
   where p.id = (select auth.uid())
     and p.role = 'equipa'
     and not coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false);
$$;
comment on function private.mundo_equipa() is
  'Conta da equipa com sessão: o seu "mundo" (demonstracao), ou null se não for da equipa. Política de visitas e painel_equipa().';

-- ————————————————————————————————————————————————————————————————— 7. visitas da equipa de terreno

create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  instituicao_id text not null references public.instituicoes (id) on delete cascade on update cascade,
  -- quem visitou (conta da equipa); apagar a conta mantém o registo
  equipa_id uuid references public.perfis_utilizador (id) on delete set null,
  data timestamptz not null default now(),
  resultado public.resultado_visita not null,
  licenca_confirmada boolean not null default false,
  instalacoes_vistas boolean not null default false,
  vagas_confirmadas boolean not null default false,
  precos_confirmados boolean not null default false,
  -- responsável com quem a equipa falou (o email serve para o convite da conta — Edge Function)
  responsavel_nome text check (char_length(responsavel_nome) between 1 and 120),
  responsavel_cargo text check (char_length(responsavel_cargo) between 1 and 80),
  responsavel_telefone text check (char_length(responsavel_telefone) between 1 and 30),
  responsavel_email text check (
    responsavel_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' and char_length(responsavel_email) <= 254
  ),
  -- modalidade escolhida na adesão de um lar privado (a da ficha pode mudar depois)
  plano public.plano_instituicao,
  notas text check (char_length(notas) between 1 and 2000),
  -- próximo contacto combinado (só "interessado" e "voltar")
  proximo_contacto date,
  -- conta do responsável criada na adesão (pela Edge Function de convite; null até lá)
  conta_criada_id uuid references public.perfis_utilizador (id) on delete set null,
  -- "mundo" da ficha visitada (demonstração ou real), copiado no registo
  demonstracao boolean not null default false,
  created_at timestamptz not null default now(),
  constraint visitas_plano_so_na_adesao check (plano is null or resultado = 'aderiu'),
  constraint visitas_proximo_contacto_so_a_acompanhar check (proximo_contacto is null or resultado in ('interessado', 'voltar')),
  constraint visitas_conta_so_na_adesao check (conta_criada_id is null or resultado = 'aderiu')
);
comment on table public.visitas is
  'Visitas da equipa de terreno (modo visita). Só a equipa as lê (do mesmo "mundo": demonstração ou real); escrita só por registar_visita(). Instituições e famílias nunca as leem.';

-- histórico da ficha (também é o índice da FK)
create index visitas_instituicao_idx on public.visitas (instituicao_id, data desc);
-- lista da equipa (useVisitas: mais recentes primeiro) dentro do seu "mundo" — a política filtra por demonstracao
create index visitas_recentes_idx on public.visitas (demonstracao, data desc);
create index visitas_equipa_id_idx on public.visitas (equipa_id) where equipa_id is not null;
create index visitas_conta_criada_id_idx on public.visitas (conta_criada_id) where conta_criada_id is not null;

alter table public.visitas enable row level security;

-- só a equipa lê, e só as visitas do seu "mundo" (sem políticas de escrita: só registar_visita escreve)
create policy visitas_select_equipa on public.visitas
  for select to authenticated
  using (demonstracao = (select private.mundo_equipa()));

revoke all on table public.visitas from anon, authenticated;
grant all on table public.visitas to service_role;
grant select on public.visitas to authenticated;

-- ————————————————————————————————————————————————————————————————— 8. registar uma visita (equipa)

-- registarVisita: só contas 'equipa' (com email), só fichas do seu "mundo". Bloqueia a ficha (e depois os
-- quartos, pela ordem das outras RPC) e aplica o que foi confirmado na visita:
--   * licença + instalações → selo «Visitada pela equipa» (verificado, com a data de hoje);
--     só a licença → 1.º nível (nao_verificado passa a pendente); p_licenca atualiza o nº da licença;
--   * p_quartos [{tipo, livres, preco_min, preco_max}]: só as partes confirmadas (vagas e/ou preços), por
--     tipo de quarto que a ficha já tem; livres entre 0 e o total; preços inteiros, o máximo nunca abaixo do
--     mínimo; renova a frescura das vagas (sem avisos de vaga — como no protótipo);
--   * p_cuidados substitui a lista de cuidados;
--   * "aderiu" num lar privado → modalidade (por omissão, por entrada) desde agora; como em
--     escolher_plano_instituicao, a mensalidade só volta à taxa por entrada no fim do compromisso, e repetir a
--     modalidade em vigor não a recomeça;
--   * a visita fica registada (próximo contacto só para "interessado" e "voltar"); com o selo, o gestor
--     (se houver) é avisado.
-- Devolve a visita (o selo = licenca_confirmada e instalacoes_vistas). A conta do responsável não é criada
-- aqui: no protótipo é uma palavra-passe provisória; na produção, um convite por email (Edge Function).
create function private.registar_visita(
  p_instituicao_id text,
  p_resultado public.resultado_visita,
  p_verificacao jsonb default '{}'::jsonb,
  p_licenca text default null,
  p_responsavel jsonb default null,
  p_plano public.plano_instituicao default null,
  p_notas text default null,
  p_proximo_contacto date default null,
  p_quartos jsonb default null,
  p_cuidados text[] default null
)
returns public.visitas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_conta public.perfis_utilizador;
  v_verif jsonb := coalesce(p_verificacao, '{}'::jsonb);
  v_resp jsonb := coalesce(p_responsavel, '{}'::jsonb);
  v_licenca_ok boolean;
  v_instalacoes boolean;
  v_vagas boolean;
  v_precos boolean;
  v_selo boolean;
  v_tem_quartos boolean := false;
  v_licenca text := nullif(btrim(p_licenca), '');
  v_notas text := nullif(btrim(p_notas), '');
  v_resp_nome text;
  v_resp_cargo text;
  v_resp_telefone text;
  v_resp_email text;
  v_inst public.instituicoes;
  v_plano public.plano_instituicao;
  v_ate timestamptz;
  v_v public.visitas;
begin
  select * into v_conta from public.perfis_utilizador p where p.id = v_uid;
  if v_conta.role is distinct from 'equipa' or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Só a equipa de terreno regista visitas.' using errcode = '42501';
  end if;
  if p_resultado is null then
    raise exception 'Indique o resultado da visita.' using errcode = '22023';
  end if;

  -- o que foi confirmado: {licenca_confirmada, instalacoes_vistas, vagas_confirmadas, precos_confirmados},
  -- só booleanos (uma chave em falta = não confirmado)
  if jsonb_typeof(v_verif) <> 'object' then
    raise exception 'Verificação inválida.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(v_verif) e
     where e.key not in ('licenca_confirmada', 'instalacoes_vistas', 'vagas_confirmadas', 'precos_confirmados')
        or jsonb_typeof(e.value) <> 'boolean'
  ) then
    raise exception 'Verificação inválida.' using errcode = '22023';
  end if;
  v_licenca_ok := coalesce((v_verif ->> 'licenca_confirmada')::boolean, false);
  v_instalacoes := coalesce((v_verif ->> 'instalacoes_vistas')::boolean, false);
  v_vagas := coalesce((v_verif ->> 'vagas_confirmadas')::boolean, false);
  v_precos := coalesce((v_verif ->> 'precos_confirmados')::boolean, false);
  v_selo := v_licenca_ok and v_instalacoes;

  if char_length(v_licenca) > 60 then
    raise exception 'O número da licença tem no máximo 60 caracteres.' using errcode = '22023';
  end if;
  if char_length(v_notas) > 2000 then
    raise exception 'As notas da visita têm no máximo 2000 caracteres.' using errcode = '22023';
  end if;

  -- responsável: {nome, cargo?, telefone?, email?}, só texto
  if jsonb_typeof(v_resp) <> 'object' then
    raise exception 'Dados do responsável inválidos.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_each(v_resp) e
     where e.key not in ('nome', 'cargo', 'telefone', 'email') or jsonb_typeof(e.value) not in ('string', 'null')
  ) then
    raise exception 'Dados do responsável inválidos.' using errcode = '22023';
  end if;
  v_resp_nome := nullif(btrim(v_resp ->> 'nome'), '');
  v_resp_cargo := nullif(btrim(v_resp ->> 'cargo'), '');
  v_resp_telefone := nullif(btrim(v_resp ->> 'telefone'), '');
  v_resp_email := lower(nullif(btrim(v_resp ->> 'email'), ''));
  if char_length(v_resp_nome) > 120 or char_length(v_resp_cargo) > 80 or char_length(v_resp_telefone) > 30
     or char_length(v_resp_email) > 254 then
    raise exception 'Dados do responsável demasiado longos.' using errcode = '22023';
  end if;
  if v_resp_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'O email do responsável não é válido.' using errcode = '22023';
  end if;

  -- quartos confirmados: [{tipo, livres, preco_min, preco_max}], com números
  if p_quartos is not null then
    if jsonb_typeof(p_quartos) <> 'array' then
      raise exception 'Quartos inválidos.' using errcode = '22023';
    end if;
    if jsonb_array_length(p_quartos) > 10 or exists (
      select 1 from jsonb_array_elements(p_quartos) e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e ->> 'tipo', '') not in ('individual', 'duplo', 'casal')
          or jsonb_typeof(e -> 'livres') is distinct from 'number'
          or jsonb_typeof(e -> 'preco_min') is distinct from 'number'
          or jsonb_typeof(e -> 'preco_max') is distinct from 'number'
    ) then
      raise exception 'Quartos inválidos.' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_array_elements(p_quartos) e
       where abs((e ->> 'livres')::numeric) > 100000
          or abs((e ->> 'preco_min')::numeric) > 1000000
          or abs((e ->> 'preco_max')::numeric) > 1000000
    ) then
      raise exception 'Quartos inválidos.' using errcode = '22023';
    end if;
    v_tem_quartos := jsonb_array_length(p_quartos) > 0;
  end if;

  -- a ficha, bloqueada até ao fim (instituição → quartos, como nas outras RPC)
  select * into v_inst from public.instituicoes i where i.id = p_instituicao_id for update;
  if not found then
    raise exception 'Instituição não encontrada.' using errcode = 'P0002';
  end if;
  if v_inst.demonstracao is distinct from v_conta.demonstracao then
    raise exception '%', case when v_inst.demonstracao
        then 'Esta ficha é de demonstração: só a conta de demonstração da equipa a visita.'
        else 'A conta de demonstração da equipa não regista visitas a instituições reais.' end
      using errcode = '22023';
  end if;

  -- licença confirmada (com as instalações: selo da visita; sem elas: 1.º nível)
  if v_licenca_ok then
    update public.instituicoes i
       set licenca = coalesce(v_licenca, i.licenca),
           verificacao_estado = case
             when v_selo then 'verificado'::public.estado_verificacao
             when i.verificacao_estado = 'nao_verificado' then 'pendente'::public.estado_verificacao
             else i.verificacao_estado
           end,
           verificacao_data = case when v_selo then now() else i.verificacao_data end
     where i.id = v_inst.id;
  end if;

  -- vagas e preços: só o que foi confirmado; o primeiro registo de cada tipo (como Array#find)
  if v_tem_quartos and (v_vagas or v_precos) then
    update public.quartos q
       set livres = case when v_vagas then greatest(0, least(q.total, round(c.livres)::integer)) else q.livres end,
           preco_min = case when v_precos then greatest(0, round(c.preco_min)) else q.preco_min end,
           preco_max = case when v_precos then greatest(0, round(c.preco_min), round(c.preco_max)) else q.preco_max end
      from (
        select distinct on (e.el ->> 'tipo')
               (e.el ->> 'tipo')::public.tipo_quarto as tipo,
               (e.el ->> 'livres')::numeric as livres,
               (e.el ->> 'preco_min')::numeric as preco_min,
               (e.el ->> 'preco_max')::numeric as preco_max
          from jsonb_array_elements(p_quartos) with ordinality as e (el, n)
         order by e.el ->> 'tipo', e.n
      ) c
     where q.instituicao_id = v_inst.id and q.tipo = c.tipo;
    -- a ficha fica atualizada agora (frescura), como no protótipo
    update public.instituicoes i set atualizado_em = now() where i.id = v_inst.id;
  end if;

  if p_cuidados is not null then
    begin
      update public.instituicoes i set cuidados = p_cuidados where i.id = v_inst.id;
    exception when check_violation or not_null_violation then
      raise exception 'Cuidados inválidos.' using errcode = '22023';
    end;
  end if;

  -- adesão de um lar privado: modalidade (por omissão, por entrada) a partir de agora. A regra do compromisso
  -- vale também aqui (o formulário da visita já a aplica): uma ficha na mensalidade só volta à taxa por entrada
  -- no fim dos 12 meses; e a mesma modalidade não recomeça o compromisso (uma nova visita não o prolonga).
  if p_resultado = 'aderiu' and v_inst.natureza = 'privado' then
    v_plano := coalesce(p_plano, 'por_entrada');
    if v_inst.plano is null or v_inst.plano <> v_plano then
      v_ate := private.compromisso_ate(v_inst.natureza, v_inst.plano, v_inst.plano_desde);
      if v_ate > now() then
        raise exception 'A mensalidade tem um compromisso de 12 meses: pode mudar a partir de %.', private.data_longa(v_ate)
          using errcode = '22023';
      end if;
      update public.instituicoes i set plano = v_plano, plano_desde = now() where i.id = v_inst.id;
    end if;
  end if;

  insert into public.visitas (
    instituicao_id, equipa_id, resultado, licenca_confirmada, instalacoes_vistas, vagas_confirmadas, precos_confirmados,
    responsavel_nome, responsavel_cargo, responsavel_telefone, responsavel_email, plano, notas, proximo_contacto,
    demonstracao
  ) values (
    v_inst.id, v_uid, p_resultado, v_licenca_ok, v_instalacoes, v_vagas, v_precos,
    v_resp_nome, v_resp_cargo, v_resp_telefone, v_resp_email, v_plano, v_notas,
    case when p_resultado in ('interessado', 'voltar') then p_proximo_contacto end,
    v_inst.demonstracao
  )
  returning * into v_v;

  if v_selo and v_inst.owner_id is not null then
    perform private.notificar(
      v_inst.owner_id, 'sistema', 'Visitada pela equipa',
      'A equipa do EncontraLar confirmou a licença e as instalações. A ficha tem agora o selo «Visitada pela equipa».',
      v_inst.id, null, '/gestao/ficha'
    );
  end if;
  return v_v;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 9. dados internos para a equipa

-- O que a equipa precisa de saber de cada ficha do seu "mundo" e que não está na vista pública: se já tem
-- gestor (a conta do responsável só se cria quando não tem) e a modalidade em vigor (null = por entrada).
-- Vazio para quem não é da equipa.
create function private.painel_equipa()
returns table (
  instituicao_id text,
  tem_gestor boolean,
  plano public.plano_instituicao,
  plano_desde timestamptz,
  compromisso_ate timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.owner_id is not null, i.plano, i.plano_desde, private.compromisso_ate(i.natureza, i.plano, i.plano_desde)
    from public.instituicoes i
   where i.demonstracao = (select private.mundo_equipa())
   order by i.id;
$$;

-- ————————————————————————————————————————————————————————————————— 10. RPC públicas (Data API)
-- Invólucros SECURITY INVOKER (a autorização está nas funções private).

create function public.painel_instituicao()
returns table (
  id text,
  publicado boolean,
  verificacao_estado public.estado_verificacao,
  visualizacoes_30d integer,
  lista_espera_offline integer,
  lista_espera_online integer,
  plano public.plano_instituicao,
  plano_desde timestamptz,
  compromisso_ate timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.painel_instituicao();
$$;
comment on function public.painel_instituicao() is
  'Dono (lar): id da instituição que gere e dados internos (publicação, verificação, visualizações, lista de espera offline/plataforma, modalidade e fim do compromisso).';

create function public.escolher_plano_instituicao(p_plano public.plano_instituicao)
returns table (
  instituicao_id text,
  plano public.plano_instituicao,
  plano_desde timestamptz,
  compromisso_ate timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.escolher_plano_instituicao(p_plano);
$$;
comment on function public.escolher_plano_instituicao(public.plano_instituicao) is
  'Dono de um lar privado: muda a modalidade (por_entrada | mensal). A mesma não muda nada; voltar à taxa por entrada só no fim do compromisso de 12 meses.';

create function public.registar_visita(
  p_instituicao_id text,
  p_resultado public.resultado_visita,
  p_verificacao jsonb default '{}'::jsonb,
  p_licenca text default null,
  p_responsavel jsonb default null,
  p_plano public.plano_instituicao default null,
  p_notas text default null,
  p_proximo_contacto date default null,
  p_quartos jsonb default null,
  p_cuidados text[] default null
)
returns public.visitas
language sql
security invoker
set search_path = ''
as $$
  select * from private.registar_visita(
    p_instituicao_id, p_resultado, p_verificacao, p_licenca, p_responsavel, p_plano, p_notas, p_proximo_contacto,
    p_quartos, p_cuidados
  );
$$;
comment on function public.registar_visita(text, public.resultado_visita, jsonb, text, jsonb, public.plano_instituicao, text, date, jsonb, text[]) is
  'Equipa de terreno: regista uma visita (selo, licença, vagas e preços confirmados, cuidados, modalidade na adesão) e avisa o gestor do selo.';

create function public.painel_equipa()
returns table (
  instituicao_id text,
  tem_gestor boolean,
  plano public.plano_instituicao,
  plano_desde timestamptz,
  compromisso_ate timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.painel_equipa();
$$;
comment on function public.painel_equipa() is
  'Equipa de terreno: por ficha do seu "mundo", se já tem gestor e a modalidade em vigor (dados internos fora da vista pública).';

-- ————————————————————————————————————————————————————————————————— 11. privilégios de execução

revoke all on function
  private.data_longa(timestamptz),
  private.compromisso_ate(public.natureza, public.plano_instituicao, timestamptz),
  private.instituicoes_limpar_plano(),
  private.taxa_para(public.instituicoes),
  private.mundo_equipa(),
  private.painel_instituicao(),
  private.escolher_plano_instituicao(public.plano_instituicao),
  private.registar_visita(text, public.resultado_visita, jsonb, text, jsonb, public.plano_instituicao, text, date, jsonb, text[]),
  private.painel_equipa(),
  public.painel_instituicao(),
  public.escolher_plano_instituicao(public.plano_instituicao),
  public.registar_visita(text, public.resultado_visita, jsonb, text, jsonb, public.plano_instituicao, text, date, jsonb, text[]),
  public.painel_equipa()
from public, anon, authenticated;

-- auxiliar da política de visitas
grant execute on function private.mundo_equipa() to authenticated, service_role;

-- RPC de utilizadores com sessão (e as funções private que elas chamam; private não está na Data API)
grant execute on function
  public.painel_instituicao(),
  public.escolher_plano_instituicao(public.plano_instituicao),
  public.registar_visita(text, public.resultado_visita, jsonb, text, jsonb, public.plano_instituicao, text, date, jsonb, text[]),
  public.painel_equipa(),
  private.painel_instituicao(),
  private.escolher_plano_instituicao(public.plano_instituicao),
  private.registar_visita(text, public.resultado_visita, jsonb, text, jsonb, public.plano_instituicao, text, date, jsonb, text[]),
  private.painel_equipa()
to authenticated, service_role;
