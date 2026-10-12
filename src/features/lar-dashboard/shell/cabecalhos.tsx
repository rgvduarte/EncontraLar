import type { ReactNode } from 'react'
import type { Lar, User } from '@/types'
import { extenso, saudacao, type Assuntos } from '../lib/derive'
import { Troca } from '../shared/motion'

export type Seccao = 'resumo' | 'vagas' | 'pedidos' | 'previsao' | 'ficha'

export function seccaoDoCaminho(pathname: string): Seccao {
  const s = pathname.replace(/^\/gestao\/?/, '').split('/')[0]
  return s === 'vagas' || s === 'pedidos' || s === 'previsao' || s === 'ficha' ? s : 'resumo'
}

interface Cabecalho {
  eyebrow: ReactNode
  title: ReactNode
  subtitle: ReactNode
  /** título do separador do navegador */
  doc: string
}

/**
 * Título (h1) e frase de apoio de cada secção — curtos, uma ideia cada.
 * No telemóvel o cabeçalho fica compacto (nome da casa + título): a frase de apoio só aparece no Resumo,
 * onde diz o que está à espera. Ao mudar de separador, o título e a frase entram com um leve desfoque.
 */
export function cabecalho(seccao: Seccao, lar: Lar, user: User | null, a: Assuntos, passosEmFalta: number, agora: Date): Cabecalho {
  const c = textos(seccao, lar, user, a, passosEmFalta, agora)
  return {
    ...c,
    title: <Troca k={seccao}>{c.title}</Troca>,
    subtitle: (
      <Troca k={seccao} className={seccao === 'resumo' ? undefined : 'max-sm:hidden'}>
        {c.subtitle}
      </Troca>
    ),
  }
}

function textos(seccao: Seccao, lar: Lar, user: User | null, a: Assuntos, passosEmFalta: number, agora: Date): Cabecalho {
  // no telemóvel não há barra lateral: o nome da casa aparece por cima do título;
  // no desktop (o nome já está na barra lateral) fica "Painel da instituição", como o "Painel da família"
  const eyebrow = (
    <>
      <span className="lg:hidden">{lar.nome}</span>
      <span className="max-lg:hidden">Painel da instituição</span>
    </>
  )
  switch (seccao) {
    case 'resumo': {
      const nome = user?.nome.split(' ')[0]
      const subtitle =
        a.total > 0
          ? `Tem ${extenso(a.total)} ${a.total === 1 ? 'assunto' : 'assuntos'} à sua espera.`
          : passosEmFalta > 0
            ? passosEmFalta === 1
              ? 'Falta um passo para a ficha ficar completa.'
              : `Faltam ${extenso(passosEmFalta)} passos para a ficha ficar completa.`
            : 'Está tudo em dia.'
      return { eyebrow, title: `${saudacao(agora)}${nome ? `, ${nome}` : ''}.`, subtitle, doc: 'Resumo da instituição' }
    }
    case 'vagas':
      return {
        eyebrow,
        title: 'Vagas',
        subtitle: 'Mude os lugares livres num toque. As famílias veem a alteração de imediato.',
        doc: 'Vagas',
      }
    case 'pedidos':
      return {
        eyebrow,
        title: 'Pedidos',
        subtitle: 'Cada pedido chega com o perfil e a compatibilidade já verificados.',
        doc: 'Pedidos das famílias',
      }
    case 'previsao':
      return {
        eyebrow,
        title: 'Previsão de vagas',
        subtitle: (
          <>
            Quantos lugares deverão <span className="whitespace-nowrap">libertar-se</span> nos próximos meses, a partir do seu histórico.
          </>
        ),
        doc: 'Previsão de vagas',
      }
    case 'ficha':
      return {
        eyebrow,
        title: 'Ficha pública',
        subtitle: 'O que as famílias leem antes de lhe telefonar.',
        doc: 'Ficha pública',
      }
  }
}
