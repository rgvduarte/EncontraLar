/**
 * Cálculos do painel da instituição — funções puras, sem React.
 * Tudo o que aparece no painel é derivado do store (nada de números inventados).
 */
import type { Candidatura, DB, EstadoCandidatura, Lar, PerfilIdoso, TipoQuarto } from '@/types'
import { ocupados, taxaOcupacao, vagasLivres } from '@/lib/forecast'
import { precoReferencia } from '@/lib/matching'
import { CUIDADO_LABEL, CUIDADOS_CRITICOS, GRAU_LABEL, QUARTO_CURTO } from '@/lib/labels'
import { euro } from '@/lib/format'

export const HORA_MS = 3_600_000
export const DIA_MS = 24 * HORA_MS

// ————————————————————————————————————————— estados

/** Estados em que o pedido ainda está "vivo" para a instituição. */
export const ESTADOS_ATIVOS: EstadoCandidatura[] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta']

export const naLista = (c: Candidatura) => c.estado === 'lista_espera' || c.estado === 'vaga_proposta'

export const visitaPorConfirmar = (c: Candidatura) => c.visita?.estado === 'pedida' && ESTADOS_ATIVOS.includes(c.estado)

export type FiltroPedidos = 'novos' | 'analise' | 'lista' | 'proposta' | 'concluidos'

export const FILTROS: { id: FiltroPedidos; label: string; estados: EstadoCandidatura[]; vazio: string }[] = [
  { id: 'novos', label: 'Novos', estados: ['enviada'], vazio: 'Não há pedidos novos. Quando uma família pedir vaga, o pedido aparece aqui com o perfil já preenchido.' },
  { id: 'analise', label: 'Em análise', estados: ['em_analise'], vazio: 'Nenhum pedido em análise. Os pedidos novos que abrir com «Analisar» passam para aqui.' },
  { id: 'lista', label: 'Lista de espera', estados: ['lista_espera'], vazio: 'Ainda não inscreveu ninguém da plataforma na lista de espera.' },
  { id: 'proposta', label: 'Vaga proposta', estados: ['vaga_proposta'], vazio: 'Não há propostas à espera de resposta. Quando propuser uma vaga, a família tem 48 horas para responder.' },
  { id: 'concluidos', label: 'Concluídos', estados: ['aceite', 'recusada', 'cancelada'], vazio: 'Ainda não há pedidos concluídos.' },
]

export const filtroDoEstado = (e: EstadoCandidatura): FiltroPedidos =>
  FILTROS.find((f) => f.estados.includes(e))?.id ?? 'novos'

// ————————————————————————————————————————— frescura das vagas

export type Frescura = 'fresca' | 'normal' | 'desatualizada'

export const diasDesde = (iso: string, agora = Date.now()) => Math.max(0, (agora - new Date(iso).getTime()) / DIA_MS)

export function frescura(iso: string, agora = Date.now()): Frescura {
  const d = diasDesde(iso, agora)
  return d <= 2 ? 'fresca' : d <= 7 ? 'normal' : 'desatualizada'
}

// ————————————————————————————————————————— números do resumo

export function precoMinDoTipo(lar: Lar, tipo: TipoQuarto): number {
  return lar.quartos.find((q) => q.tipo === tipo)?.precoMin ?? lar.mensalidadeMin
}

/** Mensalidades que deixam de entrar por cada mês com os lugares livres atuais vazios. */
export const receitaEmRisco = (lar: Lar) => lar.quartos.reduce((s, q) => s + q.livres * q.precoMin, 0)

export interface NumerosResumo {
  capacidade: number
  ocupados: number
  ocupacao: number
  livres: number
  novos: number
  visitas: number
  propostas: number
  listaTotal: number
  listaOnline: number
  listaOffline: number
  visualizacoes: number
  receita: number
}

export function numerosResumo(lar: Lar, cands: Candidatura[]): NumerosResumo {
  const listaOnline = cands.filter(naLista).length
  const listaTotal = Math.max(lar.listaEspera, listaOnline)
  return {
    capacidade: lar.capacidade,
    ocupados: ocupados(lar),
    ocupacao: taxaOcupacao(lar),
    livres: vagasLivres(lar),
    novos: cands.filter((c) => c.estado === 'enviada').length,
    visitas: cands.filter(visitaPorConfirmar).length,
    propostas: cands.filter((c) => c.estado === 'vaga_proposta').length,
    listaTotal,
    listaOnline,
    listaOffline: Math.max(0, listaTotal - listaOnline),
    visualizacoes: lar.visualizacoes30d,
    receita: receitaEmRisco(lar),
  }
}

/** O que precisa da atenção de quem gere a casa — usado no título do resumo e na agenda. */
export interface Assuntos {
  novos: Candidatura[]
  visitas: Candidatura[]
  propostas: Candidatura[]
  /** há lugares livres sem proposta e famílias da plataforma na lista */
  vagaPorPreencher: boolean
  desatualizada: boolean
  total: number
}

export function assuntosPendentes(lar: Lar, cands: Candidatura[], agora = Date.now()): Assuntos {
  const novos = cands
    .filter((c) => c.estado === 'enviada')
    .sort((a, b) => Number(b.perfil.urgencia === 'imediata') - Number(a.perfil.urgencia === 'imediata') || b.criadaEm.localeCompare(a.criadaEm))
  const visitas = cands
    .filter(visitaPorConfirmar)
    .sort((a, b) => dataLocal(a.visita!.data, a.visita!.hora).getTime() - dataLocal(b.visita!.data, b.visita!.hora).getTime())
  const propostas = cands.filter((c) => c.estado === 'vaga_proposta')
  const vagaPorPreencher = vagasLivres(lar) > propostas.length && cands.some((c) => c.estado === 'lista_espera')
  const desatualizada = frescura(lar.atualizadoEm, agora) === 'desatualizada'
  return {
    novos,
    visitas,
    propostas,
    vagaPorPreencher,
    desatualizada,
    total: novos.length + visitas.length + propostas.length + Number(vagaPorPreencher) + Number(desatualizada),
  }
}

/** Quem seria avisado se abrisse agora uma vaga (espelha a regra do store). */
export function destinatariosAviso(db: DB, lar: Lar): { lista: number; seguidores: number; total: number } {
  const lista = new Set(db.candidaturas.filter((c) => c.larId === lar.id && c.estado === 'lista_espera').map((c) => c.userId))
  const seguidores = new Set(
    db.favoritos.filter((f) => f.larId === lar.id && f.alerta && f.userId !== lar.ownerId && !lista.has(f.userId)).map((f) => f.userId),
  )
  return { lista: lista.size, seguidores: seguidores.size, total: lista.size + seguidores.size }
}

// ————————————————————————————————————————— datas e prazos

/** "2026-10-16" → Date local (evita o desvio de fuso de new Date('YYYY-MM-DD')). */
export function dataLocal(ymd: string, hora = '00:00'): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const [h, min] = hora.split(':').map(Number)
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, h ?? 0, min ?? 0)
}

/** "sexta-feira, 16 de outubro, às 15:00" */
export function textoVisita(v: { data: string; hora: string }): string {
  const d = dataLocal(v.data, v.hora)
  return `${d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}, às ${v.hora}`
}

/** "sex., 16 out." — para colunas estreitas */
export function textoVisitaCurto(v: { data: string; hora: string }): { dia: string; hora: string } {
  const d = dataLocal(v.data, v.hora)
  return { dia: d.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' }), hora: v.hora }
}

export function prazo(iso: string | undefined, agora = Date.now()): { expirado: boolean; texto: string; horas: number } | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - agora
  const horas = ms / HORA_MS
  const abs = Math.abs(ms)
  const unidade =
    abs < HORA_MS
      ? `${Math.max(1, Math.round(abs / 60000))} min`
      : abs < 2 * DIA_MS
        ? `${Math.round(abs / HORA_MS)} ${Math.round(abs / HORA_MS) === 1 ? 'hora' : 'horas'}`
        : `${Math.round(abs / DIA_MS)} dias`
  return ms >= 0 ? { expirado: false, texto: `faltam ${unidade}`, horas } : { expirado: true, texto: `terminou há ${unidade}`, horas }
}

/** "segunda-feira, 12 de outubro, às 14:32" */
export function dataHoraLonga(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}, às ${d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}`
}

export function saudacao(d = new Date()): string {
  const h = d.getHours()
  return h < 6 ? 'Boa noite' : h < 13 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite'
}

const EXTENSO_M = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez']
const EXTENSO_F = ['zero', 'uma', 'duas', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez']
/** 2 → "dois" (até dez; depois algarismos). */
export const extenso = (n: number, feminino = false) => (n >= 0 && n <= 10 ? (feminino ? EXTENSO_F : EXTENSO_M)[n]! : String(n))

// ————————————————————————————————————————— compatibilidade de um pedido com esta instituição

export type EstadoCheck = 'ok' | 'falta'
export interface CompatCheck {
  id: 'grau' | 'cuidados' | 'quarto' | 'orcamento' | 'acordo'
  estado: EstadoCheck
  titulo: string
  texto: string
}

const grauTexto = (g: PerfilIdoso['grau']) => (g === 'autonomo' ? 'pessoas autónomas' : GRAU_LABEL[g].toLowerCase())
const listaHumana = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

export function verificarCompatibilidade(lar: Lar, perfil: PerfilIdoso): CompatCheck[] {
  const out: CompatCheck[] = []

  out.push(
    lar.graus.includes(perfil.grau)
      ? { id: 'grau', estado: 'ok', titulo: 'Grau de dependência', texto: `Admite ${grauTexto(perfil.grau)}` }
      : { id: 'grau', estado: 'falta', titulo: 'Grau de dependência', texto: `A ficha não indica que admite ${grauTexto(perfil.grau)}` },
  )

  const criticos = perfil.necessidades.filter((n) => CUIDADOS_CRITICOS.includes(n))
  const faltam = criticos.filter((n) => !lar.cuidados.includes(n))
  out.push(
    criticos.length === 0
      ? { id: 'cuidados', estado: 'ok', titulo: 'Cuidados essenciais', texto: 'Não indicou cuidados críticos' }
      : faltam.length
        ? { id: 'cuidados', estado: 'falta', titulo: 'Cuidados essenciais', texto: `Não assegura ${listaHumana(faltam.map((n) => CUIDADO_LABEL[n].toLowerCase()))}` }
        : { id: 'cuidados', estado: 'ok', titulo: 'Cuidados essenciais', texto: `Assegura ${listaHumana(criticos.map((n) => CUIDADO_LABEL[n].toLowerCase()))}` },
  )

  if (perfil.quarto === 'indiferente') {
    out.push({ id: 'quarto', estado: 'ok', titulo: 'Quarto', texto: 'Aceita qualquer tipo de quarto' })
  } else {
    const q = lar.quartos.find((r) => r.tipo === perfil.quarto)
    const nome = QUARTO_CURTO[perfil.quarto].toLowerCase()
    out.push(
      q
        ? { id: 'quarto', estado: 'ok', titulo: 'Quarto', texto: `Pede quarto ${nome} — tem ${q.total} (${q.livres === 1 ? '1 livre' : `${q.livres} livres`})` }
        : { id: 'quarto', estado: 'falta', titulo: 'Quarto', texto: `Pede quarto ${nome}, que não tem` },
    )
  }

  const preco = precoReferencia(lar, perfil.quarto)
  const tipoTxt = perfil.quarto === 'indiferente' ? 'o quarto mais económico' : `o quarto ${QUARTO_CURTO[perfil.quarto].toLowerCase()}`
  out.push(
    perfil.orcamentoMax >= preco
      ? { id: 'orcamento', estado: 'ok', titulo: 'Orçamento', texto: `Até ${euro(perfil.orcamentoMax)} — ${tipoTxt} começa em ${euro(preco)}` }
      : { id: 'orcamento', estado: 'falta', titulo: 'Orçamento', texto: `Até ${euro(perfil.orcamentoMax)}, abaixo dos ${euro(preco)} d${tipoTxt}` },
  )

  if (perfil.precisaAcordoSS) {
    out.push(
      lar.acordoSS
        ? { id: 'acordo', estado: 'ok', titulo: 'Segurança Social', texto: 'Precisa de comparticipação — tem acordo de cooperação' }
        : { id: 'acordo', estado: 'falta', titulo: 'Segurança Social', texto: 'Precisa de vaga com acordo da Segurança Social, que não tem' },
    )
  }
  return out
}

// ————————————————————————————————————————— lista de espera (com posições feitas fora da plataforma)

export type LinhaLista =
  | { tipo: 'online'; posicao: number; c: Candidatura }
  | { tipo: 'offline'; de: number; ate: number }

export function linhasListaEspera(lar: Lar, cands: Candidatura[]): LinhaLista[] {
  const online = cands.filter((c) => naLista(c) && c.posicao != null).sort((a, b) => a.posicao! - b.posicao!)
  const porPosicao = new Map(online.map((c) => [c.posicao!, c]))
  const total = Math.max(lar.listaEspera, online.at(-1)?.posicao ?? 0)
  const linhas: LinhaLista[] = []
  let inicioGap: number | null = null
  for (let p = 1; p <= total; p++) {
    const c = porPosicao.get(p)
    if (c) {
      if (inicioGap != null) linhas.push({ tipo: 'offline', de: inicioGap, ate: p - 1 })
      inicioGap = null
      linhas.push({ tipo: 'online', posicao: p, c })
    } else if (inicioGap == null) {
      inicioGap = p
    }
  }
  if (inicioGap != null) linhas.push({ tipo: 'offline', de: inicioGap, ate: total })
  return linhas
}

/** Tipo de quarto a propor: o pretendido se tiver lugar livre; senão, qualquer um livre. */
export function quartoParaPropor(lar: Lar, perfil: PerfilIdoso): { tipo: TipoQuarto; preferido: boolean } | null {
  if (perfil.quarto !== 'indiferente') {
    const q = lar.quartos.find((r) => r.tipo === perfil.quarto && r.livres > 0)
    if (q) return { tipo: q.tipo, preferido: true }
  }
  const outro = lar.quartos.find((r) => r.livres > 0)
  return outro ? { tipo: outro.tipo, preferido: perfil.quarto === 'indiferente' } : null
}
