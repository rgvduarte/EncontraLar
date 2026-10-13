/**
 * Pipeline da equipa de terreno (modo visita): em que ponto está cada instituição de um distrito.
 *
 * - Por visitar: nenhuma visita registada;
 * - A acompanhar: a última visita ficou em "interessado" ou "voltar mais tarde" — pela data do próximo contacto,
 *   os atrasados primeiro;
 * - Aderiram e Recusaram: pelo resultado da última visita, as mais recentes primeiro.
 *
 * Funções puras: sem store nem relógio (o "agora" entra sempre como argumento), para se poderem testar.
 */
import type { Distrito, Lar, ResultadoVisita, Visita } from '@/types'
import { dataLocal, rotuloMes } from '@/lib/format'
import { distanceKm, type LatLng } from '@/lib/geo'
import { niveisVerificacao } from '@/lib/negocio'

export type Segmento = 'por_visitar' | 'acompanhar' | 'aderiram' | 'recusaram'

export const SEGMENTOS: readonly Segmento[] = ['por_visitar', 'acompanhar', 'aderiram', 'recusaram']

export const SEGMENTO_LABEL: Record<Segmento, string> = {
  por_visitar: 'Por visitar',
  acompanhar: 'A acompanhar',
  aderiram: 'Aderiram',
  recusaram: 'Recusaram',
}

export const RESULTADO_LABEL: Record<ResultadoVisita, string> = {
  aderiu: 'Aderiu',
  interessado: 'Interessado',
  voltar: 'Voltar mais tarde',
  recusou: 'Recusou',
}

/** Região piloto: o seletor de distrito começa aqui. */
export const DISTRITO_PILOTO: Distrito = 'Porto'

/** Um distrito, ou todos. */
export type FiltroDistrito = Distrito | 'todos'

const DIA_MS = 86_400_000

// ————————————————————————————————————————— visitas por instituição

/** Visitas agrupadas por instituição, da mais recente para a mais antiga (no empate, a registada depois). */
export function visitasPorLar(visitas: readonly Visita[]): Map<string, Visita[]> {
  const comIndice = visitas.map((v, i) => ({ v, i, t: Date.parse(v.data) }))
  comIndice.sort((a, b) => b.t - a.t || b.i - a.i)
  const m = new Map<string, Visita[]>()
  for (const { v } of comIndice) {
    const lista = m.get(v.larId)
    if (lista) lista.push(v)
    else m.set(v.larId, [v])
  }
  return m
}

/** Segmento de uma instituição, pelo resultado da última visita. */
export function segmentoDe(ultima: Pick<Visita, 'resultado'> | undefined): Segmento {
  if (!ultima) return 'por_visitar'
  if (ultima.resultado === 'aderiu') return 'aderiram'
  if (ultima.resultado === 'recusou') return 'recusaram'
  return 'acompanhar'
}

// ————————————————————————————————————————— próximo contacto

/** Contactos combinados para os próximos N dias contam como "a fazer" (com os que já estão em atraso). */
export const JANELA_CONTACTO_DIAS = 7

export type TipoContacto = 'atrasado' | 'hoje' | 'breve' | 'depois' | 'sem_data'

export interface EstadoContacto {
  tipo: TipoContacto
  /** dias até ao contacto (negativo: em atraso); null sem data */
  dias: number | null
}

const meiaNoite = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

/** Dias de calendário de hoje até "AAAA-MM-DD" (negativo se já passou); null se a data não for válida. */
export function diasAte(ymd: string | undefined, agora: Date): number | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  const d = dataLocal(ymd)
  if (Number.isNaN(d.getTime())) return null
  // arredondar: a mudança da hora (23 ou 25 horas num dia) não muda a contagem
  return Math.round((d.getTime() - meiaNoite(agora).getTime()) / DIA_MS)
}

export function estadoContacto(proximo: string | undefined, agora: Date): EstadoContacto {
  const dias = diasAte(proximo, agora)
  if (dias == null) return { tipo: 'sem_data', dias: null }
  if (dias < 0) return { tipo: 'atrasado', dias }
  if (dias === 0) return { tipo: 'hoje', dias }
  if (dias <= JANELA_CONTACTO_DIAS) return { tipo: 'breve', dias }
  return { tipo: 'depois', dias }
}

/** Em atraso, para hoje ou nos próximos 7 dias. */
export const contactoAFazer = (c: EstadoContacto | undefined): boolean => !!c && (c.tipo === 'atrasado' || c.tipo === 'hoje' || c.tipo === 'breve')

/** Pede atenção já: em atraso ou para hoje (o número da barra de abas e da barra lateral). */
export const contactoUrgente = (c: EstadoContacto | undefined): boolean => !!c && (c.tipo === 'atrasado' || c.tipo === 'hoje')

/** "Em atraso há 2 dias", "Contactar hoje", "Contactar amanhã", "Contactar sex., 23 out.", "Sem data marcada". */
export function contactoTexto(c: EstadoContacto, proximo: string | undefined, agora: Date): string {
  if (c.tipo === 'sem_data' || c.dias == null || !proximo) return 'Sem data marcada'
  if (c.tipo === 'atrasado') return c.dias === -1 ? 'Em atraso desde ontem' : `Em atraso há ${-c.dias} dias`
  if (c.tipo === 'hoje') return 'Contactar hoje'
  if (c.dias === 1) return 'Contactar amanhã'
  return `Contactar ${diaCurto(proximo, agora, true)}`
}

/** Abreviaturas fixas (o Intl muda de motor para motor: "sexta", "sex."). */
const DIAS_SEMANA = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'] as const

/** "7 out." (com o ano quando não é o atual: "7 out. 2025"); com `semana`, "sex., 23 out.". */
export function diaCurto(dataOuYmd: string, agora: Date, semana = false): string {
  const d = /^\d{4}-\d{2}-\d{2}$/.test(dataOuYmd) ? dataLocal(dataOuYmd) : new Date(dataOuYmd)
  const base = `${d.getDate()} ${rotuloMes(d.getMonth(), d.getFullYear() !== agora.getFullYear() ? d.getFullYear() : undefined)}`
  return semana ? `${DIAS_SEMANA[d.getDay()]}, ${base}` : base
}

// ————————————————————————————————————————— linhas do pipeline

export interface LinhaPipeline {
  lar: Lar
  /** visitas a esta instituição, da mais recente para a mais antiga */
  visitas: Visita[]
  ultima?: Visita
  segmento: Segmento
  /** só "a acompanhar": quando é o próximo contacto */
  contacto?: EstadoContacto
  /** só quando se ordena por distância */
  distanciaKm?: number
}

/** Uma linha por instituição do distrito (ou de todos), com a última visita e o segmento. */
export function linhasDoDistrito(lares: readonly Lar[], visitas: readonly Visita[], distrito: FiltroDistrito, agora: Date): LinhaPipeline[] {
  const porLar = visitasPorLar(visitas)
  return lares
    .filter((l) => distrito === 'todos' || l.distrito === distrito)
    .map((lar) => {
      const vs = porLar.get(lar.id) ?? []
      const ultima = vs[0]
      const segmento = segmentoDe(ultima)
      return { lar, visitas: vs, ultima, segmento, contacto: segmento === 'acompanhar' ? estadoContacto(ultima?.proximoContacto, agora) : undefined }
    })
}

/** Sem acentos, sem maiúsculas e com os espaços normalizados: "sao joao" encontra "São João". */
export const normalizar = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()

/** Procura pelo nome ou pela localidade (e concelho); cada palavra tem de aparecer. */
export function correspondePesquisa(lar: Pick<Lar, 'nome' | 'localidade' | 'concelho'>, q: string): boolean {
  const termos = normalizar(q).split(' ').filter(Boolean)
  if (!termos.length) return true
  const alvo = normalizar(`${lar.nome} ${lar.localidade} ${lar.concelho}`)
  return termos.every((t) => alvo.includes(t))
}

export const pesquisar = (linhas: readonly LinhaPipeline[], q: string): LinhaPipeline[] => linhas.filter((l) => correspondePesquisa(l.lar, q))

const porNome = (a: LinhaPipeline, b: LinhaPipeline) => a.lar.nome.localeCompare(b.lar.nome, 'pt', { sensitivity: 'base' })

/** Por visitar: por ordem alfabética, ou da mais perto para a mais longe quando há uma origem (a localização). */
export function ordenarPorVisitar(linhas: readonly LinhaPipeline[], origem?: LatLng | null): LinhaPipeline[] {
  if (!origem) return [...linhas].sort(porNome)
  return linhas
    .map((l) => ({ ...l, distanciaKm: distanceKm(origem, l.lar) }))
    .sort((a, b) => a.distanciaKm - b.distanciaKm || porNome(a, b))
}

/** A acompanhar: pela data do próximo contacto (os atrasados vêm primeiro); sem data, no fim. */
export function ordenarAcompanhar(linhas: readonly LinhaPipeline[]): LinhaPipeline[] {
  const chave = (l: LinhaPipeline) => l.contacto?.dias ?? Number.POSITIVE_INFINITY
  return [...linhas].sort((a, b) => chave(a) - chave(b) || porNome(a, b))
}

/** Aderiram e Recusaram: a visita mais recente primeiro. */
export function ordenarRecentes(linhas: readonly LinhaPipeline[]): LinhaPipeline[] {
  const t = (l: LinhaPipeline) => (l.ultima ? Date.parse(l.ultima.data) : 0)
  return [...linhas].sort((a, b) => t(b) - t(a) || porNome(a, b))
}

/** As linhas pelos quatro segmentos, já ordenadas. */
export function separarSegmentos(linhas: readonly LinhaPipeline[], origem?: LatLng | null): Record<Segmento, LinhaPipeline[]> {
  const de = (s: Segmento) => linhas.filter((l) => l.segmento === s)
  return {
    por_visitar: ordenarPorVisitar(de('por_visitar'), origem),
    acompanhar: ordenarAcompanhar(de('acompanhar')),
    aderiram: ordenarRecentes(de('aderiram')),
    recusaram: ordenarRecentes(de('recusaram')),
  }
}

// ————————————————————————————————————————— números do mês

export interface ResumoMes {
  /** visitas registadas este mês */
  visitas: number
  /** instituições que passaram a aderentes este mês (renovar a verificação de quem já tinha aderido não conta) */
  adesoes: number
  /** adesões ÷ visitas do mês; null sem visitas */
  taxaAdesao: number | null
  /** a acompanhar com o contacto em atraso, para hoje ou nos próximos 7 dias */
  contactos: number
  /** destes, em atraso */
  atrasados: number
}

export const mesmoMes = (iso: string, agora: Date) => {
  const d = new Date(iso)
  return d.getFullYear() === agora.getFullYear() && d.getMonth() === agora.getMonth()
}

/** Números do mês corrente para as linhas dadas (normalmente, as de um distrito). */
export function resumoDoMes(linhas: readonly LinhaPipeline[], agora: Date): ResumoMes {
  let visitas = 0
  let adesoes = 0
  for (const l of linhas) {
    // da mais recente para a mais antiga: a "anterior" de cada visita é a seguinte na lista
    l.visitas.forEach((v, i) => {
      if (!mesmoMes(v.data, agora)) return
      visitas++
      if (v.resultado === 'aderiu' && l.visitas[i + 1]?.resultado !== 'aderiu') adesoes++
    })
  }
  const aFazer = linhas.filter((l) => l.segmento === 'acompanhar' && contactoAFazer(l.contacto))
  return {
    visitas,
    adesoes,
    taxaAdesao: visitas ? adesoes / visitas : null,
    contactos: aFazer.length,
    atrasados: aFazer.filter((l) => l.contacto?.tipo === 'atrasado').length,
  }
}

/** Contactos em atraso ou para hoje, em todos os distritos (o número da barra de abas). */
export function contactosUrgentes(lares: readonly Lar[], visitas: readonly Visita[], agora: Date): number {
  if (!visitas.length) return 0
  return linhasDoDistrito(lares, visitas, 'todos', agora).filter((l) => l.segmento === 'acompanhar' && contactoUrgente(l.contacto)).length
}

// ————————————————————————————————————————— verificação

export type NivelVerificacao = 'visitada' | 'licenca' | 'nenhum'

/** O nível mais alto que a instituição já tem: visitada pela equipa, só a licença, ou nenhum. */
export function nivelVerificacao(lar: Pick<Lar, 'verificacao' | 'reviews'>): NivelVerificacao {
  const n = niveisVerificacao(lar)
  return n.visitado ? 'visitada' : n.licenca ? 'licenca' : 'nenhum'
}

export const NIVEL_LABEL: Record<NivelVerificacao, string> = {
  visitada: 'Visitada pela equipa',
  licenca: 'Licença confirmada',
  nenhum: 'Por verificar',
}
