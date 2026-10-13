-- =====================================================================================
-- EncontraLar — equipa de terreno e modalidade das instituições privadas (decisões de 13/10/2026,
-- docs/MODELO-NEGOCIO.md), parte 1: valores novos dos enums.
--
-- Ficheiro à parte pela mesma razão de 20261012190700: um valor acrescentado com ALTER TYPE … ADD
-- VALUE só pode ser usado DEPOIS de a transação que o criou terminar (cada migração corre numa
-- transação). As colunas, funções e políticas que usam 'equipa' e 'incluida' estão em
-- 20261013100100_equipa_modalidade.sql.
-- =====================================================================================

-- equipa de terreno do EncontraLar (conta interna): visita as instituições, verifica a licença e as
-- instalações e regista a adesão. Só um administrador atribui este papel (app_metadata); nunca no registo.
alter type public.role_utilizador add value if not exists 'equipa';

-- lar privado com mensalidade: a entrada não paga taxa, está incluída na mensalidade
alter type public.taxa_entrada add value if not exists 'incluida' after 'aplicavel';
