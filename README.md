# EncontraLar

**Lares e residências seniores em Portugal, com vagas reais e previsão de vagas.**

Protótipo da plataforma digital centralizada para agregação e gestão de vagas em cuidados sénior
(proposta de 12/10). Responde à assimetria de informação do setor com três vetores:
**geolocalização**, **perfil clínico** e **transparência** — e acrescenta um diferenciador técnico:
a **previsão estatística de quando vai abrir vaga**.

> ⚠️ Protótipo de demonstração. Todas as instituições, pessoas, avaliações e vagas são **fictícias**.
> Os dados (contas, pedidos, alterações) ficam guardados apenas no `localStorage` do navegador.

## Experimentar

Contas de demonstração (palavra-passe `demo1234`), também acessíveis com um clique em **Entrar**:

| Conta | Email | O que ver |
|---|---|---|
| Família | `familia@exemplo.pt` | Ana Ferreira procura lar para a mãe (Alzheimer inicial, Porto): pedidos, posição na lista de espera, alertas de vaga, comparação |
| Instituição | `lar@exemplo.pt` | Casa de Repouso Jardins do Douro: painel de vagas, pedidos com perfil clínico, lista de espera, previsão |

Dica: abra o painel da família e o da instituição em **dois separadores** — as notificações sincronizam em direto
(ex.: a instituição regista uma vaga libertada → a família recebe o alerta).

## O que tem

**Para famílias**
- **Mapa de vagas** (`/pesquisa`): mapa interativo (Leaflet + OpenStreetMap/CARTO) com agrupamento, filtros por
  localidade/raio, disponibilidade, tipo, orçamento, grau de dependência, cuidados de saúde e acordo com a Segurança Social.
- **Ficha da instituição** (`/lar/:id`): preços por tipo de quarto, o que está incluído, rácio de cuidadores,
  licença, verificação, avaliações, **previsão de vagas** e pedido de vaga/visita com verificação de compatibilidade.
- **Ajuda-me a escolher** (`/encontrar`): questionário de 6 passos → recomendações ordenadas com explicação
  ("porque sugerimos").
- **Painel da família**: pedidos e posição na lista, visitas, guardados com alertas de vaga, comparação, perfil de cuidados.
- **Guia e apoios**: tipos de resposta (ERPI, residência, centro de dia, SAD, RNCCI), checklist da visita,
  custos e apoios, sinais de alerta, linhas de apoio.

**Para instituições**
- Painel com vagas num toque (as famílias interessadas são avisadas automaticamente), pedidos com perfil clínico e
  verificação de compatibilidade, lista de espera digital, previsão de ocupação e edição da ficha pública.

## Como funciona a previsão de vagas

`src/lib/forecast.ts` — as saídas de residentes são modeladas como um **processo de Poisson não-homogéneo**:

1. taxa mensal = média entre o histórico de saídas (12 meses) e a taxa estrutural *residentes ÷ estadia média*;
2. modulada por **sazonalidade** (mais saídas no inverno);
3. a lista de espera é descontada por um **fator de lista efetiva** (muitas famílias estão inscritas em vários lares);
4. para quem precisa da *k*-ésima vaga: `P(vaga até t) = P(N(t) ≥ k)`, `N(t) ~ Poisson(Λ(t))` → probabilidades a
   30/90/180/365 dias, mediana e intervalo (20%–80%).

O motor de compatibilidade (`src/lib/matching.ts`) pontua 0–100 com pesos explícitos (cuidados 35, orçamento 20,
distância 20, disponibilidade 15, preferências 10) e devolve razões legíveis.

## Desenvolvimento

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm test           # testes do modelo de previsão, matching e dados
npm run build      # typecheck + build de produção em dist/
```

Stack: Vite · React 19 · TypeScript · Tailwind CSS 4 · React Router 7 (HashRouter) · Leaflet · lucide-react.
Tipografia: Atkinson Hyperlegible (desenhada para baixa visão) e Fraunces. Direção de arte em [`docs/DESIGN.md`](docs/DESIGN.md).

## Publicação

O workflow `.github/workflows/deploy.yml` corre testes + build e publica `dist/` no ramo `gh-pages`
a cada push. No GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → `gh-pages` / root**.

## Próximos passos (fora do protótipo)

- Backend real (API + base de dados + autenticação) — o protótipo guarda tudo no navegador.
- Conformidade RGPD para dados de saúde (art. 9.º): consentimento explícito, registo de acessos, AIPD.
- Onboarding comercial e auditoria no terreno das instituições; integração com a Carta Social.
- Calibração da previsão com dados reais de rotatividade; estudo de modelos de financiamento (EUA/Espanha).
