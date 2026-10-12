# EncontraLar — base de dados Supabase

Projeto: **`kdyvsxzputvuyauddmwg`** (`https://kdyvsxzputvuyauddmwg.supabase.co`).

Enquanto `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` não estiverem definidas, a app corre em
**modo demonstração** (localStorage, `src/lib/store.ts`) e o `supabase-js` nem sequer é descarregado.
Este documento explica como pôr a base de dados real a funcionar, passo a passo, e o que cada peça faz.

| Pasta / ficheiro | O que é |
| --- | --- |
| `supabase/migrations/*.sql` | Esquema, segurança (RLS), lógica de negócio, Realtime e trabalhos agendados. Aplicar **por ordem**. |
| `supabase/seed.sql` | 162 fichas **fictícias** (demonstração). **Nunca em produção.** |
| `supabase/demo/contas-demo.json` | As 8 contas de demonstração (geradas a partir de `src/data/seed.ts`). |
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
- **Papéis**: `familia` e `lar`, guardados em `perfis_utilizador.role`. O administrador define-os em
  `app_metadata.role` (sincronizado por trigger). No registo, o formulário pode pedir `lar` em
  `user_metadata` — aceitável porque esse papel só permite criar **um rascunho** de ficha, por publicar e
  "pendente". Contas anónimas são sempre `familia`. `user_metadata` nunca é usado em políticas.
- **Dados de saúde (RGPD art. 9.º)** — `perfis_cuidados`: só o próprio utilizador lê/escreve. Uma instituição
  só recebe uma **cópia reduzida** do perfil (`private.snapshot_perfil`: sem coordenadas, raio, id nem datas)
  através de um pedido que a família lhe enviou, com consentimento explícito (`candidaturas.consentimento_em`), e
  **só se a ficha estiver publicada, verificada, tiver gestor e for do mesmo "mundo"** (demonstração ↔ real).
- **Publicar e verificar fichas é sempre decisão do administrador** (secção 6). Mudar nome, morada, contactos,
  licença, natureza, tipo ou acordo com a Segurança Social numa ficha verificada fá-la voltar a "pendente".
- **Minimização**: cancelar um pedido retira de imediato os dados de saúde à instituição (fica nome e idade);
  apagar um perfil minimiza os pedidos já encerrados desse perfil; pedidos recusados são minimizados 30 dias
  depois (pg_cron). As notas do histórico e das notificações vão junto.
- **Dados internos** (`owner_id`, `visualizacoes_30d`, `candidatura_eventos.autor_id`, `avaliacoes.user_id`) não
  são legíveis por `anon`/`authenticated`; o gestor obtém os da sua ficha com a RPC `painel_instituicao()`.

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
- Mudar o papel de alguém: Auth Admin API, `app_metadata.role` (`familia`/`lar`).

---

## 7. Dados de demonstração — NUNCA no projeto de produção

As fichas do seed são fictícias (com selos de verificação e avaliações inventados) e as contas `lar@exemplo.pt`
e `familia@exemplo.pt` têm a palavra-passe **pública** do ecrã de entrada. Use um **ramo** do Supabase
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
   registado primeiro com um desses e-mails não fica com a ficha nem com os pedidos.
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

Estas funções **não** são invocáveis pela Data API (nem pela `service_role`: o schema `private` não está
exposto). Se o pg_cron não existir, a migração apenas avisa; agende então à mão:

```sql
select cron.schedule('encontralar-expirar-propostas', '*/15 * * * *', 'select private.expirar_propostas()');
select cron.schedule('encontralar-minimizar-pedidos', '17 3 * * *', 'select private.minimizar_candidaturas_encerradas(30)');
-- histórico de execuções
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;
```

---

## 9. Regenerar os tipos

`src/lib/database.types.ts` foi escrito à mão a partir das migrações. Depois de migrar, regenere-o com o MCP
(`generate_typescript_types`) ou com `npx supabase@<versão> gen types typescript --project-id kdyvsxzputvuyauddmwg`
e substitua o ficheiro; depois `npm run typecheck`. Os tipos gerados não refletem privilégios por coluna:
`owner_id`, `visualizacoes_30d`, `autor_id` e `avaliacoes.user_id` existem nos tipos mas não podem ser
selecionados pelos clientes (use listas de colunas explícitas e `painel_instituicao()`).

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
- `prototipo.test.ts` — seed + contas de demonstração = `createSeed` (162 fichas e 8 pedidos de ida e volta pelos mappers).

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
- **Avaliações**: hoje qualquer família avalia qualquer ficha publicada (marcada "verificada" se teve vaga
  aceite). Restringir a quem fez um pedido?
- **Fornecedores de autenticação** (só e-mail? Google/Apple?), confirmação de e-mail e duração do JWT.
- **Projeto de demonstração**: ramo do Supabase (plano Pro) ou projeto gratuito à parte?
