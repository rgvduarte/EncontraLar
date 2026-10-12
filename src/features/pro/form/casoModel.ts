/**
 * Modelo do formulário do caso (novo caso e edição): valores por omissão, conversão para o perfil de cuidados
 * e validação — com as mesmas regras e mensagens do perfil da família.
 */
import type { Caso, Cuidado, GrauDependencia, Lar, PerfilIdoso, TipoQuarto } from '@/types'
import type { CasoInput, PerfilInput } from '@/lib/store'
import { LUGARES } from '@/data/localidades'
import { distanceKm } from '@/lib/geo'
import { isoDia } from '@/lib/format'
import { urgenciaDaAlta } from '../shared/caso'

export const RAIOS_KM = [5, 10, 15, 25, 50] as const
export const ORCAMENTO_MIN = 500
export const ORCAMENTO_MAX = 4000
export const QUARTOS: (TipoQuarto | 'indiferente')[] = ['indiferente', 'individual', 'duplo', 'casal']

export interface Local {
  label: string
  lat: number
  lng: number
}

export interface CasoForm {
  nome: string
  idade: number
  genero?: 'F' | 'M'
  grau: GrauDependencia
  necessidades: Cuidado[]
  quarto: TipoQuarto | 'indiferente'
  local: Local | null
  raioKm: number
  orcamentoMax: number
  precisaAcordoSS: boolean
  notas: string
  referencia: string
  /** AAAA-MM-DD ou '' */
  altaPrevista: string
  consentimento: boolean
}

/** Localidade conhecida mais próxima de uma instituição (para começar a zona perto dela, com ?lar=). */
export function lugarPerto(lar: Pick<Lar, 'lat' | 'lng'>): Local {
  let melhor = LUGARES[0]!
  let d = Infinity
  for (const l of LUGARES) {
    const x = distanceKm(l, lar)
    if (x < d) {
      d = x
      melhor = l
    }
  }
  return { label: melhor.label, lat: melhor.lat, lng: melhor.lng }
}

export function casoVazio(lar?: Pick<Lar, 'lat' | 'lng'>): CasoForm {
  return {
    nome: '',
    idade: Number.NaN,
    genero: undefined,
    grau: 'moderada',
    necessidades: [],
    quarto: 'indiferente',
    local: lar ? lugarPerto(lar) : null,
    raioKm: 15,
    orcamentoMax: 1500,
    precisaAcordoSS: false,
    notas: '',
    referencia: '',
    altaPrevista: '',
    consentimento: false,
  }
}

export function casoParaForm(caso: Caso, p: PerfilIdoso): CasoForm {
  return {
    nome: p.nome,
    idade: p.idade,
    genero: p.genero,
    grau: p.grau,
    necessidades: [...p.necessidades],
    quarto: p.quarto,
    local: { ...p.local },
    raioKm: p.raioKm,
    orcamentoMax: p.orcamentoMax,
    precisaAcordoSS: p.precisaAcordoSS,
    notas: p.notas ?? '',
    referencia: caso.referencia ?? '',
    altaPrevista: caso.altaPrevista ?? '',
    consentimento: caso.consentimento,
  }
}

/** Perfil de cuidados (sem id) a partir do formulário. */
export function perfilDoForm(f: CasoForm, base?: Pick<PerfilIdoso, 'preferencias' | 'relacao'>): Omit<PerfilInput, 'id'> {
  return {
    nome: f.nome.trim().replace(/\s+/g, ' '),
    idade: Math.round(f.idade),
    relacao: base?.relacao ?? 'Utente',
    genero: f.genero,
    grau: f.grau,
    necessidades: f.necessidades,
    preferencias: base?.preferencias ?? [],
    quarto: f.quarto,
    local: f.local!,
    raioKm: f.raioKm,
    orcamentoMax: f.orcamentoMax,
    urgencia: urgenciaDaAlta(f.altaPrevista || undefined),
    precisaAcordoSS: f.precisaAcordoSS,
    notas: f.notas.trim() || undefined,
  }
}

export function casoInput(f: CasoForm): CasoInput {
  return {
    perfil: perfilDoForm(f),
    referencia: f.referencia.trim() || undefined,
    altaPrevista: f.altaPrevista || undefined,
    consentimento: f.consentimento,
  }
}

export type CampoCaso = 'nome' | 'idade' | 'local' | 'orcamentoMax' | 'altaPrevista' | 'referencia' | 'consentimento'
export type ErrosCaso = Partial<Record<CampoCaso, string>>
/** Ordem dos campos no ecrã (o primeiro erro recebe o foco). */
export const ORDEM_CAMPOS: CampoCaso[] = ['nome', 'idade', 'local', 'orcamentoMax', 'altaPrevista', 'referencia', 'consentimento']

const ymdValida = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime())

export function validarCaso(
  f: CasoForm,
  { novo, altaInicial = '', hoje = isoDia(new Date()) }: { novo: boolean; altaInicial?: string; hoje?: string },
): ErrosCaso {
  const e: ErrosCaso = {}
  const nome = f.nome.trim()
  if (!nome) e.nome = 'Indique o nome ou as iniciais da pessoa.'
  else if (nome.length > 60) e.nome = 'Use no máximo 60 caracteres (basta o primeiro nome ou as iniciais).'
  if (!Number.isFinite(f.idade) || f.idade < 40 || f.idade > 120) e.idade = 'Indique uma idade entre 40 e 120 anos.'
  if (!f.local) e.local = 'Escolha a localidade de referência (onde a família vive, por exemplo).'
  if (!Number.isFinite(f.orcamentoMax) || f.orcamentoMax < 300) e.orcamentoMax = 'Indique um orçamento mensal de pelo menos 300 €.'
  if (f.altaPrevista) {
    if (!ymdValida(f.altaPrevista)) e.altaPrevista = 'Indique uma data válida.'
    // só se exige uma data futura quando a data é nova (um caso antigo pode ter a alta no passado)
    else if (f.altaPrevista < hoje && f.altaPrevista !== altaInicial) e.altaPrevista = 'A data prevista de alta não pode ser anterior a hoje.'
  }
  const ref = f.referencia.trim()
  if (ref.length > 40) e.referencia = 'Use no máximo 40 caracteres.'
  // 9 algarismos seguidos parecem um NIF ou um número de utente: identificam a pessoa
  else if (/(^|\D)\d{3} ?\d{3} ?\d{3}(?!\d)/.test(ref)) e.referencia = 'Parece um NIF ou um número de utente. Use uma referência interna que não identifique a pessoa.'
  if (novo && !f.consentimento) e.consentimento = 'Sem esta confirmação não é possível criar o caso.'
  return e
}

/** Igualdade estrutural simples (há alterações por guardar?). */
export const mesmoCaso = (a: CasoForm, b: CasoForm) => JSON.stringify(a) === JSON.stringify(b)
