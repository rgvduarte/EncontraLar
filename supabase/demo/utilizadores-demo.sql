-- =====================================================================================
-- EncontraLar — ligar as contas de demonstração aos dados de demonstração. FICHEIRO GERADO.
-- Origem: src/data/seed.ts via scripts/gerar-seed-sql.ts → `npm run db:seed-sql`.
--
-- SÓ PARA BASES DE DEMONSTRAÇÃO (local, ramo do Supabase ou projeto à parte) — NUNCA em produção:
-- as contas lar@, familia@, social@ e equipa@ têm palavra-passe pública (mostrada no ecrã de entrada).
--
-- Pré-requisitos:
--   1. migrações aplicadas e supabase/seed.sql carregado;
--   2. as 12 contas de supabase/demo/contas-demo.json criadas pela Auth Admin API
--      (scripts/criar-contas-demo.mjs — NUNCA por SQL em auth.users), com o e-mail confirmado e o
--      papel em app_metadata. Uma conta registada por outra pessoa com o mesmo e-mail não tem
--      app_metadata.role e é recusada: o script não entrega a ficha a quem só conhece o e-mail.
-- Corre uma única vez (sai sem fazer nada se já tiver sido aplicado). Executar como postgres.
-- =====================================================================================

do $demo$
declare
  v_familia uuid;
  v_lar uuid;
  v_profissional uuid;
  v_equipa_sofia uuid;
  v_fam_0 uuid;
  v_fam_1 uuid;
  v_fam_2 uuid;
  v_fam_3 uuid;
  v_fam_4 uuid;
  v_fam_5 uuid;
  v_fam_6 uuid;
  v_fam_7 uuid;
  v_invalidas text;
begin
  if not exists (select 1 from public.instituicoes where id = 'lar-jardins-do-douro' and demonstracao) then
    raise exception 'Carregue primeiro supabase/seed.sql: a ficha de demonstração lar-jardins-do-douro não existe.';
  end if;

  -- contas: e-mail confirmado e papel definido pelo administrador (app_metadata), nunca só o e-mail
  select string_agg(c.email || ' (' || c.role || ')', ', ' order by c.email) into v_invalidas
    from (values
      ('familia@exemplo.pt', 'familia'),
      ('lar@exemplo.pt', 'lar'),
      ('social@exemplo.pt', 'profissional'),
      ('equipa@exemplo.pt', 'equipa'),
      ('rui.sousa@exemplo.pt', 'familia'),
      ('sandra.lopes@exemplo.pt', 'familia'),
      ('carlos.pinto@exemplo.pt', 'familia'),
      ('patricia.costa@exemplo.pt', 'familia'),
      ('nuno.ribeiro@exemplo.pt', 'familia'),
      ('joana.nogueira@exemplo.pt', 'familia'),
      ('teresa.matos@exemplo.pt', 'familia'),
      ('luis.barros@exemplo.pt', 'familia')
    ) as c (email, role)
   where not exists (
     select 1 from auth.users u
      where lower(u.email) = c.email and u.raw_app_meta_data ->> 'role' = c.role and u.email_confirmed_at is not null
   );
  if v_invalidas is not null then
    raise exception 'Contas de demonstração em falta ou inválidas (e-mail por confirmar ou sem app_metadata.role): %. Crie-as com scripts/criar-contas-demo.mjs — ver docs/SUPABASE.md.', v_invalidas;
  end if;
  v_familia := (select id from auth.users where lower(email) = 'familia@exemplo.pt');
  v_lar := (select id from auth.users where lower(email) = 'lar@exemplo.pt');
  v_profissional := (select id from auth.users where lower(email) = 'social@exemplo.pt');
  v_equipa_sofia := (select id from auth.users where lower(email) = 'equipa@exemplo.pt');
  v_fam_0 := (select id from auth.users where lower(email) = 'rui.sousa@exemplo.pt');
  v_fam_1 := (select id from auth.users where lower(email) = 'sandra.lopes@exemplo.pt');
  v_fam_2 := (select id from auth.users where lower(email) = 'carlos.pinto@exemplo.pt');
  v_fam_3 := (select id from auth.users where lower(email) = 'patricia.costa@exemplo.pt');
  v_fam_4 := (select id from auth.users where lower(email) = 'nuno.ribeiro@exemplo.pt');
  v_fam_5 := (select id from auth.users where lower(email) = 'joana.nogueira@exemplo.pt');
  v_fam_6 := (select id from auth.users where lower(email) = 'teresa.matos@exemplo.pt');
  v_fam_7 := (select id from auth.users where lower(email) = 'luis.barros@exemplo.pt');

  if exists (select 1 from public.instituicoes where id = 'lar-jardins-do-douro' and owner_id is not null and owner_id <> v_lar) then
    raise exception 'A ficha lar-jardins-do-douro já tem outro gestor — nada foi alterado.';
  end if;
  if exists (select 1 from public.perfis_cuidados where id = md5('encontralar:p-maria-carmo')::uuid) then
    raise notice 'Dados de demonstração já ligados — nada a fazer.';
    return;
  end if;

  -- contas de demonstração: só interagem com fichas de demonstração (o papel já veio do app_metadata)
  update public.perfis_utilizador set demonstracao = true, nome = 'Ana Ferreira', telefone = '912 000 101', organizacao = null where id = v_familia;
  update public.perfis_utilizador set demonstracao = true, nome = 'Helena Marques', telefone = '220 000 042', organizacao = null where id = v_lar;
  update public.perfis_utilizador set demonstracao = true, nome = 'Marta Correia', telefone = '225 000 310', organizacao = '{"nome":"Hospital de Vale Formoso","tipo":"hospital","servico":"Serviço Social"}'::jsonb where id = v_profissional;
  update public.perfis_utilizador set demonstracao = true, nome = 'Sofia Ramos', telefone = '910 000 520', organizacao = null where id = v_equipa_sofia;
  update public.perfis_utilizador set demonstracao = true, nome = 'Rui Sousa', telefone = '936 000 214', organizacao = null where id = v_fam_0;
  update public.perfis_utilizador set demonstracao = true, nome = 'Sandra Lopes', telefone = '917 000 388', organizacao = null where id = v_fam_1;
  update public.perfis_utilizador set demonstracao = true, nome = 'Carlos Pinto', telefone = '965 000 127', organizacao = null where id = v_fam_2;
  update public.perfis_utilizador set demonstracao = true, nome = 'Patrícia Costa', telefone = '914 000 950', organizacao = null where id = v_fam_3;
  update public.perfis_utilizador set demonstracao = true, nome = 'Nuno Ribeiro', telefone = '926 000 433', organizacao = null where id = v_fam_4;
  update public.perfis_utilizador set demonstracao = true, nome = 'Joana Nogueira', telefone = '938 000 612', organizacao = null where id = v_fam_5;
  update public.perfis_utilizador set demonstracao = true, nome = 'Teresa Matos', telefone = '916 000 274', organizacao = null where id = v_fam_6;
  update public.perfis_utilizador set demonstracao = true, nome = 'Luís Barros', telefone = '927 000 851', organizacao = null where id = v_fam_7;

  -- a gestora passa a ser dona do lar de demonstração; a lista de espera "offline" desconta
  -- as inscrições que agora existem na plataforma
  update public.instituicoes set owner_id = v_lar, lista_espera_offline = 10 where id = 'lar-jardins-do-douro';

  -- perfis de cuidados (dados de saúde FICTÍCIOS)
  insert into public.perfis_cuidados (id, user_id, nome, idade, relacao, genero, grau, necessidades, preferencias, quarto,
    local_label, local_lat, local_lng, raio_km, orcamento_max, urgencia, precisa_acordo_ss, notas, created_at, updated_at)
  values
  (md5('encontralar:p-maria-carmo')::uuid, v_familia, 'Maria do Carmo Ferreira', 84, 'Mãe', 'F', 'moderada', array['demencia', 'fisioterapia', 'diabetes']::text[], array['jardim', 'visitas_livres']::text[], 'individual', 'Porto', 41.1579, -8.6291, 15, 2000, '1-3meses', false, 'Diagnóstico de Alzheimer em fase inicial há dois anos. Diabetes tipo 2 controlada com comprimidos. Gosta muito de música e de estar ao ar livre.', now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-fam-0')::uuid, v_fam_0, 'Joaquim Sousa', 88, 'Pai', 'M', 'grave', array['acamados', 'enfermagem24h', 'diabetes']::text[], '{}'::text[], 'indiferente', 'Porto', 41.1579, -8.6291, 15, 2100, 'imediata', false, 'Internado após AVC. Alta hospitalar prevista para a próxima semana.', now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-fam-1')::uuid, v_fam_1, 'Albertina Lopes', 81, 'Mãe', 'F', 'moderada', array['demencia', 'fisioterapia']::text[], array['jardim']::text[], 'individual', 'Porto', 41.1579, -8.6291, 15, 1900, '1-3meses', false, null, now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-fam-2')::uuid, v_fam_2, 'Manuel Pinto', 86, 'Pai', 'M', 'ligeira', array['diabetes']::text[], array['quarto_wc']::text[], 'casal', 'Porto', 41.1579, -8.6291, 15, 1800, '3-6meses', false, 'Pretende quarto de casal com a esposa, Rosa Pinto (83 anos, autónoma).', now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-fam-3')::uuid, v_fam_3, 'Fernanda Costa', 79, 'Mãe', 'F', 'ligeira', array['fisioterapia']::text[], '{}'::text[], 'duplo', 'Porto', 41.1579, -8.6291, 15, 1700, '3-6meses', false, null, now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-fam-4')::uuid, v_fam_4, 'António Ribeiro', 91, 'Avô', 'M', 'moderada', array['enfermagem24h', 'oxigenio']::text[], '{}'::text[], 'individual', 'Porto', 41.1579, -8.6291, 15, 2300, 'planeamento', false, null, now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-fam-5')::uuid, v_fam_5, 'Beatriz Nogueira', 87, 'Avó', 'F', 'moderada', array['demencia']::text[], '{}'::text[], 'duplo', 'Porto', 41.1579, -8.6291, 15, 2000, 'imediata', false, null, now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-fam-6')::uuid, v_fam_6, 'Henrique Matos', 85, 'Pai', 'M', 'moderada', array['demencia', 'fisioterapia']::text[], '{}'::text[], 'individual', 'Porto', 41.1579, -8.6291, 15, 2100, '1-3meses', false, null, now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-fam-7')::uuid, v_fam_7, 'Olívia Barros', 90, 'Mãe', 'F', 'grave', array['acamados', 'enfermagem24h']::text[], '{}'::text[], 'duplo', 'Porto', 41.1579, -8.6291, 15, 2400, 'imediata', false, null, now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-pro-1')::uuid, v_profissional, 'Albano Teixeira', 83, 'Utente', 'M', 'grave', array['acamados', 'enfermagem24h']::text[], '{}'::text[], 'indiferente', 'Porto — Paranhos', 41.1705, -8.6045, 20, 1800, 'imediata', false, 'Internado após fratura do colo do fémur. Vive sozinho; a filha está emigrada.', now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-pro-2')::uuid, v_profissional, 'Rosa Almeida', 79, 'Utente', 'F', 'moderada', array['demencia']::text[], '{}'::text[], 'duplo', 'Porto', 41.1579, -8.6291, 15, 900, 'imediata', true, null, now() - interval '2592000 seconds', now() - interval '432000 seconds'),
  (md5('encontralar:p-pro-3')::uuid, v_profissional, 'José Barbosa', 90, 'Utente', 'M', 'ligeira', array['diabetes', 'fisioterapia']::text[], '{}'::text[], 'indiferente', 'Matosinhos', 41.1844, -8.6963, 15, 1500, 'imediata', false, null, now() - interval '2592000 seconds', now() - interval '432000 seconds');

  -- casos da assistente social (consentimento registado na criação do caso)
  insert into public.casos (id, profissional_id, perfil_id, referencia, alta_prevista, consentimento_em, estado, created_at, updated_at)
  values
  (md5('encontralar:caso-1')::uuid, v_profissional, md5('encontralar:p-pro-1')::uuid, 'SS-2026-0418', current_date + 4, now() - interval '172800 seconds', 'aberto', now() - interval '172800 seconds', now() - interval '43200 seconds'),
  (md5('encontralar:caso-2')::uuid, v_profissional, md5('encontralar:p-pro-2')::uuid, 'SS-2026-0377', current_date - 20, now() - interval '3024000 seconds', 'colocado', now() - interval '3024000 seconds', now() - interval '1728000 seconds'),
  (md5('encontralar:caso-3')::uuid, v_profissional, md5('encontralar:p-pro-3')::uuid, 'SS-2026-0431', current_date + 9, now() - interval '17280 seconds', 'aberto', now() - interval '17280 seconds', now() - interval '17280 seconds');

  -- candidaturas (com consentimento registado na data de envio), encaminhamentos, entradas e histórico
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-fam-0')::uuid, 'lar-jardins-do-douro', v_fam_0, p.id, private.snapshot_perfil(p), '{"nome":"Rui Sousa","email":"rui.sousa@exemplo.pt","telefone":"936 000 214"}'::jsonb,
    'enviada', null, 'Boa tarde. O meu pai está internado e vai ter alta na próxima semana. Precisamos com alguma urgência de uma vaga com enfermagem permanente. Podemos visitar a qualquer momento.',
    null, null, null,
    null, now() - interval '25920 seconds', now() - interval '25920 seconds', now() - interval '25920 seconds',
    'familia', null, null, null, null,
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-fam-0')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-0')::uuid, 'enviada', null, 'familia', v_fam_0, now() - interval '25920 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-fam-1')::uuid, 'lar-jardins-do-douro', v_fam_1, p.id, private.snapshot_perfil(p), '{"nome":"Sandra Lopes","email":"sandra.lopes@exemplo.pt","telefone":"917 000 388"}'::jsonb,
    'em_analise', null, 'Gostaríamos de conhecer a unidade de demências. A minha mãe ainda é bastante ativa e gosta de jardinagem.',
    current_date + 4, '15:00', 'pedida',
    null, now() - interval '259200 seconds', now() - interval '259200 seconds', now() - interval '86400 seconds',
    'familia', null, null, null, now() - interval '86400 seconds',
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-fam-1')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-1')::uuid, 'enviada', null, 'familia', v_fam_1, now() - interval '259200 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-1')::uuid, 'em_analise', null, 'lar', v_lar, now() - interval '86400 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-fam-2')::uuid, 'lar-jardins-do-douro', v_fam_2, p.id, private.snapshot_perfil(p), '{"nome":"Carlos Pinto","email":"carlos.pinto@exemplo.pt","telefone":"965 000 127"}'::jsonb,
    'lista_espera', 2, 'Os meus pais querem continuar juntos. Procuramos quarto de casal.',
    null, null, null,
    null, now() - interval '3283200 seconds', now() - interval '3283200 seconds', now() - interval '2851200 seconds',
    'familia', null, null, null, now() - interval '3110400 seconds',
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-fam-2')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-2')::uuid, 'enviada', null, 'familia', v_fam_2, now() - interval '3283200 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-2')::uuid, 'em_analise', null, 'lar', v_lar, now() - interval '3110400 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-2')::uuid, 'lista_espera', 'Perfil adequado. Inscrito(a) na lista de espera.', 'lar', v_lar, now() - interval '2851200 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-fam-3')::uuid, 'lar-jardins-do-douro', v_fam_3, p.id, private.snapshot_perfil(p), '{"nome":"Patrícia Costa","email":"patricia.costa@exemplo.pt","telefone":"914 000 950"}'::jsonb,
    'lista_espera', 4, 'A minha mãe vive sozinha e já teve duas quedas este ano.',
    null, null, null,
    null, now() - interval '5270400 seconds', now() - interval '5270400 seconds', now() - interval '4838400 seconds',
    'familia', null, null, null, now() - interval '5097600 seconds',
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-fam-3')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-3')::uuid, 'enviada', null, 'familia', v_fam_3, now() - interval '5270400 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-3')::uuid, 'em_analise', null, 'lar', v_lar, now() - interval '5097600 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-3')::uuid, 'lista_espera', 'Perfil adequado. Inscrito(a) na lista de espera.', 'lar', v_lar, now() - interval '4838400 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-fam-4')::uuid, 'lar-jardins-do-douro', v_fam_4, p.id, private.snapshot_perfil(p), '{"nome":"Nuno Ribeiro","email":"nuno.ribeiro@exemplo.pt","telefone":"926 000 433"}'::jsonb,
    'lista_espera', 6, 'Inscrição preventiva. O meu avô ainda está em casa com apoio domiciliário.',
    null, null, null,
    null, now() - interval '8208000 seconds', now() - interval '8208000 seconds', now() - interval '7776000 seconds',
    'familia', null, null, null, now() - interval '8035200 seconds',
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-fam-4')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-4')::uuid, 'enviada', null, 'familia', v_fam_4, now() - interval '8208000 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-4')::uuid, 'em_analise', null, 'lar', v_lar, now() - interval '8035200 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-4')::uuid, 'lista_espera', 'Perfil adequado. Inscrito(a) na lista de espera.', 'lar', v_lar, now() - interval '7776000 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-fam-5')::uuid, 'lar-jardins-do-douro', v_fam_5, p.id, private.snapshot_perfil(p), '{"nome":"Joana Nogueira","email":"joana.nogueira@exemplo.pt","telefone":"938 000 612"}'::jsonb,
    'aceite', null, 'Muito obrigada pela rapidez na resposta.',
    null, null, null,
    null, now() - interval '2073600 seconds', now() - interval '2073600 seconds', now() - interval '1728000 seconds',
    'familia', null, null, null, now() - interval '1900800 seconds',
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-fam-5')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-5')::uuid, 'enviada', null, 'familia', v_fam_5, now() - interval '2073600 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-5')::uuid, 'em_analise', null, 'lar', v_lar, now() - interval '1900800 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-5')::uuid, 'vaga_proposta', null, 'lar', v_lar, now() - interval '1814400 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-5')::uuid, 'aceite', 'Entrada a 1 do próximo mês.', 'lar', v_lar, now() - interval '1728000 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-fam-6')::uuid, 'lar-jardins-do-douro', v_fam_6, p.id, private.snapshot_perfil(p), '{"nome":"Teresa Matos","email":"teresa.matos@exemplo.pt","telefone":"916 000 274"}'::jsonb,
    'admitida', null, 'O meu pai precisa de acompanhamento na memória e gosta muito de jardim.',
    null, null, null,
    null, now() - interval '8294400 seconds', now() - interval '8294400 seconds', now() - interval '6030720 seconds',
    'familia', null, null, null, now() - interval '8121600 seconds',
    current_date - 70, now() - interval '6030720 seconds', now() - interval '5961600 seconds', 'aplicavel'
  from public.perfis_cuidados p where p.id = md5('encontralar:p-fam-6')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-6')::uuid, 'enviada', null, 'familia', v_fam_6, now() - interval '8294400 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-6')::uuid, 'em_analise', null, 'lar', v_lar, now() - interval '8121600 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-6')::uuid, 'vaga_proposta', null, 'lar', v_lar, now() - interval '8035200 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-6')::uuid, 'aceite', null, 'lar', v_lar, now() - interval '7948800 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-6')::uuid, 'admitida', 'Entrada registada pela instituição.', 'lar', v_lar, now() - interval '6030720 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-fam-7')::uuid, 'lar-jardins-do-douro', v_fam_7, p.id, private.snapshot_perfil(p), '{"nome":"Luís Barros","email":"luis.barros@exemplo.pt","telefone":"927 000 851"}'::jsonb,
    'admitida', null, 'A minha mãe teve alta do hospital e precisa de cuidados permanentes.',
    null, null, null,
    null, now() - interval '3456000 seconds', now() - interval '3456000 seconds', now() - interval '1019520 seconds',
    'familia', null, null, null, now() - interval '3283200 seconds',
    current_date - 12, now() - interval '1019520 seconds', null, 'aplicavel'
  from public.perfis_cuidados p where p.id = md5('encontralar:p-fam-7')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-7')::uuid, 'enviada', null, 'familia', v_fam_7, now() - interval '3456000 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-7')::uuid, 'em_analise', null, 'lar', v_lar, now() - interval '3283200 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-7')::uuid, 'vaga_proposta', null, 'lar', v_lar, now() - interval '3196800 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-7')::uuid, 'aceite', null, 'lar', v_lar, now() - interval '3110400 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-fam-7')::uuid, 'admitida', 'Entrada registada pela instituição.', 'lar', v_lar, now() - interval '1019520 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-ana-1')::uuid, 'lar-jardins-do-douro', v_familia, p.id, private.snapshot_perfil(p), '{"nome":"Ana Ferreira","email":"familia@exemplo.pt","telefone":"912 000 101"}'::jsonb,
    'lista_espera', 3, 'A minha mãe tem Alzheimer em fase inicial e gostaríamos muito que pudesse ficar perto de nós, em Paranhos.',
    null, null, null,
    null, now() - interval '1641600 seconds', now() - interval '1641600 seconds', now() - interval '1296000 seconds',
    'familia', null, null, null, now() - interval '1468800 seconds',
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-maria-carmo')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-ana-1')::uuid, 'enviada', null, 'familia', v_familia, now() - interval '1641600 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-ana-1')::uuid, 'em_analise', null, 'lar', v_lar, now() - interval '1468800 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-ana-1')::uuid, 'lista_espera', 'Perfil adequado à unidade de demências. Inscrita na lista de espera.', 'lar', v_lar, now() - interval '1296000 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-ana-2')::uuid, 'lar-lar-residencial-rainha-santa', v_familia, p.id, private.snapshot_perfil(p), '{"nome":"Ana Ferreira","email":"familia@exemplo.pt","telefone":"912 000 101"}'::jsonb,
    'em_analise', null, 'Gostaria de visitar as instalações com o meu irmão.',
    current_date + 5, '11:00', 'confirmada',
    null, now() - interval '518400 seconds', now() - interval '518400 seconds', now() - interval '86400 seconds',
    'familia', null, null, null, now() - interval '86400 seconds',
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-maria-carmo')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-ana-2')::uuid, 'enviada', null, 'familia', v_familia, now() - interval '518400 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-ana-2')::uuid, 'em_analise', 'Visita confirmada.', 'lar', null, now() - interval '86400 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-pro-1')::uuid, 'lar-jardins-do-douro', v_profissional, p.id, private.snapshot_perfil(p), '{"nome":"Marta Correia (Hospital de Vale Formoso · Serviço Social)","email":"social@exemplo.pt","telefone":"225 000 310"}'::jsonb,
    'enviada', null, 'Utente com alta clínica prevista para esta semana. Precisa de enfermagem permanente. Podemos enviar o relatório clínico depois de aceitarem o pedido.',
    null, null, null,
    null, now() - interval '43200 seconds', now() - interval '43200 seconds', now() - interval '43200 seconds',
    'profissional', md5('encontralar:caso-1')::uuid, 'Hospital de Vale Formoso · Serviço Social', current_date + 4, null,
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-pro-1')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-1')::uuid, 'enviada', 'Encaminhado por Hospital de Vale Formoso · Serviço Social.', 'profissional', v_profissional, now() - interval '43200 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-pro-2')::uuid, 'lar-centro-social-fonte-clara', v_profissional, p.id, private.snapshot_perfil(p), '{"nome":"Marta Correia (Hospital de Vale Formoso · Serviço Social)","email":"social@exemplo.pt","telefone":"225 000 310"}'::jsonb,
    'em_analise', null, null,
    null, null, null,
    null, now() - interval '43200 seconds', now() - interval '43200 seconds', now() - interval '17280 seconds',
    'profissional', md5('encontralar:caso-1')::uuid, 'Hospital de Vale Formoso · Serviço Social', current_date + 4, now() - interval '17280 seconds',
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-pro-1')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-2')::uuid, 'enviada', 'Encaminhado por Hospital de Vale Formoso · Serviço Social.', 'profissional', v_profissional, now() - interval '43200 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-2')::uuid, 'em_analise', 'Vamos ligar amanhã de manhã.', 'lar', null, now() - interval '17280 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-pro-3')::uuid, 'lar-lar-residencial-rainha-santa', v_profissional, p.id, private.snapshot_perfil(p), '{"nome":"Marta Correia (Hospital de Vale Formoso · Serviço Social)","email":"social@exemplo.pt","telefone":"225 000 310"}'::jsonb,
    'recusada', null, null,
    null, null, null,
    null, now() - interval '43200 seconds', now() - interval '43200 seconds', now() - interval '25920 seconds',
    'profissional', md5('encontralar:caso-1')::uuid, 'Hospital de Vale Formoso · Serviço Social', current_date + 4, null,
    null, null, null, null
  from public.perfis_cuidados p where p.id = md5('encontralar:p-pro-1')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-3')::uuid, 'enviada', 'Encaminhado por Hospital de Vale Formoso · Serviço Social.', 'profissional', v_profissional, now() - interval '43200 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-3')::uuid, 'recusada', 'Não temos enfermagem durante a noite.', 'lar', null, now() - interval '25920 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at,
    origem, caso_id, organizacao, alta_prevista, desbloqueada_em,
    entrada_data, entrada_confirmada_lar_em, entrada_confirmada_familia_em, entrada_taxa)
  select md5('encontralar:c-pro-4')::uuid, 'lar-lar-das-hortensias', v_profissional, p.id, private.snapshot_perfil(p), '{"nome":"Marta Correia (Hospital de Vale Formoso · Serviço Social)","email":"social@exemplo.pt","telefone":"225 000 310"}'::jsonb,
    'admitida', null, null,
    null, null, null,
    null, now() - interval '2937600 seconds', now() - interval '2937600 seconds', now() - interval '1814400 seconds',
    'profissional', md5('encontralar:caso-2')::uuid, 'Hospital de Vale Formoso · Serviço Social', current_date - 20, now() - interval '2851200 seconds',
    current_date - 21, now() - interval '1814400 seconds', now() - interval '1728000 seconds', 'isenta'
  from public.perfis_cuidados p where p.id = md5('encontralar:p-pro-2')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-4')::uuid, 'enviada', 'Encaminhado por Hospital de Vale Formoso · Serviço Social.', 'profissional', v_profissional, now() - interval '2937600 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-4')::uuid, 'em_analise', null, 'lar', null, now() - interval '2851200 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-4')::uuid, 'vaga_proposta', null, 'lar', null, now() - interval '2332800 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-4')::uuid, 'aceite', null, 'lar', null, now() - interval '2246400 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, autor_id, created_at) values (md5('encontralar:c-pro-4')::uuid, 'admitida', 'Entrada registada pela instituição.', 'lar', null, now() - interval '1814400 seconds');

  -- avaliação verificada: a importada pelo seed.sql passa a estar ligada à conta e ao pedido com a
  -- entrada confirmada (sem mexer nos agregados, que o seed já traz)
  update public.avaliacoes set user_id = v_fam_6, candidatura_id = md5('encontralar:c-fam-6')::uuid where instituicao_id = 'lar-jardins-do-douro' and user_id is null and autor = 'Teresa M.' and texto = 'O meu pai está muito bem acompanhado. A equipa da unidade de demências é paciente e mantém-nos sempre informados.';

  -- favoritos com alerta de vaga
  insert into public.favoritos (user_id, instituicao_id, alerta, created_at) values
  (v_familia, 'lar-jardins-do-douro', true, now() - interval '1728000 seconds'),
  (v_familia, 'lar-lar-residencial-rainha-santa', true, now() - interval '604800 seconds'),
  (v_familia, 'lar-residencia-senior-aconchego', true, now() - interval '777600 seconds')
  on conflict do nothing;

  -- notificações de exemplo
  insert into public.notificacoes (user_id, tipo, titulo, texto, instituicao_id, candidatura_id, link, lida, created_at) values
  (v_familia, 'vaga', 'Nova vaga disponível', 'Há uma vaga livre na Residência Sénior Aconchego. Contacte a instituição se ainda tiver interesse.', 'lar-residencia-senior-aconchego', null, '/lar/lar-residencia-senior-aconchego', false, now() - interval '7200 seconds'),
  (v_familia, 'visita', 'Visita confirmada', 'A visita ao Lar Residencial Rainha Santa ficou marcada para ' || private.data_extenso(current_date + 5) || ', às 11h00.', 'lar-lar-residencial-rainha-santa', md5('encontralar:c-ana-2')::uuid, '/familia', false, now() - interval '86400 seconds'),
  (v_familia, 'candidatura', 'Inscrição na lista de espera', 'A Casa de Repouso Jardins do Douro inscreveu a Maria do Carmo na lista de espera (posição 3).', 'lar-jardins-do-douro', md5('encontralar:c-ana-1')::uuid, '/familia', true, now() - interval '1296000 seconds'),
  (v_lar, 'candidatura', 'Novo pedido de vaga', 'Pedido de vaga de uma família (pessoa de 85–89 anos, dependência grave, urgência imediata). Abra o pedido para o aceitar e ver o contacto.', null, md5('encontralar:c-fam-0')::uuid, '/gestao/pedidos?pedido=' || md5('encontralar:c-fam-0')::uuid::text, false, now() - interval '25920 seconds'),
  (v_lar, 'visita', 'Pedido de visita', 'Sandra Lopes pediu uma visita para ' || private.data_extenso(current_date + 4) || ', às 15h00.', null, md5('encontralar:c-fam-1')::uuid, '/gestao/pedidos?pedido=' || md5('encontralar:c-fam-1')::uuid::text, false, now() - interval '259200 seconds'),
  (v_lar, 'sistema', 'Mantenha as vagas atualizadas', 'Fichas atualizadas na última semana aparecem primeiro nas pesquisas e transmitem mais confiança às famílias.', null, null, '/gestao', true, now() - interval '691200 seconds'),
  (v_lar, 'candidatura', 'Novo encaminhamento', 'Encaminhamento do Hospital de Vale Formoso · Serviço Social (pessoa de 80–84 anos), com alta prevista para ' || private.data_extenso(current_date + 4) || '. Abra o pedido para o aceitar e ver o contacto.', null, md5('encontralar:c-pro-1')::uuid, '/gestao/pedidos?pedido=' || md5('encontralar:c-pro-1')::uuid::text, false, now() - interval '43200 seconds'),
  (v_lar, 'candidatura', 'Confirme a entrada', 'Registou a entrada de Olívia Barros. A família ainda não confirmou; enviámos-lhe um lembrete.', null, md5('encontralar:c-fam-7')::uuid, '/gestao/pedidos?pedido=' || md5('encontralar:c-fam-7')::uuid::text, true, now() - interval '950400 seconds'),
  (v_profissional, 'candidatura', 'Em análise', 'O pedido para Albano Teixeira está em análise no Centro Social Fonte Clara.', 'lar-centro-social-fonte-clara', md5('encontralar:c-pro-2')::uuid, '/casos/' || md5('encontralar:caso-1')::uuid::text, false, now() - interval '17280 seconds'),
  (v_profissional, 'candidatura', 'Não foi possível', 'O Lar Residencial Rainha Santa não tem, neste momento, condições para receber Albano Teixeira. Nota: Não temos enfermagem durante a noite.', 'lar-lar-residencial-rainha-santa', md5('encontralar:c-pro-3')::uuid, '/casos/' || md5('encontralar:caso-1')::uuid::text, true, now() - interval '25920 seconds');

  -- visitas da equipa de terreno (piloto no distrito do Porto); a modalidade das fichas vem do seed.sql
  insert into public.visitas (id, instituicao_id, equipa_id, data, resultado, licenca_confirmada, instalacoes_vistas,
    vagas_confirmadas, precos_confirmados, responsavel_nome, responsavel_cargo, responsavel_telefone, responsavel_email,
    plano, notas, proximo_contacto, conta_criada_id, demonstracao, created_at)
  values
  (md5('encontralar:v-1')::uuid, 'lar-jardins-do-douro', v_equipa_sofia, now() - interval '5529600 seconds', 'aderiu', true, true, true, true, 'Helena Marques', 'Diretora técnica', '220 000 042', 'lar@exemplo.pt', 'por_entrada', 'Quer começar pela unidade de demências. Pediu formação para a equipa administrativa.', null, null, true, now() - interval '5529600 seconds'),
  (md5('encontralar:v-2')::uuid, 'lar-residencia-senior-lirios-do-campo', v_equipa_sofia, now() - interval '777600 seconds', 'aderiu', true, true, true, true, 'Paulo Antunes', 'Sócio-gerente', null, null, 'mensal', 'Prefere um custo fixo por mês. Casa pequena: cada cama vazia pesa muito.', null, null, true, now() - interval '777600 seconds'),
  (md5('encontralar:v-3')::uuid, 'lar-casa-bem-estar-do-douro', v_equipa_sofia, now() - interval '518400 seconds', 'interessado', true, false, false, false, null, null, null, null, null, 'Gostou da lista de espera digital. Vai falar com o sócio antes de decidir.', current_date + 5, null, true, now() - interval '518400 seconds'),
  (md5('encontralar:v-4')::uuid, 'lar-residencia-senior-monte-alegre', v_equipa_sofia, now() - interval '259200 seconds', 'voltar', false, false, false, false, null, null, null, null, null, 'A diretora estava de férias. Voltar na próxima semana, de manhã.', current_date + 2, null, true, now() - interval '259200 seconds'),
  (md5('encontralar:v-5')::uuid, 'lar-residencia-senior-ternura', v_equipa_sofia, now() - interval '1036800 seconds', 'recusou', false, false, false, false, null, null, null, null, null, 'Lista de espera cheia; não vê necessidade por agora. Voltar a tentar daqui a 6 meses.', null, null, true, now() - interval '1036800 seconds'),
  (md5('encontralar:v-6')::uuid, 'lar-lar-residencial-rainha-santa', v_equipa_sofia, now() - interval '2592000 seconds', 'aderiu', true, true, true, true, null, null, null, null, null, 'IPSS: sem custos. Interesse em reduzir os telefonemas de famílias.', null, null, true, now() - interval '2592000 seconds');
end;
$demo$;
