-- =====================================================================================
-- EncontraLar — modelo de negócio (docs/MODELO-NEGOCIO.md), parte 1: valores novos dos enums.
--
-- Ficheiro à parte porque um valor acrescentado com ALTER TYPE … ADD VALUE só pode ser usado
-- DEPOIS de a transação que o criou terminar (cada migração corre numa transação: supabase db
-- push, apply_migration do MCP e os testes em PGlite). As políticas, restrições e funções que
-- usam 'profissional' e 'admitida' estão em 20261012190800_modelo_negocio.sql.
-- =====================================================================================

-- assistente social (hospital, centro de saúde, autarquia…): gere casos e envia o mesmo pedido a
-- várias instituições
alter type public.role_utilizador add value if not exists 'profissional';

-- a pessoa entrou na instituição (confirmado pelo lar e/ou pela família) — base da taxa por entrada
alter type public.estado_candidatura add value if not exists 'admitida' after 'aceite';
