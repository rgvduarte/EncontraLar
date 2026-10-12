import type { Pessoa } from '../language'

/** Pergunta principal (h1) de cada passo, já personalizada. Curta, como no assistente de configuração da Apple. */
export function tituloPasso(passo: number, p: Pessoa): string {
  switch (passo) {
    case 0:
      return 'Para quem está a procurar?'
    case 1:
      return p.proprio ? 'Como se sente no dia a dia?' : `Como está ${p.a} no dia a dia?`
    case 2:
      return 'De que cuidados de saúde precisa?'
    case 3:
      return p.proprio ? 'Em que zona quer viver?' : `Onde deve ficar ${p.a}?`
    case 4:
      return 'Quanto pode pagar por mês?'
    default:
      return 'Para quando precisa de vaga?'
  }
}

/** Uma frase de apoio, curta. */
export function ledePasso(passo: number): string {
  switch (passo) {
    case 0:
      return 'O nome é opcional. Serve só para personalizar as perguntas.'
    case 1:
      return 'Escolha o mais próximo da realidade de hoje. Pode mudar depois.'
    case 2:
      return 'Marque o que se aplica hoje.'
    case 3:
      return 'Perto de quem vai visitar mais vezes.'
    case 4:
      return 'Por pessoa. Comparamos com os preços reais da zona.'
    default:
      return 'Se é urgente, damos prioridade aos lares com vaga agora.'
  }
}
