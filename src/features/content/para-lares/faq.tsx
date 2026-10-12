import { Link } from 'react-router'
import type { FaqItem } from '../shared/Faq'

export const LARES_FAQ: FaqItem[] = [
  {
    q: 'Quanto tempo leva a pôr a instituição no mapa?',
    a: (
      <p>
        O registo leva poucos minutos: dados da instituição, número da licença de funcionamento e mensalidade de partida. A ficha fica logo
        disponível no painel para completar; o selo de verificação chega depois da visita presencial.
      </p>
    ),
  },
  {
    q: 'Temos vagas com acordo de cooperação. Faz sentido aderir?',
    a: (
      <p>
        Sim. Indique na ficha que tem vagas comparticipadas pela Segurança Social: as famílias que precisam de comparticipação conseguem filtrar
        por isso. A lista de espera digital ajuda a gerir as inscrições, que nestas vagas tendem a ser mais longas.
      </p>
    ),
  },
  {
    q: 'Quem vê os dados de saúde das famílias?',
    a: (
      <>
        <p>
          Só a instituição a quem a família envia o pedido, e só depois de a família dar consentimento explícito — são dados de saúde, uma
          categoria especial protegida pelo artigo 9.º do RGPD. Não vê pedidos feitos a outras casas e não há listas de contactos à venda.
        </p>
        <p>
          <Link to="/privacidade" className="link">
            Ler a política de privacidade
          </Link>
        </p>
      </>
    ),
  },
  {
    q: 'E se não tivermos tempo para atualizar as vagas?',
    a: (
      <p>
        Atualizar é um toque: mais uma vaga, menos uma vaga. Se nada mudou, pode confirmar que está tudo certo sem alterar nada. A ficha mostra
        sempre às famílias quando foi a última atualização — uma casa atualizada inspira mais confiança do que uma casa com mais estrelas.
      </p>
    ),
  },
  {
    q: 'Como é calculada a previsão de vagas?',
    a: (
      <>
        <p>
          A partir das saídas dos últimos 12 meses registadas pela instituição, da estadia média dos residentes e da altura do ano. É uma
          estimativa com margem de incerteza, sempre apresentada como tal.
        </p>
        <p>
          <Link to="/sobre#previsao" className="link">
            Ver o método explicado passo a passo
          </Link>
        </p>
      </>
    ),
  },
  {
    q: 'O destaque nas pesquisas não prejudica as famílias?',
    a: (
      <p>
        O destaque aparece sempre assinalado como tal e nunca esconde instituições mais compatíveis. Quando a família ordena por compatibilidade,
        distância ou preço, a ordem não é alterada.
      </p>
    ),
  },
]
