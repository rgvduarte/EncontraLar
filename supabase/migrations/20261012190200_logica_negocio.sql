-- =====================================================================================
-- EncontraLar — lógica de negócio no servidor (espelha src/lib/store.ts).
--
-- Padrão: a lógica vive no schema private (NÃO exposto) em funções SECURITY DEFINER com
-- search_path = '' e verificação explícita de auth.uid(); a Data API só vê finos invólucros
-- SECURITY INVOKER no schema public (RPC), executáveis apenas por authenticated.
--
-- Concorrência: as operações que mexem na lista de espera ou nos lugares livres bloqueiam
-- primeiro a linha da instituição (SELECT … FOR UPDATE) e só depois a candidatura/quarto —
-- ordem fixa, transações curtas, sem deadlocks entre RPC.
-- =====================================================================================

-- ————————————————————————————————————————————————————————————————— utilitários de texto

-- 2026-10-16 → 'sexta-feira, 16 de outubro' (igual a toLocaleDateString('pt-PT', …) no protótipo)
create function private.data_extenso(p_data date)
returns text
language sql
immutable
set search_path = ''
as $$
  select (array['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'])
           [extract(dow from p_data)::int + 1]
         || ', ' || extract(day from p_data)::int || ' de '
         || (array['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro',
                   'outubro', 'novembro', 'dezembro'])[extract(month from p_data)::int];
$$;

create function private.nome_quarto(p_tipo public.tipo_quarto)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_tipo when 'casal' then 'de casal' else p_tipo::text end;
$$;

-- igual a ESTADO_CANDIDATURA_LABEL (src/lib/labels.ts)
create function private.rotulo_estado(p_estado public.estado_candidatura)
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
    when 'recusada' then 'Não foi possível'
    when 'cancelada' then 'Cancelada'
  end;
$$;

-- Transições que a INSTITUIÇÃO pode fazer (a família só cancela ou responde a uma vaga proposta).
create function private.transicao_lar_permitida(p_de public.estado_candidatura, p_para public.estado_candidatura)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case p_de
    when 'enviada' then p_para in ('em_analise', 'lista_espera', 'recusada')
    when 'em_analise' then p_para in ('lista_espera', 'vaga_proposta', 'recusada')
    when 'lista_espera' then p_para in ('vaga_proposta', 'recusada')
    when 'vaga_proposta' then p_para in ('aceite', 'lista_espera', 'recusada')
    else false
  end;
$$;

-- Cópia do perfil enviada à instituição (sem user_id).
create function private.snapshot_perfil(p_perfil public.perfis_cuidados)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select to_jsonb(p_perfil) - 'user_id';
$$;

-- ————————————————————————————————————————————————————————————————— verificações de acesso

create function private.exigir_sessao()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'É necessário iniciar sessão.' using errcode = '42501';
  end if;
  return v_uid;
end;
$$;

-- Garante que o utilizador autenticado é o dono da instituição e BLOQUEIA a linha (FOR UPDATE).
-- A mesma mensagem para "não existe" e "não é sua" (não revela fichas não publicadas).
create function private.exigir_dono(p_instituicao_id text)
returns public.instituicoes
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.exigir_sessao();
  v_inst public.instituicoes;
begin
  select * into v_inst from public.instituicoes i where i.id = p_instituicao_id for update;
  if not found or v_inst.owner_id is distinct from v_uid then
    raise exception 'Sem permissão para gerir esta instituição.' using errcode = '42501';
  end if;
  return v_inst;
end;
$$;

-- ————————————————————————————————————————————————————————————————— peças internas

create function private.notificar(
  p_user_id uuid,
  p_tipo public.tipo_notificacao,
  p_titulo text,
  p_texto text,
  p_instituicao_id text default null,
  p_candidatura_id uuid default null,
  p_link text default null
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notificacoes (user_id, tipo, titulo, texto, instituicao_id, candidatura_id, link)
  values (p_user_id, p_tipo, left(p_titulo, 200), left(p_texto, 2000), p_instituicao_id, p_candidatura_id, p_link);
$$;

-- Próxima posição na lista de espera: depois de TODAS as inscrições (offline + plataforma).
-- greatest(…, max(posicao)) protege contra o lar ter baixado o nº de inscrições offline.
create function private.proxima_posicao(p_instituicao_id text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(
    i.lista_espera_offline + (
      select count(*)::int from public.candidaturas c
      where c.instituicao_id = i.id and c.estado in ('lista_espera', 'vaga_proposta')
    ),
    coalesce((select max(c.posicao) from public.candidaturas c where c.instituicao_id = i.id), 0)
  ) + 1
  from public.instituicoes i
  where i.id = p_instituicao_id;
$$;

-- Quem estava atrás de p_posicao sobe um lugar. Chamar DEPOIS de limpar a posição de quem sai.
create function private.sair_da_lista(p_instituicao_id text, p_posicao integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.candidaturas c
     set posicao = c.posicao - 1
   where c.instituicao_id = p_instituicao_id
     and c.posicao > p_posicao;
$$;

-- Ocupa um lugar livre: do tipo preferido, senão de outro tipo com lugares (como no protótipo).
create function private.ocupar_lugar(p_instituicao_id text, p_preferido text)
returns public.tipo_quarto
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
  v_tipo public.tipo_quarto;
begin
  select q.id, q.tipo into v_id, v_tipo
    from public.quartos q
   where q.instituicao_id = p_instituicao_id and q.livres > 0
   order by (q.tipo::text = p_preferido) desc, q.tipo
   limit 1
   for update;
  if v_id is null then
    return null;
  end if;
  update public.quartos set livres = livres - 1 where id = v_id;
  update public.instituicoes set atualizado_em = now() where id = p_instituicao_id;
  return v_tipo;
end;
$$;

-- Avisa as famílias em lista de espera e as que seguem a instituição com alerta.
-- Uma notificação por família. Devolve o nº de famílias avisadas.
create function private.avisar_nova_vaga(p_instituicao_id text, p_tipo public.tipo_quarto)
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

  insert into public.notificacoes (user_id, tipo, titulo, texto, instituicao_id, candidatura_id, link)
  select l.user_id, 'vaga', 'Abriu uma vaga onde está inscrito(a)',
         format('%s tem uma nova vaga (quarto %s). A instituição contacta as famílias pela ordem da lista — está na posição %s.',
                v_inst.nome, v_quarto, l.posicao),
         v_inst.id, l.id, '/familia'
    from (
      select distinct on (c.user_id) c.user_id, c.id, c.posicao
        from public.candidaturas c
       where c.instituicao_id = v_inst.id and c.estado = 'lista_espera'
       order by c.user_id, c.posicao
    ) l;
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
     );
  get diagnostics v_favoritos = row_count;

  return v_lista + v_favoritos;
end;
$$;

-- Define os lugares livres de um tipo de quarto (instituição já verificada e bloqueada).
create function private.aplicar_vagas(p_instituicao_id text, p_tipo public.tipo_quarto, p_livres integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quartos;
  v_novo integer;
begin
  select * into v_q from public.quartos q
   where q.instituicao_id = p_instituicao_id and q.tipo = p_tipo
   for update;
  if not found then
    raise exception 'A instituição não tem quartos do tipo %.', p_tipo using errcode = 'P0002';
  end if;
  v_novo := greatest(0, least(v_q.total, coalesce(p_livres, v_q.livres)));
  update public.quartos set livres = v_novo where id = v_q.id;
  update public.instituicoes set atualizado_em = now() where id = p_instituicao_id;
  if v_novo > v_q.livres then
    return private.avisar_nova_vaga(p_instituicao_id, p_tipo);
  end if;
  return 0;
end;
$$;

-- Lê a candidatura (sem bloquear) para verificar permissões antes de bloquear a instituição.
create function private.ler_candidatura(p_candidatura_id uuid)
returns public.candidaturas
language sql
stable
security definer
set search_path = ''
as $$
  select * from public.candidaturas c where c.id = p_candidatura_id;
$$;

-- Bloqueia instituição e candidatura, por esta ordem, e devolve a candidatura atualizada.
create function private.bloquear_candidatura(p_candidatura_id uuid)
returns public.candidaturas
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.candidaturas;
begin
  perform 1 from public.instituicoes i
   where i.id = (select c.instituicao_id from public.candidaturas c where c.id = p_candidatura_id)
   for update;
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id for update;
  return v_c;
end;
$$;

-- ————————————————————————————————————————————————————————————————— lado da família

-- Envia um pedido de vaga. Exige consentimento explícito (fica registado em consentimento_em).
-- Se já houver um pedido ativo para a mesma instituição e perfil, devolve-o (como no protótipo).
create function private.candidatar(
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
    -- pedido simultâneo: devolve o que ganhou a corrida
    select * into v_c from public.candidaturas c
     where c.user_id = v_uid and c.instituicao_id = v_inst.id and c.perfil_id = v_perfil.id
       and c.estado not in ('cancelada', 'recusada');
    return v_c;
  end;

  insert into public.candidatura_eventos (candidatura_id, estado, autor, autor_id)
  values (v_c.id, 'enviada', 'familia', v_uid);

  if v_inst.owner_id is not null then
    perform private.notificar(
      v_inst.owner_id, 'candidatura', 'Novo pedido de vaga',
      format('%s enviou um pedido para %s (%s anos).%s', v_conta.nome, v_perfil.nome, v_perfil.idade,
             case when p_visita_data is not null then ' Pediu também uma visita.' else '' end),
      v_inst.id, v_c.id, '/gestao'
    );
  end if;
  return v_c;
end;
$$;

create function private.pedir_visita(p_candidatura_id uuid, p_data date, p_hora time)
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
  if v_c.estado in ('aceite', 'recusada', 'cancelada') then
    raise exception 'Este pedido já está concluído.' using errcode = '22023';
  end if;

  update public.candidaturas
     set visita_data = p_data, visita_hora = p_hora, visita_estado = 'pedida'
   where id = v_c.id
  returning * into v_c;

  select i.owner_id into v_owner from public.instituicoes i where i.id = v_c.instituicao_id;
  if v_owner is not null then
    perform private.notificar(
      v_owner, 'visita', 'Pedido de visita',
      format('%s pediu uma visita para %s, às %s.', v_c.contacto ->> 'nome', private.data_extenso(p_data),
             to_char(p_hora, 'HH24:MI')),
      v_c.instituicao_id, v_c.id, '/gestao'
    );
  end if;
  return v_c;
end;
$$;

create function private.cancelar_candidatura(p_candidatura_id uuid)
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
  if v_c.estado in ('aceite', 'recusada', 'cancelada') then
    raise exception 'Este pedido já está concluído.' using errcode = '22023';
  end if;
  v_posicao := v_c.posicao;

  update public.candidaturas
     set estado = 'cancelada', posicao = null, prazo_resposta = null
   where id = v_c.id
  returning * into v_c;
  if v_posicao is not null then
    perform private.sair_da_lista(v_c.instituicao_id, v_posicao);
  end if;

  insert into public.candidatura_eventos (candidatura_id, estado, autor, autor_id)
  values (v_c.id, 'cancelada', 'familia', v_uid);

  select i.owner_id into v_owner from public.instituicoes i where i.id = v_c.instituicao_id;
  if v_owner is not null then
    perform private.notificar(
      v_owner, 'candidatura', 'Pedido cancelado',
      format('%s cancelou o pedido para %s.', v_c.contacto ->> 'nome', v_c.perfil_snapshot ->> 'nome'),
      v_c.instituicao_id, v_c.id, '/gestao'
    );
  end if;
  return v_c;
end;
$$;

-- A família responde a uma vaga proposta. Aceitar ocupa um lugar (do tipo preferido, se houver)
-- e sai da lista; recusar mantém a posição na lista.
create function private.responder_vaga(p_candidatura_id uuid, p_aceitar boolean)
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
  if p_aceitar is null then
    raise exception 'Indique se aceita ou recusa a vaga.' using errcode = '22023';
  end if;
  v_c := private.bloquear_candidatura(p_candidatura_id);
  if v_c.estado <> 'vaga_proposta' then
    raise exception 'Não há nenhuma vaga proposta para responder.' using errcode = '22023';
  end if;
  v_posicao := v_c.posicao;

  if p_aceitar then
    update public.candidaturas
       set estado = 'aceite', posicao = null, prazo_resposta = null
     where id = v_c.id
    returning * into v_c;
    perform private.sair_da_lista(v_c.instituicao_id, v_posicao);
    perform private.ocupar_lugar(v_c.instituicao_id, v_c.perfil_snapshot ->> 'quarto');
    insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id)
    values (v_c.id, 'aceite', 'Vaga aceite pela família.', 'familia', v_uid);
  else
    update public.candidaturas
       set estado = 'lista_espera', prazo_resposta = null
     where id = v_c.id
    returning * into v_c;
    insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id)
    values (v_c.id, 'lista_espera', 'A família recusou esta vaga e mantém-se na lista.', 'familia', v_uid);
  end if;

  select i.owner_id into v_owner from public.instituicoes i where i.id = v_c.instituicao_id;
  if v_owner is not null then
    perform private.notificar(
      v_owner, 'candidatura',
      case when p_aceitar then 'Vaga aceite' else 'Vaga recusada' end,
      case when p_aceitar
        then format('%s aceitou a vaga para %s. Combine a data de entrada.',
                    v_c.contacto ->> 'nome', v_c.perfil_snapshot ->> 'nome')
        else format('%s recusou a vaga proposta para %s. Pode propô-la à próxima pessoa da lista.',
                    v_c.contacto ->> 'nome', v_c.perfil_snapshot ->> 'nome')
      end,
      v_c.instituicao_id, v_c.id, '/gestao'
    );
  end if;
  return v_c;
end;
$$;

-- ————————————————————————————————————————————————————————————————— lado da instituição

-- Muda o estado de um pedido (só o dono, só transições permitidas), com nota para a família.
--   entrar na lista (lista_espera/vaga_proposta) → posição = depois de todos os inscritos (offline incluídos)
--   sair da lista → quem estava atrás sobe
--   vaga_proposta → prazo de resposta de 48 horas (exige pelo menos um lugar livre)
--   aceite → ocupa um lugar livre
create function private.atualizar_estado_candidatura(
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
  v_inst := private.exigir_dono(v_c.instituicao_id);   -- verifica e bloqueia a instituição
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id for update;

  if v_c.estado = p_estado then
    return v_c;   -- nada a fazer (como no protótipo)
  end if;
  if not private.transicao_lar_permitida(v_c.estado, p_estado) then
    raise exception 'Transição não permitida: % → %.', v_c.estado, p_estado using errcode = '22023';
  end if;
  if p_estado = 'vaga_proposta'
     and not exists (select 1 from public.quartos q where q.instituicao_id = v_inst.id and q.livres > 0) then
    raise exception 'Sem lugares livres para propor. Registe primeiro a vaga.' using errcode = '22023';
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
         prazo_resposta = case when p_estado = 'vaga_proposta' then now() + interval '48 hours' end
   where id = v_c.id
  returning * into v_c;

  if v_estava and not v_fica then
    perform private.sair_da_lista(v_inst.id, v_posicao_antiga);
  end if;
  if p_estado = 'aceite' then
    perform private.ocupar_lugar(v_inst.id, v_c.perfil_snapshot ->> 'quarto');
  end if;

  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id)
  values (v_c.id, p_estado, v_nota, 'lar', v_uid);

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
    v_texto, v_inst.id, v_c.id, '/familia'
  );
  return v_c;
end;
$$;

create function private.confirmar_visita(p_candidatura_id uuid)
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
    v_inst.id, v_c.id, '/familia'
  );
  return v_c;
end;
$$;

-- Define o nº de lugares livres de um tipo de quarto. Se aumentar, avisa as famílias.
-- Devolve o nº de famílias avisadas.
create function private.definir_vagas(p_instituicao_id text, p_tipo public.tipo_quarto, p_livres integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.exigir_dono(p_instituicao_id);
  return private.aplicar_vagas(p_instituicao_id, p_tipo, p_livres);
end;
$$;

-- Saída de um residente: +1 lugar livre, regista a saída no mês corrente (previsão) e avisa.
-- Devolve o nº de famílias avisadas (0 se todos os lugares desse tipo já estavam livres).
create function private.registar_vaga_libertada(p_instituicao_id text, p_tipo public.tipo_quarto)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quartos;
begin
  perform private.exigir_dono(p_instituicao_id);
  select * into v_q from public.quartos q
   where q.instituicao_id = p_instituicao_id and q.tipo = p_tipo
   for update;
  if not found then
    raise exception 'A instituição não tem quartos do tipo %.', p_tipo using errcode = 'P0002';
  end if;
  if v_q.livres >= v_q.total then
    return 0;
  end if;

  insert into public.saidas_mensais as s (instituicao_id, mes, saidas)
  values (p_instituicao_id, date_trunc('month', now())::date, 1)
  on conflict (instituicao_id, mes) do update set saidas = s.saidas + 1;

  return private.aplicar_vagas(p_instituicao_id, p_tipo, v_q.livres + 1);
end;
$$;

-- Entrada de um novo residente: −1 lugar livre. Devolve os lugares livres desse tipo.
create function private.registar_entrada(p_instituicao_id text, p_tipo public.tipo_quarto)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_q public.quartos;
begin
  perform private.exigir_dono(p_instituicao_id);
  select * into v_q from public.quartos q
   where q.instituicao_id = p_instituicao_id and q.tipo = p_tipo
   for update;
  if not found then
    raise exception 'A instituição não tem quartos do tipo %.', p_tipo using errcode = 'P0002';
  end if;
  if v_q.livres <= 0 then
    return 0;
  end if;
  perform private.aplicar_vagas(p_instituicao_id, p_tipo, v_q.livres - 1);
  return v_q.livres - 1;
end;
$$;

-- Confirma que a informação de vagas está correta (renova o selo de atualização).
create function private.confirmar_vagas_atualizadas(p_instituicao_id text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quando timestamptz;
begin
  perform private.exigir_dono(p_instituicao_id);
  update public.instituicoes set atualizado_em = now() where id = p_instituicao_id
  returning atualizado_em into v_quando;
  return v_quando;
end;
$$;

-- ————————————————————————————————————————————————————————————————— retenção (RGPD)
-- Minimiza pedidos encerrados (cancelados/recusados) há mais de p_dias: retira da cópia do perfil
-- os dados de saúde e da mensagem/contacto o que não é necessário. Só para service_role / pg_cron.
create function private.minimizar_candidaturas_encerradas(p_dias integer default 180)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  update public.candidaturas c
     set perfil_snapshot = jsonb_strip_nulls(jsonb_build_object(
           'nome', c.perfil_snapshot -> 'nome',
           'idade', c.perfil_snapshot -> 'idade',
           'minimizado_em', now()
         )),
         contacto = jsonb_strip_nulls(jsonb_build_object('nome', c.contacto -> 'nome')),
         mensagem = null
   where c.estado in ('cancelada', 'recusada')
     and c.updated_at < now() - make_interval(days => greatest(p_dias, 0))
     and not (c.perfil_snapshot ? 'minimizado_em');
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ————————————————————————————————————————————————————————————————— triggers de consistência

-- lista_espera_online = nº de candidaturas em lista_espera/vaga_proposta (para a vista pública,
-- que anon lê sem acesso às candidaturas).
create function private.recontar_lista_espera(p_instituicao_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.instituicoes i
     set lista_espera_online = n.total
    from (
      select count(*)::int as total from public.candidaturas c
       where c.instituicao_id = p_instituicao_id and c.estado in ('lista_espera', 'vaga_proposta')
    ) n
   where i.id = p_instituicao_id
     and i.lista_espera_online is distinct from n.total;
$$;

create function private.candidaturas_manter_contador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.estado in ('lista_espera', 'vaga_proposta') then
      perform private.recontar_lista_espera(new.instituicao_id);
    end if;
  elsif (old.estado in ('lista_espera', 'vaga_proposta')) <> (new.estado in ('lista_espera', 'vaga_proposta')) then
    perform private.recontar_lista_espera(new.instituicao_id);
  end if;
  return null;
end;
$$;

create trigger candidaturas_lista_espera
  after insert or update of estado on public.candidaturas
  for each row execute function private.candidaturas_manter_contador();

-- Candidaturas apagadas (ex.: a família apagou a conta): quem estava atrás sobe tantas posições
-- quantas as candidaturas removidas à sua frente. Trigger por instrução (lida bem com várias).
create function private.candidaturas_apos_remocao()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.candidaturas c
     set posicao = c.posicao - r.a_frente
    from (
      select c2.id, count(*)::int as a_frente
        from public.candidaturas c2
        join removidas x on x.instituicao_id = c2.instituicao_id and x.posicao < c2.posicao
       group by c2.id
    ) r
   where c.id = r.id;

  perform private.recontar_lista_espera(x.instituicao_id)
     from (select distinct instituicao_id from removidas where posicao is not null) x;
  return null;
end;
$$;

create trigger candidaturas_remocao
  after delete on public.candidaturas
  referencing old table as removidas
  for each statement execute function private.candidaturas_apos_remocao();

-- Avaliações de utilizadores: "verificada" quando a família teve uma vaga aceite na instituição.
create function private.avaliacoes_verificar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    new.verificada := exists (
      select 1 from public.candidaturas c
       where c.user_id = new.user_id and c.instituicao_id = new.instituicao_id and c.estado = 'aceite'
    );
  end if;
  return new;
end;
$$;

create trigger avaliacoes_verificar
  before insert on public.avaliacoes
  for each row execute function private.avaliacoes_verificar();

-- Agregados (média e total) atualizados de forma incremental para avaliações de utilizadores.
-- As importadas (user_id null) já estão refletidas nos agregados carregados com a ficha.
create function private.avaliacoes_atualizar_agregados()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' and new.user_id is not null then
    update public.instituicoes i
       set avaliacao_media = least(5, greatest(0, round((i.avaliacao_media * i.num_avaliacoes + new.nota) / (i.num_avaliacoes + 1), 2))),
           num_avaliacoes = i.num_avaliacoes + 1
     where i.id = new.instituicao_id;
  elsif tg_op = 'DELETE' and old.user_id is not null then
    update public.instituicoes i
       set avaliacao_media = case
             when i.num_avaliacoes <= 1 then 0
             else least(5, greatest(0, round((i.avaliacao_media * i.num_avaliacoes - old.nota) / (i.num_avaliacoes - 1), 2)))
           end,
           num_avaliacoes = greatest(i.num_avaliacoes - 1, 0)
     where i.id = old.instituicao_id;
  end if;
  return null;
end;
$$;

create trigger avaliacoes_agregados
  after insert or delete on public.avaliacoes
  for each row execute function private.avaliacoes_atualizar_agregados();

-- ————————————————————————————————————————————————————————————————— vista pública de pesquisa
-- security_invoker: a RLS das tabelas aplica-se a quem consulta (anon vê só fichas publicadas;
-- o dono vê também a sua, mesmo não publicada — filtre por publicado na pesquisa).
-- Uma linha por instituição com os quartos e o histórico dos últimos 12 meses (o último é o
-- mês corrente, como em src/features/lar-dashboard/previsao/SaidasChart.tsx) → sem N+1.

create view public.instituicoes_publicas
with (security_invoker = true)
as
select
  i.id, i.nome, i.tipo, i.natureza, i.resumo, i.descricao,
  i.morada, i.codigo_postal, i.localidade, i.concelho, i.distrito, i.regiao, i.lat, i.lng,
  i.telefone, i.email, i.website,
  i.capacidade,
  i.lista_espera_offline + i.lista_espera_online as lista_espera,
  i.lista_espera_offline,
  i.estadia_media_meses, i.acordo_ss, i.incluido, i.extras, i.graus, i.cuidados, i.comodidades,
  i.equipa_cuidadores_por_10, i.equipa_enfermeiros, i.equipa_medico_horas_semana,
  i.licenca, i.verificacao_estado, i.verificacao_data, i.ultima_inspecao,
  i.avaliacao_media, i.num_avaliacoes, i.fundacao, i.atualizado_em, i.capa,
  i.owner_id, i.publicado, i.visualizacoes_30d,
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
  select array_agg(coalesce(s.saidas, 0) order by m.mes) as historico
  from generate_series(
         date_trunc('month', now()) - interval '11 months',
         date_trunc('month', now()),
         interval '1 month'
       ) as m (mes)
  left join public.saidas_mensais s on s.instituicao_id = i.id and s.mes = m.mes::date
  where exists (select 1 from public.saidas_mensais x where x.instituicao_id = i.id)
) h on true;

comment on view public.instituicoes_publicas is
  'Pesquisa/ficha pública: vagas_livres, mensalidade_min/max e quartos calculados a partir de quartos; lista_espera = offline + plataforma; historico_saidas = últimos 12 meses (o último é o mês corrente).';

revoke all on public.instituicoes_publicas from anon, authenticated;
grant select on public.instituicoes_publicas to anon, authenticated, service_role;

-- ————————————————————————————————————————————————————————————————— RPC públicas (Data API)
-- Invólucros SECURITY INVOKER: não contornam nada por si; a autorização está nas funções private.

create function public.candidatar(
  p_instituicao_id text,
  p_perfil_id uuid,
  p_consentimento boolean,
  p_mensagem text default null,
  p_visita_data date default null,
  p_visita_hora time default null
)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.candidatar(p_instituicao_id, p_perfil_id, p_consentimento, p_mensagem, p_visita_data, p_visita_hora);
$$;
comment on function public.candidatar(text, uuid, boolean, text, date, time) is
  'Família: envia um pedido de vaga com consentimento explícito (copia o perfil e avisa a instituição).';

create function public.pedir_visita(p_candidatura_id uuid, p_data date, p_hora time)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.pedir_visita(p_candidatura_id, p_data, p_hora);
$$;

create function public.cancelar_candidatura(p_candidatura_id uuid)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.cancelar_candidatura(p_candidatura_id);
$$;

create function public.responder_vaga(p_candidatura_id uuid, p_aceitar boolean)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.responder_vaga(p_candidatura_id, p_aceitar);
$$;

create function public.atualizar_estado_candidatura(
  p_candidatura_id uuid,
  p_estado public.estado_candidatura,
  p_nota text default null
)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.atualizar_estado_candidatura(p_candidatura_id, p_estado, p_nota);
$$;

create function public.confirmar_visita(p_candidatura_id uuid)
returns public.candidaturas
language sql
security invoker
set search_path = ''
as $$
  select * from private.confirmar_visita(p_candidatura_id);
$$;

create function public.definir_vagas(p_instituicao_id text, p_tipo public.tipo_quarto, p_livres integer)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.definir_vagas(p_instituicao_id, p_tipo, p_livres);
$$;

create function public.registar_vaga_libertada(p_instituicao_id text, p_tipo public.tipo_quarto)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.registar_vaga_libertada(p_instituicao_id, p_tipo);
$$;

create function public.registar_entrada(p_instituicao_id text, p_tipo public.tipo_quarto)
returns integer
language sql
security invoker
set search_path = ''
as $$
  select private.registar_entrada(p_instituicao_id, p_tipo);
$$;

create function public.confirmar_vagas_atualizadas(p_instituicao_id text)
returns timestamptz
language sql
security invoker
set search_path = ''
as $$
  select private.confirmar_vagas_atualizadas(p_instituicao_id);
$$;

-- ————————————————————————————————————————————————————————————————— privilégios de execução
-- Tudo fechado por omissão (inclui os GRANTs automáticos do Supabase a anon/authenticated)…
revoke execute on all functions in schema private from public, anon, authenticated;
revoke execute on function
  public.candidatar(text, uuid, boolean, text, date, time),
  public.pedir_visita(uuid, date, time),
  public.cancelar_candidatura(uuid),
  public.responder_vaga(uuid, boolean),
  public.atualizar_estado_candidatura(uuid, public.estado_candidatura, text),
  public.confirmar_visita(uuid),
  public.definir_vagas(text, public.tipo_quarto, integer),
  public.registar_vaga_libertada(text, public.tipo_quarto),
  public.registar_entrada(text, public.tipo_quarto),
  public.confirmar_vagas_atualizadas(text)
from public, anon, authenticated;

-- …e aberto só ao necessário:
-- (1) auxiliares usadas nas políticas RLS
grant execute on function private.tem_papel(public.role_utilizador), private.minha_instituicao()
  to authenticated, service_role;
-- (2) RPC públicas e as funções private que elas chamam (as private não estão na Data API)
grant execute on function
  public.candidatar(text, uuid, boolean, text, date, time),
  public.pedir_visita(uuid, date, time),
  public.cancelar_candidatura(uuid),
  public.responder_vaga(uuid, boolean),
  public.atualizar_estado_candidatura(uuid, public.estado_candidatura, text),
  public.confirmar_visita(uuid),
  public.definir_vagas(text, public.tipo_quarto, integer),
  public.registar_vaga_libertada(text, public.tipo_quarto),
  public.registar_entrada(text, public.tipo_quarto),
  public.confirmar_vagas_atualizadas(text),
  private.candidatar(text, uuid, boolean, text, date, time),
  private.pedir_visita(uuid, date, time),
  private.cancelar_candidatura(uuid),
  private.responder_vaga(uuid, boolean),
  private.atualizar_estado_candidatura(uuid, public.estado_candidatura, text),
  private.confirmar_visita(uuid),
  private.definir_vagas(text, public.tipo_quarto, integer),
  private.registar_vaga_libertada(text, public.tipo_quarto),
  private.registar_entrada(text, public.tipo_quarto),
  private.confirmar_vagas_atualizadas(text)
to authenticated, service_role;
-- (3) manutenção: só service_role (ou pg_cron, que corre como postgres)
grant execute on function private.minimizar_candidaturas_encerradas(integer) to service_role;
