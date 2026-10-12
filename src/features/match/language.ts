/**
 * Português de Portugal "à medida": como nos referimos à pessoa (a sua mãe, o seu pai, si),
 * artigos dos nomes de terras (do Porto, da Maia, de Braga) e as frases do resumo do perfil.
 */
import type { Cuidado, GrauDependencia, TipoQuarto, Urgencia } from '@/types'
import { euro } from '@/lib/format'
import { eProprio, generoEfetivo, idadeNum, type Rascunho } from './model'

// ————————————————————————————————————————— a pessoa

const RELACAO_NOME: Record<string, string> = {
  Mãe: 'mãe',
  Pai: 'pai',
  Avó: 'avó',
  Avô: 'avô',
  Sogra: 'sogra',
  Sogro: 'sogro',
  Tia: 'tia',
  Tio: 'tio',
}

export interface Pessoa {
  /** é o próprio utilizador */
  proprio: boolean
  fem: boolean | undefined
  /** "a sua mãe", "o João", "si" */
  a: string
  /** "A sua mãe", "O João", "Si" — início de frase */
  A: string
  /** "da sua mãe", "do João", "de si" */
  de: string
  /** "para a sua mãe", "para si" */
  para: string
  /** "ela", "ele", "si" */
  pronome: string
  /** primeiro nome, se indicado */
  primeiroNome: string
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Flexão simples de adjetivos: o(a) quando o género não é conhecido. */
export function flex(fem: boolean | undefined, masc: string, femForm: string, neutro = `${masc}(a)`) {
  return fem === true ? femForm : fem === false ? masc : neutro
}

export function pessoa(r: Pick<Rascunho, 'relacao' | 'genero' | 'nome'>): Pessoa {
  const g = generoEfetivo(r)
  const fem = g === 'F' ? true : g === 'M' ? false : undefined
  const primeiroNome = r.nome.trim().split(/\s+/)[0] ?? ''
  if (eProprio(r)) {
    return { proprio: true, fem, a: 'si', A: 'Si', de: 'de si', para: 'para si', pronome: 'si', primeiroNome }
  }
  const rel = RELACAO_NOME[r.relacao]
  let a: string
  if (rel) a = `${fem ? 'a sua' : 'o seu'} ${rel}`
  else if (primeiroNome) a = fem === true ? `a ${primeiroNome}` : fem === false ? `o ${primeiroNome}` : primeiroNome
  else if (r.relacao === 'Cônjuge') a = fem === true ? 'a sua mulher' : fem === false ? 'o seu marido' : 'o seu cônjuge'
  else if (r.relacao === 'Amigo(a)') a = fem === true ? 'a sua amiga' : fem === false ? 'o seu amigo' : 'a pessoa de quem cuida'
  else if (r.relacao === 'Outro familiar') a = fem === true ? 'a sua familiar' : 'o seu familiar'
  else a = 'a pessoa de quem cuida'

  const de = a.startsWith('a ') ? `da ${a.slice(2)}` : a.startsWith('o ') ? `do ${a.slice(2)}` : `de ${a}`
  const pronome = fem === false ? 'ele' : 'ela'
  return { proprio: false, fem, a, A: cap(a), de, para: `para ${a}`, pronome, primeiroNome }
}

// ————————————————————————————————————————— terras

/** Artigo usado com o nome da terra (a maioria não leva artigo). */
const ARTIGO_TERRA: Record<string, 'o' | 'a' | 'as' | 'os'> = {
  Porto: 'o',
  Barreiro: 'o',
  Montijo: 'o',
  Seixal: 'o',
  Estoril: 'o',
  Funchal: 'o',
  Lumiar: 'o',
  Areeiro: 'o',
  Bonfim: 'o',
  'Peso da Régua': 'o',
  'Parque das Nações': 'o',
  Maia: 'a',
  'Póvoa de Varzim': 'a',
  'Figueira da Foz': 'a',
  Lousã: 'a',
  'Marinha Grande': 'a',
  Covilhã: 'a',
  Guarda: 'a',
  Amadora: 'a',
  'Ribeira Grande': 'a',
  Boavista: 'a',
  'Foz do Douro': 'a',
  Estrela: 'a',
  'Caldas da Rainha': 'as',
}

const DE = { o: 'do', a: 'da', as: 'das', os: 'dos' } as const
const EM = { o: 'no', a: 'na', as: 'nas', os: 'nos' } as const

/** "do Porto", "de Braga", "da Maia" */
export function deTerra(nome: string): string {
  const art = ARTIGO_TERRA[nome]
  return art ? `${DE[art]} ${nome}` : `de ${nome}`
}
/** "no Porto", "em Braga", "na Maia" */
export function emTerra(nome: string): string {
  const art = ARTIGO_TERRA[nome]
  return art ? `${EM[art]} ${nome}` : `em ${nome}`
}

export const LABEL_GPS = 'A sua localização'

/** "do Porto", "de Alvalade", "da sua localização" — para "a 5 km do Porto" */
export function deLocal(label: string): string {
  if (label === LABEL_GPS) return 'da sua localização'
  const [cidade, zona] = label.split(' — ')
  return deTerra(zona ?? cidade ?? label)
}

/** "perto do Porto", "perto de Alvalade, em Lisboa", "perto da sua localização" */
export function pertoDe(label: string): string {
  if (label === LABEL_GPS) return 'perto da sua localização'
  const [cidade, zona] = label.split(' — ')
  if (zona && cidade) return `perto ${deTerra(zona)}, ${emTerra(cidade)}`
  return `perto ${deTerra(label)}`
}

// ————————————————————————————————————————— frases curtas

export function grauFrase(grau: GrauDependencia, fem: boolean | undefined): string {
  if (grau === 'autonomo') return flex(fem, 'autónomo', 'autónoma')
  return { ligeira: 'com dependência ligeira', moderada: 'com dependência moderada', grave: 'com dependência grave' }[grau]
}

/** Necessidades como complemento de "precisa de …". */
export const CUIDADO_FRASE: Record<Cuidado, string> = {
  enfermagem24h: 'enfermagem 24 horas',
  medico: 'acompanhamento médico',
  fisioterapia: 'fisioterapia',
  demencia: 'cuidados na demência',
  paliativos: 'cuidados paliativos',
  acamados: 'cuidados de pessoa acamada',
  diabetes: 'controlo da diabetes',
  oxigenio: 'oxigénio',
  terapia_ocupacional: 'terapia ocupacional',
  psicologia: 'apoio psicológico',
  nutricao: 'dieta acompanhada',
  terapia_fala: 'terapia da fala',
}

/** "a, b e c" — com "e mais N" quando a lista é longa. */
export function listaE(itens: string[], max = 3): string {
  if (itens.length <= 1) return itens[0] ?? ''
  if (itens.length > max) {
    const resto = itens.length - (max - 1)
    return `${itens.slice(0, max - 1).join(', ')} e mais ${resto}`
  }
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`
}

export const QUARTO_FRASE: Record<TipoQuarto, string> = {
  individual: 'em quarto individual',
  duplo: 'em quarto duplo',
  casal: 'em quarto de casal',
}

export const URGENCIA_FRASE: Record<Urgencia, string> = {
  imediata: 'com vaga o mais depressa possível',
  '1-3meses': 'com vaga nos próximos 1 a 3 meses',
  '3-6meses': 'com vaga dentro de 3 a 6 meses',
  planeamento: 'a planear com tempo',
}

// ————————————————————————————————————————— resumo do perfil, por partes

export interface ParteResumo {
  /** passo para onde o "Alterar" leva */
  passo: number
  texto: string
  /** descrição para o botão de alterar (leitores de ecrã) */
  oQue: string
}

/** A frase de resumo, partida em pedaços editáveis. Só inclui o que já foi respondido. */
export function partesResumo(r: Rascunho): ParteResumo[] {
  const p = pessoa(r)
  const partes: ParteResumo[] = []
  const idade = idadeNum(r)
  if (r.relacao) {
    let t = `Para ${p.a}`
    if (!p.proprio && p.primeiroNome && RELACAO_NOME[r.relacao]) t += `, ${p.primeiroNome}`
    if (idade != null) t += `, ${idade} anos`
    partes.push({ passo: 0, texto: t, oQue: 'a pessoa e a idade' })
  }
  if (r.grau) partes.push({ passo: 1, texto: grauFrase(r.grau, p.fem), oQue: 'o grau de autonomia' })
  if (r.semNecessidades) partes.push({ passo: 2, texto: 'sem necessidades especiais de saúde', oQue: 'as necessidades de saúde' })
  else if (r.necessidades.length)
    partes.push({
      passo: 2,
      texto: `que precisa de ${listaE(r.necessidades.map((n) => CUIDADO_FRASE[n]))}`,
      oQue: 'as necessidades de saúde',
    })
  if (r.local) partes.push({ passo: 3, texto: `${pertoDe(r.local.label)} (até ${r.raioKm} km)`, oQue: 'a zona e a distância' })
  if (r.orcamentoMax != null) {
    let t = `até ${euro(r.orcamentoMax)} por mês`
    if (r.quarto !== 'indiferente') t += ` ${QUARTO_FRASE[r.quarto]}`
    if (r.precisaAcordoSS) t += ', com comparticipação da Segurança Social'
    partes.push({ passo: 4, texto: t, oQue: 'o orçamento e o quarto' })
  }
  if (r.urgencia) partes.push({ passo: 5, texto: URGENCIA_FRASE[r.urgencia], oQue: 'a urgência e as prioridades' })
  return partes
}
