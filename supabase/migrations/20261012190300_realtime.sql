-- =====================================================================================
-- EncontraLar — Realtime (Postgres Changes) para substituir a sincronização entre separadores
-- do protótipo (evento "storage" do localStorage):
--   * notificacoes  → sino/novidades da família e do lar em direto;
--   * candidaturas  → painel de pedidos (lar) e estado dos pedidos (família);
--   * quartos       → vagas livres em direto na pesquisa e na ficha.
-- O Realtime aplica a RLS de cada subscritor (usa o JWT da sessão), por isso só chegam as
-- linhas que esse utilizador já podia ler. Idempotente e tolerante à ausência da publicação.
-- =====================================================================================

do $$
declare
  v_tabela text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'Publicação supabase_realtime inexistente — Realtime não configurado.';
    return;
  end if;
  foreach v_tabela in array array['notificacoes', 'candidaturas', 'quartos'] loop
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_tabela
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_tabela);
    end if;
  end loop;
end;
$$;
