/**
 * Filtragem, ordenação, agrupamento e sugestões de "alívio" de filtros — funções puras.
 */
import type { Disponibilidade, Lar } from '@/types'
import type { EstimativaEspera } from '@/lib/forecast'
import { distanceKm, type LatLng } from '@/lib/geo'
import { CUIDADO_LABEL, DISPONIBILIDADE_DESCRICAO, GRAU_LABEL, NATUREZA_LABEL } from '@/lib/labels'
import { euro } from '@/lib/format'
import {
  centroDe,
  dentroDe,
  normalizar,
  opcoesRaio,
  type Filtros,
  type Local,
  type Ordem,
  type SearchState,
} from './searchState'

export interface Entrada {
  lar: Lar
  est: EstimativaEspera
  disp: Disponibilidade
  /** distância ao centro da pesquisa (quando há centro) */
  distanciaKm?: number
}

export const DISP_ORDEM: Record<Disponibilidade, number> = { disponivel: 0, breve: 1, espera: 2 }

export function construirEntradas(
  lares: Lar[],
  previsoes: Map<string, { est: EstimativaEspera; disp: Disponibilidade }>,
  centro: LatLng | null,
): Entrada[] {
  return lares.map((lar) => {
    const p = previsoes.get(lar.id)!
    return { lar, est: p.est, disp: p.disp, distanciaKm: centro ? distanceKm(centro, lar) : undefined }
  })
}

/** O local (lugar/coords + raio, distrito ou zona) contém a instituição? */
export function noLocal(e: Entrada, local: Local, raio: number): boolean {
  switch (local.tipo) {
    case 'lugar':
    case 'coords':
      return (e.distanciaKm ?? Infinity) <= raio
    case 'distrito':
      return e.lar.distrito === local.distrito
    case 'zona':
      return dentroDe(local.bounds, e.lar)
    default:
      return true
  }
}

export function passaFiltros(e: Entrada, f: Filtros): boolean {
  const { lar } = e
  if (f.tipos.length && !f.tipos.includes(lar.tipo)) return false
  if (f.vaga === 'agora' && e.disp !== 'disponivel') return false
  if (f.vaga === 'breve' && e.disp === 'espera') return false
  if (f.max != null && lar.mensalidadeMin > f.max) return false
  if (f.grau && !lar.graus.includes(f.grau)) return false
  if (f.cuidados.length && !f.cuidados.every((c) => lar.cuidados.includes(c))) return false
  if (f.ss && !lar.acordoSS) return false
  if (f.naturezas.length && !f.naturezas.includes(lar.natureza)) return false
  if (f.q) {
    const q = normalizar(f.q)
    const alvo = normalizar(`${lar.nome} ${lar.localidade} ${lar.concelho}`)
    if (!alvo.includes(q)) return false
  }
  return true
}

export function filtrar(entradas: Entrada[], s: Pick<SearchState, 'local' | 'raio'> & Filtros): Entrada[] {
  return entradas.filter((e) => noLocal(e, s.local, s.raio) && passaFiltros(e, s))
}

const espera = (e: Entrada) => (e.est.imediata ? 0 : (e.est.diasMediana ?? 10_000))

export function ordenar(lista: Entrada[], ordem: Ordem): Entrada[] {
  const arr = [...lista]
  const relevancia = (a: Entrada, b: Entrada) =>
    DISP_ORDEM[a.disp] - DISP_ORDEM[b.disp] ||
    b.lar.avaliacao - a.lar.avaliacao ||
    b.lar.atualizadoEm.localeCompare(a.lar.atualizadoEm)
  switch (ordem) {
    case 'distancia':
      return arr.sort((a, b) => (a.distanciaKm ?? 0) - (b.distanciaKm ?? 0) || relevancia(a, b))
    case 'preco':
      return arr.sort((a, b) => a.lar.mensalidadeMin - b.lar.mensalidadeMin || relevancia(a, b))
    case 'disponibilidade':
      return arr.sort((a, b) => espera(a) - espera(b) || b.lar.avaliacao - a.lar.avaliacao)
    case 'avaliacao':
      return arr.sort((a, b) => b.lar.avaliacao - a.lar.avaliacao || b.lar.numAvaliacoes - a.lar.numAvaliacoes)
    default:
      return arr.sort(relevancia)
  }
}

// ————————————————————————————————————————— grupos editoriais da lista

export interface Grupo {
  id: string
  titulo: string
  descricao?: string
  /** estado (para o símbolo do grupo) */
  disp?: Disponibilidade
  itens: Entrada[]
  /** total do grupo em todos os resultados (a lista pode estar paginada) */
  total: number
}

const DISP_TITULO: Record<Disponibilidade, string> = {
  disponivel: 'Com vaga agora',
  breve: 'Vaga prevista em breve',
  espera: 'Em lista de espera',
}

function chaveGrupo(e: Entrada, ordem: Ordem): { id: string; titulo: string; descricao?: string; disp?: Disponibilidade } | null {
  if (ordem === 'relevancia' || ordem === 'disponibilidade') {
    return { id: e.disp, titulo: DISP_TITULO[e.disp], descricao: DISPONIBILIDADE_DESCRICAO[e.disp], disp: e.disp }
  }
  if (ordem === 'distancia') {
    const d = e.distanciaKm ?? 0
    if (d <= 2) return { id: 'd2', titulo: 'A menos de 2 km' }
    if (d <= 5) return { id: 'd5', titulo: 'Entre 2 e 5 km' }
    if (d <= 10) return { id: 'd10', titulo: 'Entre 5 e 10 km' }
    if (d <= 25) return { id: 'd25', titulo: 'Entre 10 e 25 km' }
    return { id: 'dmais', titulo: 'A mais de 25 km' }
  }
  if (ordem === 'preco') {
    const p = e.lar.mensalidadeMin
    if (p < 800) return { id: 'p1', titulo: `Desde menos de ${euro(800)}`, descricao: 'Sobretudo IPSS e Misericórdias, onde a mensalidade depende dos rendimentos, e centros de dia.' }
    if (p < 1500) return { id: 'p2', titulo: `Entre ${euro(800)} e ${euro(1500)}` }
    if (p < 2500) return { id: 'p3', titulo: `Entre ${euro(1500)} e ${euro(2500)}` }
    return { id: 'p4', titulo: `${euro(2500)} ou mais` }
  }
  return null
}

/** Agrupa a parte visível da lista; `todos` serve para os totais de cada grupo. */
export function agrupar(visiveis: Entrada[], todos: Entrada[], ordem: Ordem): Grupo[] | null {
  if (ordem === 'avaliacao' || !visiveis.length) return null
  const totais = new Map<string, number>()
  for (const e of todos) {
    const k = chaveGrupo(e, ordem)
    if (k) totais.set(k.id, (totais.get(k.id) ?? 0) + 1)
  }
  const grupos: Grupo[] = []
  for (const e of visiveis) {
    const k = chaveGrupo(e, ordem)
    if (!k) return null
    let g = grupos[grupos.length - 1]
    if (!g || g.id !== k.id) {
      g = { ...k, itens: [], total: totais.get(k.id) ?? 0 }
      grupos.push(g)
    }
    g.itens.push(e)
  }
  return grupos
}

// ————————————————————————————————————————— alívios para o estado vazio

export interface Alivio {
  id: string
  /** ação em linguagem simples: "Alargar o raio para 25 km" */
  acao: string
  /** nº de instituições que passam a aparecer */
  n: number
  patch: Partial<SearchState>
}

/**
 * Para cada restrição ativa, quantas instituições aparecem se a aliviarmos.
 * Ordem: dos ajustes mais pequenos para os maiores; "todo o país" fica sempre como último recurso.
 */
export function calcularAlivios(entradas: Entrada[], s: SearchState): Alivio[] {
  const conta = (patch: Partial<SearchState>) => filtrar(entradas, { ...s, ...patch }).length
  const out: Alivio[] = []
  const add = (id: string, acao: string, patch: Partial<SearchState>) => {
    const n = conta(patch)
    if (n > 0) out.push({ id, acao, n, patch })
  }

  if (centroDe(s.local)) {
    const maior = opcoesRaio(s.local).find((r) => r > s.raio && conta({ raio: r }) > 0)
    if (maior) add('raio', `Alargar o raio para ${maior} km`, { raio: maior })
  }
  if (s.vaga === 'agora') add('vaga-breve', 'Incluir vagas previstas em breve', { vaga: 'breve' })
  if (s.vaga) add('vaga', `Retirar «${s.vaga === 'agora' ? 'Com vaga agora' : 'Vaga em breve'}»`, { vaga: null })
  if (s.max != null) {
    const degraus = [800, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 4000].filter((v) => v > s.max!)
    const sobe = degraus.find((v) => conta({ max: v }) > 0)
    if (sobe) add('max', `Subir o orçamento até ${euro(sobe)}`, { max: sobe })
    else add('max-off', 'Retirar o limite de orçamento', { max: null })
  }
  if (s.cuidados.length) {
    for (const c of s.cuidados) add(`c-${c}`, `Deixar de exigir «${CUIDADO_LABEL[c]}»`, { cuidados: s.cuidados.filter((x) => x !== c) })
  }
  if (s.grau) add('grau', `Não filtrar por ${GRAU_LABEL[s.grau].toLowerCase()}`, { grau: null })
  if (s.ss) add('ss', 'Incluir instituições sem acordo com a Segurança Social', { ss: false })
  if (s.tipos.length) add('tipos', 'Incluir todos os tipos de resposta', { tipos: [] })
  if (s.naturezas.length) {
    const nome = s.naturezas.length === 1 ? `além de ${NATUREZA_LABEL[s.naturezas[0]!]}` : 'de qualquer natureza'
    add('nat', `Incluir instituições ${nome}`, { naturezas: [] })
  }
  if (s.q) add('q', `Não filtrar pelo nome «${s.q}»`, { q: '' })

  const pequenos = out.slice(0, 3)
  if (s.local.tipo !== 'pais') {
    const n = conta({ local: { tipo: 'pais' } })
    if (n > 0) pequenos.push({ id: 'local', acao: 'Procurar em todo o país', n, patch: { local: { tipo: 'pais' } } })
  }
  return pequenos
}
