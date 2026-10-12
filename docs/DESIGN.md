# EncontraLar — direção de design (v2: minimalista)

> Leitura obrigatória antes de criar ou alterar qualquer página.
> A v1 ("Casa portuguesa": azulejo, calçada, serifas, painel de estação) foi **rejeitada pelo cliente** por ser
> "slop". A referência agora é **apple.com** e sites premiados no Awwwards de produto (ex.: Cyera AI Guardian, Pinreply):
> **limpo, minimalista, muito intuitivo.**

## 1. Para quem desenhamos

| Quem | Contexto | O que precisa |
|---|---|---|
| **Filha/filho (45–65 anos)** — principal | Pressa e ansiedade (ex.: **alta hospitalar** na próxima semana), muitas vezes no telemóvel. | Ver em segundos **onde há vaga**, quanto custa, se tratam o problema concreto, **quanto tempo** vai esperar. |
| **A própria pessoa idosa** | Lê com dificuldade. | Letra grande, contraste, linguagem simples. |
| **Diretor(a) de um lar** | Pouco tempo, pouca paciência para software. | Atualizar vagas num toque, pedidos já triados, preencher vagas depressa. |

Vetores do produto: **geolocalização, perfil clínico, transparência** + **previsão de vagas** (diferenciador).

## 2. Princípios (estilo Apple)

1. **Uma ideia por ecrã/secção.** Título enorme, uma frase de apoio, uma ação. Se uma secção precisa de muitas coisas, divide-se ou corta-se.
2. **Menos é mais.** Cortar sem dó: secções redundantes, chips decorativos, ícones que não informam, bordas e caixas a mais, texto repetido. Na dúvida, remover.
3. **Espaço em branco generoso.** Secções com `py-24 sm:py-32 lg:py-40`; títulos com ar à volta; nunca encher o ecrã.
4. **O produto é a imagem.** Em vez de ilustrações decorativas, mostrar UI real do EncontraLar (mapa, cartão, previsão, painel) composta com componentes verdadeiros e dados reais do store — como a Apple mostra o iPhone.
5. **Intuitivo antes de bonito.** Etiquetas claras, ações óbvias, caminhos curtos, feedback imediato. Nada escondido atrás de ícones sem texto.
6. **Movimento subtil e com propósito.** Entradas suaves ao fazer scroll (`<Reveal>`), transições de 200–300ms com `ease-[cubic-bezier(.25,.1,.25,1)]`, hover discreto (escala 1.02–1.04 em imagens). Respeitar `prefers-reduced-motion`.

## 3. Sistema visual

**Tipografia** — só **Inter** (variável, com tamanhos óticos), como a SF Pro da Apple.
- Títulos: `font-semibold`, tracking negativo (já global). Hero: `text-5xl sm:text-6xl lg:text-7xl`; secção: `.headline` (`text-4xl → 6xl`); subtítulos `text-xl/2xl text-ink-mute`.
- `<em>` dentro de h1/h2/h3 = palavra de ênfase com **gradiente azul→verde** (sem itálico). Usar no máximo 1 vez por título, e não em todos os títulos.
- Corpo `text-base` (18px) / `text-lg`; secundário `text-ink-mute`. Escala já ampliada para o público: `text-sm`=16px, `text-xs`=14px (usar pouco).
- Números importantes: `font-semibold tabular`.

**Cor** — quase monocromático + um acento.
- Superfícies: branco (`bg-white`/`bg-cream`) e cinza Apple (`bg-sand` = #f5f5f7) alternados; `bg-sand-deep` para trilhos. Blocos de contraste: preto (`bg-pine-950`/`bg-ink`) com texto branco e `on-dark`.
- Texto: `text-ink` (#1d1d1f), `text-ink-soft`, `text-ink-mute` (#6e6e73).
- **Nomes legados**: `pine-*` = escala de grafite (pine-700 = #1d1d1f; pine-950 = preto). `terra-*` = **acento azul** (terra-600 = #0071e3) para ligações e destaques pontuais.
- Estados de vaga (sempre com texto): verde `leaf` (#34c759) = disponível, laranja `sun` (#ff9500) = em breve, cinza `dusk` = lista de espera. Alerta: `alert`.
  Lugar livre já prometido a quem está na lista (`vagaParaNovos(lar)` falso): o `AvailabilityBadge` mostra-o a laranja,
  "1 lugar livre · lista à frente" ("Lista à frente" sobre imagens) — nunca "Com vaga" a verde. Contagens "com vaga agora" usam `vagaParaNovos`.
- **Proibido**: cores hex fixas da v1 (#1d564e, #2f7f72, #4f9b8c, #d25b3b, #b9472f, #fbf8f3, #efe7da…), gradientes decorativos de fundo, sombras pesadas.

**Superfícies e forma**
- Cartões: `rounded-[1.75rem]`, sem sombra ou com `shadow-card` muito leve; preferir `bg-sand` sem borda ("tiles" estilo Apple, classe `.tile`) ou `bg-white ring-1 ring-line`.
- Botões: pílulas (`rounded-full`). Primário = preto (`Button variant="primary"`), acento = azul (`variant="accent"`), secundário = cinza (`variant="subtle"`). Ligações de texto estilo Apple: azul com chevron — "Saber mais ›".
- **Grelhas "bento"** (tiles de tamanhos diferentes) para apresentar funcionalidades — cada tile: título curto, 1 frase, um pedaço de UI real.
- Ícones `lucide-react` finos, pequenos, a acompanhar texto (nunca ícones dentro de círculos coloridos em grelha de 3).
- Capas de instituição: `LarCover` (gradiente pastel + silhueta) — sem fotografias no protótipo.

**Componentes de marca disponíveis** (`src/components/brand/`): `PortugalMap` (mapa em pontos, halftone), `MapLegend`, `VagasBoard` (lista "Atualizadas agora", tema claro/escuro), `ForecastStrip` (previsão mês a mês: % + barra fina; `variant="mini"`), `SeloVerificado` (roseta azul) e
`SeloNiveis` (os três níveis de verificação, ver §11).
Os padrões da v1 (azulejo/calçada, `patterns.tsx`) foram **removidos**.
`Reveal` (de `@/components/motion`): envolver blocos para entrada suave ao fazer scroll.

**Layout**
- `container-page` (max 80rem) e `container-narrow` (60rem). Hero e títulos de secção podem ser centrados (estilo Apple); conteúdo de leitura alinhado à esquerda.
- Header: barra translúcida `h-16` (sticky, z-1000) — offsets sticky usam `top-16`. Navegação principal a partir de `xl`;
  conta (Entrar/Criar conta ou menu da conta) a partir de `lg`; abaixo disso, menu e barra de abas. Texto inativo em `text-ink-soft`
  (contraste AA mesmo sobre secções pretas). Terminar sessão: sempre `terminarSessao(navigate)` (`components/layout/RequireAuth`).
- Mobile first: tudo tem de funcionar a 390px; alvos ≥ 48px.

## 4. Linguagem — português de Portugal

Curto, claro, humano. Frases de 1 linha nos títulos. Usar: registo, utilizador, telemóvel, ecrã, contacto, equipa, palavra-passe, iniciar/terminar sessão, guardar, apagar, morada, pedido, marcar visita, comparticipação, mensalidade.
Evitar PT-BR: cadastro, usuário, celular, tela, contato, time, senha, deletar, salvar, registro.
Tema sensível: **nunca** "óbito/morte" — dizer "saídas" ou "rotatividade".
Proibido copy genérico de marketing ("Descubra", "inovador", "experiência perfeita", "revolucionário").

## 5. Arquitetura de informação

```
Famílias                               Instituições                  Contas
/              Início                  /para-lares                   /entrar  (inclui contas de demonstração)
/pesquisa      Mapa de vagas           /registar?tipo=lar            /registar
/lar/:id       Ficha da instituição    /profissionais (hospitais e serviço social)
/encontrar     Ajuda-me a escolher     /confirmar/:token (confirmar vagas sem sessão)
/guia          Guia e apoios (#tipos #escolher #visita #apoios #alerta #faq #linhas)
/sobre (#previsao), /como-ordenamos, /privacidade

Painel da família  /familia · /familia/pedidos · /familia/guardados · /familia/perfil · /familia/conta
Painel do lar      /gestao · /gestao/vagas · /gestao/pedidos · /gestao/entradas · /gestao/previsao · /gestao/ficha
Profissional       /casos · /casos/novo (?lar=<id>) · /casos/:id (?lar=<id>)
```
O menu "Instituições" do cabeçalho tem também "Profissionais de saúde" e, só sem sessão, "Experimentar como assistente
social" (entra na conta de demonstração e abre `/casos`). Tal como "Ver painel de demonstração", nunca termina a sessão de
outra pessoa: com outra conta aberta leva à página de apresentação.
Painéis usam `DashboardShell` (barra lateral discreta no desktop, pílulas no telemóvel) com `<Routes>` aninhadas.
HashRouter: âncoras dentro da página fazem-se com `scrollIntoView`, nunca com `href="#id"`.

### Contrato de URL da pesquisa (`/pesquisa`)
`lugar` (label de `LUGARES`) · `lat`,`lng` · `raio` (km) · `distrito` · `tipo` (`erpi,residencia,centro_dia`) · `vaga` (`agora`|`breve`) · `max` (€) · `grau` · `cuidados` (lista) · `ss=1` · `q` · `ordem` (`relevancia`|`distancia`|`preco`|`disponibilidade`|`avaliacao`) · `vista=mapa`.

### Rascunho do questionário
`/encontrar` guarda o perfil em `sessionStorage['encontralar:perfil-rascunho']` (JSON `PerfilInput`); o painel da família oferece-se para o guardar.

## 6. Acessibilidade (WCAG 2.2 AA)

Um `h1` por página (páginas que são só um estado vazio: `<EmptyState as="h1">` + `useDocumentTitle`); hierarquia de títulos; etiquetas em todos os campos; foco visível; contraste AA (atenção a texto cinza claro: usar `text-ink-mute` no mínimo); nada só por cor; `aria-live` em resultados que mudam; alvos ≥ 48px; o mapa é complementar à lista.

- **Mudança de página**: o `Layout` põe o foco no `h1` da nova página (ou no `<main>`) e anuncia o título do separador
  (`aria-live`). Só quando muda o caminho (não `?passo=`, filtros nem `#âncora`), nunca no primeiro carregamento, e não
  mexe se a própria página já focou algo seu ao entrar (autoFocus, diálogo, campo). Por isso cada página precisa de `h1`.
- **Foco nunca tapado** (WCAG 2.4.11): `scroll-padding-bottom` no `<html>` desconta a barra de abas e `--actionbar-h`.
  Com o teclado (`html[data-teclado]`, posto pelo `SmoothScroll` ao carregar em Tab) há também `scroll-padding-top`
  = cabeçalho + barras presas por baixo dele: as `sticky top-16 z-[900]` contam sozinhas; outra barra presa no topo leva
  `data-barra-fixa`. O `lenis.scrollTo(elemento)` desconta esse padding, por isso os `scroll-mt-*` das secções ficam iguais.
  Não acrescentar `scroll-padding-top` noutros sítios.
- **Contornos de controlos** (WCAG 1.4.11): campos, caixas e indicadores com `border-pine-400` (≈3.3:1), nunca `border-line-strong`
  (1.5:1) quando a borda é o único limite; interruptor `bg-leaf-600` / `bg-pine-400`.
- **Cartões com ligação esticada** (`after:absolute after:inset-0`): o anel de foco desenha-se no `::after`
  (`focus-visible:after:outline-3 …`), como no `LarCard`.
- **Menus do cabeçalho**: entradas são `<Link>` (botão só para ações). Desktop: Enter no botão do menu leva o foco ao
  painel, Tab no fim passa ao menu seguinte, Esc devolve o foco ao botão. Menu móvel: `role="dialog"`, foco na primeira
  entrada, Esc fecha e volta ao botão; a página por trás fica `inert` (elementos com `data-fundo-do-menu`) e o Lenis parado.

## 7. Movimento e scroll (estilo Apple)

Objetivo: a página deve parecer uma sequência de **cenas**, não um PDF contínuo. Narrativa em 5 tempos nas páginas de
marketing: **gancho → contexto → percurso → clímax → desfecho**.

Primitivas em `src/components/motion/` (importar de `@/components/motion`):
- `Reveal` (variants `up` | `fade` | `scale` | `blur` | `left` | `right`) e `Stagger` (filhos escalonados) — entradas ao entrar no ecrã.
- `StickyScene` + `useSceneProgress()` — secção "presa" (ex.: `length="300vh"`) cujo conteúdo se transforma com o progresso 0→1
  (cross-fade entre passos, escala de um mockup, troca de texto). O contentor fixo também expõe `--p` em CSS.
- `ScrollZoom` — o "zoom de produto": o bloco cresce de 0.88→1 e perde arredondamento ao entrar.
- `TextReveal` — frase grande que se "acende" palavra a palavra com o scroll (usar 1× por página, em afirmações-chave).
- `Parallax` — profundidade subtil (desligada automaticamente < 768px).
- `HorizontalScroll` — galeria horizontal guiada pelo scroll no desktop; faixa deslizável nativa no telemóvel.
- `CountUp` — números que contam ao aparecer.
- `ScrollProgressBar` — progresso de leitura em páginas longas (guia).
- `SmoothScroll`/`useLenis` — scroll suave global (Lenis) já ativo no Layout; para scroll programático usar `useLenis()?.scrollTo(el, { offset: -80 })`
  com fallback `el.scrollIntoView({ behavior: 'smooth' })`. Contentores com scroll próprio: `data-lenis-prevent`.
  Mapas Leaflet não são excluídos do Lenis: com `scrollWheelZoom` o Leaflet trava a roda sozinho; sem ele (ficha do lar)
  a roda move a página com o mesmo scroll suave.
- Hooks em `src/lib/motion.ts`: `useScrollProgress`, `useScrollVar`, `useInView`, `range`, `mix`, `easeOut`.

Regras: animar só `transform`/`opacity`/`filter`; durações 200–900ms com `cubic-bezier(.16,1,.3,1)`; **nunca sequestrar o scroll**
(sem snap forçado, sem bloquear); no máximo 1–2 cenas sticky por página; conteúdo crítico nunca escondido atrás de animação;
com `prefers-reduced-motion` tudo aparece no estado final (as primitivas já tratam disto). Transições entre páginas e menus
suspensos já são globais (Layout/Header).

## 8. Telemóvel primeiro (ergonomia)

- **Barra de abas inferior** global (`MobileTabBar`, < 1024px) — Início, Mapa, Escolher, Guardados, Painel/Entrar (instituição: Resumo,
  Vagas, Pedidos, Previsão, Ficha; profissional: Casos, Novo caso, Mapa, Início). As colunas seguem o número de separadores.
  Está escondida em `/lar/:id`, `/encontrar`, `/entrar`, `/registar` (fluxos com barra de ação própria) e em `/confirmar/:token`
  (ecrã único aberto a partir de um SMS ou email, sem sessão).
- A altura reservada está em `var(--tabbar-h)` (0 no desktop). Elementos fixos no fundo usam
  `bottom-[calc(var(--tabbar-h)+1rem)]` (ex.: botão Mapa/Lista) ou `bottom-0` + `pb-[calc(1rem+env(safe-area-inset-bottom))]`
  nas páginas sem barra de abas (barras "Pedir vaga", "Continuar").
- **Ações principais ao alcance do polegar**: CTA fixa no fundo em fluxos (ficha, questionário, formulários longos); botões
  `w-full` no telemóvel; alvos ≥ 48px; espaçamento entre alvos ≥ 8px.
- **Modais = folhas inferiores** no telemóvel (o `Modal` já o faz) — conteúdo curto, ações no fundo.
- Tipografia: h1 no telemóvel entre 2.25rem e 3rem (usar `text-[2.5rem] sm:text-6xl lg:text-7xl`), nunca cortar palavras;
  texto corrido em `text-lg` com a largura total e `px-5`.
- Listas horizontais deslizáveis (`snap-x`) em vez de grelhas apertadas; nada de tabelas largas sem alternativa (usar cartões
  empilhados ou `overflow-x-auto` com `data-lenis-prevent`).
- Inputs com `type`/`inputMode`/`autoComplete` corretos (email, tel, numeric) para o teclado certo.
- Testar sempre a 390×844 (`--mobile`) e confirmar que nada fica por baixo da barra de abas.

## 9. Camadas (z-index)

| Camada | z-index |
|---|---|
| Barras sticky dentro da página (índice do guia, navegação de secções) | 900 |
| Controlos flutuantes da página (botão Mapa/Lista, cartões de marcador) | 999 |
| Véu do menu suspenso (desktop) | 990 |
| Barra de abas inferior | 1000 |
| Cabeçalho / menu móvel | 1000 / 1001 |
| Popovers do cabeçalho (notificações, conta) | 1100 |
| Toasts | 2000 |
| Ligação "Saltar para o conteúdo" | 3000 |
| Modais (`<dialog>`) | camada superior nativa (acima de tudo) |

Não inventar valores intermédios (ex.: 1050) — usar esta escala.

## 10. Armadilhas conhecidas (lições da implementação)

- **Tailwind 4 anima `translate`/`scale`/`rotate` como propriedades próprias.** Em transições arbitrárias usar
  `transition-[opacity,transform,translate,scale]` (ou `transition-transform`, que já as inclui); só `transform` não anima `translate-y-*`/`scale-*`.
- **Scroll suave (Lenis):** filas horizontais usam `data-lenis-prevent-horizontal` (a roda vertical continua a mover a página)
  **e `overflow-y-hidden`** — uns px de scroll vertical na fila (Reveal, hover, sombras) chegam para ela "agarrar" o dedo e a
  roda e a página ficar presa. O `overscroll-behavior-y` destas filas volta a `auto` numa regra global sem camada (index.css),
  porque o `lenis.css` lhes dá `contain` nos dois eixos; não é preciso `overscroll-y-auto!` em cada uma. Nunca usar
  `data-lenis-prevent` numa fila horizontal. A faixa do `HorizontalScroll` (< 1024px) é focável (`tabIndex 0`, `role="group"`
  com nome) para se percorrer com as setas;
  `data-lenis-prevent` só em contentores com scroll vertical próprio. Scroll programático: `useScrollTo()` de `@/components/motion`
  (recalcula a altura antes de deslocar — necessário após páginas carregadas de forma diferida).
- **Elementos `position: fixed` dentro de páginas** devem ir por portal para `document.body`.
- **`sr-only` dentro de filas horizontais** precisa de um antepassado `relative`, senão alarga a página no telemóvel.
- **Toasts** ficam acima da barra de abas; páginas com barra de ação própria definem `--actionbar-h` no `<html>` enquanto está visível.
- **Modal** tem `onClosed` (depois da animação de fecho) para encadear diálogos sem temporizadores. O título e a descrição
  dão nome ao `<dialog>` (`aria-labelledby`/`aria-describedby`) — passar sempre um `title` com sentido.
- **Alterações por guardar**: em formulários longos chamar `useAvisoAlteracoes(sujo)` (`@/components/ui/useAvisoAlteracoes`):
  pede confirmação ao sair para outra página (useBlocker) e ao fechar o separador. O diálogo vive no Layout.
- **Ações destrutivas** pedem sempre confirmação. "Repor dados de demonstração": `useReporDemo()` (`components/layout/useReporDemo`).
- **Listas que rodam sozinhas** (ex.: `VagasBoard`) param com o ponteiro ou o foco em cima, com o separador escondido e têm botão
  Pausar/Retomar (WCAG 2.2.2).
- **Pulso "com vaga"**: classe `pulse-dot` (halo num pseudo-elemento, só transform/opacity, 3 repetições). Nada de animações
  infinitas fora do ecrã nem de `box-shadow` animado.
- **Última pesquisa**: a pesquisa guarda o seu endereço em `sessionStorage['encontralar:ultima-pesquisa']`; o separador Mapa e a
  lupa do cabeçalho reabrem-na (na própria pesquisa, a lupa sobe e foca o campo; tocar no separador ativo sobe ao topo).
- **`ForecastStrip`** anima sozinho ao entrar no ecrã (`animate`, por omissão true); `CountUp` anima a partir do valor anterior.
- **Não ligar SVGs grandes ao scroll** (ex.: zoom do mapa de Portugal com o scroll): preferir uma revelação única ao entrar.
  `Parallax` e `ScrollZoom` escrevem `transform` diretamente; dentro de `StickyScene`, evitar ler `var(--p)` em subárvores grandes
  (preferir `useSceneProgress()` em poucos elementos).
- **`PortugalMap`**: o pulso das vagas é opcional (`pulse`, desligado por omissão) e usa só transform/opacity. O SVG é sempre
  `role="img"` com `title`; com `onSelect`, os pontos são só atalho para rato: `<g>` com `onClick` e `cursor-pointer`,
  `aria-hidden`, nunca `<a>` (nada interativo dentro de um `role="img"`, regra axe nested-interactive) — use-o só com
  ponteiro fino. Os nomes das cidades desenham-se por cima dos pontos, com contorno.
- **Atribuição dos mapas Leaflet** em pílula afastada do canto (index.css): os contentores arredondados cortavam o texto.

## 11. Modelo de negócio na interface

Regras de interface para o modelo aprovado (pormenor em `docs/MODELO-NEGOCIO.md`).

- **Sem preços da plataforma.** Estar no EncontraLar é gratuito para todas as instituições; só os lares privados pagam uma
  taxa fixa por cada pessoa que entra. O valor fica no contrato: nunca mostrar montantes, percentagens nem "planos". As
  mensalidades das instituições continuam visíveis (são informação para as famílias). Ninguém paga para aparecer primeiro.
- **Pedido em duas fases (RGPD art. 9.º).** Antes de aceitar, a instituição vê só o resumo sem identificação (faixa etária,
  grau, cuidados, zona, orçamento, urgência, origem). "Aceitar e ver contacto" mostra o nome, o contacto e o perfil completo.
  Nunca desenhar o nome ou o contacto "desfocado" na primeira fase: simplesmente não aparecem.
- **Palavras fixas** (usar exatamente estas):
  - "Encaminhado por <organização>"
  - "Alta prevista: <dia>" / "Alta em N dias"
  - "Aceitar e ver contacto"
  - "Entrou" / "Marcar entrada" (instituição)
  - "Já entrou?" / "Confirmar entrada" (família ou profissional)
  - "Entrada verificada" (as duas confirmações)
  - "Taxa fixa por entrada · conforme contrato" (privado) / "Isenta — setor social" (IPSS e Misericórdias)
  - "Avaliação verificada" (só de quem confirmou a entrada)
- **Selo em três níveis.** `SeloNiveis({ lar })` (`components/brand/SeloVerificado`) lista "Licença confirmada",
  "Visitada pela equipa" e "Avaliações verificadas", com visto ou círculo vazio e o estado em texto para leitores de ecrã.
- **Área do profissional** (`role 'profissional'`, assistentes sociais de hospitais, centros de saúde e autarquias):
  `/casos` com `RequireAuth role="profissional"` e o `DashboardShell`. O menu da conta diz "Os meus casos" e mostra a
  organização por baixo do nome; no telemóvel, a barra de abas tem Casos, Novo caso, Mapa e Início. As notificações de um
  profissional abrem o caso (`/casos/<id>`). Outra conta a abrir `/casos` vê "Esta área é para profissionais de saúde",
  com atalho para o seu painel e "Entrar com outra conta".
- **Encaminhamentos com alta próxima** (até 7 dias) aparecem primeiro na lista de pedidos da instituição, com a data de alta
  em texto (nunca só por cor).
