/**
 * Estado do questionário, guardado no sessionStorage: um refresh não perde as respostas,
 * mas fechar o separador apaga tudo (dados de saúde — só ficam se a família decidir guardar).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PerfilIdoso } from '@/types'
import { dePerfil, primeiroIncompleto, RASCUNHO_VAZIO, TOTAL_PASSOS, type Rascunho } from './model'

const KEY = 'encontralar:encontrar'
/** Rascunho lido pelo painel da família depois do registo (contrato em docs/DESIGN.md). */
export const KEY_PERFIL_RASCUNHO = 'encontralar:perfil-rascunho'

export type Vista = 'inicio' | 'passos' | 'resultados'

export interface Sessao {
  v: 1
  vista: Vista
  passo: number
  /** passo mais avançado já alcançado (o índice da barra lateral deixa saltar até aqui) */
  alcancado: number
  r: Rascunho
}

const INICIAL: Sessao = { v: 1, vista: 'inicio', passo: 0, alcancado: 0, r: RASCUNHO_VAZIO }

function ler(): Sessao {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return INICIAL
    const s = JSON.parse(raw) as Sessao
    if (s?.v !== 1 || typeof s.passo !== 'number' || !s.r) return INICIAL
    const r: Rascunho = { ...RASCUNHO_VAZIO, ...s.r }
    const passo = Math.max(0, Math.min(TOTAL_PASSOS - 1, s.passo))
    // resultados só com o perfil completo
    if (s.vista === 'resultados' && primeiroIncompleto(r) !== -1) {
      const p = primeiroIncompleto(r)
      return { ...s, r, vista: 'passos', passo: p, alcancado: Math.max(p, s.alcancado) }
    }
    return { ...s, r, passo, alcancado: Math.max(passo, Math.min(TOTAL_PASSOS - 1, s.alcancado ?? 0)) }
  } catch {
    return INICIAL
  }
}

export function escreverSessao(key: string, valor: unknown) {
  try {
    if (valor == null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, JSON.stringify(valor))
  } catch {
    /* modo privado / quota — o questionário continua a funcionar em memória */
  }
}

export function useMatchSession() {
  const [sessao, setSessao] = useState<Sessao>(ler)

  useEffect(() => {
    escreverSessao(KEY, sessao)
  }, [sessao])

  const patch = useCallback((p: Partial<Rascunho>) => setSessao((s) => ({ ...s, r: { ...s.r, ...p } })), [])

  const irPara = useCallback(
    (passo: number) =>
      setSessao((s) => {
        const p = Math.max(0, Math.min(TOTAL_PASSOS - 1, passo))
        return { ...s, vista: 'passos', passo: p, alcancado: Math.max(s.alcancado, p) }
      }),
    [],
  )

  const verResultados = useCallback(
    () =>
      setSessao((s) => {
        const falta = primeiroIncompleto(s.r)
        if (falta !== -1) return { ...s, vista: 'passos', passo: falta, alcancado: Math.max(s.alcancado, falta) }
        return { ...s, vista: 'resultados', alcancado: TOTAL_PASSOS - 1 }
      }),
    [],
  )

  const voltarAoInicio = useCallback(() => setSessao((s) => ({ ...s, vista: 'inicio' })), [])

  const recomecar = useCallback(() => setSessao({ ...INICIAL, vista: 'passos' }), [])

  const usarPerfil = useCallback((p: PerfilIdoso) => {
    const r = dePerfil(p)
    const falta = primeiroIncompleto(r)
    setSessao(
      falta === -1
        ? { v: 1, vista: 'resultados', passo: TOTAL_PASSOS - 1, alcancado: TOTAL_PASSOS - 1, r }
        : { v: 1, vista: 'passos', passo: falta, alcancado: falta, r },
    )
  }, [])

  const acoes = useMemo(
    () => ({ patch, irPara, verResultados, voltarAoInicio, recomecar, usarPerfil }),
    [patch, irPara, verResultados, voltarAoInicio, recomecar, usarPerfil],
  )
  return [sessao, acoes] as const
}

export type AcoesSessao = ReturnType<typeof useMatchSession>[1]

/** Há respostas em curso (para oferecer "continuar onde ficou"). */
export const temProgresso = (s: Sessao) =>
  Boolean(s.r.relacao || s.r.idade || s.r.grau || s.r.local || s.r.necessidades.length || s.r.semNecessidades)
