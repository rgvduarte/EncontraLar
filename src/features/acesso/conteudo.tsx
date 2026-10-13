/**
 * Textos da página /acesso: o que a versão grátis e o Acesso Família incluem (a lista canónica do brief,
 * com as mesmas palavras dos bloqueios no resto do site) e as perguntas frequentes.
 */
import { Link } from 'react-router'
import { IVA_FAMILIA_PERCENT } from '@/lib/acesso'
import type { FaqItem } from '@/features/content/shared/Faq'

export interface LinhaComparacao {
  t: string
  /** nota curta por baixo (só quando a diferença precisa de exemplo) */
  nota?: string
}

export interface GrupoComparacao {
  id: string
  titulo: string
  /** a versão grátis inclui este grupo? (o Acesso Família inclui tudo) */
  gratis: boolean
  linhas: readonly LinhaComparacao[]
}

export const COMPARACAO: readonly GrupoComparacao[] = [
  {
    id: 'explorar',
    titulo: 'Para explorar',
    gratis: true,
    linhas: [
      { t: 'Todas as instituições, o tipo e onde ficam' },
      { t: 'Selo de verificação e avaliação das famílias' },
      { t: 'Faixa de preço', nota: 'Por exemplo, «1.000\u00a0€ a 2.000\u00a0€/mês».' },
      { t: 'Descrição, serviços e cuidados' },
      { t: 'Quantas têm vaga em cada zona', nota: 'O número, sem dizer quais.' },
      { t: 'Guia e apoios' },
    ],
  },
  {
    id: 'informacao',
    titulo: 'A informação que muda todos os dias',
    gratis: false,
    linhas: [{ t: 'Que instituições têm vaga e quantos lugares' }, { t: 'Preços por quarto' }, { t: 'Previsão de espera' }, { t: 'Contactos' }],
  },
  {
    id: 'pedidos',
    titulo: 'Para pôr os pedidos a andar',
    gratis: false,
    linhas: [{ t: 'Pedidos a várias casas' }, { t: 'Visitas' }, { t: 'Alertas de vaga' }, { t: 'Comparação' }],
  },
]

export const FAQ_ACESSO: readonly FaqItem[] = [
  {
    q: 'Há renovação automática?',
    a: <p>Não. Cada passe é um pagamento único. Quando termina, não é cobrado mais nada.</p>,
  },
  {
    q: 'Posso cancelar?',
    a: (
      <p>
        O acesso começa logo a seguir ao pagamento, com o seu consentimento, e por isso deixa de poder exercer o direito de livre resolução de 14
        dias. Também não há renovação para cancelar: o passe termina sozinho.
      </p>
    ),
  },
  {
    q: 'O que acontece quando termina?',
    a: <p>Volta à versão grátis. Os seus pedidos e os perfis de cuidados ficam guardados na conta.</p>,
  },
  {
    q: 'Comprar outra vez soma dias?',
    a: <p>Sim. Os dias novos juntam-se aos que ainda faltam, por isso não perde nenhum dia já pago.</p>,
  },
  {
    q: 'Os preços incluem IVA?',
    a: <p>Sim, já incluem o IVA, à taxa de {IVA_FAMILIA_PERCENT}%. A fatura-recibo segue por email.</p>,
  },
  {
    q: 'Pagar dá prioridade?',
    a: (
      <p>
        Não. Pagar não muda a ordem dos resultados nem dá prioridade nas vagas.{' '}
        <Link to="/como-ordenamos" className="link">
          Ver como ordenamos
        </Link>
      </p>
    ),
  },
]
