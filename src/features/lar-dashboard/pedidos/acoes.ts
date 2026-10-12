import type { Candidatura, EstadoCandidatura, Lar } from '@/types'
import type { ButtonVariant } from '@/components/ui/Button'
import { estimarEspera } from '@/lib/forecast'
import { duracaoHumana, euro } from '@/lib/format'
import { nomeQuarto, prazo, quartoParaPropor } from '../lib/derive'
import { bloqueado, nomeContacto, pessoaAnonima, quemPediu } from '../shared/pedidoBits'
import { capitalizar } from '../shared/ui'

export interface Acao {
  id: string
  /**
   * - `estado` (por omissão): muda o estado, com diálogo de confirmação e nota para quem fez o pedido;
   * - `aceitar`: "Aceitar e ver contacto", num toque (aceitarPedido);
   * - `entrada`: "Marcar entrada", com o dia da entrada (marcarEntrada).
   */
  tipo?: 'estado' | 'aceitar' | 'entrada'
  para: EstadoCandidatura
  label: string
  /** aparência do botão na lista */
  variant: ButtonVariant
  /** aparência do botão de confirmação no diálogo */
  confirmVariant: ButtonVariant
  /** título do diálogo de confirmação */
  titulo: string
  /** o que acontece, em linguagem simples */
  explica: string
  confirmar: string
  /** notas prontas a usar (um toque) */
  sugestoes: string[]
  /** se preenchido, a ação não está disponível e o texto explica porquê */
  bloqueio?: string
  /** mensagem do aviso de sucesso */
  sucesso: { titulo: string; texto: string }
}

const naoAceitar = (c: Candidatura, label = 'Não aceitar'): Acao => ({
  id: 'recusar',
  para: 'recusada',
  label,
  variant: 'subtle',
  confirmVariant: 'danger',
  // antes de aceitar, nem no diálogo aparece o nome
  titulo: bloqueado(c) ? `${label} este pedido?` : `${label} o pedido de ${c.perfil.nome}?`,
  explica: `${capitalizar(quemPediu(c))} é avisado(a) de que, neste momento, a casa não tem condições para este perfil. Uma nota curta ajuda a procurar noutro lado sem perder tempo.`,
  confirmar: label,
  sugestoes: [
    'Neste momento não temos condições para assegurar os cuidados de que precisa.',
    'Não temos o tipo de quarto pretendido. Sugerimos procurar no mapa de vagas do EncontraLar.',
    'A nossa lista de espera é longa e a espera não seria compatível com a urgência indicada.',
  ],
  sucesso: { titulo: label === 'Recusar' ? 'Pedido recusado' : 'Pedido não aceite', texto: `${capitalizar(quemPediu(c))} foi avisado(a). O pedido passou para «Concluídos».` },
})

/** "Marcar entrada": a pessoa entrou na casa (a vaga foi aceite, ou a família já confirmou do lado dela). */
const marcarEntrada = (c: Candidatura): Acao => ({
  id: 'entrada',
  tipo: 'entrada',
  para: 'admitida',
  label: 'Marcar entrada',
  variant: 'primary',
  confirmVariant: 'primary',
  titulo: `Marcar a entrada de ${c.perfil.nome}`,
  explica: c.entrada?.confirmadaFamiliaEm
    ? `${nomeContacto(c)} confirmou que ${c.perfil.nome} já entrou. Com a sua confirmação, a entrada fica verificada.`
    : `Pedimos depois a ${nomeContacto(c)} que confirme. Com as duas confirmações, a entrada fica verificada.`,
  confirmar: 'Marcar entrada',
  sugestoes: [],
  sucesso: {
    titulo: 'Entrada registada',
    texto: c.entrada?.confirmadaFamiliaEm ? 'Entrada verificada: confirmada pela instituição e pela família.' : `Pedimos a ${nomeContacto(c).split(' ')[0]} que confirme a entrada.`,
  },
})

/** Ações disponíveis para um pedido, conforme o estado e as vagas atuais. A primeira é a principal. */
export function acoesDoPedido(c: Candidatura, lar: Lar, agora = Date.now()): Acao[] {
  switch (c.estado) {
    case 'enviada':
      // primeira fase: só o resumo anónimo; aceitar revela o nome, o contacto e o perfil completo
      if (bloqueado(c)) {
        return [
          {
            id: 'aceitar',
            tipo: 'aceitar',
            para: 'em_analise',
            label: 'Aceitar e ver contacto',
            variant: 'primary',
            confirmVariant: 'primary',
            titulo: `Aceitar o pedido (${pessoaAnonima(c).toLowerCase()})`,
            explica: 'Passa a ver o nome, o contacto e o perfil completo. Quem fez o pedido fica a saber que o está a analisar.',
            confirmar: 'Aceitar e ver contacto',
            sugestoes: [],
            sucesso: { titulo: 'Pedido aceite', texto: 'Já pode ver o nome, o contacto e o perfil completo.' },
          },
          naoAceitar(c, 'Recusar'),
        ]
      }
      return [
        {
          id: 'analisar',
          para: 'em_analise',
          label: 'Analisar',
          variant: 'primary',
          confirmVariant: 'primary',
          titulo: `Analisar o pedido de ${c.perfil.nome}`,
          explica: 'A família fica a saber que a equipa está a analisar o pedido. É um bom momento para lhe telefonar.',
          confirmar: 'Passar a «Em análise»',
          sugestoes: [
            'Vamos telefonar-lhe nos próximos dias para conhecer melhor a situação.',
            'Pode enviar-nos o último relatório médico ou a nota de alta hospitalar?',
          ],
          sucesso: { titulo: 'Pedido em análise', texto: `${nomeContacto(c)} foi avisado(a).` },
        },
        naoAceitar(c),
      ]
    case 'em_analise': {
      const posicao = lar.listaEspera + 1
      const est = estimarEspera(lar, { posicao })
      const espera = est.imediata ? null : est.diasMediana != null ? duracaoHumana(est.diasMediana) : null
      return [
        {
          id: 'lista',
          para: 'lista_espera',
          label: 'Inscrever na lista de espera',
          variant: 'primary',
          confirmVariant: 'primary',
          titulo: `Inscrever ${c.perfil.nome} na lista de espera`,
          explica: `Fica na posição ${posicao}, depois ${lar.listaEspera === 1 ? 'da pessoa já inscrita' : `das ${lar.listaEspera} pessoas já inscritas`} (incluindo as inscrições por telefone ou presenciais). A família recebe a posição.`,
          confirmar: 'Inscrever',
          sugestoes: [
            'O perfil é adequado à nossa casa. Avisamos assim que houver vaga.',
            espera ? `Pela nossa previsão, a espera deverá ser de ${espera}. É uma estimativa, não uma garantia.` : 'Avisamos assim que houver um lugar adequado.',
          ],
          sucesso: { titulo: `Inscrito(a) na lista — posição ${posicao}`, texto: `${nomeContacto(c)} foi avisado(a) da posição.` },
        },
        naoAceitar(c),
      ]
    }
    case 'lista_espera': {
      const q = quartoParaPropor(lar, c.perfil)
      const pedido = c.perfil.quarto !== 'indiferente' ? nomeQuarto(c.perfil.quarto) : null
      const preco = q ? lar.quartos.find((r) => r.tipo === q.tipo)?.precoMin : undefined
      return [
        {
          id: 'propor',
          para: 'vaga_proposta',
          label: 'Propor vaga',
          variant: 'accent',
          confirmVariant: 'accent',
          titulo: `Propor vaga a ${c.perfil.nome}`,
          explica: q
            ? `A família é avisada de imediato e tem 48 horas para responder. Lugar livre: ${nomeQuarto(q.tipo)}${!q.preferido && pedido ? ` — pediu ${pedido}, que não tem livre` : ''}.`
            : '',
          confirmar: 'Propor a vaga',
          sugestoes: q
            ? [
                `Temos um lugar em ${nomeQuarto(q.tipo)}${preco ? `, a partir de ${euro(preco)} por mês` : ''}.`,
                'Se quiser, marcamos uma visita antes de decidir. Ligue-nos.',
              ]
            : [],
          bloqueio: q ? undefined : 'Sem lugares livres. Quando sair um residente, registe a vaga e poderá propô-la aqui.',
          sucesso: { titulo: 'Vaga proposta', texto: `${nomeContacto(c)} tem 48 horas para responder.` },
        },
        naoAceitar(c, 'Retirar da lista'),
      ]
    }
    case 'vaga_proposta': {
      const p = prazo(c.prazoResposta, agora)
      return [
        {
          id: 'aceite',
          para: 'aceite',
          label: 'A família aceitou',
          variant: 'primary',
          confirmVariant: 'primary',
          titulo: `${nomeContacto(c)} aceitou a vaga?`,
          explica:
            'Use quando a família lhe respondeu por telefone ou presencialmente. O pedido passa a «Vaga aceite», o lugar deixa de aparecer como livre e a família recebe a confirmação. No dia em que a pessoa entrar, marque a entrada.',
          confirmar: 'Passar a «Vaga aceite»',
          sugestoes: [
            'Combinamos consigo a data de entrada por telefone.',
            'No dia da entrada, traga o cartão de cidadão, o cartão de utente e a lista da medicação.',
          ],
          sucesso: { titulo: 'Vaga aceite', texto: `O lugar de ${c.perfil.nome} deixou de aparecer como livre. Quando entrar, marque a entrada.` },
        },
        {
          id: 'retirar',
          para: 'lista_espera',
          label: 'Retirar proposta',
          variant: p?.expirado ? 'accent' : 'subtle',
          confirmVariant: 'primary',
          titulo: `Retirar a proposta a ${c.perfil.nome}?`,
          explica: `A família volta à lista de espera, na mesma posição (${c.posicao ?? '—'}). Depois pode propor o lugar à pessoa seguinte.`,
          confirmar: 'Retirar proposta',
          sugestoes: ['Como não recebemos resposta dentro do prazo, a vaga foi proposta à pessoa seguinte. Mantém a sua posição na lista.'],
          sucesso: { titulo: 'Proposta retirada', texto: `${c.perfil.nome} mantém a posição ${c.posicao ?? ''} na lista de espera.` },
        },
      ]
    }
    case 'aceite':
      return [marcarEntrada(c)]
    case 'admitida':
      // a família confirmou primeiro: falta o lado da instituição
      return c.entrada?.confirmadaLarEm ? [] : [marcarEntrada(c)]
    default:
      return []
  }
}
