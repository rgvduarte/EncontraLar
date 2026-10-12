/** Concelhos que levam artigo ("no Porto", "na Maia"); os restantes não ("em Braga", "de Lisboa"). */
const MASCULINO = new Set(['Porto', 'Barreiro', 'Funchal', 'Montijo', 'Seixal', 'Peso da Régua', 'Cartaxo', 'Entroncamento'])
const FEMININO = new Set([
  'Amadora', 'Covilhã', 'Figueira da Foz', 'Guarda', 'Lousã', 'Maia', 'Marinha Grande', 'Póvoa de Varzim', 'Ribeira Grande', 'Golegã',
])

/** comPreposicao('em', 'Porto') → "no Porto"; comPreposicao('de', 'Braga') → "de Braga". */
export function comPreposicao(prep: 'em' | 'de', lugar: string): string {
  const base = lugar.split(' — ')[0]!.trim()
  const artigo = MASCULINO.has(base) ? 'o' : FEMININO.has(base) ? 'a' : null
  if (!artigo) return `${prep} ${lugar}`
  const contracao = prep === 'em' ? `n${artigo}` : `d${artigo}`
  return `${contracao} ${lugar}`
}

/** "distrito de Braga"; nas ilhas, "Região Autónoma da Madeira/dos Açores". */
export function distritoTexto(distrito: string): string {
  if (distrito === 'Madeira') return 'Região Autónoma da Madeira'
  if (distrito === 'Açores') return 'Região Autónoma dos Açores'
  return `distrito de ${distrito}`
}
