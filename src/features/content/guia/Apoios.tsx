/**
 * #apoios — comparticipações e apoios. Sem valores: as regras mudam e remetemos sempre para a fonte oficial.
 */
import { Confirme } from '../shared/ui'
import { GuideSection } from './Section'

const APOIOS = [
  {
    nome: 'Comparticipação familiar nas IPSS e Misericórdias',
    texto:
      'Nas vagas com acordo de cooperação com a Segurança Social, a mensalidade não é um preço fixo: é calculada conforme os rendimentos do agregado.',
    onde: 'Na própria instituição. Peça o regulamento interno e uma simulação por escrito.',
    fonte: 'ss',
  },
  {
    nome: 'Complemento por Dependência',
    texto: 'Prestação mensal para pensionistas que precisam da ajuda de outra pessoa no dia a dia. Tem dois graus, conforme a dependência.',
    onde: 'Segurança Social Direta ou num balcão da Segurança Social.',
    fonte: 'ss',
  },
  {
    nome: 'Complemento Solidário para Idosos',
    texto: 'Apoio mensal para pessoas idosas com pensões baixas, até um valor de referência fixado todos os anos.',
    onde: 'Segurança Social Direta ou num balcão da Segurança Social.',
    fonte: 'ss',
  },
  {
    nome: 'Estatuto do Cuidador Informal',
    texto:
      'Reconhece quem cuida de um familiar dependente em casa e dá acesso a apoios, como períodos de descanso e, em certos casos, um subsídio. Útil enquanto se espera por vaga.',
    onde: 'Segurança Social Direta ou num balcão da Segurança Social.',
    fonte: 'ss',
  },
  {
    nome: 'Dedução das despesas com lares no IRS',
    texto:
      'Parte das mensalidades pagas a lares pode ser deduzida no IRS, até um limite anual. Deduz o próprio residente ou, se os pais tiverem rendimentos baixos (há um limite na lei), os filhos que pagam o lar.',
    onde: 'No e-Fatura, confirme que as faturas estão no NIF de quem paga e na categoria certa.',
    fonte: 'financas',
  },
] as const

export function Apoios() {
  return (
    <GuideSection
      id="apoios"
      title="Apoios e custos."
      lead="O custo é muitas vezes o que mais preocupa. Há apoios públicos que fazem diferença. Os valores mudam todos os anos, por isso dizemos sempre onde confirmar."
    >
      <ul className="flex flex-col border-b border-line">
        {APOIOS.map((a) => (
          <li key={a.nome} className="border-t border-line py-7">
            <h3 className="text-xl font-semibold text-ink">{a.nome}</h3>
            <p className="mt-2 text-lg leading-relaxed text-ink-soft">{a.texto}</p>
            <p className="mt-2 text-base text-ink-soft">
              <span className="font-medium text-ink">Onde pedir: </span>
              {a.onde}
            </p>
            <Confirme fonte={a.fonte} className="mt-2" />
          </li>
        ))}
      </ul>
      <p className="mt-8 text-lg leading-relaxed text-ink-soft">
        Não sabe a que tem direito? A assistente social do hospital ou do centro de saúde, e a ação social da junta de freguesia ou da câmara,
        ajudam a perceber que apoios se aplicam e a reunir os documentos.
      </p>
    </GuideSection>
  )
}
