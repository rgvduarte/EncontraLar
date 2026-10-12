# EncontraLar — direção de arte, UX e arquitetura

> Leitura obrigatória antes de criar ou alterar qualquer página.

## 1. Para quem desenhamos

| Quem | Contexto real | O que precisa de sentir/fazer |
|---|---|---|
| **Filha/filho (45–65 anos)** — utilizador principal | Muitas vezes com pressa e culpa: a mãe teve uma queda, o pai vai ter **alta hospitalar** na próxima semana. Pesquisa no telemóvel, à noite, cansado(a). | Perceber em segundos **onde há vaga agora**, quanto custa, se o lar trata o problema de saúde concreto (demência, acamado…), e **quanto tempo** vai esperar. Confiança. Calma. |
| **A própria pessoa idosa (70+)** | Lê com dificuldade, desconfia de tecnologia. | Letra grande, contraste, linguagem simples, nada escondido em ícones sem texto. |
| **Diretor(a) técnico(a) de um lar** | Gere 40 camas, atende 20 telefonemas por semana a perguntar "há vaga?". Pouco tempo, pouca paciência para software. | Atualizar vagas num toque, ver pedidos já triados com o perfil clínico, preencher a vaga depressa (cada mês vazio custa ~1500–2500 €). |

Problema de mercado (da reunião): **assimetria de informação** — listas de espera lentas, opacidade ("boca a boca"), oferta invisível. A plataforma responde com 3 vetores: **geolocalização, perfil clínico, transparência**. O diferenciador técnico é a **previsão de vagas**.

## 2. Conceito visual: "Casa portuguesa"

Calor editorial de revista portuguesa + clareza de serviço público. **Não é um template SaaS.**

Elementos de assinatura (usar — já existem em `src/components/brand/`):

- **Mapa de Portugal com vagas em direto** (`PortugalMap`, `MapLegend`) — continente + Açores + Madeira, um ponto por instituição, pulsa onde há vaga. É a "fotografia" principal do produto; substitui imagens de banco.
- **Quadro de vagas** (`VagasBoard`) — painel escuro tipo partidas da estação, com as vagas atualizadas mais recentes a rodar. Prova viva de que as vagas são reais.
- **Previsão das vagas como previsão do tempo** (`ForecastStrip`) — sol / sol com nuvens / nuvem + % por mês. Toda a gente sabe ler a previsão do tempo. Usar `variant="mini"` em listas.
- **Azulejo** (`AzulejoBand`, `azulejoBg()`) — padrão em faixas, molduras, fundos de cabeçalhos — sempre subtil (opacidade 5–15% sobre creme, ou a 10–20% sobre verde-pinho).
- **Calçada portuguesa** (`CalcadaDivider`, `calcadaStonesBg()`) — onda do Rossio como divisor entre secções (ex.: transição creme → verde-pinho); textura de pedras em fundos escuros.
- **Selo verificado** (`SeloVerificado`) — carimbo circular; usar no topo da ficha de instituições verificadas e na página "Para instituições".
- **Ilustrações de fachada** (`LarCover`) — casas portuguesas estilizadas; não usar fotografias de banco.

Tipografia:
- Títulos em **Fraunces** (`font-display`), grandes e com caráter; usar `<em>` para 1–2 palavras de ênfase (fica itálico terracota automaticamente): `O lar certo, <em>perto</em> de quem ama.`
- Números importantes (preços, %, contagens) em Fraunces com `tabular`.
- Corpo em **Atkinson Hyperlegible** (desenhada para baixa visão). Escala já ampliada: `text-sm` = 16px, `text-base` = 18px. Nunca usar texto < 14px (`text-xs`) exceto metadados mínimos.

Cor (tokens em `src/index.css`):
- Fundo `cream`, secções alternadas `sand`, blocos de contraste em `pine-900/950` (com `on-dark` para `em` em terracota claro).
- `pine` = confiança/ação principal. `terra` = calor, ênfase, CTA secundário, alertas positivos. Usar terracota com parcimónia.
- Estados de vaga: `leaf` (disponível), `sun` (em breve), `dusk` (lista de espera) — **sempre com texto/ícone, nunca só cor**.

Layout: grelhas assimétricas (7/5, 8/4), blocos que se sobrepõem, secções de largura total alternadas com secções contidas, notas laterais "sticky". Alinhar à esquerda por defeito; centrar só em momentos pontuais.

## 3. Regras anti-"AI slop" (obrigatórias)

1. ❌ Nada de grelhas "3 ícones em círculo + título + 2 linhas". Para listar vantagens: lista numerada editorial (números grandes em Fraunces), split com **pré-visualização de UI real** (componentes verdadeiros com dados reais), ou antes/depois.
2. ❌ Nada de hero genérico (título centrado + 2 botões + blob em gradiente). O hero deve **mostrar o produto a funcionar** (mapa com vagas, quadro de vagas, cartão real).
3. ❌ Nada de copy genérico ("Descubra", "Solução inovadora", "Experiência perfeita", "Seamless"). Escrever como um bom assistente social falaria: concreto, português de Portugal, com situações reais (alta hospitalar, comparticipação da Segurança Social, ERPI, lista de espera, Alzheimer).
4. ❌ Nada de números inventados no código — contagens, médias e exemplos **calculados a partir do store** (`useLares()` etc.).
5. ❌ Nada de testemunhos falsos apresentados como reais (sem nomes completos inventados com fotografia). Se usar citações, identificar como exemplo/fictício.
6. ❌ Sem emojis na interface. Ícones `lucide-react` com `aria-hidden` + texto visível.
7. ❌ Nada de cartões todos iguais em grelha infinita sem hierarquia — cada secção tem um ponto focal.
8. ✅ Cada página tem **uma ação principal óbvia** e um caminho seguinte claro.
9. ✅ Estados vazios, de erro e de carregamento desenhados (com orientação útil, não só "Sem resultados").
10. ✅ Micro-interações com propósito (pulso nas vagas, transições curtas), respeitando `prefers-reduced-motion`.

## 4. Linguagem — português de Portugal

Usar: registo, utilizador, telemóvel, ecrã, contacto, equipa, palavra-passe, iniciar/terminar sessão, guardar, apagar, morada, código postal, autarquia, freguesia, "está a carregar", "candidatar-se", "pedido", "marcar visita", "comparticipação", "mensalidade".
Evitar (PT-BR): cadastro, usuário, celular, tela, contato, time, senha, "você" excessivo (preferir formas impessoais ou "o(a) senhor(a)" implícito: "Guarde", "Indique"), "ônibus", "registro", "deletar", "salvar".
Tom: caloroso, sereno, honesto sobre incerteza ("estimativa", "não é garantia"). Tema sensível: **nunca** falar em "óbito/morte" para explicar vagas — dizer "saídas" ou "rotatividade" (a página de metodologia pode explicar com tato).

## 5. Arquitetura de informação

```
Público (famílias)                    Instituições                      Contas
/                 Início              /para-lares   Porquê aderir       /entrar    (contas de demonstração)
/pesquisa         Mapa de vagas       /registar?tipo=lar                 /registar
/lar/:id          Ficha da instituição
/encontrar        Ajuda-me a escolher (questionário → recomendações)
/guia             Guia e apoios (#tipos #visita #apoios #alerta #faq #linhas)
/sobre, /privacidade

Painel da família  /familia (resumo) · /familia/pedidos · /familia/guardados · /familia/perfil · /familia/conta
Painel do lar      /gestao (resumo) · /gestao/vagas · /gestao/pedidos · /gestao/previsao · /gestao/ficha
```
Os painéis usam `DashboardShell` (barra lateral no desktop, pílulas no telemóvel) com rotas aninhadas (`<Routes>` dentro do componente, porque a rota é `familia/*` / `gestao/*`).

### Contrato de URL da pesquisa (`/pesquisa`)
| Parâmetro | Valor |
|---|---|
| `lugar` | label de `LUGARES` (ex.: `Porto`, `Lisboa — Alvalade`) → centro + raio |
| `lat`, `lng` | coordenadas ("perto de mim") |
| `raio` | km (5, 10, 15, 25, 50) |
| `distrito` | nome de `DISTRITOS` |
| `tipo` | `erpi`, `residencia`, `centro_dia` (vírgulas) |
| `vaga` | `agora` (só com vaga) · `breve` (com vaga ou prevista em breve) |
| `max` | mensalidade máxima (€) |
| `grau` | `autonomo` · `ligeira` · `moderada` · `grave` |
| `cuidados` | chaves de `Cuidado`, separadas por vírgulas |
| `ss` | `1` = só com acordo da Segurança Social |
| `q` | texto livre (nome) |
| `ordem` | `relevancia` · `distancia` · `preco` · `disponibilidade` · `avaliacao` |

### Rascunho do questionário
O questionário `/encontrar` guarda o perfil preenchido em `sessionStorage['encontralar:perfil-rascunho']` (JSON `PerfilInput` de `src/lib/store.ts`). O painel da família oferece-se para o guardar quando existir.

## 6. Acessibilidade (WCAG 2.2 AA mínimo)

Um `h1` por página e hierarquia correta; etiquetas em todos os campos (`InputField` etc. já ligam `aria-describedby`); alvos ≥ 48px; foco visível (já global); contraste AA; nada só por cor; `aria-live` para mudanças importantes; o mapa é complementar — a lista é a fonte principal e acessível.
