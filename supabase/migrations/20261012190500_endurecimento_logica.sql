-- =====================================================================================
-- EncontraLar — endurecimento da lógica de negócio (revisão de 2026-10-12).
-- Substitui funções de 20261012190200_logica_negocio.sql (mesmas assinaturas) e acrescenta:
--
--   1. Quem recebe dados de saúde: private.candidatar só aceita fichas publicadas, VERIFICADAS,
--      com gestor, do mesmo "mundo" (demonstração/real) da conta, e recusa sessões anónimas.
--      Limites de pedidos por dia (anti-spam).
--   2. Cópia do perfil enviada à instituição: lista explícita de campos (sem coordenadas exatas,
--      raio de pesquisa, id interno nem datas); colunas novas em perfis_cuidados não passam.
--   3. Minimização (RGPD art. 5.º/7.º/17.º): ao cancelar, de imediato; ao apagar um perfil, os
--      pedidos já encerrados; e diariamente (pg_cron) os recusados há mais de 30 dias. Inclui as
--      notas do histórico e das notificações.
--   4. Vagas: uma vaga proposta reserva um lugar (não se propõem mais vagas do que lugares livres);
--      aceitar exige um lugar livre e, do lado da família, que o prazo de 48 h não tenha passado;
--      private.expirar_propostas devolve à lista as propostas fora de prazo (pg_cron, 15 em 15 min).
--   5. Avisos de vaga: só fichas publicadas e no máximo um aviso por família/instituição/24 h;
--      pedidos de visita repetidos não geram avisos e são limitados por dia.
--   6. Saídas registadas no mês corrente de Lisboa; frescura das vagas só pelo trigger dos quartos.
--   7. RPC painel_instituicao: dados internos da ficha só para o próprio dono.
-- =====================================================================================

-- ————————————————————————————————————————————————————————————————— 2. cópia do perfil

-- Só o que a instituição precisa para avaliar o pedido (é o que o painel do lar mostra).
-- orcamento_max e precisa_acordo_ss ficam: o painel do lar usa-os na análise de compatibilidade.
create or replace function private.snapshot_perfil(p_perfil public.perfis_cuidados)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'nome', p_perfil.nome,
    'idade', p_perfil.idade,
    'relacao', p_perfil.relacao,
    'genero', p_perfil.genero,
    'grau', p_perfil.grau,
    'necessidades', p_perfil.necessidades,
    'preferencias', p_perfil.preferencias,
    'quarto', p_perfil.quarto,
    'local_label', p_perfil.local_label,
    'orcamento_max', p_perfil.orcamento_max,
    'urgencia', p_perfil.urgencia,
    'precisa_acordo_ss', p_perfil.precisa_acordo_ss,
    'notas', p_perfil.notas
  ));
$$;

-- ————————————————————————————————————————————————————————————————— 3. minimização

-- Reduz pedidos ao mínimo: cópia do perfil → {nome, idade, minimizado_em}; contacto → {nome};
-- mensagem apagada; notas do histórico apagadas; nas notificações do pedido retira a nota do lar
-- (" Nota: …", que pode descrever a saúde da pessoa). Idempotente. Devolve o nº de pedidos minimizados.
create function private.minimizar_candidaturas(p_ids uuid[])
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
         mensagem = null
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

-- Retenção: pedidos encerrados (cancelados/recusados) há mais de p_dias. Corre no pg_cron
-- (como postgres; ver 20261012190600_agendamentos.sql). NÃO é invocável pela Data API.
create or replace function private.minimizar_candidaturas_encerradas(p_dias integer default 30)
returns integer
language sql
security definer
set search_path = ''
as $$
  select private.minimizar_candidaturas(array(
    select c.id from public.candidaturas c
     where c.estado in ('cancelada', 'recusada')
       and c.updated_at < now() - make_interval(days => greatest(p_dias, 0))
       and not (c.perfil_snapshot ? 'minimizado_em')
  ));
$$;

-- Ao apagar um perfil de cuidados: os pedidos JÁ ENCERRADOS (cancelados/recusados) desse perfil
-- são minimizados de imediato. Os pedidos ativos e aceites mantêm a cópia — é o que a interface
-- promete ("Os pedidos já enviados não são cancelados: as instituições mantêm a cópia que
-- receberam"): o consentimento foi dado pedido a pedido e retira-se cancelando cada pedido.
-- Se a conta inteira estiver a ser apagada, as candidaturas vão ser apagadas em cascata: nada a fazer.
create function private.perfis_cuidados_antes_de_apagar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.perfis_utilizador u where u.id = old.user_id) then
    perform private.minimizar_candidaturas(array(
      select c.id from public.candidaturas c
       where c.perfil_id = old.id and c.estado in ('cancelada', 'recusada')
    ));
  end if;
  return old;
end;
$$;

create trigger perfis_cuidados_minimizar
  before delete on public.perfis_cuidados
  for each row execute function private.perfis_cuidados_antes_de_apagar();

-- ————————————————————————————————————————————————————————————————— peças internas

-- Ocupa um lugar livre: do tipo preferido, senão de outro tipo com lugares (como no protótipo).
-- Devolve null se não houver nenhum. A frescura (atualizado_em) é renovada pelo trigger dos quartos.
create or replace function private.ocupar_lugar(p_instituicao_id text, p_preferido text)
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
  return v_tipo;
end;
$$;

-- Avisa as famílias em lista de espera e as que seguem a instituição com alerta.
-- Só fichas publicadas; no máximo um aviso de vaga por família e instituição em 24 horas
-- (impede usar os avisos para inundar/enganar quem segue a ficha). Devolve o nº de famílias avisadas.
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
         v_inst.id, l.id, '/familia'
    from (
      select distinct on (c.user_id) c.user_id, c.id, c.posicao
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

-- Define os lugares livres de um tipo de quarto (instituição já verificada e bloqueada).
create or replace function private.aplicar_vagas(p_instituicao_id text, p_tipo public.tipo_quarto, p_livres integer)
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
  -- mesmo sem alteração, o UPDATE renova a frescura (trigger quartos_frescura): é a confirmação do lar
  update public.quartos set livres = v_novo where id = v_q.id;
  if v_novo > v_q.livres then
    return private.avisar_nova_vaga(p_instituicao_id, p_tipo);
  end if;
  return 0;
end;
$$;

-- ————————————————————————————————————————————————————————————————— 1. lado da família

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
  -- dados de saúde só para fichas verificadas pela equipa EncontraLar e com um gestor que responda
  if v_inst.verificacao_estado <> 'verificado' or v_inst.owner_id is null then
    raise exception 'Esta instituição ainda não recebe pedidos pela plataforma (ficha por verificar ou sem gestor). Contacte-a diretamente.'
      using errcode = '22023';
  end if;
  -- contas e fichas de demonstração nunca se cruzam com as reais
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

  -- anti-spam: cancelar e voltar a pedir gera avisos à instituição
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
    -- pedido simultâneo: devolve o que ganhou a corrida
    select * into v_c from public.candidaturas c
     where c.user_id = v_uid and c.instituicao_id = v_inst.id and c.perfil_id = v_perfil.id
       and c.estado not in ('cancelada', 'recusada');
    return v_c;
  end;

  insert into public.candidatura_eventos (candidatura_id, estado, autor, autor_id)
  values (v_c.id, 'enviada', 'familia', v_uid);

  perform private.notificar(
    v_inst.owner_id, 'candidatura', 'Novo pedido de vaga',
    format('%s enviou um pedido para %s (%s anos).%s', v_conta.nome, v_perfil.nome, v_perfil.idade,
           case when p_visita_data is not null then ' Pediu também uma visita.' else '' end),
    v_inst.id, v_c.id, '/gestao'
  );
  return v_c;
end;
$$;

-- Pedir/alterar a visita. Repetir a mesma data e hora não faz nada; no máximo 3 pedidos por dia
-- e por pedido de vaga (cada um avisa a instituição).
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
  if v_c.estado in ('aceite', 'recusada', 'cancelada') then
    raise exception 'Este pedido já está concluído.' using errcode = '22023';
  end if;
  if (v_c.visita_data, v_c.visita_hora) is not distinct from (p_data, p_hora) then
    return v_c;   -- nada mudou: sem atualização nem aviso
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
      format('%s pediu uma visita para %s, às %s.', v_c.contacto ->> 'nome', private.data_extenso(p_data),
             to_char(p_hora, 'HH24:MI')),
      v_c.instituicao_id, v_c.id, '/gestao'
    );
  end if;
  return v_c;
end;
$$;

-- Cancelar = retirar o consentimento (RGPD art. 7.º, n.º 3): a instituição deixa de ver os dados
-- de saúde de imediato (fica só o nome e a idade, para o histórico do pedido).
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
  if v_c.estado in ('aceite', 'recusada', 'cancelada') then
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
  values (v_c.id, 'cancelada', 'familia', v_uid);

  perform private.minimizar_candidaturas(array[v_c.id]);
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id;

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

-- A família responde a uma vaga proposta. Aceitar exige que o prazo não tenha terminado e um lugar
-- livre (ocupa-o: do tipo preferido, se houver) e sai da lista; recusar mantém a posição.
create or replace function private.responder_vaga(p_candidatura_id uuid, p_aceitar boolean)
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
    if v_c.prazo_resposta < now() then
      raise exception 'O prazo para responder a esta vaga terminou. Contacte a instituição.' using errcode = '22023';
    end if;
    if private.ocupar_lugar(v_c.instituicao_id, v_c.perfil_snapshot ->> 'quarto') is null then
      raise exception 'Já não há lugar livre para aceitar esta vaga. Contacte a instituição.' using errcode = '22023';
    end if;
    update public.candidaturas
       set estado = 'aceite', posicao = null, prazo_resposta = null
     where id = v_c.id
    returning * into v_c;
    perform private.sair_da_lista(v_c.instituicao_id, v_posicao);
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

-- ————————————————————————————————————————————————————————————————— 4. lado da instituição

-- Muda o estado de um pedido (só o dono, só transições permitidas), com nota para a família.
--   vaga_proposta → prazo de 48 h; cada proposta pendente reserva um lugar livre
--   aceite        → ocupa um lugar livre (erro se não houver)
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
  v_inst := private.exigir_dono(v_c.instituicao_id);   -- verifica e bloqueia a instituição
  select * into v_c from public.candidaturas c where c.id = p_candidatura_id for update;

  if v_c.estado = p_estado then
    return v_c;   -- nada a fazer (como no protótipo)
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
         prazo_resposta = case when p_estado = 'vaga_proposta' then now() + interval '48 hours' end
   where id = v_c.id
  returning * into v_c;

  if v_estava and not v_fica then
    perform private.sair_da_lista(v_inst.id, v_posicao_antiga);
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

-- Propostas de vaga cujo prazo de 48 h terminou: voltam à lista de espera (mesma posição), com
-- registo no histórico e aviso às duas partes. Corre no pg_cron (como postgres). Bloqueia
-- instituição → candidatura, pela mesma ordem das RPC. Devolve o nº de propostas expiradas.
create function private.expirar_propostas()
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
      v_inst.id, v_c.id, '/familia'
    );
    if v_inst.owner_id is not null then
      perform private.notificar(
        v_inst.owner_id, 'candidatura', 'Proposta sem resposta',
        format('%s não respondeu no prazo à vaga proposta para %s. Pode propô-la à pessoa seguinte da lista.',
               v_c.contacto ->> 'nome', v_c.perfil_snapshot ->> 'nome'),
        v_inst.id, v_c.id, '/gestao'
      );
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Saída de um residente: +1 lugar livre, regista a saída no mês corrente (Lisboa) e avisa.
create or replace function private.registar_vaga_libertada(p_instituicao_id text, p_tipo public.tipo_quarto)
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
  values (p_instituicao_id, date_trunc('month', now() at time zone 'Europe/Lisbon')::date, 1)
  on conflict (instituicao_id, mes) do update set saidas = s.saidas + 1;

  return private.aplicar_vagas(p_instituicao_id, p_tipo, v_q.livres + 1);
end;
$$;

-- ————————————————————————————————————————————————————————————————— 7. painel do dono

-- Dados internos da ficha do utilizador autenticado (vazio se não gerir nenhuma).
create function private.painel_instituicao()
returns table (
  id text,
  publicado boolean,
  verificacao_estado public.estado_verificacao,
  visualizacoes_30d integer,
  lista_espera_offline integer,
  lista_espera_online integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select i.id, i.publicado, i.verificacao_estado, i.visualizacoes_30d, i.lista_espera_offline, i.lista_espera_online
    from public.instituicoes i
   where i.owner_id = (select auth.uid());
$$;

create function public.painel_instituicao()
returns table (
  id text,
  publicado boolean,
  verificacao_estado public.estado_verificacao,
  visualizacoes_30d integer,
  lista_espera_offline integer,
  lista_espera_online integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.painel_instituicao();
$$;
comment on function public.painel_instituicao() is
  'Dono (lar): id da instituição que gere e dados internos (publicação, verificação, visualizações, lista de espera offline/plataforma).';

-- ————————————————————————————————————————————————————————————————— privilégios de execução

revoke all on function
  private.minimizar_candidaturas(uuid[]),
  private.perfis_cuidados_antes_de_apagar(),
  private.expirar_propostas(),
  private.painel_instituicao(),
  public.painel_instituicao()
from public, anon, authenticated;

-- a manutenção corre no pg_cron como postgres; a service_role não a chama (private não está na
-- Data API), por isso não fica com privilégio que sugira o contrário
revoke all on function private.minimizar_candidaturas_encerradas(integer) from public, anon, authenticated, service_role;

grant execute on function private.painel_instituicao(), public.painel_instituicao() to authenticated, service_role;
