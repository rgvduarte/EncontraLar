/**
 * Quando há poucas (ou nenhumas) sugestões: qual é o requisito que mais está a limitar,
 * explicado com números reais da zona, e ajustes de um clique.
 */
import type { Cuidado, Lar } from '@/types'
import { CUIDADO_LABEL, CUIDADOS_CRITICOS, GRAU_LABEL } from '@/lib/labels'
import { precoReferencia, type MatchResult } from '@/lib/matching'
import { vagasLivres } from '@/lib/forecast'
import { euro, km } from '@/lib/format'
import { comDistancia, mediana, residenciais, type LarPerto } from './area'
import { deLocal, listaE, type Pessoa } from './language'
import { RAIO_MAX, type Rascunho } from './model'

export interface Ajuste {
  label: string
  /** alteração a aplicar ao perfil (fica nos resultados) */
  patch?: Partial<Rascunho>
  /** ou: voltar a um passo do questionário */
  passo?: number
}

export interface Diagnostico {
  chave: 'raio' | 'grau' | 'cuidados' | 'ss' | 'orcamento' | 'urgencia' | 'geral'
  titulo: string
  texto: string
  ajustes: Ajuste[]
}

const teto5 = (v: number) => Math.ceil(v / 5) * 5
const teto50 = (v: number) => Math.ceil(v / 50) * 50

/** Raio (múltiplo de 5, até 50 km) que inclui a instituição mais próxima que cumpre `ok`. */
function raioAte(perto: LarPerto[], raioAtual: number, ok: (l: Lar) => boolean): { raio: number; d: number } | null {
  const alvo = perto.find((x) => x.d > raioAtual && ok(x.lar))
  if (!alvo) return null
  const raio = teto5(alvo.d + 0.5)
  return raio <= RAIO_MAX ? { raio, d: alvo.d } : null
}

export function diagnosticar(lares: Lar[], r: Rascunho, p: Pessoa, matches: MatchResult[]): Diagnostico | null {
  if (!r.local || !r.grau || r.orcamentoMax == null) return null
  const grau = r.grau
  const orc = r.orcamentoMax
  const onde = deLocal(r.local.label)
  const perto = comDistancia(residenciais(lares), r.local)
  const area = perto.filter((x) => x.d <= r.raioKm)

  // 1. nada no raio
  if (!area.length) {
    const prox = perto[0]
    const alargar = prox ? teto5(Math.max(prox.d, perto[2]?.d ?? prox.d) + 0.5) : null
    return {
      chave: 'raio',
      titulo: 'Não há instituições tão perto',
      texto: prox
        ? `Não temos instituições a menos de ${r.raioKm}\u00a0km ${onde}. A mais próxima fica a ${km(prox.d)}.`
        : `Ainda não temos instituições registadas perto ${onde}.`,
      ajustes: [
        ...(alargar && alargar <= RAIO_MAX ? [{ label: `Alargar o raio para ${alargar} km`, patch: { raioKm: alargar } }] : []),
        ...(alargar && alargar > RAIO_MAX && r.raioKm < RAIO_MAX
          ? [{ label: `Alargar o raio para ${RAIO_MAX} km`, patch: { raioKm: RAIO_MAX } }]
          : []),
        { label: 'Escolher outra localidade', passo: 3 },
      ],
    }
  }

  // 2. grau de dependência
  const admitem = area.filter((x) => x.lar.graus.includes(grau))
  const criticos = (r.semNecessidades ? [] : r.necessidades).filter((n) => CUIDADOS_CRITICOS.includes(n))
  const serve = (l: Lar) => l.graus.includes(grau) && criticos.every((c) => l.cuidados.includes(c))
  if (!admitem.length) {
    // de preferência um raio onde também haja os cuidados essenciais; senão, onde pelo menos admitam o grau
    const alt = raioAte(perto, r.raioKm, serve) ?? raioAte(perto, r.raioKm, (l) => l.graus.includes(grau))
    return {
      chave: 'grau',
      titulo: `O grau de dependência é o que mais limita`,
      texto:
        (area.length === 1
          ? `A única instituição a menos de ${r.raioKm}\u00a0km ${onde} não admite pessoas com ${GRAU_LABEL[grau].toLowerCase()}.`
          : `Nenhuma das ${area.length} instituições a menos de ${r.raioKm}\u00a0km ${onde} admite pessoas com ${GRAU_LABEL[grau].toLowerCase()}.`) +
        (grau === 'grave'
          ? ' Para dependência grave é preciso um lar preparado para pessoas acamadas, com enfermagem permanente — e são menos.'
          : ''),
      ajustes: [
        ...(alt
          ? [{ label: `Alargar o raio para ${alt.raio} km (a mais próxima fica a ${km(alt.d)})`, patch: { raioKm: alt.raio } }]
          : [{ label: 'Procurar noutra zona', passo: 3 }]),
        { label: 'Rever o grau de autonomia', passo: 1 },
      ],
    }
  }

  // 3. cuidados essenciais
  const compat = admitem.filter((x) => serve(x.lar))
  if (criticos.length && !compat.length) {
    const porCuidado = criticos.map((c) => ({ c, n: admitem.filter((x) => x.lar.cuidados.includes(c)).length }))
    const pior = [...porCuidado].sort((a, b) => a.n - b.n)[0]!
    const nomes = (cs: Cuidado[]) => listaE(cs.map((c) => CUIDADO_LABEL[c].toLowerCase()))
    const alt = raioAte(perto, r.raioKm, serve)
    return {
      chave: 'cuidados',
      titulo: 'Os cuidados essenciais não existem tão perto',
      texto:
        pior.n === 0
          ? admitem.length === 1
            ? `A única instituição da zona que admite ${GRAU_LABEL[grau].toLowerCase()} não assegura ${CUIDADO_LABEL[pior.c].toLowerCase()}.`
            : `Das ${admitem.length} instituições da zona que admitem ${GRAU_LABEL[grau].toLowerCase()}, nenhuma assegura ${CUIDADO_LABEL[pior.c].toLowerCase()}.`
          : `Há instituições na zona com cada um destes cuidados, mas nenhuma assegura ao mesmo tempo ${nomes(criticos)}.`,
      ajustes: [
        ...(alt
          ? [{ label: `Alargar o raio para ${alt.raio} km (a mais próxima fica a ${km(alt.d)})`, patch: { raioKm: alt.raio } }]
          : []),
        {
          label: `Procurar sem exigir ${CUIDADO_LABEL[pior.c].toLowerCase()}`,
          patch: { necessidades: r.necessidades.filter((n) => n !== pior.c) },
        },
      ],
    }
  }

  // a partir daqui há instituições compatíveis na zona; o que pesa são os critérios "macios"
  const naZona = new Set(compat.map((x) => x.lar.id))

  // 4. comparticipação da Segurança Social
  if (r.precisaAcordoSS && !compat.some((x) => x.lar.acordoSS)) {
    const alt = raioAte(perto, r.raioKm, (l) => serve(l) && l.acordoSS)
    return {
      chave: 'ss',
      titulo: 'Falta acordo com a Segurança Social',
      texto:
        compat.length === 1
          ? `A única instituição compatível a menos de ${r.raioKm}\u00a0km não tem vagas com acordo de cooperação.`
          : `Nenhuma das ${compat.length} instituições compatíveis a menos de ${r.raioKm}\u00a0km tem vagas com acordo de cooperação.`,
      ajustes: [
        ...(alt ? [{ label: `Alargar o raio para ${alt.raio} km`, patch: { raioKm: alt.raio } }] : []),
        { label: 'Ver também sem comparticipação', patch: { precisaAcordoSS: false } },
      ],
    }
  }

  // 5. orçamento
  const precos = compat.map((x) => precoReferencia(x.lar, r.quarto))
  const cabem = precos.filter((v) => v <= orc).length
  if (cabem === 0) {
    const min = Math.min(...precos)
    const med = mediana(precos)!
    const opcoes = [teto50(min), teto50(med)].filter((v, i, a) => v > orc && a.indexOf(v) === i && v <= 5000)
    return {
      chave: 'orcamento',
      titulo: 'O orçamento está abaixo dos preços da zona',
      texto: `${compat.length === 1 ? `A única instituição que pode receber ${p.a} a menos de ${r.raioKm}\u00a0km pede` : `As ${compat.length} instituições que podem receber ${p.a} a menos de ${r.raioKm}\u00a0km pedem`}, no mínimo, ${euro(min)} por mês${
        compat.length > 2 ? ` (mediana ${euro(med)})` : ''
      }. O orçamento indicado é ${euro(orc)}.`,
      ajustes: [
        ...opcoes.map((v, i) => ({
          label: `Subir para ${euro(v)}${i === 0 ? ' (o mais acessível)' : ' (mediana)'}`,
          patch: { orcamentoMax: v },
        })),
        ...(r.quarto !== 'indiferente' && r.quarto !== 'duplo'
          ? [{ label: 'Considerar quarto duplo', patch: { quarto: 'duplo' as const } }]
          : []),
      ],
    }
  }

  // 6. urgência imediata sem vagas
  if (r.urgencia === 'imediata' && !compat.some((x) => vagasLivres(x.lar) > 0)) {
    const alt = raioAte(perto, r.raioKm, (l) => serve(l) && vagasLivres(l) > 0)
    return {
      chave: 'urgencia',
      titulo: 'Não há vaga livre hoje tão perto',
      texto: `Há ${compat.length} ${compat.length === 1 ? 'instituição compatível' : 'instituições compatíveis'} na zona, mas nenhuma tem lugar livre neste momento.`,
      ajustes: [
        ...(alt ? [{ label: `Alargar para ${alt.raio} km (há vaga a ${km(alt.d)})`, patch: { raioKm: alt.raio } }] : []),
        { label: 'Incluir lares com vaga prevista em breve', patch: { urgencia: '1-3meses' as const } },
      ],
    }
  }

  // 7. geral: o critério com maior perda média entre os compatíveis
  const ms = matches.filter((m) => naZona.has(m.larId))
  if (!ms.length) return null
  const perdas = {
    orcamento: ms.reduce((s, m) => s + (20 - m.parcelas.orcamento), 0) / ms.length,
    disponibilidade: ms.reduce((s, m) => s + (15 - m.parcelas.disponibilidade), 0) / ms.length,
    preferencias: ms.reduce((s, m) => s + (10 - m.parcelas.preferencias), 0) / ms.length,
  }
  const [chave] = Object.entries(perdas).sort((a, b) => b[1] - a[1])[0]!
  if (chave === 'orcamento') {
    const v = teto50(mediana(precos)!)
    return {
      chave: 'orcamento',
      titulo: 'Poucas opções dentro do orçamento',
      texto:
        compat.length === 1
          ? 'Há só uma instituição compatível na zona.'
          : `Só ${cabem} das ${compat.length} instituições compatíveis da zona ${cabem === 1 ? 'cabe' : 'cabem'} em ${euro(orc)} por mês.`,
      ajustes: v > orc ? [{ label: `Experimentar até ${euro(v)} (mediana da zona)`, patch: { orcamentoMax: v } }] : [],
    }
  }
  if (chave === 'disponibilidade') {
    const alt = raioAte(perto, r.raioKm, (l) => serve(l) && vagasLivres(l) > 0)
    return {
      chave: 'urgencia',
      titulo: 'A urgência pesa contra as listas de espera',
      texto: 'As instituições compatíveis da zona têm pouca vaga para o prazo que indicou.',
      ajustes: alt ? [{ label: `Alargar para ${alt.raio} km (há vaga a ${km(alt.d)})`, patch: { raioKm: alt.raio } }] : [],
    }
  }
  return {
    chave: 'geral',
    titulo: 'As preferências estão a pesar',
    texto: 'Poucas instituições da zona têm todas as comodidades escolhidas. São um extra — não excluem nenhum lar.',
    ajustes: r.preferencias.length ? [{ label: 'Retirar as preferências', patch: { preferencias: [] } }] : [],
  }
}
