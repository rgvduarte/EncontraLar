/**
 * Estado do questionário.
 * - As respostas ficam no sessionStorage: um refresh não perde nada, mas fechar o separador apaga tudo
 *   (dados de saúde — só ficam se a família decidir guardar).
 * - O ecrã visível vive no endereço, para o botão "voltar" do telemóvel andar de pergunta em pergunta:
 *   `/encontrar` = início, `/encontrar?passo=3` = 3.ª pergunta, `/encontrar?vista=resultados` = sugestões.
 *   Um endereço que salte perguntas por responder é corrigido para a primeira em falta.
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import type { PerfilIdoso } from '@/types'
import { dePerfil, limitar, primeiroIncompleto, RASCUNHO_VAZIO, TOTAL_PASSOS, type Rascunho } from './model'

const KEY = 'encontralar:encontrar'
/** Rascunho lido pelo painel da família depois do registo (contrato em docs/DESIGN.md). */
export const KEY_PERFIL_RASCUNHO = 'encontralar:perfil-rascunho'

export type Vista = 'inicio' | 'passos' | 'resultados'

export interface Sessao {
  v: 1
  /** ecrã visível (vem do endereço) */
  vista: Vista
  /** pergunta visível; fora das perguntas, a última que foi vista (para "Continuar no passo N") */
  passo: number
  /** passo mais avançado já alcançado */
  alcancado: number
  r: Rascunho
}

const INICIAL: Sessao = { v: 1, vista: 'inicio', passo: 0, alcancado: 0, r: RASCUNHO_VAZIO }

const ultimoPasso = TOTAL_PASSOS - 1

function ler(): Sessao {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return INICIAL
    const s = JSON.parse(raw) as Sessao
    if (s?.v !== 1 || typeof s.passo !== 'number' || !s.r) return INICIAL
    const r: Rascunho = { ...RASCUNHO_VAZIO, ...s.r }
    const passo = limitar(s.passo, 0, ultimoPasso)
    return { v: 1, vista: 'inicio', r, passo, alcancado: Math.max(passo, limitar(s.alcancado ?? 0, 0, ultimoPasso)) }
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

// ————————————————————————————————————————— endereço

interface Ecra {
  vista: Vista
  /** só nas perguntas (índice 0–5) */
  passo: number | null
}

/** O que o endereço pede (sem validar as respostas). */
function lerEndereco(params: URLSearchParams): Ecra {
  if (params.get('vista') === 'resultados') return { vista: 'resultados', passo: null }
  const n = Number.parseInt(params.get('passo') ?? '', 10)
  if (Number.isFinite(n)) return { vista: 'passos', passo: limitar(n - 1, 0, ultimoPasso) }
  return { vista: 'inicio', passo: null }
}

/** O ecrã que se pode mostrar: sugestões só com tudo respondido; nunca depois da primeira pergunta em falta. */
function ecraPermitido(pedido: Ecra, r: Rascunho): Ecra {
  const falta = primeiroIncompleto(r)
  if (pedido.vista === 'resultados') return falta === -1 ? pedido : { vista: 'passos', passo: falta }
  if (pedido.vista === 'passos' && pedido.passo != null && falta !== -1 && pedido.passo > falta)
    return { vista: 'passos', passo: falta }
  return pedido
}

const enderecoDe = (e: Ecra) =>
  e.vista === 'resultados' ? '/encontrar?vista=resultados' : e.vista === 'passos' ? `/encontrar?passo=${(e.passo ?? 0) + 1}` : '/encontrar'

/** Identifica um ecrã (para saber se a entrada anterior do histórico é aquela para onde vamos). */
const chave = (e: Ecra) => (e.vista === 'passos' ? `passo:${e.passo}` : e.vista)

/** Guardado no estado de cada entrada do histórico: de que ecrã do questionário se veio. */
interface EstadoHistorico {
  encontrarAnterior?: string
}

export function useMatchSession() {
  const [guardada, setGuardada] = useState<Sessao>(ler)
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const pedido = lerEndereco(params)
  const ecra = ecraPermitido(pedido, guardada.r)

  const sessao: Sessao = useMemo(
    () => ({
      ...guardada,
      vista: ecra.vista,
      passo: ecra.vista === 'passos' && ecra.passo != null ? ecra.passo : guardada.passo,
      alcancado:
        ecra.vista === 'resultados'
          ? ultimoPasso
          : ecra.vista === 'passos' && ecra.passo != null
            ? Math.max(guardada.alcancado, ecra.passo)
            : guardada.alcancado,
    }),
    [guardada, ecra.vista, ecra.passo],
  )

  // a última pergunta vista e o passo mais avançado ficam guardados (para retomar a partir do início)
  useEffect(() => {
    if (sessao.passo !== guardada.passo || sessao.alcancado !== guardada.alcancado)
      setGuardada((s) => ({ ...s, passo: sessao.passo, alcancado: sessao.alcancado }))
  }, [sessao.passo, sessao.alcancado, guardada.passo, guardada.alcancado])

  useEffect(() => {
    escreverSessao(KEY, sessao)
  }, [sessao])

  // endereço que salta perguntas por responder (ligação antiga, "avançar" do navegador): corrige sem nova entrada
  const destinoCorrigido = pedido.vista !== ecra.vista || pedido.passo !== ecra.passo ? enderecoDe(ecra) : null
  useEffect(() => {
    if (destinoCorrigido) navigate(destinoCorrigido, { replace: true, state: location.state })
  }, [destinoCorrigido, navigate, location.state])

  // o mais recente, para as ações (chamadas em eventos, depois da pintura)
  const atual = useRef({ ecra, r: guardada.r, estado: location.state as EstadoHistorico | null })
  useLayoutEffect(() => {
    atual.current = { ecra, r: guardada.r, estado: location.state as EstadoHistorico | null }
  })

  /**
   * Muda de ecrã com uma nova entrada no histórico. Se o destino é exatamente a entrada anterior
   * (ex.: "Voltar" numa pergunta a que se chegou com "Continuar"), recua no histórico em vez de empilhar.
   */
  const ir = useCallback(
    (destino: Ecra) => {
      const { ecra: deOnde, estado } = atual.current
      if (chave(destino) === chave(deOnde)) return
      if (estado?.encontrarAnterior === chave(destino)) navigate(-1)
      else navigate(enderecoDe(destino), { state: { encontrarAnterior: chave(deOnde) } satisfies EstadoHistorico })
    },
    [navigate],
  )

  const patch = useCallback((p: Partial<Rascunho>) => setGuardada((s) => ({ ...s, r: { ...s.r, ...p } })), [])

  const irPara = useCallback((passo: number) => ir({ vista: 'passos', passo: limitar(passo, 0, ultimoPasso) }), [ir])

  const verResultados = useCallback(() => {
    const falta = primeiroIncompleto(atual.current.r)
    ir(falta === -1 ? { vista: 'resultados', passo: null } : { vista: 'passos', passo: falta })
  }, [ir])

  const voltarAoInicio = useCallback(() => ir({ vista: 'inicio', passo: null }), [ir])

  const recomecar = useCallback(() => {
    setGuardada(INICIAL)
    atual.current = { ...atual.current, r: RASCUNHO_VAZIO }
    ir({ vista: 'passos', passo: 0 })
  }, [ir])

  const usarPerfil = useCallback(
    (p: PerfilIdoso) => {
      const r = dePerfil(p)
      const falta = primeiroIncompleto(r)
      const passo = falta === -1 ? ultimoPasso : falta
      setGuardada({ v: 1, vista: 'inicio', passo, alcancado: passo, r })
      atual.current = { ...atual.current, r }
      ir(falta === -1 ? { vista: 'resultados', passo: null } : { vista: 'passos', passo: falta })
    },
    [ir],
  )

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
