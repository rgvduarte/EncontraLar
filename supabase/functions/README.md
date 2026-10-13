# Edge Functions do EncontraLar

Funções Supabase (Deno) do servidor. Por agora há só as de faturação, em **modo de teste**: Stripe em modo
teste e um emissor de faturas falso. Nada aqui foi executado contra o Stripe, o Moloni ou o Supabase reais
(o ambiente de desenvolvimento não chega a esses serviços): tudo está provado offline, com testes vitest.

## Faturação: funções

Três fluxos de dinheiro (desenho: `plano-faturacao.md` v1 e v2; contrato com a base de dados:
[`_shared/portas.ts`](_shared/portas.ts)):

| Fluxo | Quem paga | Como | Documento fiscal |
|---|---|---|---|
| Acesso Família | família | Stripe Checkout, pagamento único: cartão, MB WAY, Multibanco | Fatura-Recibo (FR) por compra, NIF opcional |
| Lar privado, por entrada | empresa | cobrança mensal Stripe, débito SEPA (ou cartão / link) | FT por entrada faturável + RC quando paga |
| Lar privado, mensalidade | empresa | subscrição Stripe Billing, 29 € + IVA, SEPA (ou cartão) | FT por fatura da subscrição + RC quando paga |

IPSS, Misericórdias e profissionais de saúde nunca pagam nem recebem documentos.

### Organização

```
supabase/functions/
  deno.json                 mapa de importações (stripe e supabase-js nas versões do package.json)
  _shared/                  TypeScript PURO: sem Deno.*, sem npm:/jsr:, importações relativas com .ts
    faturacao/              planos (valores = src/lib/acesso.ts), dinheiro (IVA ao cêntimo), nif, regiao,
                            referencia (EL-XXXXXXXX), datas (Europe/Lisbon), regras (estado das entradas,
                            mudança de modalidade), documentos (FT/FR/RC, descrições minimizadas),
                            emissor (EmissorFaturas + EmissorFalso), orquestrador (tarefas diária e mensal)
    stripe/                 versao (SDK 23.0.0, API 2026-09-30.endive), porta (as chamadas que fazemos),
                            parametros (pedidos exatos), eventos (evento → operações), motivos, webhook
    moloni/                 pedidos (construtores) e cliente (MoloniEmissor com fetch injetado)
    http/                   cors, respostas, segredo (comparação em tempo constante), pedido (corpo, IP)
    funcoes/                os handlers puros (Request → Response) de cada função, testados
    config.ts               lerConfig(env) → configuração tipada ou lista de problemas
    portas.ts               CONTRATO: RPC, argumentos, formas JSON, operações do webhook
    erros.ts                texto seguro de um erro para os registos
    deno/                   ÚNICO sítio com npm:/Deno.*: stripe.ts, supabase.ts, arranque.ts (fora do tsc)
  acesso-checkout/index.ts       ┐
  faturacao-checkout/index.ts    │
  faturacao-portal/index.ts      │  index.ts finos: configuração + adaptadores + handler puro
  faturacao-documento/index.ts   │
  plano-instituicao/index.ts     │
  stripe-webhook/index.ts        │
  faturar-mes/index.ts           ┘
```

Testes: `supabase/tests/funcoes/*.test.ts` (vitest). `fakes.ts` tem a **BD falsa, que é a implementação de
referência do contrato** — o SQL tem de se comportar como ela.

### As funções

| Função | Autenticação | O que faz |
|---|---|---|
| `acesso-checkout` | JWT do utilizador | Valida plano e consentimento (versão em vigor), NIF opcional; `servico_acesso_iniciar` (só famílias, não anónimas; regista consentimento com IP truncado e pagamento `pendente`); cria a Checkout Session (`mode: payment`, cartão + MB WAY + Multibanco, `locale: pt`, expira em 1 h); `servico_acesso_sessao_criada`; devolve `{ url }`. Conta de demonstração em produção → 403. |
| `faturacao-checkout` | JWT do utilizador | Posse por `faturacao_resumo()`; cria/atualiza o cliente Stripe do lar (NIF como `eu_vat`); Checkout em modo `setup` (SEPA ou cartão) → `{ url }`. |
| `faturacao-portal` | JWT do utilizador | Customer Portal do Stripe para o lar → `{ url }`. |
| `faturacao-documento` | JWT do utilizador | `{ documento_id }` → o RLS prova a posse (lar: FT/RC; família: FR) → link do PDF no emissor. |
| `plano-instituicao` | JWT do utilizador | `{ plano }`: decide como a BD (mensalidade só com método; voltar à taxa por entrada só depois dos 12 meses, com a mesma mensagem), chama `escolher_plano_instituicao`, e cria ou cancela a subscrição. Se o Stripe falhar, a tarefa diária reconcilia. |
| `stripe-webhook` | assinatura Stripe (`--no-verify-jwt`) | Verifica a assinatura (`constructEventAsync` + SubtleCrypto, tolerância 5 min), recusa `livemode` do outro modo, idempotente (`stripe_eventos`), aplica as operações numa transação e emite logo os documentos da fila. |
| `faturar-mes` | cabeçalho `x-encontralar-cron` (`--no-verify-jwt`) | `{ fase: 'diario' }`: FT das entradas faturáveis, fila de documentos, débitos SEPA vencidos, reconciliação das mensalidades. `{ fase: 'cobranca' }` (dia 1): uma cobrança Stripe por lar. Responde 202 e trabalha em `EdgeRuntime.waitUntil`. |

### Segredos (Supabase → Edge Functions → Secrets; são do projeto, valem para todas as funções)

| Variável | Quem usa | Notas |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | todas | injetadas pelo Supabase (verificar os nomes com as chaves novas `SUPABASE_SECRET_KEYS`) |
| `SUPABASE_ANON_KEY` | funções com JWT | idem |
| `STRIPE_SECRET_KEY` | todas | chave restrita `rk_test_…` (teste) / `rk_live_…` (produção); tem de bater com `STRIPE_MODO` |
| `STRIPE_MODO` | todas | `teste` \| `producao` |
| `STRIPE_WEBHOOK_SECRET` | `stripe-webhook` | `whsec_…` do endpoint |
| `STRIPE_PAIS_TRANSFERENCIA` | `faturar-mes` | opcional (transferência por `customer_balance`; PT não é suportado: BE, DE, ES, FR, IE, NL) |
| `APP_URL` | todas | URL da app (https; com a barra final do GitHub Pages). O regresso do Stripe usa `?acesso=…` / `?faturacao=…` (sem `#`) |
| `APP_ORIGENS` | funções com JWT | origens CORS, separadas por vírgulas |
| `FATURACAO_EMISSOR` | `stripe-webhook`, `faturar-mes`, `faturacao-documento` | `falso` \| `moloni`. **`falso` é recusado com `STRIPE_MODO=producao`.** |
| `FATURACAO_MODO` | `faturar-mes` | `fatura_por_entrada` (omissão) \| `fatura_mensal` \| `fatura_recibo_mensal` |
| `FATURACAO_SEPA_PRE_AVISO_DIAS`, `FATURACAO_DIAS_PAGAMENTO` | `faturar-mes` | 3 e 15 por omissão |
| `FATURACAO_CRON_SECRET` | `faturar-mes` | ≥ 32 caracteres; o mesmo valor vai para o Vault (`encontralar_segredo_cron`) |
| `MOLONI_CLIENT_ID`, `MOLONI_CLIENT_SECRET`, `MOLONI_USERNAME`, `MOLONI_PASSWORD`, `MOLONI_COMPANY_ID`, `MOLONI_DOCUMENT_SET_ID`, `MOLONI_PRODUCT_ID_ENTRADA`, `MOLONI_PRODUCT_ID_MENSALIDADE`, `MOLONI_PRODUCT_ID_ACESSO`, `MOLONI_TAX_ID_23`, `MOLONI_TAX_ID_22`, `MOLONI_TAX_ID_16`, `MOLONI_PAYMENT_METHOD_ID_DEBITO`, `…_CARTAO`, `…_TRANSFERENCIA`, `…_MBWAY`, `…_MULTIBANCO`, `MOLONI_COUNTRY_ID_PT`, `MOLONI_LANGUAGE_ID_PT`, `MOLONI_MATURITY_DATE_ID` | funções que emitem, com `FATURACAO_EMISSOR=moloni` | ids numéricos do Moloni |

`lerConfig` diz quais faltam (sem mostrar valores); uma função mal configurada responde 500 genérico e
regista os problemas.

### Testar localmente

Sem rede nem Deno (o que corre no CI):

```sh
npx tsc --noEmit -p .                    # inclui _shared (exclui _shared/deno e os index.ts)
npx vitest run supabase/tests/funcoes    # regras, Stripe, webhook com assinaturas reais, Moloni, fluxos
```

`fronteira.test.ts` também compila o código Deno (adaptadores e `index.ts`) contra os tipos do SDK do Stripe
e do supabase-js, com um shim mínimo de `Deno`.

Com Deno e rede (fora deste ambiente):

```sh
supabase start
supabase functions serve --env-file supabase/functions/.env.local --import-map supabase/functions/deno.json  # nunca no git
stripe listen --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook   # dá o whsec_ de teste
curl -X POST http://127.0.0.1:54321/functions/v1/faturar-mes \
  -H "x-encontralar-cron: $FATURACAO_CRON_SECRET" -H 'content-type: application/json' -d '{"fase":"diario"}'
```

Cartões e IBAN de teste do Stripe: `4242 4242 4242 4242`, IBAN `PT50000201231234567890154`. MB WAY e
Multibanco têm simulação própria no Checkout de teste.

### Publicar

```sh
supabase secrets set --env-file supabase/functions/.env.local   # ignorado pelo git (.gitignore: .env.local)
supabase functions deploy acesso-checkout     --import-map supabase/functions/deno.json
supabase functions deploy faturacao-checkout  --import-map supabase/functions/deno.json
supabase functions deploy faturacao-portal    --import-map supabase/functions/deno.json
supabase functions deploy faturacao-documento --import-map supabase/functions/deno.json
supabase functions deploy plano-instituicao   --import-map supabase/functions/deno.json
supabase functions deploy stripe-webhook      --import-map supabase/functions/deno.json --no-verify-jwt
supabase functions deploy faturar-mes         --import-map supabase/functions/deno.json --no-verify-jwt
```

Agendamento (migração `…_faturacao_agendamento.sql` do v1): no editor SQL,
`select vault.create_secret('https://<ref>.supabase.co', 'encontralar_url_projeto');` e
`select vault.create_secret('<FATURACAO_CRON_SECRET>', 'encontralar_segredo_cron');`.

**TODO (CI):** acrescentar ao `.github/workflows/deploy.yml` um passo `denoland/setup-deno` (versão exata) +
`deno check --config supabase/functions/deno.json supabase/functions/*/index.ts`, e gerar o `deno.lock`
(`deno cache …`, depois `"lock": true` no `deno.json`). Não foi feito aqui porque não há Deno neste ambiente
para o validar.

### Painel do Stripe (primeiro em modo teste)

1. **Conta** da empresa em Portugal, EUR.
2. **Métodos de pagamento** (Settings → Payment methods): ativar **Cartão**, **MB WAY**, **Multibanco** (famílias)
   e **Débito direto SEPA** (lares). O Checkout usa `allowed_payment_method_types`, que só filtra os métodos
   ativos: um método desligado no painel simplesmente não aparece.
3. **Versão da API**: `2026-09-30.endive` (a do SDK `stripe@23.0.0`; o MB WAY exige `2025-10-29.clover` ou
   posterior). A versão do endpoint do webhook tem de ser esta.
4. **Produtos fixos** (ids escolhidos por nós, usados pela subscrição):
   ```sh
   stripe products create --id=el_mensalidade --name="Mensalidade EncontraLar"
   stripe products create --id=el_iva_23 --name="IVA 23 %"
   stripe products create --id=el_iva_22 --name="IVA 22 %"
   stripe products create --id=el_iva_16 --name="IVA 16 %"
   ```
   Stripe Tax **desligado** (decisão 9 do v1: o IVA vai numa linha explícita para bater ao cêntimo com o Moloni).
5. **Webhook** (Developers → Webhooks): `https://<ref>.supabase.co/functions/v1/stripe-webhook`, versão
   `2026-09-30.endive`, com estes eventos:
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`,
   `charge.dispute.created`, `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `customer.updated`, `invoice.finalized`, `invoice.paid`,
   `invoice.payment_failed`, `invoice.voided`, `payment_intent.processing`, `payment_method.detached`,
   `mandate.updated`.
6. **Chave restrita**: escrita em Checkout Sessions, Customers (inclui tax ids), Customer Portal,
   Subscriptions, Invoices, Invoice Items; leitura em SetupIntents, PaymentIntents, PaymentMethods, Mandates,
   Charges, Invoice Payments.
7. **Customer Portal**: permitir trocar o método de pagamento e ver o histórico; **desligar** a edição dos
   dados do cliente e **o cancelamento de subscrições** (o compromisso de 12 meses é gerido por
   `plano-instituicao`).
8. **Emails**: os recibos do Stripe não são documentos fiscais — desligar ou deixar claro; confirmar os avisos
   prévios de débito SEPA.

### Antes de produção (checklist)

**Stripe — confirmar em modo teste com o painel real:**
- `allowed_payment_method_types` em `mode: payment` e `mode: setup` (substitui `payment_method_types`, removido
  dos parâmetros do Checkout na API endive / SDK 23).
- Multibanco: `checkout.session.completed` com `payment_status: unpaid`, a forma de
  `payment_intent.next_action.multibanco_display_details` e a validade da referência; depois
  `async_payment_succeeded` / `_failed`.
- MB WAY: confirmar se fica `paid` logo no `completed` (o código trata os dois casos).
- `invoices.retrieve` com `expand: ['payments.data.payment.payment_intent.payment_method']` e
  `invoicePayments.list({ payment: { type: 'payment_intent', … } })` (campos novos desde a API basil).
- Subscrição com `price_data` + produtos fixos, duas linhas (29 € + IVA), `payment_behavior: allow_incomplete`
  com SEPA fora de sessão: estado inicial, período da primeira fatura (usamos `lines.data[].period`) e
  `parent.subscription_details.metadata`.
- `invoices.pay` com SEPA devolve `open` enquanto processa; com cartão recusado lança `StripeCardError`.
- `constructEventAsync` + `createSubtleCryptoProvider()` no Edge Runtime; o relógio passa-se em
  **milissegundos** (com segundos o SDK aceitaria assinaturas antigas — há um teste para isso).
- Limites de `EdgeRuntime.waitUntil` (tempo de parede) para `faturar-mes` e para a emissão depois do webhook.
- Chaves de idempotência: validade de 24 h (a cobrança mensal retoma no mesmo dia; depois disso o
  `invoice.finalized` com `metadata.fatura_id` liga a fatura).

**Moloni — confirmar cada endpoint numa série de testes não comunicada à AT** (lista em
`_shared/moloni/pedidos.ts`, `ENDPOINTS_A_VERIFICAR`): grant password/refresh; formato
`?access_token=…&json=true` com corpo JSON e forma dos erros; `customers/getByVat`, `getNextNumber` e campos
obrigatórios de `customers/insert`; `invoices/insert` e `invoiceReceipts/insert` (status 0/1, `taxes[].value`);
fechar um rascunho (`…/update` com o corpo completo?); `…/getOne` (`gross_value`, `taxes_value`, `number`,
`document_set_name`); apagar rascunhos; `receipts/insert` (`associated_documents`, `payments`);
`creditNotes/insert`; `documents/getPDFLink`; `getAll` por `your_reference` e o seu comprimento máximo (usamos
19 caracteres, ex. `FT-1A2B3C4D5E6F7A8B`); ATCUD e QR ao fechar; limites de pedidos; cliente "Consumidor final"
(999999990) com morada "Desconhecido".

**Supabase:** nomes das variáveis injetadas e `verify_jwt` com as chaves novas; o CLI aceitar
`--import-map supabase/functions/deno.json`; `deno.lock`; e implementar o contrato `_shared/portas.ts` em SQL
(com os testes PGlite de paridade com a BD falsa).

**Contabilista:**
1. Fatura-Recibo automática às famílias, com NIF opcional (sem NIF: consumidor final)?
2. Fatura por entrada (FT + RC) ou faturação global mensal para os lares? Quando é exigível o IVA da taxa (a
   confirmação do lar ou os 14 dias da família)?
3. IVA das famílias da Madeira e dos Açores. **Atenção:** 14,90 € a 16 % não tem separação exata ao cêntimo
   (líquido + round(líquido × 16 %) salta de 14,89 € para 14,91 €); 29,90 € a 16 % e todos os preços a 23 % e
   22 % têm. Se os Açores pagarem 16 %, o passe de 30 dias tem de custar 14,89 € ou 14,91 € lá, ou o Moloni tem
   de aceitar preços com mais casas decimais.
4. O texto do consentimento de início imediato (`CONSENTIMENTO_ACESSO` em `_shared/faturacao/planos.ts`).
5. Prazo do pré-aviso SEPA (por omissão 3 dias, no contrato).
6. Lugar da prestação B2B (sede do cliente ou morada do lar) e taxas 23/22/16 %; NIF de demonstração `599999993`.
7. Mensalidade cancelada depois do compromisso: o mês já pago não é rateado (as entradas desse resto de mês
   passam a ser por entrada) — confirmar como regra comercial.
