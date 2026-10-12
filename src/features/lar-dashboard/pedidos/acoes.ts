import { ClipboardCheck, DoorOpen, KeyRound, ListOrdered, Undo2, UserX, type LucideIcon } from 'lucide-react'
import type { Candidatura, EstadoCandidatura, Lar } from '@/types'
import type { ButtonVariant } from '@/components/ui/Button'
import { estimarEspera } from '@/lib/forecast'
import { duracaoHumana, euro } from '@/lib/format'
import { QUARTO_CURTO, QUARTO_LABEL } from '@/lib/labels'
import { quartoParaPropor } from '../lib/derive'

export interface Acao {
  id: string
  para: EstadoCandidatura
  label: string
  variant: ButtonVariant
  icon: LucideIcon
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
  variant: 'danger',
  icon: UserX,
  titulo: `${label} o pedido de ${c.perfil.nome}?`,
  explica:
    'A família é avisada de que, neste momento, a instituição não tem condições para este perfil. Uma nota curta e honesta ajuda-a a procurar noutro lado sem perder tempo.',
  confirmar: label,
  sugestoes: [
    'Neste momento não temos condições para assegurar os cuidados de que precisa.',
    'Não temos o tipo de quarto pretendido. Sugerimos procurar no mapa de vagas do EncontraLar.',
    'A nossa lista de espera é longa e a espera não seria compatível com a urgência indicada.',
  ],
  sucesso: { titulo: 'Pedido não aceite', texto: `${c.contacto.nome} foi avisado(a). O pedido passou para «Concluídos».` },
})

/** Ações disponíveis para um pedido, conforme o estado e as vagas atuais. */
export function acoesDoPedido(c: Candidatura, lar: Lar): Acao[] {
  switch (c.estado) {
    case 'enviada':
      return [
        {
          id: 'analisar',
          para: 'em_analise',
          label: 'Analisar',
          variant: 'primary',
          icon: ClipboardCheck,
          titulo: `Analisar o pedido de ${c.perfil.nome}`,
          explica: 'A família fica a saber que o pedido está a ser analisado pela equipa técnica. É um bom momento para telefonar e conhecer a situação.',
          confirmar: 'Passar a «Em análise»',
          sugestoes: [
            'Vamos telefonar-lhe nos próximos dias para conhecer melhor a situação.',
            'Pode enviar-nos o último relatório médico ou a nota de alta hospitalar?',
          ],
          sucesso: { titulo: 'Pedido em análise', texto: `${c.contacto.nome} foi avisado(a). O pedido está agora em «Em análise».` },
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
          icon: ListOrdered,
          titulo: `Inscrever ${c.perfil.nome} na lista de espera`,
          explica: `Fica na posição ${posicao}, depois ${lar.listaEspera === 1 ? 'da pessoa já inscrita' : `das ${lar.listaEspera} pessoas já inscritas`} (incluindo as inscrições feitas por telefone ou presencialmente). A família recebe a posição na lista.`,
          confirmar: 'Inscrever na lista',
          sugestoes: [
            'O perfil é adequado à nossa casa. Avisamos assim que houver vaga.',
            espera ? `Pela nossa previsão, a espera deverá ser de ${espera}. É uma estimativa, não uma garantia.` : 'Avisamos assim que houver um lugar adequado.',
          ],
          sucesso: { titulo: `Inscrito(a) na lista — posição ${posicao}`, texto: `${c.contacto.nome} foi avisado(a) da posição na lista de espera.` },
        },
        naoAceitar(c),
      ]
    }
    case 'lista_espera': {
      const q = quartoParaPropor(lar, c.perfil)
      const pedido = c.perfil.quarto !== 'indiferente' ? QUARTO_CURTO[c.perfil.quarto].toLowerCase() : null
      const preco = q ? lar.quartos.find((r) => r.tipo === q.tipo)?.precoMin : undefined
      return [
        {
          id: 'propor',
          para: 'vaga_proposta',
          label: 'Propor vaga',
          variant: 'accent',
          icon: DoorOpen,
          titulo: `Propor vaga a ${c.perfil.nome}`,
          explica: q
            ? `A família recebe o aviso de imediato e tem 48 horas para responder. Lugar disponível: ${QUARTO_LABEL[q.tipo].toLowerCase()}${!q.preferido && pedido ? ` (pediu quarto ${pedido}, que não tem livre)` : ''}.`
            : '',
          confirmar: 'Propor a vaga',
          sugestoes: q
            ? [
                `Temos um lugar em ${QUARTO_LABEL[q.tipo].toLowerCase()}${preco ? `, a partir de ${euro(preco)} por mês` : ''}.`,
                'Se quiser, marcamos uma visita antes de decidir. Ligue-nos.',
              ]
            : [],
          bloqueio: q
            ? undefined
            : 'Sem lugares livres neste momento. Quando sair um residente, registe a vaga em «Vagas» e poderá propô-la aqui.',
          sucesso: { titulo: 'Vaga proposta', texto: `${c.contacto.nome} tem 48 horas para responder. Recebe a resposta no sino de notificações.` },
        },
        naoAceitar(c, 'Retirar da lista'),
      ]
    }
    case 'vaga_proposta':
      return [
        {
          id: 'aceite',
          para: 'aceite',
          label: 'A família aceitou por telefone',
          variant: 'primary',
          icon: KeyRound,
          titulo: `Confirmar a entrada de ${c.perfil.nome}`,
          explica: 'Use quando a família já lhe deu a resposta por telefone ou presencialmente. O lugar deixa de aparecer como livre e a família recebe a confirmação.',
          confirmar: 'Confirmar entrada',
          sugestoes: [
            'Combinamos consigo a data de entrada por telefone.',
            'No dia da entrada, traga o cartão de cidadão, o cartão de utente e a lista da medicação.',
          ],
          sucesso: { titulo: 'Entrada confirmada', texto: `O lugar de ${c.perfil.nome} deixou de aparecer como livre.` },
        },
        {
          id: 'retirar',
          para: 'lista_espera',
          label: 'Retirar proposta',
          variant: 'secondary',
          icon: Undo2,
          titulo: `Retirar a proposta a ${c.perfil.nome}?`,
          explica: `A família volta à lista de espera, na mesma posição (${c.posicao ?? '—'}). Pode depois propor o lugar à pessoa seguinte.`,
          confirmar: 'Retirar proposta',
          sugestoes: ['Como não recebemos resposta dentro do prazo, a vaga foi proposta à pessoa seguinte. Mantém a sua posição na lista.'],
          sucesso: { titulo: 'Proposta retirada', texto: `${c.perfil.nome} mantém a posição ${c.posicao ?? ''} na lista de espera.` },
        },
      ]
    default:
      return []
  }
}
