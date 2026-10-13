/**
 * Filtragem, ordenação, divisão da lista e sugestões de "alívio" de filtros — funções puras.
 * `completo = false` é a versão grátis (gratis.ts): nada aqui depende das vagas nem do preço exato.
 */
import type { Disponibilidade, Lar } from '@/types'
import { vagaParaNovos, type EstimativaEspera } from '@/lib/forecast'
import { distanceKm, type LatLng } from '@/lib/geo'
import { CUIDADO_LABEL, GRAU_LABEL, NATUREZA_LABEL } from '@/lib/labels'
import { euro } from '@/lib/format'
import { cabeNaFaixa, FAIXAS_ORCAMENTO, faixaDoOrcamento, indiceFaixa, ROTULO_FAIXA } from './gratis'
import {
  centroDe,
  dentroDe,
  normalizar,
  opcoesRaio,
  type Filtros,
  type Local,
  type Ordem,
  type SearchState,
  VAGA_LABEL,
} from './searchState'

export interface Entrada {
  lar: Lar
  est: EstimativaEspera
  /** estado indicado pela instituição (cor do marcador e do cartão) */
  disp: Disponibilidade
  /**
   * Estado para quem pede hoje: um lugar livre que deverá ir para a lista de espera não é "vaga agora"
   * (conta como em breve ou lista de espera, conforme a previsão). Usado nos filtros, grupos e contagens.
   */
  novos: Disponibilidade
  /** distância ao centro da pesquisa (quando há centro) */
  distanciaKm?: number
}

export const DISP_ORDEM: Record<Disponibilidade, number> = { disponivel: 0, breve: 1, espera: 2 }

/** Disponibilidade para um pedido feito hoje (ver `Entrada.novos`). */
export function dispParaNovos(lar: Lar, est: EstimativaEspera): Disponibilidade {
  if (vagaParaNovos(lar, est)) return 'disponivel'
  return est.p90 >= 0.5 ? 'breve' : 'espera'
}

/** Tem vaga para quem pede hoje ("Com vaga agora"). */
export const comVagaAgora = (e: Pick<Entrada, 'novos'>) => e.novos === 'disponivel'

/** Lugar livre, mas já prometido a quem está na lista de espera. */
export const livreComLista = (e: Pick<Entrada, 'disp' | 'novos'>) => e.disp === 'disponivel' && e.novos !== 'disponivel'

/** Cor a mostrar no mapa — a mesma do cartão: lugar livre com lista à frente aparece a laranja ("em breve"). */
export const dispVisivel = (e: Pick<Entrada, 'disp' | 'novos'>): Disponibilidade => (livreComLista(e) ? 'breve' : e.disp)

export function construirEntradas(
  lares: Lar[],
  previsoes: Map<string, { est: EstimativaEspera; disp: Disponibilidade }>,
  centro: LatLng | null,
): Entrada[] {
  return lares.map((lar) => {
    const p = previsoes.get(lar.id)!
    return { lar, est: p.est, disp: p.disp, novos: dispParaNovos(lar, p.est), distanciaKm: centro ? distanceKm(centro, lar) : undefined }
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

/** `completo = false` (versão grátis): sem filtro por vaga e orçamento por faixas. */
export function passaFiltros(e: Entrada, f: Filtros, completo = true): boolean {
  const { lar } = e
  if (f.tipos.length && !f.tipos.includes(lar.tipo)) return false
  if (completo) {
    if (f.vaga === 'agora' && e.novos !== 'disponivel') return false
    if (f.vaga === 'breve' && e.novos === 'espera') return false
    if (f.max != null && lar.mensalidadeMin > f.max) return false
  } else if (!cabeNaFaixa(lar.mensalidadeMin, f.max)) return false
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

export function filtrar(entradas: Entrada[], s: Pick<SearchState, 'local' | 'raio'> & Filtros, completo = true): Entrada[] {
  return entradas.filter((e) => noLocal(e, s.local, s.raio) && passaFiltros(e, s, completo))
}

const espera = (e: Entrada) => (e.est.imediata ? 0 : (e.est.diasMediana ?? 10_000))

/**
 * Versão grátis: a relevância sem as vagas nem a data em que foram confirmadas (senão as primeiras da lista
 * seriam as que têm vaga); empates pelo nº de avaliações e pelo nome, para a ordem ser estável.
 */
const relevanciaGratis = (a: Entrada, b: Entrada) =>
  b.lar.avaliacao - a.lar.avaliacao || b.lar.numAvaliacoes - a.lar.numAvaliacoes || a.lar.nome.localeCompare(b.lar.nome, 'pt')

/** `completo = false` (versão grátis): nada depende das vagas; o preço conta por faixa, não pelo valor exato. */
export function ordenar(lista: Entrada[], ordem: Ordem, completo = true): Entrada[] {
  const arr = [...lista]
  const relevancia = completo
    ? (a: Entrada, b: Entrada) =>
        DISP_ORDEM[a.novos] - DISP_ORDEM[b.novos] ||
        b.lar.avaliacao - a.lar.avaliacao ||
        b.lar.atualizadoEm.localeCompare(a.lar.atualizadoEm)
    : relevanciaGratis
  const preco = completo
    ? (a: Entrada, b: Entrada) => a.lar.mensalidadeMin - b.lar.mensalidadeMin
    : (a: Entrada, b: Entrada) => indiceFaixa(a.lar.mensalidadeMin) - indiceFaixa(b.lar.mensalidadeMin)
  switch (ordem) {
    case 'distancia':
      return arr.sort((a, b) => (a.distanciaKm ?? 0) - (b.distanciaKm ?? 0) || relevancia(a, b))
    case 'preco':
      return arr.sort((a, b) => preco(a, b) || relevancia(a, b))
    case 'disponibilidade':
      if (!completo) return arr.sort(relevancia)
      return arr.sort((a, b) => espera(a) - espera(b) || b.lar.avaliacao - a.lar.avaliacao)
    case 'avaliacao':
      return arr.sort((a, b) => b.lar.avaliacao - a.lar.avaliacao || b.lar.numAvaliacoes - a.lar.numAvaliacoes)
    default:
      return arr.sort(relevancia)
  }
}

// ————————————————————————————————————————— divisão da lista

export interface Grupo {
  id: 'agora' | 'resto'
  titulo: string
  itens: Entrada[]
  /** total do grupo em todos os resultados (a lista pode estar paginada) */
  total: number
}

/**
 * "Com vaga agora" / "Sem vaga hoje" — só na ordem por relevância (vagas primeiro) e se houver dos dois.
 * `visiveis` é a parte paginada; `todos` dá os totais.
 */
export function dividir(visiveis: Entrada[], todos: Entrada[], ordem: Ordem): Grupo[] | null {
  if (ordem !== 'relevancia') return null
  const nAgora = todos.filter(comVagaAgora).length
  if (nAgora === 0 || nAgora === todos.length) return null
  const agora = visiveis.filter(comVagaAgora)
  const resto = visiveis.filter((e) => !comVagaAgora(e))
  const grupos: Grupo[] = [{ id: 'agora', titulo: 'Com vaga agora', itens: agora, total: nAgora }]
  if (resto.length) grupos.push({ id: 'resto', titulo: 'Sem vaga hoje', itens: resto, total: todos.length - nAgora })
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
 * Versão grátis (`completo = false`): o orçamento sobe de faixa em faixa (nunca a valores exatos).
 */
export function calcularAlivios(entradas: Entrada[], s: SearchState, completo = true): Alivio[] {
  const conta = (patch: Partial<SearchState>) => filtrar(entradas, { ...s, ...patch }, completo).length
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
  if (s.vaga) add('vaga', `Retirar «${VAGA_LABEL[s.vaga]}»`, { vaga: null })
  if (s.max != null && completo) {
    const degraus = [800, 1000, 1200, 1500, 1800, 2000, 2500, 3000, 4000].filter((v) => v > s.max!)
    const sobe = degraus.find((v) => conta({ max: v }) > 0)
    if (sobe) add('max', `Subir o orçamento até ${euro(sobe)}`, { max: sobe })
    else add('max-off', 'Retirar o limite de orçamento', { max: null })
  } else if (s.max != null) {
    const atual = faixaDoOrcamento(s.max)
    const sobe = FAIXAS_ORCAMENTO.find((f) => atual != null && f > atual && conta({ max: f }) > 0)
    if (sobe) add('max', `Subir o orçamento ${ROTULO_FAIXA[sobe].toLowerCase()}`, { max: sobe })
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
