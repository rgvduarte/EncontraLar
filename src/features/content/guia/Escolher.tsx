/**
 * #escolher — sete critérios, cada um com a pergunta a fazer na visita.
 */
import { GuideSection } from './Section'

const CRITERIOS = [
  {
    t: 'Licença de funcionamento',
    d: 'É emitida pelo Instituto da Segurança Social e deve estar afixada. Sem licença, não há fiscalização regular.',
    q: 'Qual é o número da licença? Posso ver o documento?',
  },
  {
    t: 'Pessoal suficiente',
    d: 'Quantas pessoas cuidam de quantas, de dia, de noite e ao fim de semana. É o que mais pesa no dia a dia.',
    q: 'Quantos ajudantes estão de serviço à noite? E ao domingo?',
  },
  {
    t: 'Cuidados de saúde',
    d: 'Enfermagem todos os dias, médico com regularidade e, se houver demência, uma equipa preparada para isso.',
    q: 'O que acontece numa urgência às três da manhã?',
  },
  {
    t: 'Perto de quem visita',
    d: 'As visitas frequentes fazem diferença. Pense em quem vai visitar mais vezes, não só na antiga morada.',
    q: 'Posso vir almoçar ou passear com a minha mãe?',
  },
  {
    t: 'Alimentação',
    d: 'Cozinha própria, ementa variada e dietas adaptadas, como para diabetes ou para quem tem dificuldade em engolir.',
    q: 'Posso ficar para uma refeição?',
  },
  {
    t: 'Vida diária',
    d: 'Um plano de atividades que se cumpre. Residentes ocupados dizem mais do que qualquer folheto.',
    q: 'O que fizeram ontem à tarde?',
  },
  {
    t: 'Preço claro',
    d: 'A mensalidade, o que inclui, o preço de cada extra e como é atualizada.',
    q: 'Pode dar-me por escrito tudo o que vou pagar num mês normal?',
  },
] as const

export function Escolher() {
  return (
    <GuideSection id="escolher" title="Como escolher." lead="Não há lar perfeito. Há o lar certo para esta pessoa, agora. Compare estes sete pontos e leve as perguntas consigo.">
      <ol className="flex flex-col border-b border-line">
        {CRITERIOS.map((c, i) => (
          <li key={c.t} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-4 border-t border-line py-6 sm:grid-cols-[3rem_minmax(0,1fr)]">
            <span aria-hidden className="text-xl font-semibold text-ink-mute tabular">
              {i + 1}
            </span>
            <div>
              <h3 className="text-xl font-semibold text-ink">
                <span className="sr-only">{i + 1}. </span>
                {c.t}
              </h3>
              <p className="mt-1.5 text-lg leading-relaxed text-ink-soft">{c.d}</p>
              <p className="mt-2 text-base text-ink-mute">
                Pergunte: <span className="text-ink">«{c.q}»</span>
              </p>
            </div>
          </li>
        ))}
      </ol>
    </GuideSection>
  )
}
