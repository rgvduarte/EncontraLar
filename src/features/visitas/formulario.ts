/**
 * Formulário da visita (modo visita): valores iniciais, validação suave, o pedido a `registarVisita` e o resumo do
 * que mudou na ficha. Funções puras (o "agora" entra como argumento), testadas em formulario.test.ts.
 */
import type { Cuidado, Lar, PlanoInstituicao, ResultadoVisita, RoomOffer, TipoQuarto, Visita } from '@/types'
import type { RegistoVisitaInput } from '@/lib/store'
import { CUIDADO_LABEL, CUIDADOS_ORDEM, QUARTO_CURTO } from '@/lib/labels'
import { dataLonga, diaPorExtenso, euro, isoDia, num } from '@/lib/format'
import { COMPROMISSO_MENSAL_MESES, compromissoAte, PLANOS_INSTITUICAO, planoDoLar, podeMudarPlano, valorPlanoTexto } from '@/lib/acesso'
import { niveisVerificacao } from '@/lib/negocio'
import { diasAte, RESULTADO_LABEL } from './pipeline'

export interface QuartoForm {
  tipo: TipoQuarto
  livres: number
  /** só algarismos (o campo não aceita outra coisa); vazio enquanto se escreve */
  precoMin: string
  precoMax: string
}

export interface ResponsavelForm {
  nome: string
  cargo: string
  telefone: string
  email: string
}

export interface FormVisita {
  verificacao: Visita['verificacao']
  /** n.º da licença visto na visita (começa com o da ficha) */
  licenca: string
  quartos: QuartoForm[]
  cuidados: Cuidado[]
  responsavel: ResponsavelForm
  resultado: ResultadoVisita | null
  plano: PlanoInstituicao
  criarConta: boolean
  /** AAAA-MM-DD */
  proximoContacto: string
  notas: string
}

/** O próximo contacto, por omissão: daqui a uma semana. */
export const PRAZO_CONTACTO_DIAS = 7

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** "AAAA-MM-DD" de hoje + n dias (data local). */
export function maisDias(agora: Date, dias: number): string {
  return isoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + dias))
}

const inteiro = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : Number.NaN)

/** Só algarismos, no máximo 5 (mensalidades em euros, sem cêntimos). */
export const soAlgarismos = (s: string) => s.replace(/\D/g, '').slice(0, 5)

export const precisaDeContacto = (r: ResultadoVisita | null) => r === 'interessado' || r === 'voltar'

/** Começa com o que a ficha diz hoje; o responsável vem da última visita que o registou. */
export function formInicial(lar: Lar, visitas: readonly Visita[], agora: Date): FormVisita {
  const resp = visitas.find((v) => v.responsavel)?.responsavel
  return {
    verificacao: { licencaConfirmada: false, instalacoesVistas: false, vagasConfirmadas: false, precosConfirmados: false },
    licenca: lar.verificacao.licenca ?? '',
    quartos: lar.quartos.map((q) => ({ tipo: q.tipo, livres: q.livres, precoMin: String(q.precoMin), precoMax: String(q.precoMax) })),
    cuidados: CUIDADOS_ORDEM.filter((c) => lar.cuidados.includes(c)),
    responsavel: { nome: resp?.nome ?? '', cargo: resp?.cargo ?? '', telefone: resp?.telefone ?? '', email: resp?.email ?? '' },
    resultado: null,
    plano: planoDoLar(lar) ?? 'por_entrada',
    criarConta: false,
    proximoContacto: maisDias(agora, PRAZO_CONTACTO_DIAS),
    notas: '',
  }
}

/** Pode criar a conta do responsável: só na adesão e quando ninguém gere ainda a ficha. */
export const podeCriarConta = (f: Pick<FormVisita, 'resultado'>, lar: Pick<Lar, 'ownerId'>) => f.resultado === 'aderiu' && !lar.ownerId

/** A modalidade "por entrada" está fechada enquanto dura o compromisso da mensalidade. */
export const porEntradaBloqueada = (lar: Pick<Lar, 'natureza' | 'planoInstituicao' | 'planoDesde'>, agora: Date) =>
  planoDoLar(lar) === 'mensal' && !podeMudarPlano(lar, agora.getTime())

export type CampoVisita = 'resultado' | 'email' | 'proximoContacto' | 'plano' | `precoMin:${TipoQuarto}` | `precoMax:${TipoQuarto}`
export type ErrosVisita = Partial<Record<CampoVisita, string>>

/** Ordem pela qual os campos aparecem no ecrã (o foco vai para o primeiro com erro). */
export function ordemCampos(f: Pick<FormVisita, 'quartos'>): CampoVisita[] {
  return [...f.quartos.flatMap((q) => [`precoMin:${q.tipo}`, `precoMax:${q.tipo}`] as CampoVisita[]), 'email', 'resultado', 'plano', 'proximoContacto']
}

/**
 * Validação suave: o resultado, o email só quando se cria a conta, a data só quando fica a acompanhar,
 * e os preços só quando foram confirmados (inteiros, com o máximo nunca abaixo do mínimo).
 */
export function validarVisita(f: FormVisita, lar: Pick<Lar, 'ownerId' | 'natureza' | 'planoInstituicao' | 'planoDesde'>, agora: Date): ErrosVisita {
  const e: ErrosVisita = {}
  if (!f.resultado) e.resultado = 'Escolha o resultado da visita.'
  if (f.criarConta && podeCriarConta(f, lar)) {
    const email = f.responsavel.email.trim()
    if (!email) e.email = 'Indique o email do responsável para criar a conta.'
    else if (!EMAIL_RE.test(email)) e.email = 'O email não parece válido.'
  }
  if (precisaDeContacto(f.resultado)) {
    const d = diasAte(f.proximoContacto, agora)
    if (d == null) e.proximoContacto = 'Escolha a data do próximo contacto.'
    else if (d < 0) e.proximoContacto = 'Escolha uma data a partir de hoje.'
  }
  if (f.resultado === 'aderiu' && lar.natureza === 'privado' && f.plano === 'por_entrada' && porEntradaBloqueada(lar, agora)) {
    e.plano = `A mensalidade tem um compromisso de ${COMPROMISSO_MENSAL_MESES} meses: «Por entrada» só a partir de ${dataLonga(compromissoAte(lar)!)}.`
  }
  if (f.verificacao.precosConfirmados) {
    for (const q of f.quartos) {
      const min = inteiro(q.precoMin)
      const max = inteiro(q.precoMax)
      if (Number.isNaN(min) || min < 1) e[`precoMin:${q.tipo}`] = 'Indique o valor, em euros.'
      if (Number.isNaN(max) || max < 1) e[`precoMax:${q.tipo}`] = 'Indique o valor, em euros.'
      else if (!Number.isNaN(min) && max < min) e[`precoMax:${q.tipo}`] = 'Não pode ser inferior ao mínimo.'
    }
  }
  return e
}

const mesmosCuidados = (a: readonly Cuidado[], b: readonly Cuidado[]) => a.length === b.length && a.every((c) => b.includes(c))

/** O pedido a `registarVisita` (só envia o que foi confirmado ou mudou). Pressupõe um formulário válido. */
export function registoDe(f: FormVisita, lar: Lar): RegistoVisitaInput {
  const resultado = f.resultado
  if (!resultado) throw new Error('registoDe: falta o resultado da visita (validar primeiro)')
  const r = f.responsavel
  const temResponsavel = !!(r.nome.trim() || r.cargo.trim() || r.telefone.trim() || r.email.trim())
  const confirmouQuartos = f.verificacao.vagasConfirmadas || f.verificacao.precosConfirmados
  return {
    larId: lar.id,
    resultado,
    verificacao: { ...f.verificacao },
    licenca: f.verificacao.licencaConfirmada ? f.licenca.trim() || undefined : undefined,
    responsavel: temResponsavel
      ? { nome: r.nome.trim(), cargo: r.cargo.trim() || undefined, telefone: r.telefone.trim() || undefined, email: r.email.trim() || undefined }
      : undefined,
    plano: resultado === 'aderiu' && lar.natureza === 'privado' ? f.plano : undefined,
    notas: f.notas.trim() || undefined,
    proximoContacto: precisaDeContacto(resultado) ? f.proximoContacto : undefined,
    quartos: confirmouQuartos
      ? f.quartos
          .filter((q) => lar.quartos.some((x) => x.tipo === q.tipo))
          .map((q) => {
            const atual = lar.quartos.find((x) => x.tipo === q.tipo)!
            const min = inteiro(q.precoMin)
            const max = inteiro(q.precoMax)
            return {
              tipo: q.tipo,
              livres: Math.max(0, Math.min(atual.total, Math.round(q.livres))),
              precoMin: Number.isNaN(min) ? atual.precoMin : min,
              precoMax: Number.isNaN(max) ? atual.precoMax : max,
            }
          })
      : undefined,
    cuidados: mesmosCuidados(f.cuidados, lar.cuidados) ? undefined : CUIDADOS_ORDEM.filter((c) => f.cuidados.includes(c)),
    criarConta: f.criarConta && podeCriarConta(f, lar) ? true : undefined,
  }
}

// ————————————————————————————————————————— o que mudou (ecrã final)

export interface Mudanca {
  id: 'selo' | 'licenca' | 'vagas' | 'precos' | 'cuidados' | 'resultado'
  titulo: string
  detalhe?: string
}

const precoQuarto = (q: Pick<RoomOffer, 'precoMin' | 'precoMax'>) => (q.precoMin === q.precoMax ? euro(q.precoMin) : `${num(q.precoMin)}–${euro(q.precoMax)}`)

const lista = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} e ${xs[xs.length - 1]}`)

/** Linha do resultado: "Aderiu · Mensalidade", "Interessado", … com o pormenor que interessa à equipa. */
export function mudancaResultado(visita: Pick<Visita, 'resultado' | 'plano' | 'proximoContacto'>, lar: Pick<Lar, 'natureza'>): Mudanca {
  const titulo = RESULTADO_LABEL[visita.resultado]
  if (visita.resultado === 'aderiu') {
    if (lar.natureza !== 'privado') return { id: 'resultado', titulo, detalhe: 'Sem custos — setor social.' }
    const plano = visita.plano ?? 'por_entrada'
    const extra = plano === 'mensal' ? ` · compromisso de ${COMPROMISSO_MENSAL_MESES} meses` : ' · só paga quando alguém entra'
    return { id: 'resultado', titulo: `${titulo} · ${PLANOS_INSTITUICAO[plano].nome}`, detalhe: `${valorPlanoTexto(plano)}${extra}.` }
  }
  if (precisaDeContacto(visita.resultado)) {
    return {
      id: 'resultado',
      titulo,
      detalhe: visita.proximoContacto ? `Próximo contacto: ${diaPorExtenso(visita.proximoContacto)}.` : 'Sem data para o próximo contacto.',
    }
  }
  return { id: 'resultado', titulo, detalhe: 'Fica na lista «Recusaram».' }
}

/**
 * O que a visita mudou na ficha: selo, licença, vagas, preços e cuidados (comparando antes e depois) e o resultado.
 * Sem `antes` (o ecrã foi recarregado), descreve só o que a visita registou.
 */
export function resumirMudancas(antes: Lar | undefined, depois: Lar, visita: Visita): Mudanca[] {
  const out: Mudanca[] = []
  const v = visita.verificacao
  const selo = v.licencaConfirmada && v.instalacoesVistas
  if (selo) {
    const renovado = !!antes && niveisVerificacao(antes).visitado
    out.push({
      id: 'selo',
      titulo: renovado ? 'Selo «Visitada pela equipa» renovado' : 'Selo «Visitada pela equipa» atribuído',
      detalhe: `Licença${depois.verificacao.licenca ? ` n.º ${depois.verificacao.licenca}` : ''} e instalações confirmadas.`,
    })
  } else if (v.licencaConfirmada) {
    out.push({
      id: 'licenca',
      titulo: 'Licença confirmada',
      detalhe: `${depois.verificacao.licenca ? `N.º ${depois.verificacao.licenca}. ` : ''}Para o selo «Visitada pela equipa» falta ver as instalações.`,
    })
  }

  if (v.vagasConfirmadas) {
    const mudaram = antes
      ? depois.quartos.flatMap((q) => {
          const a = antes.quartos.find((x) => x.tipo === q.tipo)
          return a && a.livres !== q.livres ? [`${QUARTO_CURTO[q.tipo]}: ${a.livres} → ${q.livres} ${q.livres === 1 ? 'livre' : 'livres'}`] : []
        })
      : []
    out.push(
      mudaram.length
        ? { id: 'vagas', titulo: 'Vagas atualizadas', detalhe: mudaram.join(' · ') }
        : { id: 'vagas', titulo: 'Vagas confirmadas', detalhe: antes ? 'Sem alterações aos lugares livres.' : undefined },
    )
  }
  if (v.precosConfirmados) {
    const mudaram = antes
      ? depois.quartos.flatMap((q) => {
          const a = antes.quartos.find((x) => x.tipo === q.tipo)
          return a && (a.precoMin !== q.precoMin || a.precoMax !== q.precoMax) ? [`${QUARTO_CURTO[q.tipo]}: ${precoQuarto(a)} → ${precoQuarto(q)}`] : []
        })
      : []
    out.push(
      mudaram.length
        ? { id: 'precos', titulo: 'Preços atualizados', detalhe: mudaram.join(' · ') }
        : { id: 'precos', titulo: 'Preços confirmados', detalhe: antes ? 'Sem alterações às mensalidades.' : undefined },
    )
  }

  if (antes) {
    const juntou = depois.cuidados.filter((c) => !antes.cuidados.includes(c)).map((c) => CUIDADO_LABEL[c])
    const tirou = antes.cuidados.filter((c) => !depois.cuidados.includes(c)).map((c) => CUIDADO_LABEL[c])
    if (juntou.length || tirou.length) {
      const partes = [juntou.length ? `Junta ${lista(juntou)}.` : '', tirou.length ? `Retira ${lista(tirou)}.` : ''].filter(Boolean)
      out.push({ id: 'cuidados', titulo: 'Cuidados atualizados', detalhe: partes.join(' ') })
    }
  }

  out.push(mudancaResultado(visita, depois))
  return out
}
