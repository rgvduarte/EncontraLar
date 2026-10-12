import { useState } from 'react'
import type { Comodidade, Cuidado, GrauDependencia, Lar } from '@/types'
import { atualizarLar } from '@/lib/store'

/** Rascunho da ficha pública: tudo em texto, como está nos campos. */
export interface Rascunho {
  resumo: string
  descricao: string
  telefone: string
  email: string
  website: string
  morada: string
  codigoPostal: string
  graus: GrauDependencia[]
  cuidados: Cuidado[]
  comodidades: Comodidade[]
  /** um item por linha */
  incluido: string
  extras: { nome: string; preco: string }[]
  acordoSS: boolean
  cuidadoresPor10: string
  enfermeiros: string
  medicoHorasSemana: string
}

export type Erros = Partial<Record<keyof Rascunho, string>>

export const MAX_RESUMO = 160

export function deLar(lar: Lar): Rascunho {
  return {
    resumo: lar.resumo,
    descricao: lar.descricao,
    telefone: lar.telefone,
    email: lar.email,
    website: lar.website ?? '',
    morada: lar.morada,
    codigoPostal: lar.codigoPostal,
    graus: lar.graus,
    cuidados: lar.cuidados,
    comodidades: lar.comodidades,
    incluido: lar.incluido.join('\n'),
    extras: lar.extras.map((e) => ({ ...e })),
    acordoSS: lar.acordoSS,
    cuidadoresPor10: lar.equipa.cuidadoresPor10 ? String(lar.equipa.cuidadoresPor10).replace('.', ',') : '',
    enfermeiros: lar.equipa.enfermeiros ? String(lar.equipa.enfermeiros) : '',
    medicoHorasSemana: lar.equipa.medicoHorasSemana ? String(lar.equipa.medicoHorasSemana) : '',
  }
}

/** "4,5" → 4.5 ; "" → 0 ; inválido → NaN */
const numero = (s: string) => (s.trim() === '' ? 0 : /^\s*\d+([.,]\d+)?\s*$/.test(s) ? Number(s.replace(',', '.')) : NaN)

export function validar(r: Rascunho): Erros {
  const e: Erros = {}
  if (r.resumo.length > MAX_RESUMO) e.resumo = `Use no máximo ${MAX_RESUMO} caracteres.`
  if (!r.email.trim()) e.email = 'Indique um email de contacto.'
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email.trim())) e.email = 'O email não parece válido.'
  const digitos = r.telefone.replace(/\D/g, '').length
  if (r.telefone.trim() && (digitos < 8 || digitos > 15 || /[^\d\s+()-]/.test(r.telefone))) e.telefone = 'Confirme o número de telefone.'
  if (r.website.trim() && !/^(https?:\/\/)?[^\s.]+\.[^\s]{2,}$/i.test(r.website.trim())) e.website = 'O endereço não parece válido (ex.: www.exemplo.pt).'
  if (r.codigoPostal.trim() && !/^\d{4}-\d{3}$/.test(r.codigoPostal.trim())) e.codigoPostal = 'Use o formato 0000-000.'
  if (r.graus.length === 0) e.graus = 'Escolha pelo menos um grau de dependência.'
  if (r.extras.some((x) => !x.nome.trim() && x.preco.trim())) e.extras = 'Cada extra precisa de um nome.'
  const cuid = numero(r.cuidadoresPor10)
  if (Number.isNaN(cuid) || cuid > 20) e.cuidadoresPor10 = 'Indique um número entre 0 e 20 (ex.: 4,5).'
  const enf = numero(r.enfermeiros)
  if (Number.isNaN(enf) || !Number.isInteger(enf) || enf > 200) e.enfermeiros = 'Indique um número inteiro.'
  const med = numero(r.medicoHorasSemana)
  if (Number.isNaN(med) || med > 168) e.medicoHorasSemana = 'Indique as horas por semana (0 a 168).'
  return e
}

/** Converte o rascunho no que se grava (assume valores válidos; valores inválidos ficam a 0). */
export function paraLar(r: Rascunho): Partial<Lar> {
  const n = (s: string) => {
    const v = numero(s)
    return Number.isNaN(v) ? 0 : v
  }
  const website = r.website.trim()
  return {
    resumo: r.resumo.trim(),
    descricao: r.descricao.trim(),
    telefone: r.telefone.trim(),
    email: r.email.trim(),
    website: website || undefined,
    morada: r.morada.trim(),
    codigoPostal: r.codigoPostal.trim(),
    graus: r.graus,
    cuidados: r.cuidados,
    comodidades: r.comodidades,
    incluido: r.incluido
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
    extras: r.extras.map((x) => ({ nome: x.nome.trim(), preco: x.preco.trim() })).filter((x) => x.nome),
    acordoSS: r.acordoSS,
    equipa: { cuidadoresPor10: n(r.cuidadoresPor10), enfermeiros: Math.round(n(r.enfermeiros)), medicoHorasSemana: n(r.medicoHorasSemana) },
  }
}

/** Estado do formulário da ficha: rascunho, erros (depois da 1.ª tentativa) e gravação. */
export function useFichaForm(lar: Lar) {
  const [rascunho, setRascunho] = useState<Rascunho | null>(null)
  const [tentou, setTentou] = useState(false)
  const r = rascunho ?? deLar(lar)
  const sujo = rascunho != null && JSON.stringify(rascunho) !== JSON.stringify(deLar(lar))
  const erros = tentou ? validar(r) : {}

  const set = <K extends keyof Rascunho>(k: K, v: Rascunho[K]) => setRascunho({ ...r, [k]: v })
  const alternar = <K extends 'graus' | 'cuidados' | 'comodidades'>(k: K, item: Rascunho[K][number], on: boolean) => {
    const atual = r[k] as string[]
    set(k, (on ? [...atual, item] : atual.filter((x) => x !== item)) as Rascunho[K])
  }

  /** Grava se for válido; devolve true em caso de sucesso. */
  const guardar = (): boolean => {
    setTentou(true)
    if (Object.keys(validar(r)).length) return false
    atualizarLar(lar.id, paraLar(r))
    setRascunho(null)
    setTentou(false)
    return true
  }

  const repor = () => {
    setRascunho(null)
    setTentou(false)
  }

  return { r, erros, sujo, set, alternar, guardar, repor }
}
