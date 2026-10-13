/**
 * Cálculos do painel da instituição — funções puras, sem React.
 * Tudo o que aparece no painel é derivado do store (nada de números inventados).
 */
import type { Candidatura, DB, EstadoCandidatura, Lar, PerfilIdoso, PlanoInstituicao, TaxaEntrada, TipoQuarto, User } from '@/types'
import { FATOR_LISTA_EFETIVA, ocupados, poissonQuantile, previsaoMensal, taxaOcupacao, taxaSaidasMensal, vagasLivres } from '@/lib/forecast'
import { precoReferencia } from '@/lib/matching'
import { CUIDADO_FRASE, CUIDADOS_CRITICOS, GRAU_PESSOAS } from '@/lib/labels'
import { dataLocal, euro } from '@/lib/format'
import { entradaAtribuida, prioridadePedido, taxaPara } from '@/lib/negocio'
import { cobrancaEntradaTexto, compromissoAte, PLANOS_INSTITUICAO, planoDoLar, podeMudarPlano, precoTexto } from '@/lib/acesso'

// "2026-10-16" → Date local (sem o desvio de fuso de new Date('YYYY-MM-DD')); a versão comum vive em lib/format
export { dataLocal }

export const HORA_MS = 3_600_000
export const DIA_MS = 24 * HORA_MS

// ————————————————————————————————————————— estados

/** Estados em que o pedido ainda está "vivo" para a instituição. */
export const ESTADOS_ATIVOS: EstadoCandidatura[] = ['enviada', 'em_analise', 'lista_espera', 'vaga_proposta']

export const naLista = (c: Candidatura) => c.estado === 'lista_espera' || c.estado === 'vaga_proposta'

export const visitaPorConfirmar = (c: Candidatura) => c.visita?.estado === 'pedida' && ESTADOS_ATIVOS.includes(c.estado)

/**
 * Pedidos à espera de quem gere a casa: novos (estado "enviada") ou com uma visita por confirmar.
 * Um pedido novo que também pede visita conta uma só vez. É o número da barra lateral e da barra de abas.
 */
export const pedidosPorTratar = (cands: Candidatura[]): number => cands.filter((c) => c.estado === 'enviada' || visitaPorConfirmar(c)).length

export type FiltroPedidos = 'novos' | 'analise' | 'lista' | 'proposta' | 'concluidos'

export const FILTROS: { id: FiltroPedidos; label: string; estados: EstadoCandidatura[]; vazio: string }[] = [
  {
    id: 'novos',
    label: 'Novos',
    estados: ['enviada'],
    vazio: 'Não há pedidos novos. Quando uma família ou um serviço social pedir vaga, o pedido aparece aqui com o resumo do perfil.',
  },
  { id: 'analise', label: 'Em análise', estados: ['em_analise'], vazio: 'Nenhum pedido em análise. Os pedidos novos que aceitar passam para aqui.' },
  { id: 'lista', label: 'Lista de espera', estados: ['lista_espera'], vazio: 'Ainda não inscreveu ninguém da plataforma na lista de espera.' },
  { id: 'proposta', label: 'Vaga proposta', estados: ['vaga_proposta'], vazio: 'Não há propostas à espera de resposta. Quando propuser uma vaga, a família tem 48 horas para responder.' },
  { id: 'concluidos', label: 'Concluídos', estados: ['aceite', 'admitida', 'recusada', 'cancelada'], vazio: 'Ainda não há pedidos concluídos.' },
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
  /** vagas aceites à espera da entrada: falta combinar o dia ou marcar a entrada */
  entradas: Candidatura[]
  /** há lugares livres sem proposta e famílias da plataforma na lista */
  vagaPorPreencher: boolean
  desatualizada: boolean
  total: number
}

/**
 * Pedidos novos pela ordem de tratar: encaminhamentos com alta nos próximos 7 dias, depois os urgentes,
 * depois os restantes; dentro de cada grupo, os mais recentes primeiro.
 */
export function ordenarNovos(cands: Candidatura[], agora = Date.now()): Candidatura[] {
  return [...cands].sort((a, b) => prioridadePedido(a, agora) - prioridadePedido(b, agora) || b.criadaEm.localeCompare(a.criadaEm))
}

/** Quanto tempo uma vaga aceite fica em "Precisa da sua atenção" (para combinar a entrada). */
export const ENTRADA_RECENTE_MS = 2 * DIA_MS

/** A família aceitou a vaga proposta há pouco (o passo anterior era "vaga proposta"). */
export function vagaAceiteHaPouco(c: Candidatura, agora = Date.now()): boolean {
  if (c.estado !== 'aceite') return false
  const desde = agora - new Date(c.atualizadaEm).getTime()
  if (!(desde >= 0 && desde <= ENTRADA_RECENTE_MS)) return false
  return c.historico.at(-2)?.estado === 'vaga_proposta'
}

export function assuntosPendentes(lar: Lar, cands: Candidatura[], agora = Date.now()): Assuntos {
  const novos = ordenarNovos(
    cands.filter((c) => c.estado === 'enviada'),
    agora,
  )
  const visitas = cands
    .filter(visitaPorConfirmar)
    .sort((a, b) => dataLocal(a.visita!.data, a.visita!.hora).getTime() - dataLocal(b.visita!.data, b.visita!.hora).getTime())
  const propostas = cands.filter((c) => c.estado === 'vaga_proposta')
  // todas as vagas aceites: até a pessoa entrar e a entrada ser marcada, é um assunto em aberto
  const entradas = cands.filter((c) => c.estado === 'aceite').sort((a, b) => b.atualizadaEm.localeCompare(a.atualizadaEm))
  const vagaPorPreencher = vagasLivres(lar) > propostas.length && cands.some((c) => c.estado === 'lista_espera')
  const desatualizada = frescura(lar.atualizadoEm, agora) === 'desatualizada'
  return {
    novos,
    visitas,
    propostas,
    entradas,
    vagaPorPreencher,
    desatualizada,
    total: novos.length + visitas.length + propostas.length + entradas.length + Number(vagaPorPreencher) + Number(desatualizada),
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

/** "sexta-feira, 16 de outubro, às 15:00" */
export function textoVisita(v: { data: string; hora: string }): string {
  const d = dataLocal(v.data, v.hora)
  return `${d.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })}, às ${v.hora}`
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

const NOME_QUARTO: Record<TipoQuarto, string> = { individual: 'quarto individual', duplo: 'quarto duplo', casal: 'quarto de casal' }
/** "quarto de casal" — nome do tipo de quarto para meio de frase. */
export const nomeQuarto = (t: TipoQuarto) => NOME_QUARTO[t]

/** Só a primeira letra em minúscula — mantém nomes próprios ("demência e Alzheimer"). */
export const minuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

/** "pessoas com dependência grave" — o grau como complemento de "admite …". */
const grauTexto = (g: PerfilIdoso['grau']) => GRAU_PESSOAS[g]
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
        ? { id: 'cuidados', estado: 'falta', titulo: 'Cuidados essenciais', texto: `Não assegura ${listaHumana(faltam.map((n) => CUIDADO_FRASE[n]))}` }
        : { id: 'cuidados', estado: 'ok', titulo: 'Cuidados essenciais', texto: `Assegura ${listaHumana(criticos.map((n) => CUIDADO_FRASE[n]))}` },
  )

  if (perfil.quarto === 'indiferente') {
    out.push({ id: 'quarto', estado: 'ok', titulo: 'Quarto', texto: 'Aceita qualquer tipo de quarto' })
  } else {
    const q = lar.quartos.find((r) => r.tipo === perfil.quarto)
    const nome = nomeQuarto(perfil.quarto)
    out.push(
      q
        ? { id: 'quarto', estado: 'ok', titulo: 'Quarto', texto: `Pede ${nome} — tem ${q.total} (${q.livres === 1 ? '1 livre' : `${q.livres} livres`})` }
        : { id: 'quarto', estado: 'falta', titulo: 'Quarto', texto: `Pede ${nome}, que não tem` },
    )
  }

  const preco = precoReferencia(lar, perfil.quarto)
  const tipoTxt = perfil.quarto === 'indiferente' ? 'o quarto mais económico' : `o ${nomeQuarto(perfil.quarto)}`
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

// ————————————————————————————————————————— previsão (resumo para quem gere a casa)

export interface InsightsPrevisao {
  /** lugares que deverão libertar-se nos próximos 3 e 6 meses (inclui o mês atual) */
  e3: number
  e6: number
  /** intervalo de 80% */
  min3: number
  max3: number
  min6: number
  max6: number
  /** saídas esperadas por mês (média anual) */
  taxaMensal: number
  /** quantas famílias da lista convém contactar já para não deixar quartos vazios */
  contactar: number
}

export function insightsPrevisao(lar: Lar, listaTotal: number, inicio = new Date()): InsightsPrevisao {
  const meses = previsaoMensal(lar, 6, inicio)
  const soma = (k: number) => meses.slice(0, k).reduce((s, m) => s + m.esperado, 0)
  const e3 = soma(3)
  const e6 = soma(6)
  // só uma parte da lista ainda aceita a vaga quando é contactada (modelo da previsão)
  const aPreencher = vagasLivres(lar) + e3
  const contactar = Math.min(listaTotal, Math.ceil(aPreencher / FATOR_LISTA_EFETIVA))
  return {
    e3,
    e6,
    min3: poissonQuantile(0.1, e3),
    max3: poissonQuantile(0.9, e3),
    min6: poissonQuantile(0.1, e6),
    max6: poissonQuantile(0.9, e6),
    taxaMensal: taxaSaidasMensal(lar),
    contactar,
  }
}

// ————————————————————————————————————————— primeiros passos (instituições acabadas de registar)

export interface PassoArranque {
  id: 'ficha' | 'vagas' | 'precos'
  titulo: string
  texto: string
  to: string
  cta: string
  feito: boolean
}

export function passosArranque(lar: Lar, user: User | null): PassoArranque[] {
  const vagasIndicadas =
    lar.quartos.some((q) => q.livres > 0) || !user || new Date(lar.atualizadoEm).getTime() - new Date(user.criadoEm).getTime() > 5_000
  return [
    {
      id: 'ficha',
      titulo: 'Complete a ficha',
      texto: 'Uma frase de apresentação, a descrição da casa e os cuidados que assegura.',
      to: '/gestao/ficha',
      cta: 'Completar',
      feito: Boolean(lar.resumo.trim() && lar.descricao.trim() && lar.cuidados.length > 0),
    },
    {
      id: 'vagas',
      titulo: 'Indique os lugares livres',
      texto: 'Mesmo que hoje sejam zero: diz às famílias que a informação é verdadeira.',
      to: '/gestao/vagas',
      cta: 'Indicar',
      feito: vagasIndicadas,
    },
    {
      id: 'precos',
      titulo: 'Reveja os preços por quarto',
      texto: 'Mensalidade mínima e máxima. As famílias filtram pelo orçamento.',
      to: '/gestao/vagas',
      cta: 'Rever',
      feito: lar.quartos.length > 0 && lar.quartos.every((q) => q.precoMin > 0 && q.precoMax >= q.precoMin),
    },
  ]
}

// ————————————————————————————————————————— entradas (base da taxa por entrada; docs/MODELO-NEGOCIO.md)

/** Pedidos com entrada registada (pelo lar e/ou pela família), da mais recente para a mais antiga. */
export function entradasDoLar(cands: Candidatura[]): Candidatura[] {
  return cands.filter((c) => c.entrada).sort((a, b) => b.entrada!.data.localeCompare(a.entrada!.data))
}

/** Entradas com o dia nos últimos 12 meses. */
export function entradasUltimos12Meses(cands: Candidatura[], agora = Date.now()): Candidatura[] {
  const desde = new Date(agora)
  desde.setFullYear(desde.getFullYear() - 1)
  return entradasDoLar(cands).filter((c) => dataLocal(c.entrada!.data).getTime() >= desde.getTime())
}

/** Entradas com o dia no ano civil corrente. */
export function entradasEsteAno(cands: Candidatura[], agora = Date.now()): Candidatura[] {
  const ano = String(new Date(agora).getFullYear())
  return entradasDoLar(cands).filter((c) => c.entrada!.data.startsWith(ano))
}

// ————————————————————————————————————————— taxa de cada entrada (fixada quando a entrada fica registada)

/**
 * Linha da taxa de uma entrada. Fica fixada quando a entrada é registada (pela casa ou pela família) e não muda se a
 * instituição mudar depois de modalidade. Os textos são os da modalidade correspondente (`cobrancaEntradaTexto`):
 * o painel diz o mesmo na entrada, no pedido e na modalidade em vigor. Painel privado: os valores aparecem, com IVA.
 */
export const TAXA_TEXTO: Record<TaxaEntrada, string> = {
  aplicavel: cobrancaEntradaTexto({ natureza: 'privado', planoInstituicao: 'por_entrada' }),
  incluida: cobrancaEntradaTexto({ natureza: 'privado', planoInstituicao: 'mensal' }),
  isenta: cobrancaEntradaTexto({ natureza: 'ipss' }),
}

/** A pessoa entrou mais de 12 meses depois do pedido: a entrada não conta para a plataforma. */
export const TAXA_NAO_CONTA = 'Não conta: entrou mais de 12 meses depois do pedido'

/** Uma entrada já registada: a taxa com que ficou (mesmo que a modalidade tenha mudado depois), ou "não conta". */
export function taxaDaEntradaTexto(c: Pick<Candidatura, 'entrada' | 'criadaEm'>): string | null {
  if (!c.entrada) return null
  return entradaAtribuida(c) ? TAXA_TEXTO[c.entrada.taxa] : TAXA_NAO_CONTA
}

/**
 * Ao marcar a entrada no dia `dia` (AAAA-MM-DD): se a família já a registou, a taxa ficou fixada nessa altura;
 * senão, fica com a da modalidade em vigor hoje.
 */
export function taxaAoMarcarTexto(c: Pick<Candidatura, 'entrada' | 'criadaEm'>, lar: Pick<Lar, 'natureza' | 'planoInstituicao'>, dia: string): string {
  if (c.entrada) return taxaDaEntradaTexto(c)!
  const conta = entradaAtribuida({ criadaEm: c.criadaEm, entrada: { data: dia, taxa: taxaPara(lar) } })
  return conta ? cobrancaEntradaTexto(lar) : TAXA_NAO_CONTA
}

// ————————————————————————————————————————— modalidade (instituições privadas: por entrada ou mensalidade)

export interface EstadoModalidade {
  /** a modalidade em vigor */
  atual: PlanoInstituicao
  /** ISO — desde quando vigora (fichas antigas podem não ter a data) */
  desde: string | null
  /** ISO — fim do compromisso da mensalidade enquanto ainda não chegou; null quando pode mudar já */
  compromissoAte: string | null
  /** o que pode escolher agora (a modalidade em vigor conta como disponível) */
  disponivel: Record<PlanoInstituicao, boolean>
}

/**
 * O que o cartão "Modalidade" mostra. null para IPSS e Misericórdias: não pagam, não há nada a escolher.
 * Para a mensalidade muda-se sempre; de volta à taxa por entrada, só no fim do compromisso (a mesma regra do store).
 */
export function estadoModalidade(lar: Pick<Lar, 'natureza' | 'planoInstituicao' | 'planoDesde'>, agora = Date.now()): EstadoModalidade | null {
  const atual = planoDoLar(lar)
  if (!atual) return null
  const livre = podeMudarPlano(lar, agora)
  return {
    atual,
    desde: lar.planoDesde ?? null,
    compromissoAte: livre ? null : compromissoAte(lar),
    disponivel: { por_entrada: atual === 'por_entrada' || livre, mensal: true },
  }
}

/** ISO — até quando fica na mensalidade quem muda para ela agora (para o dizer antes de confirmar). */
export const compromissoSeMudarAgora = (agora = Date.now()): string =>
  compromissoAte({ natureza: 'privado', planoInstituicao: 'mensal', planoDesde: new Date(agora).toISOString() })!

const semCentimos = (s: string) => s.replace(',00', '')

/** "300 € + IVA" — montantes das instituições (painel privado), sempre com "+ IVA" (espaços inseparáveis: nunca parte). */
export const valorMaisIva = (centimos: number) => `${semCentimos(precoTexto(centimos))}\u00a0+\u00a0IVA`

/** "150 €" e "+ IVA por entrada": o valor da modalidade em duas partes (o número em destaque). Juntas, dão `valorPlanoTexto`. */
export function partesValorPlano(p: PlanoInstituicao): { valor: string; resto: string } {
  const info = PLANOS_INSTITUICAO[p]
  return { valor: semCentimos(precoTexto(info.valorCentimos)), resto: `+ IVA ${info.unidade}` }
}

/** "3 entradas" · "1 entrada" */
export const entradasTexto = (n: number) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`

/** A comparação usa o mesmo período da página Entradas: os últimos 12 meses (12 mensalidades). */
export const MESES_COMPARACAO = 12

export interface ComparacaoModalidades {
  /** entradas que contaram (atribuídas ao EncontraLar) nos últimos 12 meses */
  entradas: number
  /** o que pagaria por entrada nesses 12 meses (cêntimos, + IVA) */
  porEntradaCentimos: number
  /** 12 mensalidades (cêntimos, + IVA) */
  mensalCentimos: number
}

/**
 * Com as entradas reais dos últimos 12 meses (só as que contam), quanto pagaria em cada modalidade — calculado a
 * partir dos valores das modalidades, nunca escrito à mão. null sem entradas: fica só a regra geral.
 */
export function comparacaoModalidades(cands: Candidatura[], agora = Date.now()): ComparacaoModalidades | null {
  const entradas = entradasUltimos12Meses(cands, agora).filter(entradaAtribuida).length
  if (entradas < 1) return null
  return {
    entradas,
    porEntradaCentimos: entradas * PLANOS_INSTITUICAO.por_entrada.valorCentimos,
    mensalCentimos: MESES_COMPARACAO * PLANOS_INSTITUICAO.mensal.valorCentimos,
  }
}

/**
 * "Nos últimos 12 meses: 2 entradas" → "por entrada pagaria 300 € + IVA; com mensalidade, 348 € + IVA."
 * Em duas partes: a seta entre elas é só visual (o leitor de ecrã ouve uma vírgula).
 */
export function comparacaoPartes(c: ComparacaoModalidades): { periodo: string; valores: string } {
  return {
    periodo: `Nos últimos ${MESES_COMPARACAO} meses: ${entradasTexto(c.entradas)}`,
    valores: `por entrada pagaria ${valorMaisIva(c.porEntradaCentimos)}; com mensalidade, ${valorMaisIva(c.mensalCentimos)}.`,
  }
}
