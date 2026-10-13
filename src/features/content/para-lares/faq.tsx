import { Link } from 'react-router'
import type { FaqItem } from '../shared/Faq'

export const LARES_FAQ: FaqItem[] = [
  {
    q: 'Quanto custa?',
    a: (
      <>
        <p>
          Estar no EncontraLar é gratuito para todas as instituições, com todas as funcionalidades. IPSS e Misericórdias não pagam nada. Os
          lares privados escolhem a modalidade que lhes serve melhor:
        </p>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 marker:text-ink-mute">
          <li>
            <strong>Por entrada</strong> — uma taxa fixa por cada pessoa que entra através do EncontraLar. Se ninguém entrar, não paga nada.
          </li>
          <li>
            <strong>Mensalidade</strong> — um valor fixo por mês, sem taxa por entrada, com compromisso de 12 meses. Compensa a quem recebe
            várias pessoas por ano.
          </li>
        </ul>
        <p className="mt-3">
          Os valores são acordados no contrato. Não há percentagem sobre a mensalidade dos residentes nem custos de adesão, e pode passar para a
          mensalidade quando quiser.
        </p>
      </>
    ),
  },
  {
    q: 'As famílias pagam para ver as vagas?',
    a: (
      <>
        <p>
          Explorar é gratuito: qualquer pessoa vê a ficha, a faixa de preço, a verificação, as avaliações e quantas casas têm vaga em cada zona.
          Para ver quais têm vaga, os preços por quarto e a previsão, e para enviar pedidos, as famílias podem comprar o Acesso Família. Os
          profissionais de saúde veem tudo, sem custos.
        </p>
        <p>
          O Acesso Família é pago só pelas famílias. Não muda a ordem dos resultados, não dá prioridade nas vagas e não é visível para as
          instituições.
        </p>
      </>
    ),
  },
  {
    q: 'Como se sabe que a pessoa entrou através do EncontraLar?',
    a: (
      <>
        <p>
          O primeiro pedido fica registado na plataforma, com data. Quando a pessoa entra, a instituição carrega em «Entrou» no painel e a
          família responde a «Já entrou?» do seu lado. Basta uma confirmação para a entrada contar; com as duas fica «Entrada verificada».
        </p>
        <p>
          Conta a entrada que acontece até 12 meses depois desse primeiro pedido. Só a família que confirmou a entrada pode deixar uma
          avaliação verificada. Nos lares privados por entrada, é esta entrada que dá lugar à taxa fixa; com mensalidade, está incluída. IPSS
          e Misericórdias ficam isentas.
        </p>
      </>
    ),
  },
  {
    q: 'O que vê a instituição antes de aceitar um pedido?',
    a: (
      <>
        <p>
          Um resumo sem identificação: faixa etária, grau de dependência, cuidados necessários, zona, orçamento, urgência e origem do pedido
          (uma família, ou um hospital com a data prevista de alta). Chega para decidir se a casa tem condições.
        </p>
        <p>
          O nome, o contacto e o perfil completo só aparecem quando carrega em «Aceitar e ver contacto». Se recusar sem aceitar, nunca chega a
          vê-los.
        </p>
      </>
    ),
  },
  {
    q: 'Podemos pagar para aparecer primeiro?',
    a: (
      <p>
        Não. Ninguém paga para aparecer primeiro e não há posições pagas: conforme a ordenação escolhida, a ordem depende da vaga, da distância,
        do preço ou das avaliações das famílias. O Acesso Família, que as famílias podem comprar, também não mexe na ordem.{' '}
        <Link to="/como-ordenamos" className="link">
          Ver como ordenamos
        </Link>
      </p>
    ),
  },
  {
    q: 'Quanto tempo leva a pôr a instituição no mapa?',
    a: (
      <p>
        Poucos minutos: dados da instituição, número da licença de funcionamento e mensalidade de partida. A ficha fica logo disponível para
        completar. Depois confirmamos a licença e combinamos consigo a visita presencial.
      </p>
    ),
  },
  {
    q: 'Temos vagas com acordo de cooperação. Faz sentido aderir?',
    a: (
      <p>
        Sim, e não paga nada: IPSS e Misericórdias estão isentas de qualquer taxa. Indique na ficha que tem vagas comparticipadas pela Segurança
        Social: as famílias que precisam de comparticipação filtram por isso. A lista de espera digital ajuda a gerir as inscrições, que nestas
        vagas costumam ser mais longas.
      </p>
    ),
  },
  {
    q: 'Quem vê os dados de saúde das famílias?',
    a: (
      <p>
        Só as instituições a quem a família, ou o profissional de saúde que acompanha a pessoa, envia o pedido, e só com consentimento
        explícito: são dados de categoria especial (artigo 9.º do RGPD). Mesmo essas veem primeiro o resumo sem identificação. Não há listas
        de contactos à venda.{' '}
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
        Atualizar é um toque. Se nada mudou, basta confirmar. Junto das vagas aparece sempre a data da última atualização, e uma casa
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
