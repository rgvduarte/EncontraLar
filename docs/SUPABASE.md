# EncontraLar — base de dados Supabase

Projeto: **`kdyvsxzputvuyauddmwg`** (`https://kdyvsxzputvuyauddmwg.supabase.co`).

Enquanto `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` não estiverem definidas, a app corre em
**modo demonstração** (localStorage, `src/lib/store.ts`) e o `supabase-js` nem sequer é descarregado.
Este documento explica como pôr a base de dados real a funcionar, passo a passo, e o que cada peça faz.

| Pasta / ficheiro | O que é |
| --- | --- |
| `supabase/migrations/*.sql` | Esquema, segurança (RLS), lógica de negócio, Realtime e trabalhos agendados. Aplicar **por ordem**. |
| `supabase/seed.sql` | 162 fichas **fictícias** (demonstração), com o hash do link de confirmação e a modalidade dos 2 lares privados que a escolheram, e 84 pesquisas sem vagas. **Nunca em produção.** |
| `supabase/demo/contas-demo.json` | As 12 contas de demonstração (geradas a partir de `src/data/seed.ts`), incluindo a assistente social e a equipa de terreno. |
| `supabase/demo/utilizadores-demo.sql` | Liga essas contas aos dados de demonstração (pedidos, casos, avaliação, as 6 visitas da equipa, o Acesso Família da família de demonstração). **Nunca em produção.** |
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
- **Papéis**: `familia`, `lar`, `profissional` (assistente social) e `equipa` (equipa de terreno, interna),
  guardados em `perfis_utilizador.role`. O administrador define-os em `app_metadata.role` (sincronizado por
  trigger). No registo, o formulário pode pedir `lar` ou `profissional` em `user_metadata` — aceitável porque
  `lar` só permite criar **um rascunho** de ficha, por publicar e "pendente", e `profissional` só permite criar
  casos (perfis que o próprio escreve) e enviá-los a fichas verificadas, como uma família. **`equipa` nunca vem
  do registo** (em `user_metadata` é ignorado: a conta fica `familia`) nem de uma conta anónima: só do
  administrador, e tirá-lo do `app_metadata` devolve a conta a `familia` (secção 13). A organização do
  profissional (`perfis_utilizador.organizacao`) vem de `app_metadata.organizacao` ou do registo, é validada no
  servidor e **não é editável** pelo utilizador. Contas anónimas são sempre `familia`. `user_metadata` nunca é
  usado em políticas.
- **Privacidade em duas fases (RGPD art. 9.º)** — secção 12: antes de aceitar um pedido, o lar **não lê a
  linha** (nem contacto, nem nome, nem notas, nem mensagem, nem histórico); vê só um resumo sem identificação
  (`pedidos_recebidos()`). Imposto pela política RLS, não pela interface.
- **Dados de saúde (RGPD art. 9.º)** — `perfis_cuidados`: só o próprio utilizador lê/escreve. Uma instituição
  só recebe uma **cópia reduzida** do perfil (`private.snapshot_perfil`: sem coordenadas, raio, id nem datas)
  através de um pedido que a família lhe enviou, com consentimento explícito (`candidaturas.consentimento_em`), e
  **só se a ficha estiver publicada, verificada, tiver gestor e for do mesmo "mundo"** (demonstração ↔ real).
- **Publicar fichas é sempre decisão do administrador** (secção 6). **Verificar** é do administrador ou da
  equipa de terreno, na visita (licença + instalações = selo «Visitada pela equipa», secção 13). O nível público
  «Licença confirmada» exige a ficha verificada ou `licenca_confirmada_em` (a equipa confirmou a licença): o
  número declarado no registo não chega. Mudar nome, morada, contactos, licença, natureza, tipo ou acordo com a
  Segurança Social apaga a licença confirmada e, numa ficha verificada, fá-la voltar a "pendente".
- **Minimização**: cancelar um pedido retira de imediato os dados de saúde à instituição (fica nome e idade);
  apagar um perfil minimiza os pedidos já encerrados desse perfil; pedidos recusados são minimizados 30 dias
  depois (pg_cron). As notas do histórico e das notificações vão junto.
- **Dados internos** (`owner_id`, `visualizacoes_30d`, `confirmacao_token_hash`, `plano`/`plano_desde` — a
  modalidade comercial dos lares privados —, `candidatura_eventos.autor_id`, `avaliacoes.user_id`,
  `avaliacoes.candidatura_id`) não são legíveis por `anon`/`authenticated`; o gestor obtém os da sua ficha com a
  RPC `painel_instituicao()`, a equipa a modalidade de todas com `painel_equipa()` e o autor das avaliações as
  suas com `minhas_avaliacoes()`.
- **Visitas da equipa** (`visitas`): só contas `equipa` as leem (e só as do seu "mundo", demonstração ou real);
  escrita só por `registar_visita()`. Instituições e famílias nunca as leem.
- **Avaliações verificadas**: só pela RPC `avaliar_lar`, por **famílias** que fizeram o pedido e **confirmaram a
  entrada**, uma por pedido (um profissional confirma a entrada em nome da pessoa, mas não avalia). Não há
  escrita direta na tabela.
- **Acesso Família (secção 14)**: a camada viva — que instituições têm vaga e quantos lugares, preços por quarto,
  lista de espera e previsão, frescura das vagas, contactos e morada — **não sai da base de dados** para quem não
  tem acesso completo (famílias com passe em vigor, profissionais, equipa; o dono, só a sua ficha). A vista pública
  só tem a versão grátis; a completa vem de `instituicoes_completas()`; pedidos, visitas e alertas de vaga exigem o
  acesso. Imposto por privilégios de coluna, RLS e funções do servidor, não pela interface.
- **Faturação (secção 15)**: nenhum cliente escreve nas tabelas de dinheiro; o lar lê as suas linhas (sem as
  referências do Stripe/Moloni), a família as suas compras e Fatura-Recibo, só documentos emitidos. As funções
  `servico_*` (contrato das Edge Functions) só correm com a chave secreta (`service_role`), e verificam-no outra vez lá
  dentro. As fichas e contas de demonstração nunca chegam às tarefas em lote nem ao Moloni.
- **RPC sem sessão**: só cinco — `registar_procura` (pesquisa anónima, limitada), `vagas_por_token` e
  `confirmar_vagas_por_token` (link de confirmação das vagas), `disponibilidade_agregada` e `avaliacoes_instituicao`
  (versão grátis do Acesso Família). Para isso `anon` tem `USAGE` no schema `private` e `EXECUTE` **apenas** nas
  cinco funções internas correspondentes e em `private.resumo_publico` (faixa de preço e contagens de avaliações da
  vista pública) — o teste de migrações falha se `anon` ganhar `EXECUTE` em mais alguma.

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
| `20261013100000_equipa_modalidade_tipos.sql` | Valores novos dos enums: `role_utilizador` `equipa`, `taxa_entrada` `incluida` (ficheiro à parte, pela mesma razão do `0700`). |
| `20261013100100_equipa_modalidade.sql` | Equipa de terreno e modalidade (secção 13): `instituicoes.plano`/`plano_desde`, `escolher_plano_instituicao`, taxa `incluida`, papel `equipa`, tabela `visitas`, `registar_visita`, `painel_equipa`, `painel_instituicao` com a modalidade, `licenca_confirmada_em` (também na vista pública). |
| `20261013110000_acesso_familia.sql` | Acesso Família no servidor (secção 14): `acessos_familia`, `tem_acesso_completo`, `estender_acesso`, `acesso_estado`; vista pública só com a versão grátis (`faixa_preco`, `extras_nomes`, contagens de avaliações); `instituicoes_completas`, `disponibilidade_agregada`, `avaliacoes_instituicao`; quartos, saídas e avaliações só com acesso; pedidos, visitas e alertas de vaga só com acesso. Sem valores novos em enums existentes (por isso sem ficheiro `_tipos`). |
| `20261013120000_faturacao.sql` | Faturação (secção 15): contratos, dados fiscais, contestações, subscrições, pagamentos e consentimentos do Acesso Família, faturas, linhas, documentos fiscais (fila), eventos do Stripe; `faturacao_resumo`, `guardar_dados_faturacao`, `contestar_entrada`, `acesso_estado` com os pagamentos, `marcar_entrada` (retira a contestação) e as RPC `servico_*` do contrato das Edge Functions. Só tipos novos (sem `_tipos`). |
| `20261013120100_faturacao_agendamento.sql` | pg_net (se existir), `private.invocar_faturacao` (Vault → `faturar-mes`), retenção dos eventos do Stripe e os 3 trabalhos do pg_cron da faturação. Sem pg_net/Vault/segredos, não faz nada. |

As migrações já aplicadas **nunca se editam**: qualquer mudança é um ficheiro novo com um prefixo maior (hoje, maior
do que `20261013120100`).

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
- Contas `equipa` (equipa de terreno): **só** pelo administrador — Auth Admin API com `app_metadata: { role:
  'equipa' }` e o e-mail confirmado. Não há registo público para este papel. Os gestores das instituições que
  aderem numa visita recebem um **convite por e-mail** (secção 13, TODO), nunca uma palavra-passe provisória.

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
- Mudar o papel de alguém: Auth Admin API, `app_metadata.role` (`familia`/`lar`/`profissional`/`equipa`); a
  organização de um profissional em `app_metadata.organizacao` (`{ "nome": "…", "tipo": "hospital" |
  "centro_saude" | "autarquia" | "outro", "servico": "…" }`).
- **Equipa de terreno**: dar o acesso = `app_metadata.role = 'equipa'`; tirá-lo (saída da equipa) = mudar o papel
  ou apagá-lo do `app_metadata` (a conta volta a `familia`) e terminar as sessões (os tokens já emitidos valem até
  expirarem — secção 4). A conta de demonstração da equipa só vê e só visita fichas de demonstração.
- Licença confirmada no registo da Segurança Social (sem visita), como `postgres`:
  `update public.instituicoes set licenca_confirmada_em = now() where id = 'lar-x';` (nível «Licença confirmada»).
- Modalidade fora das regras (exceção comercial acordada, ex.: sair da mensalidade antes dos 12 meses), como
  `postgres`: `update public.instituicoes set plano = 'por_entrada', plano_desde = now() where id = 'lar-x';`
  (só lares privados: a base de dados recusa uma modalidade numa IPSS/Misericórdia).
- Links de confirmação das vagas para o envio periódico (SMS/e-mail): `select private.emitir_token_confirmacao('lar-x')`
  (como `postgres`, num trabalho de servidor) devolve o token **uma vez** e guarda só o hash; validade de 30 dias
  (`confirmacao_token_expira_em`). O gestor também gera um link novo no painel (`renovar_token_confirmacao()`),
  o que invalida o anterior.

---

## 7. Dados de demonstração — NUNCA no projeto de produção

As fichas do seed são fictícias (com selos de verificação e avaliações inventados) e as contas `lar@exemplo.pt`,
`familia@exemplo.pt`, `social@exemplo.pt` e `equipa@exemplo.pt` têm a palavra-passe **pública** do ecrã de
entrada. Os links de confirmação das fichas de demonstração usam os tokens do protótipo (`tokenConfirmacao`,
previsíveis a partir do id): numa base de demonstração qualquer pessoa pode "confirmar" vagas de fichas fictícias
— mais uma razão para nunca carregar o seed em produção (lá os tokens são aleatórios, ≈ 244 bits). Use um **ramo** do Supabase
(`create_branch` no MCP, plano Pro) ou um **projeto à parte**.

Mesmo que sejam carregados por engano, ficam isolados: `instituicoes.demonstracao = true` e
`perfis_utilizador.demonstracao = true` — contas reais não enviam pedidos a fichas de demonstração, contas de
demonstração não enviam pedidos nem avaliações a fichas reais, fichas sem gestor não recebem pedidos, e a conta de
demonstração da equipa não lê visitas reais nem regista visitas a fichas reais (nem a equipa real a fichas de
demonstração).
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
   O script recusa o projeto principal (salvo `--projeto-principal`) e **não altera contas que já existam**. A conta
   `equipa@exemplo.pt` leva `app_metadata.role = 'equipa'`, como as outras levam o seu papel (o script tem de aceitar
   os quatro papéis de `contas-demo.json`).
3. **Ligar** as contas aos dados: corra `supabase/demo/utilizadores-demo.sql` como `postgres` (SQL Editor do
   ramo). O script recusa contas sem `app_metadata.role` ou com o e-mail por confirmar — quem se tenha
   registado primeiro com um desses e-mails não fica com a ficha nem com os pedidos. Liga também a assistente
   social (organização, 3 casos e 4 encaminhamentos), as entradas registadas, a avaliação verificada (a
   importada pelo seed passa a pertencer à família que confirmou a entrada) e as 6 visitas da equipa de terreno no
   distrito do Porto. A modalidade dos dois lares privados que a escolheram (o de demonstração, por entrada, e um
   na mensalidade) e a licença confirmada das fichas "pendentes" (há 45 dias, como no protótipo) já vêm do
   `seed.sql`. Uma base de demonstração carregada antes de `20261013100100` não as ganha ao repetir o seed (as
   fichas já existem: `on conflict do nothing`): crie um ramo novo.
   A família de demonstração (`familia@exemplo.pt`) fica com o **Acesso Família** (passe de 90 dias, com o mesmo fim
   relativo do protótipo: termina 80 dias depois de o script correr). Este passo corre antes da saída "já ligados":
   repetir o script numa base de demonstração já ligada dá o passe (ou renova-o, se já tiver terminado) sem mexer em
   mais nada. Para ver a versão grátis numa base de demonstração, entre sem sessão ou com outra conta de família.
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
| `encontralar-faturar-diario` | `13 6 * * *` | `private.invocar_faturacao('diario')` → Edge Function `faturar-mes` (secção 15). |
| `encontralar-cobrar-mes` | `7 7 1 * *` | `private.invocar_faturacao('cobranca')` → `faturar-mes` (dia 1, depois da diária). |
| `encontralar-limpar-eventos-stripe` | `29 3 * * *` | `private.limpar_stripe_eventos(90)`: eventos do webhook aplicados há mais de 90 dias. |

Estas funções **não** são invocáveis pela Data API (nem pela `service_role`: o schema `private` não está
exposto). Se o pg_cron não existir, a migração apenas avisa; agende então à mão:

```sql
select cron.schedule('encontralar-expirar-propostas', '*/15 * * * *', 'select private.expirar_propostas()');
select cron.schedule('encontralar-minimizar-pedidos', '17 3 * * *', 'select private.minimizar_candidaturas_encerradas(30)');
select cron.schedule('encontralar-limpar-procuras', '41 3 * * *', 'select private.limpar_procuras_anonimas(365)');
select cron.schedule('encontralar-faturar-diario', '13 6 * * *', 'select private.invocar_faturacao(''diario'')');
select cron.schedule('encontralar-cobrar-mes', '7 7 1 * *', 'select private.invocar_faturacao(''cobranca'')');
select cron.schedule('encontralar-limpar-eventos-stripe', '29 3 * * *', 'select private.limpar_stripe_eventos(90)');
-- histórico de execuções
select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 20;
```

---

## 9. Regenerar os tipos

`src/lib/database.types.ts` foi escrito à mão a partir das migrações. Depois de migrar, regenere-o com o MCP
(`generate_typescript_types`) ou com `npx supabase@<versão> gen types typescript --project-id kdyvsxzputvuyauddmwg`
e substitua o ficheiro; depois `npm run typecheck`. Os tipos gerados não refletem privilégios por coluna nem
RLS: `owner_id`, `visualizacoes_30d`, `confirmacao_token_*`, `plano`, `plano_desde`, `autor_id`,
`avaliacoes.user_id` e `avaliacoes.candidatura_id` existem nos tipos mas não podem ser selecionados pelos
clientes (use listas de colunas explícitas, `painel_instituicao()`, `painel_equipa()` e `minhas_avaliacoes()`);
`procuras_anonimas` aparece nos tipos mas só se usa pelas RPC; `visitas` só devolve linhas a contas `equipa`. Os
tipos de retorno `PedidoRecebido`, `VagasPorToken`, `PlanoDaInstituicao`, `InstituicaoCompleta` e
`AvaliacaoInstituicao` (no topo do ficheiro escrito à mão) passam a vir inline no ficheiro gerado.
Acesso Família: as colunas `morada`, `codigo_postal`, `telefone`, `email`, `website`, `lista_espera_offline`,
`lista_espera_online`, `estadia_media_meses`, `extras`, `atualizado_em` e `updated_at` de `instituicoes` estão nos tipos
mas não são legíveis por `anon`/`authenticated` (use `instituicoes_completas()`); `quartos`, `saidas_mensais` e
`avaliacoes` não são legíveis por `anon` e, para as contas, só devolvem linhas com acesso completo (ou do dono).
Faturação: as colunas `stripe_*`, `moloni_*`, `externo_id`, `emissor`, `cliente`, `chave`, `tentativas`… aparecem nos
tipos mas não são legíveis pelos clientes (secção 15); os clientes não escrevem em nenhuma das tabelas; as funções
`servico_*` e `resolver_contestacao` estão nos tipos (o gerador inclui tudo o que está em `public`) mas só a
`service_role` as executa. Os tipos da app para a página Faturação (`ResumoFaturacao`…) vivem em
`supabase-mappers.ts`, porque o resumo chega como `Json`.

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
- `terreno.test.ts` — equipa de terreno e modalidade (espelha `src/lib/visitas.test.ts`): o papel `equipa` só
  pelo administrador (registo, conta anónima, retirar o papel), quem regista e lê visitas (e o isolamento
  demonstração ↔ real), selo e licença confirmada, vagas e preços só confirmados, cuidados, IPSS sem modalidade,
  dados mal formados, compromisso na adesão; a licença declarada no registo não conta (só a confirmada pela equipa,
  que a mudança da identidade apaga); a modalidade invisível para anon, famílias, outras instituições e o próprio
  dono na tabela, `escolher_plano_instituicao` (só o dono de um privado, mesma modalidade, compromisso com a data
  no erro), a natureza que deixa de ser privada; taxa `aplicavel`/`incluida`/`isenta` fixada na primeira
  confirmação; a migração sobre uma base já em uso.
- `acesso.test.ts` — Acesso Família (secção 14): anon, famílias sem passe ou com o passe terminado e outras
  instituições não leem nenhuma coluna nem valor da camada completa por nenhum caminho (tabela, vista, RPC, quartos,
  saídas, avaliações); famílias com passe, profissionais e equipa leem tudo (a conta de demonstração com passe só as
  fichas de demonstração); o dono, a sua ficha; o passe termina no instante `ate`; `estender_acesso` = `novoAte` (soma
  ao fim em vigor, ou a partir de agora; só servidor); `acesso_estado`; a faixa de preço; os agregados = `resumoDisponibilidade`
  do protótipo em todos os distritos e concelhos do seed (ficha a ficha, com as constantes da previsão), `null`
  abaixo de 5; pedidos, visitas e alertas recusados sem passe (e livres com ele; cancelar, responder a uma vaga e
  confirmar a entrada continuam livres); avisos de vaga (quem segue só com acesso; a lista de espera sempre); um só
  excerto de avaliação na versão grátis (o mesmo corte da ficha); a migração sobre uma base já em uso.
- **Faturação (secção 15)** — `faturacao-conformidade.test.ts` (os mesmos cenários na BD falsa das Edge Functions e no
  SQL, comparados passo a passo: resultado de cada RPC e estado inteiro), `faturacao-fluxos.test.ts` (os handlers
  verdadeiros das Edge Functions contra o SQL: compra do Acesso Família, mês por entrada com contestação, mensalidade),
  `faturacao-regras.test.ts` (paridade SQL ↔ regras puras: IVA, NIF, região, datas de Lisboa com a mudança de hora,
  matriz de `classificarEntrada`), `faturacao.test.ts` e `faturacao-lares.test.ts` (RPC dos donos e da família,
  contestações, fila, cobranças, subscrições, demonstração, minimização, escrita), `faturacao-agendamento.test.ts`
  (pg_cron → pg_net com o Vault; retenção; a migração sobre uma base em uso). Partilham `faturacao-bd.ts` (as portas
  `PortaBD`/`PortaUtilizador` sobre o PGlite, a montagem nas duas bases e o estado canónico) e `faturacao-contexto.ts`.
  `bootstrap.sql` imita também o pg_net (`net.http_post` → `net.pedidos_teste`) e o Vault — só em testes.
- `prototipo.test.ts` — seed + contas de demonstração = `createSeed`: a vista pública = a projeção grátis do protótipo
  (`larPublicoDe`, com a faixa, os níveis de verificação e o excerto), `instituicoes_completas()` (pela família de
  demonstração, com passe) = as 162 fichas completas (com os níveis de verificação); o passe da família de
  demonstração (`acesso_estado` = `useAcesso`); 14 pedidos (lidos por quem os fez e, no painel do lar, só o resumo
  dos que não foram aceites), 3 casos, procura
  do distrito, link de confirmação, a modalidade (pela gestora e pela equipa) e as 6 visitas (só pela equipa), de
  ida e volta pelos mappers; a gestora muda para a mensalidade (entrada seguinte `incluida`) e a equipa regista uma
  adesão.

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
- ~~**Avaliações**: qualquer família avaliava qualquer ficha~~ — decidido no modelo de negócio: só famílias que
  confirmaram a entrada, uma por pedido (`avaliar_lar`); os profissionais não avaliam.
- **Profissionais registados por conta própria** (fica assim por agora): a organização ("Hospital X") é declarada
  no registo e mostrada ao lar no resumo do pedido, sem verificação. Validar mais tarde (domínio de e-mail
  institucional, aprovação pelo administrador) antes de a interface a destacar.
- **Limites de pedidos dos profissionais** (fica assim por agora): os mesmos de uma família (20 por dia, 3 por
  instituição). Uma assistente social com muitos casos pode vir a precisar de mais.
- **Procura anónima**: a repetição é filtrada por 10 minutos (sem identificar quem pesquisa) e há limites
  globais (60/min, 300/h por distrito). Se for preciso mais rigor contra robôs, um CAPTCHA ou uma Edge Function
  à frente da RPC.
- **Fornecedores de autenticação** (só e-mail? Google/Apple?), confirmação de e-mail e duração do JWT.
- **Projeto de demonstração**: ramo do Supabase (plano Pro) ou projeto gratuito à parte?
- **Visitas e avisos de vaga** (fica como no protótipo): quando a equipa confirma mais lugares livres do que a ficha
  tinha, `registar_visita` atualiza as vagas mas não avisa as famílias em lista de espera nem quem segue a ficha
  (o lar, com `definir_vagas`, avisa). Se o cliente quiser, basta chamar `private.avisar_nova_vaga` por tipo de
  quarto que subiu.
- **Coordenadas na versão grátis** (fica como no protótipo): a pesquisa grátis mostra os alfinetes nas coordenadas da
  instituição, por isso `lat`/`lng` são públicas (a ficha grátis só mostra o mapa da zona, mas a pesquisa já as dá). Se
  o cliente quiser a localização exata só com o Acesso Família, primeiro o mapa da pesquisa grátis passa a posições
  aproximadas (ex.: centro do concelho) e depois a vista pública deixa de ter `lat`/`lng` (ou arredonda-as).
- **Contagens agregadas e diferenças** (secção 14): `disponibilidade_agregada` esconde as contagens abaixo de 5 fichas,
  mas a diferença entre o distrito e os seus concelhos com 5 ou mais fichas pode dizer quantas têm vaga num concelho
  pequeno (com uma só casa, qual). O protótipo tem o mesmo limite. Se for preciso mais rigor: supressão
  complementar (esconder também o concelho cujo resto do distrito tenha menos de 5) ou ruído nas contagens.
- **Fichas por publicar e a equipa**: a equipa só vê na pesquisa as fichas publicadas (RLS), por isso visita as do
  catálogo; um rascunho registado por um lar é publicado pelo administrador antes da visita. O selo da equipa
  passa a ficha a "verificada" — com gestor e publicada, recebe pedidos (e dados de saúde). Se o cliente quiser uma
  segunda verificação, o selo pode passar a "pendente" até o administrador confirmar.

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
| `candidaturas.entrada_data`, `entrada_confirmada_lar_em`, `entrada_confirmada_familia_em`, `entrada_taxa` | Entrada na instituição (estado `admitida`); `entrada_taxa` = `aplicavel` (privado por entrada), `incluida` (privado com mensalidade, desde `20261013100100`) ou `isenta` (IPSS/Misericórdia). |
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
   consentimento) — `aceitar_candidatura` recusa-os. É a mesma regra do protótipo: `contactoVisivel(c)` =
   `!!c.desbloqueadaEm` (`src/lib/negocio.ts`), e o seed regista `desbloqueadaEm` em todos os pedidos que avançaram.
4. **Rotas dos avisos**: os avisos a quem fez o pedido levam ao painel da família ou, num encaminhamento, ao caso
   (`/casos/<caso_id>`, também nos avisos de vaga e de prazo terminado); os do lar abrem o pedido
   (`/gestao/pedidos?pedido=<id>`).
5. **Sem fugas laterais**: os avisos ao lar de pedidos por aceitar não têm nomes ("Pedido de vaga de uma família
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
| `marcar_entrada(id, data)` | lar (dono) | Só de `aceite`/`admitida`; `admitida`, confirmação do lar, taxa pela natureza e pela modalidade (secção 13); avisa o autor. Data não futura nem anterior ao pedido. |
| `confirmar_entrada_familia(id, data)` | autor do pedido | O mesmo do outro lado; avisa o lar. A primeira confirmação fixa a data e a taxa. |
| `avaliar_lar(candidatura_id, nota, texto, aspetos)` | família autora do pedido | Só contas `familia` e só com a entrada confirmada pela família; uma por pedido; `verificada`; atualiza média e total. |
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

---

## 13. Equipa de terreno, modalidade dos lares privados, taxa incluída e licença confirmada (`20261013100000` e `20261013100100`)

Contrato: `docs/MODELO-NEGOCIO.md` (decisões de 13/10/2026). O que o protótipo faz em `src/lib/store.ts`
(`escolherPlanoInstituicao`, `registarVisita`, `useVisitas`, `registarConfirmacaoEntrada`), `src/lib/acesso.ts`
(`compromissoAte`, `podeMudarPlano`) e `src/lib/negocio.ts` (`taxaPara`, `niveisVerificacao`) passa a ser imposto
pela base de dados.
Os **valores** (150 € + IVA por entrada, 29 € + IVA por mês) não vivem na base de dados (nem nos comentários, que o
PostgREST pode expor): só no painel privado, nos ecrãs da equipa e na faturação.

### Tabelas, colunas e tipos novos

| Tabela / coluna / tipo | O que é |
| --- | --- |
| `plano_instituicao` | `por_entrada` (por omissão) ou `mensal` (compromisso de 12 meses). |
| `instituicoes.plano`, `plano_desde` | Modalidade de um lar **privado** e desde quando vigora. `null` = por entrada (como `planoInstituicao` ausente no protótipo). Restrições: só privados (`instituicoes_plano_so_privados`) e sempre com a data (`instituicoes_plano_com_data`). Se a ficha deixa de ser privada (o dono corrige a natureza), a modalidade apaga-se (trigger). **Interno**: fora da vista pública, sem privilégio de leitura ou escrita para `anon`/`authenticated`. |
| `instituicoes.licenca_confirmada_em` | A equipa confirmou a licença (no registo da Segurança Social ou na visita). **Público** (vista e tabela): nível «Licença confirmada» = licença preenchida e (ficha `verificado` ou esta data). Sem ela, o número é só declarado. Só o servidor a escreve (`registar_visita`, administrador); um cliente que a tente escrever recebe erro, e mudar a identidade ou os contactos da ficha apaga-a. |
| `taxa_entrada` `incluida` | Entrada num lar privado com mensalidade: sem taxa por entrada. |
| `role_utilizador` `equipa` | Equipa de terreno (conta interna). |
| `resultado_visita` | `aderiu`, `interessado`, `voltar`, `recusou`. |
| `visitas` | Uma visita (`Visita` no protótipo): ficha, conta da equipa (`equipa_id`), `data`, `resultado`, o que foi confirmado (`licenca_confirmada`, `instalacoes_vistas`, `vagas_confirmadas`, `precos_confirmados`), responsável (`responsavel_nome`, `_cargo`, `_telefone`, `_email`), `plano` (só na adesão de um privado), `notas`, `proximo_contacto` (só `interessado`/`voltar`), `conta_criada_id` (preenchido pelo convite, ver TODO), `demonstracao` (o "mundo" da ficha). |

### Quem lê e escreve o quê

| | anon | família / profissional | lar (gestor) | equipa |
| --- | --- | --- | --- | --- |
| `instituicoes.plano`, `plano_desde` | — | — | a sua, em `painel_instituicao()`; muda com `escolher_plano_instituicao` | todas as do seu "mundo", em `painel_equipa()`; muda na adesão (`registar_visita`) |
| `visitas` | — (sem privilégio) | — (0 linhas) | — (0 linhas, nem as da sua ficha) | lê as do seu "mundo"; escreve só por `registar_visita` |
| `painel_equipa()` | — | vazio | vazio | uma linha por ficha: `tem_gestor`, `plano`, `plano_desde`, `compromisso_ate` |

O "mundo" é `demonstracao`: a conta de demonstração da equipa (palavra-passe pública) só vê e só visita fichas de
demonstração; a equipa real só as reais (`private.mundo_equipa()`, na política de `visitas` e em `painel_equipa`).

### Regras

1. **Papel `equipa`**: só por `app_metadata.role` (administrador). `user_metadata.role = 'equipa'` no registo é
   ignorado (conta `familia`); uma conta anónima nunca é da equipa; apagar ou mudar o papel no `app_metadata` tira-o
   (a conta passa a `familia` — sem isto, o acesso ficava esquecido em `perfis_utilizador`). As RPC da equipa
   recusam sessões anónimas.
2. **Modalidade** (`escolher_plano_instituicao`, como `escolherPlanoInstituicao`): só o dono (`lar`) de um lar
   **privado** (IPSS/Misericórdia → "As IPSS e Misericórdias não têm custos."). A mesma modalidade não muda nada
   (nem a data). Para a mensalidade, sempre; de volta à taxa por entrada só no fim do compromisso — senão o erro diz
   a data ("A mensalidade tem um compromisso de 12 meses: pode mudar a partir de 13 de outubro de 2027."). Cada
   mudança regista `plano_desde = now()`. O fim do compromisso (`private.compromisso_ate`) é o mesmo instante de
   `compromissoAte` no protótipo (12 meses na hora de Lisboa; 29 de fevereiro passa a 1 de março).
3. **Taxa da entrada**: a primeira confirmação (do lar ou da família) fixa-a com a modalidade em vigor nesse momento
   (`private.taxa_para(instituicao)`, como `taxaPara(lar)`): privado + mensalidade → `incluida`; privado por entrada →
   `aplicavel`; IPSS/Misericórdia → `isenta`. Mudar de modalidade depois não altera entradas já confirmadas. A
   leitura da ficha é feita com a linha bloqueada, por isso uma mudança de modalidade simultânea espera.
4. **Visita** (`registar_visita`, como `registarVisita`): só contas `equipa`, só fichas do seu "mundo"; bloqueia a
   ficha e depois os quartos (a ordem das outras RPC).
   - licença confirmada → `licenca_confirmada_em = now()` (nível «Licença confirmada»); `p_licenca` atualiza o n.º;
   - licença **e** instalações confirmadas → também o selo «Visitada pela equipa»: `verificado`,
     `verificacao_data = now()`; só a licença não muda o estado da verificação;
   - `p_quartos` só nas partes confirmadas (vagas e/ou preços), por tipo de quarto que a ficha já tem (o primeiro de
     cada tipo): livres entre 0 e o total; preços inteiros, o máximo nunca abaixo do mínimo; renova a frescura;
   - `p_cuidados` substitui a lista; `aderiu` num privado → modalidade (por omissão, por entrada);
   - o próximo contacto só fica para `interessado`/`voltar`; textos aparados, email em minúsculas e validado;
   - com o selo, o gestor (se houver) recebe "Visitada pela equipa" (`/gestao/ficha`);
   - a visita **não publica** a ficha (publicar continua a ser do administrador).

   Duas diferenças em relação ao `registarVisita` do protótipo, de propósito: na adesão, a modalidade respeita o
   compromisso (como já faz o formulário da visita — mensalidade → por entrada só no fim dos 12 meses) e repetir a
   modalidade em vigor **não recomeça** o compromisso (o protótipo regista `planoDesde` em todas as adesões).

### RPC novas (todas `SECURITY DEFINER` em `private`, invólucro `SECURITY INVOKER` em `public`)

| RPC | Quem | Faz |
| --- | --- | --- |
| `escolher_plano_instituicao(p_plano)` | lar (dono de um privado) | Muda a modalidade (regras acima). Devolve `instituicao_id`, `plano`, `plano_desde`, `compromisso_ate`. |
| `registar_visita(p_instituicao_id, p_resultado, p_verificacao, p_licenca, p_responsavel, p_plano, p_notas, p_proximo_contacto, p_quartos, p_cuidados)` | equipa | Regista a visita e aplica-a à ficha (regras acima). `p_verificacao` = `{ licenca_confirmada, instalacoes_vistas, vagas_confirmadas, precos_confirmados }`; `p_responsavel` = `{ nome, cargo, telefone, email }`; `p_quartos` = `[{ tipo, livres, preco_min, preco_max }]`. Devolve a visita (selo = licença e instalações). |
| `painel_equipa()` | equipa | Por ficha do seu "mundo": se tem gestor e a modalidade em vigor, com o fim do compromisso. |
| `painel_instituicao()` (alterada) | lar | Ganha `plano`, `plano_desde` e `compromisso_ate`. |

### Do protótipo para o Supabase

| Função do store | Supabase | Mapper (`src/lib/supabase-mappers.ts`) |
| --- | --- | --- |
| `escolherPlanoInstituicao(plano)` | `rpc('escolher_plano_instituicao', { p_plano })` | `planoDeLinha` |
| `lar.planoInstituicao` / `planoDesde` (dono) | `rpc('painel_instituicao')` + a sua ficha em `rpc('instituicoes_completas')` | `painelDeLinha(r).dono` → `larDeLinha(linha, reviews, dono)` |
| `lar.planoInstituicao` / `ownerId` (equipa) | `rpc('painel_equipa')` | `painelEquipaDeLinha` (`temGestor`, `dono`) |
| `registarVisita(input)` | `rpc('registar_visita', visitaParaRpc(input))` | `visitaDeLinha`; `selo` = licença e instalações confirmadas |
| `useVisitas()` | `from('visitas').select('*').order('data', { ascending: false })` | `visitaDeLinha` |
| `lar.verificacao.licencaConfirmadaEm` | `licenca_confirmada_em` em `instituicoes_publicas` e em `instituicoes_completas()` | `larPublicoDeLinha` (→ `niveisDeLarPublico`) / `larDeLinha` (→ `niveisVerificacao`) |
| `registarVisita({ criarConta: true })` | Edge Function de convite (TODO abaixo) | — |

### TODO (produção) — conta do responsável na adesão: convite por Edge Function

A conta do responsável **não é criada em SQL**: criar utilizadores exige a Auth Admin API (chave secreta), que
nunca vai para o navegador nem para a base de dados. A palavra-passe provisória mostrada uma vez é **só do
protótipo**. Na produção:

1. O formulário da visita chama `registar_visita` e, se o responsável quiser a conta (`criarConta`, só na adesão
   e com a ficha sem gestor), chama uma Edge Function `convidar-gestor` com `{ visita_id }` e o JWT da equipa.
2. A Edge Function (Deno, chave secreta só nas variáveis do servidor):
   - valida o JWT e confirma que a conta é `equipa` (`perfis_utilizador.role`) e do mesmo "mundo" da ficha;
   - lê a visita: `resultado = 'aderiu'`, `responsavel_email` preenchido, ficha ainda sem gestor (`owner_id is null`);
   - convida: `auth.admin.inviteUserByEmail(email, { data: { role: 'lar', nome, telefone }, redirectTo })` (o perfil e o
     aviso de boas-vindas nascem logo no convite, já como `lar`) e `auth.admin.updateUserById(id, { app_metadata:
     { role: 'lar' } })` — o papel fica também definido pelo administrador;
   - liga a conta, numa transação: `instituicoes.owner_id = id` e `visitas.conta_criada_id = id`;
   - e-mail que já tem conta: não liga nada sozinha — devolve o caso à equipa (ligar uma conta existente a uma
     ficha é decisão do administrador, como no `utilizadores-demo.sql`).
3. O gestor define a palavra-passe ao aceitar o convite (PKCE: no mesmo navegador — diga-o no e-mail). O aviso do
   selo foi para o gestor que já existia; um gestor convidado depois recebe o de boas-vindas.
4. Até lá, o administrador cria a conta pela Auth Admin API (`app_metadata: { role: 'lar' }`) e liga-a à ficha
   (`update public.instituicoes set owner_id = '<uuid>' where id = 'lar-x'`).

### Faturação

Desenhada e implementada na secção 15. A taxa de cada entrada fica fixada na primeira confirmação
(`entrada_taxa`), por isso faturar por entrada não precisa de um histórico das modalidades; a mensalidade vem da
subscrição do Stripe (`subscricoes_instituicao`).

---

## 14. Acesso Família no servidor (`20261013110000`)

Contrato: `docs/MODELO-NEGOCIO.md` (modelo de dois lados) e o que a versão grátis da interface mostra
(`src/features/lar-detail`, `src/features/search`, `src/lib/acesso.ts`). Até aqui a divisão era só de apresentação:
qualquer pessoa lia vagas, preços por quarto, contactos e as entradas da previsão na vista pública, por isso vender o
passe não fazia sentido. Agora a camada viva **não sai da base de dados** para quem não tem acesso.

### Quem tem acesso completo

`private.tem_acesso_completo(uid default auth.uid())`, o `temAcessoCompleto` do protótipo:

| Conta | Acesso completo |
| --- | --- |
| `profissional` (assistente social) | sempre, sem custos |
| `equipa` (equipa de terreno) | sempre (confirma vagas e preços nas visitas) |
| `familia` | enquanto `acessos_familia.ate > now()` (passe em vigor) |
| `lar` (instituição) | nunca: vê a versão grátis das outras fichas; a **sua** ficha vê-a sempre inteira (`instituicoes_completas`, `painel_instituicao`, as suas linhas de quartos, saídas e avaliações) |
| anon | nunca |

As contas de demonstração (palavra-passe pública) só têm a camada completa das fichas de demonstração: o mesmo
isolamento dos pedidos e das visitas. Uma linha em `acessos_familia` de uma conta que não é `familia` não dá acesso.

### Público vs completo

| | Versão grátis (anon, famílias sem passe, instituições) | Acesso completo |
| --- | --- | --- |
| Quem existe, nome, tipo, natureza, localidade, concelho, distrito, região | `instituicoes_publicas` | idem |
| Coordenadas (`lat`, `lng`) | públicas: a pesquisa grátis mostra os alfinetes (a ficha grátis só a zona) — secção 11 | idem |
| Resumo, descrição, capacidade, incluído, graus, cuidados, comodidades, equipa, fundação, capa | públicos | idem |
| Verificação (estado, data, licença, licença confirmada, última inspeção) | públicos (níveis de verificação) | idem |
| Avaliação geral e nº de avaliações; publicadas e verificadas | `avaliacao_media`, `num_avaliacoes`, `avaliacoes_publicadas`, `avaliacoes_verificadas` | idem |
| Avaliações | **um** excerto (a verificada mais recente, senão a mais recente; 240 carateres; sem notas por aspeto) — `avaliacoes_instituicao()` | todas, completas (`avaliacoes_instituicao()` ou a tabela) |
| Preço | **faixa** (`faixa_preco`: `ate_1000`, `1000_2000`, `mais_2000`, `conforme_rendimentos`), como `faixaPreco` | quartos com preço mínimo e máximo, `mensalidade_min/max` |
| Extras | só os nomes (`extras_nomes`) | com os valores (`extras`) |
| Vagas, lugares livres por quarto, lista de espera | — (só as contagens agregadas por zona) | `quartos`, `vagas_livres`, `lista_espera` |
| Previsão (estadia média, histórico de saídas) e frescura das vagas | — | `estadia_media_meses`, `historico_saidas`, `atualizado_em` |
| Contactos e morada | — | `morada`, `codigo_postal`, `telefone`, `email`, `website` |
| Pedidos a várias casas, visitas, alertas de vaga | recusados pela BD (42501, `hint = 'acesso_familia'`) | permitidos |

Como é imposto (desenho): **privilégios por coluna** na tabela `instituicoes` (as colunas da camada completa deixam
de ser legíveis por `anon`/`authenticated`; `extras_nomes` é uma coluna gerada, pública), **RLS** nas tabelas que são
inteiras da camada completa (`quartos`, `saidas_mensais`, `avaliacoes`: sem privilégio para `anon`; para as contas, só
com `tem_acesso_completo()`, o dono e — nas avaliações — o autor) e uma **RPC `SECURITY DEFINER`** para a ficha
inteira. Porquê assim:

- a vista pública continua `security_invoker` e simples (só colunas públicas da tabela), por isso os filtros do
  PostgREST continuam a usar os índices; o que ela calcula a partir de dados fechados (faixa de preço e contagens de
  avaliações) vem de uma função pequena (`private.resumo_publico`) que só devolve esses valores genéricos;
- os privilégios por coluna não dependem do passe (são por papel), por isso a ficha inteira não pode vir da tabela
  para as famílias com passe: vem de `instituicoes_completas()`, que verifica o acesso no servidor e devolve a forma
  da antiga vista pública (o `larDeLinha` não muda);
- quartos, saídas e avaliações continuam legíveis na tabela com acesso completo, por isso o **Realtime dos quartos**
  (vagas em direto) só chega a quem tem acesso — a versão grátis nunca recebe os lugares livres.

### Regras

1. **Passe** (`acessos_familia`: `user_id`, `plano` `acesso_30`/`acesso_90`, `ate`, `criado_em`, `atualizado_em`): o
   próprio lê a sua linha; ninguém a escreve diretamente (nem a `service_role`). `private.estender_acesso(user_id,
   plano)` é a única escrita: soma os dias (30 ou 90, de 24 h exatas) ao fim em vigor ou, se não houver ou já terminou,
   a partir de agora — o `novoAte` do protótipo; bloqueia a linha (duas compras simultâneas somam as duas) e avisa a
   família ("Acesso Família ativo — tem acesso completo até …; não há renovação automática"), como `comprarAcessoDemo`.
   Só `service_role`/`postgres` a executam. O acesso termina no instante `ate` (sem renovação automática).
2. **Ficha completa** (`instituicoes_completas(p_ids)`): com acesso completo, as fichas publicadas (contas de
   demonstração: só as de demonstração); o dono sem acesso, só a sua (publicada ou não); outras contas → erro 42501
   (`hint = 'acesso_familia'`); `anon` nem a executa. `p_ids` (opcional) limita às fichas indicadas.
3. **Agregados** (`disponibilidade_agregada(p_distrito, p_concelho)`): fichas publicadas do distrito (ou do concelho do
   distrito; os dois a `null` = o país) → `total`, `com_vaga`, `breve`; `com_vaga` e `breve` a `null` com menos de 5
   fichas (`MIN_AGREGADO`). Um concelho exige o distrito (há nomes repetidos: Calheta). Definições de
   `src/lib/forecast.ts`, ficha a ficha:
   - `com_vaga` = `vagaParaNovos`: lista efetiva (40 % da lista, arredondada) abaixo dos lugares livres;
   - `breve` = sem lugares livres e P(vaga em 90 dias) ≥ 50 % (`disponibilidade = 'breve'`); uma ficha com lugares livres
     já prometidos à lista não conta em nenhum dos dois (como `resumoDisponibilidade`);
   - P(vaga) = `poissonAtLeast(lista efetiva + 1, Λ)`, com a taxa de `taxaSaidasMensal` (metade histórico dos últimos 12
     meses, metade residentes ÷ estadia média, mínimo 6) e a sazonalidade de `SAZONALIDADE`, a partir de hoje (Lisboa).
   - **Aproximação**: o protótipo soma Λ dia a dia (`taxa × fator ÷ dias do mês`); a BD calcula `taxa × Σ(fator ÷ dias do
     mês)` — a mesma conta com outra ordem de arredondamento (≈ 1e-14), sem efeito no limiar de 50 %. O teste compara
     ficha a ficha e zona a zona com o protótipo, no seed inteiro.
   - Limite conhecido: diferenças entre zonas (secção 11).
4. **Avaliações** (`avaliacoes_instituicao(p_instituicao_id)`): ficha publicada (ou a do dono); com acesso completo ou
   para o dono, todas (da mais recente para a mais antiga, `excerto = false`); senão no máximo uma, a verificada mais
   recente (senão a mais recente), com o texto em excerto (`private.excerto_avaliacao` = `excertoAvaliacao`: 240
   carateres, corte numa palavra, "…") e as notas por aspeto a `null` (`excerto = true`). Na tabela, `anon` não lê nada.
5. **Ações pagas**:
   - `candidatar` (pedido, com ou sem visita) e `pedir_visita` (também num pedido já feito): sem acesso completo → 42501,
     "Os pedidos de vaga e as visitas fazem parte do Acesso Família.", `hint = 'acesso_familia'`;
   - continuam livres, mesmo com o passe terminado: cancelar o pedido, responder a uma vaga proposta, confirmar a entrada,
     avaliar — são do pedido que a família já fez;
   - favoritos: guardar é livre; sem acesso o alerta fica desligado ao guardar (o valor por omissão `true` só vale com
     acesso, como `toggleFavorito`); ligar o alerta num favorito guardado → 42501 (`hint = 'acesso_familia'`); um
     *upsert* com `alerta = true` fica desligado; desligar e apagar, sempre;
   - os profissionais (acesso completo) enviam casos como antes (`enviar_caso`).
6. **Avisos de vaga** (`avisar_nova_vaga`): quem está na lista de espera é sempre avisado (já tem uma relação com a
   instituição); quem segue a ficha com alerta só com acesso completo no momento do aviso (senão o aviso diria quais têm
   vaga) e, numa conta de demonstração, só de fichas de demonstração. Um alerta ligado com o passe fica ligado quando o
   passe termina e volta a avisar com um passe novo.

### RPC novas (todas `SECURITY DEFINER` em `private`, invólucro `SECURITY INVOKER` em `public`)

| RPC | Quem | Faz |
| --- | --- | --- |
| `acesso_estado()` | conta com sessão | `{ completo, ativo, ate, plano, pagamentos }` (os pagamentos do passe: secção 15). |
| `instituicoes_completas(p_ids)` | acesso completo; o dono (a sua) | A ficha inteira, com a forma da antiga vista pública. |
| `disponibilidade_agregada(p_distrito, p_concelho)` | **anon** e todos | Contagens da zona; `null` abaixo de 5 fichas. |
| `avaliacoes_instituicao(p_instituicao_id)` | **anon** e todos | Todas (acesso completo / dono) ou um excerto (versão grátis). |
| `private.estender_acesso(user_id, plano)` | só servidor | Soma os dias do passe (`novoAte`) e avisa a família. |

### Do protótipo para o Supabase (como a interface muda quando ligar)

A regra é uma: **`useAcesso().completo` escolhe a chamada e o mapper**. Sem sessão não se chama `acesso_estado`: é a
versão grátis.

| Protótipo | Supabase | Mapper (`src/lib/supabase-mappers.ts`) |
| --- | --- | --- |
| `useAcesso()` | `rpc('acesso_estado')` (com sessão) | `acessoDeLinha` → `{ completo, ativo, ate, plano, diasRestantes, pagamentos }` |
| `useLares()` / `useLar(id)` com `completo` | `rpc('instituicoes_completas')` / `rpc('instituicoes_completas', { p_ids: [id] })` + avaliações | `larDeLinha` (→ `Lar`) |
| `useLares()` / `useLar(id)` sem `completo` | `from('instituicoes_publicas').select('*')` (+ `rpc('avaliacoes_instituicao', { p_instituicao_id })` na ficha) | `larPublicoDeLinha(linha, destaque)` (→ `LarPublico`); destaque por `avaliacaoInstituicaoDeLinha` |
| `lar.reviews` (ficha completa) | `rpc('avaliacoes_instituicao', { p_instituicao_id })` ou `from('avaliacoes').select(COLUNAS_AVALIACAO)` | `avaliacaoInstituicaoDeLinha` / `reviewDeLinha` |
| `faixaPreco(lar)` na versão grátis | `instituicoes_publicas.faixa_preco` | `faixaPrecoTexto(l.faixaPreco)` (o mesmo texto de `faixaPreco`) |
| `niveisVerificacao(lar)` na versão grátis | `licenca_confirmada_em`, `verificacao_*`, `avaliacoes_verificadas` | `niveisDeLarPublico(l)` |
| `resumoDisponibilidade(lares)` (versão grátis: página inicial, quadro de vagas, pesquisa, questionário) | `rpc('disponibilidade_agregada', { p_distrito, p_concelho })` | `disponibilidadeDeLinha` (`null` = mostrar só o total) |
| `candidatar(...)` / `pedirVisita(...)` sem acesso | erro 42501 com `hint = 'acesso_familia'` | abrir a folha do Acesso Família (`AcessoNecessarioModal`) em vez de mostrar o erro |
| `toggleFavorito` / `setAlerta(id, true)` sem acesso | o insert grava `alerta = false`; o update dá 42501 (`acesso_familia`) | `favoritoDeLinha` (ler o `alerta` devolvido) |
| `comprarAcessoDemo(plano, metodo)` | Stripe Checkout (Edge Function da faturação); o passe só muda por `estender_acesso` | `acessoDeLinha` depois do regresso |
| Realtime de `quartos` | só chega com acesso completo (RLS) | — |
| Ficha do próprio lar (painel, pré-visualização) | `rpc('instituicoes_completas')` (devolve só a sua) + `painel_instituicao` | `larDeLinha(linha, reviews, painelDeLinha(p).dono)` |

Notas para a interface (o protótipo calcula tudo no navegador, a versão com servidor não pode):

- **Contagens da pesquisa grátis**: hoje a versão grátis conta "x com vaga agora" sobre o conjunto filtrado (raio,
  filtros). No servidor só há contagens por zona (distrito/concelho/país): uma RPC com um conjunto livre de ids
  permitiria saber o estado de cada casa por diferença (o conjunto com e sem ela), por isso não existe. A pesquisa grátis
  deve mostrar a contagem da zona (ou nenhuma) quando filtra por raio ou por outros critérios.
- **Questionário grátis** (`src/features/match`): o protótipo calcula a compatibilidade com os preços por quarto e as
  vagas; na versão grátis com servidor só há a faixa de preço, os graus, os cuidados e a distância.
- **Excerto**: o texto de `avaliacoes_instituicao` na versão grátis já vem cortado — mostrar tal como vem (cortá-lo
  outra vez, se tiver mais de 240 carateres sem espaços, mudaria o texto).
- `registar_procura(p_com_vaga)`: na versão grátis o navegador não sabe quantas têm vaga — enviar 0 (ou a contagem da zona).
- `LarPublico` não tem `reviews`, `quartos`, `mensalidadeMin`, `atualizadoEm`, `telefone`… — os componentes da versão
  grátis passam a receber `LarPublico` (`larPublicoDe(lar)` dá o mesmo objeto no modo demonstração).

### Ganchos para a faturação (feitos na secção 15)

- O pagamento confirmado (cartão, MB WAY, ou Multibanco pago) chama `private.estender_acesso(user_id, plano)` uma vez
  por pagamento (operação `acesso_pago` do webhook). O aviso "Acesso Família ativo" vem daqui: a faturação não o repete.
  Um reembolso **não** encurta o acesso (decisão de operações: playbook).
- `private.acesso_estado()` devolve agora os `pagamentos_familia` do próprio (`AcessoEstadoRpc` em `portas.ts`).
- Contas de demonstração: o passe da família de demonstração vem de `utilizadores-demo.sql`, nunca de um pagamento.

---

## 15. Faturação: base de dados (`20261013120000` e `20261013120100`)

Três fluxos de dinheiro (decisões de 13/10/2026, `docs/MODELO-NEGOCIO.md`; desenho: plano v1 e v2):

| Fluxo | Quem | Como paga | Documento (Moloni) |
| --- | --- | --- | --- |
| Acesso Família | família | Stripe Checkout, pagamento único (cartão, MB WAY, Multibanco) | Fatura-Recibo (FR) por compra, NIF opcional |
| Lar privado, por entrada | empresa | cobrança mensal no Stripe, débito SEPA (cartão ou link como alternativa) | FT por entrada faturável + RC quando paga |
| Lar privado, mensalidade | empresa | subscrição Stripe Billing, 29 € + IVA, compromisso de 12 meses | FT por fatura da subscrição + RC quando paga |

IPSS, Misericórdias e profissionais nunca pagam. **Esta fase é só modo de teste**: Stripe de teste e o emissor falso
(`FATURACAO_EMISSOR=falso`), sem dinheiro real nem Moloni.

**O contrato** entre as Edge Functions (`supabase/functions`) e a base de dados é
`supabase/functions/_shared/portas.ts`: nomes das RPC e dos argumentos, formas JSON, códigos de erro (`42501` → 403,
`22023` → 409, `P0002` → 404; qualquer outro é erro interno) e o vocabulário de operações do webhook. As funções foram
testadas contra uma BD falsa (`supabase/tests/funcoes/fakes.ts::BDFalsa`); o SQL comporta-se como ela — os testes de
conformidade correm os mesmos cenários nas duas e comparam passo a passo — e é mais robusto onde ela simplifica
(concorrência, bloqueios, RLS: ver "Diferenças", abaixo).

### Tabelas

| Tabela | O que guarda | Quem lê (RLS + colunas) | Quem escreve |
| --- | --- | --- | --- |
| `contratos` | taxa por entrada (150 € por omissão), IVA e região fiscal, período (sem sobreposição) | o dono do lar, sem `notas` | a equipa (`postgres`) |
| `dados_faturacao` | razão social, NIF (domínio `public.nif`), morada fiscal, email; cliente e método do Stripe; resumo do método | o dono, sem `stripe_*`/`moloni_*` | `guardar_dados_faturacao` (dono); Stripe/método só o servidor |
| `contestacoes_entrada` | contestação de uma entrada confirmada só pela família | o dono do lar (a família não: tabela à parte, sem evento no histórico) | `contestar_entrada`, `resolver_contestacao`, `marcar_entrada` |
| `subscricoes_instituicao` | a subscrição da mensalidade (uma por lar) | o dono, sem `stripe_subscription_id` | servidor |
| `pagamentos_familia` | compras do Acesso Família: plano, valor, método, estado, sessão/PI do Stripe, referência Multibanco, NIF/nome da FR, reembolso, documento | a família, sem `stripe_*` nem `demonstracao` | servidor (`servico_acesso_*`, webhook) |
| `consentimentos_acesso` | versão do texto, quando, IP truncado (um por pagamento) | a família: versão e hora | servidor |
| `faturas` | cobranças no Stripe (mensal das entradas ou fatura da subscrição) — documento de cobrança, não a fatura legal | o dono, sem rascunhos nem `stripe_*`/`tentativas`/`divergente` | servidor |
| `fatura_linhas` | uma linha por entrada faturada (referência `EL-XXXXXXXX`, data, valor, IVA da linha); anular permite refaturar | o dono | servidor (equipa: anular) |
| `documentos_fiscais` | FT, FR, RC, NC e a **fila de emissão** (outbox): chave única, cliente, linhas, pagamento, totais, número, id no emissor | só **emitidos**: o lar as suas FT/RC, a família as suas FR; poucas colunas (sem `externo_id`, `cliente`, `chave`…) | servidor |
| `stripe_eventos` | eventos do webhook (idempotência e auditoria) | ninguém | servidor |
| `private.execucoes_faturacao` | arrendamento das tarefas (`diario`, `cobranca`) e o último resumo | ninguém | servidor |
| `private.alertas_faturacao` | alertas para a equipa (playbook) | `postgres` | servidor |

Chaves estrangeiras para `instituicoes` nas tabelas fiscais: `on delete restrict` (as faturas guardam-se 10 anos: um
lar com faturas despublica-se, não se apaga). `fatura_linhas.candidatura_id` é `on delete set null` (apagar a conta
da família apaga os pedidos; a linha guarda a referência e a data). `pagamentos_familia.user_id` e
`documentos_fiscais.user_id` são `on delete set null` pela mesma razão.

### Regras

- **Estado de uma entrada** (`private.classificar_entrada`, igual a `classificarEntrada` em `_shared/faturacao/regras.ts`,
  provado numa matriz de 1 920 casos): `por_confirmar` → `isenta` → `incluida` → `faturada` → `fora_janela` →
  `dispensada` (contestação aceite) → `contestada` (aberta) → `faturavel` desde a confirmação do lar → desde a decisão
  (contestação rejeitada) → desde `familia_em + 14 dias` → senão `a_aguardar`. `isenta` e `incluida` vêm antes de
  `faturada`: nunca faturam. `private.entradas_faturacao(lar, agora)` aplica-a a todas as entradas (o `agora` é um
  argumento: a regra dos 14 dias testa-se sem mexer no relógio).
- **14 dias em hora de parede de Lisboa** (`private.fim_contestacao`), com as regras do `Date` do ECMAScript na mudança
  de hora (hora repetida de outubro → a primeira; o Postgres sozinho daria a de inverno). **Janela de atribuição**: a
  entrada até ao dia do pedido em Lisboa + 365 dias.
- **Valor da linha**: o contrato em vigor na data da entrada (senão o de hoje); sem contrato, 150 € e o IVA da região
  fiscal do código postal da morada fiscal (9000–9499 Madeira 22 %, 9500–9999 Açores 16 %, resto 23 %). **IVA por linha**,
  `round(valor × taxa / 100)`; nos passes das famílias o IVA (23 %) está incluído e separa-se ao cêntimo (1490 → 279,
  2990 → 559).
- **Passes** (`private.preco_plano_familia`): 1490 / 30 dias e 2990 / 90 dias; `servico_acesso_iniciar` grava o valor e
  `acesso_pago` recusa (exceção: o evento repete-se e a equipa vê-o) um valor pago diferente.
- **Demonstração**: as RPC de contexto (`servico_contexto_instituicao`, `servico_subscricao_contexto`,
  `servico_acesso_iniciar`) devolvem `demonstracao` (a função recusa-a em produção); as de lote (reservar, pendentes,
  preparar, a debitar, a sincronizar) excluem-na sempre. Os documentos de uma conta ou ficha de demonstração ficam
  `demonstracao = true`, nunca saem da fila e a base de dados recusa marcá-los como emitidos pelo Moloni.
- **Minimização**: as linhas dos documentos são estruturadas (`{tipo: 'entrada', referencia, entrada_data, valor,
  iva}`, `{tipo: 'mensalidade', periodo…}`, `{tipo: 'acesso', plano…}`); as descrições fazem-se em TypeScript a partir
  delas (`documentos.ts`). Nunca nomes, notas, necessidades nem o nome do lar.

### RPC

Dono de um lar e família (invólucros `SECURITY INVOKER` em `public`, lógica `SECURITY DEFINER` em `private`):

| RPC | Quem | Faz |
| --- | --- | --- |
| `faturacao_resumo()` | dono (não anónimo); senão 42501 | `ResumoFaturacaoRpc`: plano, compromisso, subscrição, contrato, dados, método, próxima cobrança (linhas reservadas + entradas faturáveis, com o débito previsto ao fim do pré-aviso), entradas com o estado e a contestação, faturas (sem rascunhos) com os documentos. IPSS: `isenta` e o resto vazio. → `faturacaoDeResumo` |
| `guardar_dados_faturacao(...)` | dono de um lar privado | Valida (NIF B2B como `nif.ts`, código postal, email) com mensagens em português; normaliza o NIF (`PT 599 999 993` → `599999993`). → `dadosFaturacaoParaRpc` |
| `contestar_entrada(p_candidatura_id, p_motivo)` | dono | Só uma entrada `aplicavel` confirmada só pela família, dentro dos 14 dias e da janela, sem contestação nem linha; motivo 10–1000 carateres. Avisa o lar ("Contestação recebida"). |
| `acesso_estado()` | conta com sessão | Também `pagamentos` (os 50 mais recentes): `multibanco` só com referência, `documento {id, numero, emitido_em}` só com a FR emitida, `motivo_falha`. → `acessoDeLinha` |
| `marcar_entrada` (substituída) | dono | Como antes, e uma contestação aberta passa a `retirada` (fatura-se desde a marcação). |

Servidor (só `service_role`; `private.exigir_servico()` volta a verificar lá dentro): `servico_iniciar_execucao`,
`servico_terminar_execucao`, `servico_contexto_instituicao`, `servico_definir_cliente_stripe`,
`servico_reservar_documentos`, `servico_documentos_pendentes`, `servico_documento_emitido`, `servico_documento_falhou`,
`servico_documento_externo`, `servico_preparar_cobrancas`, `servico_cobranca_criada`, `servico_cobrancas_a_debitar`,
`servico_cobranca_debito_iniciado`, `servico_evento_iniciar`, `servico_evento_aplicar`, `servico_evento_falhou`,
`servico_acesso_iniciar`, `servico_acesso_sessao_criada`, `servico_subscricao_contexto`, `servico_subscricao_registar`,
`servico_subscricoes_a_sincronizar` e `resolver_contestacao` (equipa). Assinaturas e formas: `portas.ts`.

### Webhook (`servico_evento_iniciar` / `_aplicar` / `_falhou`)

`iniciar` devolve `repetido` só se o evento já foi aplicado (um que falhou volta a ser `novo`, com `tentativas + 1`).
`aplicar` bloqueia o evento (duas entregas simultâneas aplicam uma vez), aplica as operações **por ordem numa
transação** e carimba `processado_em`; uma exceção desfaz tudo e o Stripe volta a tentar (`falhou` guarda o erro, sem
dados pessoais). Operações (idempotentes; transições inválidas e referências desconhecidas ignoradas):

| Operação | Efeito |
| --- | --- |
| `acesso_pago` | pagamento pela sessão (ou pelo `pagamento_id` da metadata, que lhe liga a sessão); valor tem de bater; `pago`, `private.estender_acesso` **uma vez**, FR `FR:pag:<id>` na fila (cliente: NIF/nome ou consumidor final). Um pagamento já pago ou reembolsado não muda. |
| `acesso_a_aguardar` | Multibanco: `a_aguardar_pagamento` com entidade, referência e validade (só de `pendente`). |
| `acesso_falhou` / `acesso_expirado` | `falhou` com o motivo normalizado / `expirado` (só de `pendente`). |
| `acesso_reembolsado` | marca o valor reembolsado (e `reembolsado` se total) e alerta a equipa; **não** encurta o acesso. |
| `subscricao_estado` | cria/atualiza a subscrição do lar; não substitui outra ainda viva (alerta `subscricao_conflito`); metadata de outro lar → alerta `metadata_divergente`, sem aplicar. |
| `fatura_estado` | pela fatura do Stripe (ou `metadata.fatura_id`, se ainda não ligada; outra fatura do Stripe para a mesma cobrança → alerta `fatura_duplicada`). Subscrição desconhecida: cria a fatura (29 € + IVA do lar) e a FT `FT:sub:<invoice>` — total diferente → `divergente`, sem FT, alerta; a primeira fatura antes do registo liga-se pela metadata (`incompleta`). Transições do v1; `paga` põe o RC (ou FR no modo `fatura_recibo_mensal`) na fila; `falhou` avisa o lar e a equipa; `anulada` alerta a equipa. |
| `metodo_definido` / `metodo_removido` | resumo do método (SEPA: últimos 4, banco, mandato; cartão: validade) pelo cliente Stripe / limpa-o, avisa o lar e alerta. |
| `disputa` | alerta para a equipa (reembolso SEPA de 8 semanas ou disputa de cartão). |

### Fila de documentos (outbox)

- Os documentos nascem `pendente` na mesma transação do facto: FT por entrada em `servico_reservar_documentos` (modo
  `fatura_por_entrada`), FT global na cobrança (`fatura_mensal`), FT da mensalidade no webhook, RC/FR quando a fatura é
  paga, FR do Acesso Família no `acesso_pago`.
- `servico_documentos_pendentes(p_agora, p_limite)` devolve os prontos (FT/FR antes de RC; um RC só depois de todas as
  FT da sua fatura emitidas; nunca NC nem demonstração) e **reserva-os 10 minutos** (o webhook e a tarefa diária não
  emitem o mesmo documento em duplicado; se a função morrer, voltam depois disso).
- `servico_documento_falhou` → `erro` com recuo exponencial (15 min, 30 min, 1 h… até 24 h); à 10.ª tentativa alerta
  `documento_bloqueado`. `servico_documento_emitido` confere o total e o IVA com os esperados (exceção se diferirem),
  é idempotente (e alerta `documento_duplicado` se o emissor devolver outro id para o mesmo documento) e avisa o lar
  ("Fatura emitida") numa FT.

### Cobranças das entradas (dia 1)

`servico_preparar_cobrancas` cria uma fatura `rascunho` por lar (sem demonstração, com cliente Stripe) com as linhas
por cobrar — no modo por entrada **só as que já têm a FT emitida** (nunca se cobra uma fatura que ainda não existe; as
outras ficam para o mês seguinte) — e **devolve outra vez os rascunhos** de uma execução que caiu antes de
`servico_cobranca_criada` (retoma). Uma cobrança das entradas por lar e mês. `servico_cobranca_criada` liga a fatura
do Stripe (recusa outra), passa a `emitida` e avisa o lar ("Cobrança de outubro de 2026: … por débito direto a …").
`servico_cobrancas_a_debitar` devolve as `emitida` com débito automático vencido; `servico_cobranca_debito_iniciado`
regista o resultado de `invoices.pay`.

### Tarefas agendadas (pg_cron → pg_net → `faturar-mes`)

`private.invocar_faturacao(fase)` lê do **Vault** `encontralar_url_projeto` (tem de ser `https://<ref>.supabase.co`;
outro URL dá erro, visível no histórico do pg_cron) e `encontralar_segredo_cron`, e chama
`POST /functions/v1/faturar-mes {"fase": …}` com o cabeçalho `x-encontralar-cron` — nunca a chave de serviço (o pg_net
guarda os cabeçalhos na sua fila; o segredo do cron só dispara trabalho idempotente). Sem pg_net, Vault ou segredos,
não faz nada (só um aviso). Configurar (SQL Editor, como `postgres`):

```sql
select vault.create_secret('https://kdyvsxzputvuyauddmwg.supabase.co', 'encontralar_url_projeto');
select vault.create_secret('<o mesmo valor de FATURACAO_CRON_SECRET>', 'encontralar_segredo_cron');
-- correr à mão / ver o resultado
select private.invocar_faturacao('diario');
select id, status_code, content::text from net._http_response order by created desc limit 5;
select * from private.execucoes_faturacao;   -- arrendamentos e o último resumo (só contagens)
```

### Diferenças em relação à BD falsa (o SQL é mais robusto; testes próprios)

| Onde | BD falsa | SQL |
| --- | --- | --- |
| Contestações | ignora-as | contam (`contestada`, `dispensada`, faturável desde a decisão) |
| Valor da entrada | sempre 150 € e o IVA do lar | o contrato em vigor na data da entrada |
| `servico_preparar_cobrancas` | cobra linhas com a FT por emitir; não retoma | só FT emitidas; devolve os rascunhos (retoma); modos mensais criam as linhas |
| Fila | devolve tudo sempre; documentos de demonstração incluídos | reserva de 10 min, recuo exponencial, sem demonstração nem NC |
| Ids do Stripe | sobrepõe | recusa/alerta (fatura ligada a outra, cobrança duplicada, subscrição viva, metadata de outro lar) |
| Concorrência | — | bloqueios por linha (evento, pagamento, fatura, pedido com `skip locked`), índice único de uma linha ativa por entrada |
| NIF da família | guarda o texto | normaliza; 999999990 = sem NIF |
| Compras iniciadas | sem limite | no máximo 10 por hora e por conta |

Conflitos com o contrato: nenhum — o SQL implementa `portas.ts` tal como está; as diferenças acima são comportamentos
mais seguros dentro das mesmas formas e códigos de erro.

### Playbook de operações (como `postgres`, no SQL Editor)

```sql
-- alertas por resolver (reembolso, disputa, pagamento_falhou, metodo_removido, subscricao_divergente,
-- subscricao_conflito, metadata_divergente, fatura_duplicada, fatura_anulada, documento_duplicado, documento_bloqueado)
select id, tipo, ref, dados, criado_em from private.alertas_faturacao where resolvido_em is null order by criado_em;
update private.alertas_faturacao set resolvido_em = now(), nota = 'Tratado: …' where id = 123;

-- contrato de um lar privado (a taxa por entrada e o IVA da região)
insert into public.contratos (instituicao_id, referencia, taxa_entrada_centimos, iva_percent, regiao_fiscal, inicio)
values ('lar-x', 'CT-2026-001', 15000, 23, 'continente', '2026-11-01');
```

- **Contestações** (SLA a definir; o lar foi avisado): ver as abertas —
  `select c.candidatura_id, c.instituicao_id, c.motivo, c.contestada_em from public.contestacoes_entrada c where c.estado = 'aberta';`
  — e decidir: `select public.resolver_contestacao('<candidatura>', 'aceite', 'Nota para o lar');` (não se fatura) ou
  `'rejeitada'` (fatura-se na tarefa diária seguinte). O lar é avisado. Uma contestação aceite depois de faturada não
  existe (a contestação só é possível antes da linha).
- **Reembolsos às famílias** (falha técnica, ou não conseguiu usar o acesso nas primeiras 48 h): reembolsar no painel do
  Stripe → `charge.refunded` marca `reembolsado` e alerta. A FR emitida anula-se com uma **nota de crédito** no Moloni e
  regista-se: `insert into public.documentos_fiscais (tipo, origem, estado, chave, user_id, pagamento_id, documento_origem_id,
  data, cliente, linhas, total_centimos, iva_centimos, numero, externo_id, emissor, emitido_em) …` (valores negativos).
  O acesso não encurta sozinho; se for preciso, `update public.acessos_familia set ate = now() where user_id = '…';`.
- **Fatura anulada no Stripe** (`fatura_anulada`): as linhas ficam ligadas a ela. Para voltar a cobrar: anular as
  linhas e emitir NC das FT (`update public.fatura_linhas set anulada_em = now(), motivo_anulacao = '…' where fatura_id = '…';`
  — a entrada volta a `faturavel` e a tarefa diária refatura-a com uma chave nova); para perdoar: NC das FT e anular as
  linhas com uma contestação aceite registada pela equipa.
- **Pagamento falhado**: o lar foi avisado e paga na página da fatura (`url_pagamento`) ou a equipa volta a debitar no
  Stripe (o webhook atualiza). Disputa SEPA (8 semanas): alerta `disputa`; tratar com o lar.
- **Documento bloqueado**: ver `ultimo_erro`, corrigir a causa (credenciais do Moloni, dados do cliente) e voltar a
  tentar já: `update public.documentos_fiscais set proxima_tentativa_em = now() where id = '…';`. Duplicado no emissor:
  anular um com NC.
- **Subscrição divergente** (rateio, cupão): a fatura não tem FT; emitir à mão no Moloni ou acertar no Stripe.
- **Arranque**: as entradas anteriores ao início da faturação que não se querem faturar ficam dispensadas com uma
  contestação aceite registada pela equipa (antes de ligar o cron):
  `insert into public.contestacoes_entrada (candidatura_id, instituicao_id, estado, motivo, resolvida_em, nota_resolucao)
   select id, instituicao_id, 'aceite', 'Entrada anterior ao início da faturação.', now(), 'Arranque' from public.candidaturas
   where entrada_taxa = 'aplicavel' and entrada_data < '2026-11-01';`

### Ordem para ligar (go-live)

1. Migrações `20261013120000` e `20261013120100` (`db push`); `db advisors` (as tabelas `stripe_eventos` e `private.*`
   sem políticas são esperadas).
2. Ativar pg_net e confirmar o pg_cron e o Vault; **ainda sem** os segredos do Vault (o cron não faz nada).
3. Stripe em **modo teste**: métodos, produtos fixos, webhook e chave restrita (`supabase/functions/README.md`); segredos das
   Edge Functions com `STRIPE_MODO=teste` e `FATURACAO_EMISSOR=falso`; publicar as funções.
4. Contratos e dados de faturação dos lares-piloto; decidir as entradas anteriores ao arranque (playbook).
5. Segredos do Vault → o cron começa. Ensaio completo num ramo/projeto de teste: compra (cartão, MB WAY, Multibanco),
   mês por entrada, mensalidade, reembolso, contestação.
6. Moloni: conta, série comunicada à AT, credenciais e ids (`MOLONI_*`); verificar cada endpoint numa série de testes.
7. Ligar a interface (`faturacaoDeResumo`, `acessoDeLinha`, as funções `acesso-checkout`, `faturacao-*`, `plano-instituicao`).
8. Produção: `STRIPE_MODO=producao`, chave `rk_live_…`, webhook de produção, `FATURACAO_EMISSOR=moloni` (a configuração
   recusa `falso` em produção). Contabilista: as perguntas de `supabase/functions/README.md`.
