/**
 * Previsão de vagas.
 *
 * Modelo: as saídas de residentes (regresso a casa, transferência ou falecimento) seguem
 * um processo de Poisson não-homogéneo, com taxa mensal estimada a partir de:
 *   1. histórico de saídas dos últimos 12 meses declarado pela instituição;
 *   2. taxa estrutural = residentes ÷ estadia média (lei de Little).
 * A taxa é modulada por um fator sazonal (há mais saídas no inverno).
 *
 * Para um candidato que precisa da k-ésima vaga, P(vaga até t) = P(N(t) ≥ k), com
 * N(t) ~ Poisson(Λ(t)). A lista de espera é descontada por um fator de "lista efetiva":
 * muitas famílias estão inscritas em várias instituições ou já encontraram solução.
 */
import type { Disponibilidade, Lar } from '@/types'

const SAZ_BRUTA = [1.22, 1.12, 1.04, 0.97, 0.93, 0.9, 0.92, 0.94, 0.93, 0.98, 1.05, 1.2]
const SAZ_MEDIA = SAZ_BRUTA.reduce((a, b) => a + b, 0) / 12
/** fator sazonal por mês (0 = janeiro), média 1 */
export const SAZONALIDADE = SAZ_BRUTA.map((v) => v / SAZ_MEDIA)

/** Fração da lista de espera que, em média, ainda aceita a vaga quando é contactada. */
export const FATOR_LISTA_EFETIVA = 0.4

const HORIZONTE_DIAS = 730

export const vagasLivres = (lar: Pick<Lar, 'quartos'>) => lar.quartos.reduce((s, q) => s + q.livres, 0)
export const ocupados = (lar: Pick<Lar, 'quartos' | 'capacidade'>) => Math.max(0, lar.capacidade - vagasLivres(lar))
export const taxaOcupacao = (lar: Pick<Lar, 'quartos' | 'capacidade'>) =>
  lar.capacidade > 0 ? ocupados(lar) / lar.capacidade : 0

/** Saídas esperadas por mês (média anual, sem sazonalidade). */
export function taxaSaidasMensal(lar: Pick<Lar, 'quartos' | 'capacidade' | 'estadiaMediaMeses' | 'historicoSaidas'>): number {
  const estrutural = ocupados(lar) / Math.max(6, lar.estadiaMediaMeses)
  const hist = lar.historicoSaidas
  if (!hist.length) return estrutural
  const media = hist.reduce((a, b) => a + b, 0) / hist.length
  return 0.5 * media + 0.5 * estrutural
}

/** P(N ≥ k) para N ~ Poisson(lambda). */
export function poissonAtLeast(k: number, lambda: number): number {
  if (k <= 0) return 1
  if (lambda <= 0) return 0
  let term = Math.exp(-lambda)
  let cdf = term
  for (let i = 1; i < k; i++) {
    term *= lambda / i
    cdf += term
  }
  return Math.min(1, Math.max(0, 1 - cdf))
}

/** menor x tal que P(N ≤ x) ≥ q */
export function poissonQuantile(q: number, lambda: number): number {
  if (lambda <= 0) return 0
  let term = Math.exp(-lambda)
  let cdf = term
  let x = 0
  while (cdf < q && x < 1000) {
    x++
    term *= lambda / x
    cdf += term
  }
  return x
}

const diasNoMes = (ano: number, mes: number) => new Date(ano, mes + 1, 0).getDate()

/** Λ acumulado dia a dia (índice d = intensidade acumulada até ao fim do dia d). */
function intensidadeAcumulada(taxaMensal: number, inicio: Date, dias = HORIZONTE_DIAS): Float64Array {
  const acc = new Float64Array(dias)
  let total = 0
  const d = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate())
  for (let i = 0; i < dias; i++) {
    const m = d.getMonth()
    total += (taxaMensal * SAZONALIDADE[m]!) / diasNoMes(d.getFullYear(), m)
    acc[i] = total
    d.setDate(d.getDate() + 1)
  }
  return acc
}

export interface EstimativaEspera {
  /** há lugar livre para este candidato já hoje */
  imediata: boolean
  /** nº de saídas necessárias até chegar a vez deste candidato */
  vagasNecessarias: number
  /** pessoas à frente na lista, já descontadas pelo fator de lista efetiva */
  listaEfetiva: number
  taxaMensal: number
  p30: number
  p90: number
  p180: number
  p365: number
  /** dias até P ≥ 50% (null = mais de 2 anos) */
  diasMediana: number | null
  /** dias até P ≥ 20% (cenário otimista) */
  diasOtimista: number | null
  /** dias até P ≥ 80% (cenário prudente) */
  diasPessimista: number | null
  /** probabilidade acumulada no fim de cada um dos próximos 12 meses (≈30 dias cada) */
  curva: number[]
}

/**
 * Estimativa de espera para um novo candidato (fim da lista) ou para quem já está na
 * lista na posição `posicao` (1 = primeiro).
 */
export function estimarEspera(
  lar: Pick<Lar, 'quartos' | 'capacidade' | 'estadiaMediaMeses' | 'historicoSaidas' | 'listaEspera'>,
  opts: { posicao?: number; inicio?: Date } = {},
): EstimativaEspera {
  const inicio = opts.inicio ?? new Date()
  const aFrente = opts.posicao != null ? Math.max(0, opts.posicao - 1) : Math.max(0, lar.listaEspera)
  const listaEfetiva = Math.round(aFrente * FATOR_LISTA_EFETIVA)
  const livres = vagasLivres(lar)
  const taxa = taxaSaidasMensal(lar)

  if (listaEfetiva < livres) {
    return {
      imediata: true,
      vagasNecessarias: 0,
      listaEfetiva,
      taxaMensal: taxa,
      p30: 1,
      p90: 1,
      p180: 1,
      p365: 1,
      diasMediana: 0,
      diasOtimista: 0,
      diasPessimista: 0,
      curva: Array(12).fill(1),
    }
  }

  const k = listaEfetiva - livres + 1
  const acc = intensidadeAcumulada(taxa, inicio)
  const p = (dia: number) => poissonAtLeast(k, acc[Math.min(acc.length - 1, Math.max(0, dia - 1))]!)

  const primeiroDia = (alvo: number): number | null => {
    // pesquisa binária (P é monótona crescente no tempo)
    if (p(HORIZONTE_DIAS) < alvo) return null
    let lo = 1
    let hi = HORIZONTE_DIAS
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (p(mid) >= alvo) hi = mid
      else lo = mid + 1
    }
    return lo
  }

  return {
    imediata: false,
    vagasNecessarias: k,
    listaEfetiva,
    taxaMensal: taxa,
    p30: p(30),
    p90: p(90),
    p180: p(180),
    p365: p(365),
    diasMediana: primeiroDia(0.5),
    diasOtimista: primeiroDia(0.2),
    diasPessimista: primeiroDia(0.8),
    curva: Array.from({ length: 12 }, (_, i) => p((i + 1) * 30)),
  }
}

export function disponibilidade(
  lar: Pick<Lar, 'quartos' | 'capacidade' | 'estadiaMediaMeses' | 'historicoSaidas' | 'listaEspera'>,
  est?: EstimativaEspera,
): Disponibilidade {
  if (vagasLivres(lar) > 0) return 'disponivel'
  const e = est ?? estimarEspera(lar)
  return e.p90 >= 0.5 ? 'breve' : 'espera'
}

export interface PrevisaoMes {
  /** índice do mês (0 = janeiro) */
  mes: number
  ano: number
  /** saídas (vagas libertadas) esperadas */
  esperado: number
  /** intervalo de 80% */
  min: number
  max: number
  /** probabilidade de pelo menos uma vaga libertada neste mês */
  pAlguma: number
}

/** Vagas que deverão libertar-se em cada um dos próximos `meses` meses (inclui o mês atual). */
export function previsaoMensal(
  lar: Pick<Lar, 'quartos' | 'capacidade' | 'estadiaMediaMeses' | 'historicoSaidas'>,
  meses = 12,
  inicio = new Date(),
): PrevisaoMes[] {
  const taxa = taxaSaidasMensal(lar)
  return Array.from({ length: meses }, (_, i) => {
    const d = new Date(inicio.getFullYear(), inicio.getMonth() + i, 1)
    const esperado = taxa * SAZONALIDADE[d.getMonth()]!
    return {
      mes: d.getMonth(),
      ano: d.getFullYear(),
      esperado,
      min: poissonQuantile(0.1, esperado),
      max: poissonQuantile(0.9, esperado),
      pAlguma: 1 - Math.exp(-esperado),
    }
  })
}

/**
 * Há lugar para quem pede hoje? Pode haver lugares livres que já estão prometidos a quem está
 * na lista de espera (a lista efetiva é maior do que os lugares livres): nesse caso, a vaga
 * livre não serve a um novo pedido e não se deve dizer "com vaga agora" a quem tem pressa.
 */
export function vagaParaNovos(
  lar: Parameters<typeof estimarEspera>[0],
  est: EstimativaEspera = estimarEspera(lar),
): boolean {
  return est.imediata
}

/**
 * Frase curta para cartões: "1 vaga disponível agora", "Espera estimada: ~2 meses", …
 * Usa o mesmo rótulo da ficha ("Espera estimada") porque se baseia na mediana (50%): dizer
 * "vaga provável" ao lado de uma previsão que chama "Possível" a esse mês seria contraditório.
 */
export function resumoPrevisao(lar: Parameters<typeof estimarEspera>[0], est = estimarEspera(lar)): string {
  const livres = vagasLivres(lar)
  if (livres > 0 && est.imediata) return livres === 1 ? '1 vaga disponível agora' : `${livres} vagas disponíveis agora`
  if (est.diasMediana == null) return 'Espera estimada: mais de 2 anos'
  if (est.diasMediana <= 21) return 'Espera estimada: poucas semanas'
  const meses = Math.max(1, Math.round(est.diasMediana / 30))
  return `Espera estimada: ~${meses} ${meses === 1 ? 'mês' : 'meses'}`
}
