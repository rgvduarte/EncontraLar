import { Link } from 'react-router'
import type { FaqItem } from '../shared/Faq'

export const LARES_FAQ: FaqItem[] = [
  {
    q: 'Quanto tempo leva a pôr a instituição no mapa?',
    a: (
      <p>
        Poucos minutos: dados da instituição, número da licença de funcionamento e mensalidade de partida. A ficha fica logo disponível para
        completar; o selo chega depois da visita presencial.
      </p>
    ),
  },
  {
    q: 'Temos vagas com acordo de cooperação. Faz sentido aderir?',
    a: (
      <p>
        Sim. Indique na ficha que tem vagas comparticipadas pela Segurança Social: as famílias que precisam de comparticipação filtram por isso.
        A lista de espera digital ajuda a gerir as inscrições, que nestas vagas costumam ser mais longas.
      </p>
    ),
  },
  {
    q: 'Quem vê os dados de saúde das famílias?',
    a: (
      <p>
        Só a instituição a quem a família envia o pedido, e só com o seu consentimento explícito: são dados de categoria especial (artigo 9.º
        do RGPD). Não há listas de contactos à venda.{' '}
        <Link to="/privacidade" className="link">
          Ler a política de privacidade
        </Link>
      </p>
    ),
  },
  {
    q: 'E se não tivermos tempo para atualizar as vagas?',
    a: (
      <p>
        Atualizar é um toque. Se nada mudou, basta confirmar. A ficha mostra sempre às famílias a data da última atualização, e uma casa
        atualizada inspira mais confiança.
      </p>
    ),
  },
  {
    q: 'Como é calculada a previsão?',
    a: (
      <p>
        A partir das saídas dos últimos 12 meses, da estadia média dos residentes e da altura do ano. É uma estimativa, sempre apresentada como
        tal.{' '}
        <Link to="/sobre#previsao" className="link">
          Ver o método
        </Link>
      </p>
    ),
  },
]
