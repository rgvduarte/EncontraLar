-- =====================================================================================
-- EncontraLar — faturação: tarefas agendadas (pg_cron → pg_net → Edge Function faturar-mes), parte 2 de
-- 20261013120000_faturacao.sql. Plano v1, secção A2.
--
--   * encontralar-faturar-diario        (06:13 UTC, todos os dias) → faturar-mes { fase: 'diario' }:
--     FT das entradas faturáveis, fila de documentos, débitos SEPA vencidos, reconciliação das mensalidades;
--   * encontralar-cobrar-mes            (07:07 UTC, dia 1)         → faturar-mes { fase: 'cobranca' }:
--     uma cobrança Stripe por lar (depois da diária, para incluir as FT emitidas no próprio dia 1);
--   * encontralar-limpar-eventos-stripe (03:29 UTC, todos os dias) → apaga os eventos do webhook já aplicados
--     há mais de 90 dias.
--
-- O pedido HTTP leva o segredo do cron (encontralar_segredo_cron, no Vault) no cabeçalho x-encontralar-cron —
-- nunca a chave de serviço: o pg_net guarda os cabeçalhos na sua fila, e o segredo do cron só dispara trabalho
-- idempotente. O URL do projeto também vem do Vault (encontralar_url_projeto) e tem de ser
-- https://<ref>.supabase.co.
--
-- Sem pg_net, sem Vault ou sem os segredos, a tarefa não faz nada (só um aviso): o projeto continua a migrar e a
-- correr; configure-os como em docs/SUPABASE.md (secção 15). Idempotente: voltar a agendar substitui.
-- =====================================================================================

do $pgnet$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_net')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_net;
  end if;
end;
$pgnet$;

-- Chama a Edge Function faturar-mes (pg_net, assíncrono). Devolve o id do pedido do pg_net, ou null (com um aviso)
-- se faltar o pg_net, o Vault ou os segredos. Um URL que não seja https://<ref>.supabase.co é recusado (erro: fica
-- no histórico do pg_cron). Só postgres (pg_cron) a executa.
create function private.invocar_faturacao(p_fase text)
returns bigint
language plpgsql
set search_path = ''
as $$
declare
  v_url text;
  v_segredo text;
  v_id bigint;
begin
  if p_fase is null or p_fase not in ('diario', 'cobranca') then
    raise exception 'Fase desconhecida: %.', coalesce(p_fase, '(nenhuma)') using errcode = '22023';
  end if;
  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'pg_net indisponível: a faturação (%) não foi chamada.', p_fase;
    return null;
  end if;
  if to_regclass('vault.decrypted_secrets') is null then
    raise notice 'Vault indisponível: a faturação (%) não foi chamada.', p_fase;
    return null;
  end if;
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_url using 'encontralar_url_projeto';
  execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1' into v_segredo using 'encontralar_segredo_cron';
  if nullif(btrim(coalesce(v_url, '')), '') is null or nullif(btrim(coalesce(v_segredo, '')), '') is null then
    raise notice 'Faltam os segredos encontralar_url_projeto e encontralar_segredo_cron no Vault: a faturação (%) não foi chamada.', p_fase;
    return null;
  end if;
  v_url := btrim(v_url);
  if v_url !~ '^https://[a-z0-9]+\.supabase\.co/?$' then
    raise exception 'URL do projeto inválido no Vault (encontralar_url_projeto): tem de ser https://<ref>.supabase.co.'
      using errcode = '22023';
  end if;
  execute 'select net.http_post(url := $1, body := $2, params := $3, headers := $4, timeout_milliseconds := $5)'
     into v_id
    using rtrim(v_url, '/') || '/functions/v1/faturar-mes',
          jsonb_build_object('fase', p_fase),
          '{}'::jsonb,
          jsonb_build_object('Content-Type', 'application/json', 'x-encontralar-cron', btrim(v_segredo)),
          5000;
  return v_id;
end;
$$;
comment on function private.invocar_faturacao(text) is
  'pg_cron: chama faturar-mes (diario | cobranca) por pg_net com o segredo do cron do Vault; sem pg_net/Vault/segredos não faz nada.';

-- Retenção dos eventos do webhook: apaga os aplicados há mais de p_dias (os que falharam ficam para a equipa).
create function private.limpar_stripe_eventos(p_dias integer default 90)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.stripe_eventos e
   where e.processado_em is not null
     and e.processado_em < now() - make_interval(days => greatest(coalesce(p_dias, 90), 1));
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function private.invocar_faturacao(text), private.limpar_stripe_eventos(integer)
  from public, anon, authenticated, service_role;

do $agendar$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron indisponível: agende private.invocar_faturacao(''diario''), private.invocar_faturacao(''cobranca'') e private.limpar_stripe_eventos(90) à mão.';
    return;
  end if;
  perform cron.schedule('encontralar-faturar-diario', '13 6 * * *', 'select private.invocar_faturacao(''diario'')');
  perform cron.schedule('encontralar-cobrar-mes', '7 7 1 * *', 'select private.invocar_faturacao(''cobranca'')');
  perform cron.schedule('encontralar-limpar-eventos-stripe', '29 3 * * *', 'select private.limpar_stripe_eventos(90)');
end;
$agendar$;
