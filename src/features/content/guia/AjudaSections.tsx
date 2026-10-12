/**
 * #faq e #linhas — perguntas frequentes e linhas de apoio (com ligações tel:).
 */
import { Link } from 'react-router'
import { PhoneCall } from 'lucide-react'
import { calcadaStonesBg } from '@/components/brand/patterns'
import { AnchorSection, SectionMark } from '../shared/editorial'
import { FaqList, type FaqItem } from '../shared/Faq'

const FAQ: FaqItem[] = [
  {
    q: 'O meu pai vai ter alta e não tem para onde ir. O que faço?',
    a: (
      <>
        <p>
          Fale, ainda durante o internamento, com o serviço social do hospital. A equipa pode avaliar a referenciação para a Rede Nacional de
          Cuidados Continuados Integrados, se houver necessidade de recuperação ou de cuidados prolongados.
        </p>
        <p>
          Em paralelo, veja que lares têm vaga agora perto de si e peça já uma visita.{' '}
          <Link to="/pesquisa?vaga=agora" className="link">
            Ver lares com vaga agora
          </Link>
        </p>
      </>
    ),
  },
  {
    q: 'A pessoa tem de concordar em ir para um lar?',
    a: (
      <>
        <p>
          Sim. Sempre que a pessoa consegue decidir, a decisão é dela. Envolva-a desde o início: visitem juntos, falem do que é importante para
          ela — o quarto, as rotinas, a proximidade de amigos.
        </p>
        <p>
          Quando a pessoa já não tem capacidade para decidir, a lei prevê o regime do <strong>maior acompanhado</strong>, decidido em tribunal.
          A assistente social ou um advogado podem explicar os passos.
        </p>
      </>
    ),
  },
  {
    q: 'Posso inscrever-me em vários lares ao mesmo tempo?',
    a: (
      <p>
        Pode — e muitas vezes deve. Mas avise as instituições quando já não precisar da vaga: as listas de espera ficam mais curtas e mais
        verdadeiras para todos. É também por isso que a nossa previsão desconta parte de cada lista de espera.{' '}
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
        É um lugar numa IPSS ou Misericórdia com acordo de cooperação com a Segurança Social. A mensalidade é calculada em função dos
        rendimentos, por isso costuma ser mais acessível — e a procura é maior. No mapa, pode mostrar só instituições com estas vagas.
      </p>
    ),
  },
  {
    q: 'Quanto tempo vou esperar por uma vaga?',
    a: (
      <p>
        Depende da instituição, do tipo de quarto e de quantas pessoas estão à frente. Em cada ficha mostramos uma previsão, lida como a
        previsão do tempo — provável, possível, pouco provável — calculada a partir das saídas dos últimos meses. É uma estimativa, não uma
        garantia.
      </p>
    ),
  },
  {
    q: 'E se não houver vaga a tempo?',
    a: (
      <p>
        Há soluções para o intervalo: apoio domiciliário reforçado, centro de dia, ou uma estadia temporária num lar (algumas instituições
        aceitam períodos curtos, por exemplo para descanso do cuidador). Mantenha os alertas de vaga ligados nas instituições que guardou.
      </p>
    ),
  },
  {
    q: 'Os dados de saúde que indico ficam protegidos?',
    a: (
      <p>
        Sim. São dados de categoria especial: só os partilhamos com as instituições a quem pede vaga, e só com o seu consentimento explícito.{' '}
        <Link to="/privacidade" className="link">
          Ler a política de privacidade
        </Link>
      </p>
    ),
  },
]

const LINHAS = [
  { numero: '112', tel: '112', nome: 'Número Europeu de Emergência', quando: 'Perigo imediato para a vida ou a saúde.' },
  { numero: '808 24 24 24', tel: '808242424', nome: 'SNS 24', quando: 'Dúvidas de saúde e encaminhamento, 24 horas por dia.' },
  { numero: '144', tel: '144', nome: 'Linha Nacional de Emergência Social', quando: 'Situações de abandono, isolamento ou falta de resposta social urgente. Gratuita, 24 horas.' },
  { numero: '800 20 35 31', tel: '800203531', nome: 'Linha do Cidadão Idoso', quando: 'Provedoria de Justiça: informação sobre direitos das pessoas idosas. Chamada gratuita.' },
  { numero: '116 006', tel: '116006', nome: 'APAV — Apoio à Vítima', quando: 'Suspeita de maus-tratos, negligência ou abuso financeiro.' },
]

export function FaqSection() {
  return (
    <AnchorSection id="faq">
      <SectionMark
        n={6}
        titleId="faq-titulo"
        eyebrow="Perguntas frequentes"
        title={
          <>
            O que as famílias nos <em>perguntam</em>
          </>
        }
      />
      <FaqList items={FAQ} className="mt-8" />
    </AnchorSection>
  )
}

export function LinhasSection() {
  return (
    <AnchorSection id="linhas">
      <SectionMark
        n={7}
        titleId="linhas-titulo"
        eyebrow="Linhas de apoio"
        title={
          <>
            Quando precisa de <em>falar</em> com alguém
          </>
        }
        lead="Toque no número para ligar a partir do telemóvel."
      />
      <div
        className="on-dark mt-8 overflow-hidden rounded-[1.75rem] bg-pine-950 text-pine-50 shadow-lift ring-1 ring-black/20 [print-color-adjust:exact]"
        style={calcadaStonesBg('#ffffff', 0.035)}
      >
        <p className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4 text-sm font-bold tracking-[0.16em] text-sun-200 uppercase sm:px-7">
          <PhoneCall aria-hidden className="size-4" /> Números úteis
        </p>
        <ul className="divide-y divide-white/10">
          {LINHAS.map((l) => (
            <li key={l.numero}>
              <a
                href={`tel:${l.tel}`}
                className="group grid gap-x-6 gap-y-1 px-5 py-4 transition-colors hover:bg-white/5 focus-visible:bg-white/8 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center sm:px-7 sm:py-5"
              >
                <span className="font-mono text-2xl font-bold text-sun-200 tabular group-hover:text-white sm:text-[1.65rem]">{l.numero}</span>
                <span className="flex flex-col">
                  <span className="font-bold text-white">{l.nome}</span>
                  <span className="text-sm text-pine-200">{l.quando}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-5 max-w-[66ch] text-base text-ink-soft">
        Perto de si, o serviço social do centro de saúde e a ação social da junta de freguesia ou da câmara municipal também orientam famílias
        que procuram lar ou apoio em casa.
      </p>
    </AnchorSection>
  )
}
