/**
 * Modelo do formulário do perfil de cuidados: valores por omissão, normalização do rascunho do
 * questionário (/encontrar) e validação.
 */
import type { Comodidade, Cuidado, GrauDependencia, PerfilIdoso, TipoQuarto, Urgencia } from '@/types'
import type { PerfilInput } from '@/lib/store'
import { LUGARES } from '@/data/localidades'
import { COMODIDADE_LABEL, CUIDADO_LABEL, GRAU_LABEL, URGENCIA_LABEL } from '@/lib/labels'

export const RASCUNHO_KEY = 'encontralar:perfil-rascunho'

export const RAIOS_KM = [5, 10, 15, 25, 50] as const
export const ORCAMENTO_MIN = 500
export const ORCAMENTO_MAX = 4000

const LISBOA = LUGARES.find((l) => l.label === 'Lisboa') ?? LUGARES[0]!

export function perfilVazio(base?: Pick<PerfilIdoso, 'local' | 'raioKm'>): PerfilInput {
  return {
    nome: '',
    idade: 80,
    relacao: 'Mãe',
    genero: undefined,
    grau: 'ligeira',
    necessidades: [],
    preferencias: [],
    quarto: 'indiferente',
    local: base?.local ?? { label: LISBOA.label, lat: LISBOA.lat, lng: LISBOA.lng },
    raioKm: base?.raioKm ?? 15,
    orcamentoMax: 1800,
    urgencia: '1-3meses',
    precisaAcordoSS: false,
    notas: '',
  }
}

export function perfilParaInput(p: PerfilIdoso): PerfilInput {
  return {
    id: p.id,
    nome: p.nome,
    idade: p.idade,
    relacao: p.relacao,
    genero: p.genero,
    grau: p.grau,
    necessidades: [...p.necessidades],
    preferencias: [...p.preferencias],
    quarto: p.quarto,
    local: { ...p.local },
    raioKm: p.raioKm,
    orcamentoMax: p.orcamentoMax,
    urgencia: p.urgencia,
    precisaAcordoSS: p.precisaAcordoSS,
    notas: p.notas ?? '',
  }
}

const GRAUS = Object.keys(GRAU_LABEL) as GrauDependencia[]
const CUIDADOS = Object.keys(CUIDADO_LABEL) as Cuidado[]
const COMODIDADES = Object.keys(COMODIDADE_LABEL) as Comodidade[]
const URGENCIAS = Object.keys(URGENCIA_LABEL) as Urgencia[]
const QUARTOS: (TipoQuarto | 'indiferente')[] = ['indiferente', 'individual', 'duplo', 'casal']

const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def)
const str = (v: unknown, def = '') => (typeof v === 'string' ? v : def)

/** Converte o JSON guardado pelo questionário num PerfilInput válido (ou null se não servir). */
export function normalizarRascunho(raw: unknown): PerfilInput | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const base = perfilVazio()
  const loc = r.local as Record<string, unknown> | undefined
  const local =
    loc && typeof loc.lat === 'number' && typeof loc.lng === 'number'
      ? { label: str(loc.label, 'Local indicado'), lat: loc.lat, lng: loc.lng }
      : base.local
  const grau = GRAUS.includes(r.grau as GrauDependencia) ? (r.grau as GrauDependencia) : null
  if (!grau) return null
  return {
    nome: str(r.nome).trim(),
    idade: Math.round(num(r.idade, base.idade)),
    relacao: str(r.relacao, base.relacao) || base.relacao,
    genero: r.genero === 'F' || r.genero === 'M' ? r.genero : undefined,
    grau,
    necessidades: Array.isArray(r.necessidades) ? (r.necessidades.filter((n) => CUIDADOS.includes(n as Cuidado)) as Cuidado[]) : [],
    preferencias: Array.isArray(r.preferencias) ? (r.preferencias.filter((n) => COMODIDADES.includes(n as Comodidade)) as Comodidade[]) : [],
    quarto: QUARTOS.includes(r.quarto as TipoQuarto) ? (r.quarto as TipoQuarto | 'indiferente') : 'indiferente',
    local,
    raioKm: Math.max(1, Math.round(num(r.raioKm, base.raioKm))),
    orcamentoMax: Math.round(num(r.orcamentoMax, base.orcamentoMax)),
    urgencia: URGENCIAS.includes(r.urgencia as Urgencia) ? (r.urgencia as Urgencia) : base.urgencia,
    precisaAcordoSS: r.precisaAcordoSS === true,
    notas: str(r.notas),
  }
}

export function lerRascunho(): PerfilInput | null {
  try {
    const raw = sessionStorage.getItem(RASCUNHO_KEY)
    return raw ? normalizarRascunho(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

export function apagarRascunho() {
  try {
    sessionStorage.removeItem(RASCUNHO_KEY)
  } catch {
    /* ignorar */
  }
}

export type ErrosPerfil = Partial<Record<'nome' | 'idade' | 'orcamentoMax', string>>

export function validarPerfil(p: PerfilInput): ErrosPerfil {
  const e: ErrosPerfil = {}
  if (!p.nome.trim()) e.nome = 'Indique o nome da pessoa (basta o primeiro nome).'
  if (!Number.isFinite(p.idade) || p.idade < 40 || p.idade > 120) e.idade = 'Indique uma idade entre 40 e 120 anos.'
  if (!Number.isFinite(p.orcamentoMax) || p.orcamentoMax < 300) e.orcamentoMax = 'Indique um orçamento mensal de pelo menos 300 €.'
  return e
}

/** Igualdade estrutural simples para saber se há alterações por guardar. */
export const mesmoPerfil = (a: PerfilInput, b: PerfilInput) => JSON.stringify(a) === JSON.stringify(b)
