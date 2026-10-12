import type { ReactNode } from 'react'
import type { Lar, User } from '@/types'
import { tempoRelativo } from '@/lib/format'
import { extenso, saudacao, type Assuntos } from '../lib/derive'

export type Seccao = 'resumo' | 'vagas' | 'pedidos' | 'previsao' | 'ficha'

export function seccaoDoCaminho(pathname: string): Seccao {
  const s = pathname.replace(/^\/gestao\/?/, '').split('/')[0]
  return s === 'vagas' || s === 'pedidos' || s === 'previsao' || s === 'ficha' ? s : 'resumo'
}

interface Cabecalho {
  eyebrow: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** título do separador do navegador */
  doc: string
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Título (h1) de cada secção — no resumo, diz logo o que espera pela pessoa. */
export function cabecalho(seccao: Seccao, lar: Lar, user: User | null, a: Assuntos, agora: Date): Cabecalho {
  const primeiroNome = user?.nome.split(' ')[0]
  switch (seccao) {
    case 'resumo': {
      const pendentes = a.total
      const nv = a.novos.length
      const vs = a.visitas.length
      const pr = a.propostas.length
      const partes = [
        nv ? `${nv} ${nv === 1 ? 'pedido novo' : 'pedidos novos'}` : null,
        vs ? `${vs} ${vs === 1 ? 'visita' : 'visitas'} por confirmar` : null,
        pr ? `${pr} ${pr === 1 ? 'vaga proposta' : 'vagas propostas'} à espera de resposta` : null,
        a.vagaPorPreencher ? 'vaga livre por propor à lista de espera' : null,
        a.desatualizada ? 'vagas por confirmar' : null,
      ].filter(Boolean)
      return {
        eyebrow: capitalizar(agora.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' })),
        title: (
          <>
            {saudacao(agora)}
            {primeiroNome ? `, ${primeiroNome}` : ''}.{' '}
            {pendentes > 0 ? (
              <>
                Há <em>{extenso(pendentes)} {pendentes === 1 ? 'assunto' : 'assuntos'}</em> à sua espera.
              </>
            ) : (
              <>
                Está <em>tudo em dia</em>.
              </>
            )}
          </>
        ),
        subtitle:
          partes.length > 0
            ? `${capitalizar(partes.join(' · '))}. Vagas confirmadas ${tempoRelativo(lar.atualizadoEm, agora)}.`
            : `Sem pedidos por responder. Vagas confirmadas ${tempoRelativo(lar.atualizadoEm, agora)}.`,
        doc: 'Resumo da instituição',
      }
    }
    case 'vagas':
      return {
        eyebrow: 'Vagas',
        title: (
          <>
            Lugares <em>livres</em>, num toque.
          </>
        ),
        subtitle: 'Cada alteração aparece logo no mapa de vagas — e quem espera por um lugar é avisado sem ter de lhe telefonar.',
        doc: 'Vagas',
      }
    case 'pedidos':
      return {
        eyebrow: 'Pedidos',
        title: (
          <>
            Pedidos das <em>famílias</em>
          </>
        ),
        subtitle: 'Cada pedido chega com o perfil clínico e a compatibilidade já verificada. Responda daqui: a família é avisada de imediato.',
        doc: 'Pedidos das famílias',
      }
    case 'previsao':
      return {
        eyebrow: 'Previsão',
        title: (
          <>
            Previsão de <em>vagas</em>
          </>
        ),
        subtitle: 'Uma estimativa estatística feita com o seu histórico, para preparar a lista de espera antes de o quarto ficar vazio.',
        doc: 'Previsão de vagas',
      }
    case 'ficha':
      return {
        eyebrow: 'Ficha pública',
        title: (
          <>
            A sua ficha <em>pública</em>
          </>
        ),
        subtitle: 'É o que as famílias leem antes de lhe telefonar. Quanto mais completa, menos perguntas repetidas.',
        doc: 'Ficha pública',
      }
  }
}
