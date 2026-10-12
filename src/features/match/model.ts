/**
 * Modelo do questionário "Ajuda-me a escolher": o rascunho que se vai preenchendo,
 * os seis passos, a validação de cada passo e a conversão para o perfil do motor de compatibilidade.
 */
import type { Comodidade, Cuidado, GrauDependencia, PerfilIdoso, TipoQuarto, Urgencia } from '@/types'
import type { PerfilInput } from '@/lib/store'
import type { recomendar } from '@/lib/matching'

export type Quarto = TipoQuarto | 'indiferente'
export interface Local {
  label: string
  lat: number
  lng: number
}

/** Perfil usado pelo motor de compatibilidade (mesmo formato que `recomendar` recebe). */
export type PerfilMatch = Parameters<typeof recomendar>[1]

export interface Rascunho {
  /** id do perfil guardado de onde veio (para "guardar alterações") */
  id?: string
  relacao: string
  nome: string
  /** texto do campo; convertido com `idadeNum` */
  idade: string
  genero: '' | 'F' | 'M'
  grau: GrauDependencia | ''
  necessidades: Cuidado[]
  /** escolheu explicitamente "Nenhuma necessidade especial" */
  semNecessidades: boolean
  local: Local | null
  raioKm: number
  /** null = ainda não visitou o passo do orçamento */
  orcamentoMax: number | null
  precisaAcordoSS: boolean
  quarto: Quarto
  urgencia: Urgencia | ''
  preferencias: Comodidade[]
  /** notas de um perfil guardado (preservadas ao guardar alterações) */
  notas?: string
}

export const RASCUNHO_VAZIO: Rascunho = {
  relacao: '',
  nome: '',
  idade: '',
  genero: '',
  grau: '',
  necessidades: [],
  semNecessidades: false,
  local: null,
  raioKm: 15,
  orcamentoMax: null,
  precisaAcordoSS: false,
  quarto: 'indiferente',
  urgencia: '',
  preferencias: [],
}

export const PASSOS = [
  { id: 'pessoa', nome: 'Para quem' },
  { id: 'autonomia', nome: 'Autonomia' },
  { id: 'saude', nome: 'Saúde' },
  { id: 'local', nome: 'Onde' },
  { id: 'orcamento', nome: 'Orçamento' },
  { id: 'quando', nome: 'Quando e prioridades' },
] as const
export type PassoId = (typeof PASSOS)[number]['id']
export const TOTAL_PASSOS = PASSOS.length

export const MAX_PREFERENCIAS = 5
export const RAIO_MIN = 5
export const RAIO_MAX = 50
export const ORCAMENTO_MIN = 300
export const ORCAMENTO_MAX = 5000
export const ORCAMENTO_PASSO = 50
export const IDADE_MIN = 40
export const IDADE_MAX = 115

/** Relações que já indicam o género (não é preciso perguntar). */
export const GENERO_DA_RELACAO: Record<string, 'F' | 'M'> = {
  Mãe: 'F',
  Pai: 'M',
  Avó: 'F',
  Avô: 'M',
  Sogra: 'F',
  Sogro: 'M',
  Tia: 'F',
  Tio: 'M',
}

export const generoEfetivo = (r: Pick<Rascunho, 'relacao' | 'genero'>): 'F' | 'M' | undefined =>
  GENERO_DA_RELACAO[r.relacao] ?? (r.genero || undefined)

export const eProprio = (r: Pick<Rascunho, 'relacao'>) => r.relacao === 'Eu próprio(a)'

export function idadeNum(r: Pick<Rascunho, 'idade'>): number | null {
  const n = Number.parseInt(r.idade.trim(), 10)
  return Number.isFinite(n) ? n : null
}

export type Erros = Partial<Record<'relacao' | 'idade' | 'grau' | 'necessidades' | 'local' | 'urgencia', string>>

export function validarPasso(passo: number, r: Rascunho): Erros {
  const e: Erros = {}
  switch (passo) {
    case 0: {
      if (!r.relacao) e.relacao = 'Indique para quem está a procurar.'
      const idade = idadeNum(r)
      if (idade == null) e.idade = 'Indique a idade (em anos).'
      else if (idade < IDADE_MIN || idade > IDADE_MAX) e.idade = `Indique uma idade entre ${IDADE_MIN} e ${IDADE_MAX} anos.`
      break
    }
    case 1:
      if (!r.grau) e.grau = 'Escolha a opção que melhor descreve o dia a dia — pode mudar depois.'
      break
    case 2:
      if (!r.necessidades.length && !r.semNecessidades)
        e.necessidades = 'Escolha pelo menos uma necessidade, ou "Nenhuma necessidade especial".'
      break
    case 3:
      if (!r.local) e.local = 'Escolha uma localidade da lista, ou use a sua localização atual.'
      break
    case 5:
      if (!r.urgencia) e.urgencia = 'Diga-nos para quando precisa de vaga.'
      break
  }
  return e
}

export const passoValido = (passo: number, r: Rascunho) =>
  Object.keys(validarPasso(passo, r)).length === 0 && (passo !== 4 || r.orcamentoMax != null)

/** Índice do primeiro passo por completar (ou -1 se estiver tudo respondido). */
export function primeiroIncompleto(r: Rascunho): number {
  for (let i = 0; i < TOTAL_PASSOS; i++) if (!passoValido(i, r)) return i
  return -1
}

export function paraPerfilMatch(r: Rascunho): PerfilMatch | null {
  if (primeiroIncompleto(r) !== -1 || !r.grau || !r.local || !r.urgencia || r.orcamentoMax == null) return null
  return {
    grau: r.grau,
    necessidades: r.semNecessidades ? [] : r.necessidades,
    preferencias: r.preferencias,
    quarto: r.quarto,
    local: r.local,
    raioKm: r.raioKm,
    orcamentoMax: r.orcamentoMax,
    urgencia: r.urgencia,
    precisaAcordoSS: r.precisaAcordoSS,
  }
}

/** Converte para o formato de `savePerfil` (o nome cai para a relação se ficar vazio). */
export function paraPerfilInput(r: Rascunho, nomeOverride?: string): PerfilInput | null {
  const m = paraPerfilMatch(r)
  const idade = idadeNum(r)
  if (!m || idade == null) return null
  const nome = (nomeOverride ?? r.nome).trim() || r.relacao
  return {
    ...(r.id ? { id: r.id } : {}),
    ...m,
    nome,
    idade,
    relacao: r.relacao,
    genero: generoEfetivo(r),
    notas: r.notas,
  }
}

export function dePerfil(p: Pick<PerfilIdoso, keyof PerfilInput> & { id?: string }): Rascunho {
  return {
    id: p.id,
    relacao: p.relacao,
    nome: p.nome === p.relacao ? '' : p.nome,
    idade: String(p.idade),
    genero: p.genero ?? '',
    grau: p.grau,
    necessidades: [...p.necessidades],
    semNecessidades: p.necessidades.length === 0,
    local: { ...p.local },
    raioKm: Math.min(RAIO_MAX, Math.max(RAIO_MIN, Math.round(p.raioKm / 5) * 5)),
    orcamentoMax: Math.min(ORCAMENTO_MAX, Math.max(ORCAMENTO_MIN, p.orcamentoMax)),
    precisaAcordoSS: p.precisaAcordoSS,
    quarto: p.quarto,
    urgencia: p.urgencia,
    preferencias: p.preferencias.slice(0, MAX_PREFERENCIAS),
    notas: p.notas,
  }
}

export const arredondar = (v: number, passo: number) => Math.round(v / passo) * passo
export const limitar = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
