import type { Lar, Role } from '@/types'
import { painelPath } from '@/components/layout/Header'

/** Áreas reservadas a cada tipo de conta. */
const AREA: { prefix: string; role: Role }[] = [
  { prefix: '/familia', role: 'familia' },
  { prefix: '/gestao', role: 'lar' },
]

/** Só aceitamos caminhos internos ("/…"), nunca "//…" nem "/\…" (que o navegador trataria como outro domínio). */
export function isInternalPath(path: string | null | undefined): path is string {
  return !!path && path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\')
}

/**
 * Para onde ir depois de iniciar sessão: o parâmetro `voltar` quando é um caminho interno
 * e compatível com o tipo de conta; caso contrário, o painel do utilizador.
 * O `voltar` segue inteiro, com a pesquisa (ex.: `/lar/x?acao=pedir`), para a página retomar o que estava a fazer.
 */
export function destinoAposEntrar(voltar: string | null, role: Role): string {
  if (!isInternalPath(voltar)) return painelPath(role)
  if (voltar.startsWith('/entrar') || voltar.startsWith('/registar')) return painelPath(role)
  const area = AREA.find((a) => voltar === a.prefix || voltar.startsWith(`${a.prefix}/`) || voltar.startsWith(`${a.prefix}?`))
  if (area && area.role !== role) return painelPath(role)
  return voltar
}

/**
 * Depois de criar uma conta de família: volta à página pública de onde veio, com a intenção intacta
 * (ex.: a ficha de um lar, a meio de um pedido de vaga: `/lar/x?acao=pedir`); caso contrário, null.
 */
export function voltarPublico(voltar: string | null): string | null {
  if (!isInternalPath(voltar) || voltar === '/') return null
  if (voltar.startsWith('/entrar') || voltar.startsWith('/registar')) return null
  return roleDoCaminho(voltar) ? null : voltar
}

/** Tipo de conta exigido pelo caminho (ou null se for público). */
export function roleDoCaminho(path: string | null): Role | null {
  if (!isInternalPath(path)) return null
  return AREA.find((a) => path === a.prefix || path.startsWith(`${a.prefix}/`) || path.startsWith(`${a.prefix}?`))?.role ?? null
}

// ————————————————————————————————————————— descrever o destino

const DESTINOS: [RegExp, string][] = [
  [/^\/familia\/pedidos/, 'os seus pedidos de vaga'],
  [/^\/familia\/guardados/, 'os lares que guardou'],
  [/^\/familia\/perfil/, 'o perfil de cuidados'],
  [/^\/familia\/conta/, 'os dados da sua conta'],
  [/^\/familia/, 'o painel da família'],
  [/^\/gestao\/vagas/, 'o painel de vagas'],
  [/^\/gestao\/pedidos/, 'os pedidos recebidos'],
  [/^\/gestao\/previsao/, 'a previsão de vagas'],
  [/^\/gestao\/ficha/, 'a ficha da instituição'],
  [/^\/gestao/, 'o painel da instituição'],
  [/^\/encontrar/, 'o questionário "Ajuda-me a escolher"'],
  [/^\/pesquisa/, 'a pesquisa que estava a fazer'],
]

type Artigo = 'o' | 'a' | 'os' | 'as'
/** Artigo pelo nome comum com que começa o nome da instituição ("a Casa…", "o Lar…"); sem artigo se não o reconhecermos. */
const ARTIGOS: [RegExp, Artigo][] = [
  [/^Residências\b/, 'as'],
  [/^Lares\b/, 'os'],
  [/^(Casa|Residência|Quinta|Vila|Fundação|Associação|Santa Casa|Unidade|Mansão|Aldeia)\b/, 'a'],
  [/^(Lar|Centro|Solar|Recanto|Complexo|Instituto|Cantinho|Abrigo|Refúgio|Palacete)\b/, 'o'],
]
const EM: Record<Artigo, string> = { o: 'no', a: 'na', os: 'nos', as: 'nas' }
const DE: Record<Artigo, string> = { o: 'do', a: 'da', os: 'dos', as: 'das' }
const artigoDe = (nome: string) => ARTIGOS.find(([re]) => re.test(nome))?.[1]
/** "na Casa de Repouso X" / "no Lar Y" / "em Z" */
const emInst = (nome: string) => {
  const a = artigoDe(nome)
  return a ? `${EM[a]} ${nome}` : `em ${nome}`
}
/** "da Casa de Repouso X" / "do Lar Y" / "de Z" */
const deInst = (nome: string) => {
  const a = artigoDe(nome)
  return a ? `${DE[a]} ${nome}` : `de ${nome}`
}
/** "a Casa de Repouso X" / "o Lar Y" / "Z" */
const oInst = (nome: string) => {
  const a = artigoDe(nome)
  return a ? `${a} ${nome}` : nome
}

/** O que a pessoa estava a fazer quando lhe pedimos para entrar (parâmetros que seguem dentro do `voltar`). */
export type Intencao = { acao: 'pedir' | 'visita' | 'alerta' | 'guardar'; larId: string | null }

const ACOES: Record<string, Intencao['acao']> = { pedir: 'pedir', vaga: 'pedir', visita: 'visita', alerta: 'alerta', guardar: 'guardar' }

/**
 * Lê a intenção do `voltar`: `?acao=pedir|visita|alerta|guardar` na ficha de um lar,
 * `?pedir=vaga|visita`, ou `?guardar=<id>` / `?alerta=<id>` (ex.: o coração de um cartão na pesquisa).
 */
export function intencaoDe(path: string | null): Intencao | null {
  if (!isInternalPath(path)) return null
  const q = path.indexOf('?')
  if (q < 0) return null
  const params = new URLSearchParams(path.slice(q + 1).split('#')[0])
  const naFicha = larIdDoCaminho(path)
  const acao = ACOES[params.get('acao') ?? ''] ?? ACOES[params.get('pedir') ?? '']
  if (acao) return { acao, larId: naFicha }
  const guardar = params.get('guardar')
  if (guardar) return { acao: 'guardar', larId: guardar }
  const alerta = params.get('alerta')
  if (alerta) return { acao: 'alerta', larId: alerta }
  return null
}

function larIdDoCaminho(path: string): string | null {
  const m = path.match(/^\/lar\/([^/?#]+)/)
  if (!m) return null
  try {
    return decodeURIComponent(m[1]!)
  } catch {
    return m[1]!
  }
}

function frasesIntencao(i: Intencao, lar: Lar | undefined): string {
  if (!lar) {
    return { pedir: 'pedir vaga', visita: 'marcar uma visita', alerta: 'receber alertas de vaga', guardar: 'guardar esta instituição' }[i.acao]
  }
  switch (i.acao) {
    case 'pedir':
      return `pedir vaga ${emInst(lar.nome)}`
    case 'visita':
      return `marcar uma visita ${emInst(lar.nome)}`
    case 'alerta':
      return `receber alertas de vaga ${deInst(lar.nome)}`
    case 'guardar':
      return `guardar ${oInst(lar.nome)}`
  }
}

/** Descrição humana do destino ("a ficha da Casa X", "os seus pedidos de vaga"). */
export function descreverDestino(path: string | null, lares: Lar[]): string | null {
  if (!isInternalPath(path) || path === '/') return null
  const larId = larIdDoCaminho(path)
  if (larId) {
    const encontrado = lares.find((l) => l.id === larId)
    return encontrado ? `a ficha ${deInst(encontrado.nome)}` : 'a ficha da instituição'
  }
  return DESTINOS.find(([re]) => re.test(path))?.[1] ?? 'a página onde estava'
}

/**
 * Para que é preciso entrar, como continuação de "Inicie sessão para …":
 * a ação interrompida ("pedir vaga na Casa X", "guardar o Lar Y") ou, sem ela, "abrir <destino>".
 */
export function motivoDoDestino(path: string | null, lares: Lar[]): string | null {
  const intencao = intencaoDe(path)
  if (intencao) {
    const porId = (id: string | null) => (id ? lares.find((l) => l.id === id) : undefined)
    return frasesIntencao(intencao, porId(intencao.larId) ?? porId(larIdDoCaminho(path!)))
  }
  const destino = descreverDestino(path, lares)
  return destino ? `abrir ${destino}` : null
}
