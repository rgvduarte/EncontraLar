import type { ReactNode } from 'react'
import type { Pessoa } from '../language'

/** Pergunta principal (h1) de cada passo, já personalizada. */
export function tituloPasso(passo: number, p: Pessoa): ReactNode {
  switch (passo) {
    case 0:
      return (
        <>
          Para quem está a <em>procurar</em>?
        </>
      )
    case 1:
      return p.proprio ? (
        <>
          Como se sente no <em>dia a dia</em>?
        </>
      ) : (
        <>
          Como está {p.a} no <em>dia a dia</em>?
        </>
      )
    case 2:
      return (
        <>
          De que <em>cuidados</em> de saúde precisa?
        </>
      )
    case 3:
      return p.proprio ? (
        <>
          Em que zona quer <em>viver</em>?
        </>
      ) : (
        <>
          Onde deve ficar, para estarem <em>perto</em>?
        </>
      )
    case 4:
      return p.proprio ? (
        <>
          Quanto pode <em>pagar</em> por mês?
        </>
      ) : (
        <>
          Quanto pode a família <em>pagar</em> por mês?
        </>
      )
    default:
      return (
        <>
          Para <em>quando</em> precisa de vaga?
        </>
      )
  }
}

/** "Porque perguntamos" — uma frase calma, como diria um assistente social. */
export function ledePasso(passo: number, p: Pessoa): string {
  switch (passo) {
    case 0:
      return 'Comecemos pelo essencial. O nome é opcional — serve só para as perguntas seguintes falarem da pessoa certa.'
    case 1:
      return `É a pergunta que mais pesa: cada lar só pode admitir certos graus de dependência, e muitas residências seniores recebem apenas pessoas autónomas. Pense em como ${p.proprio ? 'está' : `${p.pronome} está`} hoje, não num dia bom.`
    case 2:
      return 'Marque o que se aplica hoje. Os cuidados permanentes são essenciais: só sugerimos lares que os asseguram. Os restantes contam a favor, mas não excluem ninguém.'
    case 3:
      return p.proprio
        ? 'Perto da sua casa, dos filhos ou do centro de saúde de sempre — escolha o ponto de partida que fizer mais sentido.'
        : 'Pense em quem vai visitar mais vezes. Estar perto da família pesa muito no bem-estar — e nas idas às consultas.'
    case 4:
      return 'Uma referência honesta evita mostrar-lhe o que não serve. Os valores da zona vêm das mensalidades publicadas pelas próprias instituições.'
    default:
      return 'Se a vaga é urgente, damos mais peso aos lares com lugar livre agora. Se há tempo, a previsão de vagas ajuda a escolher onde vale a pena inscrever-se.'
  }
}
