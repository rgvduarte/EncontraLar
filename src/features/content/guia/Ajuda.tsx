/**
 * #faq e #linhas — perguntas frequentes e números de apoio (ligações tel:).
 */
import { Link } from 'react-router'
import { FaqList, type FaqItem } from '../shared/Faq'
import { GuideSection } from './Section'

const FAQ: FaqItem[] = [
  {
    q: 'O meu pai vai ter alta e não tem para onde ir. O que faço?',
    a: (
      <p>
        Fale hoje com o serviço social do hospital, que pode avaliar a referenciação para cuidados continuados. Em paralelo, veja que lares têm
        vaga perto de si e peça uma visita.{' '}
        <Link to="/pesquisa?vaga=agora" className="link">
          Lares com vaga agora
        </Link>
      </p>
    ),
  },
  {
    q: 'A pessoa tem de concordar em ir para um lar?',
    a: (
      <>
        <p>Sim. Sempre que a pessoa consegue decidir, a decisão é dela. Visitem juntos e falem do que é importante para ela.</p>
        <p>
          Quando já não tem capacidade para decidir, a lei prevê o regime do maior acompanhado, decidido em tribunal. A assistente social ou um
          advogado explicam os passos.
        </p>
      </>
    ),
  },
  {
    q: 'Posso inscrever-me em vários lares ao mesmo tempo?',
    a: (
      <p>
        Pode, e muitas vezes deve. Mas avise quando já não precisar da vaga: as listas ficam mais curtas e mais verdadeiras para todos.{' '}
        <Link to="/sobre#previsao" className="link">
          Como calculamos a previsão
        </Link>
      </p>
    ),
  },
  {
    q: 'O que é uma vaga «com acordo»?',
    a: (
      <p>
        É um lugar numa IPSS ou Misericórdia com acordo de cooperação com a Segurança Social. A mensalidade depende dos rendimentos, por isso
        costuma ser mais acessível, e a procura é maior. No mapa pode mostrar só estas instituições.
      </p>
    ),
  },
  {
    q: 'E se não houver vaga a tempo?',
    a: (
      <p>
        Há soluções para o intervalo: apoio domiciliário reforçado, centro de dia ou uma estadia temporária num lar. Mantenha os alertas de vaga
        ligados nas instituições que guardou.
      </p>
    ),
  },
  {
    q: 'Os dados de saúde que indico ficam protegidos?',
    a: (
      <p>
        Sim. Só seguem para as instituições a quem pede vaga, e só com o seu consentimento explícito.{' '}
        <Link to="/privacidade" className="link">
          Privacidade
        </Link>
      </p>
    ),
  },
]

const LINHAS = [
  { numero: '112', tel: '112', nome: 'Número Europeu de Emergência', quando: 'Perigo imediato para a vida ou a saúde.' },
  { numero: '808 24 24 24', tel: '808242424', nome: 'SNS 24', quando: 'Dúvidas de saúde e encaminhamento, 24 horas por dia.' },
  { numero: '144', tel: '144', nome: 'Linha Nacional de Emergência Social', quando: 'Abandono, isolamento ou falta de resposta social urgente. Gratuita, 24 horas.' },
  { numero: '800 20 35 31', tel: '800203531', nome: 'Linha do Cidadão Idoso', quando: 'Provedoria de Justiça: direitos das pessoas idosas. Chamada gratuita.' },
  { numero: '116 006', tel: '116006', nome: 'APAV — Apoio à Vítima', quando: 'Suspeita de maus-tratos, negligência ou abuso financeiro.' },
] as const

export function Faq() {
  return (
    <GuideSection id="faq" title="Perguntas frequentes.">
      <FaqList items={FAQ} />
    </GuideSection>
  )
}

export function Linhas() {
  return (
    <GuideSection id="linhas" title="Linhas de apoio." lead="Toque no número para ligar.">
      <ul className="flex flex-col border-b border-line">
        {LINHAS.map((l) => (
          <li key={l.tel} className="border-t border-line">
            <a
              href={`tel:${l.tel}`}
              className="group grid gap-x-8 gap-y-1 py-5 transition-colors sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-baseline"
            >
              <span className="text-2xl font-semibold tracking-tight text-terra-600 tabular group-hover:text-terra-700">{l.numero}</span>
              <span>
                <span className="block font-semibold text-ink">{l.nome}</span>
                <span className="block text-base text-ink-mute">{l.quando}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-base text-ink-mute">
        Perto de si, o serviço social do centro de saúde e a ação social da junta de freguesia ou da câmara também orientam quem procura lar ou
        apoio em casa.
      </p>
    </GuideSection>
  )
}
