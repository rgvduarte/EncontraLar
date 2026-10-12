-- =====================================================================================
-- EncontraLar — trabalhos agendados (pg_cron), que correm como postgres:
--   * encontralar-expirar-propostas  (de 15 em 15 min) → private.expirar_propostas()
--     propostas de vaga sem resposta em 48 h voltam à lista de espera e as partes são avisadas;
--   * encontralar-minimizar-pedidos  (diário, 03:17 UTC)  → private.minimizar_candidaturas_encerradas(30)
--     pedidos recusados/cancelados há mais de 30 dias ficam só com nome e idade (RGPD art. 5.º, n.º 1, e)).
--
-- No Supabase o pg_cron está disponível (Database → Extensions); esta migração ativa-o se
-- ainda não estiver ativo. Onde não existir (ex.: Postgres local sem a extensão) apenas avisa —
-- nesse caso agende à mão (docs/SUPABASE.md, "Trabalhos agendados").
-- Idempotente: voltar a agendar com o mesmo nome substitui o trabalho.
-- =====================================================================================

do $agendar$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
  end if;

  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron indisponível: agende private.expirar_propostas() e private.minimizar_candidaturas_encerradas(30) à mão.';
    return;
  end if;

  perform cron.schedule(
    'encontralar-expirar-propostas',
    '*/15 * * * *',
    'select private.expirar_propostas()'
  );
  perform cron.schedule(
    'encontralar-minimizar-pedidos',
    '17 3 * * *',
    'select private.minimizar_candidaturas_encerradas(30)'
  );
end;
$agendar$;
