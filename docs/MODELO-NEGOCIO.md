# Modelo de negócio e contrato técnico

## Atualização de 13/10/2026: modelo de dois lados

A procura de vagas é muito maior do que a oferta, por isso a família é quem sente mais o problema. Passam a pagar **os dois lados**, por coisas diferentes, com uma taxa mais baixa de cada lado. A mesma ligação nunca é cobrada duas vezes.

| Quem | Grátis | Pago | Valor |
|---|---|---|---|
| **Famílias** | Explorar de forma genérica: que instituições existem, onde, o tipo, a natureza, a verificação, a avaliação geral, a **faixa** de preço, o guia e apoios, e contagens agregadas ("43 com vaga nesta zona") | **Acesso Família**: que instituições têm vaga e quantos lugares, preços por quarto, previsão de espera, contactos, pedidos a várias casas, visitas, alertas, comparação | **14,90 € / 30 dias** ou **29,90 € / 90 dias**, IVA incluído, **sem renovação automática**. Uma nova compra soma os dias. |
| **Lares privados** | Ficha verificada, vagas, lista de espera digital, pedidos | Taxa fixa por entrada | **150 € + IVA** por entrada (por contrato; nunca em páginas públicas) |
| **IPSS e Misericórdias** | Tudo | Nada | 0 € |
| **Profissionais de saúde** | Acesso completo, incluindo casos e encaminhamentos | Nada (no futuro, licença institucional) | 0 € |

Regras que não mudam:
- **Pagar não muda a ordem dos resultados nem dá prioridade nas vagas.** Vale para as famílias e para as instituições.
- **A versão grátis não expõe o negócio:** a camada viva (quais têm vaga, quantos lugares, preços, previsão, contactos) é do Acesso Família.
  - No protótipo o bloqueio é só de apresentação, porque os dados vivem no navegador.
  - Na versão com servidor, esses dados **não saem da base de dados** para quem não tem acesso: uma vista pública genérica e outra completa, com verificação do direito de acesso no servidor.
- **A família de demonstração** (`familia@exemplo.pt`) tem um passe de 90 dias ativo. Para ver a versão grátis, explore sem entrar ou crie uma conta.

Contrato técnico (protótipo):
- `src/lib/acesso.ts` (`PLANOS_FAMILIA`, `temAcessoCompleto`, `faixaPreco`, `resumoDisponibilidade`, `TAXA_ENTRADA_PRIVADO_CENTIMOS`);
- `User.acesso` (`AcessoFamilia`);
- `useAcesso()` e `comprarAcessoDemo()` em `src/lib/store.ts` (simulação do Stripe Checkout com MB WAY, Multibanco ou cartão);
- os componentes `src/components/acesso` (`BloqueioCartao`, `LinhasBloqueadas`, `AvisoAcesso`, `AcessoNecessarioModal`);
- a página `/acesso`.

Por validar (a próxima decisão depende disto):
- **10 lares privados:** que ocupação têm, quantos dias fica uma vaga vazia, quanto gastam a captar residentes;
- **10 famílias:** quanto pagariam, e pelo quê;
- **Conversão real da página `/acesso`.**

---

Decisões aprovadas a 12/10/2026 (modelo só com taxa por entrada, valor de referência inicial de 300 € + IVA, hoje 150 € + IVA), a partir da proposta "estratégia lares" e do feedback dado:

| Tema | Decisão |
|---|---|
| Quem paga | Só **lares privados**. IPSS e Misericórdias aparecem todas, mas **nunca pagam** pedidos nem entradas. |
| Como paga | **Taxa fixa por cada pessoa que entra** através da plataforma. Sem mensalidade, sem percentagem da mensalidade, sem adesão. O valor é acordado em contrato e **não aparece no site**. |
| O que é gratuito | Para todas as instituições: ficha verificada, vagas em tempo real, lista de espera digital, pedidos com perfil de cuidados, previsão de vagas. |
| Ordenação | **Ninguém paga para aparecer primeiro.** Não há posições pagas. Se um dia existirem, ficam assinaladas e fora da ordenação. Explicado em `/como-ordenamos`. |
| Canal profissional | Assistentes sociais (hospitais, centros de saúde, autarquias) têm conta própria: gerem casos e enviam o mesmo pedido a várias instituições. |

## Porque é que a entrada tem de ser verificável

A taxa por entrada só funciona se a entrada não puder "desaparecer". A plataforma regista a entrada por três vias:

1. **Primeiro contacto registado.** O pedido nasce na plataforma (`criadaEm`). Uma entrada até **12 meses** depois conta como atribuída.
2. **Dupla confirmação.** O lar marca "Entrou" e a família confirma "O meu familiar já entrou". Basta um lado para a entrada contar; com os dois fica **verificada**.
3. **Incentivo à família.** Só quem confirmou a entrada pode deixar uma **avaliação verificada**. É isso que dá valor às avaliações, que são o fosso competitivo.

## Privacidade em duas fases (RGPD art. 9.º)

- **Antes de o lar aceitar o pedido**, vê apenas um resumo sem identificação: grau de dependência, cuidados necessários, faixa etária, zona, orçamento, urgência e origem (família ou hospital, com a data prevista de alta).
- **"Aceitar e ver contacto"** revela o nome, o contacto e o perfil completo, e regista `desbloqueadaEm`.
- No Supabase isto é imposto na base de dados: uma vista sem colunas de contacto e uma função `aceitar_candidatura`. A interface não é a barreira.

---

## Contrato técnico (protótipo, localStorage)

### Tipos (`src/types.ts`)

```ts
export type Role = 'familia' | 'lar' | 'profissional'

export type TipoOrganizacao = 'hospital' | 'centro_saude' | 'autarquia' | 'outro'
export interface Organizacao { nome: string; tipo: TipoOrganizacao; servico?: string }
// User ganha: organizacao?: Organizacao   (só role 'profissional')

export type EstadoCandidatura = … | 'admitida'          // novo estado final

export type OrigemPedido = 'familia' | 'profissional'
export interface Encaminhamento {
  casoId: string
  profissionalId: string
  organizacao: string            // "Hospital de Vale Formoso (fictício) · Serviço Social"
  altaPrevista?: string          // YYYY-MM-DD
}
export type TaxaEntrada = 'aplicavel' | 'isenta'   // isenta quando lar.natureza !== 'privado'
export interface Entrada {
  data: string                   // YYYY-MM-DD da entrada
  confirmadaLarEm?: string       // ISO
  confirmadaFamiliaEm?: string   // ISO (família ou profissional que fez o pedido)
  taxa: TaxaEntrada
}
// Candidatura ganha:
//   origem?: OrigemPedido            (ausente = 'familia')
//   encaminhamento?: Encaminhamento
//   desbloqueadaEm?: string          (ISO — o lar aceitou ver o contacto)
//   entrada?: Entrada

export type EstadoCaso = 'aberto' | 'colocado' | 'fechado'
export interface Caso {
  id: string
  profissionalId: string
  perfilId: string               // PerfilIdoso com userId = profissional
  referencia?: string            // nº interno não identificativo
  altaPrevista?: string          // YYYY-MM-DD
  consentimento: boolean         // a pessoa/representante autorizou a partilha
  estado: EstadoCaso
  criadoEm: string
  atualizadoEm: string
}

export interface ProcuraAnonima {  // pesquisa sem vagas — sem dados pessoais
  id: string
  criadaEm: string
  distrito?: Distrito
  lugar?: string
  grau?: GrauDependencia
  cuidados: Cuidado[]
  orcamentoMax?: number
  resultados: number
  comVaga: number
}

// Lar ganha: confirmacaoToken: string   (link de confirmação rápida de vagas, sem login)
// DB ganha: casos: Caso[]; procuras: ProcuraAnonima[]
```

### Regras derivadas (`src/lib/negocio.ts`)

- `contactoVisivel(c)`: devolve `c.estado !== 'enviada' || !!c.desbloqueadaEm`. Antes disso o lar vê só `resumoAnonimo(c)`.
- `resumoAnonimo(c)`: devolve `{ faixaEtaria: '80–84', grau, necessidades, zona: c.perfil.local.label, orcamentoMax, urgencia, origem, altaPrevista? }`.
- `taxaPara(lar)`: devolve `lar.natureza === 'privado' ? 'aplicavel' : 'isenta'`.
- `entradaAtribuida(c)`: verdadeira quando há `c.entrada` e a entrada ocorre até 365 dias depois de `c.criadaEm`.
- `entradaVerificada(c)`: verdadeira quando há `c.entrada?.confirmadaLarEm` e `c.entrada?.confirmadaFamiliaEm`.
- `prioridadePedido(c)`: os encaminhamentos com alta prevista nos próximos 7 dias vêm primeiro.
- `niveisVerificacao(lar)`: devolve `{ licenca: lar.verificacao.estado !== 'nao_verificado' && !!lar.verificacao.licenca, visitado: lar.verificacao.estado === 'verificado' && !!lar.verificacao.data, avaliacoesVerificadas: lar.reviews.some(r => r.verificada) }`.

### Ações (`src/lib/store.ts`)

| Função | Quem | Efeito |
|---|---|---|
| `aceitarPedido(id)` | lar | `desbloqueadaEm = agora`; se `enviada`, passa a `em_analise`; notifica o autor do pedido |
| `marcarEntrada(id, data)` | lar | só a partir de `aceite`; passa a `admitida`; `entrada = { data, confirmadaLarEm: agora, taxa: taxaPara(lar) }`, ou junta-se a uma confirmação da família já existente |
| `confirmarEntradaFamilia(id, data)` | família/profissional | o mesmo, do outro lado (`confirmadaFamiliaEm`); notifica o lar |
| `avaliarLar(candidaturaId, { nota, texto, aspetos })` | família | só com entrada confirmada pela família; acrescenta uma `Review` `verificada: true` ao lar e recalcula a média e o número de avaliações |
| `criarCaso(input)` / `atualizarCaso(id, patch)` | profissional | cria o PerfilIdoso e o Caso |
| `enviarCaso(casoId, larIds[], mensagem?)` | profissional | uma candidatura por lar, com `origem: 'profissional'`, `encaminhamento` e o contacto do profissional; ignora lares que já têm pedido ativo deste caso |
| `registarProcura(p)` | qualquer | guarda uma `ProcuraAnonima`; no máximo 1 por combinação por sessão; fica com as últimas 500 |
| `larPorToken(token)` / `responderConfirmacao(token, aindaTem: boolean)` | público (link) | `true` corre `confirmarVagasAtualizadas`; `false` põe as vagas livres a 0 e confirma |

Hooks: `useCasos()`, `useCaso(id)`, `useCandidaturasDoCaso(casoId)`, `useProcurasZona(lar, dias = 30)`.

### Rotas

| Rota | Quem | Pasta |
|---|---|---|
| `/casos`, `/casos/novo`, `/casos/:id` | `RequireAuth role="profissional"` | `src/features/pro` |
| `/profissionais` | público (apresentação) | `src/features/pro` |
| `/confirmar/:token` | público, sem login | `src/features/confirmar` |
| `/gestao/entradas` | lar | `src/features/lar-dashboard` |
| `/como-ordenamos` | público | `src/features/content` |

Conta de demonstração: `social@exemplo.pt` / `demo1234`. É a Marta Correia, assistente social do Hospital de Vale Formoso (fictício), com 3 casos:
- um com alta prevista daqui a 4 dias, enviado a três instituições: aguarda aceitação no lar de demonstração, está em análise noutra e foi recusado na terceira;
- um já colocado numa IPSS, com entrada confirmada e isenta de taxa;
- um novo, ainda por enviar.
