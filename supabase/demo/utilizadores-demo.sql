-- =====================================================================================
-- EncontraLar — ligar as contas de demonstração aos dados de demonstração. FICHEIRO GERADO.
-- Origem: src/data/seed.ts via scripts/gerar-seed-sql.ts → `npm run db:seed-sql`.
--
-- Pré-requisitos:
--   1. migrações aplicadas e supabase/seed.sql carregado;
--   2. contas criadas pela Auth Admin API ou pelo painel (NUNCA por SQL em auth.users):
--        lar@exemplo.pt     app_metadata {"role":"lar"}      user_metadata {"nome":"Helena Marques"}
--        familia@exemplo.pt app_metadata {"role":"familia"}  user_metadata {"nome":"Ana Ferreira"}
-- Corre uma única vez (sai sem fazer nada se já tiver sido aplicado). Executar como postgres.
-- =====================================================================================

do $demo$
declare
  v_lar uuid := (select id from auth.users where lower(email) = 'lar@exemplo.pt');
  v_familia uuid := (select id from auth.users where lower(email) = 'familia@exemplo.pt');
begin
  if v_lar is null or v_familia is null then
    raise exception 'Crie primeiro as contas lar@exemplo.pt e familia@exemplo.pt (Auth Admin API) — ver docs/SUPABASE.md.';
  end if;
  if exists (select 1 from public.perfis_cuidados where id = md5('encontralar:p-maria-carmo')::uuid) then
    raise notice 'Dados de demonstração já ligados — nada a fazer.';
    return;
  end if;

  -- contas (o papel vem de app_metadata; reafirmado aqui por segurança)
  update public.perfis_utilizador set role = 'lar', nome = 'Helena Marques', telefone = '22 000 042' where id = v_lar;
  update public.perfis_utilizador set role = 'familia', nome = 'Ana Ferreira', telefone = '912 000 101' where id = v_familia;

  -- a gestora passa a ser dona do lar de demonstração; a lista de espera "offline" desconta
  -- as inscrições que agora existem na plataforma
  update public.instituicoes set owner_id = v_lar, lista_espera_offline = 13 where id = 'lar-jardins-do-douro';

  -- perfil de cuidados (dados de saúde fictícios)
  insert into public.perfis_cuidados (id, user_id, nome, idade, relacao, genero, grau, necessidades, preferencias, quarto,
    local_label, local_lat, local_lng, raio_km, orcamento_max, urgencia, precisa_acordo_ss, notas, created_at, updated_at)
  values
  (md5('encontralar:p-maria-carmo')::uuid, v_familia, 'Maria do Carmo Ferreira', 84, 'Mãe', 'F', 'moderada', array['demencia', 'fisioterapia', 'diabetes']::text[], array['jardim', 'visitas_livres']::text[], 'individual', 'Porto', 41.1579, -8.6291, 15, 2000, '1-3meses', false, 'Diagnóstico de Alzheimer em fase inicial há dois anos. Diabetes tipo 2 controlada com comprimidos. Gosta muito de música e de estar ao ar livre.', now() - interval '2592000 seconds', now() - interval '432000 seconds');

  -- candidaturas (com consentimento registado na data de envio) e histórico
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at)
  select md5('encontralar:c-ana-1')::uuid, 'lar-jardins-do-douro', v_familia, p.id, private.snapshot_perfil(p), '{"nome":"Ana Ferreira","email":"familia@exemplo.pt","telefone":"912 000 101"}'::jsonb,
    'lista_espera', 3, 'A minha mãe tem Alzheimer em fase inicial e gostaríamos muito que pudesse ficar perto de nós, em Paranhos.',
    null, null, null,
    null, now() - interval '1641600 seconds', now() - interval '1641600 seconds', now() - interval '1296000 seconds'
  from public.perfis_cuidados p where p.id = md5('encontralar:p-maria-carmo')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, created_at) values (md5('encontralar:c-ana-1')::uuid, 'enviada', null, 'familia', now() - interval '1641600 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, created_at) values (md5('encontralar:c-ana-1')::uuid, 'em_analise', null, 'lar', now() - interval '1468800 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, created_at) values (md5('encontralar:c-ana-1')::uuid, 'lista_espera', 'Perfil adequado à unidade de demências. Inscrita na lista de espera.', 'lar', now() - interval '1296000 seconds');
  insert into public.candidaturas (id, instituicao_id, user_id, perfil_id, perfil_snapshot, contacto, estado, posicao,
    mensagem, visita_data, visita_hora, visita_estado, prazo_resposta, consentimento_em, created_at, updated_at)
  select md5('encontralar:c-ana-2')::uuid, 'lar-lar-residencial-rainha-santa', v_familia, p.id, private.snapshot_perfil(p), '{"nome":"Ana Ferreira","email":"familia@exemplo.pt","telefone":"912 000 101"}'::jsonb,
    'em_analise', null, 'Gostaria de visitar as instalações com o meu irmão.',
    current_date + 5, '11:00', 'confirmada',
    null, now() - interval '518400 seconds', now() - interval '518400 seconds', now() - interval '86400 seconds'
  from public.perfis_cuidados p where p.id = md5('encontralar:p-maria-carmo')::uuid;
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, created_at) values (md5('encontralar:c-ana-2')::uuid, 'enviada', null, 'familia', now() - interval '518400 seconds');
  insert into public.candidatura_eventos (candidatura_id, estado, nota, autor, created_at) values (md5('encontralar:c-ana-2')::uuid, 'em_analise', 'Visita confirmada.', 'lar', now() - interval '86400 seconds');

  -- favoritos com alerta de vaga
  insert into public.favoritos (user_id, instituicao_id, alerta, created_at) values
  (v_familia, 'lar-jardins-do-douro', true, now() - interval '1728000 seconds'),
  (v_familia, 'lar-lar-residencial-rainha-santa', true, now() - interval '604800 seconds'),
  (v_familia, 'lar-residencia-senior-aconchego', true, now() - interval '777600 seconds')
  on conflict do nothing;

  -- notificações de exemplo
  insert into public.notificacoes (user_id, tipo, titulo, texto, instituicao_id, candidatura_id, link, lida, created_at) values
  (v_familia, 'vaga', 'Nova vaga disponível', 'Residência Sénior Aconchego indicou que tem uma vaga livre. Contacte a instituição se ainda tiver interesse.', 'lar-residencia-senior-aconchego', null, '/lar/lar-residencia-senior-aconchego', false, now() - interval '7200 seconds'),
  (v_familia, 'visita', 'Visita confirmada', 'A visita a Lar Residencial Rainha Santa ficou marcada para ' || private.data_extenso(current_date + 5) || ', às 11h00.', 'lar-lar-residencial-rainha-santa', md5('encontralar:c-ana-2')::uuid, '/familia', false, now() - interval '86400 seconds'),
  (v_familia, 'candidatura', 'Inscrição na lista de espera', 'A Casa de Repouso Jardins do Douro inscreveu a Maria do Carmo na lista de espera (posição 3).', 'lar-jardins-do-douro', md5('encontralar:c-ana-1')::uuid, '/familia', true, now() - interval '1296000 seconds'),
  (v_lar, 'sistema', 'Mantenha as vagas atualizadas', 'Fichas atualizadas na última semana aparecem primeiro nas pesquisas e transmitem mais confiança às famílias.', null, null, '/gestao', true, now() - interval '691200 seconds');
end;
$demo$;
