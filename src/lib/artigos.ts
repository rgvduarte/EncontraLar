/**
 * Artigos e contrações com nomes de instituições (PT-PT):
 * "ao Lar Santa Teresa", "à Casa de Repouso Jardins do Douro", "nas Residências Miradouro".
 * O artigo deduz-se da primeira palavra do nome; nomes que não reconhecemos ficam sem artigo
 * ("a Domus Vida" seria um palpite), o que continua gramatical: "em Domus Vida", "de Domus Vida".
 */

export type ArtigoLar = 'o' | 'a' | 'os' | 'as'

const MASCULINOS = new Set([
  'lar', 'centro', 'solar', 'instituto', 'complexo', 'abrigo', 'recanto', 'lugar', 'retiro', 'asilo',
  'espaço', 'cantinho', 'ninho', 'refúgio', 'palácio', 'monte', 'jardim', 'condomínio', 'empreendimento',
])
const FEMININOS = new Set([
  'casa', 'residência', 'fundação', 'associação', 'quinta', 'vivenda', 'mansão', 'misericórdia', 'comunidade',
  'unidade', 'estrutura', 'instituição', 'obra', 'irmandade', 'cooperativa', 'aldeia', 'santa', 'clínica',
])
const MASCULINOS_PL = new Set(['lares', 'centros', 'solares', 'apartamentos'])
const FEMININOS_PL = new Set(['residências', 'casas', 'quintas', 'vivendas'])

/** Separa um artigo já escrito no nome ("A Nossa Casa" → ['a', 'Nossa Casa']). */
function partir(nome: string): { art: ArtigoLar | null; resto: string } {
  const t = nome.trim()
  const m = /^(os|as|o|a)\s+(.+)$/i.exec(t)
  if (m && m[2]) return { art: m[1]!.toLowerCase() as ArtigoLar, resto: m[2] }
  const primeira = (t.split(/\s+/)[0] ?? '').toLowerCase()
  if (FEMININOS_PL.has(primeira)) return { art: 'as', resto: t }
  if (MASCULINOS_PL.has(primeira)) return { art: 'os', resto: t }
  if (FEMININOS.has(primeira)) return { art: 'a', resto: t }
  if (MASCULINOS.has(primeira)) return { art: 'o', resto: t }
  return { art: null, resto: t }
}

/** 'o' (Lar, Centro…), 'a' (Casa, Residência…), 'as' (Residências) ou null quando não se sabe. */
export const artigoLar = (nome: string): ArtigoLar | null => partir(nome).art

/** O nome refere-se a um plural ("Residências …") — para concordar o verbo. */
export const larPlural = (nome: string) => {
  const a = artigoLar(nome)
  return a === 'os' || a === 'as'
}

const AO: Record<ArtigoLar, string> = { o: 'ao', a: 'à', os: 'aos', as: 'às' }
const NO: Record<ArtigoLar, string> = { o: 'no', a: 'na', os: 'nos', as: 'nas' }
const DO: Record<ArtigoLar, string> = { o: 'do', a: 'da', os: 'dos', as: 'das' }
const PELO: Record<ArtigoLar, string> = { o: 'pelo', a: 'pela', os: 'pelos', as: 'pelas' }

function com(nome: string, tabela: Record<ArtigoLar, string> | null, semArtigo: string): string {
  const { art, resto } = partir(nome)
  if (!art) return semArtigo ? `${semArtigo} ${resto}` : resto
  return `${tabela ? tabela[art] : art} ${resto}`
}

/** "o Lar Santa Teresa", "a Casa dos Jacarandás", "as Residências Miradouro" */
export const oLar = (nome: string) => com(nome, null, '')
/** "ao Lar …", "à Casa …", "às Residências …", "a Domus Vida" */
export const aoLar = (nome: string) => com(nome, AO, 'a')
/** "no Lar …", "na Casa …", "nas Residências …", "em Domus Vida" */
export const noLar = (nome: string) => com(nome, NO, 'em')
/** "do Lar …", "da Casa …", "das Residências …", "de Domus Vida" */
export const doLar = (nome: string) => com(nome, DO, 'de')
/** "pelo Lar …", "pela Casa …", "por Domus Vida" */
export const peloLar = (nome: string) => com(nome, PELO, 'por')

/** Primeira letra em maiúscula (para começar frases: "A Casa …", "No Lar …"). */
export const maiuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/**
 * Concorda uma palavra com o nome da instituição.
 * flexLar('Residências Miradouro', 'Fundado', 'Fundada') → 'Fundadas'.
 * Sem artigo conhecido usa o feminino ("a instituição").
 */
export function flexLar(nome: string, masc: string, fem: string, mascPl = `${masc}s`, femPl = `${fem}s`): string {
  switch (artigoLar(nome)) {
    case 'o':
      return masc
    case 'os':
      return mascPl
    case 'as':
      return femPl
    default:
      return fem
  }
}
