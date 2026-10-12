# EncontraLar — base de dados Supabase

Projeto: **`kdyvsxzputvuyauddmwg`** (`https://kdyvsxzputvuyauddmwg.supabase.co`).

Enquanto `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` não estiverem definidas, a app corre em
**modo demonstração** (localStorage, `src/lib/store.ts`) e o `supabase-js` nem sequer é descarregado.
Este documento explica como pôr a base de dados real a funcionar, passo a passo, e o que cada peça faz.

| Pasta / ficheiro | O que é |
| --- | --- |
| `supabase/migrations/*.sql` | Esquema, segurança (RLS), lógica de negócio, Realtime e trabalhos agendados. Aplicar **por ordem**. |
| `supabase/seed.sql` | 162 fichas **fictícias** (demonstração), com o hash do link de confirmação, e 84 pesquisas sem vagas. **Nunca em produção.** |
| `supabase/demo/contas-demo.json` | As 11 contas de demonstração (geradas a partir de `src/data/seed.ts`), incluindo a assistente social. |
| `supabase/demo/utilizadores-demo.sql` | Liga essas contas aos dados de demonstração. **Nunca em produção.** |
| `scripts/criar-contas-demo.mjs` | Cria as contas de demonstração pela Auth Admin API. |
| `scripts/gerar-seed-sql.ts` | Gera os três ficheiros de demonstração (`npm run db:seed-sql`). |
| `supabase/tests/` | Testes das migrações em PGlite (Postgres em WASM), sem rede: `npm test`. |
| `src/lib/supabase.ts`, `supabase-mappers.ts`, `database.types.ts` | Cliente (import dinâmico), conversões linha ↔ tipos da app, tipos da BD. |

---

## 1. Modelo de segurança (resumo)

- **RLS ativa em todas as tabelas** do schema `public`; os privilégios começam fechados e abrem-se
  coluna a coluna (`20261012190100_seguranca.sql`, `20261012190400_endurecimento_seguranca.sql`).
- **Lógica sensível no schema `private`** (não exposto na Data API) em funções `SECURITY DEFINER` com
  `search_path = ''` e verificação de `auth.uid()`; a Data API só vê invólucros `SECURITY INVOKER` em `public`.
- **Papéis**: `familia`, `lar` e `profissional` (assistente social), guardados em `perfis_utilizador.role`.
  O administrador define-os em `app_metadata.role` (sincronizado por trigger). No registo, o formulário pode
  pedir `lar` ou `profissional` em `user_metadata` — aceitável porque `lar` só permite criar **um rascunho**
  de ficha, por publicar e "pendente", e `profissional` só permite criar casos (perfis que o próprio escreve)
  e enviá-los a fichas verificadas, como uma família. A organização do profissional
  (`perfis_utilizador.organizacao`) vem de `app_metadata.organizacao` ou do registo, é validada no servidor e
  **não é editável** pelo utilizador. Contas anónimas são sempre `familia`. `user_metadata` nunca é usado em
  políticas.
- **Privacidade em duas fases (RGPD art. 9.º)** — secção 12: antes de aceitar um pedido, o lar **não lê a
  linha** (nem contacto, nem nome, nem notas, nem mensagem, nem histórico); vê só um resumo sem identificação
  (`pedidos_recebidos()`). Imposto pela política RLS, não pela interface.
- **Dados de saúde (RGPD art. 9.º)** — `perfis_cuidados`: só o próprio utilizador lê/escreve. Uma instituição
  só recebe uma **cópia reduzida** do perfil (`private.snapshot_perfil`: sem coordenadas, raio, id nem datas)
  através de um pedido que a família lhe enviou, com consentimento explícito (`candidaturas.consentimento_em`), e
  **só se a ficha estiver publicada, verificada, tiver gestor e for do mesmo "mundo"** (demonstração ↔ real).
- **Publicar e verificar fichas é sempre decisão do administrador** (secção 6). Mudar nome, morada, contactos,
  licença, natureza, tipo ou acordo com a Segurança Social numa ficha verificada fá-la voltar a "pendente".
- **Minimização**: cancelar um pedido retira de imediato os dados de saúde à instituição (fica nome e idade);
  apagar um perfil minimiza os pedidos já encerrados desse perfil; pedidos recusados são minimizados 30 dias
  depois (pg_cron). As notas do histórico e das notificações vão junto.
- **Dados internos** (`owner_id`, `visualizacoes_30d`, `confirmacao_token_hash`, `candidatura_eventos.autor_id`,
  `avaliacoes.user_id`, `avaliacoes.candidatura_id`) não são legíveis por `anon`/`authenticated`; o gestor obtém
  os da sua ficha com a RPC `painel_instituicao()` e o autor das avaliações as suas com `minhas_avaliacoes()`.
- **Avaliações verificadas**: só pela RPC `avaliar_lar`, por quem fez o pedido e **confirmou a entrada**, uma
  por pedido. Não há escrita direta na tabela.
- **RPC sem sessão**: só três — `registar_procura` (pesquisa anónima, limitada), `vagas_por_token` e
  `confirmar_vagas_por_token` (link de confirmação das vagas). Para isso `anon` tem `USAGE` no schema
  `private` e `EXECUTE` **apenas** nas três funções internas correspondentes (o teste de migrações falha se
  `anon` ganhar `EXECUTE` em mais alguma).

---

## 2. Aplicar as migrações

Escolha **um** dos caminhos e mantenha-o (misturar os dois baralha o histórico de migrações).

### Caminho A — Supabase CLI (recomendado: as versões ficam iguais aos nomes dos ficheiros)

O CLI não está no repositório; use uma versão **fixa** (≥ 2.81.3, que já tem `db advisors`; veja a mais
recente com `npm view supabase version`):

```bash
npx supabase@<versão> init                 # cria supabase/config.toml (não mexe nas migrações)
npx supabase@<versão> login                # em CI use SUPABASE_ACCESS_TOKEN com um token com âmbito limitado
npx supabase@<versão> link --project-ref kdyvsxzputvuyauddmwg
npx supabase@<versão> db push              # aplica supabase/migrations/* por ordem (SEM o seed)
npx supabase@<versão> db advisors          # avisos de segurança e desempenho — corrigir o que aparecer
```

Não use `db push --include-seed` no projeto principal (o seed é de demonstração — secção 7).

### Caminho B — servidor MCP do Supabase (`.mcp.json`)

1. Autentique o servidor (`claude /mcp` num terminal normal → `supabase` → Authenticate).
2. Para **cada** ficheiro de `supabase/migrations`, por ordem do nome, chame `apply_migration` com
   `name` = o sufixo do ficheiro (ex.: `esquema_inicial`) e `query` = o conteúdo do ficheiro.
3. Chame `get_advisors` (tipo `security` e depois `performance`) e corrija o que aparecer.

O `apply_migration` regista a migração com a hora a que corre (não com o prefixo do ficheiro). Se mais tarde
passar a usar o CLI, alinhe o histórico com `supabase migration repair` antes do primeiro `db push`.

### Ordem atual

| Ficheiro | Conteúdo |
| --- | --- |
| `20261012190000_esquema_inicial.sql` | Tipos, tabelas, restrições, índices, triggers de manutenção. |
| `20261012190100_seguranca.sql` | Perfil automático no registo (trigger em `auth.users`), RLS, GRANTs. |
| `20261012190200_logica_negocio.sql` | Funções de negócio, RPC públicas, vista `instituicoes_publicas`. |
| `20261012190300_realtime.sql` | `notificacoes`, `candidaturas`, `quartos` na publicação Realtime. |
| `20261012190400_endurecimento_seguranca.sql` | Revisão de segurança: publicação/verificação, colunas internas, limites, sequências, demonstração. |
| `20261012190500_endurecimento_logica.sql` | Revisão da lógica: quem recebe dados de saúde, minimização, avisos, vagas, prazo, `painel_instituicao`. |
| `20261012190600_agendamentos.sql` | pg_cron: expirar propostas (15 min) e minimizar pedidos (diário). |
| `20261012190700_modelo_negocio_tipos.sql` | Valores novos dos enums: `role_utilizador` `profissional`, `estado_candidatura` `admitida` (ficheiro à parte: um valor novo só se usa depois de a transação terminar). |
| `20261012190800_modelo_negocio.sql` | Modelo de negócio: casos, encaminhamentos, entradas e taxa, duas fases, avaliações verificadas, procura anónima, link de confirmação, RPC novas e pg_cron da procura. |

As migrações já aplicadas **nunca se editam**: qualquer mudança é um ficheiro novo com um prefixo maior.

---

## 3. Verificações depois de migrar (SQL Editor ou `execute_sql`)

```sql
-- o perfil é criado automaticamente no registo
select tgname from pg_trigger where tgrelid = 'auth.users'::regclass and not tgisinternal;
-- → ao_atualizar_app_metadata, ao_criar_utilizador

-- RLS em todas as tabelas do schema public (deve devolver 0 linhas)
select relname from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r' and not relrowsecurity;

-- trabalhos agendados
select jobname, schedule, command, active from cron.job where jobname like 'encontralar-%';
```

**Data API** (Integrations → Data API → Settings): os schemas expostos devem ser só `public` e
`graphql_public`. O schema `private` **não** pode estar na lista.

---

## 4. Autenticação

- **URL Configuration** (Authentication → URL Configuration):
  - Site URL: `https://rgvduarte.github.io/EncontraLar/`
  - Redirect URLs: `https://rgvduarte.github.io/EncontraLar/**` e, para desenvolvimento, `http://127.0.0.1:5173/**`.
- **PKCE** (`src/lib/supabase.ts`): os links de confirmação/recuperação trazem `?code=` e só funcionam **no
  mesmo navegador** onde a pessoa se registou (o verificador PKCE fica nesse navegador). Diga-o no e-mail.
- **Confirmação de e-mail ligada** (recomendado): `signUp` não devolve sessão. Para uma conta `lar`, a ficha
  só pode ser inserida depois do primeiro início de sessão — guarde os dados do formulário da instituição
  (ex.: no `localStorage`, que é o mesmo navegador exigido pelo PKCE) e insira-os então, com
  `larParaInsercao()` + `quartoInicial()` (`src/lib/supabase-mappers.ts`).
- **Inícios de sessão anónimos: manter desligados.** Mesmo que um dia sejam ligados, contas anónimas não
  criam fichas, perfis de saúde, avaliações nem pedidos (políticas + `private.candidatar`).
- **Apagar um utilizador não invalida os tokens já emitidos**: termine as sessões antes e mantenha o JWT curto
  (Authentication → Sessions / JWT expiry).
- Contas `lar` criadas por um administrador: Auth Admin API com `app_metadata: { role: 'lar' }`.
- Contas `profissional`: no registo, `signUp({ options: { data: dadosRegisto(input) } })`
  (`src/lib/supabase-mappers.ts`) envia `role: 'profissional'` e `organizacao: { nome, tipo, servico? }`; o
  trigger lê-os **uma vez**. Pelo administrador: `app_metadata: { role: 'profissional', organizacao: {…} }`
  (tem prioridade e pode ser mudado depois — é sincronizado).

---

## 5. Front-end (GitHub Pages)

Só a chave **publicável** pode ir para o navegador (`sb_publishable_…`); `src/lib/supabase.ts` recusa chaves
secretas. Quando o `store` passar a usar o Supabase, acrescente ao passo de build de
`.github/workflows/deploy.yml`, com variáveis do repositório (Settings → Secrets and variables → Actions → Variables):

```yaml
      - name: Build (typecheck + Vite)
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ vars.VITE_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ vars.VITE_SUPABASE_PUBLISHABLE_KEY }}
```

Sem estas variáveis o site publicado continua em modo demonstração (é o estado atual, de propósito).

---

## 6. Operações do administrador

```sql
-- verificar e publicar uma ficha (depois de confirmar a licença)
update public.instituicoes
   set verificacao_estado = 'verificado', verificacao_data = now(), publicado = true
 where id = 'lar-exemplo';

-- retirar da pesquisa
update public.instituicoes set publicado = false where id = 'lar-exemplo';
```

- Só fichas **publicadas + verificadas + com gestor** recebem pedidos (e, com eles, dados de saúde).
- Uma ficha cujo gestor apagou a conta sai automaticamente da pesquisa (`publicado = false`).
- O nº de inscrições offline na lista de espera (`lista_espera_offline`) só é alterado pelo administrador
  (não há interface; mexer-lhe muda a posição seguinte da lista).
- Mudar o papel de alguém: Auth Admin API, `app_metadata.role` (`familia`/`lar`/`profissional`); a organização
  de um profissional em `app_metadata.organizacao` (`{ "nome": "…", "tipo": "hospital" | "centro_saude" |
  "autarquia" | "outro", "servico": "…" }`).
- Links de confirmação das vagas para o envio periódico (SMS/e-mail): `select private.emitir_token_confirmacao('lar-x')`
  (como `postgres`, num trabalho de servidor) devolve o token **uma vez** e guarda só o hash; validade de 30 dias
  (`confirmacao_token_expira_em`). O gestor também gera um link novo no painel (`renovar_token_confirmacao()`),
  o que invalida o anterior.

---

## 7. Dados de demonstração — NUNCA no projeto de produção

As fichas do seed são fictícias (com selos de verificação e avaliações inventados) e as contas `lar@exemplo.pt`,
`familia@exemplo.pt` e `social@exemplo.pt` têm a palavra-passe **pública** do ecrã de entrada. Os links de
confirmação das fichas de demonstração usam os tokens do protótipo (`tokenConfirmacao`, previsíveis a partir do
id): numa base de demonstração qualquer pessoa pode "confirmar" vagas de fichas fictícias — mais uma razão para
nunca carregar o seed em produção (lá os tokens são aleatórios, ≈ 244 bits). Use um **ramo** do Supabase
(`create_branch` no MCP, plano Pro) ou um **projeto à parte**.

Mesmo que sejam carregados por engano, ficam isolados: `instituicoes.demonstracao = true` e
`perfis_utilizador.demonstracao = true` — contas reais não enviam pedidos a fichas de demonstração, contas de
demonstração não enviam pedidos nem avaliações a fichas reais, e fichas sem gestor não recebem pedidos.
A vista pública expõe `demonstracao` para a interface poder mostrar um aviso.

1. **Seed** (≈ 730 KB — grande demais para o SQL Editor ou para uma chamada `execute_sql`):
   ```bash
   psql "$DB_URL_DO_RAMO" -f supabase/seed.sql        # ou: supabase db push --include-seed (no ramo)
   ```
   Com a integração GitHub do Branching, os ramos de pré-visualização podem correr o `seed.sql`
   automaticamente — confirme na documentação do Supabase antes de contar com isso.
2. **Contas** (Auth Admin API, com e-mail confirmado e `app_metadata.role`):
   ```bash
   SUPABASE_URL=https://<ref-do-ramo>.supabase.co SUPABASE_SECRET_KEY=sb_secret_… node scripts/criar-contas-demo.mjs
   ```
   O script recusa o projeto principal (salvo `--projeto-principal`) e **não altera contas que já existam**.
3. **Ligar** as contas aos dados: corra `supabase/demo/utilizadores-demo.sql` como `postgres` (SQL Editor do
   ramo). O script recusa contas sem `app_metadata.role` ou com o e-mail por confirmar — quem se tenha
   registado primeiro com um desses e-mails não fica com a ficha nem com os pedidos. Liga também a assistente
   social (organização, 3 casos e 4 encaminhamentos), as entradas registadas e a avaliação verificada (a
   importada pelo seed passa a pertencer à família que confirmou a entrada).
4. Com o Supabase ligado, o acesso de demonstração do ecrã de entrada (`DemoAccess`) deve ser escondido ou
   apontar para o ramo.

Limitação conhecida: o catálogo do modo demonstração (`createSeed`) depende do mês em que é gerado (a
sazonalidade consome números aleatórios); `seed.sql` fixa outubro de 2026 (`AGORA_SEED`). A partir de
novembro, ids/nomes das fichas no modo demonstração e no Supabase deixam de coincidir. Corrigir exige mexer
em `src/data/seed.ts` (gerador independente por ficha) e subir `SEED_VERSION`.

---

## 8. Trabalhos agendados (pg_cron)

`20261012190600_agendamentos.sql` ativa o pg_cron (se preciso) e agenda, como `postgres`:

| Trabalho | Agenda (UTC) | Faz |
| --- | --- | --- |
| `encontralar-expirar-propostas` | `*/15 * * * *` | `private.expirar_propostas()`: propostas sem resposta em 48 h voltam à lista (mesma posição) e as duas partes são avisadas. |
| `encontralar-minimizar-pedidos` | `17 3 * * *` | `private.minimizar_candidaturas_encerradas(30)`: pedidos cancelados/recusados há mais de 30 dias ficam só com nome e idade. |
| `encontralar-limpar-procuras` | `41 3 * * *` | `private.limpar_procuras_anonimas(365)`: apaga pesquisas sem vagas com mais de um ano (`20261012190800`). |

Estas funções **não** são invocáveis pela Data API (nem pela `service_role`: o schema `private` não está
exposto). Se o pg_cron não existir, a migração apenas avisa; agende então à mão:

```sql
select cron.schedule('encontralar-expirar-propostas', '*/15 * * * *', 'select private.expirar_propostas()');
select cron.schedule('encontralar-minimizar-pedidos', '17 3 * * *', 'select private.minimizar_candidaturas_encerradas(30)');
select cron.schedule('encontralar-limpar-procuras', '41 3 * * *', 'select private.limpar_procuras_anonimas(365)');
-- histórico de execuções
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;
```

---

## 9. Regenerar os tipos

`src/lib/database.types.ts` foi escrito à mão a partir das migrações. Depois de migrar, regenere-o com o MCP
(`generate_typescript_types`) ou com `npx supabase@<versão> gen types typescript --project-id kdyvsxzputvuyauddmwg`
e substitua o ficheiro; depois `npm run typecheck`. Os tipos gerados não refletem privilégios por coluna nem
RLS: `owner_id`, `visualizacoes_30d`, `confirmacao_token_*`, `autor_id`, `avaliacoes.user_id` e
`avaliacoes.candidatura_id` existem nos tipos mas não podem ser selecionados pelos clientes (use listas de
colunas explícitas, `painel_instituicao()` e `minhas_avaliacoes()`); `procuras_anonimas` aparece nos tipos mas
só se usa pelas RPC. Os tipos de retorno `PedidoRecebido` e `VagasPorToken` (no topo do ficheiro escrito à mão)
passam a vir inline no ficheiro gerado.

---

## 10. Testes locais

`npm test` corre, sem rede, todas as migrações em PGlite (Postgres 18 em WASM) com
`supabase/tests/bootstrap.sql` — **só para testes**: imita os papéis `anon`/`authenticated`/`service_role`,
`auth.users`, `auth.uid()`/`auth.jwt()`, os privilégios por omissão do Supabase e um `cron.schedule` mínimo.

- `migracoes.test.ts` — estrutura: RLS em tudo, funções `SECURITY DEFINER` só em `private`, `search_path`,
  índices das FKs, privilégios de tabelas/colunas/sequências/funções, Realtime, pg_cron, seed.
- `rls.test.ts` — papéis, publicação, selo de verificação, fichas sem gestor, colunas internas, favoritos,
  sequências, avaliações, limites de tamanho, capacidade.
- `rpc.test.ts` — quem recebe dados de saúde, cópia reduzida, minimização (cancelar, apagar perfil,
  retenção, apagar conta), avisos sem spam, sobrelotação, prazo de 48 h, expiração, registo de uma ficha.
- `negocio.test.ts` — modelo de negócio: duas fases (select direto, histórico, RPC, avisos e valores devolvidos),
  taxa (privado/IPSS/Misericórdia), entradas, profissionais e casos, avaliações verificadas, procura anónima
  (anon escreve, ninguém lê, agregados só do próprio distrito, limites) e link de confirmação (token certo/errado,
  expirado, renovado; hash ilegível).
- `prototipo.test.ts` — seed + contas de demonstração = `createSeed`: 162 fichas, 14 pedidos (lidos por quem os
  fez e, no painel do lar, só o resumo dos que não foram aceites), 3 casos, procura do distrito e link de
  confirmação, de ida e volta pelos mappers.

---

## 11. Decisões em aberto (cliente)

- **Retenção**: 30 dias para pedidos recusados/cancelados (minimização) é uma proposta. Falta definir quanto
  tempo guardar pedidos **aceites** (contrato com a instituição), notificações antigas e contas inativas.
- **Fichas "pendentes"**: hoje não recebem pedidos. Alternativa: aceitar com um segundo consentimento
  ("esta instituição ainda não foi verificada").
- **Apagar um perfil** não cancela os pedidos ativos (é o que a interface promete). Se o cliente preferir que
  apagar o perfil retire o consentimento de todos os pedidos, muda a frase da interface e uma linha do trigger.
- **Mudar telefone/e-mail/site** de uma ficha verificada também a faz voltar a "pendente" (anti-fraude). Se for
  demasiado restritivo, retirar esses campos de `private.proteger_instituicao`.
- ~~**Avaliações**: qualquer família avaliava qualquer ficha~~ — decidido no modelo de negócio: só quem confirmou
  a entrada, uma por pedido (`avaliar_lar`).
- **Profissionais registados por conta própria**: a organização ("Hospital X") é declarada no registo e mostrada ao
  lar no resumo do pedido, sem verificação. Validar (domínio de e-mail institucional, aprovação pelo
  administrador) antes de a interface a destacar?
- **Avaliação por profissionais**: como no protótipo, quem fez o pedido (também um profissional) avalia depois de
  confirmar a entrada, e a relação aparece "Familiar de residente". Restringir a famílias ou usar outra relação?
- **Limites de pedidos dos profissionais**: os mesmos de uma família (20 por dia, 3 por instituição). Uma
  assistente social com muitos casos pode precisar de mais.
- **Procura anónima**: a repetição é filtrada por 10 minutos (sem identificar quem pesquisa) e há limites
  globais (60/min, 300/h por distrito). Se for preciso mais rigor contra robôs, um CAPTCHA ou uma Edge Function
  à frente da RPC.
- **Fornecedores de autenticação** (só e-mail? Google/Apple?), confirmação de e-mail e duração do JWT.
- **Projeto de demonstração**: ramo do Supabase (plano Pro) ou projeto gratuito à parte?

---

## 12. Modelo de negócio na base de dados (`20261012190700` e `20261012190800`)

Contrato: `docs/MODELO-NEGOCIO.md`. O que o protótipo faz em `src/lib/store.ts` e `src/lib/negocio.ts` passa a ser
imposto pela base de dados.

### Tabelas e colunas novas

| Tabela / coluna | O que é |
| --- | --- |
| `casos` | Casos de um profissional: `perfil_id` (perfil de cuidados escrito por ele), `referencia` (não identificativa), `alta_prevista`, `consentimento_em` (obrigatório), `estado` `aberto`/`colocado`/`fechado`. |
| `procuras_anonimas` | Pesquisas sem vagas, **sem dados pessoais** (nem conta, nem IP): distrito, lugar, grau, cuidados, orçamento, resultados. |
| `perfis_utilizador.organizacao` | `{ nome, tipo, servico? }` das contas `profissional`. |
| `candidaturas.origem`, `caso_id`, `organizacao`, `alta_prevista` | Encaminhamento: `origem = 'profissional'`; o autor (`user_id`) é o profissional. |
| `candidaturas.desbloqueada_em` | O lar aceitou o pedido (antes disso não lê a linha). |
| `candidaturas.entrada_data`, `entrada_confirmada_lar_em`, `entrada_confirmada_familia_em`, `entrada_taxa` | Entrada na instituição (estado `admitida`); `entrada_taxa` = `aplicavel` (privado) ou `isenta` (IPSS/Misericórdia). |
| `avaliacoes.candidatura_id` | O pedido com entrada confirmada que justifica a avaliação verificada (único). |
| `instituicoes.confirmacao_token_hash`, `confirmacao_token_expira_em` | SHA-256 do token do link `/confirmar/:token` e a validade. O token em bruto nunca é guardado. |

`procuras_anonimas` tem RLS ligada **sem políticas** de propósito (ninguém lê nem escreve pela Data API): o
aviso "RLS Enabled No Policy" do `db advisors` sobre ela é esperado.

Restrições: um pedido só está em análise/lista/vaga/aceite/admitido com `desbloqueada_em`; `admitida` ⇔ há
entrada; a entrada tem sempre taxa e pelo menos uma confirmação; a origem `familia` não tem caso, organização
nem alta.

### Quem lê e escreve o quê (RLS e privilégios)

| Tabela | anon | família | profissional | lar (gestor) |
| --- | --- | --- | --- | --- |
| `candidaturas` | — | lê as suas (completas) | lê as suas (completas) | lê as da sua ficha **só depois de aceitar**; antes, `pedidos_recebidos()` |
| `candidatura_eventos` | — | das suas | das suas | só de pedidos aceites |
| `casos` | — | — | lê os seus; escreve por RPC | — |
| `perfis_cuidados` | — | os seus | os seus (dos casos) | nunca (só a cópia do pedido aceite) |
| `avaliacoes` | lê (fichas publicadas, sem `user_id`/`candidatura_id`) | idem; escreve só por `avaliar_lar`; apaga a sua | idem | idem |
| `procuras_anonimas` | escreve só por `registar_procura` | idem | idem | só agregados do seu distrito (`procura_na_zona`) |
| `instituicoes.confirmacao_token_*` | — (só pelas RPC do link) | — | — | — (gera um novo com `renovar_token_confirmacao`) |
| `perfis_utilizador.organizacao` | — | — | lê; não altera | — |

### Privacidade em duas fases

1. **Por aceitar** (`desbloqueada_em` nulo): a política `candidaturas_select_lar` exige `desbloqueada_em is not
   null`, por isso o lar não obtém a linha por `select`, por embutir (PostgREST), por GraphQL, nem pelo Realtime;
   o histórico também não (a política dele depende desta). `pedidos_recebidos()` devolve a todos os pedidos da
   ficha o **resumo**: faixa etária (`'80–84'`), grau, necessidades, zona (`local_label`), orçamento, urgência,
   quarto, acordo SS, origem, organização, alta prevista, estado, visita e entrada — e `user_id`, `perfil_id`,
   `contacto`, `perfil_snapshot`, `mensagem`, `historico` a `null`.
2. **Aceitar** (`aceitar_candidatura`): só o dono, só pedidos `enviada`; regista `desbloqueada_em`, passa a
   `em_analise` na mesma transação e avisa quem fez o pedido. Fazer o pedido avançar com
   `atualizar_estado_candidatura` (em análise, lista de espera) também desbloqueia, como no protótipo.
3. **Nunca desbloqueia**: recusar sem aceitar, e o pedido ser cancelado pela família (retirada do
   consentimento) — `aceitar_candidatura` recusa-os. Diferença assumida em relação a `contactoVisivel` do
   protótipo, que considera visível qualquer estado diferente de `enviada`: com o Supabase, decida o que mostrar
   com `!!c.desbloqueadaEm`.
4. **Sem fugas laterais**: os avisos ao lar de pedidos por aceitar não têm nomes ("Pedido de vaga de uma família
   (pessoa de 80–84 anos)…", "Encaminhamento do Hospital X (…)", visitas e cancelamentos idem); as RPC do lar que
   devolvem um pedido por aceitar (`atualizar_estado_candidatura` ao recusar, `confirmar_visita`) devolvem-no
   sem identificadores, contacto, mensagem nem perfil completo (`private.para_lar`).

No front-end: o painel do lar usa `pedidos_recebidos()` + `pedidoRecebidoDeLinha` (os pedidos por aceitar
chegam com nome e contacto vazios e uma idade da mesma faixa, para `resumoAnonimo` dar o mesmo que no protótipo);
o Realtime de `candidaturas` só traz os aceites — use o aviso (`notificacoes`) para voltar a pedir o painel.

### RPC novas (todas `SECURITY DEFINER` em `private`, invólucro `SECURITY INVOKER` em `public`)

| RPC | Quem | Faz |
| --- | --- | --- |
| `pedidos_recebidos()` | lar | Pedidos da sua ficha: resumo sempre; dados completos e histórico só dos aceites. |
| `aceitar_candidatura(id)` | lar (dono) | "Aceitar e ver contacto". |
| `marcar_entrada(id, data)` | lar (dono) | Só de `aceite`/`admitida`; `admitida`, confirmação do lar, taxa pela natureza; avisa o autor. Data não futura nem anterior ao pedido. |
| `confirmar_entrada_familia(id, data)` | autor do pedido | O mesmo do outro lado; avisa o lar. A primeira confirmação fixa a data e a taxa. |
| `avaliar_lar(candidatura_id, nota, texto, aspetos)` | autor do pedido | Só com a entrada confirmada pela família; uma por pedido; `verificada`; atualiza média e total. |
| `minhas_avaliacoes()` | autenticado | As suas avaliações e o pedido de cada uma. |
| `criar_caso(perfil, referencia, alta_prevista, consentimento)` | profissional | Cria o perfil e o caso (consentimento obrigatório). |
| `atualizar_caso(id, alteracoes)` | profissional (do caso) | Só as chaves indicadas (`referencia`, `alta_prevista`, `estado`, `perfil`). |
| `enviar_caso(caso_id, instituicao_ids[], mensagem)` | profissional (do caso) | Um pedido por ficha elegível (publicada, verificada, com gestor, mesmo "mundo"), sem duplicar pedidos ativos do caso; máx. 20 fichas por chamada e os limites diários de `candidatar`; avisos anónimos. Devolve os pedidos criados. |
| `registar_procura(distrito, lugar, grau, cuidados, orcamento_max, resultados, com_vaga)` | **anon** e autenticados | Pesquisa sem vagas, validada (sem algarismos/`@` no lugar, domínios), sem repetir a mesma em 10 min, limites globais. Devolve `false` se ignorada. |
| `procura_na_zona(dias)` | lar | Total, contagem por cuidado e por grau e orçamento mediano do **distrito da sua ficha** (1–365 dias). |
| `vagas_por_token(token)` | **anon** | Nome e vagas da instituição do link; token inválido/expirado → nenhuma linha. |
| `confirmar_vagas_por_token(token, ainda_tem)` | **anon** | Sim → renova a frescura; não → lugares livres a 0. Token inválido/expirado → sempre "Link de confirmação inválido ou expirado." |
| `renovar_token_confirmacao()` | lar (dono) | Novo link (30 dias); devolve o token uma vez; o anterior deixa de valer. |

### Do protótipo (`src/lib/store.ts`) para o Supabase

| Função do store | Supabase | Mapper (`src/lib/supabase-mappers.ts`) |
| --- | --- | --- |
| `useCandidaturasDoLar(larId)` | `rpc('pedidos_recebidos')` | `pedidoRecebidoDeLinha` |
| `aceitarPedido(id)` | `rpc('aceitar_candidatura', { p_candidatura_id })` | `candidaturaDeLinha` |
| `marcarEntrada(id, data)` | `rpc('marcar_entrada', { p_candidatura_id, p_data })` | `candidaturaDeLinha` |
| `confirmarEntradaFamilia(id, data)` | `rpc('confirmar_entrada_familia', { p_candidatura_id, p_data })` | `candidaturaDeLinha` |
| `avaliarLar(candidaturaId, input)` | `rpc('avaliar_lar', avaliacaoParaRpc(candidaturaId, input))` | `reviewDeLinha` |
| `jaAvaliou(c)` | `rpc('minhas_avaliacoes')` → `candidatura_id` | — |
| `criarCaso(input)` | `rpc('criar_caso', casoParaCriacao(input))` | `casoDeLinha` |
| `atualizarCaso(id, patch)` | `rpc('atualizar_caso', casoParaAtualizacao(id, patch))` | `casoDeLinha` |
| `enviarCaso(casoId, larIds, mensagem)` | `rpc('enviar_caso', { p_caso_id, p_instituicao_ids, p_mensagem })` | `candidaturaDeLinha` |
| `useCasos()` / `useCaso(id)` | `from('casos').select('*')` (+ `perfis_cuidados` do próprio) | `casoDeLinha`, `perfilDeLinha` |
| `useCandidaturasDoCaso(casoId)` | `from('candidaturas').select(SELECT_CANDIDATURA).eq('caso_id', casoId)` | `candidaturaDeLinha` |
| `registarProcura(p)` | `rpc('registar_procura', procuraParaRpc(p))` | — |
| `useProcurasZona(lar, dias)` + `resumirProcuras` | `rpc('procura_na_zona', { p_dias })` | `procuraNaZonaDeLinha` |
| `larPorToken(token)` / `useLarPorToken` | `rpc('vagas_por_token', { p_token })` | `vagasPorTokenDeLinha` |
| `responderConfirmacao(token, aindaTem)` | `rpc('confirmar_vagas_por_token', { p_token, p_ainda_tem })` | `vagasPorTokenDeLinha` |
| `register({ role: 'profissional', organizacao })` | `auth.signUp({ …, options: { data: dadosRegisto(input) } })` | `utilizadorDeLinha` (com `organizacao`) |

